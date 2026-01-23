import { test } from 'tap';
import SmoothieRunner from '../src/controllers/Smoothie/SmoothieRunner';

// $10 - Status report mask:binary
// Report Type      | Value
// Machine Position | 1
// Work Position    | 2
// Planner Buffer   | 4
// RX Buffer        | 8
// Limit Pins       | 16
test('SmoothieRunnerLineParserResultStatus: all zeroes in the mask ($10=0)', (t) => {
  const runner = new SmoothieRunner();
  runner.on('status', ({ raw, ...status }) => {
    t.equal(raw, '<Idle>');
    t.same(status, {
      activeState: 'Idle',
    });
    t.end();
  });

  const line = '<Idle>';
  runner.parse(line);
});

test('SmoothieRunnerLineParserResultStatus: old status format', (t) => {
  t.test('6-axis', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle,MPos:200.0000,200.0000,0.0000,0.0000,0.0000,0.0000,WPos:200.0000,200.0000,0.0000>');
      t.same(status, {
        activeState: 'Idle',
        mpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
          a: '0.0000',
          b: '0.0000',
          c: '0.0000',
        },
        wpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        }
      });
      t.end();
    });

    const line = '<Idle,MPos:200.0000,200.0000,0.0000,0.0000,0.0000,0.0000,WPos:200.0000,200.0000,0.0000>';
    runner.parse(line);
  });

  t.end();
});

