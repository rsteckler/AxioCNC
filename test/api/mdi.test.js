import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse, createMockConfigStore } from './helpers';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../../src/server/constants/index';

test('api.mdi', (t) => {
  // Mock dependencies
  let mockConfigStore;
  let mockUuid;
  let apiMdi;

  // Helper to create fresh mocks for each test
  const setupMocks = () => {
    mockConfigStore = createMockConfigStore({ mdi: [] });
    mockUuid = {
      v4: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
    };

    apiMdi = proxyquire('../../src/server/api/api.mdi.js', {
      '../services/configstore': {
        default: mockConfigStore,
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
          cncrc: '/path/to/cncrc.json'
        },
      },
    });
  };

  t.test('GET /api/mdi - fetch - returns all records without paging', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'MDI Command 1',
        command: 'G0 X10 Y10',
        grid: { x: 10, y: 10 }
      },
      {
        id: 'mdi-2',
        name: 'MDI Command 2',
        command: 'G28',
        grid: {}
      }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest({ query: {} });
    const res = createMockResponse();

    apiMdi.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.records, 'should have records array');
    subt.equal(res.body.records.length, 2, 'should return all records');
    subt.same(res.body.records[0], {
      id: 'mdi-1',
      name: 'MDI Command 1',
      command: 'G0 X10 Y10',
      grid: { x: 10, y: 10 }
    }, 'should return first record with correct fields');
    subt.ok(!res.body.pagination, 'should not have pagination when paging=false');
    subt.end();
  });

  t.test('GET /api/mdi - fetch - returns paged records with pagination metadata', (subt) => {
    setupMocks();
    const records = [];
    for (let i = 0; i < 25; i++) {
      records.push({
        id: `mdi-${i}`,
        name: `MDI ${i}`,
        command: `G0 X${i}`,
        grid: {}
      });
    }
    mockConfigStore._data.mdi = records;

    const req = createMockRequest({
      query: {
        paging: 'true',
        page: '2',
        pageLength: '10'
      }
    });
    const res = createMockResponse();

    apiMdi.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.pagination, 'should have pagination object');
    subt.equal(res.body.pagination.page, 2, 'should return correct page');
    subt.equal(res.body.pagination.pageLength, 10, 'should return correct pageLength');
    subt.equal(res.body.pagination.totalRecords, 25, 'should return correct totalRecords');
    subt.equal(res.body.records.length, 10, 'should return 10 records for page 2');
    subt.equal(res.body.records[0].id, 'mdi-10', 'should return records starting from index 10');
    subt.end();
  });

  t.test('GET /api/mdi - fetch - handles invalid page/pageLength', (subt) => {
    setupMocks();
    const records = [{ id: 'mdi-1', name: 'Test', command: 'G0' }];
    mockConfigStore._data.mdi = records;

    // Test invalid page (negative)
    const req1 = createMockRequest({
      query: {
        paging: 'true',
        page: '-1',
        pageLength: '10'
      }
    });
    const res1 = createMockResponse();
    apiMdi.fetch(req1, res1);
    subt.equal(res1.statusCode, 200, 'should handle negative page');
    subt.equal(res1.body.pagination.page, -1, 'pagination metadata uses original query param');
    subt.equal(res1.body.records.length, 1, 'should return correct records using adjusted range');

    // Test invalid pageLength (zero)
    const req2 = createMockRequest({
      query: {
        paging: 'true',
        page: '1',
        pageLength: '0'
      }
    });
    const res2 = createMockResponse();
    apiMdi.fetch(req2, res2);
    subt.equal(res2.statusCode, 200, 'should handle zero pageLength');
    subt.equal(res2.body.pagination.pageLength, 0, 'pagination metadata uses original query param');
    subt.equal(res2.body.records.length, 1, 'should return correct records using adjusted range');

    // Test page beyond total records
    const req3 = createMockRequest({
      query: {
        paging: 'true',
        page: '100',
        pageLength: '10'
      }
    });
    const res3 = createMockResponse();
    apiMdi.fetch(req3, res3);
    subt.equal(res3.statusCode, 200, 'should handle page beyond total');
    subt.equal(res3.body.pagination.page, 100, 'pagination metadata uses original query param');
    subt.equal(res3.body.records.length, 1, 'should return records from last valid page');

    subt.end();
  });

  t.test('GET /api/mdi - fetch - sanitizes records (adds IDs, handles non-plain objects)', (subt) => {
    setupMocks();
    const records = [
      {
        // Missing ID - should be added
        name: 'MDI 1',
        command: 'G0 X0',
        grid: {}
      },
      {
        id: 'existing-id',
        name: 'MDI 2',
        command: 'G28',
        grid: {}
      },
      // Not a plain object - should be converted to {}
      ['not', 'an', 'object']
    ];

    mockConfigStore._data.mdi = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMdi.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.records.length, 3, 'should return all records');

    // First record should have auto-generated ID
    subt.ok(res.body.records[0].id, 'first record should have ID');

    // Second record should keep existing ID
    subt.equal(res.body.records[1].id, 'existing-id', 'second record should keep existing ID');

    // Third record should be sanitized to plain object (converted from array to {})
    subt.ok(typeof res.body.records[2] === 'object' && !Array.isArray(res.body.records[2]), 'third record should be plain object');
    subt.ok(res.body.records[2].id, 'third record should have ID after sanitization');

    // Check that configStore was updated with sanitized records
    const storedRecords = mockConfigStore._data.mdi;
    subt.ok(storedRecords[0].id, 'stored records should have IDs');
    subt.ok(typeof storedRecords[2] === 'object' && !Array.isArray(storedRecords[2]), 'stored record should be sanitized to object');

    subt.end();
  });

  t.test('GET /api/mdi - fetch - defaults grid to empty object when missing', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'Test',
        command: 'G0'
        // grid missing
      }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMdi.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.records[0].grid, 'should have grid');
    subt.same(res.body.records[0].grid, {}, 'should default grid to empty object');
    subt.end();
  });

  t.test('GET /api/mdi - fetch - returns empty array when no mdi records', (subt) => {
    setupMocks();
    mockConfigStore._data.mdi = [];

    const req = createMockRequest();
    const res = createMockResponse();

    apiMdi.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(Array.isArray(res.body.records), 'should have records array');
    subt.equal(res.body.records.length, 0, 'should return empty array');
    subt.end();
  });

  t.test('POST /api/mdi - create - creates record with required fields', (subt) => {
    setupMocks();
    mockConfigStore._data.mdi = [];

    const req = createMockRequest({
      body: {
        name: 'Test MDI',
        command: 'G0 X10 Y10',
        grid: { x: 10, y: 10 }
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: null }, 'should return { err: null }');

    // Check that record was stored
    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords.length, 1, 'should store one record');
    subt.ok(storedRecords[0].id, 'stored record should have ID');
    subt.equal(storedRecords[0].name, 'Test MDI', 'stored record should have name');
    subt.equal(storedRecords[0].command, 'G0 X10 Y10', 'stored record should have command');
    subt.same(storedRecords[0].grid, { x: 10, y: 10 }, 'stored record should have grid');
    subt.end();
  });

  t.test('POST /api/mdi - create - defaults grid to empty object when not provided', (subt) => {
    setupMocks();
    mockConfigStore._data.mdi = [];

    const req = createMockRequest({
      body: {
        name: 'Test MDI',
        command: 'G0 X10'
        // grid not provided
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.mdi;
    subt.ok(storedRecords[0].grid, 'should have grid');
    subt.same(storedRecords[0].grid, {}, 'should default grid to empty object');
    subt.end();
  });

  t.test('POST /api/mdi - create - returns 400 when name is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: '',
        command: 'G0 X10'
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /name.*must not be empty/i, 'error message should mention name');
    subt.end();
  });

  t.test('POST /api/mdi - create - returns 400 when name is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        command: 'G0 X10'
        // name missing
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /name.*must not be empty/i, 'error message should mention name');
    subt.end();
  });

  t.test('POST /api/mdi - create - returns 400 when command is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: 'Test MDI',
        command: ''
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /command.*must not be empty/i, 'error message should mention command');
    subt.end();
  });

  t.test('POST /api/mdi - create - returns 400 when command is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: 'Test MDI'
        // command missing
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /command.*must not be empty/i, 'error message should mention command');
    subt.end();
  });

  t.test('POST /api/mdi - create - handles config.set errors', (subt) => {
    setupMocks();
    // Make config.set throw an error
    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      body: {
        name: 'Test MDI',
        command: 'G0 X10'
      }
    });
    const res = createMockResponse();

    apiMdi.create(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/mdi/:id - read - returns record by ID', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'MDI Command 1',
        command: 'G0 X0 Y0',
        grid: { x: 0, y: 0 }
      },
      {
        id: 'mdi-2',
        name: 'MDI Command 2',
        command: 'G28',
        grid: {}
      }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest({
      params: { id: 'mdi-2' }
    });
    const res = createMockResponse();

    apiMdi.read(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, {
      id: 'mdi-2',
      name: 'MDI Command 2',
      command: 'G28',
      grid: {}
    }, 'should return correct record');
    subt.end();
  });

  t.test('GET /api/mdi/:id - read - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.mdi = [
      { id: 'mdi-1', name: 'Test', command: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiMdi.read(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.ok(res.body.msg, 'should have error message');
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('GET /api/mdi/:id - read - sanitizes records before reading', (subt) => {
    setupMocks();
    // Record without ID - should be sanitized
    const records = [
      {
        name: 'Test MDI',
        command: 'G0 X0',
        grid: {}
      }
    ];
    mockConfigStore._data.mdi = records;

    // First call sanitizes and adds ID
    apiMdi.fetch(createMockRequest(), createMockResponse());
    const sanitizedId = mockConfigStore._data.mdi[0].id;

    const req = createMockRequest({
      params: { id: sanitizedId }
    });
    const res = createMockResponse();

    apiMdi.read(req, res);

    subt.equal(res.statusCode, 200, 'should find record after sanitization');
    subt.ok(res.body.id, 'should return record with ID');
    subt.end();
  });

  t.test('PUT /api/mdi/:id - update - updates existing record', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'Original Name',
        command: 'G0 X0',
        grid: { x: 0 }
      }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest({
      params: { id: 'mdi-1' },
      body: {
        name: 'Updated Name',
        command: 'G0 X10 Y10',
        grid: { x: 10, y: 10 }
      }
    });
    const res = createMockResponse();

    apiMdi.update(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: null }, 'should return { err: null }');

    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords[0].name, 'Updated Name', 'should update name');
    subt.equal(storedRecords[0].command, 'G0 X10 Y10', 'should update command');
    subt.same(storedRecords[0].grid, { x: 10, y: 10 }, 'should update grid');
    subt.end();
  });

  t.test('PUT /api/mdi/:id - update - handles partial updates', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'Original Name',
        command: 'G0 X0',
        grid: { x: 0 }
      }
    ];
    mockConfigStore._data.mdi = records;

    // Only update name
    const req = createMockRequest({
      params: { id: 'mdi-1' },
      body: {
        name: 'Updated Name'
      }
    });
    const res = createMockResponse();

    apiMdi.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords[0].name, 'Updated Name', 'should update name');
    subt.equal(storedRecords[0].command, 'G0 X0', 'should keep original command');
    subt.same(storedRecords[0].grid, { x: 0 }, 'should keep original grid');
    subt.end();
  });

  t.test('PUT /api/mdi/:id - update - converts values to strings and ensures grid is object', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'Test',
        command: 'G0',
        grid: {}
      }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest({
      params: { id: 'mdi-1' },
      body: {
        name: 123,  // Number
        command: null,  // null
        grid: 'not an object'  // Not an object
      }
    });
    const res = createMockResponse();

    apiMdi.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords[0].name, '123', 'should convert name to string');
    subt.equal(storedRecords[0].command, '', 'should convert null command to empty string');
    subt.same(storedRecords[0].grid, {}, 'should convert non-object grid to empty object');
    subt.end();
  });

  t.test('PUT /api/mdi/:id - update - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.mdi = [
      { id: 'mdi-1', name: 'Test', command: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' },
      body: {
        name: 'Updated'
      }
    });
    const res = createMockResponse();

    apiMdi.update(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('PUT /api/mdi/:id - update - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'mdi-1', name: 'Test', command: 'G0', grid: {} }
    ];
    mockConfigStore._data.mdi = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'mdi-1' },
      body: {
        name: 'Updated'
      }
    });
    const res = createMockResponse();

    apiMdi.update(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - replaces all records', (subt) => {
    setupMocks();
    // Start with existing records
    mockConfigStore._data.mdi = [
      { id: 'old-1', name: 'Old 1', command: 'G0', grid: {} },
      { id: 'old-2', name: 'Old 2', command: 'G28', grid: {} }
    ];

    const req = createMockRequest({
      body: {
        records: [
          { id: 'new-1', name: 'New 1', command: 'G0 X10', grid: { x: 10 } },
          { id: 'new-2', name: 'New 2', command: 'G0 Y10', grid: { y: 10 } },
          { name: 'New 3', command: 'G28', grid: {} }  // Missing ID - should be generated
        ]
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: null }, 'should return { err: null }');

    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords.length, 3, 'should replace all records');
    subt.equal(storedRecords[0].id, 'new-1', 'should have first new record');
    subt.equal(storedRecords[0].name, 'New 1', 'should have correct name');
    subt.equal(storedRecords[1].id, 'new-2', 'should have second new record');
    subt.ok(storedRecords[2].id, 'third record should have generated ID');
    subt.equal(storedRecords[2].name, 'New 3', 'third record should have correct name');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - filters out non-plain objects', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        records: [
          { id: 'valid-1', name: 'Valid 1', command: 'G0', grid: {} },
          ['not', 'an', 'object'],  // Should be filtered out
          { id: 'valid-2', name: 'Valid 2', command: 'G28', grid: {} },
          null,  // Should be filtered out
          { id: 'valid-3', name: 'Valid 3', command: 'G90', grid: {} }
        ]
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords.length, 3, 'should only store plain objects');
    subt.equal(storedRecords[0].id, 'valid-1', 'should have first valid record');
    subt.equal(storedRecords[1].id, 'valid-2', 'should have second valid record');
    subt.equal(storedRecords[2].id, 'valid-3', 'should have third valid record');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - generates IDs for records without them', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        records: [
          { name: 'No ID 1', command: 'G0', grid: {} },
          { name: 'No ID 2', command: 'G28', grid: {} }
        ]
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords.length, 2, 'should store both records');
    subt.ok(storedRecords[0].id, 'first record should have generated ID');
    subt.ok(storedRecords[1].id, 'second record should have generated ID');
    subt.notEqual(storedRecords[0].id, storedRecords[1].id, 'IDs should be different');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - ensures string types and object grid', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        records: [
          {
            id: 'mdi-1',
            name: 123,  // Number
            command: null,  // null
            grid: 'not an object'  // Not an object
          }
        ]
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords[0].name, '123', 'should convert name to string');
    subt.equal(storedRecords[0].command, '', 'should convert null command to empty string');
    subt.same(storedRecords[0].grid, {}, 'should convert non-object grid to empty object');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - returns 400 when records is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        // records missing
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /records.*must not be empty/i, 'error message should mention records');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - returns 400 when records is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        records: []
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /records.*must not be empty/i, 'error message should mention records');
    subt.end();
  });

  t.test('POST /api/mdi/bulkUpdate - bulkUpdate - handles config.set errors', (subt) => {
    setupMocks();
    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      body: {
        records: [
          { id: 'mdi-1', name: 'Test', command: 'G0', grid: {} }
        ]
      }
    });
    const res = createMockResponse();

    apiMdi.bulkUpdate(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('DELETE /api/mdi/:id - __delete - deletes record', (subt) => {
    setupMocks();
    const records = [
      { id: 'mdi-1', name: 'MDI 1', command: 'G0', grid: {} },
      { id: 'mdi-2', name: 'MDI 2', command: 'G28', grid: {} },
      { id: 'mdi-3', name: 'MDI 3', command: 'G90', grid: {} }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest({
      params: { id: 'mdi-2' }
    });
    const res = createMockResponse();

    apiMdi.__delete(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, { err: null }, 'should return { err: null }');

    const storedRecords = mockConfigStore._data.mdi;
    subt.equal(storedRecords.length, 2, 'should remove one record');
    subt.equal(storedRecords[0].id, 'mdi-1', 'should keep first record');
    subt.equal(storedRecords[1].id, 'mdi-3', 'should keep third record');
    subt.ok(!storedRecords.find(r => r.id === 'mdi-2'), 'should not have deleted record');
    subt.end();
  });

  t.test('DELETE /api/mdi/:id - __delete - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.mdi = [
      { id: 'mdi-1', name: 'Test', command: 'G0', grid: {} }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiMdi.__delete(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('DELETE /api/mdi/:id - __delete - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'mdi-1', name: 'Test', command: 'G0', grid: {} }
    ];
    mockConfigStore._data.mdi = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'mdi-1' }
    });
    const res = createMockResponse();

    apiMdi.__delete(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/mdi - fetch - filters records to only include id, name, command, grid', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'mdi-1',
        name: 'Test MDI',
        command: 'G0 X0',
        grid: { x: 0 },
        extraField: 'should not appear',
        anotherField: 123
      }
    ];
    mockConfigStore._data.mdi = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMdi.fetch(req, res);

    subt.equal(res.statusCode, 200);
    const returnedRecord = res.body.records[0];
    subt.ok(returnedRecord.id, 'should have id');
    subt.ok(returnedRecord.name, 'should have name');
    subt.ok(returnedRecord.command, 'should have command');
    subt.ok(returnedRecord.grid, 'should have grid');
    subt.ok(!returnedRecord.extraField, 'should not have extraField');
    subt.ok(!returnedRecord.anotherField, 'should not have anotherField');
    subt.end();
  });

  t.test('GET /api/mdi - fetch - sanitizes records on every fetch', (subt) => {
    setupMocks();
    // Start with records missing IDs
    mockConfigStore._data.mdi = [
      { name: 'MDI 1', command: 'G0', grid: {} },
      { name: 'MDI 2', command: 'G28', grid: {} }
    ];

    const req1 = createMockRequest();
    const res1 = createMockResponse();
    apiMdi.fetch(req1, res1);

    subt.equal(res1.body.records.length, 2);
    const id1 = res1.body.records[0].id;
    const id2 = res1.body.records[1].id;
    subt.ok(id1, 'first record should have ID after first fetch');
    subt.ok(id2, 'second record should have ID after first fetch');

    // Second fetch should not regenerate IDs (they're already stored)
    const req2 = createMockRequest();
    const res2 = createMockResponse();
    apiMdi.fetch(req2, res2);

    subt.equal(res2.body.records[0].id, id1, 'should keep same ID on second fetch');
    subt.equal(res2.body.records[1].id, id2, 'should keep same ID on second fetch');
    subt.end();
  });

  t.end();
});
