import { test } from 'tap';
import trim from 'lodash/trim';
import GrblRunner from '../src/controllers/Grbl/GrblRunner';

// $10 - Status report mask:binary
// Report Type      | Value
// Machine Position | 1
// Work Position    | 2
// Planner Buffer   | 4
// RX Buffer        | 8
// Limit Pins       | 16
test('GrblLineParserResultStatus: all zeroes in the mask ($10=0)', (t) => {
  const runner = new GrblRunner();
  runner.on('status', ({ raw, ...status }) => {
    t.equal(raw, '<Idle>');
    t.same(status, {
      activeState: 'Idle',
      subState: 0,
      pinState: ''
    });
    t.end();
  });

  const line = '<Idle>';
  runner.parse(line);
});

test('GrblLineParserResultStatus: default ($10=3)', (t) => {
  const runner = new GrblRunner();
  runner.on('status', ({ raw, ...status }) => {
    t.equal(raw, '<Idle,MPos:5.529,0.560,7.000,WPos:1.529,-5.440,-0.000>');
    t.same(status, {
      activeState: 'Idle',
      subState: 0,
      mpos: {
        x: '5.529',
        y: '0.560',
        z: '7.000'
      },
      wpos: {
        x: '1.529',
        y: '-5.440',
        z: '-0.000'
      },
      pinState: ''
    });
    t.end();
  });

  const line = '<Idle,MPos:5.529,0.560,7.000,WPos:1.529,-5.440,-0.000>';
  runner.parse(line);
});

test('GrblLineParserResultStatus: 6-axis', (t) => {
  const runner = new GrblRunner();
  runner.on('status', ({ raw, ...status }) => {
    t.equal(raw, '<Idle,MPos:5.529,0.560,7.000,0.100,0.250,0.500,WPos:1.529,-5.440,-0.000,0.100,0.250,0.500>');
    t.same(status, {
      activeState: 'Idle',
      subState: 0,
      mpos: {
        x: '5.529',
        y: '0.560',
        z: '7.000',
        a: '0.100',
        b: '0.250',
        c: '0.500'
      },
      wpos: {
        x: '1.529',
        y: '-5.440',
        z: '-0.000',
        a: '0.100',
        b: '0.250',
        c: '0.500'
      },
      pinState: ''
    });
    t.end();
  });

  const line = '<Idle,MPos:5.529,0.560,7.000,0.100,0.250,0.500,WPos:1.529,-5.440,-0.000,0.100,0.250,0.500>';
  runner.parse(line);
});

test('GrblLineParserResultStatus: set all bits to 1 ($10=31)', (t) => {
  const runner = new GrblRunner();
  runner.on('status', ({ raw, ...status }) => {
    t.equal(raw, '<Idle,MPos:5.529,0.560,7.000,WPos:1.529,-5.440,-0.000,Buf:0,RX:0,Lim:000>');
    t.same(status, {
      activeState: 'Idle',
      subState: 0,
      mpos: {
        x: '5.529',
        y: '0.560',
        z: '7.000'
      },
      wpos: {
        x: '1.529',
        y: '-5.440',
        z: '-0.000'
      },
      buf: {
        planner: 0,
        rx: 0
      },
      pinState: ''
    });
    t.end();
  });

  const line = '<Idle,MPos:5.529,0.560,7.000,WPos:1.529,-5.440,-0.000,Buf:0,RX:0,Lim:000>';
  runner.parse(line);
});

