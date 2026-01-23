import { test } from 'tap';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConfigStore } from '../src/services/configstore/index.js';

// Helper to create a temporary file for testing
const createTempFile = () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'configstore-test-'));
  const tempFile = path.join(tempDir, 'test-config.json');
  return { tempDir, tempFile };
};

// Helper to cleanup temp file and close watchers
const cleanupTempFile = (tempDir, tempFile, store = null) => {
  try {
    if (store) {
      // Close watcher if it exists - fs.watchFile returns an object with close() method
      if (store.watcher) {
        try {
          if (typeof store.watcher.close === 'function') {
            store.watcher.close();
          }
        } catch (e) {
          // Ignore close errors
        }
        // Also use unwatchFile as backup
        if (store.file) {
          fs.unwatchFile(store.file);
        }
        store.watcher = null;
      }
    }
    if (fs.existsSync(tempFile)) {
      fs.unwatchFile(tempFile);
      fs.unlinkSync(tempFile);
    }
    // Remove directory contents manually to avoid hanging
    if (fs.existsSync(tempDir)) {
      try {
        const rimraf = (dir) => {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
              const fullPath = path.join(dir, file);
              if (fs.statSync(fullPath).isDirectory()) {
                rimraf(fullPath);
              } else {
                fs.unlinkSync(fullPath);
              }
            });
            fs.rmdirSync(dir);
          }
        };
        rimraf(tempDir);
      } catch (e) {
        // Ignore directory cleanup errors
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
};

