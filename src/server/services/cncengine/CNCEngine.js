import { ensureArray } from 'ensure-type';
import noop from 'lodash/noop';
import { SerialPort } from 'serialport';
import socketIO from 'socket.io';
import socketioJwt from 'socketio-jwt';
import EventTrigger from '../../lib/EventTrigger';
import logger from '../../lib/logger';
import settings from '../../config/settings';
import store from '../../store';
import config from '../configstore';
import taskRunner from '../taskrunner';
import machineStatusManager from '../machinestatus/MachineStatusManager';
import {
  GrblController,
  MarlinController,
  SmoothieController,
  TinyGController
} from '../../controllers';
import { GRBL } from '../../controllers/Grbl/constants';
import { MARLIN } from '../../controllers/Marlin/constants';
import { SMOOTHIE } from '../../controllers/Smoothie/constants';
import { G2CORE, TINYG } from '../../controllers/TinyG/constants';
import {
  authorizeIPAddress,
  validateUser
} from '../../access-control';

const log = logger('service:cncengine');

// Case-insensitive equality checker.
// @param {string} str1 First string to check.
// @param {string} str2 Second string to check.
// @return {boolean} True if str1 and str2 are the same string, ignoring case.
const caseInsensitiveEquals = (str1, str2) => {
  str1 = str1 ? (str1 + '').toUpperCase() : '';
  str2 = str2 ? (str2 + '').toUpperCase() : '';
  return str1 === str2;
};

const isValidController = (controller) => (
  // Grbl
  caseInsensitiveEquals(GRBL, controller) ||
    // Marlin
    caseInsensitiveEquals(MARLIN, controller) ||
    // Smoothie
    caseInsensitiveEquals(SMOOTHIE, controller) ||
    // g2core
    caseInsensitiveEquals(G2CORE, controller) ||
    // TinyG
    caseInsensitiveEquals(TINYG, controller)
);

class CNCEngine {
    controllerClass = {};

    listener = {
      taskStart: (...args) => {
        if (this.io) {
          this.io.emit('task:start', ...args);
        }
      },
      taskFinish: (...args) => {
        if (this.io) {
          this.io.emit('task:finish', ...args);
        }
      },
      taskError: (...args) => {
        if (this.io) {
          this.io.emit('task:error', ...args);
        }
      },
      configChange: (...args) => {
        if (this.io) {
          this.io.emit('config:change', ...args);
        }
      }
    };

    server = null;

    io = null;

    sockets = [];

    // Event Trigger
    event = new EventTrigger((event, trigger, commands) => {
      log.debug(`EventTrigger: event="${event}", trigger="${trigger}", commands="${commands}"`);
      if (trigger === 'system') {
        taskRunner.run(commands);
      }
    });

