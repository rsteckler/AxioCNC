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

test('TinyGRunner parse() - MotorTimeout', (t) => {
  const runner = new TinyGRunner();
  let mtValue = null;
  
  runner.on('mt', (mt) => { mtValue = mt; });
  
  // Format: {"r":{"mt":5},"f":[0,0,0]} - needs r.mt and footer with statusCode 0
  runner.parse('{"r":{"mt":5},"f":[0,0,0]}');
  t.equal(runner.state.mt, 5, 'should update state.mt');
  t.equal(mtValue, 5, 'should emit mt event');
  
  // Test when mt doesn't change (should still emit)
  runner.parse('{"r":{"mt":5},"f":[0,0,0]}');
  t.equal(runner.state.mt, 5, 'state.mt unchanged');
  
  t.end();
});

test('TinyGRunner parse() - PowerManagement', (t) => {
  const runner = new TinyGRunner();
  let pwrValue = null;
  
  runner.on('pwr', (pwr) => { pwrValue = pwr; });
  
  // Format: {"r":{"pwr":{...}},"f":[0,0,0]} - needs r.pwr and footer with statusCode 0
  runner.parse('{"r":{"pwr":{"1":1,"2":0,"3":1,"4":0}},"f":[0,0,0]}');
  t.same(runner.state.pwr, { "1": 1, "2": 0, "3": 1, "4": 0 }, 'should update state.pwr');
  t.same(pwrValue, { "1": 1, "2": 0, "3": 1, "4": 0 }, 'should emit pwr event');
  
  t.end();
});

test('TinyGRunner parse() - QueueReports', (t) => {
  const runner = new TinyGRunner();
  let qrValue = null;
  
  runner.on('qr', (data) => { qrValue = data; });
  
  runner.parse('{"qr":10,"qi":5,"qo":2}');
  t.equal(runner.state.qr, 10, 'should update state.qr');
  t.equal(runner.plannerBufferPoolSize, 10, 'should update plannerBufferPoolSize');
  t.same(qrValue, { qr: 10, qi: 5, qo: 2 }, 'should emit qr event');
  
  // Test when qr increases plannerBufferPoolSize
  runner.parse('{"qr":15,"qi":8,"qo":3}');
  t.equal(runner.plannerBufferPoolSize, 15, 'should update plannerBufferPoolSize when qr increases');
  
  t.end();
});

test('TinyGRunner parse() - StatusReports keymaps', (t) => {
  const runner = new TinyGRunner();
  let srValue = null;
  
  runner.on('sr', (sr) => { srValue = sr; });
  
  // Test stat (machineState)
  runner.parse('{"sr":{"stat":1}}');
  t.equal(runner.state.sr.machineState, 1, 'should set machineState from stat');
  
  // Test line
  runner.parse('{"sr":{"line":42}}');
  t.equal(runner.state.sr.line, 42, 'should set line');
  
  // Test vel (velocity)
  runner.parse('{"sr":{"vel":1000}}');
  t.equal(runner.state.sr.velocity, 1000, 'should set velocity from vel');
  
  // Test feed (feedrate)
  runner.parse('{"sr":{"feed":500}}');
  t.equal(runner.state.sr.feedrate, 500, 'should set feedrate from feed');
  
  t.end();
});

