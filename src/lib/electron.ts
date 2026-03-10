interface ElectronAPI {
  getDataPath: () => Promise<string>;
  selectDataPath: () => Promise<string | null>;
  selectImportFolder: () => Promise<string | null>;
  isElectron: () => Promise<boolean>;
}

function getElectronAPI(): ElectronAPI | null {
  if (typeof window !== "undefined" && "electronAPI" in window) {
    return (window as unknown as { electronAPI: ElectronAPI }).electronAPI;
  }
  return null;
}

export async function isElectron(): Promise<boolean> {
  const api = getElectronAPI();
  if (!api) return false;
  try {
    return await api.isElectron();
  } catch {
    return false;
  }
}

export async function getDataPath(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.getDataPath();
}

export async function selectDataPath(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.selectDataPath();
}

export async function selectImportFolder(): Promise<string | null> {
  const api = getElectronAPI();
  if (!api) return null;
  return api.selectImportFolder();
}
