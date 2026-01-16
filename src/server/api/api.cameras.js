/**
 * Cameras API
 *
 * Manages camera configurations for streaming
 */
import http from 'http';
import https from 'https';
import uuid from 'uuid';
import isPlainObject from 'lodash/isPlainObject';
import config from '../services/configstore';
import logger from '../lib/logger';
import mediamtxService from '../services/mediamtx';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../constants';

const log = logger('api:cameras');
const CONFIG_KEY = 'camera'; // Store single camera object

/**
 * Get sanitized camera (single camera only)
 */
const getCamera = () => {
  let camera = config.get(CONFIG_KEY, null);

  // If camera doesn't exist or is invalid, return null
  if (!camera || !isPlainObject(camera)) {
    return null;
  }

  let shouldUpdate = false;

  // Ensure ID exists
  if (!camera.id) {
    camera.id = uuid.v4();
    shouldUpdate = true;
  }

  // Defaults
  if (camera.enabled === undefined) {
    camera.enabled = false;
    shouldUpdate = true;
  }
  if (!camera.name) {
    camera.name = 'Camera 1';
    shouldUpdate = true;
  }

  if (shouldUpdate) {
    log.debug(`update sanitized camera: ${JSON.stringify(camera)}`);
    config.set(CONFIG_KEY, camera, { silent: true });
  }

  return camera;
};

/**
 * Probe HTTP URL to determine stream type
 * Returns: 'mjpeg' | 'hls' | null
 */
const probeStreamType = (inputUrl, username, password) => {
  return new Promise((resolve) => {
    try {
      const upstreamUrl = new URL(inputUrl);
      const isHttps = upstreamUrl.protocol === 'https:';
      const defaultPort = isHttps ? 443 : 80;
      const httpModule = isHttps ? https : http;

      const requestOptions = {
        hostname: upstreamUrl.hostname,
        port: upstreamUrl.port ? parseInt(upstreamUrl.port, 10) : defaultPort,
        path: upstreamUrl.pathname + upstreamUrl.search,
        method: 'HEAD', // Use HEAD to minimize data transfer
        headers: {
          'User-Agent': 'AxioCNC-Stream-Probe/1.0',
        },
        timeout: 5000, // 5 second timeout
      };

      // Add Basic Auth if provided
      if (username || password) {
        const authString = `${username || ''}:${password || ''}`;
        const auth = Buffer.from(authString).toString('base64');
        requestOptions.headers.Authorization = `Basic ${auth}`;
      }

      // Also try to use credentials from URL if no separate credentials provided
      if (!username && !password && (upstreamUrl.username || upstreamUrl.password)) {
        const authString = `${upstreamUrl.username || ''}:${upstreamUrl.password || ''}`;
        const auth = Buffer.from(authString).toString('base64');
        requestOptions.headers.Authorization = `Basic ${auth}`;
      }

      const req = httpModule.request(requestOptions, (res) => {
        const contentType = res.headers['content-type'] || '';

        // Check Content-Type for MJPEG
        if (contentType.toLowerCase().startsWith('multipart/x-mixed-replace')) {
          resolve('mjpeg');
          return;
        }

        // Check if it looks like HLS (m3u8 playlist)
        const location = res.headers.location || '';
        if (location.includes('.m3u8') || upstreamUrl.pathname.includes('.m3u8')) {
          resolve('hls');
          return;
        }

        // Check URL for MJPEG indicators
        const urlLower = inputUrl.toLowerCase();
        if (urlLower.includes('mjpeg') || urlLower.includes('mjpg') || urlLower.includes('cam.cgi')) {
          resolve('mjpeg');
          return;
        }

        // Default to mjpeg for HTTP(S) URLs
        resolve('mjpeg');
      });

      req.on('error', (err) => {
        log.debug(`Stream probe error for ${inputUrl}: ${err.message}`);
        // On error, default based on URL pattern
        const urlLower = inputUrl.toLowerCase();
        if (urlLower.includes('mjpeg') || urlLower.includes('mjpg')) {
          resolve('mjpeg');
        } else {
          resolve(null); // Unknown, will default later
        }
      });

      req.on('timeout', () => {
        log.debug(`Stream probe timeout for ${inputUrl}`);
        req.destroy();
        // Default based on URL pattern
        const urlLower = inputUrl.toLowerCase();
        if (urlLower.includes('mjpeg') || urlLower.includes('mjpg')) {
          resolve('mjpeg');
        } else {
          resolve(null);
        }
      });

      req.end();
    } catch (err) {
      log.error(`Error probing stream type: ${err.message}`);
      resolve(null);
    }
  });
};