    // @param {object} server The HTTP server instance.
    // @param {string} controller Specify CNC controller.
    start(server, controller = '') {
      // Fallback to an empty string if the controller is not valid
      if (!isValidController(controller)) {
        controller = '';
      }

      // Grbl
      if (!controller || caseInsensitiveEquals(GRBL, controller)) {
        this.controllerClass[GRBL] = GrblController;
      }
      // Marlin
      if (!controller || caseInsensitiveEquals(MARLIN, controller)) {
        this.controllerClass[MARLIN] = MarlinController;
      }
      // Smoothie
      if (!controller || caseInsensitiveEquals(SMOOTHIE, controller)) {
        this.controllerClass[SMOOTHIE] = SmoothieController;
      }
      // TinyG / G2core
      if (!controller || caseInsensitiveEquals(G2CORE, controller) || caseInsensitiveEquals(TINYG, controller)) {
        this.controllerClass[TINYG] = TinyGController;
      }

      if (Object.keys(this.controllerClass).length === 0) {
        throw new Error(`No valid CNC controller specified (${controller})`);
      }

      const loadedControllers = Object.keys(this.controllerClass);
      log.debug(`Loaded controllers: ${loadedControllers}`);

      this.stop();

      taskRunner.on('start', this.listener.taskStart);
      taskRunner.on('finish', this.listener.taskFinish);
      taskRunner.on('error', this.listener.taskError);
      config.on('change', this.listener.configChange);

      // System Trigger: Startup
      this.event.trigger('startup');

      this.server = server;
      this.io = socketIO(this.server, {
        serveClient: true,
        path: '/socket.io'
      });

      // Set Socket.IO instance for status manager
      machineStatusManager.setIO(this.io);

      this.io.use(socketioJwt.authorize({
        secret: settings.secret,
        handshake: true
      }));

      this.io.use(async (socket, next) => {
        try {
          // IP Address Access Control
          const ipaddr = socket.handshake.address;
          await authorizeIPAddress(ipaddr);

          // User Validation
          const user = socket.decoded_token || {};
          await validateUser(user);
        } catch (err) {
          log.warn(err);
          next(err);
          return;
        }

        next();
      });

      this.io.on('connection', (socket) => {
        const address = socket.handshake.address;
        const user = socket.decoded_token || {};
        log.debug(`New connection from ${address}: id=${socket.id}, user.id=${user.id}, user.name=${user.name}`);

        // Add to the socket pool
        this.sockets.push(socket);

        socket.emit('startup', {
          loadedControllers: Object.keys(this.controllerClass),

          // User-defined baud rates and ports
          baudrates: ensureArray(config.get('baudrates', [])),
          ports: ensureArray(config.get('ports', []))
        });

        // Send current machine statuses to newly connected client
        const allStatuses = machineStatusManager.getAllStatuses();
        Object.keys(allStatuses).forEach(port => {
          const status = machineStatusManager.getStatusSummary(port);
          if (status) {
            socket.emit('machine:status', port, status);
          }
        });

        socket.on('disconnect', () => {
          log.debug(`Disconnected from ${address}: id=${socket.id}, user.id=${user.id}, user.name=${user.name}`);

          const controllers = store.get('controllers', {});
          Object.keys(controllers).forEach(port => {
            const controller = controllers[port];
            if (!controller) {
              return;
            }
            controller.removeConnection(socket);
          });

          // Remove from socket pool
          this.sockets.splice(this.sockets.indexOf(socket), 1);
        });

        // List the available serial ports
        socket.on('list', () => {
          log.debug(`socket.list(): id=${socket.id}`);

          SerialPort.list()
            .then(ports => {
              ports = ports.concat(ensureArray(config.get('ports', [])));

              const controllers = store.get('controllers', {});
              const portsInUse = Object.keys(controllers)
                .filter(port => {
                  const controller = controllers[port];
                  return controller && controller.isOpen();
                });

              ports = ports.map(port => {
                return {
                  port: port.path,
                  manufacturer: port.manufacturer,
                  inuse: portsInUse.indexOf(port.path) >= 0
                };
              });

              socket.emit('serialport:list', ports);
            })
            .catch(err => {
              log.error(err);
            });
        });

        // Open serial port
        socket.on('open', (port, options, callback = noop) => {
          if (typeof callback !== 'function') {
            callback = noop;
          }

          log.debug(`socket.open("${port}", ${JSON.stringify(options)}): id=${socket.id}`);

          let controller = store.get(`controllers["${port}"]`);
          let controllerType;

          if (!controller) {
            let { controllerType: ct = GRBL, baudrate, rtscts, pin } = { ...options };
            controllerType = ct;

            if (controllerType === 'TinyG2') {
              // TinyG2 is deprecated and will be removed in a future release
              controllerType = TINYG;
            }

            const Controller = this.controllerClass[controllerType];
            if (!Controller) {
              const err = `Not supported controller: ${controllerType}`;
              log.error(err);
              callback(new Error(err));
              return;
            }

            const engine = this;
            controller = new Controller(engine, {
              port: port,
              baudrate: baudrate,
              rtscts: !!rtscts,
              pin,
            });
          } else {
            // Get controller type from existing controller
            controllerType = controller.type || GRBL;
          }

          // Wire up status manager to listen to controller events BEFORE addConnection
          // (addConnection may emit serialport:open synchronously if already open)
          this.setupControllerStatusListeners(controller, port, controllerType);

          // If controller is already open, ensure status is synced (but preserve existing state)
          if (controller.isOpen()) {
            // Note: handleSerialPortOpen now preserves homed state if already connected
            // This ensures status is up-to-date when a new socket joins an existing connection
            machineStatusManager.handleSerialPortOpen(port, {
              port: port,
              baudrate: controller.options.baudrate,
              controllerType: controllerType,
              inuse: true
            });

            // Send current controller state if available (this updates position and alarm state)
            if (controller.state && Object.keys(controller.state).length > 0) {
              machineStatusManager.handleControllerState(port, controllerType, controller.state);
            }

            // Send current workflow state if available
            if (controller.workflow) {
              machineStatusManager.handleWorkflowState(port, controller.workflow.state);
            }
          }

          controller.addConnection(socket);

          // Note: addConnection may emit socket.emit('serialport:open') directly to the new socket
          // This is a Socket.IO emit, not controller.emit(), so our wrapper won't catch it
          // However, we've already handled status sync above, so this is fine

          if (controller.isOpen()) {
            // Join the room
            socket.join(port);

            callback(null);
            return;
          }

          controller.open((err = null) => {
            if (err) {
              callback(err);
              return;
            }

            // System Trigger: Open a serial port
            this.event.trigger('port:open');

            if (store.get(`controllers["${port}"]`)) {
              log.error(`Serial port "${port}" was not properly closed`);
            }
            store.set(`controllers[${JSON.stringify(port)}]`, controller);

            // Join the room
            socket.join(port);

            callback(null);
          });
        });

        // Close serial port
        socket.on('close', (port, callback = noop) => {
          if (typeof callback !== 'function') {
            callback = noop;
          }

          log.debug(`socket.close("${port}"): id=${socket.id}`);

          const controller = store.get(`controllers["${port}"]`);
          if (!controller) {
            const err = `Serial port "${port}" not accessible`;
            log.error(err);
            callback(new Error(err));
            return;
          }

          // System Trigger: Close a serial port
          this.event.trigger('port:close');

          // Leave the room
          socket.leave(port);

          controller.close(err => {
            // Remove controller from store
            store.unset(`controllers[${JSON.stringify(port)}]`);

            // Destroy controller
            controller.destroy();

            callback(null);
          });
        });

        socket.on('command', (port, cmd, ...args) => {
          log.debug(`socket.command("${port}", "${cmd}"): id=${socket.id}`);

          const controller = store.get(`controllers["${port}"]`);
          if (!controller || controller.isClose()) {
            log.error(`Serial port "${port}" not accessible`);
            return;
          }

          // Handle special commands that affect machine status
          if (cmd === 'reset') {
            machineStatusManager.handleReset(port);
          } else if (cmd === 'unlock') {
            machineStatusManager.handleUnlock(port);
          } else if (cmd === 'homing') {
            machineStatusManager.handleHoming(port);
          }

          controller.command.apply(controller, [cmd].concat(args));
        });

        socket.on('write', (port, data, context = {}) => {
          log.debug(`socket.write("${port}", "${data}", ${JSON.stringify(context)}): id=${socket.id}`);

          const controller = store.get(`controllers["${port}"]`);
          if (!controller || controller.isClose()) {
            log.error(`Serial port "${port}" not accessible`);
            return;
          }

          controller.write(data, context);
        });

        socket.on('writeln', (port, data, context = {}) => {
          log.debug(`socket.writeln("${port}", "${data}", ${JSON.stringify(context)}): id=${socket.id}`);

          const controller = store.get(`controllers["${port}"]`);
          if (!controller || controller.isClose()) {
            log.error(`Serial port "${port}" not accessible`);
            return;
          }

          controller.writeln(data, context);
        });

        // Request machine status on connection
        socket.on('machine:status:request', (port) => {
          log.debug(`socket.machine:status:request("${port}"): id=${socket.id}`);

          if (port) {
            // Request status for specific port
            const status = machineStatusManager.getStatusSummary(port);
            if (status) {
              socket.emit('machine:status', port, status);
            }
          } else {
            // Request all statuses
            const allStatuses = machineStatusManager.getAllStatuses();
            Object.keys(allStatuses).forEach(p => {
              socket.emit('machine:status', p, machineStatusManager.getStatusSummary(p));
            });
          }
        });
      });
    }

