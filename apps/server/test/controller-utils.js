import { test } from 'tap';
import {
  replaceM6,
  replaceCommands,
  isM0,
  isM1,
  isM6,
  isM109,
  isM190
} from '../src/controllers/utils/gcode';

test('replaceM6Commands', (t) => {
  t.test('replaces M6 commands with parentheses', t => {
    const gcode = `
      m6
      m06
      m006
      M6
      M06
      M006
      M60
      M060
      M6T1
      M6 T1
      M6 T1 ; comment
      M6T1(tool change)
      T1M6
      T1 M6
      T1M6T2
      M61Q1
      M61Q1T2M6
      M61Q1M6T2
      MM66
    `;

    const expectedOutput = `
      (m6)
      (m06)
      (m006)
      (M6)
      (M06)
      (M006)
      M60
      M060
      (M6)T1
      (M6) T1
      (M6) T1 ; comment
      (M6)T1(tool change)
      T1(M6)
      T1 (M6)
      T1(M6)T2
      M61Q1
      M61Q1T2(M6)
      M61Q1(M6)T2
      MM66
    `;

    const result = replaceM6(gcode, (x) => `(${x})`);
    t.equal(result, expectedOutput, 'should replace specified commands with parentheses');
    t.end();
  });

  t.end();
});

test('isM0', (t) => {
  t.test('returns true for M0 variations', (subt) => {
    subt.ok(isM0('M0'), 'should match M0');
    subt.ok(isM0('M00'), 'should match M00');
    subt.ok(isM0('M000'), 'should match M000');
    subt.ok(isM0('m0'), 'should match m0 (case insensitive)');
    subt.ok(isM0('m00'), 'should match m00 (case insensitive)');
    subt.ok(isM0('m000'), 'should match m000 (case insensitive)');
    subt.end();
  });

  t.test('returns false for non-M0 commands', (subt) => {
    subt.notOk(isM0('M1'), 'should not match M1');
    subt.notOk(isM0('M6'), 'should not match M6');
    subt.notOk(isM0('G0'), 'should not match G0');
    subt.notOk(isM0('M10'), 'should not match M10');
    subt.notOk(isM0('M01'), 'should not match M01');
    subt.notOk(isM0('M0 '), 'should not match M0 with trailing space');
    subt.notOk(isM0(' M0'), 'should not match M0 with leading space');
    subt.notOk(isM0('M0T1'), 'should not match M0T1');
    subt.end();
  });

  t.end();
});

test('isM1', (t) => {
  t.test('returns true for M1 variations', (subt) => {
    subt.ok(isM1('M1'), 'should match M1');
    subt.ok(isM1('M01'), 'should match M01');
    subt.ok(isM1('M001'), 'should match M001');
    subt.ok(isM1('m1'), 'should match m1 (case insensitive)');
    subt.ok(isM1('m01'), 'should match m01 (case insensitive)');
    subt.ok(isM1('m001'), 'should match m001 (case insensitive)');
    subt.end();
  });

  t.test('returns false for non-M1 commands', (subt) => {
    subt.notOk(isM1('M0'), 'should not match M0');
    subt.notOk(isM1('M6'), 'should not match M6');
    subt.notOk(isM1('G1'), 'should not match G1');
    subt.notOk(isM1('M11'), 'should not match M11');
    subt.notOk(isM1('M10'), 'should not match M10');
    subt.notOk(isM1('M1 '), 'should not match M1 with trailing space');
    subt.notOk(isM1(' M1'), 'should not match M1 with leading space');
    subt.notOk(isM1('M1T1'), 'should not match M1T1');
    subt.end();
  });

  t.end();
});

test('isM6', (t) => {
  t.test('returns true for M6 variations', (subt) => {
    subt.ok(isM6('M6'), 'should match M6');
    subt.ok(isM6('M06'), 'should match M06');
    subt.ok(isM6('M006'), 'should match M006');
    subt.ok(isM6('m6'), 'should match m6 (case insensitive)');
    subt.ok(isM6('m06'), 'should match m06 (case insensitive)');
    subt.ok(isM6('m006'), 'should match m006 (case insensitive)');
    subt.end();
  });

  t.test('returns false for non-M6 commands', (subt) => {
    subt.notOk(isM6('M0'), 'should not match M0');
    subt.notOk(isM6('M1'), 'should not match M1');
    subt.notOk(isM6('G6'), 'should not match G6');
    subt.notOk(isM6('M60'), 'should not match M60');
    subt.notOk(isM6('M61'), 'should not match M61');
    subt.notOk(isM6('M6 '), 'should not match M6 with trailing space');
    subt.notOk(isM6(' M6'), 'should not match M6 with leading space');
    subt.notOk(isM6('M6T1'), 'should not match M6T1');
    subt.end();
  });

  t.end();
});

