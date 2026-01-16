/**
 * Joystick Command Dispatcher
 *
 * Dispatches mapped button actions to controller commands.
 * Handles state checking, command mapping, and controller access.
 */

const logger = require('../../lib/logger').default;
const store = require('../../store').default;

const log = logger('service:joystick:dispatcher');

/**
 * Convert WCS (Work Coordinate System) string to P number for G10 commands
 * G54 = P1, G55 = P2, etc.
 */
function getWCSPNumber(wcs) {
  const map = {
    'G54': 1,
    'G55': 2,
    'G56': 3,
    'G57': 4,
    'G58': 5,
    'G59': 6,
  };
  return map[wcs] || 1;
}

/**
 * Build G10 L20 command to set work coordinate system zero
 * G10 L20 P<wcs_number> <axes>0
 */
function buildSetZeroCommand(wcs, axes) {
  const p = getWCSPNumber(wcs);
  const axisParts = [];

  if (axes.includes('x')) {
 axisParts.push('X0');
}
  if (axes.includes('y')) {
 axisParts.push('Y0');
}
  if (axes.includes('z')) {
 axisParts.push('Z0');
}

  return `G10 L20 P${p} ${axisParts.join(' ')}`;
}

/**
 * Get the first connected controller
 * Returns null if no controller is connected
 */
function getFirstController() {
  const controllers = store.get('controllers', {});
  const ports = Object.keys(controllers);

  for (const port of ports) {
    const controller = store.get(`controllers["${port}"]`);
    if (controller && controller.isOpen && controller.isOpen()) {
      return { controller, port };
    }
  }

  return null;
}

/**
 * Get current WCS (Work Coordinate System) from controller state
 * Returns 'G54' as default if not available
 */
function getCurrentWCS(controller) {
  if (!controller || !controller.state) {
    return 'G54'; // Default
  }

  const wcs = controller.state.parserstate?.modal?.wcs;
  return wcs || 'G54';
}

/**
 * Get current spindle state from controller state
 * Returns 'M5' (stopped) as default if not available
 */
function getCurrentSpindleState(controller) {
  if (!controller || !controller.state) {
    return 'M5'; // Default to stopped
  }

  const spindle = controller.state.parserstate?.modal?.spindle;
  return spindle || 'M5';
}

/**
 * Check if machine is in the required state
 */
function checkState(action, controller) {
  if (!controller) {
    return false;
  }

  const state = controller.state;
  const activeState = state?.status?.activeState || '';
  const isOpen = controller.isOpen && controller.isOpen();

  // State requirements for each action
  switch (action) {
    case 'emergency_stop':
      return true; // Always allowed

    case 'home_all':
    case 'zero_all':
    case 'zero_x':
    case 'zero_y':
    case 'zero_z':
    case 'start':
      // When connected and idle
      return isOpen && activeState === 'Idle';

    case 'stop':
      // When Run
      return isOpen && activeState === 'Run';

    case 'pause':
      // When Run
      return isOpen && activeState === 'Run';

    case 'resume':
      // When Hold
      return isOpen && activeState === 'Hold';

    case 'feed_hold':
      // When idle or run
      return isOpen && (activeState === 'Idle' || activeState === 'Run');

    case 'spindle_on':
      // When idle and spindle is stopped
      if (!isOpen || activeState !== 'Idle') {
        return false;
      }
      {
        const spindleState = getCurrentSpindleState(controller);
        return spindleState === 'M5'; // Only allow if stopped
      }

    case 'spindle_off':
      // When idle or alarm or hold
      return isOpen && (activeState === 'Idle' || activeState === 'Alarm' || activeState === 'Hold');

    default:
      log.warn(`Unknown action for state check: ${action}`);
      return false;
  }
}

/**
 * Map button action to controller command
 */
function mapActionToCommand(action, controller) {
  switch (action) {
    case 'emergency_stop':
      return { cmd: 'reset' };

    case 'home_all':
      return { cmd: 'homing' };

    case 'zero_all':
      {
        const wcs = getCurrentWCS(controller);
        const gcode = buildSetZeroCommand(wcs, 'xyz');
        return { cmd: 'gcode', args: [[gcode]] };
      }

    case 'zero_x':
      {
        const wcs = getCurrentWCS(controller);
        const gcode = buildSetZeroCommand(wcs, 'x');
        return { cmd: 'gcode', args: [[gcode]] };
      }

    case 'zero_y':
      {
        const wcs = getCurrentWCS(controller);
        const gcode = buildSetZeroCommand(wcs, 'y');
        return { cmd: 'gcode', args: [[gcode]] };
      }

    case 'zero_z':
      {
        const wcs = getCurrentWCS(controller);
        const gcode = buildSetZeroCommand(wcs, 'z');
        return { cmd: 'gcode', args: [[gcode]] };
      }

    case 'start':
      return { cmd: 'gcode:start' };

    case 'stop':
      return { cmd: 'gcode:stop' };

    case 'pause':
      return { cmd: 'gcode:pause' };

    case 'resume':
      return { cmd: 'gcode:resume' };

    case 'feed_hold':
      return { cmd: 'feedhold' };

    case 'spindle_on':
      return { cmd: 'gcode', args: [['M3']] };

    case 'spindle_off':
      return { cmd: 'gcode', args: [['M5']] };

    default:
      log.warn(`Unknown action for command mapping: ${action}`);
      return null;
  }
}

/**
 * Dispatch a button action to the controller
 */
function dispatchButtonAction(action) {
  const result = getFirstController();
  if (!result) {
    log.debug(`Cannot dispatch action ${action}: no connected controller`);
    return false;
  }

  const { controller } = result;

  // Check state
  if (!checkState(action, controller)) {
    log.debug(`Cannot dispatch action ${action}: state check failed`);
    return false;
  }

  // Map to command
  const command = mapActionToCommand(action, controller);
  if (!command) {
    log.warn(`Cannot dispatch action ${action}: command mapping failed`);
    return false;
  }

  // Execute command
  try {
    if (command.args) {
      controller.command(command.cmd, ...command.args);
    } else {
      controller.command(command.cmd);
    }
    log.debug(`Dispatched action ${action} → ${command.cmd}`);
    return true;
  } catch (error) {
    log.error(`Error dispatching action ${action}:`, error);
    return false;
  }
}

module.exports = {
  dispatchButtonAction,
  getFirstController,
  getCurrentWCS,
  getCurrentSpindleState,
  checkState,
  mapActionToCommand,
};
