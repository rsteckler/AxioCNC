#!/usr/bin/env node
/**
 * Release script: Update versions, commit, and create tag
 * 
 * Usage: node developers/scripts/release.js <version> [--push]
 * Example: node developers/scripts/release.js v1.10.113
 * Example: node developers/scripts/release.js v1.10.113 --push
 * 
 * This script:
 * 1. Updates version in all package.json files
 * 2. Commits the changes
 * 3. Creates a git tag (uses the provided version as-is)
 * 4. Optionally pushes to remote (if --push flag is provided)
 * 
 * Note: Version must start with 'v' (e.g., v1.10.113)
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get version and flags from command line arguments
const args = process.argv.slice(2);
const version = args.find(arg => !arg.startsWith('--'));
const shouldPush = args.includes('--push');

if (!version) {
  console.error('Error: Version argument is required');
  console.error('Usage: node developers/scripts/release.js <version> [--push]');
  console.error('Example: node developers/scripts/release.js v1.10.113');
  console.error('Example: node developers/scripts/release.js v1.10.113 --push');
  process.exit(1);
}

// Validate version starts with 'v'
if (!version.startsWith('v')) {
  console.error(`Error: Version must start with 'v'`);
  console.error(`   Provided: ${version}`);
  console.error(`   Expected: v${version}`);
  console.error('Example: v1.10.113');
  process.exit(1);
}

// Extract version without 'v' prefix for package.json updates
const versionWithoutV = version.substring(1);

// Validate version format (semver: x.y.z)
const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9]+)?$/;
if (!semverRegex.test(versionWithoutV)) {
  console.error(`Error: Invalid version format: ${version}`);
  console.error('Version must follow semver format: vx.y.z or vx.y.z-prerelease');
  console.error(`   Provided: ${version}`);
  console.error(`   Parsed: ${versionWithoutV}`);
  process.exit(1);
}

const rootDir = join(__dirname, '../..');
const updateScript = join(__dirname, 'update-version.js');

// Check if we're in a git repository
try {
  execSync('git rev-parse --git-dir', { cwd: rootDir, stdio: 'ignore' });
} catch (error) {
  console.error('Error: Not in a git repository');
  process.exit(1);
}

// Check if working directory is clean
try {
  const status = execSync('git status --porcelain', { 
    cwd: rootDir, 
    encoding: 'utf8' 
  });
  if (status.trim() && !shouldPush) {
    console.warn('⚠️  Warning: Working directory has uncommitted changes');
    console.warn('   The release script will commit version changes, but other changes will remain uncommitted.');
    console.warn('   Consider committing or stashing other changes first.\n');
  }
} catch (error) {
  console.error('Error: Failed to check git status');
  process.exit(1);
}

console.log(`🚀 Starting release process for version ${versionWithoutV} (tag: ${version})\n`);

// Step 1: Update version numbers
console.log('📝 Step 1: Updating version numbers...');
try {
  execSync(`node ${updateScript} ${versionWithoutV}`, { 
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('✅ Version numbers updated\n');
} catch (error) {
  console.error('❌ Failed to update version numbers');
  process.exit(1);
}

// Step 2: Stage package.json files
console.log('📦 Step 2: Staging package.json files...');
const packageFiles = [
  'package.json',
  'apps/server/package.json',
  'apps/web/package.json',
  'apps/desktop/package.json',
  'packages/shared/package.json',
];

try {
  packageFiles.forEach(file => {
    execSync(`git add ${file}`, { 
      cwd: rootDir,
      stdio: 'ignore'
    });
  });
  console.log('✅ Package.json files staged\n');
} catch (error) {
  console.error('❌ Failed to stage files');
  process.exit(1);
}

// Step 3: Commit changes
console.log(`💾 Step 3: Committing version changes...`);
const commitMessage = `chore: bump version to ${versionWithoutV}`;
try {
  execSync(`git commit -m "${commitMessage}"`, { 
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log('✅ Changes committed\n');
} catch (error) {
  console.error('❌ Failed to commit changes');
  console.error('   (This might be because there are no changes, or commit was aborted)');
  process.exit(1);
}

// Step 4: Create tag
const tagName = version; // Use the version as-is (already has 'v' prefix)
console.log(`🏷️  Step 4: Creating tag ${tagName}...`);
try {
  // Check if tag already exists
  try {
    execSync(`git rev-parse ${tagName}`, { 
      cwd: rootDir, 
      stdio: 'ignore' 
    });
    console.error(`❌ Error: Tag ${tagName} already exists`);
    console.error('   Delete it first with: git tag -d ' + tagName);
    process.exit(1);
  } catch (error) {
    // Tag doesn't exist, which is what we want
  }

  execSync(`git tag ${tagName}`, { 
    cwd: rootDir,
    stdio: 'inherit'
  });
  console.log(`✅ Tag ${tagName} created\n`);
} catch (error) {
  console.error(`❌ Failed to create tag ${tagName}`);
  process.exit(1);
}

// Step 5: Push (if requested)
if (shouldPush) {
  console.log('📤 Step 5: Pushing to remote...');
  try {
    execSync('git push', { 
      cwd: rootDir,
      stdio: 'inherit'
    });
    execSync(`git push origin ${tagName}`, { 
      cwd: rootDir,
      stdio: 'inherit'
    });
    console.log('✅ Pushed to remote\n');
  } catch (error) {
    console.error('❌ Failed to push to remote');
    console.error('   You can push manually with:');
    console.error(`   git push`);
    console.error(`   git push origin ${tagName}`);
    process.exit(1);
  }
} else {
  console.log('📤 Step 5: Skipping push (use --push to push automatically)');
  console.log('   To push manually, run:');
  console.log('   git push');
  console.log(`   git push origin ${tagName}\n`);
}

console.log('✨ Release process completed successfully!');
console.log(`\n📋 Summary:`);
console.log(`   Version: ${versionWithoutV}`);
console.log(`   Tag: ${tagName}`);
console.log(`   Commit: ${commitMessage}`);
if (!shouldPush) {
  console.log(`\n💡 Next steps:`);
  console.log(`   git push`);
  console.log(`   git push origin ${tagName}`);
  console.log(`\n   Or run with --push flag next time to push automatically.`);
}
