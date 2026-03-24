const { app, BrowserWindow, shell } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3000;
let nextProcess = null;
let mainWindow = null;

// ── Load .env.local into process.env ─────────────────────────────────────────
function loadEnv() {
  // In packaged app, .env.local sits next to the exe in resources
  // In dev (electron:dev), it's at the project root
  const candidates = [
    path.join(process.resourcesPath ?? "", ".env.local"),
    path.join(__dirname, "../.env.local"),
    path.join(process.cwd(), ".env.local"),
  ];

  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf-8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (key && !process.env[key]) process.env[key] = val;
      }
      console.log("[Env] Loaded from", envPath);
      return;
    }
  }
  console.warn("[Env] No .env.local found — env vars must be set externally");
}

// ── Spawn Next.js standalone server ──────────────────────────────────────────
function startNextServer() {
  const serverPath = path.join(__dirname, "../.next/standalone/server.js");

  nextProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DEPLOYMENT_MODE: "desktop",
      // Override so NextAuth sets cookies for localhost, not the cloud URL
      NEXTAUTH_URL: `http://127.0.0.1:${PORT}`,
    },
    stdio: "pipe",
  });

  nextProcess.stdout.on("data", (d) => console.log("[Next]", d.toString().trim()));
  nextProcess.stderr.on("data", (d) => console.error("[Next]", d.toString().trim()));

  nextProcess.on("exit", (code) => {
    console.log("[Next] exited with code", code);
  });
}

// ── Poll until Next.js is ready ───────────────────────────────────────────────
function waitForServer(retries = 30) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http
        .get(`http://127.0.0.1:${PORT}`, (res) => {
          if (res.statusCode < 500) resolve();
          else if (n > 0) setTimeout(() => attempt(n - 1), 1000);
          else reject(new Error("Next.js server failed to start"));
        })
        .on("error", () => {
          if (n > 0) setTimeout(() => attempt(n - 1), 1000);
          else reject(new Error("Next.js server not reachable"));
        });
    };
    attempt(retries);
  });
}

// ── Create Electron window ────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Agento",
    icon: path.join(__dirname, "../public/logo.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  // Open external links in the system browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(`http://127.0.0.1:${PORT}`)) {
      shell.openExternal(url);
      return { action: "deny" };
    }
    return { action: "allow" };
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  loadEnv();
  startNextServer();
  try {
    await waitForServer();
    createWindow();
  } catch (err) {
    console.error("Failed to start server:", err);
    app.quit();
  }
});

app.on("window-all-closed", () => {
  if (nextProcess) nextProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) createWindow();
});

app.on("before-quit", () => {
  if (nextProcess) nextProcess.kill();
});
