/**
 * Analytics service for backend
 * Sends events to Aptabase API via HTTP
 */

import superagent from 'superagent';
import { getAptabaseKey, isAnalyticsEnabled } from '../../config/analytics';
import configstore from '../configstore';
import logger from '../../lib/logger';

const log = logger('service:analytics');

let enabled = false;
let appKey = '';
let host = '';
let sessionId = '';
const eventQueue = [];
const MAX_QUEUE_SIZE = 100;
const BATCH_SIZE = 25;
let flushTimer = null;
const FLUSH_INTERVAL = 5000; // Flush every 5 seconds

/**
 * Determine Aptabase host from app key
 * Keys starting with A-EU- use EU host, others use US host
 */
const getHost = (key) => {
  if (!key) return '';
  if (key.startsWith('A-EU-')) {
    return 'https://eu.aptabase.com';
  }
  return 'https://us.aptabase.com';
};

/**
 * Generate a session ID
 */
const generateSessionId = () => {
  return `${Date.now()}${Math.random().toString(36).substring(2, 15)}`;
};

/**
 * Sanitize string values for privacy
 */
const sanitizeString = (value, maxLength = 200) => {
  if (value === null || value === undefined) return null;
  const str = String(value);
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '...';
  }
  return str;
};

/**
 * Sanitize file path - remove full path, keep only filename
 */
const sanitizePath = (path) => {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
};

/**
 * Sanitize port name - remove full path, keep device name
 */
const sanitizePort = (port) => {
  if (!port) return '';
  const parts = port.split(/[/\\]/);
  return parts[parts.length - 1] || port;
};

/**
 * Sanitize event properties
 */
const sanitizeProperties = (properties) => {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(properties || {})) {
    if (value === null || value === undefined) {
      sanitized[key] = null;
      continue;
    }
    
    if (typeof value === 'number' || typeof value === 'boolean') {
      sanitized[key] = value ? 1 : 0;
    } else if (typeof value === 'string') {
      if (key === 'file_name' || key.includes('path')) {
        sanitized[key] = sanitizePath(value);
      } else if (key === 'port') {
        sanitized[key] = sanitizePort(value);
      } else {
        sanitized[key] = sanitizeString(value) || '';
      }
    } else {
      sanitized[key] = sanitizeString(String(value)) || '';
    }
  }
  
  return sanitized;
};

/**
 * Create event object for Aptabase API
 */
const createEvent = (eventName, properties = {}) => {
  const sanitized = sanitizeProperties(properties);
  
  return {
    timestamp: new Date().toISOString(),
    sessionId,
    eventName,
    systemProps: {
      locale: 'en-US', // Could get from settings if needed
      osName: process.platform,
      osVersion: process.platform, // Node.js doesn't expose OS version easily
      deviceModel: 'server',
      isDebug: process.env.NODE_ENV === 'development',
      appVersion: require('../../../package.json').version,
      sdkVersion: 'aptabase-node@0.1.0',
    },
    props: sanitized,
  };
};

/**
 * Flush queued events to Aptabase
 */
const flushQueue = async () => {
  if (!enabled) {
    log.debug('[Analytics] Flush skipped: analytics disabled');
    return;
  }
  
  if (eventQueue.length === 0) {
    log.debug('[Analytics] Flush skipped: queue empty');
    return;
  }
  
  try {
    // Take up to BATCH_SIZE events
    const batch = eventQueue.splice(0, BATCH_SIZE);
    
    if (batch.length === 0) return;
    
    log.debug('[Analytics] Flushing', batch.length, 'events to', host);
    log.debug('[Analytics] Events:', batch.map(e => e.eventName).join(', '));
    
    // Send to Aptabase API
    const response = await superagent
      .post(`${host}/api/v0/events`)
      .set('Content-Type', 'application/json')
      .set('App-Key', appKey)
      .send(batch)
      .timeout(5000); // 5 second timeout
    
    log.debug('[Analytics] Events sent successfully (status:', response.status, ')');
    
    // If there are more events, schedule another flush
    if (eventQueue.length > 0) {
      log.debug('[Analytics] More events in queue (', eventQueue.length, '), scheduling next flush');
      scheduleFlush();
    }
  } catch (err) {
    // Fail silently - don't break the app
    log.warn('[Analytics] Failed to flush events:', err.message);
    if (err.response) {
      log.warn('[Analytics] Response status:', err.response.status, 'body:', err.response.body);
    }
    // Re-queue events if flush failed (up to max size)
    if (eventQueue.length < MAX_QUEUE_SIZE) {
      // Don't re-queue if we're at max size to prevent memory issues
    }
  }
};

