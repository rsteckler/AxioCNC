#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Change to the static website directory
const staticDir = path.join(__dirname, '../../website/static');
process.chdir(staticDir);

// Print formatted startup message
console.log('[SUCCESS] Static website is running at: http://localhost:8080/');

// Auto-open in browser using the open package
try {
  // Use the same open package that Docusaurus uses
  const open = require('../../website/docs/developer/node_modules/open');
  open('http://localhost:8080/').catch(() => {
    // Silently fail if browser opening doesn't work
  });
} catch (error) {
  // Silently fail if open package is not available
}

// Start Python HTTP server
const server = spawn('python3', ['-m', 'http.server', '8080'], {
  stdio: 'inherit'
});

server.on('error', (error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
