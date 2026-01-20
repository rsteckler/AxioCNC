#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const prepareScript = path.join(__dirname, 'prepare-desktop-app.js');

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

run(process.execPath, [prepareScript]);

const electronBuilderArgs = process.argv.slice(2);
const hasProjectDir = electronBuilderArgs.some(arg => arg.startsWith('--projectDir'));
if (!hasProjectDir) {
  electronBuilderArgs.push('--projectDir', 'apps/desktop');
}
console.log(`📦 Running electron-builder ${electronBuilderArgs.join(' ')}`);

run('yarn', ['--cwd', 'apps/desktop', 'electron-builder', ...electronBuilderArgs], {
  cwd: repoRoot,
});
