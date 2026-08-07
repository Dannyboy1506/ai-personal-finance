// Bundles the server into a single self-contained ESM file at dist/index.js
// (package.json's "type": "module" means plain .js is already valid ESM —
// deliberately NOT renamed to .mjs here; see note below).
//
// esbuild does the TS -> JS transpile here — no type-checking as part of
// this step, that's the separate `pnpm typecheck` script, same split
// pattern as the rest of this monorepo.
//
// esbuild-plugin-pino is required, not optional: pino loads its transports
// (like pino-pretty) in real worker threads at runtime via a file path,
// which a static bundle can't resolve on its own. The plugin generates a
// handful of extra files (thread-stream.js, pino-worker.js, pino-file.js,
// pino-pretty.js) alongside index.js — deploying dist/index.js by itself
// without the rest of dist/ will crash the first time something logs.
//
// Output is deliberately left at esbuild's default .js extension rather
// than renamed to .mjs via outExtension: the pino plugin's generated
// companion files above cross-reference each other by path at runtime,
// and renaming everything to .mjs risks breaking that internal
// cross-referencing in a way that's hard to verify without actually
// running the build. Plain .js is unambiguous here since "type": "module"
// already makes it ESM — no need to take on that risk for no benefit.
import { build } from 'esbuild';
import esbuildPluginPino from 'esbuild-plugin-pino';
import { rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });

await build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })],
}).catch(() => {
  process.exit(1);
});
