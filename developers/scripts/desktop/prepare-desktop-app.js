#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopDist = path.join(repoRoot, 'apps/desktop/dist');

// Helper to get pnpm command (handles Windows .cmd extension)
const getPnpmCommand = () => {
  if (process.platform === 'win32') {
    return 'pnpm.cmd';
  }
  return 'pnpm';
};

const run = (cmd, args, options = {}) => {
  // On Windows, use shell: true to find commands in PATH
  const spawnOptions = {
    stdio: 'inherit',
    ...options,
  };
  if (process.platform === 'win32' && !path.isAbsolute(cmd) && !cmd.includes(path.sep)) {
    spawnOptions.shell = true;
  }

  const result = spawnSync(cmd, args, spawnOptions);
  if (result.error) {
    console.error(`❌ Failed to run ${cmd}:`, result.error.message || result.error);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const assertExists = (targetPath, label) => {
  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Missing ${label} at ${targetPath}`);
    process.exit(1);
  }
};

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true });
};

const copyRecursiveSync = (src, dest) => {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
};

const bundleDirFlagIndex = process.argv.indexOf('--bundle-dir');
const bundleDir = bundleDirFlagIndex >= 0 ? process.argv[bundleDirFlagIndex + 1] : null;
if (!bundleDir) {
  console.error('❌ Missing required --bundle-dir argument');
  process.exit(1);
}
const outputRoot = path.isAbsolute(bundleDir)
  ? bundleDir
  : path.resolve(repoRoot, bundleDir);

assertExists(desktopDist, 'desktop runtime build output');
const stageScript = path.join(repoRoot, 'developers/scripts/packaging/stage-runtime.js');
run(process.execPath, [stageScript, '--bundle-dir', outputRoot]);

console.log('📦 Deploying server production dependencies with pnpm deploy...');
// Use pnpm deploy to create lean deployment (only files needed at runtime)
// This significantly reduces file count compared to pnpm install
const deployDir = path.join(outputRoot, 'node_modules');
if (fs.existsSync(deployDir)) {
  fs.rmSync(deployDir, { recursive: true, force: true });
}
ensureDir(deployDir);

// pnpm deploy needs to run from the repo root and deploy to the output directory
// We need to temporarily modify package.json to remove @axiocnc/shared dependency
// since we'll link it manually
const pkgPath = path.join(outputRoot, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const originalSharedDep = pkg.dependencies && pkg.dependencies['@axiocnc/shared'];
if (pkg.dependencies && pkg.dependencies['@axiocnc/shared']) {
  delete pkg.dependencies['@axiocnc/shared'];
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}

try {
  // Use pnpm deploy to create lean deployment
  // --legacy flag needed for compatibility with older pnpm versions
  run(getPnpmCommand(), ['deploy', '--prod', '--filter', '@axiocnc/server', '--legacy', deployDir], {
    cwd: repoRoot,
    env: {
      ...process.env,
    },
  });
} finally {
  // Restore @axiocnc/shared dependency if it was removed
  if (originalSharedDep) {
    pkg.dependencies['@axiocnc/shared'] = originalSharedDep;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  }
}

// Link shared library into node_modules so server code can import it
console.log('🔗 Linking shared library into node_modules...');
const sharedNodeModulesPath = path.join(outputRoot, 'node_modules', '@axiocnc');
const sharedLinkPath = path.join(sharedNodeModulesPath, 'shared');
ensureDir(sharedNodeModulesPath);
if (fs.existsSync(sharedLinkPath)) {
  fs.rmSync(sharedLinkPath, { recursive: true, force: true });
}
// Create symlink to the shared dist directory
const sharedDistPath = path.join(outputRoot, 'shared');
if (fs.existsSync(sharedDistPath)) {
  // Use junction on Windows, symlink on Unix
  const linkType = process.platform === 'win32' ? 'junction' : 'dir';
  try {
    fs.symlinkSync(path.relative(sharedNodeModulesPath, sharedDistPath), sharedLinkPath, linkType);
  } catch (err) {
    // If symlink fails (e.g., permissions), fall back to copying
    console.warn(`⚠️  Symlink failed (${err.message}), using copy instead...`);
    copyRecursiveSync(sharedDistPath, sharedLinkPath);
  }
  // Copy package.json to shared directory with corrected main path
  const sharedPkgPath = path.join(repoRoot, 'apps/shared/package.json');
  const sharedPkg = JSON.parse(fs.readFileSync(sharedPkgPath, 'utf8'));
  // Update main to point to index.js (since dist contents are copied directly to shared/)
  sharedPkg.main = 'index.js';
  sharedPkg.types = 'index.d.ts';
  fs.writeFileSync(path.join(sharedDistPath, 'package.json'), JSON.stringify(sharedPkg, null, 2) + '\n');
  console.log(`✅ Linked shared library: ${sharedLinkPath} -> ${sharedDistPath}`);
} else {
  console.error(`❌ Shared dist not found at ${sharedDistPath}`);
  process.exit(1);
}

console.log('🔧 Skipping native modules rebuild for Electron (needs @electron/rebuild setup for pnpm)...');
// TODO: Add electron rebuild support for pnpm
// const desktopPkg = require(path.join(repoRoot, 'apps/desktop/package.json'));
// const electronVersion = desktopPkg.devDependencies?.electron;
// if (!electronVersion) {
//   console.error('❌ Could not read Electron version from apps/desktop/package.json');
//   process.exit(1);
// }
// run('pnpm', ['exec', '@electron/rebuild', '--version', electronVersion, '--module-dir', outputRoot, '--force']);

console.log('✅ Verifying bundle layout...');
assertExists(path.join(outputRoot, 'server', 'cli.js'), 'server cli.js');
assertExists(path.join(outputRoot, 'app'), 'web app directory');
assertExists(path.join(outputRoot, 'node_modules'), 'node_modules');

console.log(`✅ Bundle ready at ${outputRoot}`);
