/**
 * Development build script for Electron
 * Compiles TypeScript files in electron/ to dist-electron/
 * Then starts Electron in dev mode
 */
import { context } from 'esbuild';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

async function buildElectron() {
  // Ensure dist-electron exists
  const outDir = resolve(root, 'dist-electron');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Build main process
  const mainCtx = await context({
    entryPoints: [resolve(root, 'electron/main.ts')],
    outfile: resolve(outDir, 'main.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    external: ['electron', 'electron-squirrel-startup'],
    sourcemap: true,
    minify: false,
  });

  // Build preload script
  const preloadCtx = await context({
    entryPoints: [resolve(root, 'electron/preload.ts')],
    outfile: resolve(outDir, 'preload.mjs'),
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    external: ['electron'],
    sourcemap: true,
    minify: false,
  });

  await mainCtx.rebuild();
  await preloadCtx.rebuild();

  await mainCtx.dispose();
  await preloadCtx.dispose();

  console.log('✅ Electron main process built');
}

async function startElectron() {
  console.log('🚀 Starting Electron...');
  const electronPath = resolve(root, 'node_modules/.bin/electron');
  const electronArgs = [root, '--dev'];
  if (process.platform === 'linux') {
    electronArgs.push('--no-sandbox');
  }

  const child = spawn(electronPath, electronArgs, {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  await buildElectron();
  await startElectron();
}

main().catch((err) => {
  console.error('❌ Failed to build electron:', err);
  process.exit(1);
});