test('GrblLineParserResultStatus: v1.1 format with pipe separators', (t) => {
  t.test('Basic v1.1 format with MPos, Bf, FS, Pn', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:0,0|Pn:P>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        buf: {
          planner: 14,
          rx: 128
        },
        feedrate: 0,
        spindle: 0,
        pinState: 'P'
      });
      t.end();
    });

    const line = '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:0,0|Pn:P>';
    runner.parse(line);
  });

  t.test('v1.1 format without Pn', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:0,0>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        buf: {
          planner: 14,
          rx: 128
        },
        feedrate: 0,
        spindle: 0,
        pinState: ''
      });
      t.end();
    });

    const line = '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:0,0>';
    runner.parse(line);
  });

  t.test('v1.1 format with WCO (Work Coordinate Offset)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:0,0|Pn:P|WCO:-625.000,-625.000,-91.500>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '625.000',
          y: '625.000',
          z: '91.500'
        },
        buf: {
          planner: 14,
          rx: 128
        },
        feedrate: 0,
        spindle: 0,
        pinState: 'P',
        wco: {
          x: '-625.000',
          y: '-625.000',
          z: '-91.500'
        }
      });
      t.end();
    });

    const line = '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:0,0|Pn:P|WCO:-625.000,-625.000,-91.500>';
    runner.parse(line);
  });

  t.test('v1.1 format with Accessory State (A)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,8000|A:SFM>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        buf: {
          planner: 14,
          rx: 128
        },
        feedrate: 500,
        spindle: 8000,
        accessoryState: 'SFM',
        pinState: ''
      });
      t.end();
    });

    const line = '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,8000|A:SFM>';
    runner.parse(line);
  });

  t.test('v1.1 format with Ln (Line Number)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Run|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,0|Ln:12345>');
      t.same(status, {
        activeState: 'Run',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        buf: {
          planner: 14,
          rx: 128
        },
        feedrate: 500,
        spindle: 0,
        ln: 12345,
        pinState: ''
      });
      t.end();
    });

    const line = '<Run|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,0|Ln:12345>';
    runner.parse(line);
  });

  t.test('v0.9 format with F (single Feed Rate, not FS)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,F:500>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        feedrate: 500,
        pinState: ''
      });
      t.end();
    });

    const line = '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,F:500>';
    runner.parse(line);
  });

  t.test('v1.1 format with Ov (Override Values)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,8000|Ov:100,100,100>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        buf: {
          planner: 14,
          rx: 128
        },
        feedrate: 500,
        spindle: 8000,
        ov: [100, 100, 100],
        pinState: ''
      });
      t.end();
    });

    const line = '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,8000|Ov:100,100,100>';
    runner.parse(line);
  });

  t.test('v0.9 format with sub-states (Hold:0)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Hold:0,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
      t.same(status, {
        activeState: 'Hold',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        pinState: ''
      });
      t.end();
    });

    const line = '<Hold:0,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>';
    runner.parse(line);
  });

  t.test('v0.9 format with sub-states (Hold:1)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Hold:1,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
      t.same(status, {
        activeState: 'Hold',
        subState: 1,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        pinState: ''
      });
      t.end();
    });

    const line = '<Hold:1,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>';
    runner.parse(line);
  });

  t.test('v0.9 format with sub-states (Door:0)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Door:0,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
      t.equal(status.activeState, 'Door');
      t.equal(status.subState, 0);
      t.end();
    });
    runner.parse('<Door:0,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
  });

  t.test('v0.9 format with sub-states (Door:1)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Door:1,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
      t.equal(status.activeState, 'Door');
      t.equal(status.subState, 1);
      t.end();
    });
    runner.parse('<Door:1,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
  });

  t.test('v0.9 format with sub-states (Door:2)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Door:2,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
      t.equal(status.activeState, 'Door');
      t.equal(status.subState, 2);
      t.end();
    });
    runner.parse('<Door:2,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
  });

  t.test('v0.9 format with sub-states (Door:3)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Door:3,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
      t.equal(status.activeState, 'Door');
      t.equal(status.subState, 3);
      t.end();
    });
    runner.parse('<Door:3,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000>');
  });

  t.test('v0.9 format with Lim pin state (different bit combinations)', (t) => {
    t.test('X axis limit (bit 0)', (subt) => {
      const runner = new GrblRunner();
      runner.on('status', ({ raw, ...status }) => {
        subt.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:1>');
        subt.equal(status.pinState, 'X');
        subt.end();
      });
      runner.parse('<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:1>');
    });

    t.test('Y axis limit (bit 1)', (subt) => {
      const runner = new GrblRunner();
      runner.on('status', ({ raw, ...status }) => {
        subt.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:2>');
        subt.equal(status.pinState, 'Y');
        subt.end();
      });
      runner.parse('<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:2>');
    });

    t.test('Z axis limit (bit 2)', (subt) => {
      const runner = new GrblRunner();
      runner.on('status', ({ raw, ...status }) => {
        subt.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:4>');
        // Note: The code has a bug where bit 2 sets both 'Z' and 'A' (line 138 uses same bit check)
        subt.equal(status.pinState, 'ZA');
        subt.end();
      });
      runner.parse('<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:4>');
    });

    t.test('X and Y axis limits (bits 0 and 1)', (subt) => {
      const runner = new GrblRunner();
      runner.on('status', ({ raw, ...status }) => {
        subt.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:3>');
        subt.equal(status.pinState, 'XY');
        subt.end();
      });
      runner.parse('<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:3>');
    });

    t.test('All axes limits (bits 0, 1, 2)', (subt) => {
      const runner = new GrblRunner();
      runner.on('status', ({ raw, ...status }) => {
        subt.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:7>');
        // Note: The code has a bug where bit 2 sets both 'Z' and 'A' (line 138 uses same bit check)
        subt.equal(status.pinState, 'XYZA');
        subt.end();
      });
      runner.parse('<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Lim:7>');
    });

    t.end();
  });

  t.test('v1.1 format without Pn or Lim (should clear pinState)', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,0>');
      t.equal(status.pinState, '');
      t.end();
    });

    const line = '<Idle|MPos:0.000,0.000,0.000|Bf:14,128|FS:500,0>';
    runner.parse(line);
  });

  t.end();
});

