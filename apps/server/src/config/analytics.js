/**
 * Analytics configuration for backend
 * Reads Aptabase key from:
 * 1. Environment variable (for local dev - easiest)
 * 2. Generated config file (for CI builds - baked into package)
 */

let aptabaseKey = '';

// First, try environment variable (for local development)
if (process.env.APTABASE_KEY) {
  aptabaseKey = process.env.APTABASE_KEY;
} else {
  // Fall back to generated config file (for CI builds)
  try {
    // Use require for dynamic loading (file may not exist)
    // eslint-disable-next-line import/no-unresolved, global-require
    const keyModule = require('./aptabase-key.js');
    aptabaseKey = keyModule.APTABASE_KEY || '';
  } catch (err) {
    // File doesn't exist (user building from source without key) - that's OK
    aptabaseKey = '';
  }
}

/**
 * Get the Aptabase API key
 * @returns {string} The API key, or empty string if not available
 */
export const getAptabaseKey = () => aptabaseKey;

/**
 * Check if analytics is enabled
 * @param {boolean} userEnabled - Whether user has enabled analytics in settings
 * @returns {boolean} True if analytics should be enabled
 */
export const isAnalyticsEnabled = (userEnabled) => {
  return !!aptabaseKey && userEnabled;
};