/**
 * Determine stream type from input URL
 */
const determineStreamType = async (inputUrl, username, password) => {
  const urlLower = inputUrl.toLowerCase();

  // RTSP is straightforward
  if (urlLower.startsWith('rtsp://')) {
    return 'rtsp';
  }

  // For HTTP(S), probe the URL
  if (urlLower.startsWith('http://') || urlLower.startsWith('https://')) {
    const probedType = await probeStreamType(inputUrl, username, password);

    if (probedType) {
      return probedType;
    }

    // Fallback: check URL patterns
    if (urlLower.includes('mjpeg') || urlLower.includes('mjpg') || urlLower.includes('cam.cgi')) {
      return 'mjpeg';
    }

    // Default to mjpeg for HTTP(S)
    return 'mjpeg';
  }

  return null;
};

/**
 * GET /api/cameras
 * Get the single camera (returns as array for frontend compatibility)
 */
export const fetch = (req, res) => {
  try {
    const camera = getCamera();

    // Return as array for frontend compatibility
    if (!camera) {
      res.send({ records: [] });
      return;
    }

    // Don't return password in the response, but do return username
    const { id, name, inputUrl, username, type, enabled, createdAt, updatedAt } = camera;
    res.send({
      records: [{
        id,
        name,
        inputUrl: inputUrl ? inputUrl.replace(/:([^:@]+)@/, ':****@') : '', // Hide password in URL
        username, // Return username (password is not returned for security)
        type,
        enabled,
        createdAt,
        updatedAt
      }]
    });
  } catch (err) {
    log.error(`Error fetching camera: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to fetch camera',
      error: err.message
    });
  }
};

/**
 * POST /api/cameras
 * Create or update the single camera (upsert)
 */
export const create = async (req, res) => {
  const {
    name,
    inputUrl,
    username,
    password,
    enabled = true
  } = req.body;

  if (!name) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "name" parameter must not be empty'
    });
    return;
  }

  if (!inputUrl) {
    res.status(ERR_BAD_REQUEST).send({
      msg: 'The "inputUrl" parameter must not be empty'
    });
    return;
  }

  try {
    // Determine stream type
    const type = await determineStreamType(inputUrl, username, password);

    if (!type) {
      res.status(ERR_BAD_REQUEST).send({
        msg: 'Unsupported stream URL format. Supported: rtsp://, http://, https://'
      });
      return;
    }

    const existingCamera = getCamera();

    // Don't embed credentials in URL - store them separately
    // Strip any existing credentials from the URL
    let finalInputUrl = inputUrl;
    try {
      const urlObj = new URL(inputUrl);
      // Remove credentials from URL - they'll be stored separately
      urlObj.username = '';
      urlObj.password = '';
      finalInputUrl = urlObj.toString();
    } catch (err) {
      // If URL parsing fails, try to remove credentials manually
      finalInputUrl = inputUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//');
      finalInputUrl = finalInputUrl.replace(/\/\/\*\*\*\*:\*\*\*\*@/, '//');
    }

    const wasRTSP = existingCamera?.type === 'rtsp' && existingCamera?.enabled;
    const camera = {
      id: existingCamera?.id || uuid.v4(),
      name,
      inputUrl: finalInputUrl, // URL without credentials
      username, // Store separately
      password, // Store separately
      type,
      enabled: !!enabled,
      createdAt: existingCamera?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    config.set(CONFIG_KEY, camera);

    // If RTSP camera, trigger MediaMTX reload
    const isRTSP = type === 'rtsp' && enabled;
    if (isRTSP || (wasRTSP && !enabled)) {
      log.info('RTSP camera configuration changed, reloading MediaMTX');
      mediamtxService.reload();
    }

    res.send({
      id: camera.id,
      type: camera.type,
      createdAt: camera.createdAt,
      updatedAt: camera.updatedAt
    });
  } catch (err) {
    log.error(`Error creating/updating camera: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to create/update camera',
      error: err.message
    });
  }
};

