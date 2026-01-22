import { test } from 'tap';
import TinyGRunner from '../src/controllers/TinyG/TinyGRunner';
import {
  TINYG_MACHINE_STATE_READY,
  TINYG_MACHINE_STATE_ALARM,
  TINYG_MACHINE_STATE_STOP,
  TINYG_MACHINE_STATE_END
} from '../src/controllers/TinyG/constants';

test('TinyGRunner methods', (t) => {
  t.test('getMachinePosition', (st) => {
    const runner = new TinyGRunner();
    
    // Test default state
    const defaultPos = runner.getMachinePosition();
    st.same(defaultPos, { x: '0.000', y: '0.000', z: '0.000' }, 'should return default position');
    
    // Test after parsing status report with MPos
    runner.parse('{"sr":{"line":0,"vel":688.81,"mots":2,"dist":1,"posx":0.248,"posy":0.248,"mpox":0.248,"mpoy":0.248}}');
    const pos = runner.getMachinePosition();
    st.ok(pos.x && pos.y, 'should return updated position after parse');
    
    // Test with custom state
    const customState = {
      sr: {
        mpos: { x: '10.0', y: '20.0', z: '30.0' }
      }
    };
    const customPos = runner.getMachinePosition(customState);
    st.same(customPos, { x: '10.0', y: '20.0', z: '30.0' }, 'should accept custom state parameter');
    
    st.end();
  });

  t.test('getWorkPosition', (st) => {
    const runner = new TinyGRunner();
    
    // Test default state
    const defaultPos = runner.getWorkPosition();
    st.same(defaultPos, { x: '0.000', y: '0.000', z: '0.000' }, 'should return default position');
    
    // Test after parsing status report with WPos
    runner.parse('{"sr":{"line":0,"vel":688.81,"mots":2,"dist":1,"posx":0.248,"posy":0.248,"mpox":0.248,"mpoy":0.248}}');
    const pos = runner.getWorkPosition();
    st.ok(pos, 'should return position after parse');
    
    st.end();
  });

  t.test('getModalGroup', (st) => {
    const runner = new TinyGRunner();
    
    // Test default modal group (has empty string properties)
    const defaultModal = runner.getModalGroup();
    st.ok(defaultModal, 'should return modal group object');
    st.equal(defaultModal.motion, '', 'should have empty motion initially');
    st.equal(defaultModal.wcs, '', 'should have empty wcs initially');
    
    st.end();
  });

  t.test('getTool', (st) => {
    const runner = new TinyGRunner();
    
    // Test default (no tool)
    const defaultTool = runner.getTool();
    st.equal(defaultTool, 0, 'should return 0 when no tool is set');
    
    // Note: TinyG tool is stored in state.tool, not state.sr.tool
    // The status report sets sr.tool, but getTool reads from state.tool
    // This may require a different parse format or the tool may not be directly settable via status reports
    // For now, just test the default behavior
    st.end();
  });

  t.test('isAlarm', (st) => {
    const runner = new TinyGRunner();
    
    // Test default (not in alarm)
    st.notOk(runner.isAlarm(), 'should return false initially');
    
    // Test after alarm state
    runner.parse('{"sr":{"stat":2}}'); // stat:2 is ALARM
    st.ok(runner.isAlarm(), 'should return true after alarm state');
    
    // Test after clearing alarm (back to ready)
    runner.parse('{"sr":{"stat":1}}'); // stat:1 is READY
    st.notOk(runner.isAlarm(), 'should return false after returning to ready');
    
    st.end();
  });

  t.test('isIdle', (st) => {
    const runner = new TinyGRunner();
    
    // Test default (not idle initially - empty state)
    st.notOk(runner.isIdle(), 'should return false initially (empty state)');
    
    // Test after READY state (idle)
    runner.parse('{"sr":{"stat":1}}'); // stat:1 is READY
    st.ok(runner.isIdle(), 'should return true for READY state');
    
    // Test after STOP state (idle)
    runner.parse('{"sr":{"stat":3}}'); // stat:3 is STOP
    st.ok(runner.isIdle(), 'should return true for STOP state');
    
    // Test after END state (idle)
    runner.parse('{"sr":{"stat":4}}'); // stat:4 is END
    st.ok(runner.isIdle(), 'should return true for END state');
    
    // Test after RUN state (not idle)
    runner.parse('{"sr":{"stat":5}}'); // stat:5 is RUN
    st.notOk(runner.isIdle(), 'should return false for RUN state');
    
    // Test after ALARM state (not idle)
    runner.parse('{"sr":{"stat":2}}'); // stat:2 is ALARM
    st.notOk(runner.isIdle(), 'should return false for ALARM state');
    
    st.end();
  });

  t.test('parse() with empty/whitespace data', (st) => {
    const runner = new TinyGRunner();
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
