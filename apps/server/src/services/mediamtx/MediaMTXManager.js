import events from 'events';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
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
  lastStderrLines = []; // Store last few stderr lines for diagnostics
  lastStdoutLines = []; // Store last few stdout lines for diagnostics

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
   * Find server root by looking for vendor/mediamtx directory
   * Works from both source and installed app directories
   * In dev: apps/server/src/services/mediamtx -> apps/server/
   * In prod: /opt/AxioCNC/resources/app/server/services/mediamtx -> /opt/AxioCNC/resources/app/server/
   */
  findServerRoot() {
    let current = __dirname;

    // Start from __dirname and go up until we find vendor/mediamtx directory
    for (let i = 0; i < 10; i++) {
      const vendorMediamtxDir = path.join(current, 'vendor', 'mediamtx');

      // Check if vendor/mediamtx directory exists
      if (fs.existsSync(vendorMediamtxDir) && fs.statSync(vendorMediamtxDir).isDirectory()) {
        return current;
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
      const vendorMediamtxDir = path.join(fallback, 'vendor', 'mediamtx');
      if (fs.existsSync(vendorMediamtxDir) && fs.statSync(vendorMediamtxDir).isDirectory()) {
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

    // Find server root (where vendor/mediamtx exists)
    // In dev: apps/server/
    // In prod: /opt/AxioCNC/resources/app/server/
    const serverRoot = this.findServerRoot();

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
      serverRoot,
      'vendor',
      'mediamtx',
      platformArchDir,
      'mediamtx' + (platform === 'win32' ? '.exe' : '')
    );

    this.binaryPath = vendorBinaryPath;

    log.debug(`MediaMTX paths: serverRoot=${serverRoot}, binary=${this.binaryPath}, config=${this.configPath}, logDir=${this.logDir}`);
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

    let yamlContent = `logLevel: info
logDestinations:
  - stdout

# MediaMTX port configuration:
# - HLS on :8888 (HTTP)
# - RTSP on :8554
# - RTP/UDP on :8002 (changed from default :8000 to avoid conflict with AxioCNC server on :8000)
# - RTCP/UDP on :8003 (must be consecutive with RTP port)
# We use defaults for simplicity. HLS will be available on 127.0.0.1:8888
# (though MediaMTX binds to all interfaces, we'll reverse proxy from Node)

# Configure RTP/RTCP to use ports 8002/8003 instead of default 8000/8001 (which conflicts with AxioCNC server)
rtpAddress: :8002
rtcpAddress: :8003

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
      log.info(`MediaMTX config written to ${this.configPath}`);
      log.debug(`MediaMTX config content:\n${yamlContent}`);
      return true;
    } catch (error) {
      log.error(`Failed to write MediaMTX config: ${error.message}`);
      log.error(`Config path: ${this.configPath}`);
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
      const isMz = buffer[0] === 0x4D && buffer[1] === 0x5A; // MZ (Windows PE)

      if (!isElf && !isShebang && !isMz) {
        log.warn(`MediaMTX file may not be a valid binary (magic: ${magic}). Expected ELF, MZ (Windows PE), or script with shebang.`);
      }

      return true;
    } catch (error) {
      log.error(`Error checking MediaMTX binary: ${error.message}`);
      return false;
    }
  }

  /**
   * Clean up stale MediaMTX processes that are holding ports
   * This helps recover from crashes or incomplete shutdowns
   */
  cleanupStaleProcesses() {
    try {
      const { execSync } = require('child_process');
      
      // Find all processes using MediaMTX ports
      // Note: Ports 8000/8001 UDP were changed to 8002/8003 UDP to avoid conflict with AxioCNC server on port 8000
      const ports = [
        { port: 8002, protocol: 'UDP' },
        { port: 8003, protocol: 'UDP' },
        { port: 8554, protocol: 'TCP' },
        { port: 8888, protocol: 'TCP' }
      ];
      
      const stalePids = new Set();
      
      for (const { port, protocol } of ports) {
        try {
          // lsof output format: COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME
          // We want PID and COMMAND columns
          const result = execSync(
            `lsof -i ${protocol}:${port} -t 2>/dev/null || true`,
            { encoding: 'utf8' }
          );
          
          if (result.trim()) {
            const pids = result.trim().split('\n').filter(p => p.trim());
            pids.forEach(pid => {
              // Check if this is a MediaMTX process
              try {
                const cmdline = execSync(
                  `ps -p ${pid} -o comm= 2>/dev/null || true`,
                  { encoding: 'utf8' }
                ).trim().toLowerCase();
                
                // Check if it's a MediaMTX process (could be "mediamtx" or full path)
                if (cmdline.includes('mediamtx') || cmdline === 'mediamtx') {
                  stalePids.add(pid);
                  log.info(`Found stale MediaMTX process: PID ${pid} (command: ${cmdline})`);
                }
              } catch (err) {
                // Process might have exited, ignore
              }
            });
          }
        } catch (err) {
          // lsof might not be available or port not in use, ignore
        }
      }
      
        // Kill stale processes (but not our own if we have one)
        if (stalePids.size > 0) {
          log.warn(`Found ${stalePids.size} stale MediaMTX process(es) holding ports. Cleaning up...`);
          
          stalePids.forEach(pid => {
            // Don't kill our own process if it exists
            if (this.pid && parseInt(pid) === this.pid) {
              log.debug(`Skipping cleanup of our own process (PID ${pid})`);
              return;
            }
            
            try {
              log.info(`Killing stale MediaMTX process: PID ${pid}`);
              // Try SIGTERM first (graceful)
              execSync(`kill -TERM ${pid} 2>/dev/null || true`);
            } catch (err) {
              log.warn(`Failed to send TERM to process ${pid}: ${err.message}`);
            }
          });
          
          // Wait a moment for graceful termination
          log.debug('Waiting 500ms for graceful termination...');
          const startWait = Date.now();
          while (Date.now() - startWait < 500) {
            // Busy wait (short duration, acceptable for startup)
          }
          
          // Force kill any that are still alive
          stalePids.forEach(pid => {
            if (this.pid && parseInt(pid) === this.pid) {
              return; // Skip our own process
            }
            
            try {
              // Check if process still exists (kill -0 returns 0 if exists)
              execSync(`kill -0 ${pid} 2>/dev/null`, { encoding: 'utf8' });
              // Still alive, force kill
              log.warn(`Process ${pid} did not terminate gracefully, force killing...`);
              execSync(`kill -9 ${pid} 2>/dev/null || true`);
            } catch (err) {
              // Process is gone (kill -0 failed), good
              log.debug(`Stale process ${pid} terminated successfully`);
            }
          });
          
          log.info('Stale process cleanup completed');
        } else {
          log.debug('No stale MediaMTX processes found');
        }
    } catch (err) {
      log.warn(`Error during stale process cleanup: ${err.message}`);
      // Don't fail startup if cleanup fails
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

    // Clean up stale MediaMTX processes before starting
    this.cleanupStaleProcesses();

    // Check for port conflicts (MediaMTX uses ports 8002/UDP for RTP, 8003/UDP for RTCP, 8554/TCP for RTSP, 8888/TCP for HLS)
    // Note: Ports 8000/8001 UDP were changed to 8002/8003 UDP to avoid conflict with AxioCNC server on port 8000
    // This is a best-effort check - MediaMTX will still fail if ports are in use
    const checkPort = (port, protocol = 'tcp') => {
      try {
        const { execSync } = require('child_process');
        const result = execSync(`lsof -i ${protocol === 'udp' ? 'UDP' : 'TCP'}:${port} 2>/dev/null || true`, { encoding: 'utf8' });
        if (result.trim()) {
          log.warn(`Port ${port} (${protocol.toUpperCase()}) appears to be in use:`);
          result.split('\n').filter(l => l.trim()).forEach(line => {
            log.warn(`  ${line}`);
          });
          return true;
        }
        return false;
      } catch (err) {
        // lsof might not be available, ignore
        return false;
      }
    };

    log.debug('Checking for port conflicts...');
    const portsInUse = [];
    if (checkPort(8002, 'udp')) portsInUse.push('8002/udp');
    if (checkPort(8003, 'udp')) portsInUse.push('8003/udp');
    if (checkPort(8554, 'tcp')) portsInUse.push('8554/tcp');
    if (checkPort(8888, 'tcp')) portsInUse.push('8888/tcp');
    
    if (portsInUse.length > 0) {
      log.warn(`⚠️  MediaMTX ports appear to be in use: ${portsInUse.join(', ')}`);
      log.warn(`   MediaMTX may fail to start. Check for other MediaMTX instances or conflicting services.`);
    } else {
      log.debug('No port conflicts detected');
    }

    // Ensure binary has execute permissions
    try {
      const stats = fs.statSync(this.binaryPath);
      // Check if file is executable (check for execute bit for owner)
      const mode = stats.mode;
      const executeMode = 0o111; // Execute permission
      // eslint-disable-next-line no-bitwise
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
    log.info(`MediaMTX log file: ${logFile}`);

    // Use absolute path and ensure shell: false
    // Also set PATH to ensure no shell interpretation
    const absoluteBinaryPath = path.resolve(this.binaryPath);

    log.info(`Spawning MediaMTX with absolute path: ${absoluteBinaryPath}`);
    log.info(`Config path: ${this.configPath}`);
    
    // Log binary info
    try {
      const stats = fs.statSync(absoluteBinaryPath);
      log.debug(`MediaMTX binary size: ${stats.size} bytes, mode: ${stats.mode.toString(8)}`);
    } catch (err) {
      log.warn(`Could not stat MediaMTX binary: ${err.message}`);
    }

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

    // Reset diagnostic buffers
    this.lastStderrLines = [];
    this.lastStdoutLines = [];

    // Also log to our logger
    this.process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Store last 10 lines for diagnostics
        this.lastStdoutLines.push(trimmed);
        if (this.lastStdoutLines.length > 10) {
          this.lastStdoutLines.shift();
        }
        
        // Filter out HLS part duration warning (known MediaMTX warning that's not actionable)
        if (trimmed.includes('[HLS]') && trimmed.includes('part duration changed') && trimmed.includes('will cause an error in iOS clients')) {
          return; // Skip logging this specific warning
        }
        
        // Log errors and warnings at info level, rest at debug
        if (trimmed.includes('ERR') || trimmed.includes('ERROR') || trimmed.includes('FATAL')) {
          log.error(`MediaMTX stdout: ${trimmed}`);
        } else if (trimmed.includes('WARN') || trimmed.includes('WARNING')) {
          log.warn(`MediaMTX stdout: ${trimmed}`);
        } else {
          log.debug(`MediaMTX stdout: ${trimmed}`);
        }
      });
    });

    this.process.stderr.on('data', (data) => {
      const lines = data.toString().split('\n').filter(l => l.trim());
      lines.forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;
        
        // Store last 10 lines for diagnostics
        this.lastStderrLines.push(trimmed);
        if (this.lastStderrLines.length > 10) {
          this.lastStderrLines.shift();
        }
        
        // Log stderr at info level (stderr is usually important)
        if (trimmed.includes('ERR') || trimmed.includes('ERROR') || trimmed.includes('FATAL')) {
          log.error(`MediaMTX stderr: ${trimmed}`);
        } else if (trimmed.includes('WARN') || trimmed.includes('WARNING')) {
          log.warn(`MediaMTX stderr: ${trimmed}`);
        } else {
          log.info(`MediaMTX stderr: ${trimmed}`);
        }
      });
    });

    this.process.on('error', (error) => {
      log.error(`MediaMTX process spawn error: ${error.message}`);
      log.error(`  Binary path: ${this.binaryPath}`);
      log.error(`  Error code: ${error.code || 'unknown'}`);
      log.error(`  Error syscall: ${error.syscall || 'unknown'}`);
      if (error.code === 'ENOENT') {
        log.error(`  ⚠️  Binary not found! Check that MediaMTX binary exists at: ${this.binaryPath}`);
      } else if (error.code === 'EACCES') {
        log.error(`  ⚠️  Permission denied! Check binary execute permissions: ${this.binaryPath}`);
        log.error(`  💡 Try: chmod +x ${this.binaryPath}`);
      }
      this.process = null;
      this.pid = null;
      this.emit('error', error);
      this.scheduleRestart();
    });

    this.process.on('exit', (code, signal) => {
      log.warn(`MediaMTX process exited with code ${code}, signal ${signal}`);

      // Log diagnostic information if process exited with error
      if (code !== 0 && code !== null) {
        log.error(`MediaMTX diagnostic information:`);
        log.error(`  Binary path: ${this.binaryPath}`);
        log.error(`  Config path: ${this.configPath}`);
        log.error(`  Log directory: ${this.logDir}`);
        
        // Show last stderr lines (usually contains error messages)
        if (this.lastStderrLines.length > 0) {
          log.error(`  Last stderr output (${this.lastStderrLines.length} lines):`);
          this.lastStderrLines.forEach((line, idx) => {
            log.error(`    [${idx + 1}] ${line}`);
          });
        }
        
        // Show last stdout lines if no stderr
        if (this.lastStderrLines.length === 0 && this.lastStdoutLines.length > 0) {
          log.error(`  Last stdout output (${this.lastStdoutLines.length} lines):`);
          this.lastStdoutLines.forEach((line, idx) => {
            log.error(`    [${idx + 1}] ${line}`);
          });
        }
        
        // Check for common issues
        const allOutput = [...this.lastStderrLines, ...this.lastStdoutLines].join(' ').toLowerCase();
        if (allOutput.includes('address already in use') || allOutput.includes('bind')) {
          log.error(`  ⚠️  Port conflict detected! Another process may be using MediaMTX's ports.`);
          log.error(`  💡 Try: lsof -i :8000 -i :8554 -i :8888 (or check for other MediaMTX processes)`);
        }
        if (allOutput.includes('permission denied')) {
          log.error(`  ⚠️  Permission denied! Check binary execute permissions: ${this.binaryPath}`);
        }
        if (allOutput.includes('no such file') || allOutput.includes('not found')) {
          log.error(`  ⚠️  File not found! Check that MediaMTX binary exists: ${this.binaryPath}`);
        }
        if (allOutput.includes('config') && allOutput.includes('error')) {
          log.error(`  ⚠️  Config file error! Check MediaMTX config: ${this.configPath}`);
        }
      }

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
      this.minRestartDelay * 2 ** this.restartCount,
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
