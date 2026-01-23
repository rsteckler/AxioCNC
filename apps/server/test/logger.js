import { test } from 'tap';
import proxyquire from 'proxyquire';
import loggerFactory, { getLevel, setLevel, levels } from '../src/lib/logger';

test('logger', (t) => {
  t.test('getLevel and setLevel', (st) => {
    const originalLevel = getLevel();

    setLevel('debug');
    st.equal(getLevel(), 'debug', 'setLevel sets logger level');

    setLevel('info');
    st.equal(getLevel(), 'info', 'setLevel can change level');

    // Restore original level
    setLevel(originalLevel);
    st.end();
  });

  t.test('logger factory - with namespace', (st) => {
    const logger = loggerFactory('test-namespace');

    st.ok(typeof logger.error === 'function', 'logger has error method');
    st.ok(typeof logger.warn === 'function', 'logger has warn method');
    st.ok(typeof logger.info === 'function', 'logger has info method');
    st.ok(typeof logger.verbose === 'function', 'logger has verbose method');
    st.ok(typeof logger.debug === 'function', 'logger has debug method');
    st.ok(typeof logger.silly === 'function', 'logger has silly method');

    // Test that methods can be called (they may not output due to level, but should not throw)
    logger.error('test error');
    logger.warn('test warn');
    logger.info('test info');
    logger.verbose('test verbose');
    logger.debug('test debug');
    logger.silly('test silly');

    st.end();
  });

  t.test('logger factory - without namespace', (st) => {
    const logger = loggerFactory();

    st.ok(typeof logger.error === 'function', 'logger has error method');
    st.ok(typeof logger.warn === 'function', 'logger has warn method');
    st.ok(typeof logger.info === 'function', 'logger has info method');

    // Test that methods can be called
    logger.error('test error');
    logger.warn('test warn');
    logger.info('test info');

    st.end();
  });

  t.test('logger factory - empty string namespace', (st) => {
    const logger = loggerFactory('');

    st.ok(typeof logger.error === 'function', 'logger has error method');
    logger.error('test');

    st.end();
  });

  t.test('logger factory - all levels', (st) => {
    const logger = loggerFactory('test');

    // Verify all levels are present
    levels.forEach(level => {
      st.ok(typeof logger[level] === 'function', `logger has ${level} method`);
    });

    st.end();
  });

  t.test('logger with verbosity >= VERBOSITY_MAX', (st) => {
    // Mock settings to have verbosity >= 3 (VERBOSITY_MAX)
    const loggerWithVerbosity = proxyquire('../src/lib/logger', {
      '../config/settings': {
        winston: { level: 'debug' },
        verbosity: 3 // VERBOSITY_MAX
      }
    });

    const logger = loggerWithVerbosity.default('test');

    // When verbosity >= 3 and level !== 'silly', getStackTrace is called
    // This should trigger lines 8-11 and 56-57
    logger.error('test'); // error is not 'silly', so should add stack trace
    logger.warn('test'); // warn is not 'silly', so should add stack trace
    logger.info('test'); // info is not 'silly', so should add stack trace
    logger.verbose('test'); // verbose is not 'silly', so should add stack trace
    logger.debug('test'); // debug is not 'silly', so should add stack trace
    logger.silly('test'); // silly is 'silly', so should NOT add stack trace

    st.end();
  });

  t.test('logger with verbosity < VERBOSITY_MAX', (st) => {
    // Mock settings to have verbosity < 3
    const loggerWithLowVerbosity = proxyquire('../src/lib/logger', {
      '../config/settings': {
        winston: { level: 'debug' },
        verbosity: 2 // < VERBOSITY_MAX
      }
    });

    const logger = loggerWithLowVerbosity.default('test');

    // When verbosity < 3, getStackTrace should not be called
    logger.error('test');
    logger.warn('test');
    logger.info('test');

    st.end();
  });

  t.end();
});
