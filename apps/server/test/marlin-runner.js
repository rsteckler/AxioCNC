import { test } from 'tap';
import MarlinRunner from '../src/controllers/Marlin/MarlinRunner';

test('MarlinRunner methods', (t) => {
  t.test('getPosition', (st) => {
    const runner = new MarlinRunner();

    // Test default state
    const defaultPos = runner.getPosition();
    st.same(defaultPos, { x: '0.000', y: '0.000', z: '0.000', e: '0.000' }, 'should return default position');

    // Test after parsing position
    runner.parse('X:10.000 Y:20.000 Z:30.000 E:5.000');
    const pos = runner.getPosition();
    st.ok(pos.x && pos.y && pos.z, 'should return updated position after parse');

    // Test with custom state
    const customState = {
      pos: { x: '15.0', y: '25.0', z: '35.0', e: '10.0' }
    };
    const customPos = runner.getPosition(customState);
    st.same(customPos, { x: '15.0', y: '25.0', z: '35.0', e: '10.0' }, 'should accept custom state parameter');

    st.end();
  });

  t.test('getModalGroup', (st) => {
    const runner = new MarlinRunner();

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
    const runner = new MarlinRunner();

    // MarlinRunner.getTool() always returns 0 (not supported)
    const tool = runner.getTool();
    st.equal(tool, 0, 'should always return 0 (not supported in Marlin)');

    st.end();
  });

  t.test('isAlarm', (st) => {
    const runner = new MarlinRunner();

    // MarlinRunner.isAlarm() always returns false (not supported)
    st.notOk(runner.isAlarm(), 'should always return false (not supported in Marlin)');

    st.end();
  });

  t.test('isIdle', (st) => {
    const runner = new MarlinRunner();

    // MarlinRunner.isIdle() always returns false (not supported)
    st.notOk(runner.isIdle(), 'should always return false (not supported in Marlin)');

    st.end();
  });

  t.test('parse() with empty/whitespace data', (st) => {
    const runner = new MarlinRunner();
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

    st.end();
  });

  t.test('parse - unrecognized responses', (st) => {
    const runner = new MarlinRunner();
    let othersEmitted = false;
    let othersPayload = null;

    runner.on('others', (payload) => {
      othersEmitted = true;
      othersPayload = payload;
    });

    // Send a response that doesn't match any known MarlinLineParserResult type
    // but still has content to trigger the fallback branch
    runner.parse('UNKNOWN:some data here');

    st.ok(othersEmitted, 'should emit others event for unrecognized responses');
    st.ok(othersPayload, 'should pass payload to others event');

    st.end();
  });

  t.end();
});
