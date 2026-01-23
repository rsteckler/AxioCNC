import { test } from 'tap';
import { MachineStatusManager } from '../src/services/machinestatus/MachineStatusManager';

test('MachineStatusManager', (t) => {
  t.test('constructor - initializes with empty status map', (subt) => {
    const manager = new MachineStatusManager();
    subt.ok(manager.statusByPort instanceof Map, 'statusByPort should be a Map');
    subt.equal(manager.statusByPort.size, 0, 'statusByPort should be empty initially');
    subt.equal(manager.io, null, 'io should be null initially');
    subt.end();
  });

  t.test('inheritance - extends EventEmitter', (subt) => {
    const manager = new MachineStatusManager();
    subt.ok(typeof manager.on === 'function', 'should have EventEmitter methods');
    subt.ok(typeof manager.emit === 'function', 'should have EventEmitter methods');
    subt.end();
  });

  t.test('setIO - sets Socket.IO instance', (subt) => {
    const manager = new MachineStatusManager();
    const mockIO = { emit: () => {} };
    manager.setIO(mockIO);
    subt.equal(manager.io, mockIO, 'should set io instance');
    subt.end();
  });

  t.test('getDefaultStatus - returns default status object', (subt) => {
    const manager = new MachineStatusManager();
    const status = manager.getDefaultStatus('COM1');
    subt.ok(status, 'should return status object');
    subt.equal(status.port, 'COM1', 'should set port');
    subt.equal(status.connected, false, 'should default connected to false');
    subt.end();
  });

  t.test('getStatus - creates and returns status', (subt) => {
    const manager = new MachineStatusManager();
    const status = manager.getStatus('COM1');
    subt.ok(status, 'should return status object');
    subt.equal(status.port, 'COM1', 'should create status with correct port');
    subt.end();
  });

  t.test('computeMachineStatus - not connected', (subt) => {
    const manager = new MachineStatusManager();
    const status = { connected: false };
    const result = manager.computeMachineStatus(status);
    subt.equal(result, 'not_connected', 'should return not_connected when not connected');
    subt.end();
  });

  t.test('computeMachineStatus - alarm state', (subt) => {
    const manager = new MachineStatusManager();
    const status = {
      connected: true,
      controllerState: { activeState: 'Alarm' }
    };
    const result = manager.computeMachineStatus(status);
    subt.equal(result, 'alarm', 'should return alarm when in alarm state');
    subt.end();
  });

  t.test('computeMachineStatus - hold state', (subt) => {
    const manager = new MachineStatusManager();
    const status = {
      connected: true,
      controllerState: { activeState: 'Hold' }
    };
    const result = manager.computeMachineStatus(status);
    subt.equal(result, 'hold', 'should return hold when in hold state');
    subt.end();
  });

  t.test('computeMachineStatus - running workflow', (subt) => {
    const manager = new MachineStatusManager();
    const status = {
      connected: true,
      controllerState: { activeState: 'Idle' },
      workflowState: 'running'
    };
    const result = manager.computeMachineStatus(status);
    subt.equal(result, 'running', 'should return running when workflow is running');
    subt.end();
  });

  t.test('computeMachineStatus - connected and homed', (subt) => {
    const manager = new MachineStatusManager();
    const status = {
      connected: true,
      controllerState: { activeState: 'Idle' },
      isHomed: true
    };
    const result = manager.computeMachineStatus(status);
    subt.equal(result, 'connected_post_home', 'should return connected_post_home when homed');
    subt.end();
  });

  t.test('computeMachineStatus - connected but not homed', (subt) => {
    const manager = new MachineStatusManager();
    const status = {
      connected: true,
      controllerState: { activeState: 'Idle' },
      isHomed: false
    };
    const result = manager.computeMachineStatus(status);
    subt.equal(result, 'connected_pre_home', 'should return connected_pre_home when not homed');
    subt.end();
  });

  t.end();
});
