/**
 * Copies the prototype into public/ so Vite serves it at /prototype.
 *
 * docs/prototype/CareOps.html is the single source. Keeping a second copy
 * under version control meant patching the same file twice — which is how a
 * security fix gets applied to one copy and missed on the other. The served
 * copy is generated instead, and is gitignored.
 */
import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const from = resolve(root, "docs/prototype/CareOps.html");
const to = resolve(root, "public/prototype/index.html");

await mkdir(dirname(to), { recursive: true });
await copyFile(from, to);
console.log("prototype → public/prototype/index.html");
