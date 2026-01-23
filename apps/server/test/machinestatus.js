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

  t.end();
});