test('isM109', (t) => {
  t.test('returns true for M109 variations', (subt) => {
    subt.ok(isM109('M109'), 'should match M109');
    subt.ok(isM109('M0109'), 'should match M0109');
    subt.ok(isM109('M00109'), 'should match M00109');
    subt.ok(isM109('m109'), 'should match m109 (case insensitive)');
    subt.ok(isM109('m0109'), 'should match m0109 (case insensitive)');
    subt.ok(isM109('m00109'), 'should match m00109 (case insensitive)');
    subt.end();
  });

  t.test('returns false for non-M109 commands', (subt) => {
    subt.notOk(isM109('M0'), 'should not match M0');
    subt.notOk(isM109('M1'), 'should not match M1');
    subt.notOk(isM109('M6'), 'should not match M6');
    subt.notOk(isM109('M110'), 'should not match M110');
    subt.notOk(isM109('M1090'), 'should not match M1090');
    subt.notOk(isM109('M109 '), 'should not match M109 with trailing space');
    subt.notOk(isM109(' M109'), 'should not match M109 with leading space');
    subt.notOk(isM109('M109T1'), 'should not match M109T1');
    subt.end();
  });

  t.end();
});

test('isM190', (t) => {
  t.test('returns true for M190 variations', (subt) => {
    subt.ok(isM190('M190'), 'should match M190');
    subt.ok(isM190('M0190'), 'should match M0190');
    subt.ok(isM190('M00190'), 'should match M00190');
    subt.ok(isM190('m190'), 'should match m190 (case insensitive)');
    subt.ok(isM190('m0190'), 'should match m0190 (case insensitive)');
    subt.ok(isM190('m00190'), 'should match m00190 (case insensitive)');
    subt.end();
  });

  t.test('returns false for non-M190 commands', (subt) => {
    subt.notOk(isM190('M0'), 'should not match M0');
    subt.notOk(isM190('M1'), 'should not match M1');
    subt.notOk(isM190('M6'), 'should not match M6');
    subt.notOk(isM190('M191'), 'should not match M191');
    subt.notOk(isM190('M1900'), 'should not match M1900');
    subt.notOk(isM190('M190 '), 'should not match M190 with trailing space');
    subt.notOk(isM190(' M190'), 'should not match M190 with leading space');
    subt.notOk(isM190('M190T1'), 'should not match M190T1');
    subt.end();
  });

  t.end();
});

test('replaceCommands', (t) => {
  t.test('replaces single command', (subt) => {
    const gcode = 'G0 X0 Y0\nM6 T1\nG1 X10';
    const result = replaceCommands(gcode, 'M6', () => '(TOOL_CHANGE)');
    const expected = 'G0 X0 Y0\n(TOOL_CHANGE) T1\nG1 X10';
    subt.equal(result, expected, 'should replace single command');
    subt.end();
  });

  t.test('replaces multiple commands', (subt) => {
    const gcode = 'M0\nM1\nM6\nG0';
    const result = replaceCommands(gcode, ['M0', 'M1', 'M6'], () => '(PAUSE)');
    const expected = '(PAUSE)\n(PAUSE)\n(PAUSE)\nG0';
    subt.equal(result, expected, 'should replace multiple commands');
    subt.end();
  });

  t.test('returns original gcode when no commands provided', (subt) => {
    const gcode = 'G0 X0 Y0\nM6 T1';
    const result = replaceCommands(gcode, [], () => 'replacement');
    subt.equal(result, gcode, 'should return original gcode when no commands');
    subt.end();
  });

  t.test('handles callback returning undefined', (subt) => {
    const gcode = 'G0 X0 Y0\nM6 T1\nG1 X10';
    const result = replaceCommands(gcode, 'M6', () => undefined);
    const expected = 'G0 X0 Y0\nM6 T1\nG1 X10';
    subt.equal(result, expected, 'should use original command when callback returns undefined');
    subt.end();
  });

  t.test('handles callback returning null', (subt) => {
    const gcode = 'G0 X0 Y0\nM6 T1\nG1 X10';
    const result = replaceCommands(gcode, 'M6', () => null);
    const expected = 'G0 X0 Y0\nM6 T1\nG1 X10';
    subt.equal(result, expected, 'should use original command when callback returns null');
    subt.end();
  });

  t.test('handles non-function callback', (subt) => {
    const gcode = 'G0 X0 Y0\nM6 T1\nG1 X10';
    const result = replaceCommands(gcode, 'M6', 'replacement');
    const expected = 'G0 X0 Y0\nM6 T1\nG1 X10';
    subt.equal(result, expected, 'should use original command when callback is not a function');
    subt.end();
  });

  t.test('preserves word boundaries', (subt) => {
    const gcode = 'M60\nM6 T1\nM600\nG0 M6 X10';
    const result = replaceCommands(gcode, 'M6', () => '(TOOL)');
    const expected = 'M60\n(TOOL) T1\nM600\nG0 (TOOL) X10';
    subt.equal(result, expected, 'should preserve word boundaries');
    subt.end();
  });

  t.end();
});
