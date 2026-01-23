#!/usr/bin/env node
/**
 * Update version numbers across all package.json files in the monorepo
 *
 * Usage: node developers/scripts/update-version.js <version>
 * Example: node developers/scripts/update-version.js 1.10.113
 *
 * This script updates the version field in:
 * - package.json (root)
 * - apps/server/package.json
 * - apps/web/package.json
 * - apps/desktop/package.json
 * - apps/shared/package.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version from command line argument
const version = process.argv[2];

if (!version) {
  console.error('Error: Version argument is required');
  console.error('Usage: node developers/scripts/update-version.js <version>');
  console.error('Example: node developers/scripts/update-version.js 1.10.113');
  process.exit(1);
}

// Validate version format (semver: x.y.z)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;
if (!semverRegex.test(version)) {
  console.error(`Error: Invalid version format: ${version}`);
  console.error('Version must follow semver format: x.y.z or x.y.z-prerelease');
  process.exit(1);
}

// List of package.json files to update
const packageFiles = [
  'package.json', // Root
  'apps/server/package.json',
  'apps/web/package.json',
  'apps/desktop/package.json',
  'apps/shared/package.json',
];

const rootDir = join(__dirname, '../..');

console.log(`Updating version to ${version}...\n`);

let updatedCount = 0;

for (const packageFile of packageFiles) {
  const filePath = join(rootDir, packageFile);

  try {
    // Read package.json
    const content = readFileSync(filePath, 'utf8');
    const pkg = JSON.parse(content);

    // Check if version field exists
    if (!('version' in pkg)) {
      console.warn(`⚠️  Warning: ${packageFile} does not have a version field, skipping`);
      continue;
    }

    const oldVersion = pkg.version;

    // Update version
    pkg.version = version;

    // Write back with proper formatting (2 spaces indentation)
    const updatedContent = JSON.stringify(pkg, null, 2) + '\n';
    writeFileSync(filePath, updatedContent, 'utf8');

    console.log(`✅ Updated ${packageFile}: ${oldVersion} → ${version}`);
    updatedCount++;
  } catch (error) {
    console.error(`❌ Error updating ${packageFile}:`, error.message);
    process.exit(1);
  }
}

console.log(`\n✨ Successfully updated ${updatedCount} package.json file(s) to version ${version}`);
