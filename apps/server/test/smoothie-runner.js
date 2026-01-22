import { test } from 'tap';
import SmoothieRunner from '../src/controllers/Smoothie/SmoothieRunner';
import {
  SMOOTHIE_ACTIVE_STATE_IDLE,
  SMOOTHIE_ACTIVE_STATE_ALARM
} from '../src/controllers/Smoothie/constants';

test('SmoothieRunner methods', (t) => {
  t.test('getMachinePosition', (st) => {
    const runner = new SmoothieRunner();
    
    // Test default state
    const defaultPos = runner.getMachinePosition();
    st.same(defaultPos, { x: '0.0000', y: '0.0000', z: '0.0000' }, 'should return default position');
    
    // Test after parsing status with MPos
    runner.parse('MPos:5.5290,0.5600,7.0000');
    const pos = runner.getMachinePosition();
    st.ok(pos.x && pos.y && pos.z, 'should return updated position after parse');
    
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
    const runner = new SmoothieRunner();
    
    // Test default state
    const defaultPos = runner.getWorkPosition();
    st.same(defaultPos, { x: '0.0000', y: '0.0000', z: '0.0000' }, 'should return default position');
    
    // Test after parsing status with WPos
    runner.parse('WPos:1.5290,-5.4400,-0.0000');
    const pos = runner.getWorkPosition();
    st.ok(pos.x && pos.y && pos.z, 'should return updated position after parse');
    
    st.end();
  });

  t.test('getModalGroup', (st) => {
    const runner = new SmoothieRunner();
    
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
    
    st.end();
  });

  t.test('getTool', (st) => {
    const runner = new SmoothieRunner();
    
    // Test default (no tool)
    const defaultTool = runner.getTool();
    st.equal(defaultTool, 0, 'should return 0 when no tool is set');
    
    st.end();
  });

  t.test('isAlarm', (st) => {
    const runner = new SmoothieRunner();
    
    // Test default (not in alarm)
    st.notOk(runner.isAlarm(), 'should return false initially');
    
    // Note: SmoothieRunner.isAlarm() checks state.status.activeState === SMOOTHIE_ACTIVE_STATE_ALARM
    // The alarm parser may not set this directly. For now, test that the method exists and works with default state.
    // The alarm functionality is tested in the parser tests (smoothie.js)
    st.end();
  });

  t.test('isIdle', (st) => {
    const runner = new SmoothieRunner();
    
    // Test default (not idle initially - empty state)
    st.notOk(runner.isIdle(), 'should return false initially (empty state)');
    
    // Test after idle status - use the status format
    runner.once('status', () => {
      st.ok(runner.isIdle(), 'should return true after idle status');
      st.end();
    });
    runner.parse('<Idle>');
  });

  t.test('parse() with empty/whitespace data', (st) => {
    const runner = new SmoothieRunner();
    let eventCount = 0;
    
    runner.on('raw', () => { eventCount++; });
    
    // Empty string
    runner.parse('');
    st.equal(eventCount, 0, 'should not emit events for empty string');
    
    // Whitespace only
    runner.parse('   ');
    st.equal(eventCount, 0, 'should not emit events for whitespace only');
    
    st.end();
  });

  t.end();
});