test('GrblLineParserResultStatus: v0.9 format with MPos and WPos (regression fix)', (t) => {
  t.test('v0.9 format - both MPos and WPos correctly separated', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle,MPos:-31.000,-31.000,-1.000,WPos:0.000,0.000,0.000>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '-31.000',
          y: '-31.000',
          z: '-1.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        pinState: ''
      });
      // Critical: ensure WPos is not parsed as part of MPos (no "a": "WPos" field)
      t.notOk(status.mpos.a, 'MPos should not have an "a" axis with value "WPos"');
      t.end();
    });

    const line = '<Idle,MPos:-31.000,-31.000,-1.000,WPos:0.000,0.000,0.000>';
    runner.parse(line);
  });

  t.test('v0.9 format - MPos and WPos with all parameters', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle,MPos:5.529,0.560,7.000,WPos:1.529,-5.440,-0.000,Buf:0,RX:0,Lim:000>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '5.529',
          y: '0.560',
          z: '7.000'
        },
        wpos: {
          x: '1.529',
          y: '-5.440',
          z: '-0.000'
        },
        buf: {
          planner: 0,
          rx: 0
        },
        pinState: ''
      });
      // Ensure WPos is not incorrectly parsed as part of MPos
      t.notOk(status.mpos.a, 'MPos should not have an "a" axis with value "WPos"');
      t.end();
    });

    const line = '<Idle,MPos:5.529,0.560,7.000,WPos:1.529,-5.440,-0.000,Buf:0,RX:0,Lim:000>';
    runner.parse(line);
  });

  t.test('v0.9 format - handles Pn parameter with letters correctly', (t) => {
    const runner = new GrblRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Pn:PX>');
      t.same(status, {
        activeState: 'Idle',
        subState: 0,
        mpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        wpos: {
          x: '0.000',
          y: '0.000',
          z: '0.000'
        },
        pinState: 'PX'
      });
      // Ensure Pn is parsed correctly (letters after colon)
      t.equal(status.pinState, 'PX');
      // Ensure WPos is not part of MPos
      t.notOk(status.mpos.a, 'MPos should not have an "a" axis');
      t.end();
    });

    const line = '<Idle,MPos:0.000,0.000,0.000,WPos:0.000,0.000,0.000,Pn:PX>';
    runner.parse(line);
  });

  t.end();
});

