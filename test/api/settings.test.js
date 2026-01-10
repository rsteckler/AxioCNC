import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse, createMockConfigStore } from './helpers';
import { getDefaultSettings } from '../../src/shared/schemas/settings';
import { ERR_BAD_REQUEST } from '../../src/server/constants/index';

test('api.settings', (t) => {
  t.test('GET /api/settings - returns defaults when no stored settings', (subt) => {
    const mockConfigStore = createMockConfigStore({});

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiSettings.get(req, res);

    subt.equal(res.statusCode, 200);
    const defaults = getDefaultSettings();
    subt.same(res.body, defaults, 'should return default settings');
    subt.end();
  });

  t.test('GET /api/settings - returns merged defaults when stored settings incomplete', (subt) => {
    // Schema is flat - lang is at top level, not under general
    const storedSettings = {
      lang: 'es', // partial settings
    };
    const mockConfigStore = createMockConfigStore({
      settings: storedSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiSettings.get(req, res);

    subt.equal(res.statusCode, 200);
    // Zod should parse and apply defaults, preserving our lang override
    subt.ok(res.body, 'should have response body');
    subt.equal(res.body.lang, 'es', 'should preserve stored lang');
    subt.ok(typeof res.body.checkForUpdates === 'boolean', 'should apply defaults');
    subt.ok(res.body.connection, 'should have connection defaults');
    subt.ok(res.body.machine, 'should have machine defaults');
    subt.end();
  });

  t.test('GET /api/settings - returns stored settings when valid', (subt) => {
    // Schema is flat structure
    const storedSettings = {
      lang: 'fr',
      checkForUpdates: false,
      allowAnonymousUsageDataCollection: true,
      connection: {
        port: '/dev/ttyUSB0',
        baudRate: 115200,
      },
    };
    const mockConfigStore = createMockConfigStore({
      settings: storedSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiSettings.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.lang, 'fr');
    subt.equal(res.body.checkForUpdates, false);
    subt.equal(res.body.connection.port, '/dev/ttyUSB0');
    subt.end();
  });

  t.test('GET /api/settings - returns defaults when stored settings corrupted', (subt) => {
    // Store invalid data that will fail Zod validation
    const corruptedSettings = {
      lang: 123, // invalid type (should be string)
      invalidField: 'should not be here',
    };
    const mockConfigStore = createMockConfigStore({
      settings: corruptedSettings,
    });

    // Mock console.warn to verify it's called
    const warnMessages = [];
    const originalWarn = console.warn;
    console.warn = (msg) => {
      warnMessages.push(msg);
    };

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiSettings.get(req, res);

    subt.equal(res.statusCode, 200);
    const defaults = getDefaultSettings();
    subt.same(res.body, defaults, 'should return defaults when corrupted');
    subt.ok(warnMessages.length > 0, 'should log warning');

    console.warn = originalWarn;
    subt.end();
  });

  t.test('POST /api/settings - accepts valid partial update', (subt) => {
    const existingSettings = {
      lang: 'en',
      checkForUpdates: true,
    };
    const mockConfigStore = createMockConfigStore({
      settings: existingSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        lang: 'de',
      },
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });
    // Verify settings were saved (merged)
    const saved = mockConfigStore.get('settings');
    subt.equal(saved.lang, 'de', 'should update lang');
    subt.ok(saved.checkForUpdates, 'should preserve existing checkForUpdates');
    subt.end();
  });

  t.test('POST /api/settings - merges with existing settings correctly', (subt) => {
    const existingSettings = {
      lang: 'en',
      checkForUpdates: true,
      connection: {
        port: '/dev/ttyUSB0',
        baudRate: 115200,
      },
    };
    const mockConfigStore = createMockConfigStore({
      settings: existingSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        connection: {
          port: '/dev/ttyACM0',
        },
      },
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, 200);
    const saved = mockConfigStore.get('settings');
    subt.equal(saved.connection.port, '/dev/ttyACM0', 'should update port');
    subt.equal(saved.connection.baudRate, 115200, 'should preserve baudRate');
    subt.equal(saved.lang, 'en', 'should preserve lang');
    subt.end();
  });

  t.test('POST /api/settings - validates against Zod schema', (subt) => {
    const mockConfigStore = createMockConfigStore({
      settings: {},
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        lang: 123, // invalid type (should be string)
      },
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST, 'should return 400');
    subt.equal(res.body.msg, 'Invalid settings', 'should have error message');
    subt.ok(Array.isArray(res.body.errors), 'should return errors array');
    subt.ok(res.body.errors && res.body.errors.length > 0, 'should have at least one error');
    // Verify error mentions lang (path might be 'lang' or similar)
    const langError = res.body.errors.find(e => (typeof e.path === 'string' && e.path.includes('lang')) ||
      (typeof e.message === 'string' && e.message.toLowerCase().includes('lang')));
    subt.ok(langError, 'should mention lang error');
    subt.end();
  });

  t.test('POST /api/settings - returns 400 with error details on validation failure', (subt) => {
    const mockConfigStore = createMockConfigStore({
      settings: {},
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        connection: {
          port: 12345, // invalid type (should be string)
          baudRate: 'not-a-number', // invalid type (should be number)
        },
      },
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST, 'should return 400');
    subt.equal(res.body.msg, 'Invalid settings', 'should have error message');
    subt.ok(res.body.errors && Array.isArray(res.body.errors), 'should return errors array');
    subt.ok(res.body.errors.length > 0, 'should have validation errors');
    // Verify error format
    if (res.body.errors && res.body.errors.length > 0) {
      res.body.errors.forEach(error => {
        subt.ok(typeof error.path === 'string', 'error should have path string');
        subt.ok(typeof error.message === 'string', 'error should have message string');
      });
    }
    subt.end();
  });

  t.test('POST /api/settings - handles empty body', (subt) => {
    const existingSettings = {
      lang: 'en',
    };
    const mockConfigStore = createMockConfigStore({
      settings: existingSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {},
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });
    subt.end();
  });

  t.test('DELETE /api/settings - resets to defaults', (subt) => {
    const existingSettings = {
      lang: 'fr',
      connection: {
        port: '/dev/ttyUSB0',
      },
    };
    const mockConfigStore = createMockConfigStore({
      settings: existingSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiSettings.reset(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body.err, false);
    subt.ok(res.body.settings, 'should return settings');
    const defaults = getDefaultSettings();
    subt.same(res.body.settings, defaults, 'should return default settings');

    // Verify settings were reset in store
    const saved = mockConfigStore.get('settings');
    subt.same(saved, defaults, 'should save defaults to store');
    subt.end();
  });

  t.test('DELETE /api/settings - clears stored settings', (subt) => {
    const existingSettings = {
      lang: 'es',
    };
    const mockConfigStore = createMockConfigStore({
      settings: existingSettings,
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    // Verify initial state
    subt.notSame(mockConfigStore.get('settings'), getDefaultSettings());

    apiSettings.reset(req, res);

    // Verify reset
    const saved = mockConfigStore.get('settings');
    subt.same(saved, getDefaultSettings(), 'should replace with defaults');
    subt.end();
  });

  t.test('POST /api/settings - handles null body', (subt) => {
    const mockConfigStore = createMockConfigStore({
      settings: { lang: 'en' },
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: null,
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, 200);
    // Spreading null should result in empty object, which should merge with existing settings
    subt.same(res.body, { err: false });
    const saved = mockConfigStore.get('settings');
    subt.ok(saved, 'should have settings');
    subt.end();
  });

  t.test('POST /api/settings - handles undefined body', (subt) => {
    const mockConfigStore = createMockConfigStore({
      settings: { lang: 'en' },
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: undefined,
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });
    subt.end();
  });

  t.test('POST /api/settings - handles validation error with nested path', (subt) => {
    // Test error formatting with nested paths to cover all branch paths
    const mockConfigStore = createMockConfigStore({
      settings: {},
    });

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    // Send data that will cause validation error at nested level
    const req = createMockRequest({
      body: {
        connection: {
          port: 12345, // invalid type (should be string)
          baudRate: 'invalid', // invalid type (should be number)
          controllerType: 999, // invalid type (should be string)
        },
      },
    });
    const res = createMockResponse();

    apiSettings.set(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST, 'should return 400 for invalid nested data');
    subt.equal(res.body.msg, 'Invalid settings');
    subt.ok(Array.isArray(res.body.errors), 'should have errors array');
    subt.ok(res.body.errors.length > 0, 'should have at least one error');
    // Verify error formatting handles nested paths correctly
    res.body.errors.forEach(error => {
      subt.ok(typeof error.path === 'string', 'error should have path string');
      subt.ok(error.path.length > 0, 'path should not be empty');
      subt.ok(typeof error.message === 'string', 'error should have message string');
      // Verify paths contain connection prefix for nested errors
      if (error.path.includes('port') || error.path.includes('baudRate') || error.path.includes('controllerType')) {
        subt.ok(error.path.includes('connection') || error.path.startsWith('connection'),
          'nested error path should include parent key');
      }
    });
    subt.end();
  });

  t.test('GET /api/settings - handles when config.get returns undefined explicitly', (subt) => {
    // Test the case where config.get might return undefined (not just empty object)
    const mockConfigStore = createMockConfigStore({});
    // Make get return undefined for the settings key
    const originalGet = mockConfigStore.get;
    mockConfigStore.get = (key, defaultValue) => {
      if (key === 'settings') {
        return undefined; // Explicit undefined, not using defaultValue
      }
      return originalGet.call(mockConfigStore, key, defaultValue);
    };

    const apiSettings = proxyquire('../../src/server/api/api.settings.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiSettings.get(req, res);

    subt.equal(res.statusCode, 200);
    // When undefined is returned, Zod will parse it and apply defaults
    const defaults = getDefaultSettings();
    subt.same(res.body, defaults, 'should return defaults when undefined');
    subt.end();
  });

  t.end();
});