test('SmoothieRunnerLineParserResultStatus: new status format', (t) => {
  t.test('6-axis', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:200.0000,200.0000,0.0000,0.0000,0.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0>');
      t.same(status, {
        activeState: 'Idle',
        mpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
          a: '0.0000',
          b: '0.0000',
          c: '0.0000',
        },
        wpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        },
        feedrate: '4000.0',
        feedrateOverride: '100.0',
      });
      t.end();
    });

    const line = '<Idle|MPos:200.0000,200.0000,0.0000,0.0000,0.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0>';
    runner.parse(line);
  });

  t.test('Laser', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:200.0000,200.0000,0.0000,0.0000,0.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0|L:0.0000|S:0.8000>');
      t.same(status, {
        activeState: 'Idle',
        mpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
          a: '0.0000',
          b: '0.0000',
          c: '0.0000',
        },
        wpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        },
        feedrate: '4000.0',
        feedrateOverride: '100.0',
        laserPower: '0.0000',
        laserIntensity: '0.8000',
      });
      t.end();
    });

    const line = '<Idle|MPos:200.0000,200.0000,0.0000,0.0000,0.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0|L:0.0000|S:0.8000>';
    runner.parse(line);
  });

  t.test('Home', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Home|MPos:15.8250,15.8250,0.0000|WPos:15.8250,15.8250,0.0000|F:4000.0,4000.0,100.0>');
      t.same(status, {
        activeState: 'Home',
        mpos: {
          x: '15.8250',
          y: '15.8250',
          z: '0.0000',
        },
        wpos: {
          x: '15.8250',
          y: '15.8250',
          z: '0.0000',
        },
        currentFeedrate: '4000.0',
        feedrate: '4000.0',
        feedrateOverride: '100.0',
      });
      t.end();
    });

    const line = '<Home|MPos:15.8250,15.8250,0.0000|WPos:15.8250,15.8250,0.0000|F:4000.0,4000.0,100.0>';
    runner.parse(line);
  });

  t.test('Run', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Run|MPos:15.8250,15.8250,0.0000|WPos:15.8250,15.8250,0.0000|F:4000.0,4000.0,100.0>');
      t.same(status, {
        activeState: 'Run',
        mpos: {
          x: '15.8250',
          y: '15.8250',
          z: '0.0000',
        },
        wpos: {
          x: '15.8250',
          y: '15.8250',
          z: '0.0000',
        },
        currentFeedrate: '4000.0',
        feedrate: '4000.0',
        feedrateOverride: '100.0',
      });
      t.end();
    });

    const line = '<Run|MPos:15.8250,15.8250,0.0000|WPos:15.8250,15.8250,0.0000|F:4000.0,4000.0,100.0>';
    runner.parse(line);
  });

  t.test('Idle', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:200.0000,200.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0>');
      t.same(status, {
        activeState: 'Idle',
        mpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        },
        wpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        },
        feedrate: '4000.0',
        feedrateOverride: '100.0',
      });
      t.end();
    });

    const line = '<Idle|MPos:200.0000,200.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0>';
    runner.parse(line);
  });

  t.test('Temperature', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|T:25.0,200.0>');
      t.same(status, {
        activeState: 'Idle',
        mpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000',
        },
        wpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000',
        },
        currentTemperature: 25.0,
        targetTemperature: 200.0,
      });
      t.end();
    });

    const line = '<Idle|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|T:25.0,200.0>';
    runner.parse(line);
  });

  t.test('Alarm', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Alarm|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:1000.0,50.0>');
      t.same(status, {
        activeState: 'Alarm',
        mpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000',
        },
        wpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000',
        },
        feedrate: '1000.0',
        feedrateOverride: '50.0',
      });
      t.end();
    });

    const line = '<Alarm|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:1000.0,50.0>';
    runner.parse(line);
  });

  t.test('Hold', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Hold|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:500.0,25.0>');
      t.same(status, {
        activeState: 'Hold',
        mpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000',
        },
        wpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000',
        },
        feedrate: '500.0',
        feedrateOverride: '25.0',
      });
      t.end();
    });

    const line = '<Hold|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:500.0,25.0>';
    runner.parse(line);
  });

  t.test('state transition', (t) => {
    let lineNumber = 0;
    const lines = [
      '<Run|MPos:15.8250,15.8250,0.0000|WPos:15.8250,15.8250,0.0000|F:4000.0,4000.0,100.0>',
      '<Idle|MPos:200.0000,200.0000,0.0000|WPos:200.0000,200.0000,0.0000|F:4000.0,100.0>',
    ];
    const expectedResults = [
      { // Run
        activeState: 'Run',
        mpos: {
          x: '15.8250',
          y: '15.8250',
          z: '0.0000',
        },
        wpos: {
          x: '15.8250',
          y: '15.8250',
          z: '0.0000',
        },
        currentFeedrate: '4000.0',
        feedrate: '4000.0',
        feedrateOverride: '100.0',
      },
      { // Idle
        activeState: 'Idle',
        mpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        },
        wpos: {
          x: '200.0000',
          y: '200.0000',
          z: '0.0000',
        },
        feedrate: '4000.0',
        feedrateOverride: '100.0',
      }
    ];

    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      const index = lineNumber - 1;
      t.equal(raw, lines[index]);
      t.same(status, expectedResults[index]);

      if (lineNumber === lines.length) {
        t.end();
      }
    });

    lines.forEach((line, index) => {
      lineNumber = index + 1;
      runner.parse(line);
    });
  });

  t.test('F: feedrate for Hold state (not Home/Run)', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Hold|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:2000.0,50.0>');
      t.same(status, {
        activeState: 'Hold',
        mpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000'
        },
        wpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000'
        },
        feedrate: 2000.0,
        feedrateOverride: 50.0
      });
      // Should NOT have currentFeedrate for Hold state
      t.notOk(status.currentFeedrate, 'Hold state should not have currentFeedrate');
      t.end();
    });

    const line = '<Hold|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:2000.0,50.0>';
    runner.parse(line);
  });

  t.test('F: feedrate for Alarm state (not Home/Run)', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Alarm|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:1000.0,75.0>');
      t.same(status, {
        activeState: 'Alarm',
        mpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000'
        },
        wpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000'
        },
        feedrate: 1000.0,
        feedrateOverride: 75.0
      });
      // Should NOT have currentFeedrate for Alarm state
      t.notOk(status.currentFeedrate, 'Alarm state should not have currentFeedrate');
      t.end();
    });

    const line = '<Alarm|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:1000.0,75.0>';
    runner.parse(line);
  });

  t.test('T: temperature (current and target)', (t) => {
    const runner = new SmoothieRunner();
    runner.on('status', ({ raw, ...status }) => {
      t.equal(raw, '<Idle|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:4000.0,100.0|T:25.5,30.0>');
      t.same(status, {
        activeState: 'Idle',
        mpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000'
        },
        wpos: {
          x: '0.0000',
          y: '0.0000',
          z: '0.0000'
        },
        feedrate: 4000.0,
        feedrateOverride: 100.0,
        currentTemperature: 25.5,
        targetTemperature: 30.0
      });
      t.end();
    });

    const line = '<Idle|MPos:0.0000,0.0000,0.0000|WPos:0.0000,0.0000,0.0000|F:4000.0,100.0|T:25.5,30.0>';
    runner.parse(line);
  });

  t.end();
});

