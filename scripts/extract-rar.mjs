#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { createExtractorFromData } from "node-unrar-js";

const [, , archivePath, destDir] = process.argv;

if (!archivePath || !destDir) {
  console.error("Usage: extract-rar.mjs <archivePath> <destDir>");
  process.exit(1);
}

const buffer = fs.readFileSync(archivePath);
const data = Uint8Array.from(buffer).buffer;

const wasmBinary = fs.readFileSync(
  new URL(
    "../node_modules/node-unrar-js/dist/js/unrar.wasm",
    import.meta.url
  )
);

const extractor = await createExtractorFromData({
  wasmBinary: wasmBinary.buffer,
  data,
});

const extracted = extractor.extract();
for (const file of extracted.files) {
  if (file.fileHeader.flags.directory) {
    fs.mkdirSync(path.join(destDir, file.fileHeader.name), { recursive: true });
    continue;
  }
  const destPath = path.join(destDir, file.fileHeader.name);
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  if (file.extraction) {
    fs.writeFileSync(destPath, Buffer.from(file.extraction));
  }
}
