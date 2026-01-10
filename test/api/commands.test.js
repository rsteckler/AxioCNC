import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse, createMockConfigStore } from './helpers';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../../src/server/constants/index';

test('api.commands', (t) => {
  // Mock dependencies
  let mockConfigStore;
  let mockTaskRunner;
  let mockUuid;
  let apiCommands;

  // Helper to create fresh mocks for each test
  const setupMocks = () => {
    mockConfigStore = createMockConfigStore({ commands: [] });
    mockTaskRunner = {
      run: (commands, title) => {
        return 'mock-task-id-' + Math.random().toString(36).substr(2, 9);
      }
    };
    mockUuid = {
      v4: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
    };

    apiCommands = proxyquire('../../src/server/api/api.commands.js', {
      '../services/configstore': {
        default: mockConfigStore,
      },
      '../services/taskrunner': {
        default: mockTaskRunner,
      },
      'uuid': mockUuid,
      '../lib/logger': {
        default: () => ({
          debug: () => {},
          info: () => {},
          error: () => {},
        }),
      },
      '../config/settings': {
        default: {
          rcfile: '/path/to/config.json'
        },
      },
    });
  };

  t.test('GET /api/commands - fetch - returns all records without paging', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'cmd-1',
        mtime: 1000,
        enabled: true,
        title: 'Command 1',
        commands: 'G0 X0 Y0'
      },
      {
        id: 'cmd-2',
        mtime: 2000,
        enabled: false,
        title: 'Command 2',
        commands: 'G28'
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({ query: {} });
    const res = createMockResponse();

    apiCommands.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.records, 'should have records array');
    subt.equal(res.body.records.length, 2, 'should return all records');
    subt.same(res.body.records[0], {
      id: 'cmd-1',
      mtime: 1000,
      enabled: true,
      title: 'Command 1',
      commands: 'G0 X0 Y0'
    }, 'should return first record with correct fields');
    subt.ok(!res.body.pagination, 'should not have pagination when paging=false');
    subt.end();
  });

  t.test('GET /api/commands - fetch - returns paged records with pagination metadata', (subt) => {
    setupMocks();
    const records = [];
    for (let i = 0; i < 25; i++) {
      records.push({
        id: `cmd-${i}`,
        mtime: 1000 + i,
        enabled: true,
        title: `Command ${i}`,
        commands: `G0 X${i}`
      });
    }
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      query: {
        paging: 'true',
        page: '2',
        pageLength: '10'
      }
    });
    const res = createMockResponse();

    apiCommands.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.pagination, 'should have pagination object');
    subt.equal(res.body.pagination.page, 2, 'should return correct page');
    subt.equal(res.body.pagination.pageLength, 10, 'should return correct pageLength');
    subt.equal(res.body.pagination.totalRecords, 25, 'should return correct totalRecords');
    subt.equal(res.body.records.length, 10, 'should return 10 records for page 2');
    subt.equal(res.body.records[0].id, 'cmd-10', 'should return records starting from index 10');
    subt.end();
  });

  t.test('GET /api/commands - fetch - handles invalid page/pageLength', (subt) => {
    setupMocks();
    const records = [{ id: 'cmd-1', title: 'Test', commands: 'G0' }];
    mockConfigStore._data.commands = records;

    // Test invalid page (negative) - getPagingRange adjusts internally but metadata uses original
    const req1 = createMockRequest({
      query: {
        paging: 'true',
        page: '-1',
        pageLength: '10'
      }
    });
    const res1 = createMockResponse();
    apiCommands.fetch(req1, res1);
    subt.equal(res1.statusCode, 200, 'should handle negative page');
    // Note: pagination metadata uses original query param, but records use adjusted range
    subt.equal(res1.body.pagination.page, -1, 'pagination metadata uses original query param');
    subt.equal(res1.body.records.length, 1, 'should return correct records using adjusted range');

    // Test invalid pageLength (zero) - getPagingRange adjusts internally
    const req2 = createMockRequest({
      query: {
        paging: 'true',
        page: '1',
        pageLength: '0'
      }
    });
    const res2 = createMockResponse();
    apiCommands.fetch(req2, res2);
    subt.equal(res2.statusCode, 200, 'should handle zero pageLength');
    subt.equal(res2.body.pagination.pageLength, 0, 'pagination metadata uses original query param');
    subt.equal(res2.body.records.length, 1, 'should return correct records using adjusted range');

    // Test page beyond total records - getPagingRange adjusts to last page
    const req3 = createMockRequest({
      query: {
        paging: 'true',
        page: '100',
        pageLength: '10'
      }
    });
    const res3 = createMockResponse();
    apiCommands.fetch(req3, res3);
    subt.equal(res3.statusCode, 200, 'should handle page beyond total');
    subt.equal(res3.body.pagination.page, 100, 'pagination metadata uses original query param');
    subt.equal(res3.body.records.length, 1, 'should return records from last valid page');

    subt.end();
  });

  t.test('GET /api/commands - fetch - sanitizes records (adds IDs, defaults, converts command to commands)', (subt) => {
    setupMocks();
    const records = [
      {
        // Missing ID - should be added
        mtime: 1000,
        title: 'Command 1',
        commands: 'G0 X0'
      },
      {
        id: 'existing-id',
        // Missing enabled - should default to true
        mtime: 2000,
        title: 'Command 2',
        commands: 'G28'
      },
      {
        id: 'cmd-3',
        enabled: false,
        mtime: 3000,
        title: 'Command 3',
        // Has 'command' instead of 'commands' - should be converted
        command: 'G90'
      },
      // Not a plain object - should be converted to {}
      ['not', 'an', 'object']
    ];

    mockConfigStore._data.commands = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiCommands.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.records.length, 4, 'should return all records');

    // First record should have auto-generated ID
    subt.ok(res.body.records[0].id, 'first record should have ID');
    subt.equal(res.body.records[0].enabled, true, 'first record should default enabled to true');
    subt.equal(res.body.records[0].commands, 'G0 X0', 'first record should have commands');

    // Second record should keep existing ID and default enabled to true
    subt.equal(res.body.records[1].id, 'existing-id', 'second record should keep existing ID');
    subt.equal(res.body.records[1].enabled, true, 'second record should default enabled to true');

    // Third record should convert 'command' to 'commands'
    subt.equal(res.body.records[2].id, 'cmd-3', 'third record should keep ID');
    subt.equal(res.body.records[2].commands, 'G90', 'third record should convert command to commands');
    subt.ok(!res.body.records[2].command, 'third record should not have command field');

    // Fourth record should be sanitized to plain object (converted from array to {})
    subt.ok(typeof res.body.records[3] === 'object' && !Array.isArray(res.body.records[3]), 'fourth record should be plain object');
    subt.ok(res.body.records[3].id, 'fourth record should have ID after sanitization');
    // Non-plain objects lose their original properties, so it becomes {} with just id and defaults
    subt.equal(res.body.records[3].enabled, true, 'fourth record should default enabled to true');
    subt.equal(res.body.records[3].commands, '', 'fourth record should default commands to empty string');

    // Check that configStore was updated with sanitized records
    const storedRecords = mockConfigStore._data.commands;
    subt.ok(storedRecords[0].id, 'stored records should have IDs');
    subt.equal(storedRecords[2].commands, 'G90', 'stored records should have commands not command');
    subt.ok(typeof storedRecords[3] === 'object' && !Array.isArray(storedRecords[3]), 'stored record should be sanitized to object');

    subt.end();
  });

  t.test('GET /api/commands - fetch - returns empty array when no commands', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [];

    const req = createMockRequest();
    const res = createMockResponse();

    apiCommands.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(Array.isArray(res.body.records), 'should have records array');
    subt.equal(res.body.records.length, 0, 'should return empty array');
    subt.end();
  });

  t.test('POST /api/commands - create - creates record with required fields', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [];

    const req = createMockRequest({
      body: {
        title: 'Test Command',
        commands: 'G0 X10 Y10'
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.id, 'should return generated ID');
    subt.ok(res.body.mtime, 'should return mtime');
    subt.ok(typeof res.body.mtime === 'number', 'mtime should be a number');
    subt.ok(res.body.mtime > 0, 'mtime should be positive');

    // Check that record was stored
    const storedRecords = mockConfigStore._data.commands;
    subt.equal(storedRecords.length, 1, 'should store one record');
    subt.equal(storedRecords[0].id, res.body.id, 'stored record should have same ID');
    subt.equal(storedRecords[0].title, 'Test Command', 'stored record should have title');
    subt.equal(storedRecords[0].commands, 'G0 X10 Y10', 'stored record should have commands');
    subt.equal(storedRecords[0].enabled, true, 'stored record should default enabled to true');
    subt.equal(storedRecords[0].mtime, res.body.mtime, 'stored record should have mtime');

    subt.end();
  });

  t.test('POST /api/commands - create - sets enabled default to true', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [];

    const req = createMockRequest({
      body: {
        title: 'Test Command',
        commands: 'G0 X10',
        enabled: false
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.commands;
    subt.equal(storedRecords[0].enabled, false, 'should respect provided enabled value');

    // Test with enabled: undefined (should default to true)
    const req2 = createMockRequest({
      body: {
        title: 'Test Command 2',
        commands: 'G28'
        // enabled not provided
      }
    });
    const res2 = createMockResponse();
    apiCommands.create(req2, res2);

    const storedRecords2 = mockConfigStore._data.commands;
    subt.equal(storedRecords2[1].enabled, true, 'should default enabled to true when not provided');

    subt.end();
  });

  t.test('POST /api/commands - create - returns 400 when title is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        title: '',
        commands: 'G0 X10'
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /title.*must not be empty/i, 'error message should mention title');
    subt.end();
  });

  t.test('POST /api/commands - create - returns 400 when title is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        commands: 'G0 X10'
        // title missing
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /title.*must not be empty/i, 'error message should mention title');
    subt.end();
  });

  t.test('POST /api/commands - create - returns 400 when commands is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        title: 'Test Command',
        commands: ''
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /commands.*must not be empty/i, 'error message should mention commands');
    subt.end();
  });

  t.test('POST /api/commands - create - returns 400 when commands is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        title: 'Test Command'
        // commands missing
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /commands.*must not be empty/i, 'error message should mention commands');
    subt.end();
  });

  t.test('POST /api/commands - create - handles config.set errors', (subt) => {
    setupMocks();
    // Make config.set throw an error
    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      body: {
        title: 'Test Command',
        commands: 'G0 X10'
      }
    });
    const res = createMockResponse();

    apiCommands.create(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/commands/:id - read - returns record by ID', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'cmd-1',
        mtime: 1000,
        enabled: true,
        title: 'Command 1',
        commands: 'G0 X0 Y0'
      },
      {
        id: 'cmd-2',
        mtime: 2000,
        enabled: false,
        title: 'Command 2',
        commands: 'G28'
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      params: { id: 'cmd-2' }
    });
    const res = createMockResponse();

    apiCommands.read(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, {
      id: 'cmd-2',
      mtime: 2000,
      enabled: false,
      title: 'Command 2',
      commands: 'G28'
    }, 'should return correct record');
    subt.end();
  });

  t.test('GET /api/commands/:id - read - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [
      { id: 'cmd-1', title: 'Test', commands: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiCommands.read(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.ok(res.body.msg, 'should have error message');
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('GET /api/commands/:id - read - sanitizes records before reading', (subt) => {
    setupMocks();
    // Record without ID - should be sanitized
    const records = [
      {
        mtime: 1000,
        title: 'Command 1',
        commands: 'G0 X0'
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      params: { id: mockConfigStore._data.commands[0]?.id }
    });
    const res = createMockResponse();

    // First call sanitizes and adds ID
    apiCommands.read(req, res);

    subt.equal(res.statusCode, 200, 'should find record after sanitization');
    subt.ok(res.body.id, 'should return record with ID');
    subt.end();
  });

  t.test('PUT /api/commands/:id - update - updates existing record', (subt) => {
    setupMocks();
    const originalTime = 1000;
    const records = [
      {
        id: 'cmd-1',
        mtime: originalTime,
        enabled: true,
        title: 'Original Title',
        commands: 'G0 X0'
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      params: { id: 'cmd-1' },
      body: {
        title: 'Updated Title',
        commands: 'G0 X10 Y10',
        enabled: false
      }
    });
    const res = createMockResponse();

    apiCommands.update(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.id, 'should return ID');
    subt.ok(res.body.mtime, 'should return updated mtime');
    subt.ok(res.body.mtime > originalTime, 'mtime should be updated to current time');

    const storedRecords = mockConfigStore._data.commands;
    subt.equal(storedRecords[0].title, 'Updated Title', 'should update title');
    subt.equal(storedRecords[0].commands, 'G0 X10 Y10', 'should update commands');
    subt.equal(storedRecords[0].enabled, false, 'should update enabled');
    subt.equal(storedRecords[0].mtime, res.body.mtime, 'should update mtime');
    subt.end();
  });

  t.test('PUT /api/commands/:id - update - handles partial updates', (subt) => {
    setupMocks();
    const originalTime = 1000;
    const records = [
      {
        id: 'cmd-1',
        mtime: originalTime,
        enabled: true,
        title: 'Original Title',
        commands: 'G0 X0'
      }
    ];
    mockConfigStore._data.commands = records;

    // Only update title
    const req = createMockRequest({
      params: { id: 'cmd-1' },
      body: {
        title: 'Partial Update'
      }
    });
    const res = createMockResponse();

    apiCommands.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.commands;
    subt.equal(storedRecords[0].title, 'Partial Update', 'should update title');
    subt.equal(storedRecords[0].commands, 'G0 X0', 'should keep original commands');
    subt.equal(storedRecords[0].enabled, true, 'should keep original enabled');
    subt.end();
  });

  t.test('PUT /api/commands/:id - update - removes deprecated command field', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'cmd-1',
        mtime: 1000,
        enabled: true,
        title: 'Test',
        commands: 'G0 X0',
        command: 'deprecated field' // Should be removed
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      params: { id: 'cmd-1' },
      body: {
        title: 'Updated'
      }
    });
    const res = createMockResponse();

    apiCommands.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.commands;
    subt.ok(!storedRecords[0].command, 'should remove deprecated command field');
    subt.end();
  });

  t.test('PUT /api/commands/:id - update - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [
      { id: 'cmd-1', title: 'Test', commands: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' },
      body: {
        title: 'Updated'
      }
    });
    const res = createMockResponse();

    apiCommands.update(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('PUT /api/commands/:id - update - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'cmd-1', mtime: 1000, enabled: true, title: 'Test', commands: 'G0' }
    ];
    mockConfigStore._data.commands = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'cmd-1' },
      body: {
        title: 'Updated'
      }
    });
    const res = createMockResponse();

    apiCommands.update(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('DELETE /api/commands/:id - __delete - deletes record', (subt) => {
    setupMocks();
    const records = [
      { id: 'cmd-1', mtime: 1000, enabled: true, title: 'Command 1', commands: 'G0' },
      { id: 'cmd-2', mtime: 2000, enabled: true, title: 'Command 2', commands: 'G28' },
      { id: 'cmd-3', mtime: 3000, enabled: true, title: 'Command 3', commands: 'G90' }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      params: { id: 'cmd-2' }
    });
    const res = createMockResponse();

    apiCommands.__delete(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.id, 'cmd-2', 'should return deleted record ID');

    const storedRecords = mockConfigStore._data.commands;
    subt.equal(storedRecords.length, 2, 'should remove one record');
    subt.equal(storedRecords[0].id, 'cmd-1', 'should keep first record');
    subt.equal(storedRecords[1].id, 'cmd-3', 'should keep third record');
    subt.ok(!storedRecords.find(r => r.id === 'cmd-2'), 'should not have deleted record');
    subt.end();
  });

  t.test('DELETE /api/commands/:id - __delete - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [
      { id: 'cmd-1', title: 'Test', commands: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiCommands.__delete(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('DELETE /api/commands/:id - __delete - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'cmd-1', mtime: 1000, enabled: true, title: 'Test', commands: 'G0' }
    ];
    mockConfigStore._data.commands = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'cmd-1' }
    });
    const res = createMockResponse();

    apiCommands.__delete(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('POST /api/commands/run/:id - run - executes command via taskRunner', (subt) => {
    setupMocks();
    let runCalled = false;
    let runCommands = null;
    let runTitle = null;
    mockTaskRunner.run = (commands, title) => {
      runCalled = true;
      runCommands = commands;
      runTitle = title;
      return 'task-id-123';
    };

    const records = [
      {
        id: 'cmd-1',
        mtime: 1000,
        enabled: true,
        title: 'Test Command',
        commands: 'G0 X10 Y10'
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest({
      params: { id: 'cmd-1' }
    });
    const res = createMockResponse();

    apiCommands.run(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.taskId, 'should return taskId');
    subt.equal(res.body.taskId, 'task-id-123', 'should return taskId from taskRunner');
    subt.ok(runCalled, 'should call taskRunner.run');
    subt.equal(runCommands, 'G0 X10 Y10', 'should pass commands to taskRunner');
    subt.equal(runTitle, 'Test Command', 'should pass title to taskRunner');
    subt.end();
  });

  t.test('POST /api/commands/run/:id - run - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.commands = [
      { id: 'cmd-1', title: 'Test', commands: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiCommands.run(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('GET /api/commands - fetch - filters records to only include id, mtime, enabled, title, commands', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'cmd-1',
        mtime: 1000,
        enabled: true,
        title: 'Command 1',
        commands: 'G0 X0',
        extraField: 'should not appear',
        anotherField: 123
      }
    ];
    mockConfigStore._data.commands = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiCommands.fetch(req, res);

    subt.equal(res.statusCode, 200);
    const returnedRecord = res.body.records[0];
    subt.ok(returnedRecord.id, 'should have id');
    subt.ok(returnedRecord.mtime, 'should have mtime');
    subt.ok('enabled' in returnedRecord, 'should have enabled');
    subt.ok(returnedRecord.title, 'should have title');
    subt.ok(returnedRecord.commands, 'should have commands');
    subt.ok(!returnedRecord.extraField, 'should not have extraField');
    subt.ok(!returnedRecord.anotherField, 'should not have anotherField');
    subt.end();
  });

  t.test('GET /api/commands - fetch - sanitizes records on every fetch', (subt) => {
    setupMocks();
    // Start with records missing IDs
    mockConfigStore._data.commands = [
      { title: 'Command 1', commands: 'G0 X0' },
      { title: 'Command 2', commands: 'G28' }
    ];

    const req1 = createMockRequest();
    const res1 = createMockResponse();
    apiCommands.fetch(req1, res1);

    subt.equal(res1.body.records.length, 2);
    const id1 = res1.body.records[0].id;
    const id2 = res1.body.records[1].id;
    subt.ok(id1, 'first record should have ID after first fetch');
    subt.ok(id2, 'second record should have ID after first fetch');

    // Second fetch should not regenerate IDs (they're already stored)
    const req2 = createMockRequest();
    const res2 = createMockResponse();
    apiCommands.fetch(req2, res2);

    subt.equal(res2.body.records[0].id, id1, 'should keep same ID on second fetch');
    subt.equal(res2.body.records[1].id, id2, 'should keep same ID on second fetch');
    subt.end();
  });

  t.end();
});
