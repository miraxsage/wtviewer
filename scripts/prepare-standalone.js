const { execSync } = require("child_process");
const { cpSync, existsSync } = require("fs");
const path = require("path");

// Parse --platform=xxx --arch=xxx from CLI args
let targetPlatform = process.platform;
let targetArch = process.arch;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith("--platform=")) targetPlatform = arg.split("=")[1];
  if (arg.startsWith("--arch=")) targetArch = arg.split("=")[1];
}
const isCross = targetPlatform !== process.platform || targetArch !== process.arch;

// Copy static files (standalone doesn't include them)
console.log("Copying static files to standalone...");
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });
if (existsSync("public")) {
  cpSync("public", ".next/standalone/public", { recursive: true });
}

// Copy node-unrar-js to standalone (used by child process for RAR extraction)
const unrarSrc = path.join("node_modules", "node-unrar-js");
const unrarDest = path.join(".next", "standalone", "node_modules", "node-unrar-js");
if (existsSync(unrarSrc) && !existsSync(unrarDest)) {
  console.log("Copying node-unrar-js to standalone...");
  cpSync(unrarSrc, unrarDest, { recursive: true });
}

// Rebuild native modules for Electron's Node ABI
const platformArgs = isCross ? ` --platform ${targetPlatform} --arch ${targetArch}` : "";
console.log(`Rebuilding native modules for Electron (${targetPlatform}-${targetArch})...`);
try {
  execSync(`npx electron-rebuild${platformArgs} --module-dir .next/standalone`, {
    stdio: "inherit",
  });
} catch (err) {
  if (isCross) {
    console.error(
      `\nCross-compilation failed for ${targetPlatform}-${targetArch}.` +
      `\nNative modules like better-sqlite3 require building on the target platform.` +
      `\nBuild on ${targetPlatform} or use CI with a ${targetPlatform} runner.`
    );
  }
  process.exit(1);
}

console.log("Standalone preparation complete.");
