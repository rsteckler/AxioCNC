#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopDist = path.join(repoRoot, 'apps/desktop/dist');
const babelConfig = path.join(repoRoot, 'babel.config.js');

const babelBin = require.resolve('@babel/cli/bin/babel.js', { paths: [repoRoot] });

const run = (args, options = {}) => {
  const result = spawnSync(process.execPath, [babelBin, ...args], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

fs.rmSync(desktopDist, { recursive: true, force: true });
fs.mkdirSync(desktopDist, { recursive: true });

// Build Electron app files (menu-template, etc.)
run([
  'apps/desktop/src',
  '--config-file',
  babelConfig,
  '--out-dir',
  'apps/desktop/dist/electron-app',
]);

// Build Electron main process entry
run([
  'apps/desktop/src/main.js',
  '--config-file',
  babelConfig,
  '--out-file',
  'apps/desktop/dist/main.js',
]);

console.log('✅ Electron runtime built at apps/desktop/dist');