test('TinyGRunner parse() - StatusReports modal keymaps', (t) => {
  const runner = new TinyGRunner();
  
  // Test unit (G20/G21)
  runner.parse('{"sr":{"unit":0}}'); // G20
  t.equal(runner.state.sr.modal.units, 'G20', 'should set units to G20');
  runner.parse('{"sr":{"unit":1}}'); // G21
  t.equal(runner.state.sr.modal.units, 'G21', 'should set units to G21');
  runner.parse('{"sr":{"unit":99}}'); // Invalid
  t.equal(runner.state.sr.modal.units, '', 'should set units to empty for invalid value');
  
  // Test coor (coordinate system G53-G59)
  runner.parse('{"sr":{"coor":0}}'); // G53
  t.equal(runner.state.sr.modal.wcs, 'G53', 'should set wcs to G53');
  runner.parse('{"sr":{"coor":1}}'); // G54
  t.equal(runner.state.sr.modal.wcs, 'G54', 'should set wcs to G54');
  runner.parse('{"sr":{"coor":6}}'); // G59
  t.equal(runner.state.sr.modal.wcs, 'G59', 'should set wcs to G59');
  
  // Test momo (motion mode G0/G1/G2/G3/G80)
  runner.parse('{"sr":{"momo":0}}'); // G0
  t.equal(runner.state.sr.modal.motion, 'G0', 'should set motion to G0');
  runner.parse('{"sr":{"momo":1}}'); // G1
  t.equal(runner.state.sr.modal.motion, 'G1', 'should set motion to G1');
  runner.parse('{"sr":{"momo":2}}'); // G2
  t.equal(runner.state.sr.modal.motion, 'G2', 'should set motion to G2');
  runner.parse('{"sr":{"momo":3}}'); // G3
  t.equal(runner.state.sr.modal.motion, 'G3', 'should set motion to G3');
  runner.parse('{"sr":{"momo":4}}'); // G80
  t.equal(runner.state.sr.modal.motion, 'G80', 'should set motion to G80');
  
  // Test plan (plane G17/G18/G19)
  runner.parse('{"sr":{"plan":0}}'); // G17
  t.equal(runner.state.sr.modal.plane, 'G17', 'should set plane to G17');
  runner.parse('{"sr":{"plan":1}}'); // G18
  t.equal(runner.state.sr.modal.plane, 'G18', 'should set plane to G18');
  runner.parse('{"sr":{"plan":2}}'); // G19
  t.equal(runner.state.sr.modal.plane, 'G19', 'should set plane to G19');
  
  // Test path (path control G61/G61.1/G64)
  runner.parse('{"sr":{"path":0}}'); // G61
  t.equal(runner.state.sr.modal.path, 'G61', 'should set path to G61');
  runner.parse('{"sr":{"path":1}}'); // G61.1
  t.equal(runner.state.sr.modal.path, 'G61.1', 'should set path to G61.1');
  runner.parse('{"sr":{"path":2}}'); // G64
  t.equal(runner.state.sr.modal.path, 'G64', 'should set path to G64');
  
  // Test dist (distance mode G90/G91)
  runner.parse('{"sr":{"dist":0}}'); // G90
  t.equal(runner.state.sr.modal.distance, 'G90', 'should set distance to G90');
  runner.parse('{"sr":{"dist":1}}'); // G91
  t.equal(runner.state.sr.modal.distance, 'G91', 'should set distance to G91');
  
  // Test admo (arc distance mode G90/G91)
  runner.parse('{"sr":{"admo":0}}'); // G90
  t.equal(runner.state.sr.modal.arcdistance, 'G90', 'should set arcdistance to G90');
  runner.parse('{"sr":{"admo":1}}'); // G91
  t.equal(runner.state.sr.modal.arcdistance, 'G91', 'should set arcdistance to G91');
  
  // Test frmo (feedrate mode G93/G94/G95)
  runner.parse('{"sr":{"frmo":0}}'); // G93
  t.equal(runner.state.sr.modal.feedrate, 'G93', 'should set feedrate to G93');
  runner.parse('{"sr":{"frmo":1}}'); // G94
  t.equal(runner.state.sr.modal.feedrate, 'G94', 'should set feedrate to G94');
  runner.parse('{"sr":{"frmo":2}}'); // G95
  t.equal(runner.state.sr.modal.feedrate, 'G95', 'should set feedrate to G95');
  
  // Test tool
  runner.parse('{"sr":{"tool":5}}');
  t.equal(runner.state.sr.tool, 5, 'should set tool');
  
  t.end();
});

