import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electronAPI", {
  getDataPath: () => ipcRenderer.invoke("get-data-path"),
  selectDataPath: () => ipcRenderer.invoke("select-data-path"),
  isElectron: () => ipcRenderer.invoke("get-is-electron"),
});
