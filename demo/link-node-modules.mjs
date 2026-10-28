// The app's source lives in ../client and ../server, outside this folder,
// so bare imports there ("react", "drizzle-orm", "tailwindcss", ...) are
// resolved by walking up from the repo root. Point the repo root's
// node_modules (gitignored) at this folder's install so they resolve to
// the same packages the demo build uses.

import { existsSync, lstatSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const demoDir = dirname(fileURLToPath(import.meta.url));
const rootModules = join(demoDir, "..", "node_modules");

if (!existsSync(rootModules) && !isDanglingLink(rootModules)) {
  symlinkSync(join("demo", "node_modules"), rootModules, "dir");
}

function isDanglingLink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}