test('TinyGRunner parse() - StatusReports spindle keymaps', (t) => {
  const runner = new TinyGRunner();
  
  // Test spe (spindle enable) - edge-082.10
  runner.parse('{"sr":{"spe":0}}'); // Spindle off
  t.equal(runner.state.sr.modal.spindle, 'M5', 'spe=0 should set spindle to M5');
  runner.parse('{"sr":{"spe":1,"spd":0}}'); // Spindle on, direction 0 (CW)
  t.equal(runner.state.sr.modal.spindle, 'M3', 'spe=1,spd=0 should set spindle to M3');
  runner.parse('{"sr":{"spe":1,"spd":1}}'); // Spindle on, direction 1 (CCW)
  t.equal(runner.state.sr.modal.spindle, 'M4', 'spe=1,spd=1 should set spindle to M4');
  
  // Test spd (spindle direction) - edge-082.10
  runner.parse('{"sr":{"spd":0,"spe":1}}'); // Direction 0, enable on
  t.equal(runner.state.sr.modal.spindle, 'M3', 'spd=0,spe=1 should set spindle to M3');
  runner.parse('{"sr":{"spd":1,"spe":1}}'); // Direction 1, enable on
  t.equal(runner.state.sr.modal.spindle, 'M4', 'spd=1,spe=1 should set spindle to M4');
  runner.parse('{"sr":{"spd":0,"spe":0}}'); // Direction 0, enable off
  t.equal(runner.state.sr.modal.spindle, 'M5', 'spd=0,spe=0 should set spindle to M5');
  
  // Test spc (spindle control) - edge-101.03
  runner.parse('{"sr":{"spc":0}}'); // OFF
  t.equal(runner.state.sr.modal.spindle, 'M5', 'spc=0 should set spindle to M5');
  runner.parse('{"sr":{"spc":1}}'); // CW
  t.equal(runner.state.sr.modal.spindle, 'M3', 'spc=1 should set spindle to M3');
  runner.parse('{"sr":{"spc":2}}'); // CCW
  t.equal(runner.state.sr.modal.spindle, 'M4', 'spc=2 should set spindle to M4');
  
  // Test sps (spindle speed) - edge-082.10
  runner.parse('{"sr":{"sps":1000}}');
  t.equal(runner.state.sr.sps, 1000, 'should set sps');
  
  t.end();
});

test('TinyGRunner parse() - StatusReports coolant keymaps', (t) => {
  const runner = new TinyGRunner();
  
  // Test com (mist coolant) - edge-082.10
  runner.parse('{"sr":{"com":0}}'); // Coolant off
  t.equal(runner.state.sr.modal.coolant, 'M9', 'com=0 should set coolant to M9');
  runner.parse('{"sr":{"com":1}}'); // Mist on
  t.equal(runner.state.sr.modal.coolant, 'M7', 'com=1 should set coolant to M7');
  // For Mist + Flood, need to set both in same parse or set one then the other
  runner.parse('{"sr":{"cof":1}}'); // Set flood first
  runner.parse('{"sr":{"com":1}}'); // Then mist (should detect existing M8 and set to [M7,M8])
  t.same(runner.state.sr.modal.coolant, ['M7', 'M8'], 'com=1 after cof=1 should set coolant to [M7,M8]');
  
  // Test cof (flood coolant) - edge-082.10
  runner.parse('{"sr":{"cof":0}}'); // Coolant off
  t.equal(runner.state.sr.modal.coolant, 'M9', 'cof=0 should set coolant to M9');
  runner.parse('{"sr":{"cof":1}}'); // Flood on
  t.equal(runner.state.sr.modal.coolant, 'M8', 'cof=1 should set coolant to M8');
  // For Flood + Mist, need to set both
  runner.parse('{"sr":{"com":1}}'); // Set mist first
  runner.parse('{"sr":{"cof":1}}'); // Then flood (should detect existing M7 and set to [M7,M8])
  t.same(runner.state.sr.modal.coolant, ['M7', 'M8'], 'cof=1 after com=1 should set coolant to [M7,M8]');
  
  t.end();
});