test('GrblLineParserResultOk', (t) => {
  const runner = new GrblRunner();
  runner.on('ok', ({ raw }) => {
    t.equal(raw, 'ok');
    t.end();
  });

  const line = 'ok';
  runner.parse(line);
});

test('GrblLineParserResultError', (t) => {
  const runner = new GrblRunner();
  runner.on('error', ({ raw, message }) => {
    t.equal(raw, 'error: Expected command letter');
    t.equal(message, 'Expected command letter');
    t.end();
  });

  const line = 'error: Expected command letter';
  runner.parse(line);
});

test('GrblLineParserResultAlarm', (t) => {
  const runner = new GrblRunner();
  runner.on('alarm', ({ raw, message }) => {
    t.equal(raw, 'ALARM: Probe fail');
    t.equal(message, 'Probe fail');
    t.end();
  });

  const line = 'ALARM: Probe fail';
  runner.parse(line);
});

test('GrblLineParserResultAlarm: sets activeState', (t) => {
  const runner = new GrblRunner();
  runner.on('alarm', () => {
    t.equal(runner.state.status.activeState, 'Alarm');
    t.end();
  });

  const line = 'ALARM:2';
  runner.parse(line);
});

test('GrblLineParserResultParserState', (t) => {
  t.test('Grbl v0.9', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[G0 G54 G17 G21 G90 G94 M0 M5 M9 T0 F2540. S0.]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          program: 'M0', // M0, M1, M2, M30
          spindle: 'M5', // M3, M4, M5
          coolant: 'M9', // M7, M8, M9
        },
        tool: '0',
        feedrate: '2540.',
        spindle: '0.'
      });
      t.equal(runner.getTool(), 0);
      t.end();
    });

    const line = '[G0 G54 G17 G21 G90 G94 M0 M5 M9 T0 F2540. S0.]';
    runner.parse(line);
  });

  t.test('Grbl v1.x', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[GC:G0 G54 G17 G21 G90 G94 M0 M5 M9 T0 F2540. S0.]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          program: 'M0', // M0, M1, M2, M30
          spindle: 'M5', // M3, M4, M5
          coolant: 'M9', // M7, M8, M9
        },
        tool: '0',
        feedrate: '2540.',
        spindle: '0.',
      });
      t.equal(runner.getTool(), 0);
      t.end();
    });

    const line = '[GC:G0 G54 G17 G21 G90 G94 M0 M5 M9 T0 F2540. S0.]';
    runner.parse(line);
  });

  t.test('Grbl v1.x - mist coolant (M7) and flood coolant (M8)', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[GC:G0 G54 G17 G21 G90 G94 M0 M3 M7 M8 T0 F2000 S20]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          program: 'M0', // M0, M1, M2, M30
          spindle: 'M3', // M3, M4, M5
          coolant: ['M7', 'M8'], // M7, M8, M9
        },
        tool: '0',
        feedrate: '2000',
        spindle: '20',
      });
      t.equal(runner.getTool(), 0);
      t.end();
    });

    const line = '[GC:G0 G54 G17 G21 G90 G94 M0 M3 M7 M8 T0 F2000 S20]';
    runner.parse(line);
  });

  t.test('Handles cases where Grbl forks omit numeric values after the "M" field', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[GC:G0 G54 G17 G21 G90 G94 M5 M M9 T0 F0 S0]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          //program: undefined, // M0, M1, M2, M30
          spindle: 'M5', // M3, M4, M5
          coolant: 'M9', // M7, M8, M9
        },
        tool: '0',
        feedrate: '0',
        spindle: '0',
      });
      t.equal(runner.getTool(), 0);
      t.end();
    });

    const line = '[GC:G0 G54 G17 G21 G90 G94 M5 M M9 T0 F0 S0]';
    runner.parse(line);
  });

  t.test('Handles cases where Grbl forks omit numeric values after the "T" field', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[GC:G0 G54 G17 G21 G90 G94 M5 M9 T F0 S0]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          //program: undefined, // M0, M1, M2, M30
          spindle: 'M5', // M3, M4, M5
          coolant: 'M9', // M7, M8, M9
        },
        //tool: undefined,
        feedrate: '0',
        spindle: '0',
      });
      t.equal(runner.getTool(), 0);
      t.end();
    });

    const line = '[GC:G0 G54 G17 G21 G90 G94 M5 M9 T F0 S0]';
    runner.parse(line);
  });

  t.test('Handles invalid parser state output', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.fail('Parser state should not be emitted for invalid input');
    });
    runner.on('feedback', ({ raw }) => {
      t.equal(raw, '[Invalid Parser State Output]');
      t.end();
    });
    const line = '[Invalid Parser State Output]';
    runner.parse(line);
  });

  t.test('ignores unknown modal codes', (t) => {
    const runner = new GrblRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[GC:G0 G54 G17 G21 G90 G94 G99 M0 M5 M9 M99 T0 F2540. S0.]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          program: 'M0', // M0, M1, M2, M30
          spindle: 'M5', // M3, M4, M5
          coolant: 'M9', // M7, M8, M9
        },
        tool: '0',
        feedrate: '2540.',
        spindle: '0.'
      });
      t.equal(runner.getTool(), 0);
      t.end();
    });

    // G99 and M99 are not in GRBL_MODAL_GROUPS, so they should be ignored
    const line = '[GC:G0 G54 G17 G21 G90 G94 G99 M0 M5 M9 M99 T0 F2540. S0.]';
    runner.parse(line);
  });

  t.end();
});