test('SmoothieRunnerLineParserResultOk', (t) => {
  const runner = new SmoothieRunner();
  runner.on('ok', ({ raw }) => {
    t.equal(raw, 'ok');
    t.end();
  });

  const line = 'ok';
  runner.parse(line);
});

test('SmoothieRunnerLineParserResultError', (t) => {
  const runner = new SmoothieRunner();
  runner.on('error', ({ raw, message }) => {
    t.equal(raw, 'error: Expected command letter');
    t.equal(message, 'Expected command letter');
    t.end();
  });

  const line = 'error: Expected command letter';
  runner.parse(line);
});

test('SmoothieRunnerLineParserResultAlarm', (t) => {
  const runner = new SmoothieRunner();
  runner.on('alarm', ({ raw, message }) => {
    t.equal(raw, 'ALARM: Probe fail');
    t.equal(message, 'Probe fail');
    t.end();
  });

  const line = 'ALARM: Probe fail';
  runner.parse(line);
});

test('SmoothieRunnerLineParserResultParserState', (t) => {
  test('#1', (t) => {
    const runner = new SmoothieRunner();
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
          program: 'M0',
          spindle: 'M5',
          coolant: 'M9'
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

  test('#2', (t) => {
    const runner = new SmoothieRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[G0 G54 G17 G21 G90 G94 M0 M5 M7 M8 T2 F2540. S0.]');
      t.same(parserstate, {
        modal: {
          motion: 'G0', // G0, G1, G2, G3, G38.2, G38.3, G38.4, G38.5, G80
          wcs: 'G54', // G54, G55, G56, G57, G58, G59
          plane: 'G17', // G17: xy-plane, G18: xz-plane, G19: yz-plane
          units: 'G21', // G20: Inches, G21: Millimeters
          distance: 'G90', // G90: Absolute, G91: Relative
          feedrate: 'G94', // G93: Inverse Time Mode, G94: Units Per Minutes
          program: 'M0',
          spindle: 'M5',
          coolant: ['M7', 'M8']
        },
        tool: '2',
        feedrate: '2540.',
        spindle: '0.'
      });
      t.equal(runner.getTool(), 2);
      t.end();
    });

    const line = '[G0 G54 G17 G21 G90 G94 M0 M5 M7 M8 T2 F2540. S0.]';
    runner.parse(line);
  });

  test('#3 - unknown G/M codes are ignored', (t) => {
    const runner = new SmoothieRunner();
    runner.on('parserstate', ({ raw, ...parserstate }) => {
      t.equal(raw, '[G0 G99 M42 T0 F100. S0.]');
      t.same(parserstate, {
        modal: {
          motion: 'G0',
        },
        tool: '0',
        feedrate: '100.',
        spindle: '0.'
      });
      t.end();
    });

    // G99 and M42 are not in SMOOTHIE_MODAL_GROUPS, so they should be ignored
    const line = '[G0 G99 M42 T0 F100. S0.]';
    runner.parse(line);
  });

  t.end();
});

test('SmoothieRunnerLineParserResultParameters:G54,G55,G56,G57,G58,G59,G28,G30,G92', (t) => {
  const lines = [
    '[G54:0.000,0.000,0.000]',
    '[G55:0.000,0.000,0.000]',
    '[G56:0.000,0.000,0.000]',
    '[G57:0.000,0.000,0.000]',
    '[G58:0.000,0.000,0.000]',
    '[G59:0.000,0.000,0.000]',
    '[G59.1:0.000,0.000,0.000]',
    '[G59.2:0.000,0.000,0.000]',
    '[G59.3:0.000,0.000,0.000]',
    '[G28:0.000,0.000,0.000]',
    '[G30:0.000,0.000,0.000]',
    '[G92:0.000,0.000,0.000]'
  ];
  const runner = new SmoothieRunner();
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

test('SmoothieRunnerLineParserResultParameters:TLO', (t) => {
  const runner = new SmoothieRunner();
  runner.on('parameters', ({ name, value, raw }) => {
    t.equal(raw, '[TLO:0.000]');
    t.equal(name, 'TLO');
    t.equal(value, '0.000');
    t.end();
  });

  runner.parse('[TLO:0.000]');
});

test('SmoothieRunnerLineParserResultParameters:PRB', (t) => {
  const runner = new SmoothieRunner();
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

test('SmoothieRunnerLineParserResultAction', (t) => {
  t.test('pause action', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('action', ({ raw, message }) => {
      subt.equal(raw, '// action:pause');
      subt.equal(message, 'pause');
      subt.end();
    });

    const line = '// action:pause';
    runner.parse(line);
  });

  t.test('resume action', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('action', ({ raw, message }) => {
      subt.equal(raw, '// action:resume');
      subt.equal(message, 'resume');
      subt.end();
    });

    const line = '// action:resume';
    runner.parse(line);
  });

  t.test('cancel action', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('action', ({ raw, message }) => {
      subt.equal(raw, '// action:cancel');
      subt.equal(message, 'cancel');
      subt.end();
    });

    const line = '// action:cancel';
    runner.parse(line);
  });

  t.test('action with custom message', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('action', ({ raw, message }) => {
      subt.equal(raw, '// action:custom-action-name');
      subt.equal(message, 'custom-action-name');
      subt.end();
    });

    const line = '// action:custom-action-name';
    runner.parse(line);
  });

  t.end();
});

