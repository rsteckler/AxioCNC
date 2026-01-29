#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Desktop packaging (simplified): deploy + MediaMTX pare + rebuild + electron-builder.
 * Prereqs: pnpm clean, pnpm install, pnpm build:all (run separately).
 * Usage: node package-desktop-new.js [--win|--linux|--mac] [--x64|--arm64|--armv7l]
 * Example: node package-desktop-new.js --win --x64
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');

const getPnpmCommand = () => {
  if (process.platform === 'win32') {
    return 'pnpm.cmd';
  }
  return 'pnpm';
};

const run = (cmd, args, options = {}) => {
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

// Parse platform/arch from argv (same as package-desktop)
const electronBuilderArgs = process.argv.slice(2);
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
/** App staging dir: deploy desktop here for asar. Full prod node_modules, no collector. */
const appStagingDir = path.join(repoRoot, 'build', 'electron-app');

const getMediamtxPlatform = (plat, a) => {
  if (plat === 'win') {
    return 'windows-amd64';
  }
  if (plat === 'linux') {
    if (a === 'amd64' || a === 'x64') {
      return 'linux-amd64';
    }
    if (a === 'arm64') {
      return 'linux-arm64';
    }
    if (a === 'armv7l') {
      return 'linux-armv7';
    }
  }
  if (plat === 'mac') {
    if (a === 'amd64' || a === 'x64') {
      return 'darwin-amd64';
    }
    if (a === 'arm64') {
      return 'darwin-arm64';
    }
  }
  return null;
};

const mediamtxPlatform = getMediamtxPlatform(platform, arch);

// Pre-flight: assume pnpm clean, install, build:all already done
console.log('🔍 Pre-flight checks...');
const desktopDist = path.join(repoRoot, 'apps', 'desktop', 'dist');
assertExists(desktopDist, 'desktop build output (run pnpm build:all first)');
assertExists(path.join(desktopDist, 'main.js'), 'desktop dist/main.js');

// Prepare bundle directory
console.log(`🧹 Preparing ${bundleRoot}...`);
if (fs.existsSync(bundleRoot)) {
  fs.rmSync(bundleRoot, { recursive: true, force: true });
}
ensureDir(bundleRoot);

// Deploy desktop (server, web, shared end up in node_modules/@axiocnc/*)
console.log('📦 Deploying @axiocnc/desktop...');
run(getPnpmCommand(), ['deploy', '--prod', '--filter', '@axiocnc/desktop', bundleRoot], {
  cwd: repoRoot,
  env: { ...process.env },
});

// Verify deploy layout
console.log('✅ Verifying bundle layout...');
assertExists(path.join(bundleRoot, 'node_modules'), 'node_modules');
assertExists(path.join(bundleRoot, 'package.json'), 'package.json');
const serverRoot = path.join(bundleRoot, 'node_modules', '@axiocnc', 'server');
assertExists(serverRoot, 'node_modules/@axiocnc/server');
const serverCli = path.join(serverRoot, 'dist', 'cli.js');
assertExists(serverCli, 'server dist/cli.js');

// Pare MediaMTX to target platform (lives under server in node_modules)
const vendorMediamtxPath = path.join(serverRoot, 'dist', 'vendor', 'mediamtx');
if (fs.existsSync(vendorMediamtxPath) && mediamtxPlatform) {
  console.log(`🔍 Filtering vendor/mediamtx to ${mediamtxPlatform}...`);
  const entries = fs.readdirSync(vendorMediamtxPath, { withFileTypes: true });
  const platformDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  for (const dir of platformDirs) {
    if (dir !== mediamtxPlatform) {
      const dirPath = path.join(vendorMediamtxPath, dir);
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }
  console.log(`✅ Filtered vendor/mediamtx to ${mediamtxPlatform} only`);
} else if (fs.existsSync(vendorMediamtxPath)) {
  console.warn(`⚠️  Could not determine mediamtx platform for ${platform}-${arch}; keeping all`);
} else {
  console.log('   No vendor/mediamtx found, skipping filter');
}

// Rebuild native modules for Electron (bundle only; app has no native deps)
console.log('🔧 Rebuilding native modules for Electron...');
// Path must be dynamic so it works from repo root regardless of cwd
// eslint-disable-next-line import/no-dynamic-require
const desktopPkg = require(path.join(repoRoot, 'apps', 'desktop', 'package.json'));
const electronVersion = desktopPkg.devDependencies?.electron;
if (!electronVersion) {
  console.error('❌ Missing electron in apps/desktop devDependencies');
  process.exit(1);
}
run('npx', ['@electron/rebuild', '--version', electronVersion, '--module-dir', bundleRoot, '--force'], {
  cwd: repoRoot,
});
console.log('✅ Native modules rebuilt');

// Prepare app staging dir: deploy desktop (full prod node_modules) + copy dist.
// We use this as projectDir and beforeBuild→false so electron-builder skips its
// pnpm collector and packs existing node_modules as-is. See ai/docs/electron-builder-pnpm-root-cause.md.
console.log('📂 Preparing app staging (deploy + dist)...');
if (fs.existsSync(appStagingDir)) {
  fs.rmSync(appStagingDir, { recursive: true, force: true });
}
ensureDir(appStagingDir);
run(getPnpmCommand(), ['deploy', '--prod', '--filter', '@axiocnc/desktop', appStagingDir], {
  cwd: repoRoot,
  env: { ...process.env },
});
assertExists(path.join(appStagingDir, 'node_modules'), 'app staging node_modules');
assertExists(path.join(appStagingDir, 'package.json'), 'app staging package.json');
const desktopSrcDist = path.join(repoRoot, 'apps', 'desktop', 'dist');
ensureDir(path.join(appStagingDir, 'dist'));
const copyRecursive = (src, dest) => {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    ensureDir(dest);
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
};
copyRecursive(desktopSrcDist, path.join(appStagingDir, 'dist'));
assertExists(path.join(appStagingDir, 'dist', 'main.js'), 'app staging dist/main.js');
console.log('✅ App staging ready');

// Electron builder: use app staging as projectDir; config uses beforeBuild→false.
const hasProjectDir = electronBuilderArgs.some((a) => a.startsWith('--projectDir'));
if (!hasProjectDir) {
  electronBuilderArgs.push('--projectDir', appStagingDir);
}
const hasConfig = electronBuilderArgs.some((a) => a.startsWith('--config'));
if (!hasConfig) {
  electronBuilderArgs.push('--config', path.join(repoRoot, 'apps', 'desktop', 'electron-builder.config.js'));
}

console.log(`📦 Running electron-builder ${electronBuilderArgs.join(' ')}`);
run('npx', ['electron-builder', ...electronBuilderArgs], {
  cwd: repoRoot,
  env: {
    ...process.env,
    AXIOCNC_BUNDLE_DIR: bundleRoot,
    AXIOCNC_OUTPUT_DIR: builderOutputDir,
  },
});

// Copy artifacts to ./out
const artifactExtensionsByPlatform = {
  linux: ['.deb', '.AppImage', '.rpm'],
  win: ['.exe', '.msi', '.zip'],
  mac: ['.dmg', '.zip'],
};
const extensions = artifactExtensionsByPlatform[platform] || [];
if (fs.existsSync(builderOutputDir)) {
  const entries = fs.readdirSync(builderOutputDir)
    .filter((f) => extensions.some((ext) => f.endsWith(ext)))
    .map((f) => path.join(builderOutputDir, f));
  if (entries.length > 0) {
    ensureDir(finalOutputDir);
    for (const src of entries) {
      fs.copyFileSync(src, path.join(finalOutputDir, path.basename(src)));
    }
    console.log(`✅ Artifacts copied to ${finalOutputDir}`);
  }
}

console.log('✅ Desktop packaging complete');
