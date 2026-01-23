#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const desktopDist = path.join(repoRoot, 'apps/desktop/dist');

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    ...options,
  });
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

console.log('📦 Installing server production dependencies...');
// Use isolated temp directory like server packaging
const tempDir = '/tmp/axiocnc-desktop-deps-$$';
require('child_process').spawnSync('trap', ['rm -rf \'' + tempDir + '\'', 'EXIT', 'INT', 'TERM'], { stdio: 'inherit' });
require('child_process').spawnSync('rm', ['-rf', tempDir], { stdio: 'inherit' });
require('child_process').spawnSync('mkdir', ['-p', tempDir], { stdio: 'inherit' });

// Copy and modify package.json (remove workspace deps)
const pkg = JSON.parse(fs.readFileSync(path.join(outputRoot, 'package.json'), 'utf8'));
if (pkg.dependencies && pkg.dependencies['@axiocnc/shared']) {
  delete pkg.dependencies['@axiocnc/shared'];
}
fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
fs.copyFileSync(path.join(repoRoot, 'pnpm-lock.yaml'), path.join(tempDir, 'pnpm-lock.yaml'));

// Install in temp directory
run('pnpm', ['install', '--prod', '--no-frozen-lockfile'], {
  cwd: tempDir,
  env: {
    ...process.env,
  },
});

// Copy node_modules back
run('cp', ['-r', path.join(tempDir, 'node_modules'), outputRoot]);

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
  fs.symlinkSync(path.relative(sharedNodeModulesPath, sharedDistPath), sharedLinkPath, 'dir');
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
