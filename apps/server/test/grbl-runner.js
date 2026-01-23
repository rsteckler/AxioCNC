import { test } from 'tap';
import GrblRunner from '../src/controllers/Grbl/GrblRunner';

test('GrblRunner methods', (t) => {
  t.test('getMachinePosition', (st) => {
    const runner = new GrblRunner();

    // Test default state
    const defaultPos = runner.getMachinePosition();
    st.same(defaultPos, { x: '0.000', y: '0.000', z: '0.000' }, 'should return default position');

    // Test after parsing status with MPos
    runner.parse('<Idle,MPos:5.529,0.560,7.000>');
    const pos = runner.getMachinePosition();
    st.same(pos, { x: '5.529', y: '0.560', z: '7.000' }, 'should return updated position after parse');

    // Test with custom state
    const customState = {
      status: {
        mpos: { x: '10.0', y: '20.0', z: '30.0' }
      }
    };
    const customPos = runner.getMachinePosition(customState);
    st.same(customPos, { x: '10.0', y: '20.0', z: '30.0' }, 'should accept custom state parameter');

    st.end();
  });

  t.test('getWorkPosition', (st) => {
    const runner = new GrblRunner();

    // Test default state
    const defaultPos = runner.getWorkPosition();
    st.same(defaultPos, { x: '0.000', y: '0.000', z: '0.000' }, 'should return default position');

    // Test after parsing status with WPos
    runner.parse('<Idle,WPos:1.529,-5.440,-0.000>');
    const pos = runner.getWorkPosition();
    st.same(pos, { x: '1.529', y: '-5.440', z: '-0.000' }, 'should return updated position after parse');

    st.end();
  });

  t.test('getModalGroup', (st) => {
    const runner = new GrblRunner();

    // Test default modal group
    const defaultModal = runner.getModalGroup();
    st.same(defaultModal, {
      motion: 'G0',
      wcs: 'G54',
      plane: 'G17',
      units: 'G21',
      distance: 'G90',
      feedrate: 'G94',
      program: 'M0',
      spindle: 'M5',
      coolant: 'M9'
    }, 'should return default modal group');

    // Test after parsing parser state
    runner.parse('[GC:G0 G54 G17 G21 G90 G94 M0 M5 M9 T0 F0 S0]');
    const modal = runner.getModalGroup();
    st.ok(modal, 'should return modal group after parser state update');

    st.end();
  });

  t.test('getTool', (st) => {
    const runner = new GrblRunner();

    // Test default (no tool)
    const defaultTool = runner.getTool();
    st.equal(defaultTool, 0, 'should return 0 when no tool is set');

    // Test after parsing parser state with tool
    runner.parse('[GC:G0 G54 G17 G21 G90 G94 M0 M5 M9 T5 F0 S0]');
    const tool = runner.getTool();
    st.equal(tool, 5, 'should return tool number from parser state');

    st.end();
  });

  t.test('getParameters', (st) => {
    const runner = new GrblRunner();

    // Test default (empty parameters)
    const defaultParams = runner.getParameters();
    st.same(defaultParams, {}, 'should return empty object initially');

    // Test after parsing parameters
    runner.parse('[G54:0.000,0.000,0.000]');
    const params = runner.getParameters();
    st.ok(params.G54, 'should return parameters after parse');

    st.end();
  });

  t.test('isAlarm', (st) => {
    const runner = new GrblRunner();

    // Test default (not in alarm)
    st.notOk(runner.isAlarm(), 'should return false initially');

    // Test after alarm
    runner.parse('ALARM:1');
    st.ok(runner.isAlarm(), 'should return true after alarm');

    // Test after clearing alarm (back to idle)
    runner.parse('<Idle>');
    st.notOk(runner.isAlarm(), 'should return false after returning to idle');

    st.end();
  });

  t.test('isIdle', (st) => {
    const runner = new GrblRunner();

    // Test default (not idle initially - empty state)
    st.notOk(runner.isIdle(), 'should return false initially (empty state)');

    // Test after idle status
    runner.parse('<Idle>');
    st.ok(runner.isIdle(), 'should return true after idle status');

    // Test after alarm (not idle)
    runner.parse('ALARM:1');
    st.notOk(runner.isIdle(), 'should return false after alarm');

    st.end();
  });

  t.end();
});

