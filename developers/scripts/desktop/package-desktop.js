#!/usr/bin/env node
/* eslint-disable no-console */

const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const prepareScript = path.join(__dirname, 'prepare-desktop-app.js');

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.error) {
    console.error(`❌ Failed to run ${cmd}:`, result.error.message || result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const electronBuilderArgs = process.argv.slice(2);
const hasProjectDir = electronBuilderArgs.some(arg => arg.startsWith('--projectDir'));
if (!hasProjectDir) {
  electronBuilderArgs.push('--projectDir', path.join(repoRoot, 'apps', 'desktop'));
}
const hasConfig = electronBuilderArgs.some(arg => arg.startsWith('--config'));
if (!hasConfig) {
  electronBuilderArgs.push('--config', path.join(repoRoot, 'apps', 'desktop', 'electron-builder.config.js'));
}

const hasFlag = (flag) => electronBuilderArgs.includes(flag);

let platform;
if (hasFlag('--linux')) {
  platform = 'linux';
} else if (hasFlag('--win') || hasFlag('--windows')) {
  platform = 'win';
} else if (hasFlag('--mac')) {
  platform = 'mac';
} else if (process.platform === 'win32') {
  platform = 'win';
} else if (process.platform === 'darwin') {
  platform = 'mac';
} else {
  platform = 'linux';
}

let arch;
if (hasFlag('--x64')) {
  arch = 'x64';
} else if (hasFlag('--arm64')) {
  arch = 'arm64';
} else if (hasFlag('--armv7l')) {
  arch = 'armv7l';
} else {
  arch = process.arch;
}

const bundleRoot = path.join(repoRoot, 'build', `${platform}-${arch}`, 'axiocnc');
const builderOutputDir = path.join(repoRoot, 'build', `${platform}-${arch}`, 'out');
const finalOutputDir = path.join(repoRoot, 'out');

run(process.execPath, [prepareScript, '--bundle-dir', bundleRoot]);

console.log(`📦 Running electron-builder ${electronBuilderArgs.join(' ')}`);

const yarnArgs = ['--cwd', 'apps/desktop', 'electron-builder', ...electronBuilderArgs];
if (process.platform === 'win32') {
  const yarnCli = path.join(repoRoot, '.yarn', 'releases', 'yarn-3.3.1.cjs');
  run(process.execPath, [yarnCli, ...yarnArgs], {
    cwd: repoRoot,
    env: {
      ...process.env,
      AXIOCNC_BUNDLE_DIR: bundleRoot,
      AXIOCNC_OUTPUT_DIR: builderOutputDir,
    },
  });
} else {
  run('yarn', yarnArgs, {
    cwd: repoRoot,
    env: {
      ...process.env,
      AXIOCNC_BUNDLE_DIR: bundleRoot,
      AXIOCNC_OUTPUT_DIR: builderOutputDir,
    },
  });
}

const fs = require('fs');

const artifactExtensionsByPlatform = {
  linux: ['.deb', '.AppImage', '.rpm'],
  win: ['.exe', '.msi', '.zip'],
  mac: ['.dmg', '.zip'],
};

const copyToFinalOut = () => {
  if (!fs.existsSync(builderOutputDir)) {
    return;
  }
  const extensions = artifactExtensionsByPlatform[platform] || [];
  const entries = fs.readdirSync(builderOutputDir)
    .filter((file) => extensions.some((ext) => file.endsWith(ext)))
    .map((file) => path.join(builderOutputDir, file));
  if (entries.length === 0) {
    return;
  }
  fs.mkdirSync(finalOutputDir, { recursive: true });
  for (const debPath of entries) {
    const dest = path.join(finalOutputDir, path.basename(debPath));
    fs.copyFileSync(debPath, dest);
  }
};

copyToFinalOut();
