/**
 * System Settings API
 *
 * Validated settings endpoint using Zod schemas.
 * For extension/widget data, use /api/extensions instead.
 */
import _ from 'lodash';
import config from '../services/configstore';
import {
  SystemSettingsSchema,
  getDefaultSettings,
} from '../../shared/schemas/settings';
import {
  ERR_BAD_REQUEST,
} from '../constants';

const CONFIG_KEY = 'settings';

/**
 * GET /api/settings
 * Returns all system settings with defaults applied
 */
export const get = (req, res) => {
  const stored = config.get(CONFIG_KEY, {});

  // Parse with Zod to apply defaults and validate structure
  const result = SystemSettingsSchema.safeParse(stored);

  if (!result.success) {
    // If stored data is corrupted, return defaults
    console.warn('Settings validation failed, returning defaults:', result.error);
    res.send(getDefaultSettings());
    return;
  }

  res.send(result.data);
};

/**
 * POST /api/settings
 * Updates system settings (partial update supported)
 * Merges with current settings and validates the final result
 */
export const set = (req, res) => {
  const data = { ...req.body };

  // Get current settings
  const current = config.get(CONFIG_KEY, {});

  // Deep merge the incoming data with current settings
  const merged = _.merge({}, current, data);

  // Validate the final merged result against full schema
  const result = SystemSettingsSchema.safeParse(merged);

  if (!result.success) {
    const errors = result.error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(ERR_BAD_REQUEST).send({
      msg: 'Invalid settings',
      errors,
    });
    return;
  }

  // Save the validated, merged settings
  config.set(CONFIG_KEY, result.data);

  res.send({ err: false });
};

/**
 * DELETE /api/settings
 * Resets settings to defaults
 */
export const reset = (req, res) => {
  const defaults = getDefaultSettings();
  config.set(CONFIG_KEY, defaults);
  res.send({ err: false, settings: defaults });
};