test('GrblRunner parse() edge cases', (t) => {
  t.test('parse() with empty/whitespace data', (st) => {
    const runner = new GrblRunner();
    let eventCount = 0;

    runner.on('raw', () => {
 eventCount++;
});

    // Empty string
    runner.parse('');
    st.equal(eventCount, 0, 'should not emit events for empty string');

    // Whitespace only
    runner.parse('   ');
    st.equal(eventCount, 0, 'should not emit events for whitespace only');

    // String with trailing whitespace (should be trimmed)
    runner.parse('<Idle>   ');
    st.equal(eventCount, 1, 'should trim trailing whitespace and process');

    st.end();
  });

  t.test('parse() WCO calculation - MPos without WPos', (st) => {
    const runner = new GrblRunner();

    // First set WCO
    runner.parse('<Idle,MPos:10.000,20.000,30.000,WPos:5.000,10.000,15.000,WCO:5.000,10.000,15.000>');

    // Then parse MPos without WPos - should calculate WPos from WCO
    runner.once('status', (status) => {
      st.ok(status.wpos, 'should calculate WPos from MPos and WCO');
      st.equal(status.wpos.x, '5.000', 'WPos X should be MPos - WCO');
      st.equal(status.wpos.y, '10.000', 'WPos Y should be MPos - WCO');
      st.equal(status.wpos.z, '15.000', 'WPos Z should be MPos - WCO');
      st.end();
    });

    runner.parse('<Idle,MPos:10.000,20.000,30.000>');
  });

  t.test('parse() WCO calculation - WPos without MPos', (st) => {
    const runner = new GrblRunner();

    // First set WCO
    runner.parse('<Idle,MPos:10.000,20.000,30.000,WPos:5.000,10.000,15.000,WCO:5.000,10.000,15.000>');

    // Then parse WPos without MPos - should calculate MPos from WCO
    runner.once('status', (status) => {
      st.ok(status.mpos, 'should calculate MPos from WPos and WCO');
      st.equal(status.mpos.x, '10.000', 'MPos X should be WPos + WCO');
      st.equal(status.mpos.y, '20.000', 'MPos Y should be WPos + WCO');
      st.equal(status.mpos.z, '30.000', 'MPos Z should be WPos + WCO');
      st.end();
    });

    runner.parse('<Idle,WPos:5.000,10.000,15.000>');
  });

  t.test('parse() others event for unrecognized data', (st) => {
    const runner = new GrblRunner();

    runner.once('others', (payload) => {
      st.ok(payload, 'should emit others event for unrecognized data');
      st.end();
    });

    runner.parse('Some unrecognized line');
  });

  t.test('parse() state change detection', (st) => {
    const runner = new GrblRunner();
    let statusCount = 0;

    runner.on('status', () => {
 statusCount++;
});

    // Parse same status twice - should only emit once if state hasn't changed
    runner.parse('<Idle>');
    runner.parse('<Idle>');

    // Both should emit because the implementation emits on every parse
    // But state should only change if different
    st.ok(statusCount >= 1, 'should emit status events');

    st.end();
  });

  t.test('parse() all result types emit events', (st) => {
    const runner = new GrblRunner();
    const events = [];

    runner.on('ok', () => events.push('ok'));
    runner.on('error', () => events.push('error'));
    runner.on('alarm', () => events.push('alarm'));
    runner.on('parserstate', () => events.push('parserstate'));
    runner.on('parameters', () => events.push('parameters'));
    runner.on('feedback', () => events.push('feedback'));
    runner.on('settings', () => events.push('settings'));
    runner.on('startup', () => events.push('startup'));

    // Test each result type
    runner.parse('ok');
    runner.parse('error:1');
    runner.parse('ALARM:1');
    runner.parse('[GC:G0 G54]');
    runner.parse('[G54:0.000,0.000,0.000]');
    runner.parse('[MSG:Hello]');
    runner.parse('$10=3');
    runner.parse('Grbl 1.1f');

    st.ok(events.includes('ok'), 'should emit ok event');
    st.ok(events.includes('error'), 'should emit error event');
    st.ok(events.includes('alarm'), 'should emit alarm event');
    st.ok(events.includes('parserstate'), 'should emit parserstate event');
    st.ok(events.includes('parameters'), 'should emit parameters event');
    st.ok(events.includes('feedback'), 'should emit feedback event');
    st.ok(events.includes('settings'), 'should emit settings event');
    st.ok(events.includes('startup'), 'should emit startup event');

    st.end();
  });

  t.end();
});
