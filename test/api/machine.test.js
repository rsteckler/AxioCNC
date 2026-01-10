import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse } from './helpers';
import { ERR_NOT_FOUND } from '../../src/server/constants/index';

test('api.machine', (t) => {
  t.test('getStatus - returns status for specific port from query', (subt) => {
    const mockStatus = {
      port: '/dev/ttyUSB0',
      connected: true,
      controllerType: 'Grbl',
      machineStatus: 'connected_post_home',
      isHomed: true,
      isJobRunning: false,
      homingInProgress: false,
      controllerState: {
        activeState: 'Idle',
        mpos: { x: '0.000', y: '0.000', z: '0.000' },
        wpos: { x: '0.000', y: '0.000', z: '0.000' },
      },
      workflowState: 'idle',
      lastUpdate: 1704067200000,
    };

    const mockMachineStatusManager = {
      getStatusSummary: (port) => {
        subt.equal(port, '/dev/ttyUSB0', 'should call getStatusSummary with correct port');
        return mockStatus;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: { port: '/dev/ttyUSB0' },
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.status, 'should have status in response');
    subt.same(res.body.status, mockStatus, 'should return correct status');
    subt.equal(res.body.status.port, '/dev/ttyUSB0');
    subt.equal(res.body.status.connected, true);
    subt.end();
  });

  t.test('getStatus - returns status for specific port from body', (subt) => {
    const mockStatus = {
      port: '/dev/ttyUSB1',
      connected: false,
      controllerType: 'Marlin',
      machineStatus: 'not_connected',
      isHomed: false,
      isJobRunning: false,
      homingInProgress: false,
      controllerState: null,
      workflowState: null,
      lastUpdate: 1704067300000,
    };

    const mockMachineStatusManager = {
      getStatusSummary: (port) => {
        subt.equal(port, '/dev/ttyUSB1', 'should call getStatusSummary with port from body');
        return mockStatus;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: {},
      body: { port: '/dev/ttyUSB1' },
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body.status, mockStatus, 'should return status from body param');
    subt.end();
  });

  t.test('getStatus - returns 404 when port not found', (subt) => {
    const mockMachineStatusManager = {
      getStatusSummary: (port) => {
        subt.equal(port, '/dev/ttyUSB99', 'should call getStatusSummary with requested port');
        return null; // Not found
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: { port: '/dev/ttyUSB99' },
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.ok(res.body.msg, 'should have error message');
    subt.ok(res.body.msg.includes('/dev/ttyUSB99'), 'error message should include port');
    subt.end();
  });

  t.test('getStatus - returns all statuses when no port specified', (subt) => {
    const mockAllStatuses = {
      '/dev/ttyUSB0': {
        port: '/dev/ttyUSB0',
        connected: true,
        controllerType: 'Grbl',
        machineStatus: 'connected_post_home',
      },
      '/dev/ttyUSB1': {
        port: '/dev/ttyUSB1',
        connected: false,
        controllerType: 'Marlin',
        machineStatus: 'not_connected',
      },
    };

    const mockSummaries = {
      '/dev/ttyUSB0': {
        port: '/dev/ttyUSB0',
        connected: true,
        controllerType: 'Grbl',
        machineStatus: 'connected_post_home',
        isHomed: true,
        isJobRunning: false,
        homingInProgress: false,
        controllerState: { activeState: 'Idle' },
        workflowState: 'idle',
        lastUpdate: 1704067200000,
      },
      '/dev/ttyUSB1': {
        port: '/dev/ttyUSB1',
        connected: false,
        controllerType: 'Marlin',
        machineStatus: 'not_connected',
        isHomed: false,
        isJobRunning: false,
        homingInProgress: false,
        controllerState: null,
        workflowState: null,
        lastUpdate: 1704067300000,
      },
    };

    const mockMachineStatusManager = {
      getAllStatuses: () => {
        return mockAllStatuses;
      },
      getStatusSummary: (port) => {
        return mockSummaries[port] || null;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: {},
      body: {},
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.statuses, 'should have statuses in response');
    subt.equal(typeof res.body.statuses, 'object', 'statuses should be an object');
    subt.equal(Object.keys(res.body.statuses).length, 2, 'should return 2 statuses');
    subt.same(res.body.statuses['/dev/ttyUSB0'], mockSummaries['/dev/ttyUSB0']);
    subt.same(res.body.statuses['/dev/ttyUSB1'], mockSummaries['/dev/ttyUSB1']);
    subt.end();
  });

  t.test('getStatus - returns empty statuses object when no machines', (subt) => {
    const mockMachineStatusManager = {
      getAllStatuses: () => {
        return {};
      },
      getStatusSummary: () => {
        return null;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: {},
      body: {},
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.statuses, 'should have statuses in response');
    subt.same(res.body.statuses, {}, 'should return empty object when no machines');
    subt.end();
  });

  t.test('getStatus - handles empty string port as no port', (subt) => {
    const mockMachineStatusManager = {
      getAllStatuses: () => {
        return {};
      },
      getStatusSummary: () => {
        return null;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: { port: '' },
      body: {},
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    // Empty string should be treated as no port (falls through to getAllStatuses)
    subt.equal(res.statusCode, 200);
    subt.ok(res.body.statuses, 'should return all statuses when port is empty string');
    subt.end();
  });

  t.test('getStatus - handles port with null controllerState and workflowState', (subt) => {
    const mockStatus = {
      port: '/dev/ttyACM0',
      connected: true,
      controllerType: 'Smoothie',
      machineStatus: 'connected_pre_home',
      isHomed: false,
      isJobRunning: false,
      homingInProgress: true,
      controllerState: null,
      workflowState: null,
      lastUpdate: 1704067400000,
    };

    const mockMachineStatusManager = {
      getStatusSummary: (port) => {
        return mockStatus;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: { port: '/dev/ttyACM0' },
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.status.controllerState, null, 'should handle null controllerState');
    subt.equal(res.body.status.workflowState, null, 'should handle null workflowState');
    subt.equal(res.body.status.homingInProgress, true);
    subt.end();
  });

  t.test('getStatus - handles all machine status types', (subt) => {
    const statusTypes = [
      'not_connected',
      'connected_pre_home',
      'connected_post_home',
      'alarm',
      'running',
      'hold',
    ];

    statusTypes.forEach((machineStatus, index) => {
      const mockStatus = {
        port: `/dev/ttyUSB${index}`,
        connected: machineStatus !== 'not_connected',
        controllerType: 'Grbl',
        machineStatus: machineStatus,
        isHomed: machineStatus === 'connected_post_home',
        isJobRunning: machineStatus === 'running',
        homingInProgress: false,
        controllerState: { activeState: machineStatus === 'running' ? 'Run' : 'Idle' },
        workflowState: machineStatus === 'running' ? 'running' : 'idle',
        lastUpdate: 1704067500000 + index,
      };

      const mockMachineStatusManager = {
        getStatusSummary: (port) => {
          return mockStatus;
        },
      };

      const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
        '../services/machinestatus/MachineStatusManager': {
          default: mockMachineStatusManager,
        },
      });

      const req = createMockRequest({
        query: { port: `/dev/ttyUSB${index}` },
      });
      const res = createMockResponse();

      apiMachine.getStatus(req, res);

      subt.equal(res.statusCode, 200, `should return 200 for ${machineStatus}`);
      subt.equal(res.body.status.machineStatus, machineStatus, `should have correct machineStatus: ${machineStatus}`);
    });

    subt.end();
  });

  t.test('getStatus - handles error from getStatusSummary', (subt) => {
    const mockMachineStatusManager = {
      getStatusSummary: (port) => {
        throw new Error('Database connection failed');
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: { port: '/dev/ttyUSB0' },
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 500);
    subt.ok(res.body.msg, 'should have error message');
    subt.equal(res.body.msg, 'Failed to get machine status');
    subt.ok(res.body.err, 'should have error details');
    subt.equal(res.body.err, 'Database connection failed');
    subt.end();
  });

  t.test('getStatus - handles error from getAllStatuses', (subt) => {
    const mockMachineStatusManager = {
      getAllStatuses: () => {
        throw new Error('Memory allocation error');
      },
      getStatusSummary: () => {
        return null;
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: {},
      body: {},
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 500);
    subt.equal(res.body.msg, 'Failed to get machine status');
    subt.equal(res.body.err, 'Memory allocation error');
    subt.end();
  });

  t.test('getStatus - prioritizes query port over body port', (subt) => {
    const mockMachineStatusManager = {
      getStatusSummary: (port) => {
        // Should receive query port, not body port
        subt.equal(port, '/dev/ttyUSB0', 'should use query port, not body port');
        return {
          port: '/dev/ttyUSB0',
          connected: true,
          controllerType: 'Grbl',
          machineStatus: 'connected_post_home',
          isHomed: true,
          isJobRunning: false,
          homingInProgress: false,
          controllerState: { activeState: 'Idle' },
          workflowState: 'idle',
          lastUpdate: 1704067600000,
        };
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: { port: '/dev/ttyUSB0' },
      body: { port: '/dev/ttyUSB1' }, // This should be ignored
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.status.port, '/dev/ttyUSB0');
    subt.end();
  });

  t.test('getStatus - handles getStatusSummary returning null in getAllStatuses loop', (subt) => {
    // Test case where getAllStatuses returns ports but getStatusSummary returns null for some
    const mockAllStatuses = {
      '/dev/ttyUSB0': { port: '/dev/ttyUSB0', connected: true },
      '/dev/ttyUSB1': { port: '/dev/ttyUSB1', connected: false },
    };

    const mockMachineStatusManager = {
      getAllStatuses: () => {
        return mockAllStatuses;
      },
      getStatusSummary: (port) => {
        // Return null for one port to test the loop handles it
        if (port === '/dev/ttyUSB1') {
          return null;
        }
        return {
          port: '/dev/ttyUSB0',
          connected: true,
          controllerType: 'Grbl',
          machineStatus: 'connected_post_home',
          isHomed: true,
          isJobRunning: false,
          homingInProgress: false,
          controllerState: { activeState: 'Idle' },
          workflowState: 'idle',
          lastUpdate: 1704067700000,
        };
      },
    };

    const apiMachine = proxyquire('../../src/server/api/api.machine.js', {
      '../services/machinestatus/MachineStatusManager': {
        default: mockMachineStatusManager,
      },
    });

    const req = createMockRequest({
      query: {},
      body: {},
    });
    const res = createMockResponse();

    apiMachine.getStatus(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.statuses, 'should have statuses');
    subt.equal(res.body.statuses['/dev/ttyUSB0'].port, '/dev/ttyUSB0');
    subt.equal(res.body.statuses['/dev/ttyUSB1'], null, 'should have null for port with no summary');
    subt.end();
  });

  t.end();
});