test('SmoothieRunnerLineParserResultVersion', (t) => {
  t.test('full version string with all fields', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('version', ({ raw, ...others }) => {
      subt.equal(raw, 'Build version: edge-3332442, Build date: xxx, MCU: LPC1769, System Clock: 120MHz');
      subt.same(others, {
        build: {
          version: 'edge-3332442',
          date: 'xxx'
        },
        mcu: 'LPC1769',
        sysclk: '120MHz'
      });
      subt.end();
    });

    const line = 'Build version: edge-3332442, Build date: xxx, MCU: LPC1769, System Clock: 120MHz';
    runner.parse(line);
  });

  t.test('version with LPC1768 (alternative MCU)', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('version', ({ raw, ...others }) => {
      subt.equal(raw, 'Build version: dev-123, Build date: Jan 1 2020, MCU: LPC1768, System Clock: 100MHz');
      subt.same(others, {
        build: {
          version: 'dev-123',
          date: 'Jan 1 2020'
        },
        mcu: 'LPC1768',
        sysclk: '100MHz'
      });
      subt.end();
    });

    const line = 'Build version: dev-123, Build date: Jan 1 2020, MCU: LPC1768, System Clock: 100MHz';
    runner.parse(line);
  });

  t.test('version with only MCU (minimal required field)', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('version', ({ raw, ...others }) => {
      subt.equal(raw, 'MCU: LPC1769');
      subt.same(others, {
        mcu: 'LPC1769'
      });
      subt.end();
    });

    const line = 'MCU: LPC1769';
    runner.parse(line);
  });

  t.test('version with partial fields (only build version and MCU)', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('version', ({ raw, ...others }) => {
      subt.equal(raw, 'Build version: edge-3332442, MCU: LPC1769');
      subt.same(others, {
        build: {
          version: 'edge-3332442'
        },
        mcu: 'LPC1769'
      });
      subt.end();
    });

    const line = 'Build version: edge-3332442, MCU: LPC1769';
    runner.parse(line);
  });

  t.test('version without MCU (should not parse)', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('others', ({ raw }) => {
      subt.equal(raw, 'Build version: edge-3332442, Build date: xxx, System Clock: 120MHz');
      subt.end();
    });

    const line = 'Build version: edge-3332442, Build date: xxx, System Clock: 120MHz';
    runner.parse(line);
  });

  t.test('version with non-LPC176 MCU (should not parse)', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('others', ({ raw }) => {
      subt.equal(raw, 'Build version: edge-3332442, Build date: xxx, MCU: ATmega2560, System Clock: 16MHz');
      subt.end();
    });

    const line = 'Build version: edge-3332442, Build date: xxx, MCU: ATmega2560, System Clock: 16MHz';
    runner.parse(line);
  });

  t.test('version with invalid format (no colons)', (subt) => {
    const runner = new SmoothieRunner();
    runner.on('others', ({ raw }) => {
      subt.equal(raw, 'Build version edge-3332442 Build date xxx MCU LPC1769');
      subt.end();
    });

    const line = 'Build version edge-3332442 Build date xxx MCU LPC1769';
    runner.parse(line);
  });

  t.end();
});

test('Not supported output format', (t) => {
  const runner = new SmoothieRunner();
  runner.on('others', ({ raw }) => {
    t.equal(raw, 'Not supported output format');
    t.end();
  });

  const line = 'Not supported output format';
  runner.parse(line);
});