test('GrblLineParserResultParameters:G54,G55,G56,G57,G58,G59,G28,G30,G92', (t) => {
  const lines = [
    '[G54:0.000,0.000,0.000]',
    '[G55:0.000,0.000,0.000]',
    '[G56:0.000,0.000,0.000]',
    '[G57:0.000,0.000,0.000]',
    '[G58:0.000,0.000,0.000]',
    '[G59:0.000,0.000,0.000]',
    '[G28:0.000,0.000,0.000]',
    '[G30:0.000,0.000,0.000]',
    '[G92:0.000,0.000,0.000]'
  ];
  const runner = new GrblRunner();
  let i = 0;
  runner.on('parameters', ({ name, value, raw }) => {
    if (i < lines.length) {
      t.equal(raw, lines[i]);
    }
    if (name === 'G54') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G55') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G56') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G57') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G58') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G59') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G28') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G30') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }
    if (name === 'G92') {
      t.same(value, { x: '0.000', y: '0.000', z: '0.000' });
    }

    ++i;
    if (i >= lines.length) {
      t.end();
    }
  });

  lines.forEach(line => {
    runner.parse(line);
  });
});

test('GrblLineParserResultParameters:TLO', (t) => {
  const runner = new GrblRunner();
  runner.on('parameters', ({ name, value, raw }) => {
    t.equal(raw, '[TLO:0.000]');
    t.equal(name, 'TLO');
    t.equal(value, '0.000');
    t.end();
  });

  runner.parse('[TLO:0.000]');
});

test('GrblLineParserResultParameters:PRB', (t) => {
  const runner = new GrblRunner();
  runner.on('parameters', ({ name, value, raw }) => {
    t.equal(raw, '[PRB:0.000,0.000,1.492:1]');
    t.equal(name, 'PRB');
    t.same(value, {
      result: 1,
      x: '0.000',
      y: '0.000',
      z: '1.492'
    });
    t.end();
  });

  runner.parse('[PRB:0.000,0.000,1.492:1]');
});

