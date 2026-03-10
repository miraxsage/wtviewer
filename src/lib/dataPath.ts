import path from "path";

export function getDataDir(): string {
  return process.env.WTVIEWER_DATA_PATH || path.join(process.cwd(), "data");
}
