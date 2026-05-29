/**
 * Production build script for Electron
 * Compiles TypeScript files in electron/ to dist-electron/
 */
import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function buildAll() {
  const outDir = resolve(root, 'dist-electron');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Build main process
  await build({
    entryPoints: [resolve(root, 'electron/main.ts')],
    outfile: resolve(outDir, 'main.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    external: ['electron', 'electron-squirrel-startup'],
    sourcemap: false,
    minify: true,
  });

  // Build preload script
  await build({
    entryPoints: [resolve(root, 'electron/preload.ts')],
    outfile: resolve(outDir, 'preload.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    external: ['electron'],
    sourcemap: false,
    minify: true,
  });

  console.log('✅ Electron production build complete');
  console.log(`   ${outDir}/main.mjs`);
  console.log(`   ${outDir}/preload.mjs`);
}

buildAll().catch((err) => {
  console.error('❌ Failed to build electron:', err);
  process.exit(1);
});
