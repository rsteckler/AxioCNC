import events from 'events';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import os from 'os';
import logger from '../../lib/logger';
import config from '../configstore';

const log = logger('service:mediamtx');

/**
 * MediaMTXManager - Manages MediaMTX sidecar process for RTSP to HLS conversion
 * 
 * Spawns and supervises MediaMTX binary, generates config from camera settings,
 * and provides HLS streams via reverse proxy.
 */
class MediaMTXManager extends events.EventEmitter {
  process = null;
  pid = null;
  restartTimeout = null;
  restartCount = 0;
  maxRestartDelay = 30000; // 30 seconds max
  minRestartDelay = 1000; // 1 second min

  // Paths
  binaryPath = null;
  configPath = null;
  logDir = null;
  
  // MediaMTX HTTP port (loopback only)
  httpPort = 8888;

  constructor() {
    super();
    this.setupPaths();
  }

  /**
   * Find project root by looking for package.json and vendor/ directory
   * Works from both source and compiled output directories
   * Skips over build output directories (output/, dist/)
   */
  findProjectRoot() {
    let current = __dirname;
    
    // Start from __dirname and go up until we find the actual project root
    // Look for package.json AND vendor/ or src/ directory to avoid matching build output
    for (let i = 0; i < 15; i++) {
      const packageJson = path.join(current, 'package.json');
      const vendorDir = path.join(current, 'vendor');
      const srcDir = path.join(current, 'src');
      
      // Check if this looks like the project root:
      // - Has package.json
      // - Has vendor/ or src/ directory (not build output)
      // - Not inside output/ or dist/ directory
      if (fs.existsSync(packageJson)) {
        // Skip if we're in a build output directory
        const dirName = path.basename(current);
        const parentDir = path.basename(path.dirname(current));
        if (dirName === 'output' || dirName === 'dist' || parentDir === 'output' || parentDir === 'dist') {
          // Keep going up
          const parent = path.dirname(current);
          if (parent === current) {
            break;
          }
          current = parent;
          continue;
        }
        
        // Check for vendor/ or src/ directory (project structure indicators)
        if (fs.existsSync(vendorDir) || fs.existsSync(srcDir)) {
          return current;
        }
        
        // If we have package.json and we're not in output/dist, and we have themes/
        // that's also a good indicator
        if (fs.existsSync(path.join(current, 'themes'))) {
          return current;
        }
      }
      
      const parent = path.dirname(current);
      if (parent === current) {
        break; // Reached filesystem root
      }
      current = parent;
    }
    
    // Fallback: try process.cwd() and go up if needed
    let fallback = process.cwd();
    for (let i = 0; i < 5; i++) {
      const packageJson = path.join(fallback, 'package.json');
      const vendorDir = path.join(fallback, 'vendor');
      const srcDir = path.join(fallback, 'src');
      
      if (fs.existsSync(packageJson) && (fs.existsSync(vendorDir) || fs.existsSync(srcDir))) {
        return fallback;
      }
      
      const parent = path.dirname(fallback);
      if (parent === fallback) {
        break;
      }
      fallback = parent;
    }
    
    // Last resort: use process.cwd()
    return process.cwd();
  }