/**
 * GET /api/cameras/:id
 * Get the single camera (id parameter is ignored)
 */
export const read = (req, res) => {
  const camera = getCamera();

  if (!camera) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Camera not found'
    });
    return;
  }

  // Don't return password in the response, but do return username (password is sensitive)
  const { id, name, inputUrl, username, type, enabled, createdAt, updatedAt } = camera;
  res.send({
    id,
    name,
    inputUrl: inputUrl ? inputUrl.replace(/:([^:@]+)@/, ':****@') : '', // Hide password in URL
    username, // Return username (password is not returned for security)
    type,
    enabled,
    createdAt,
    updatedAt
  });
};

/**
 * PUT /api/cameras/:id
 * Update the single camera (id parameter is ignored)
 */
export const update = async (req, res) => {
  const camera = getCamera();

  if (!camera) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Camera not found'
    });
    return;
  }

  const {
    name,
    inputUrl,
    username,
    password,
    enabled
  } = req.body;

  const wasRTSP = camera.type === 'rtsp';
  const wasEnabled = camera.enabled;

  // Update fields if provided
  if (name !== undefined) {
    camera.name = name;
  }
  if (inputUrl !== undefined) {
    // Strip credentials from URL if provided - store them separately
    let cleanInputUrl = inputUrl;
    try {
      const urlObj = new URL(inputUrl);
      urlObj.username = '';
      urlObj.password = '';
      cleanInputUrl = urlObj.toString();
    } catch (err) {
      // If URL parsing fails, try to remove credentials manually
      cleanInputUrl = inputUrl.replace(/\/\/([^:@]+):([^@]+)@/, '//');
      cleanInputUrl = cleanInputUrl.replace(/\/\/\*\*\*\*:\*\*\*\*@/, '//');
    }
    camera.inputUrl = cleanInputUrl;

    // Re-determine type if URL changed
    const currentUsername = username !== undefined ? username : camera.username;
    const currentPassword = password !== undefined ? password : camera.password;
    const type = await determineStreamType(cleanInputUrl, currentUsername, currentPassword);
    if (type) {
      camera.type = type;
    }
  }

  // Store username/password as separate fields (don't embed in URL)
  if (username !== undefined) {
    camera.username = username;
  }
  if (password !== undefined) {
    camera.password = password;
  }

  // If username/password changed (but URL didn't), re-determine type
  if ((username !== undefined || password !== undefined) && inputUrl === undefined) {
    const currentUrl = camera.inputUrl;
    const currentUsername = username !== undefined ? username : camera.username;
    const currentPassword = password !== undefined ? password : camera.password;
    const type = await determineStreamType(currentUrl, currentUsername, currentPassword);
    if (type) {
      camera.type = type;
    }
  }
  if (enabled !== undefined) {
    camera.enabled = !!enabled;
  }

  camera.updatedAt = new Date().toISOString();

  config.set(CONFIG_KEY, camera);

  // Trigger MediaMTX reload if RTSP camera was added/enabled or config changed
  const isRTSP = camera.type === 'rtsp';
  const isEnabled = camera.enabled;

  if (isRTSP && (isEnabled || (wasRTSP && wasEnabled))) {
    log.info('RTSP camera configuration changed, reloading MediaMTX');
    mediamtxService.reload();
  }

  res.send({
    id: camera.id,
    type: camera.type,
    updatedAt: camera.updatedAt
  });
};

/**
 * DELETE /api/cameras/:id
 * Delete the single camera (id parameter is ignored)
 */
export const __delete = (req, res) => {
  const camera = getCamera();

  if (!camera) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Camera not found'
    });
    return;
  }

  const wasRTSP = camera.type === 'rtsp' && camera.enabled;
  const cameraId = camera.id;

  // Clear the camera
  config.set(CONFIG_KEY, null);

  // Reload MediaMTX if RTSP camera was removed
  if (wasRTSP) {
    log.info('RTSP camera removed, reloading MediaMTX');
    mediamtxService.reload();
  }

  res.send({ id: cameraId });
};
