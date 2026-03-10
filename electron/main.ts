import { app, BrowserWindow, ipcMain, dialog } from "electron";
import path from "path";
import fs from "fs";
import http from "http";
import { fork, ChildProcess } from "child_process";

const isDev = !app.isPackaged;

// Simple JSON settings — portable-first (settings.json next to exe, fallback to userData)
function getPortableDir(): string {
  // In packaged app: directory containing the executable
  // In dev: project root
  return isDev ? process.cwd() : path.dirname(app.getPath("exe"));
}

function getSettingsPath(): string {
  // Check portable location first (next to exe)
  const portable = path.join(getPortableDir(), "settings.json");
  if (fs.existsSync(portable)) return portable;
  // Check userData location
  const userData = path.join(app.getPath("userData"), "settings.json");
  if (fs.existsSync(userData)) return userData;
  // Default to portable for new installs
  return portable;
}

function readSettings(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), "utf-8"));
  } catch {
    return {};
  }
}

function writeSetting(key: string, value: string) {
  const settingsPath = getSettingsPath();
  const settings = readSettings();
  settings[key] = value;
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function getDataPath(): string {
  const fromSettings = readSettings().dataPath;
  if (fromSettings) return fromSettings;
  // Check for portable data folder next to exe
  const portableData = path.join(getPortableDir(), "data");
  if (fs.existsSync(portableData)) return portableData;
  return path.join(app.getPath("userData"), "WTViewerData");
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

async function waitForPort(port: number, timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          res.resume();
          resolve();
        });
        req.on("error", reject);
        req.setTimeout(1000, () => { req.destroy(); reject(new Error("timeout")); });
      });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  throw new Error("Server did not start in time");
}

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

async function startStandaloneServer(port: number, dataPath: string): Promise<void> {
  const standaloneDir = path.join(process.resourcesPath, "standalone");
  const serverPath = path.join(standaloneDir, "server.js");

  serverProcess = fork(serverPath, [], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      PORT: String(port),
      HOSTNAME: "localhost",
      WTVIEWER_DATA_PATH: dataPath,
    },
  });

  serverProcess.on("error", (err) => {
    console.error("Server process error:", err);
  });

  await waitForPort(port);
}

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

ipcMain.handle("select-import-folder", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
    title: "Select Chat Export Folder",
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

app.whenReady().then(async () => {
  const dataPath = getDataPath();
  ensureDataDir(dataPath);
  process.env.WTVIEWER_DATA_PATH = dataPath;

  if (isDev) {
    await createWindow(3456);
  } else {
    const port = await findFreePort();
    await startStandaloneServer(port, dataPath);
    await createWindow(port);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    // Re-create window on macOS dock click
  }
});