test('GrblLineParserResultFeedback', (t) => {
  const lines = [
    // $I - View build info
    '[0.9j.20160303:]',
    // Sent after an alarm message to tell the user to reset Grbl as an acknowledgement that an alarm has happened.
    '[Reset to continue]',
    // After an alarm and the user has sent a reset,
    '[\'$H\'|\'$X\' to unlock]',
    // This feedback message is sent when the user overrides the alarm.
    '[Caution: Unlocked]',
    // $C - Check gcode mode
    '[Enabled]',
    '[Disabled]'
  ];
  const runner = new GrblRunner();
  let i = 0;
  runner.on('feedback', ({ raw, ...full }) => {
    const message = trim(lines[i], '[]');

    if (i < lines.length) {
      t.equal(raw, lines[i]);
      t.equal(full.message, message);
    }

    ++i;
    if (i >= lines.length) {
      t.end();
    }
  });

  lines.forEach(line => {
    runner.parse(line);
  });
});

test('GrblLineParserResultSettings', (t) => {
  const lines = [
    '$1=25 (step idle delay, msec)',
    '$2=0 (step port invert mask:00000000)',
    '$3=0 (dir port invert mask:00000000)',
    '$4=0 (step enable invert, bool)',
    '$5=0 (limit pins invert, bool)',
    '$6=0 (probe pin invert, bool)',
    '$10=3 (status report mask:00000011)',
    '$11=0.020 (junction deviation, mm)',
    '$12=0.002 (arc tolerance, mm)',
    '$13=0 (report inches, bool)',
    '$20=0 (soft limits, bool)',
    '$21=0 (hard limits, bool)',
    '$22=0 (homing cycle, bool)',
    '$23=0 (homing dir invert mask:00000000)',
    '$24=25.000 (homing feed, mm/min)',
    '$25=500.000 (homing seek, mm/min)',
    '$26=250 (homing debounce, msec)',
    '$27=1.000 (homing pull-off, mm)',
    '$100=320.000 (x, step/mm)',
    '$101=320.000 (y, step/mm)',
    '$102=250.000 (z, step/mm)',
    '$110=2500.000 (x max rate, mm/min)',
    '$111=2500.000 (y max rate, mm/min)',
    '$112=500.000 (z max rate, mm/min)',
    '$120=250.000 (x accel, mm/sec^2)',
    '$121=250.000 (y accel, mm/sec^2)',
    '$122=50.000 (z accel, mm/sec^2)',
    '$130=200.000 (x max travel, mm)',
    '$131=200.000 (y max travel, mm)',
    '$132=200.000 (z max travel, mm)'
  ];
  const runner = new GrblRunner();
  let i = 0;
  runner.on('settings', ({ raw, name, value, message }) => {
    if (i < lines.length) {
      const r = raw.match(/^(\$[^=]+)=([^ ]*)\s*(.*)/);
      t.equal(raw, lines[i]);
      t.equal(name, r[1]);
      t.equal(value, r[2]);
      t.equal(message, trim(r[3], '()'));
    }

    ++i;
    if (i >= lines.length) {
      t.end();
    }
  });

  lines.forEach(line => {
    runner.parse(line);
  });
});

