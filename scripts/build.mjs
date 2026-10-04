// Runs after `vite build`:
//  1. Bundles the API server and all its dependencies into one file, dist/server/index.mjs,
//     so the production image needs no node_modules at all.
//  2. Precompresses the web UI (brotli + gzip) so the server never compresses static files at runtime.
import { build } from "esbuild";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

await build({
  entryPoints: ["src/server/index.ts"],
  outfile: "dist/server/index.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

const COMPRESSIBLE = /\.(js|css|html|svg|json|txt)$/;
let files = 0;
for (const entry of await readdir("dist/public", { recursive: true, withFileTypes: true })) {
  if (!entry.isFile() || !COMPRESSIBLE.test(entry.name)) continue;
  const path = join(entry.parentPath, entry.name);
  const data = await readFile(path);
  await writeFile(
    `${path}.br`,
    brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }),
  );
  await writeFile(`${path}.gz`, gzipSync(data, { level: 9 }));
  files++;
}
console.log(`precompressed ${files} web files (br + gz)`);