test('TinyGRunner parse() - StatusReports position keymaps', (t) => {
  const runner = new TinyGRunner();
  
  // Test work position (posx, posy, posz, posa, posb, posc)
  runner.parse('{"sr":{"posx":10.5,"posy":20.5,"posz":30.5}}');
  t.equal(runner.state.sr.wpos.x, 10.5, 'should set wpos.x from posx');
  t.equal(runner.state.sr.wpos.y, 20.5, 'should set wpos.y from posy');
  t.equal(runner.state.sr.wpos.z, 30.5, 'should set wpos.z from posz');
  
  // Test machine position (mpox, mpoy, mpoz, mpoa, mpob, mpoc)
  runner.parse('{"sr":{"mpox":100.5,"mpoy":200.5,"mpoz":300.5}}');
  t.equal(runner.state.sr.mpos.x, 100.5, 'should set mpos.x from mpox');
  t.equal(runner.state.sr.mpos.y, 200.5, 'should set mpos.y from mpoy');
  t.equal(runner.state.sr.mpos.z, 300.5, 'should set mpos.z from mpoz');
  
  t.end();
});

test('TinyGRunner parse() - SystemSettings', (t) => {
  const runner = new TinyGRunner();
  let sysValue = null;
  
  runner.on('sys', (sys) => { sysValue = sys; });
  
  runner.parse('{"sys":{"fb":100,"fbs":"v1.0","fbc":"config","fv":1,"hp":2,"hv":3,"id":"board123"}}');
  t.equal(runner.settings.fb, 100, 'should update settings.fb');
  t.equal(runner.settings.fbs, 'v1.0', 'should update settings.fbs');
  t.equal(runner.settings.fbc, 'config', 'should update settings.fbc');
  t.equal(runner.settings.fv, 1, 'should update settings.fv');
  t.equal(runner.settings.hp, 2, 'should update settings.hp');
  t.equal(runner.settings.hv, 3, 'should update settings.hv');
  t.equal(runner.settings.id, 'board123', 'should update settings.id');
  t.same(sysValue, { fb: 100, fbs: 'v1.0', fbc: 'config', fv: 1, hp: 2, hv: 3, id: 'board123' }, 'should emit sys event');
  
  t.end();
});

test('TinyGRunner parse() - Overrides', (t) => {
  const runner = new TinyGRunner();
  let ovValue = null;
  
  runner.on('ov', (ov) => { ovValue = ov; });
  
  // Format: {"r":{"mfo":0.5,"mto":0.8,"sso":1.0},"f":[0,0,0]} - needs r.mfo/mto/sso and footer with statusCode 0
  runner.parse('{"r":{"mfo":0.5,"mto":0.8,"sso":1.0},"f":[0,0,0]}');
  t.equal(runner.settings.mfo, 0.5, 'should update settings.mfo');
  t.equal(runner.settings.mto, 0.8, 'should update settings.mto');
  t.equal(runner.settings.sso, 1.0, 'should update settings.sso');
  t.same(ovValue, { mfo: 0.5, mto: 0.8, sso: 1.0 }, 'should emit ov event');
  
  t.end();
});

test('TinyGRunner parse() - ReceiveReports', (t) => {
  const runner = new TinyGRunner();
  let rValue = null;
  
  runner.on('r', (r) => { rValue = r; });
  
  // Format: {"r":{"r":{...}}} or {"r":{...}} - needs r.r or r
  // Test with valid settings keys
  runner.parse('{"r":{"r":{"mfo":0.6,"mto":0.9,"sso":1.1,"fb":200}}}');
  t.equal(runner.settings.mfo, 0.6, 'should update settings.mfo from r');
  t.equal(runner.settings.mto, 0.9, 'should update settings.mto from r');
  t.equal(runner.settings.sso, 1.1, 'should update settings.sso from r');
  t.equal(runner.settings.fb, 200, 'should update settings.fb from r');
  t.same(rValue, { mfo: 0.6, mto: 0.9, sso: 1.1, fb: 200 }, 'should emit r event');
  
  // Test with invalid keys (should not update settings)
  const fbBefore = runner.settings.fb;
  runner.parse('{"r":{"r":{"invalidKey":999}}}');
  t.equal(runner.settings.fb, fbBefore, 'should not update settings with invalid keys');
  
  t.end();
});

