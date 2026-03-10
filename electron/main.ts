import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import http from "http";

const isDev = !app.isPackaged;

// Simple JSON settings
function getSettingsPath(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeSetting(key: string, value: string) {
  const settings = readSettings();
  settings[key] = value;
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2));
}

function getDataPath(): string {
  return readSettings().dataPath || path.join(app.getPath("userData"), "WTViewerData");
}

function ensureDataDir(dataPath: string) {
  fs.mkdirSync(dataPath, { recursive: true });
  for (const sub of ["chats", "media", "backups"]) {
    fs.mkdirSync(path.join(dataPath, sub), { recursive: true });
  }
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = http.createServer();
    srv.listen(0, () => {
      const port = (srv.address() as any).port;
      srv.close(() => resolve(port));
    });
  });
}

async function startNextServer(port: number, dir: string): Promise<void> {
  const next = require("next");
  const nextApp = next({ dev: false, dir, port, hostname: "localhost" });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();
  const server = http.createServer((req: any, res: any) => handle(req, res));
  await new Promise<void>((resolve) => {
    server.listen(port, "localhost", () => resolve());
  });
}

let mainWindow: BrowserWindow | null = null;

async function createWindow(port: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: "default",
    show: false,
  });

  mainWindow.loadURL(`http://localhost:${port}`);
  mainWindow.once("ready-to-show", () => mainWindow!.show());
  mainWindow.on("closed", () => { mainWindow = null; });
}

// IPC handlers
ipcMain.handle("get-data-path", () => getDataPath());

ipcMain.handle("select-data-path", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
    title: "Select Data Directory",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const newPath = result.filePaths[0];
  writeSetting("dataPath", newPath);
  return newPath;
});

ipcMain.handle("get-is-electron", () => true);

app.whenReady().then(async () => {
  const dataPath = getDataPath();
  ensureDataDir(dataPath);
  process.env.WTVIEWER_DATA_PATH = dataPath;

  if (isDev) {
    await createWindow(3456);
  } else {
    const port = await findFreePort();
    const appDir = app.getAppPath();
    await startNextServer(port, appDir);
    await createWindow(port);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (mainWindow === null) {
    // Re-create window on macOS dock click
  }
});
