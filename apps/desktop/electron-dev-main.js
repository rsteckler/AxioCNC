#!/usr/bin/env node
/**
 * Electron dev entry: run main from source via @babel/register.
 * Used when AXIOCNC_DEV=1; server and Vite run separately.
 * Run from apps/desktop: electron electron-dev-main.js (via pnpm --filter @axiocnc/desktop exec)
 */
const path = require('path');

require('@babel/register')({
  extensions: ['.js'],
  only: [/[\\/]apps[\\/]desktop[\\/]/],
  configFile: path.join(__dirname, '..', '..', 'babel.config.js'),
});
require('./src/main.js');
