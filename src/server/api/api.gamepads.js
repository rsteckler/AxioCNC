/**
 * Gamepad API
 * 
 * Provides server-side gamepad detection and state reading for CNC jogging.
 * Used when the joystick is connected to the server machine rather than the browser.
 */

import fs from 'fs';
import gamepadService from '../services/gamepad';
import logger from '../lib/logger';

const log = logger('api:gamepads');

/**
 * GET /api/gamepads
 * List all connected gamepads on the server
 */
export const list = (req, res) => {
  const gamepads = gamepadService.list();
  
  res.json({
    gamepads,
  });
};

/**
 * POST /api/gamepads/refresh
 * Refresh the list of connected gamepads
 */
export const refresh = (req, res) => {
  const gamepads = gamepadService.refresh();
  
  res.json({
    gamepads,
  });
};

/**
 * GET /api/gamepads/selected
 * Get the currently selected gamepad
 */
export const getSelected = (req, res) => {
  res.json({
    gamepadId: gamepadService.getSelected(),
  });
};

/**
 * POST /api/gamepads/selected
 * Set the selected gamepad for jogging
 * Body: { gamepadId: string | null }
 */
export const setSelected = (req, res) => {
  const { gamepadId } = req.body;
  
  if (gamepadId !== null && typeof gamepadId !== 'string') {
    return res.status(400).json({ error: 'gamepadId must be a string or null' });
  }
  
  // Verify the gamepad exists (if not null)
  if (gamepadId !== null) {
    const gamepads = gamepadService.list();
    const exists = gamepads.some(gp => gp.id === gamepadId);
    if (!exists) {
      return res.status(404).json({ error: 'Gamepad not found' });
    }
  }
  
  const success = gamepadService.setSelected(gamepadId);
  
  if (!success && gamepadId !== null) {
    return res.status(500).json({ error: 'Failed to open gamepad' });
  }
  
  res.json({
    gamepadId: gamepadService.getSelected(),
  });
};

/**
 * GET /api/gamepads/state
 * Get the current state of the selected gamepad (axes and buttons)
 * Used for polling gamepad input
 */
export const getState = (req, res) => {
  const state = gamepadService.getState();
  
  if (!state) {
    return res.status(400).json({ error: 'No gamepad selected' });
  }
  
  res.json(state);
};

/**
 * GET /api/gamepads/platform
 * Get platform support information
 */
export const getPlatform = (req, res) => {
  res.json(gamepadService.getPlatformInfo());
};

/**
 * GET /api/gamepads/diagnostic
 * Get diagnostic information about joystick detection
 * (for debugging)
 */
export const getDiagnostic = (req, res) => {
  const platform = process.platform;
  const isLinux = platform === 'linux';
  
  const diagnostic = {
    platform,
    isLinux,
    serviceSupported: gamepadService.isSupported,
    joystickDevPath: '/dev/input',
  };
  
  if (isLinux) {
    try {
      diagnostic.devInputExists = fs.existsSync('/dev/input');
      
      if (diagnostic.devInputExists) {
        try {
          const files = fs.readdirSync('/dev/input');
          diagnostic.filesInDevInput = files.length;
          diagnostic.jsFiles = files.filter(f => f.startsWith('js'));
          
          // Check specific js0
          diagnostic.js0Exists = fs.existsSync('/dev/input/js0');
          if (diagnostic.js0Exists) {
            try {
              fs.accessSync('/dev/input/js0', fs.constants.R_OK);
              diagnostic.js0Readable = true;
            } catch (err) {
              diagnostic.js0Readable = false;
              diagnostic.js0Error = err.message;
            }
          }
        } catch (err) {
          diagnostic.readdirError = err.message;
          diagnostic.readdirErrorCode = err.code;
        }
      }
    } catch (err) {
      diagnostic.error = err.message;
    }
  }
  
  diagnostic.cachedGamepads = gamepadService.list();
  diagnostic.selectedGamepad = gamepadService.getSelected();
  
  res.json(diagnostic);
};
