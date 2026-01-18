#!/usr/bin/env node

/* eslint max-len: 0 */
const fs = require('fs');
const path = require('path');
const _pick = require('lodash/pick');
const _uniq = require('lodash/uniq');
const findImports = require('find-imports');

// Copy necessary properties from 'package.json' to 'apps/server/package.json'
const pkg = require('../package.json');
const pkgServer = require('../apps/server/package.json');

const files = [
  'apps/server/src/**/*.{js,jsx}',
  'apps/desktop/src/**/*.{js,jsx}'
];

const resolvedImports = findImports(files, {
  flatten: true,
});

const deps = _uniq([
  '@serialport/parser-readline',
  'core-js', // to polyfill ECMAScript features
  'regenerator-runtime', // needed to use transpiled generator functions
  'debug', // 'debug' is required for electron app
  'zod', // used by shared schemas

  // e.g. 'lodash/get' → 'lodash'
  ...resolvedImports.map(x => x.split('/')[0]),
]).sort();

// Sync version and metadata from root
pkgServer.version = pkg.version;
pkgServer.homepage = pkg.homepage;
pkgServer.author = pkg.author;
pkgServer.license = pkg.license;
pkgServer.repository = pkg.repository;

// Copy only Node.js dependencies to server package.json
pkgServer.dependencies = _pick(pkg.dependencies, deps);

const target = path.resolve(__dirname, '../apps/server/package.json');
const content = JSON.stringify(pkgServer, null, 2);
fs.writeFileSync(target, content + '\n', 'utf8');

console.log('Synced dependencies to apps/server/package.json');
