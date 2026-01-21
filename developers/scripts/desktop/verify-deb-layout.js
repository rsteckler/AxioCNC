#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '../../..');
const outputDir = path.join(repoRoot, 'out');

const run = (cmd, args, options = {}) => {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

const listDebs = () => {
  if (!fs.existsSync(outputDir)) {
    return [];
  }
  return fs.readdirSync(outputDir)
    .filter((file) => file.endsWith('.deb'))
    .map((file) => path.join(outputDir, file));
};

const findResourceRoot = (dir) => {
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const nextPath = path.join(current, entry.name);
      if (entry.name === 'resources') {
        const candidate = path.join(nextPath, 'axiocnc');
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
      stack.push(nextPath);
    }
  }
  return null;
};

const verifyDeb = (debPath) => {
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'axiocnc-deb-'));
  run('dpkg-deb', ['-x', debPath, extractDir]);

  const resourceRoot = findResourceRoot(extractDir);
  if (!resourceRoot) {
    console.error(`❌ No resources/axiocnc directory found in ${debPath}`);
    process.exit(1);
  }

  const required = [
    path.join(resourceRoot, 'server', 'cli.js'),
    path.join(resourceRoot, 'app'),
    path.join(resourceRoot, 'node_modules', 'core-js'),
  ];

  for (const req of required) {
    if (!fs.existsSync(req)) {
      console.error(`❌ Missing ${req} in ${debPath}`);
      process.exit(1);
    }
  }

  console.log(`✅ Verified ${debPath}`);
};

const debs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : listDebs();

if (debs.length === 0) {
  console.error(`❌ No .deb files found in ${outputDir}`);
  process.exit(1);
}

for (const debPath of debs) {
  verifyDeb(debPath);
}
