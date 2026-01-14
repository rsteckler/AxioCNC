/**
 * Cameras API
 *
 * Manages camera configurations for streaming
 */
import http from 'http';
import https from 'https';
import uuid from 'uuid';
import find from 'lodash/find';
import castArray from 'lodash/castArray';
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
const CONFIG_KEY = 'cameras'; // Store cameras as a separate array

/**
 * Get sanitized camera records
 */
const getSanitizedRecords = () => {
  const records = castArray(config.get(CONFIG_KEY, []));

  let shouldUpdate = false;
  for (let i = 0; i < records.length; ++i) {
    if (!isPlainObject(records[i])) {
      records[i] = {};
    }

    const record = records[i];

    if (!record.id) {
      record.id = uuid.v4();
      shouldUpdate = true;
    }

    // Defaults
    if (record.enabled === undefined) {
      record.enabled = true;
    }
    if (!record.name) {
      record.name = `Camera ${i + 1}`;
      shouldUpdate = true;
    }
  }

  if (shouldUpdate) {
    log.debug(`update sanitized records: ${JSON.stringify(records)}`);
    config.set(CONFIG_KEY, records, { silent: true });
  }

  return records;
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
        requestOptions.headers['Authorization'] = `Basic ${auth}`;
      }

      // Also try to use credentials from URL if no separate credentials provided
      if (!username && !password && (upstreamUrl.username || upstreamUrl.password)) {
        const authString = `${upstreamUrl.username || ''}:${upstreamUrl.password || ''}`;
        const auth = Buffer.from(authString).toString('base64');
        requestOptions.headers['Authorization'] = `Basic ${auth}`;
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
 * List all cameras
 */
export const fetch = (req, res) => {
  try {
    const records = getSanitizedRecords();
    res.send({
      records: records.map(record => {
        // Don't return passwords in the response, but do return username
        const { id, name, inputUrl, username, type, enabled, createdAt, updatedAt } = record;
        return {
          id,
          name,
          inputUrl: inputUrl ? inputUrl.replace(/:([^:@]+)@/, ':****@') : '', // Hide password in URL
          username, // Return username (password is not returned for security)
          type,
          enabled,
          createdAt,
          updatedAt
        };
      })
    });
  } catch (err) {
    log.error(`Error fetching cameras: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to fetch cameras',
      error: err.message
    });
  }
};

/**
 * POST /api/cameras
 * Create or update a camera
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

    const records = getSanitizedRecords();

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

    const record = {
      id: uuid.v4(),
      name,
      inputUrl: finalInputUrl, // URL without credentials
      username, // Store separately
      password, // Store separately
      type,
      enabled: !!enabled,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    records.push(record);
    config.set(CONFIG_KEY, records);

    // If RTSP camera, trigger MediaMTX reload
    if (type === 'rtsp' && enabled) {
      log.info('RTSP camera added, reloading MediaMTX');
      mediamtxService.reload();
    }

    res.send({
      id: record.id,
      type: record.type,
      createdAt: record.createdAt
    });
  } catch (err) {
    log.error(`Error creating camera: ${err.message}`);
    res.status(ERR_INTERNAL_SERVER_ERROR).send({
      msg: 'Failed to create camera',
      error: err.message
    });
  }
};

/**
 * GET /api/cameras/:id
 * Get a specific camera
 */
export const read = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Camera not found'
    });
    return;
  }

  // Don't return password in the response, but do return username (password is sensitive)
  const { name, inputUrl, username, type, enabled, createdAt, updatedAt } = record;
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
 * Update a camera
 */
export const update = async (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const recordIndex = records.findIndex(r => r.id === id);

  if (recordIndex === -1) {
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

  const oldRecord = records[recordIndex];
  const wasRTSP = oldRecord.type === 'rtsp';
  const wasEnabled = oldRecord.enabled;

  // Update fields if provided
  if (name !== undefined) {
    records[recordIndex].name = name;
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
    records[recordIndex].inputUrl = cleanInputUrl;

    // Re-determine type if URL changed
    const currentUsername = username !== undefined ? username : records[recordIndex].username;
    const currentPassword = password !== undefined ? password : records[recordIndex].password;
    const type = await determineStreamType(cleanInputUrl, currentUsername, currentPassword);
    if (type) {
      records[recordIndex].type = type;
    }
  }

  // Store username/password as separate fields (don't embed in URL)
  if (username !== undefined) {
    records[recordIndex].username = username;
  }
  if (password !== undefined) {
    records[recordIndex].password = password;
  }

  // If username/password changed (but URL didn't), re-determine type
  if ((username !== undefined || password !== undefined) && inputUrl === undefined) {
    const currentUrl = records[recordIndex].inputUrl;
    const currentUsername = username !== undefined ? username : records[recordIndex].username;
    const currentPassword = password !== undefined ? password : records[recordIndex].password;
    const type = await determineStreamType(currentUrl, currentUsername, currentPassword);
    if (type) {
      records[recordIndex].type = type;
    }
  }
  if (enabled !== undefined) {
    records[recordIndex].enabled = !!enabled;
  }

  records[recordIndex].updatedAt = new Date().toISOString();

  config.set(CONFIG_KEY, records);

  // Trigger MediaMTX reload if RTSP camera was added/enabled or config changed
  const isRTSP = records[recordIndex].type === 'rtsp';
  const isEnabled = records[recordIndex].enabled;

  if (isRTSP && (isEnabled || (wasRTSP && wasEnabled))) {
    log.info('RTSP camera configuration changed, reloading MediaMTX');
    mediamtxService.reload();
  }

  res.send({
    id: records[recordIndex].id,
    type: records[recordIndex].type,
    updatedAt: records[recordIndex].updatedAt
  });
};

/**
 * DELETE /api/cameras/:id
 * Delete a camera
 */
export const __delete = (req, res) => {
  const id = req.params.id;
  const records = getSanitizedRecords();
  const record = find(records, { id: id });

  if (!record) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Camera not found'
    });
    return;
  }

  const wasRTSP = record.type === 'rtsp' && record.enabled;

  const updatedRecords = records.filter(r => r.id !== id);
  config.set(CONFIG_KEY, updatedRecords);

  // Reload MediaMTX if RTSP camera was removed
  if (wasRTSP) {
    log.info('RTSP camera removed, reloading MediaMTX');
    mediamtxService.reload();
  }

  res.send({ id });
};
