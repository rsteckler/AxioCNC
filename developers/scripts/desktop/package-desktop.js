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

const electronBuilderArgs = process.argv.slice(2);
const hasProjectDir = electronBuilderArgs.some(arg => arg.startsWith('--projectDir'));
if (!hasProjectDir) {
  electronBuilderArgs.push('--projectDir', 'apps/desktop');
}
const hasConfig = electronBuilderArgs.some(arg => arg.startsWith('--config'));
if (!hasConfig) {
  electronBuilderArgs.push('--config', 'electron-builder.config.js');
}

const hasFlag = (flag) => electronBuilderArgs.includes(flag);

const platform = hasFlag('--linux')
  ? 'linux'
  : hasFlag('--win') || hasFlag('--windows')
    ? 'win'
    : hasFlag('--mac')
      ? 'mac'
      : process.platform === 'win32'
        ? 'win'
        : process.platform === 'darwin'
          ? 'mac'
          : 'linux';

const arch = hasFlag('--x64')
  ? 'x64'
  : hasFlag('--arm64')
    ? 'arm64'
    : hasFlag('--armv7l')
      ? 'armv7l'
      : process.arch;

const bundleRoot = path.join(repoRoot, 'build', `${platform}-${arch}`, 'axiocnc');

run(process.execPath, [prepareScript, '--bundle-dir', bundleRoot]);

console.log(`📦 Running electron-builder ${electronBuilderArgs.join(' ')}`);

run('yarn', ['--cwd', 'apps/desktop', 'electron-builder', ...electronBuilderArgs], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AXIOCNC_BUNDLE_DIR: bundleRoot,
  },
});