/**
 * Schedule a flush of the event queue
 */
const scheduleFlush = () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }
  flushTimer = setTimeout(flushQueue, FLUSH_INTERVAL);
};

/**
 * Initialize analytics service
 */
const initialize = () => {
  try {
    log.debug('[Analytics] Initializing...');
    
    // Try to get the key - may fail if config file doesn't exist
    try {
      appKey = getAptabaseKey();
      if (appKey) {
        log.debug('[Analytics] Key found (length:', appKey.length, ')');
      } else {
        log.debug('[Analytics] No key found');
      }
    } catch (err) {
      // Config file doesn't exist or failed to load - that's OK
      appKey = '';
      log.debug('[Analytics] Key load failed:', err.message);
    }
    
    if (!appKey) {
      log.debug('[Analytics] Disabled: No API key');
      enabled = false;
      return;
    }
    
    host = getHost(appKey);
    if (!host) {
      log.debug('[Analytics] Disabled: Invalid key format (host not determined)');
      enabled = false;
      return;
    }
    log.debug('[Analytics] Host determined:', host);
    
    // Check if user has enabled analytics
    try {
      const settings = configstore.get('settings', {});
      const userEnabled = settings.allowAnonymousUsageDataCollection ?? false;
      log.debug('[Analytics] User enabled setting:', userEnabled);
      
      if (!isAnalyticsEnabled(userEnabled)) {
        log.debug('[Analytics] Disabled: User has not enabled analytics');
        enabled = false;
        return;
      }
    } catch (err) {
      // Settings not available yet - disable analytics
      log.debug('[Analytics] Disabled: Settings not available:', err.message);
      enabled = false;
      return;
    }
    
    sessionId = generateSessionId();
    enabled = true;
    log.info('[Analytics] Enabled and ready (host:', host, ', session:', sessionId.substring(0, 10) + '...)');
    
    // Start periodic flush
    scheduleFlush();
  } catch (err) {
    // Fail silently
    log.warn('[Analytics] Initialization failed:', err.message);
    enabled = false;
  }
};

/**
 * Track an event
 * @param {string} eventName - Event name
 * @param {object} properties - Event properties
 */
const track = (eventName, properties = {}) => {
  try {
    if (!enabled) {
      log.debug('[Analytics] Track skipped:', eventName, '(analytics disabled)');
      return;
    }
    
    log.debug('[Analytics] Tracking event:', eventName, 'properties:', JSON.stringify(properties));
    
    // Create event
    const event = createEvent(eventName, properties);
    
    // Add to queue
    if (eventQueue.length < MAX_QUEUE_SIZE) {
      eventQueue.push(event);
      log.debug('[Analytics] Event queued (queue size:', eventQueue.length, ')');
      scheduleFlush();
    } else {
      // Queue is full - drop oldest event
      eventQueue.shift();
      eventQueue.push(event);
      log.warn('[Analytics] Queue full, dropped oldest event');
    }
  } catch (err) {
    // Fail silently
    log.warn('[Analytics] Track failed:', err.message);
  }
};

/**
 * Flush all queued events (call on shutdown)
 */
const flush = async () => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  await flushQueue();
};

/**
 * Check if analytics is enabled
 */
const isEnabled = () => enabled;

export default {
  initialize,
  track,
  flush,
  isEnabled,
};
