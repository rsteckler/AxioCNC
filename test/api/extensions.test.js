import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse, createMockConfigStore } from './helpers';
import { ERR_NOT_FOUND } from '../../src/server/constants/index';

test('api.extensions', (t) => {
  t.test('GET /api/extensions - returns all extensions when no key', (subt) => {
    const extensions = {
      widgets: {
        visualizer: { showGrid: true },
        console: { fontSize: 12 },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiExtensions.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, extensions, 'should return all extensions');
    subt.end();
  });

  t.test('GET /api/extensions - returns empty object when no extensions stored', (subt) => {
    const mockConfigStore = createMockConfigStore({});

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest();
    const res = createMockResponse();

    apiExtensions.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, {}, 'should return empty object');
    subt.end();
  });

  t.test('GET /api/extensions - returns specific key value', (subt) => {
    const extensions = {
      widgets: {
        visualizer: { showGrid: true, theme: 'dark' },
        console: { fontSize: 12 },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: { key: 'widgets.visualizer' },
    });
    const res = createMockResponse();

    apiExtensions.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { showGrid: true, theme: 'dark' }, 'should return specific key value');
    subt.end();
  });

  t.test('GET /api/extensions - returns 404 when key not found', (subt) => {
    const extensions = {
      widgets: {
        visualizer: { showGrid: true },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: { key: 'widgets.nonexistent' },
    });
    const res = createMockResponse();

    apiExtensions.get(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found');
    subt.end();
  });

  t.test('POST /api/extensions - sets root-level extension data', (subt) => {
    const mockConfigStore = createMockConfigStore({});

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        widgets: {
          visualizer: { showGrid: true },
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });

    // Verify data was stored
    const stored = mockConfigStore.get('extensions');
    subt.ok(stored.widgets, 'should have widgets');
    subt.ok(stored.widgets.visualizer, 'should have visualizer');
    subt.equal(stored.widgets.visualizer.showGrid, true);
    subt.end();
  });

  t.test('POST /api/extensions - sets nested key with dot notation', (subt) => {
    const existingExtensions = {
      widgets: {
        visualizer: { showGrid: false },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: { key: 'widgets.console' },
      body: {
        fontSize: 14,
        theme: 'light',
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });

    // Verify specific key was set
    const consoleData = mockConfigStore.get('extensions.widgets.console');
    subt.equal(consoleData.fontSize, 14);
    subt.equal(consoleData.theme, 'light');
    // Verify existing data preserved
    const visualizerData = mockConfigStore.get('extensions.widgets.visualizer');
    subt.equal(visualizerData.showGrid, false, 'should preserve existing data');
    subt.end();
  });

  t.test('POST /api/extensions - merges object values correctly', (subt) => {
    const existingExtensions = {
      widgets: {
        visualizer: {
          showGrid: true,
          theme: 'dark',
        },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        widgets: {
          visualizer: {
            showGrid: false, // update
            fontSize: 16, // new field
          },
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // Verify merge: existing fields updated, new fields added, other fields preserved
    const visualizerData = mockConfigStore.get('extensions.widgets.visualizer');
    subt.equal(visualizerData.showGrid, false, 'should update existing field');
    subt.equal(visualizerData.fontSize, 16, 'should add new field');
    subt.equal(visualizerData.theme, 'dark', 'should preserve other fields');
    subt.end();
  });

  t.test('POST /api/extensions - replaces non-object values', (subt) => {
    const existingExtensions = {
      settings: {
        version: '1.0',
        count: 5,
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        settings: {
          version: '2.0', // string replacing string (merge doesn't apply to non-objects)
          count: 10, // number replacing number
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // Non-object values should be replaced, not merged
    const settings = mockConfigStore.get('extensions.settings');
    subt.equal(settings.version, '2.0');
    subt.equal(settings.count, 10);
    subt.end();
  });

  t.test('DELETE /api/extensions - deletes specific key', (subt) => {
    const extensions = {
      widgets: {
        visualizer: { showGrid: true },
        console: { fontSize: 12 },
      },
      plugins: {
        toolpath: { enabled: true },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: { key: 'widgets.visualizer' },
    });
    const res = createMockResponse();

    apiExtensions.unset(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });

    // Verify key was deleted
    subt.notOk(mockConfigStore.has('extensions.widgets.visualizer'), 'should delete key');
    // Verify other keys preserved
    subt.ok(mockConfigStore.has('extensions.widgets.console'), 'should preserve other widgets');
    subt.ok(mockConfigStore.has('extensions.plugins'), 'should preserve plugins');
    subt.end();
  });

  t.test('DELETE /api/extensions - returns 404 when key not found', (subt) => {
    const extensions = {
      widgets: {
        visualizer: { showGrid: true },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: { key: 'widgets.nonexistent' },
    });
    const res = createMockResponse();

    apiExtensions.unset(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found');
    subt.end();
  });

  t.test('DELETE /api/extensions - returns all when no key specified', (subt) => {
    const extensions = {
      widgets: {
        visualizer: { showGrid: true },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: {}, // no key
    });
    const res = createMockResponse();

    apiExtensions.unset(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, extensions, 'should return all extensions (does not delete)');

    // Verify nothing was deleted
    subt.ok(mockConfigStore.has('extensions.widgets.visualizer'), 'should not delete anything');
    subt.end();
  });

  t.test('POST /api/extensions - handles empty body', (subt) => {
    const mockConfigStore = createMockConfigStore({});

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {},
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });
    subt.end();
  });

  t.test('POST /api/extensions - handles complex nested structures', (subt) => {
    const mockConfigStore = createMockConfigStore({});

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const complexData = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
            array: [1, 2, 3],
            nested: {
              key: 'value',
            },
          },
        },
      },
    };

    const req = createMockRequest({
      body: complexData,
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // Verify deep structure was stored
    const stored = mockConfigStore.get('extensions');
    subt.ok(stored.level1, 'should have level1');
    subt.ok(stored.level1.level2, 'should have level2');
    subt.ok(stored.level1.level2.level3, 'should have level3');
    subt.equal(stored.level1.level2.level3.value, 'deep');
    subt.same(stored.level1.level2.level3.array, [1, 2, 3]);
    subt.end();
  });

  t.test('POST /api/extensions - handles null oldValue (null is typeof object)', (subt) => {
    // JavaScript quirk: typeof null === 'object' is true
    // The code checks typeof oldValue === 'object' && typeof newValue === 'object'
    // When oldValue is null and newValue is an object, both conditions are true
    // However, {...null, ...obj} works in JavaScript (spreading null results in empty object)
    // So {showGrid: true} should be the result
    const existingExtensions = {
      widgets: {
        visualizer: null, // explicit null value
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        widgets: {
          visualizer: { showGrid: true }, // new object
        },
      },
    });
    const res = createMockResponse();

    // This should work because {...null, ...obj} = {...obj} in JavaScript
    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    const visualizer = mockConfigStore.get('extensions.widgets.visualizer');
    // Spreading null works: {...null, ...{showGrid: true}} = {showGrid: true}
    subt.ok(visualizer, 'should have visualizer');
    subt.ok(typeof visualizer === 'object', 'should be an object');
    subt.equal(visualizer.showGrid, true, 'should set new value (null gets spread as empty object)');
    subt.end();
  });

  t.test('POST /api/extensions - handles when oldValue is object but newValue is primitive', (subt) => {
    const existingExtensions = {
      settings: {
        theme: { mode: 'dark', color: 'blue' },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        settings: {
          theme: 'light', // replacing object with string
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // Should replace (not merge) because newValue is not an object
    const theme = mockConfigStore.get('extensions.settings.theme');
    subt.equal(theme, 'light', 'should replace object with primitive');
    subt.end();
  });

  t.test('POST /api/extensions - handles when oldValue is primitive but newValue is object', (subt) => {
    const existingExtensions = {
      settings: {
        theme: 'light', // primitive value
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        settings: {
          theme: { mode: 'dark', color: 'blue' }, // replacing primitive with object
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // Should replace (not merge) because oldValue is not an object
    const theme = mockConfigStore.get('extensions.settings.theme');
    subt.ok(typeof theme === 'object', 'should replace primitive with object');
    subt.equal(theme.mode, 'dark');
    subt.equal(theme.color, 'blue');
    subt.end();
  });

  t.test('POST /api/extensions - handles arrays (arrays are objects)', (subt) => {
    const existingExtensions = {
      widgets: {
        list: [1, 2, 3], // array is typeof 'object'
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        widgets: {
          list: [4, 5, 6], // new array
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // Arrays are objects, so code will try to merge with spread
    // {...[1,2,3], ...[4,5,6]} becomes {0:4, 1:5, 2:6} which is not what we want
    // But this is current behavior - arrays get converted to objects
    const list = mockConfigStore.get('extensions.widgets.list');
    // The spread operator on arrays creates an object with numeric keys
    subt.ok(typeof list === 'object', 'should be object');
    // Verify it's not an array anymore (it gets converted)
    subt.ok(!Array.isArray(list), 'arrays get converted to objects when merged');
    subt.end();
  });

  t.test('POST /api/extensions - handles undefined oldValue', (subt) => {
    const existingExtensions = {
      widgets: {
        visualizer: { showGrid: true },
      },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: existingExtensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      body: {
        widgets: {
          newWidget: { enabled: true }, // new key that doesn't exist
        },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);

    // When oldValue is undefined, typeof undefined === 'object' is false, so should replace
    const newWidget = mockConfigStore.get('extensions.widgets.newWidget');
    subt.ok(newWidget, 'should create new widget');
    subt.equal(newWidget.enabled, true);
    // Verify existing widget preserved
    const visualizer = mockConfigStore.get('extensions.widgets.visualizer');
    subt.equal(visualizer.showGrid, true, 'should preserve existing widgets');
    subt.end();
  });

  t.test('GET /api/extensions - handles missing query object', (subt) => {
    const extensions = {
      widgets: { visualizer: { showGrid: true } },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: undefined, // no query object at all
    });
    const res = createMockResponse();

    apiExtensions.get(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, extensions, 'should return all extensions when query is undefined');
    subt.end();
  });

  t.test('POST /api/extensions - handles missing query object', (subt) => {
    const mockConfigStore = createMockConfigStore({});

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: undefined, // no query object
      body: {
        widgets: { visualizer: { showGrid: true } },
      },
    });
    const res = createMockResponse();

    apiExtensions.set(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: false });
    const stored = mockConfigStore.get('extensions');
    subt.ok(stored.widgets, 'should store data');
    subt.end();
  });

  t.test('DELETE /api/extensions - handles missing query object', (subt) => {
    const extensions = {
      widgets: { visualizer: { showGrid: true } },
    };
    const mockConfigStore = createMockConfigStore({
      extensions: extensions,
    });

    const apiExtensions = proxyquire('../../src/server/api/api.extensions.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
    });

    const req = createMockRequest({
      query: undefined, // no query object
    });
    const res = createMockResponse();

    apiExtensions.unset(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, extensions, 'should return all when query is undefined');
    subt.end();
  });

  t.end();
});