  /**
   * Setup paths for binary, config, and logs
   */
  setupPaths() {
    const getUserHome = () => (process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME']);
    const homeDir = getUserHome();
    
    // App data directory - use ~/.axiocnc for MediaMTX runtime files
    // This matches the pattern used by other app data (like themes)
    const axiocncDir = path.resolve(homeDir, '.axiocnc');
    
    // MediaMTX config directory inside .axiocnc
    const mediamtxDir = path.resolve(axiocncDir, 'mediamtx');
    this.configPath = path.resolve(mediamtxDir, 'mediamtx.yml');
    this.logDir = path.resolve(mediamtxDir, 'logs');
    
    // Ensure directories exist
    if (!fs.existsSync(mediamtxDir)) {
      fs.mkdirSync(mediamtxDir, { recursive: true });
    }
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Binary path based on platform/arch
    const platform = process.platform;
    const arch = process.arch;
    
    // Vendor binary path (relative to project root)
    // Directory structure: vendor/mediamtx/linux-amd64/mediamtx
    const projectRoot = this.findProjectRoot();
    
    // Map platform/arch to directory name
    // linux + x64 -> linux-amd64
    // windows + x64 -> windows-amd64 (future)
    let platformArchDir = '';
    if (platform === 'linux' && arch === 'x64') {
      platformArchDir = 'linux-amd64';
    } else if (platform === 'linux' && arch === 'arm64') {
      platformArchDir = 'linux-arm64';
    } else if (platform === 'win32' && arch === 'x64') {
      platformArchDir = 'windows-amd64';
    } else if (platform === 'darwin' && arch === 'x64') {
      platformArchDir = 'darwin-amd64';
    } else if (platform === 'darwin' && arch === 'arm64') {
      platformArchDir = 'darwin-arm64';
    } else {
      // Fallback: use platform-arch format
      platformArchDir = `${platform}-${arch}`;
    }
    
    const vendorBinaryPath = path.resolve(
      projectRoot,
      'vendor',
      'mediamtx',
      platformArchDir,
      'mediamtx' + (platform === 'win32' ? '.exe' : '')
    );
    
    this.binaryPath = vendorBinaryPath;
    
    log.debug(`MediaMTX paths: projectRoot=${projectRoot}, binary=${this.binaryPath}, config=${this.configPath}, logDir=${this.logDir}`);
  }

  /**
   * Generate MediaMTX YAML config from camera settings
   * 
   * Reads from single camera object
   */
  generateConfigYAML() {
    const cameras = [];
    
    // Get the single camera
    const camera = config.get('camera', null);
    
    // Only include enabled RTSP cameras
    if (camera && camera.enabled && camera.type === 'rtsp' && camera.inputUrl) {
      // Build RTSP URL with credentials if provided
      let rtspUrl = camera.inputUrl;
      
      // Inject username/password into RTSP URL if provided separately
      if (camera.username || camera.password) {
        try {
          const urlObj = new URL(rtspUrl);
          // Remove any existing credentials from URL
          urlObj.username = '';
          urlObj.password = '';
          // Add credentials from separate fields
          if (camera.username) {
            urlObj.username = camera.username;
          }
          if (camera.password) {
            urlObj.password = camera.password;
          }
          rtspUrl = urlObj.toString();
        } catch (err) {
          log.warn(`Failed to inject credentials into RTSP URL for camera ${camera.id}: ${err.message}`);
          // Fallback: try to inject credentials manually
          if (rtspUrl.includes('@')) {
            // Remove existing credentials
            rtspUrl = rtspUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//');
          }
          // Add new credentials
          if (camera.username || camera.password) {
            const auth = `${camera.username || ''}:${camera.password || ''}`;
            rtspUrl = rtspUrl.replace(/\/\/([^\/]+)/, `//${auth}@$1`);
          }
        }
      }
      
      cameras.push({
        id: camera.id,
        source: rtspUrl
      });
      
      log.debug(`MediaMTX config: camera ${camera.id} - RTSP URL: ${rtspUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//$1:***@')}`);
    }
    
    // Generate YAML manually (simple template)
    // MediaMTX logDestinations: stdout, stderr, syslog, or file://<path>
    // For file logging, we'll just use stdout and let our process capture it
    const logFilePath = path.resolve(this.logDir, 'mediamtx.log');
    
    let yamlContent = `logLevel: info
logDestinations:
  - stdout

# MediaMTX defaults:
# - HLS on :8888 (HTTP)
# - RTSP on :8554
# We use defaults for simplicity. HLS will be available on 127.0.0.1:8888
# (though MediaMTX binds to all interfaces, we'll reverse proxy from Node)

paths:
`;

    // Add a path for each enabled RTSP camera
    cameras.forEach(camera => {
      // Use YAML quoted string for URLs to handle special characters
      const sourceUrl = camera.source.includes(':') ? `"${camera.source}"` : camera.source;
      
      yamlContent += `  ${camera.id}:
    source: ${sourceUrl}
    sourceProtocol: automatic
    sourceOnDemand: false
    sourceOnDemandStartTimeout: 10s
    sourceOnDemandCloseAfter: 10s
    rtspTransport: tcp
`;
    });
    
    return yamlContent;
  }

  /**
   * Write MediaMTX config file
   */
  writeConfig() {
    try {
      const yamlContent = this.generateConfigYAML();
      fs.writeFileSync(this.configPath, yamlContent, 'utf8');
      log.debug(`MediaMTX config written to ${this.configPath}`);
      return true;
    } catch (error) {
      log.error(`Failed to write MediaMTX config: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if MediaMTX binary exists and is valid
   */
  hasBinary() {
    try {
      if (!fs.existsSync(this.binaryPath)) {
        return false;
      }
      
      // Check if it's actually a file (not a directory)
      const stats = fs.statSync(this.binaryPath);
      if (!stats.isFile()) {
        log.warn(`MediaMTX path exists but is not a file: ${this.binaryPath}`);
        return false;
      }
      
      // Try to read first few bytes to check if it's a binary
      // ELF binaries start with 0x7F 'ELF'
      const fd = fs.openSync(this.binaryPath, 'r');
      const buffer = Buffer.alloc(4);
      fs.readSync(fd, buffer, 0, 4, 0);
      fs.closeSync(fd);
      
      const magic = buffer.toString('hex');
      const isElf = buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46; // ELF
      const isShebang = buffer[0] === 0x23 && buffer[1] === 0x21; // #!
      
      if (!isElf && !isShebang) {
        log.warn(`MediaMTX file may not be a valid binary (magic: ${magic}). Expected ELF binary or script with shebang.`);
      }
      
      return true;
    } catch (error) {
      log.error(`Error checking MediaMTX binary: ${error.message}`);
      return false;
    }
  }

  /**
   * Start MediaMTX process
   */
  start() {
    if (this.process) {
      log.warn('MediaMTX process already running');
      return;
    }

    if (!this.hasBinary()) {
      log.warn(`MediaMTX binary not found at ${this.binaryPath}. MediaMTX streaming will be unavailable.`);
      log.warn('To enable MediaMTX streaming, download the MediaMTX binary and place it in the vendor directory.');
      // Don't emit error or throw - just skip starting MediaMTX gracefully
      return;
    }

    // Generate and write config
    if (!this.writeConfig()) {
      log.error('Failed to write MediaMTX config, aborting start');
      return;
    }

    // Ensure binary has execute permissions
    try {
      const stats = fs.statSync(this.binaryPath);
      // Check if file is executable (check for execute bit for owner)
      const mode = stats.mode;
      const executeMode = 0o111; // Execute permission
      if ((mode & executeMode) === 0) {
        log.warn('MediaMTX binary does not have execute permissions, attempting to fix...');
        fs.chmodSync(this.binaryPath, 0o755); // rwxr-xr-x
        log.info('Execute permissions set successfully');
      } else {
        log.debug(`MediaMTX binary has execute permissions (mode: ${mode.toString(8)})`);
      }
    } catch (err) {
      log.error(`Could not check/set execute permissions: ${err.message}`);
      return;
    }

    // Spawn MediaMTX process
    const logFile = path.resolve(this.logDir, 'mediamtx-process.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    
    log.info(`Starting MediaMTX from ${this.binaryPath}`);
    log.info(`MediaMTX config: ${this.configPath}`);
    
    // Use absolute path and ensure shell: false
    // Also set PATH to ensure no shell interpretation
    const absoluteBinaryPath = path.resolve(this.binaryPath);
    
    log.debug(`Spawning MediaMTX with absolute path: ${absoluteBinaryPath}`);
    log.debug(`Config path: ${this.configPath}`);
    
    // MediaMTX takes config file as positional argument, not -c flag
    // Usage: mediamtx [<confpath>] [flags]
    const absoluteConfigPath = path.resolve(this.configPath);
    
    // Use shell: false to run the binary directly, not through a shell
    // Config file is a positional argument, not a flag
    this.process = spawn(absoluteBinaryPath, [absoluteConfigPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
      env: {
        ...process.env,
        PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
      }
    });

    this.pid = this.process.pid;
    
    // Pipe stdout/stderr to log file with error handling
    // Handle errors to prevent "write after end" when process exits quickly
    this.process.stdout.on('error', (err) => {
      if (err.code !== 'EPIPE') {
        log.debug(`MediaMTX stdout stream error: ${err.message}`);
      }
    });
    
    this.process.stderr.on('error', (err) => {
      if (err.code !== 'EPIPE') {
        log.debug(`MediaMTX stderr stream error: ${err.message}`);
      }
    });
    
    logStream.on('error', (err) => {
      log.debug(`Log stream error: ${err.message}`);
    });
    
    this.process.stdout.pipe(logStream, { end: false });
    this.process.stderr.pipe(logStream, { end: false });

    // Also log to our logger
    this.process.stdout.on('data', (data) => {
      const line = data.toString().trim();
      // Filter out HLS part duration warning (known MediaMTX warning that's not actionable)
      if (line.includes('[HLS]') && line.includes('part duration changed') && line.includes('will cause an error in iOS clients')) {
        return; // Skip logging this specific warning
      }
      log.debug(`MediaMTX stdout: ${line}`);
    });

    this.process.stderr.on('data', (data) => {
      log.debug(`MediaMTX stderr: ${data.toString().trim()}`);
    });

    this.process.on('error', (error) => {
      log.error(`MediaMTX process error: ${error.message}`);
      this.process = null;
      this.pid = null;
      this.emit('error', error);
      this.scheduleRestart();
    });

    this.process.on('exit', (code, signal) => {
      log.warn(`MediaMTX process exited with code ${code}, signal ${signal}`);
      
      // Close the log stream after a short delay to ensure all data is written
      setTimeout(() => {
        try {
          if (!logStream.destroyed) {
            logStream.end();
          }
        } catch (err) {
          // Ignore errors when closing stream
        }
      }, 100);
      
      this.process = null;
      this.pid = null;
      this.emit('exit', code, signal);
      
      if (code !== 0 && code !== null) {
        // Process crashed - restart with backoff
        this.scheduleRestart();
      }
    });

    this.restartCount = 0; // Reset restart count on successful start
    this.emit('start', this.pid);
    log.info(`MediaMTX started with PID ${this.pid}`);
  }

  /**
   * Schedule restart with exponential backoff
   */
  scheduleRestart() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
    }

    const delay = Math.min(
      this.minRestartDelay * Math.pow(2, this.restartCount),
      this.maxRestartDelay
    );
    
    this.restartCount++;
    log.info(`Scheduling MediaMTX restart in ${delay}ms (attempt ${this.restartCount})`);
    
    this.restartTimeout = setTimeout(() => {
      this.restartTimeout = null;
      this.start();
    }, delay);
  }

  /**
   * Stop MediaMTX process
   */
  stop() {
    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (!this.process) {
      return;
    }

    log.info(`Stopping MediaMTX process (PID ${this.pid})`);
    
    try {
      this.process.kill('SIGTERM');
      
      // Force kill after 5 seconds if still running
      const forceKillTimeout = setTimeout(() => {
        if (this.process) {
          log.warn('Force killing MediaMTX process');
          this.process.kill('SIGKILL');
        }
      }, 5000);
      
      this.process.once('exit', () => {
        clearTimeout(forceKillTimeout);
      });
    } catch (error) {
      log.error(`Error stopping MediaMTX: ${error.message}`);
    }
    
    this.process = null;
    this.pid = null;
    this.restartCount = 0;
    this.emit('stop');
  }

  /**
   * Reload config and restart process
   */
  reload() {
    log.info('Reloading MediaMTX config');
    this.stop();
    // Small delay to ensure process is fully stopped
    setTimeout(() => {
      this.start();
    }, 500);
  }

  /**
   * Get HTTP port for reverse proxy
   */
  getHttpPort() {
    return this.httpPort;
  }

  /**
   * Get stream URL path for a camera ID
   */
  getStreamPath(cameraId) {
    return `/${cameraId}/index.m3u8`;
  }
}

export default MediaMTXManager;