test('TinyGRunner parse() - Footer', (t) => {
  const runner = new TinyGRunner();
  let fValue = null;
  
  runner.on('f', (f) => { fValue = f; });
  
  runner.parse('{"sr":{"stat":1},"f":[10,0,5]}');
  t.equal(runner.footer.revision, 10, 'should update footer.revision');
  t.equal(runner.footer.statusCode, 0, 'should update footer.statusCode');
  t.equal(runner.footer.rxBufferInfo, 5, 'should update footer.rxBufferInfo');
  t.same(fValue, [10, 0, 5], 'should emit f event');
  
  t.end();
});

test('TinyGRunner parse() - JSON parse errors', (t) => {
  const runner = new TinyGRunner();
  let rawEmitted = false;
  
  runner.on('raw', () => { rawEmitted = true; });
  
  // Invalid JSON (should catch and use empty object)
  runner.parse('{"invalid json}');
  t.ok(rawEmitted, 'should emit raw event even for invalid JSON');
  // Parser should handle gracefully
  
  t.end();
});

test('TinyGRunner parse() - non-JSON data', (t) => {
  const runner = new TinyGRunner();
  let rawEmitted = false;
  
  runner.on('raw', () => { rawEmitted = true; });
  
  // Data that doesn't start with {
  runner.parse('not json data');
  t.ok(rawEmitted, 'should emit raw event');
  // Should not crash, just not parse as JSON
  
  t.end();
});

test('TinyGRunner parse() - complex status report', (t) => {
  const runner = new TinyGRunner();
  
  // Test a complex status report with multiple fields
  // Note: cof:0 sets coolant to M9 (off), which overrides com:1
  runner.parse('{"sr":{"stat":1,"line":100,"vel":500,"feed":300,"unit":1,"coor":1,"momo":1,"plan":0,"path":2,"dist":0,"admo":0,"frmo":1,"tool":3,"spe":1,"spd":0,"sps":1000,"com":1,"cof":0,"posx":1.5,"posy":2.5,"posz":3.5,"mpox":10.5,"mpoy":20.5,"mpoz":30.5}}');
  
  t.equal(runner.state.sr.machineState, 1, 'should set machineState');
  t.equal(runner.state.sr.line, 100, 'should set line');
  t.equal(runner.state.sr.velocity, 500, 'should set velocity');
  t.equal(runner.state.sr.feedrate, 300, 'should set feedrate');
  t.equal(runner.state.sr.modal.units, 'G21', 'should set units');
  t.equal(runner.state.sr.modal.wcs, 'G54', 'should set wcs');
  t.equal(runner.state.sr.modal.motion, 'G1', 'should set motion');
  t.equal(runner.state.sr.modal.plane, 'G17', 'should set plane');
  t.equal(runner.state.sr.modal.path, 'G64', 'should set path');
  t.equal(runner.state.sr.modal.distance, 'G90', 'should set distance');
  t.equal(runner.state.sr.modal.arcdistance, 'G90', 'should set arcdistance');
  t.equal(runner.state.sr.modal.feedrate, 'G94', 'should set feedrate');
  t.equal(runner.state.sr.tool, 3, 'should set tool');
  t.equal(runner.state.sr.modal.spindle, 'M3', 'should set spindle');
  t.equal(runner.state.sr.sps, 1000, 'should set sps');
  // cof:0 (coolant off) overrides com:1, so coolant is M9
  t.equal(runner.state.sr.modal.coolant, 'M9', 'should set coolant (cof:0 overrides com:1)');
  t.equal(runner.state.sr.wpos.x, 1.5, 'should set wpos.x');
  t.equal(runner.state.sr.wpos.y, 2.5, 'should set wpos.y');
  t.equal(runner.state.sr.wpos.z, 3.5, 'should set wpos.z');
  t.equal(runner.state.sr.mpos.x, 10.5, 'should set mpos.x');
  t.equal(runner.state.sr.mpos.y, 20.5, 'should set mpos.y');
  t.equal(runner.state.sr.mpos.z, 30.5, 'should set mpos.z');
  
  t.end();
});