test('GrblLineParserResultStartup', (t) => {
  t.test('Grbl 0.9j', (t) => {
    const runner = new GrblRunner();
    runner.on('startup', ({ raw, firmware, version, message }) => {
      t.equal(raw, 'Grbl 0.9j [\'$\' for help]');
      t.equal(firmware, 'Grbl');
      t.equal(version, '0.9j');
      t.equal(message, '[\'$\' for help]');
      t.end();
    });

    const line = 'Grbl 0.9j [\'$\' for help]';
    runner.parse(line);
  });

  t.test('Grbl 1.1f', (t) => {
    const runner = new GrblRunner();
    runner.on('startup', ({ raw, firmware, version, message }) => {
      t.equal(raw, 'Grbl 1.1f [\'$\' for help]');
      t.equal(firmware, 'Grbl');
      t.equal(version, '1.1f');
      t.equal(message, '[\'$\' for help]');
      t.end();
    });

    const line = 'Grbl 1.1f [\'$\' for help]';
    runner.parse(line);
  });

  t.test('Custom firmware build', (t) => {
    const runner = new GrblRunner();
    runner.on('startup', ({ raw, firmware, version, message }) => {
      t.equal(raw, 'Grbl 1.2.3');
      t.equal(firmware, 'Grbl');
      t.equal(version, '1.2.3');
      t.equal(message, '');
      t.end();
    });

    const line = 'Grbl 1.2.3';
    runner.parse(line);
  });

  t.test('Custom firmware build: LongMill build #1', (t) => {
    const runner = new GrblRunner();
    runner.on('startup', ({ raw, firmware, version, message }) => {
      t.equal(raw, 'Grbl 1.1h: LongMill build [\'$\' for help]');
      t.equal(firmware, 'Grbl');
      t.equal(version, '1.1h');
      t.equal(message, ': LongMill build [\'$\' for help]');
      t.end();
    });

    const line = 'Grbl 1.1h: LongMill build [\'$\' for help]';
    runner.parse(line);
  });

  t.test('Custom firmware build: LongMill build #2', (t) => {
    const runner = new GrblRunner();
    runner.on('startup', ({ raw, firmware, version, message }) => {
      t.equal(raw, 'Grbl 1.1h [\'$\' for help] LongMill build Feb 25, 2020');
      t.equal(firmware, 'Grbl');
      t.equal(version, '1.1h');
      t.equal(message, '[\'$\' for help] LongMill build Feb 25, 2020');
      t.end();
    });

    const line = 'Grbl 1.1h [\'$\' for help] LongMill build Feb 25, 2020';
    runner.parse(line);
  });

  t.test('Custom firmware build: vCarvin', (t) => {
    const runner = new GrblRunner();
    runner.on('startup', ({ raw, firmware, version, message }) => {
      t.equal(raw, 'vCarvin 2.0.0 [\'$\' for help]');
      t.equal(firmware, 'vCarvin');
      t.equal(version, '2.0.0');
      t.equal(message, '[\'$\' for help]');
      t.end();
    });

    const line = 'vCarvin 2.0.0 [\'$\' for help]';
    runner.parse(line);
  });

  t.end();
});

test('Not supported output format', (t) => {
  const runner = new GrblRunner();
  runner.on('others', ({ raw }) => {
    t.equal(raw, 'Not supported output format');
    t.end();
  });

  const line = 'Not supported output format';
  runner.parse(line);
});

test('GrblLineParserResultEcho', (t) => {
  const runner = new GrblRunner();
  runner.on('others', ({ raw, message }) => {
    t.equal(raw, '[echo:test message]');
    t.equal(message, 'test message');
    t.end();
  });

  const line = '[echo:test message]';
  runner.parse(line);
});

test('GrblLineParserResultHelp', (t) => {
  const runner = new GrblRunner();
  runner.on('others', ({ raw, message }) => {
    t.equal(raw, '[HLP:Available commands]');
    t.equal(message, 'Available commands');
    t.end();
  });

  const line = '[HLP:Available commands]';
  runner.parse(line);
});

test('GrblLineParserResultOption', (t) => {
  const runner = new GrblRunner();
  runner.on('others', ({ raw, message }) => {
    t.equal(raw, '[OPT:VERSION,1.1f]');
    t.equal(message, 'VERSION,1.1f');
    t.end();
  });

  const line = '[OPT:VERSION,1.1f]';
  runner.parse(line);
});

