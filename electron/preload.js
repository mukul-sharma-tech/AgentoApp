// Minimal preload — contextIsolation is on, nodeIntegration is off.
// Expose nothing extra; the app runs as a normal web app inside Electron.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,
});
