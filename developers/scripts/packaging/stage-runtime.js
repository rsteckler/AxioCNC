#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const serverDist = path.join(repoRoot, 'apps/server/dist');
const webDist = path.join(repoRoot, 'apps/web/dist');
const sharedDist = path.join(repoRoot, 'apps/shared/dist');

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

const copyDir = (from, to) => {
  fs.cpSync(from, to, { recursive: true, dereference: true });
};

const assertExists = (targetPath, label) => {
  if (!fs.existsSync(targetPath)) {
    console.error(`❌ Missing ${label} at ${targetPath}`);
    process.exit(1);
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

assertExists(serverDist, 'server build output');
assertExists(webDist, 'web build output');
assertExists(sharedDist, 'shared build output');

console.log(`🧹 Cleaning ${outputRoot}...`);
fs.rmSync(outputRoot, { recursive: true, force: true });
ensureDir(path.join(outputRoot, 'app'));
ensureDir(path.join(outputRoot, 'server'));
ensureDir(path.join(outputRoot, 'shared'));

console.log('📦 Copying server dist...');
copyDir(serverDist, path.join(outputRoot, 'server'));

console.log('📦 Copying web dist...');
copyDir(webDist, path.join(outputRoot, 'app'));

console.log('📦 Copying shared dist...');
copyDir(sharedDist, path.join(outputRoot, 'shared'));

console.log('📦 Copying package.json for server version lookup...');
fs.copyFileSync(
  path.join(repoRoot, 'apps/server/package.json'),
  path.join(outputRoot, 'package.json')
);

const indexHbs = path.join(repoRoot, 'index.hbs');
if (fs.existsSync(indexHbs)) {
  fs.copyFileSync(indexHbs, path.join(outputRoot, 'app', 'index.hbs'));
}

const favicon = path.join(repoRoot, 'apps/web/public/favicon.ico');
if (fs.existsSync(favicon)) {
  fs.copyFileSync(favicon, path.join(outputRoot, 'app', 'favicon.ico'));
}

console.log(`✅ Staged runtime bundle at ${outputRoot}`);
