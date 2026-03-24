const { app, BrowserWindow, shell, dialog } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const http = require("http");
const fs = require("fs");

const PORT = 3000;
let nextProcess = null;
let mainWindow = null;

// ── Resolve paths correctly in both dev and packaged mode ────────────────────
const isPackaged = app.isPackaged;
const appRoot = isPackaged
  ? path.join(process.resourcesPath, "standalone")
  : path.join(__dirname, "..");

// ── Load .env.local (dev mode only — in prod, vars are baked into the build) ─
function loadEnv() {
  const candidates = [
    path.join(appRoot, ".env.local"),
    path.join(__dirname, "../.env.local"),
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
  console.log("[Env] No .env.local — using baked-in build env vars");
}

// ── Spawn Next.js standalone server ──────────────────────────────────────────
function startNextServer() {
  const serverPath = isPackaged
    ? path.join(process.resourcesPath, "standalone", "server.js")
    : path.join(__dirname, "../.next/standalone/server.js");

  console.log("[Next] Starting server at:", serverPath);

  if (!fs.existsSync(serverPath)) {
    dialog.showErrorBox("Agento Error", `Server not found at:\n${serverPath}\n\nPlease reinstall the app.`);
    app.quit();
    return;
  }

  nextProcess = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      NODE_ENV: "production",
      DEPLOYMENT_MODE: "desktop",
      NEXTAUTH_URL: `http://127.0.0.1:${PORT}`,
    },
    stdio: "pipe",
  });

  nextProcess.stdout.on("data", (d) => console.log("[Next]", d.toString().trim()));
  nextProcess.stderr.on("data", (d) => console.error("[Next]", d.toString().trim()));
  nextProcess.on("exit", (code) => console.log("[Next] exited with code", code));
}

// ── Poll until Next.js is ready ───────────────────────────────────────────────
function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http
        .get(`http://127.0.0.1:${PORT}`, (res) => {
          if (res.statusCode < 500) resolve();
          else if (n > 0) setTimeout(() => attempt(n - 1), 1000);
          else reject(new Error("Next.js server returned error status"));
        })
        .on("error", () => {
          if (n > 0) setTimeout(() => attempt(n - 1), 1000);
          else reject(new Error("Next.js server not reachable after 40s"));
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
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

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
    dialog.showErrorBox("Agento Error", `Failed to start the server:\n${err.message}\n\nMake sure no other app is using port ${PORT}.`);
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
