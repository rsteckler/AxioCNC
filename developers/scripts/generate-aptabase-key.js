#!/usr/bin/env node
/**
 * Generate Aptabase key configuration file for backend
 * Reads APTABASE_KEY from environment variable and creates a config file
 * This file is gitignored and only generated during CI builds
 */

const fs = require('fs');
const path = require('path');

const APTABASE_KEY = process.env.APTABASE_KEY || '';
const OUTPUT_FILE = path.join(__dirname, '../../apps/server/src/config/aptabase-key.js');

// Ensure the config directory exists
const configDir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(configDir)) {
  fs.mkdirSync(configDir, { recursive: true });
}

// Generate the config file
// Use CommonJS exports since Babel may transpile imports but require() works at runtime
const content = `/**
 * Aptabase API Key (generated at build time)
 * This file is auto-generated - do not edit manually
 * It is gitignored and only exists in official CI builds
 */

module.exports = {
  APTABASE_KEY: ${JSON.stringify(APTABASE_KEY)},
};
`;

fs.writeFileSync(OUTPUT_FILE, content, 'utf8');

if (APTABASE_KEY) {
  console.log('✓ Generated aptabase-key.js with key');
} else {
  console.log('⚠ Generated aptabase-key.js without key (empty string)');
}
