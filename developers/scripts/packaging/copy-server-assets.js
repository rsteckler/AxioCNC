#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../../..');
const serverRoot = path.join(repoRoot, 'apps/server');
const distRoot = path.join(serverRoot, 'dist');

const ensureDir = (target) => {
  fs.mkdirSync(target, { recursive: true });
};

const copyDir = (source, dest) => {
  if (!fs.existsSync(source)) {
    return;
  }
  ensureDir(dest);
  fs.cpSync(source, dest, { recursive: true, force: true });
};

const copyFile = (source, dest) => {
  if (!fs.existsSync(source)) {
    return;
  }
  ensureDir(path.dirname(dest));
  fs.copyFileSync(source, dest);
};

ensureDir(distRoot);

copyDir(path.join(serverRoot, 'assets'), path.join(distRoot, 'assets'));
copyDir(path.join(serverRoot, 'src', 'i18n'), path.join(distRoot, 'i18n'));
copyDir(path.join(serverRoot, 'src', 'views'), path.join(distRoot, 'views'));

const configDir = path.join(serverRoot, 'src', 'config');
if (fs.existsSync(configDir)) {
  const destConfig = path.join(distRoot, 'config');
  ensureDir(destConfig);
  for (const entry of fs.readdirSync(configDir)) {
    if (entry.endsWith('.json')) {
      copyFile(path.join(configDir, entry), path.join(destConfig, entry));
    }
  }
}

copyFile(path.join(serverRoot, 'package.json'), path.join(distRoot, 'package.json'));

console.log(`✅ Copied server assets to ${distRoot}`);