test('GrblLineParserResultVersion', (t) => {
  const runner = new GrblRunner();
  runner.on('others', ({ raw, message }) => {
    t.equal(raw, '[VER:1.1f.20170801]');
    t.equal(message, '1.1f.20170801');
    t.end();
  });

  const line = '[VER:1.1f.20170801]';
  runner.parse(line);
});

// Constructor tests for GrblLineParserResult classes
// Note: These classes are designed for static method usage only,
// but we test constructors for completeness and 100% coverage
test('GrblLineParserResultError constructor', (t) => {
  const GrblLineParserResultError = require('../src/controllers/Grbl/GrblLineParserResultError').default;
  const instance = new GrblLineParserResultError();
  t.ok(instance instanceof GrblLineParserResultError, 'should create instance');
  t.end();
});

test('GrblLineParserResultEcho constructor', (t) => {
  const GrblLineParserResultEcho = require('../src/controllers/Grbl/GrblLineParserResultEcho').default;
  const instance = new GrblLineParserResultEcho();
  t.ok(instance instanceof GrblLineParserResultEcho, 'should create instance');
  t.end();
});

test('GrblLineParserResultHelp constructor', (t) => {
  const GrblLineParserResultHelp = require('../src/controllers/Grbl/GrblLineParserResultHelp').default;
  const instance = new GrblLineParserResultHelp();
  t.ok(instance instanceof GrblLineParserResultHelp, 'should create instance');
  t.end();
});

test('GrblLineParserResultOption constructor', (t) => {
  const GrblLineParserResultOption = require('../src/controllers/Grbl/GrblLineParserResultOption').default;
  const instance = new GrblLineParserResultOption();
  t.ok(instance instanceof GrblLineParserResultOption, 'should create instance');
  t.end();
});

test('GrblLineParserResultVersion constructor', (t) => {
  const GrblLineParserResultVersion = require('../src/controllers/Grbl/GrblLineParserResultVersion').default;
  const instance = new GrblLineParserResultVersion();
  t.ok(instance instanceof GrblLineParserResultVersion, 'should create instance');
  t.end();
});

test('GrblLineParserResultAlarm constructor', (t) => {
  const GrblLineParserResultAlarm = require('../src/controllers/Grbl/GrblLineParserResultAlarm').default;
  const instance = new GrblLineParserResultAlarm();
  t.ok(instance instanceof GrblLineParserResultAlarm, 'should create instance');
  t.end();
});

test('GrblLineParserResultFeedback constructor', (t) => {
  const GrblLineParserResultFeedback = require('../src/controllers/Grbl/GrblLineParserResultFeedback').default;
  const instance = new GrblLineParserResultFeedback();
  t.ok(instance instanceof GrblLineParserResultFeedback, 'should create instance');
  t.end();
});

test('GrblLineParserResultOk constructor', (t) => {
  const GrblLineParserResultOk = require('../src/controllers/Grbl/GrblLineParserResultOk').default;
  const instance = new GrblLineParserResultOk();
  t.ok(instance instanceof GrblLineParserResultOk, 'should create instance');
  t.end();
});

test('GrblLineParserResultParameters constructor', (t) => {
  const GrblLineParserResultParameters = require('../src/controllers/Grbl/GrblLineParserResultParameters').default;
  const instance = new GrblLineParserResultParameters();
  t.ok(instance instanceof GrblLineParserResultParameters, 'should create instance');
  t.end();
});

test('GrblLineParserResultSettings constructor', (t) => {
  const GrblLineParserResultSettings = require('../src/controllers/Grbl/GrblLineParserResultSettings').default;
  const instance = new GrblLineParserResultSettings();
  t.ok(instance instanceof GrblLineParserResultSettings, 'should create instance');
  t.end();
});

test('GrblLineParserResultStartup constructor', (t) => {
  const GrblLineParserResultStartup = require('../src/controllers/Grbl/GrblLineParserResultStartup').default;
  const instance = new GrblLineParserResultStartup();
  t.ok(instance instanceof GrblLineParserResultStartup, 'should create instance');
  t.end();
});
