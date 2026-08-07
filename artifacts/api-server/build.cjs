// Bundles the server into dist/index.js + a dist/package.json marking that
// folder CommonJS (see note below for why), matching package.json's
// "start": "node --enable-source-maps ./dist/index.js".
//
// esbuild does the TS -> JS transpile here — no type-checking as part of
// this step, that's the separate `pnpm typecheck` script, same split
// pattern as the rest of this monorepo.
//
// This script is deliberately .cjs, not .mjs, and everything below uses
// require(), not import. esbuild-plugin-pino's own dist/index.mjs (its ESM
// entry point) throws "require is not defined" internally when loaded via
// `import` — its own usage examples exclusively show require(), which
// resolves to a different, working CJS entry point. Loading it the
// documented way avoids that bug entirely rather than working around it.
//
// The bundle output format is CJS for the same reason: the plugin
// generates extra companion files (thread-stream.js, pino-worker.js,
// pino-file.js, pino-pretty.js) that pino's worker threads load by path at
// runtime, and CJS is what this plugin is actually built and documented
// around — mixing a CJS-oriented plugin with ESM-format output isn't
// something its docs show working, so this doesn't take on that risk for
// no benefit. A dist/package.json with "type": "commonjs" makes Node treat
// dist/index.js (and pino's companion files) as CommonJS regardless of
// this package's own "type": "module" — deliberately not renaming any
// file's extension, so nothing the plugin generates is touched.
const { build } = require('esbuild');
const esbuildPluginPino = require('esbuild-plugin-pino');
const { rmSync, writeFileSync } = require('node:fs');

rmSync('dist', { recursive: true, force: true });

build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: true,
  logLevel: 'info',
  plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })],
})
  .then(() => {
    writeFileSync('dist/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\n');
  })
  .catch(() => {
    process.exit(1);
  });