test('ConfigStore', { timeout: 30000 }, (t) => {
  t.test('load - loads existing file', (subt) => {
    console.log('[TEST] Starting: load - loads existing file');
    const { tempDir, tempFile } = createTempFile();
    console.log('[TEST] Created temp file:', tempFile);
    const testConfig = { foo: 'bar', nested: { key: 'value' } };
    fs.writeFileSync(tempFile, JSON.stringify(testConfig), 'utf8');
    console.log('[TEST] Wrote test config to file');

    const store = new ConfigStore();
    console.log('[TEST] Created ConfigStore instance');
    const result = store.load(tempFile);
    console.log('[TEST] Called store.load(), result:', result);

    // ConfigStore now initializes with default settings and extensions
    subt.ok(result, 'should return config object');
    subt.ok(result.settings, 'should have settings');
    subt.ok(result.extensions, 'should have extensions');
    subt.same(result.extensions, {}, 'extensions should be empty object');
    // Check that original data is preserved
    subt.equal(store.get('foo'), 'bar');
    subt.equal(store.get('nested.key'), 'value');
    subt.equal(store.get('foo'), 'bar');
    subt.equal(store.get('nested.key'), 'value');
    
    // Immediately close watcher to prevent hanging
    console.log('[TEST] Closing watcher...');
    if (store.watcher) {
      fs.unwatchFile(store.file);
      store.watcher = null;
    }
    console.log('[TEST] Cleaning up temp file...');
    cleanupTempFile(tempDir, tempFile, store);
    console.log('[TEST] Completed: load - loads existing file');
    subt.end();
  });

  t.test('load - creates file if it does not exist', (subt) => {
    console.log('[TEST] Starting: load - creates file if it does not exist');
    const { tempDir, tempFile } = createTempFile();
    console.log('[TEST] Created temp file:', tempFile);
    const store = new ConfigStore();
    console.log('[TEST] Created ConfigStore instance');
    const result = store.load(tempFile);
    console.log('[TEST] Called store.load(), result:', result);

    subt.ok(fs.existsSync(tempFile), 'should create file');
    subt.ok(result, 'should return config object');
    subt.ok(result.settings, 'should have settings');
    subt.ok(result.extensions, 'should have extensions');
    subt.same(result.extensions, {}, 'extensions should be empty object');
    
    // Immediately close watcher to prevent hanging
    console.log('[TEST] Closing watcher...');
    if (store.watcher) {
      fs.unwatchFile(store.file);
      store.watcher = null;
    }
    console.log('[TEST] Cleaning up temp file...');
    cleanupTempFile(tempDir, tempFile, store);
    console.log('[TEST] Completed: load - creates file if it does not exist');
    subt.end();
  });

  t.test('load - creates directory if it does not exist', (subt) => {
    console.log('[TEST] Starting: load - creates directory if it does not exist');
    const { tempDir } = createTempFile();
    const nestedDir = path.join(tempDir, 'nested', 'path');
    const nestedFile = path.join(nestedDir, 'config.json');
    console.log('[TEST] Nested file path:', nestedFile);

    const store = new ConfigStore();
    console.log('[TEST] Created ConfigStore instance');
    store.load(nestedFile);
    console.log('[TEST] Called store.load()');

    subt.ok(fs.existsSync(nestedFile), 'should create nested file');

    // Clean up watchers to prevent hanging
    if (store.watcher) {
      if (typeof store.watcher.close === 'function') {
        store.watcher.close();
      }
      fs.unwatchFile(nestedFile);
      store.watcher = null;
    }

    subt.end();
  });

  t.test('load - emits load event', (subt) => {
    console.log('[TEST] Starting: load - emits load event');
    const { tempDir, tempFile } = createTempFile();
    console.log('[TEST] Created temp file:', tempFile);
    const testConfig = { foo: 'bar' };
    fs.writeFileSync(tempFile, JSON.stringify(testConfig), 'utf8');
    console.log('[TEST] Wrote test config to file');

    const store = new ConfigStore();
    console.log('[TEST] Created ConfigStore instance');
    let loadEmitted = false;
    let loadConfig = null;

    store.on('load', (config) => {
      console.log('[TEST] Load event emitted');
      loadEmitted = true;
      loadConfig = config;
    });

    store.load(tempFile);
    console.log('[TEST] Called store.load()');

    subt.ok(loadEmitted, 'should emit load event');
    subt.ok(loadConfig, 'load event should receive config');
    subt.ok(loadConfig.settings, 'config should have settings');
    subt.ok(loadConfig.extensions, 'config should have extensions');
    subt.equal(store.get('foo'), 'bar', 'original data should be preserved');
    
    // Immediately close watcher to prevent hanging
    console.log('[TEST] Closing watcher...');
    if (store.watcher) {
      fs.unwatchFile(store.file);
      store.watcher = null;
    }
    console.log('[TEST] Cleaning up temp file...');
    cleanupTempFile(tempDir, tempFile, store);
    console.log('[TEST] Completed: load - emits load event');
    subt.end();
  });

  t.test('reload - reloads config from file', (subt) => {
    console.log('[TEST] Starting: reload - reloads config from file');
    const { tempDir, tempFile } = createTempFile();
    console.log('[TEST] Created temp file:', tempFile);
    const initialConfig = { foo: 'bar' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');
    console.log('[TEST] Wrote initial config');

    const store = new ConfigStore();
    store.file = tempFile;
    console.log('[TEST] Set store.file, calling reload()');
    store.reload();
    console.log('[TEST] First reload completed');

    // Modify file externally
    const updatedConfig = { foo: 'baz', new: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(updatedConfig), 'utf8');
    console.log('[TEST] Modified file externally');

    const result = store.reload();
    console.log('[TEST] Second reload completed, result:', result);

    subt.ok(result, 'should return true');
    subt.equal(store.get('foo'), 'baz', 'should reload updated value');
    subt.equal(store.get('new'), 'value', 'should reload new values');
    
    cleanupTempFile(tempDir, tempFile, store);
    console.log('[TEST] Completed: reload - reloads config from file');
    subt.end();
  });

  t.test('reload - returns false on parse error', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    fs.writeFileSync(tempFile, 'invalid json', 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;

    let errorEmitted = false;
    store.on('error', () => {
      errorEmitted = true;
    });

    const result = store.reload();

    subt.notOk(result, 'should return false on error');
    subt.ok(errorEmitted, 'should emit error event');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('reload - handles non-plain object config', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    fs.writeFileSync(tempFile, JSON.stringify('not an object'), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;

    const result = store.reload();

    subt.ok(result, 'should return true');
    subt.ok(store.config, 'should have config object');
    subt.ok(store.config.settings, 'should have settings');
    subt.ok(store.config.extensions, 'should have extensions');
    subt.same(store.config.extensions, {}, 'extensions should be empty object');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('reload - initializes settings with defaults', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    fs.writeFileSync(tempFile, JSON.stringify({}), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.reload();

    const settings = store.get('settings');
    subt.ok(settings, 'should have settings');
    subt.ok(settings.machine, 'settings should have machine property');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('reload - merges existing settings with defaults', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const config = {
      settings: {
        lang: 'es'
      }
    };
    fs.writeFileSync(tempFile, JSON.stringify(config), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.reload();

    const settings = store.get('settings');
    subt.equal(settings.lang, 'es', 'should preserve existing settings');
    subt.ok(settings.machine, 'should merge with defaults');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('reload - initializes extensions as empty object if not present', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    fs.writeFileSync(tempFile, JSON.stringify({}), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.reload();

    const extensions = store.get('extensions');
    subt.same(extensions, {}, 'should initialize extensions as empty object');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('sync - writes config to file', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const store = new ConfigStore();
    store.file = tempFile;
    store.config = { foo: 'bar', nested: { key: 'value' } };

    const result = store.sync();

    subt.ok(result, 'should return true');
    subt.ok(fs.existsSync(tempFile), 'should create file');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.same(content, { foo: 'bar', nested: { key: 'value' } }, 'should write correct content');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('sync - formats JSON with indentation', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const store = new ConfigStore();
    store.file = tempFile;
    store.config = { foo: 'bar' };

    store.sync();

    const content = fs.readFileSync(tempFile, 'utf8');
    subt.ok(content.includes('\n'), 'should format with newlines');
    subt.ok(content.includes('    '), 'should format with 4-space indentation');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('sync - returns false on write error', (subt) => {
    const store = new ConfigStore();
    store.file = '/invalid/path/config.json'; // Invalid path

    let errorEmitted = false;
    store.on('error', () => {
      errorEmitted = true;
    });

    const result = store.sync();

    subt.notOk(result, 'should return false on error');
    subt.ok(errorEmitted, 'should emit error event');
    subt.end();
  });

  t.test('has - checks if key exists', (subt) => {
    const store = new ConfigStore();
    store.config = { foo: 'bar', nested: { key: 'value' } };

    subt.ok(store.has('foo'), 'should return true for existing key');
    subt.ok(store.has('nested.key'), 'should return true for nested key');
    subt.notOk(store.has('nonexistent'), 'should return false for non-existent key');
    subt.end();
  });

  t.test('get - retrieves value by key', (subt) => {
    const store = new ConfigStore();
    store.config = { foo: 'bar', nested: { key: 'value' } };

    subt.equal(store.get('foo'), 'bar');
    subt.equal(store.get('nested.key'), 'value');
    subt.end();
  });

  t.test('get - returns defaultValue when key not found', (subt) => {
    const store = new ConfigStore();
    store.config = { foo: 'bar' };

    subt.equal(store.get('nonexistent', 'default'), 'default');
    subt.equal(store.get('nested.key', 'default'), 'default');
    subt.end();
  });

  t.test('get - returns entire config when key is undefined', (subt) => {
    const testConfig = { foo: 'bar', nested: { key: 'value' } };
    const store = new ConfigStore();
    store.config = testConfig;

    const result = store.get();

    subt.same(result, testConfig);
    subt.end();
  });

  t.test('get - reloads if config is null/undefined', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const testConfig = { foo: 'bar' };
    fs.writeFileSync(tempFile, JSON.stringify(testConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = null; // Simulate uninitialized state

    const result = store.get('foo');

    subt.equal(result, 'bar', 'should reload and return value');
    subt.ok(store.config, 'should have config');
    subt.ok(store.config.settings, 'should have settings');
    subt.ok(store.config.extensions, 'should have extensions');
    subt.equal(store.config.foo, 'bar', 'should preserve original data');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('set - sets value and syncs to file', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    fs.writeFileSync(tempFile, JSON.stringify({}), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = {};
    // Don't use load() to avoid creating watcher

    store.set('foo', 'bar');

    subt.equal(store.get('foo'), 'bar', 'should set value');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.equal(content.foo, 'bar', 'should sync to file');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('set - sets nested value', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    fs.writeFileSync(tempFile, JSON.stringify({}), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = {};
    // Don't use load() to avoid creating watcher

    store.set('nested.key', 'value');

    subt.equal(store.get('nested.key'), 'value');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.equal(content.nested.key, 'value', 'should sync nested value to file');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('set - does not sync when silent option is true', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { existing: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    store.set('new', 'value', { silent: true });

    subt.equal(store.get('new'), 'value', 'should set value in memory');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.notOk(content.new, 'should not sync to file when silent');
    subt.equal(content.existing, 'value', 'should preserve existing values');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('set - does nothing when key is undefined', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { existing: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    store.set(undefined, 'value');

    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.same(content, initialConfig, 'should not modify config');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('set - reloads before setting', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { foo: 'bar' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    // Modify file externally
    const externalConfig = { foo: 'baz', external: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(externalConfig), 'utf8');

    store.set('new', 'value');

    // Should have reloaded external changes before setting
    subt.equal(store.get('foo'), 'baz', 'should reload external changes');
    subt.equal(store.get('external'), 'value', 'should include external changes');
    subt.equal(store.get('new'), 'value', 'should set new value');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('unset - removes key and syncs to file', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { foo: 'bar', baz: 'qux' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    store.unset('baz');

    subt.equal(store.get('baz'), undefined, 'should remove key');
    subt.equal(store.get('foo'), 'bar', 'should preserve other keys');
    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.notOk(content.baz, 'should sync removal to file');
    subt.equal(content.foo, 'bar', 'should preserve other keys in file');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('unset - removes nested key', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { nested: { key: 'value', other: 'data' } };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    store.unset('nested.key');

    subt.equal(store.get('nested.key'), undefined, 'should remove nested key');
    subt.equal(store.get('nested.other'), 'data', 'should preserve other nested keys');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('unset - does nothing when key is undefined', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { existing: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    store.unset(undefined);

    const content = JSON.parse(fs.readFileSync(tempFile, 'utf8'));
    subt.same(content, initialConfig, 'should not modify config');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('unset - reloads before unsetting', (subt) => {
    const { tempDir, tempFile } = createTempFile();
    const initialConfig = { foo: 'bar', toRemove: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(initialConfig), 'utf8');

    const store = new ConfigStore();
    store.file = tempFile;
    store.config = initialConfig;
    // Don't use load() to avoid creating watcher

    // Modify file externally
    const externalConfig = { foo: 'baz', toRemove: 'value', external: 'value' };
    fs.writeFileSync(tempFile, JSON.stringify(externalConfig), 'utf8');

    store.unset('toRemove');

    // Should have reloaded external changes before unsetting
    subt.equal(store.get('foo'), 'baz', 'should reload external changes');
    subt.equal(store.get('external'), 'value', 'should include external changes');
    subt.equal(store.get('toRemove'), undefined, 'should remove key');
    
    cleanupTempFile(tempDir, tempFile, store);
    subt.end();
  });

  t.test('load - emits error event on file system error', (subt) => {
    const store = new ConfigStore();
    let errorEmitted = false;
    let errorValue = null;

    store.on('error', (err) => {
      errorEmitted = true;
      errorValue = err;
    });

    // Try to load from invalid path (parent directory doesn't exist)
    const invalidPath = '/nonexistent/path/that/does/not/exist/config.json';
    store.load(invalidPath);

    subt.ok(errorEmitted, 'should emit error event');
    subt.ok(errorValue, 'error event should have error value');
    
    // Close watcher if it was created despite error
    console.log('[TEST] Closing watcher after error test...');
    if (store.watcher) {
      fs.unwatchFile(store.file);
      store.watcher = null;
    }
    console.log('[TEST] Completed: load - emits error event on file system error');
    subt.end();
  });

  t.test('file watcher - closes previous watcher on new load', (subt) => {
    console.log('[TEST] Starting: file watcher - closes previous watcher on new load');
    const { tempDir } = createTempFile();
    const file1 = path.join(tempDir, 'config1.json');
    const file2 = path.join(tempDir, 'config2.json');
    console.log('[TEST] Created files:', file1, file2);
    fs.writeFileSync(file1, JSON.stringify({ file: 1 }), 'utf8');
    fs.writeFileSync(file2, JSON.stringify({ file: 2 }), 'utf8');
    console.log('[TEST] Wrote test configs to files');

    const store = new ConfigStore();
    console.log('[TEST] Created ConfigStore instance');
    console.log('[TEST] Loading file1...');
    store.load(file1);
    console.log('[TEST] Loaded file1, watcher:', !!store.watcher);

    subt.ok(store.watcher, 'should have watcher for first file');

    console.log('[TEST] Loading file2...');
    store.load(file2);
    console.log('[TEST] Loaded file2, watcher:', !!store.watcher);

    subt.ok(store.watcher, 'should have watcher for second file');
    subt.equal(store.file, file2, 'should update file path');
    subt.equal(store.get('file'), 2, 'should load second file data');
    
    // Clean up watchers - close both watchers
    console.log('[TEST] Closing watchers...');
    if (store.watcher) {
      // The watcher from fs.watchFile can be closed, but we also need to unwatch
      try {
        if (typeof store.watcher.close === 'function') {
          store.watcher.close();
        }
      } catch (e) {
        // Ignore
      }
      fs.unwatchFile(store.file);
      store.watcher = null;
    }
    console.log('[TEST] Cleaning up temp files...');
    cleanupTempFile(tempDir, file1);
    cleanupTempFile(tempDir, file2);
    console.log('[TEST] Completed: file watcher - closes previous watcher on new load');
    subt.end();
  });

  // All subtests completed - ensure main test ends properly
  setTimeout(() => {
    t.end();
  }, 50);
});
