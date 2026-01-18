/**
 * Extensions API
 *
 * Schemaless key-value store for widgets, plugins, and custom extensions.
 * For system settings, use /api/settings instead.
 *
 * This API accepts any valid JSON and stores it without validation,
 * making it ideal for:
 * - Widget state/preferences
 * - Plugin configuration
 * - Third-party extension data
 * - Custom user data
 */
import deepKeys from 'deep-keys';
import _ from 'lodash';
import config from '../services/configstore';
import {
  ERR_NOT_FOUND
} from '../constants';

const CONFIG_KEY = 'extensions';

/**
 * GET /api/extensions
 * Get extension data, optionally by key
 *
 * Query params:
 *   key - Optional dot-notation path to retrieve specific data
 *
 * Examples:
 *   GET /api/extensions -> Returns all extension data
 *   GET /api/extensions?key=widgets.visualizer -> Returns visualizer widget data
 */
export const get = (req, res) => {
  const query = req.query || {};

  if (!query.key) {
    res.send(config.get(CONFIG_KEY) || {});
    return;
  }

  const key = `${CONFIG_KEY}.${query.key}`;
  if (!config.has(key)) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  const value = config.get(key);
  res.send(value);
};

/**
 * POST /api/extensions
 * Set extension data
 *
 * Query params:
 *   key - Optional dot-notation path to set specific data
 *
 * Examples:
 *   POST /api/extensions { "widgets": { "visualizer": { "showGrid": true } } }
 *   POST /api/extensions?key=widgets.visualizer { "showGrid": true }
 */
export const set = (req, res) => {
  const query = req.query || {};
  const data = { ...req.body };

  if (query.key) {
    const key = `${CONFIG_KEY}.${query.key}`;
    config.set(key, data);
    res.send({ err: false });
    return;
  }

  deepKeys(data).forEach((key) => {
    const oldValue = config.get(`${CONFIG_KEY}.${key}`);
    const newValue = _.get(data, key);

    if (typeof oldValue === 'object' && typeof newValue === 'object') {
      config.set(`${CONFIG_KEY}.${key}`, {
        ...oldValue,
        ...newValue
      });
    } else {
      config.set(`${CONFIG_KEY}.${key}`, newValue);
    }
  });

  res.send({ err: false });
};

/**
 * DELETE /api/extensions
 * Remove extension data by key
 *
 * Query params:
 *   key - Required dot-notation path to delete
 *
 * Examples:
 *   DELETE /api/extensions?key=widgets.visualizer
 */
export const unset = (req, res) => {
  const query = req.query || {};

  if (!query.key) {
    // Return current data if no key specified (don't delete everything)
    res.send(config.get(CONFIG_KEY) || {});
    return;
  }

  const key = `${CONFIG_KEY}.${query.key}`;
  if (!config.has(key)) {
    res.status(ERR_NOT_FOUND).send({
      msg: 'Not found'
    });
    return;
  }

  config.unset(key);
  res.send({ err: false });
};
