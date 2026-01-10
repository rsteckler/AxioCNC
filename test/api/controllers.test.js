import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse } from './helpers';

test('api.controllers', (t) => {
  t.test('GET /api/controllers - returns empty array when no controllers', (subt) => {
    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {};
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, [], 'should return empty array');
    subt.end();
  });

  t.test('GET /api/controllers - returns single controller status', (subt) => {
    const mockController = {
      get status() {
        return {
          port: '/dev/ttyUSB0',
          baudrate: 115200,
          rtscts: false,
          sockets: ['socket1'],
          ready: true,
          homed: false,
          controller: {
            type: 'Grbl',
            settings: { x: 100 },
            state: 'Idle',
          },
          feeder: { queue: [] },
          sender: { state: {} },
          workflow: {
            state: 'idle',
          },
        };
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController,
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 1, 'should return one controller');
    subt.same(res.body[0], mockController.status, 'should return controller status');
    subt.equal(res.body[0].port, '/dev/ttyUSB0', 'should have correct port');
    subt.equal(res.body[0].controller.type, 'Grbl', 'should have correct controller type');
    subt.end();
  });

  t.test('GET /api/controllers - returns multiple controller statuses', (subt) => {
    const mockController1 = {
      get status() {
        return {
          port: '/dev/ttyUSB0',
          baudrate: 115200,
          ready: true,
          controller: { type: 'Grbl', state: 'Idle' },
        };
      },
    };

    const mockController2 = {
      get status() {
        return {
          port: '/dev/ttyUSB1',
          baudrate: 9600,
          ready: false,
          controller: { type: 'Marlin', state: 'Running' },
        };
      },
    };

    const mockController3 = {
      get status() {
        return {
          port: '/dev/ttyACM0',
          baudrate: 250000,
          ready: true,
          controller: { type: 'Smoothie', state: 'Idle' },
        };
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController1,
            '/dev/ttyUSB1': mockController2,
            '/dev/ttyACM0': mockController3,
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 3, 'should return three controllers');
    subt.equal(res.body[0].port, '/dev/ttyUSB0', 'should have first controller port');
    subt.equal(res.body[1].port, '/dev/ttyUSB1', 'should have second controller port');
    subt.equal(res.body[2].port, '/dev/ttyACM0', 'should have third controller port');
    subt.end();
  });

  t.test('GET /api/controllers - skips null controller entries', (subt) => {
    const mockController = {
      get status() {
        return {
          port: '/dev/ttyUSB0',
          ready: true,
          controller: { type: 'Grbl' },
        };
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController,
            '/dev/ttyUSB1': null, // null entry
            '/dev/ttyUSB2': undefined, // undefined entry
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 1, 'should return only valid controller');
    subt.equal(res.body[0].port, '/dev/ttyUSB0', 'should have correct port');
    subt.end();
  });

  t.test('GET /api/controllers - skips undefined controller entries', (subt) => {
    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': undefined,
            '/dev/ttyUSB1': undefined,
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, [], 'should return empty array when all controllers are undefined');
    subt.end();
  });

  t.test('GET /api/controllers - handles controller with minimal status', (subt) => {
    const mockController = {
      get status() {
        return {
          port: '/dev/ttyUSB0',
        };
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController,
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 1, 'should return one controller');
    subt.same(res.body[0], { port: '/dev/ttyUSB0' }, 'should return minimal status');
    subt.end();
  });

  t.test('GET /api/controllers - handles controller with full status object', (subt) => {
    const fullStatus = {
      port: '/dev/ttyUSB0',
      baudrate: 115200,
      rtscts: true,
      sockets: ['socket1', 'socket2', 'socket3'],
      ready: true,
      homed: true,
      controller: {
        type: 'Grbl',
        settings: {
          $0: 10,
          $1: 25,
          $2: 0,
        },
        state: {
          modal: { motion: 'G0', wcs: 'G54' },
          parserstate: { state: 'Idle' },
        },
      },
      feeder: {
        queue: [],
        lines: [],
        state: 'idle',
      },
      sender: {
        state: {
          gcode: null,
          total: 0,
          sent: 0,
          received: 0,
        },
      },
      workflow: {
        state: 'idle',
        enabled: true,
      },
    };

    const mockController = {
      get status() {
        return fullStatus;
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController,
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 1, 'should return one controller');
    subt.same(res.body[0], fullStatus, 'should return full status object');
    subt.equal(res.body[0].sockets.length, 3, 'should preserve socket array');
    subt.equal(res.body[0].controller.type, 'Grbl', 'should preserve controller type');
    subt.end();
  });

  t.test('GET /api/controllers - handles mixed valid and invalid entries', (subt) => {
    const mockController1 = {
      get status() {
        return { port: '/dev/ttyUSB0', ready: true };
      },
    };

    const mockController2 = {
      get status() {
        return { port: '/dev/ttyUSB1', ready: false };
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController1,
            '/dev/ttyUSB1': null, // null - should be skipped
            '/dev/ttyUSB2': mockController2,
            '/dev/ttyUSB3': undefined, // undefined - should be skipped
            '/dev/ttyUSB4': null, // another null - should be skipped
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 2, 'should return only valid controllers');
    subt.equal(res.body[0].port, '/dev/ttyUSB0', 'should have first valid controller');
    subt.equal(res.body[1].port, '/dev/ttyUSB1', 'should have second valid controller');
    subt.end();
  });

  t.test('GET /api/controllers - preserves order of controllers from store', (subt) => {
    // Note: Object.keys() iteration order is insertion order for string keys in modern JS
    const controllers = {};
    const ports = ['/dev/ttyUSB2', '/dev/ttyUSB0', '/dev/ttyUSB1'];

    ports.forEach((port, index) => {
      controllers[port] = {
        get status() {
          return {
            port: port,
            index: index,
          };
        },
      };
    });

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return controllers;
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 3, 'should return all three controllers');
    // Verify the order matches Object.keys() iteration order
    const returnedPorts = res.body.map((c) => c.port);
    subt.same(returnedPorts, ports, 'should preserve store iteration order');
    subt.end();
  });

  t.test('GET /api/controllers - handles empty sockets array', (subt) => {
    const mockController = {
      get status() {
        return {
          port: '/dev/ttyUSB0',
          sockets: [],
          ready: false,
          controller: { type: 'Grbl' },
        };
      },
    };

    const mockStore = {
      get: (key) => {
        if (key === 'controllers') {
          return {
            '/dev/ttyUSB0': mockController,
          };
        }
        return undefined;
      },
    };

    const apiControllers = proxyquire('../../src/server/api/api.controllers.js', {
      '../store': {
        default: mockStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiControllers.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.length, 1, 'should return one controller');
    subt.same(res.body[0].sockets, [], 'should preserve empty sockets array');
    subt.end();
  });

  t.end();
});
