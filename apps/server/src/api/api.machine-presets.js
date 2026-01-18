import fs from 'fs';
import path from 'path';
import logger from '../lib/logger';

const log = logger('api:machine-presets');

// Path to presets file
// When compiled by Babel to CommonJS, __dirname will be available
// File location: output/axiocnc/server/api/api.machine-presets.js
// Config location: output/axiocnc/server/config/machine-presets.json
// So we go up one level from api/ to server/, then into config/
const PRESETS_FILE = path.resolve(__dirname, '../config/machine-presets.json');

let cachedPresets = null;
let lastModified = null;

/**
 * Load machine presets from JSON file with caching
 */
function loadPresets() {
  try {
    const stats = fs.statSync(PRESETS_FILE);
    const currentModified = stats.mtimeMs;

    // Return cached presets if file hasn't changed
    if (cachedPresets && lastModified === currentModified) {
      return cachedPresets;
    }

    // Read and parse presets file
    const fileContent = fs.readFileSync(PRESETS_FILE, 'utf8');
    const presets = JSON.parse(fileContent);

    // Validate structure
    if (!Array.isArray(presets)) {
      log.error('Machine presets file must contain an array');
      return [];
    }

    // Validate each preset
    const validPresets = presets.filter(preset => {
      if (!preset.id || !preset.name || !preset.dimensions || !preset.homingCorner) {
        log.warn(`Invalid preset structure: ${JSON.stringify(preset)}`);
        return false;
      }
      if (!preset.dimensions.width || !preset.dimensions.depth || !preset.dimensions.height) {
        log.warn(`Preset ${preset.id} missing dimension values`);
        return false;
      }
      const validCorners = ['back-left', 'back-right', 'front-left', 'front-right'];
      if (!validCorners.includes(preset.homingCorner)) {
        log.warn(`Preset ${preset.id} has invalid homing corner: ${preset.homingCorner}`);
        return false;
      }
      return true;
    });

    cachedPresets = validPresets;
    lastModified = currentModified;

    log.debug(`Loaded ${validPresets.length} machine presets`);
    return validPresets;
  } catch (err) {
    if (err.code === 'ENOENT') {
      log.warn(`Machine presets file not found: ${PRESETS_FILE}`);
      return [];
    }
    log.error(`Error loading machine presets: ${err.message}`);
    return [];
  }
}

/**
 * GET /api/machine-presets
 * Returns all machine presets
 */
export const fetch = (req, res) => {
  try {
    const presets = loadPresets();
    res.send({
      presets: presets
    });
  } catch (err) {
    log.error(`Error fetching machine presets: ${err.message}`);
    res.status(500).send({
      msg: 'Failed to load machine presets',
      err: err.message
    });
  }
};