    /**
     * Setup status manager listeners for a controller
     * Wraps the controller's emit method to intercept events
     * Only sets up listeners once per controller (checks for existing flag)
     */
    setupControllerStatusListeners(controller, port, controllerType) {
      // Check if listeners are already set up for this controller
      // We use a symbol to avoid conflicts with controller properties
      const STATUS_LISTENERS_KEY = Symbol('statusListenersSet');

      if (controller[STATUS_LISTENERS_KEY]) {
        // Listeners already set up, skip
        return;
      }

      // Mark that listeners are set up
      controller[STATUS_LISTENERS_KEY] = true;

      // Wrap the controller's emit method to intercept events
      const originalEmit = controller.emit.bind(controller);

      controller.emit = (eventName, ...args) => {
        // Call original emit to send to sockets
        originalEmit(eventName, ...args);

        // Intercept events we care about and notify status manager
        if (eventName === 'serialport:open') {
          const options = args[0] || {};
          machineStatusManager.handleSerialPortOpen(port, {
            ...options,
            controllerType: controllerType
          });
        } else if (eventName === 'serialport:close') {
          machineStatusManager.handleSerialPortClose(port);
        } else if (eventName === 'controller:state') {
          const type = args[0];
          const state = args[1];
          machineStatusManager.handleControllerState(port, type, state);
        } else if (eventName === 'workflow:state') {
          const workflowState = args[0];
          machineStatusManager.handleWorkflowState(port, workflowState);
        }
      };
    }

    stop() {
      if (this.io) {
        this.io.close();
        this.io = null;
      }
      this.sockets = [];
      this.server = null;

      taskRunner.removeListener('start', this.listener.taskStart);
      taskRunner.removeListener('finish', this.listener.taskFinish);
      taskRunner.removeListener('error', this.listener.taskError);
      config.removeListener('change', this.listener.configChange);
    }
}

export default CNCEngine;
