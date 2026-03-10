import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
  selectDataPath: () => ipcRenderer.invoke("select-data-path"),
  selectImportFolder: () => ipcRenderer.invoke("select-import-folder"),
  isElectron: () => ipcRenderer.invoke("get-is-electron"),
});
