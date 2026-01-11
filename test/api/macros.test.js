import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse, createMockConfigStore } from './helpers';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../../src/server/constants/index';

test('api.macros', (t) => {
  // Mock dependencies
  let mockConfigStore;
  let mockUuid;
  let apiMacros;

  // Helper to create fresh mocks for each test
  const setupMocks = () => {
    mockConfigStore = createMockConfigStore({ macros: [] });
    mockUuid = {
      v4: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
    };

    apiMacros = proxyquire('../../src/server/api/api.macros.js', {
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
          rcfile: '/path/to/config.json'
        },
      },
    });
  };

  t.test('GET /api/macros - fetch - returns all records without paging', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'macro-1',
        mtime: 1000,
        name: 'Home All',
        description: 'Home all axes',
        content: 'G28'
      },
      {
        id: 'macro-2',
        mtime: 2000,
        name: 'Probe Z',
        description: 'Probe Z axis',
        content: 'G38.2 Z-50 F100'
      }
    ];
    mockConfigStore._data.macros = records;

    const req = createMockRequest({ query: {} });
    const res = createMockResponse();

    apiMacros.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.records, 'should have records array');
    subt.equal(res.body.records.length, 2, 'should return all records');
    subt.same(res.body.records[0], {
      id: 'macro-1',
      mtime: 1000,
      name: 'Home All',
      description: 'Home all axes',
      content: 'G28'
    }, 'should return first record with correct fields');
    subt.ok(!res.body.pagination, 'should not have pagination when paging=false');
    subt.end();
  });

  t.test('GET /api/macros - fetch - returns paged records with pagination metadata', (subt) => {
    setupMocks();
    const records = [];
    for (let i = 0; i < 25; i++) {
      records.push({
        id: `macro-${i}`,
        mtime: 1000 + i,
        name: `Macro ${i}`,
        description: `Description ${i}`,
        content: `G0 X${i}`
      });
    }
    mockConfigStore._data.macros = records;

    const req = createMockRequest({
      query: {
        paging: 'true',
        page: '2',
        pageLength: '10'
      }
    });
    const res = createMockResponse();

    apiMacros.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.pagination, 'should have pagination object');
    subt.equal(res.body.pagination.page, 2, 'should return correct page');
    subt.equal(res.body.pagination.pageLength, 10, 'should return correct pageLength');
    subt.equal(res.body.pagination.totalRecords, 25, 'should return correct totalRecords');
    subt.equal(res.body.records.length, 10, 'should return 10 records for page 2');
    subt.equal(res.body.records[0].id, 'macro-10', 'should return records starting from index 10');
    subt.end();
  });

  t.test('GET /api/macros - fetch - handles invalid page/pageLength', (subt) => {
    setupMocks();
    const records = [{ id: 'macro-1', name: 'Test', content: 'G0' }];
    mockConfigStore._data.macros = records;

    // Test invalid page (negative) - getPagingRange adjusts internally but metadata uses original
    const req1 = createMockRequest({
      query: {
        paging: 'true',
        page: '-1',
        pageLength: '10'
      }
    });
    const res1 = createMockResponse();
    apiMacros.fetch(req1, res1);
    subt.equal(res1.statusCode, 200, 'should handle negative page');
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
    apiMacros.fetch(req2, res2);
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
    apiMacros.fetch(req3, res3);
    subt.equal(res3.statusCode, 200, 'should handle page beyond total');
    subt.equal(res3.body.pagination.page, 100, 'pagination metadata uses original query param');
    subt.equal(res3.body.records.length, 1, 'should return records from last valid page');

    subt.end();
  });

  t.test('GET /api/macros - fetch - sanitizes records (adds IDs, handles non-plain objects)', (subt) => {
    setupMocks();
    const records = [
      {
        // Missing ID - should be added
        mtime: 1000,
        name: 'Macro 1',
        description: 'Description 1',
        content: 'G0 X0'
      },
      {
        id: 'existing-id',
        mtime: 2000,
        name: 'Macro 2',
        description: 'Description 2',
        content: 'G28'
      },
      // Not a plain object - should be converted to {}
      ['not', 'an', 'object']
    ];

    mockConfigStore._data.macros = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMacros.fetch(req, res);

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
    const storedRecords = mockConfigStore._data.macros;
    subt.ok(storedRecords[0].id, 'stored records should have IDs');
    subt.ok(typeof storedRecords[2] === 'object' && !Array.isArray(storedRecords[2]), 'stored record should be sanitized to object');

    subt.end();
  });

  t.test('GET /api/macros - fetch - returns empty array when no macros', (subt) => {
    setupMocks();
    mockConfigStore._data.macros = [];

    const req = createMockRequest();
    const res = createMockResponse();

    apiMacros.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(Array.isArray(res.body.records), 'should have records array');
    subt.equal(res.body.records.length, 0, 'should return empty array');
    subt.end();
  });

  t.test('POST /api/macros - create - creates record with required fields', (subt) => {
    setupMocks();
    mockConfigStore._data.macros = [];

    const req = createMockRequest({
      body: {
        name: 'Home All',
        description: 'Home all axes',
        content: 'G28'
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.id, 'should return generated ID');
    subt.ok(res.body.mtime, 'should return mtime');
    subt.ok(typeof res.body.mtime === 'number', 'mtime should be a number');
    subt.ok(res.body.mtime > 0, 'mtime should be positive');

    // Check that record was stored
    const storedRecords = mockConfigStore._data.macros;
    subt.equal(storedRecords.length, 1, 'should store one record');
    subt.equal(storedRecords[0].id, res.body.id, 'stored record should have same ID');
    subt.equal(storedRecords[0].name, 'Home All', 'stored record should have name');
    subt.equal(storedRecords[0].description, 'Home all axes', 'stored record should have description');
    subt.equal(storedRecords[0].content, 'G28', 'stored record should have content');
    subt.equal(storedRecords[0].mtime, res.body.mtime, 'stored record should have mtime');

    subt.end();
  });

  t.test('POST /api/macros - create - defaults description to empty string when not provided', (subt) => {
    setupMocks();
    mockConfigStore._data.macros = [];

    const req = createMockRequest({
      body: {
        name: 'Test Macro',
        content: 'G0 X10'
        // description not provided
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.macros;
    subt.equal(storedRecords[0].description, '', 'should default description to empty string');
    subt.end();
  });

  t.test('POST /api/macros - create - returns 400 when name is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: '',
        content: 'G0 X10'
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /name.*must not be empty/i, 'error message should mention name');
    subt.end();
  });

  t.test('POST /api/macros - create - returns 400 when name is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        content: 'G0 X10'
        // name missing
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /name.*must not be empty/i, 'error message should mention name');
    subt.end();
  });

  t.test('POST /api/macros - create - returns 400 when content is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: 'Test Macro',
        content: ''
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /content.*must not be empty/i, 'error message should mention content');
    subt.end();
  });

  t.test('POST /api/macros - create - returns 400 when content is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: 'Test Macro'
        // content missing
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /content.*must not be empty/i, 'error message should mention content');
    subt.end();
  });

  t.test('POST /api/macros - create - handles config.set errors', (subt) => {
    setupMocks();
    // Make config.set throw an error
    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      body: {
        name: 'Test Macro',
        content: 'G0 X10'
      }
    });
    const res = createMockResponse();

    apiMacros.create(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/macros/:id - read - returns record by ID', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'macro-1',
        mtime: 1000,
        name: 'Home All',
        description: 'Home all axes',
        content: 'G28'
      },
      {
        id: 'macro-2',
        mtime: 2000,
        name: 'Probe Z',
        description: 'Probe Z axis',
        content: 'G38.2 Z-50 F100'
      }
    ];
    mockConfigStore._data.macros = records;

    const req = createMockRequest({
      params: { id: 'macro-2' }
    });
    const res = createMockResponse();

    apiMacros.read(req, res);

    subt.equal(res.statusCode, 200);
    subt.same(res.body, {
      id: 'macro-2',
      mtime: 2000,
      name: 'Probe Z',
      description: 'Probe Z axis',
      content: 'G38.2 Z-50 F100'
    }, 'should return correct record');
    subt.end();
  });

  t.test('GET /api/macros/:id - read - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.macros = [
      { id: 'macro-1', name: 'Test', content: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiMacros.read(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.ok(res.body.msg, 'should have error message');
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('GET /api/macros/:id - read - sanitizes records before reading', (subt) => {
    setupMocks();
    // Record without ID - should be sanitized
    const records = [
      {
        mtime: 1000,
        name: 'Test Macro',
        content: 'G0 X0'
      }
    ];
    mockConfigStore._data.macros = records;

    // First call sanitizes and adds ID
    apiMacros.fetch(createMockRequest(), createMockResponse());
    const sanitizedId = mockConfigStore._data.macros[0].id;

    const req = createMockRequest({
      params: { id: sanitizedId }
    });
    const res = createMockResponse();

    apiMacros.read(req, res);

    subt.equal(res.statusCode, 200, 'should find record after sanitization');
    subt.ok(res.body.id, 'should return record with ID');
    subt.end();
  });

  t.test('PUT /api/macros/:id - update - updates existing record', (subt) => {
    setupMocks();
    const originalTime = 1000;
    const records = [
      {
        id: 'macro-1',
        mtime: originalTime,
        name: 'Home All',
        description: 'Home all axes',
        content: 'G28'
      }
    ];
    mockConfigStore._data.macros = records;

    const req = createMockRequest({
      params: { id: 'macro-1' },
      body: {
        name: 'Home XYZ',
        description: 'Home X, Y, and Z axes',
        content: 'G28 X Y Z'
      }
    });
    const res = createMockResponse();

    apiMacros.update(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.id, 'should return ID');
    subt.ok(res.body.mtime, 'should return updated mtime');
    subt.ok(res.body.mtime > originalTime, 'mtime should be updated to current time');

    const storedRecords = mockConfigStore._data.macros;
    subt.equal(storedRecords[0].name, 'Home XYZ', 'should update name');
    subt.equal(storedRecords[0].description, 'Home X, Y, and Z axes', 'should update description');
    subt.equal(storedRecords[0].content, 'G28 X Y Z', 'should update content');
    subt.equal(storedRecords[0].mtime, res.body.mtime, 'should update mtime');
    subt.end();
  });

  t.test('PUT /api/macros/:id - update - handles partial updates', (subt) => {
    setupMocks();
    const originalTime = 1000;
    const records = [
      {
        id: 'macro-1',
        mtime: originalTime,
        name: 'Home All',
        description: 'Home all axes',
        content: 'G28'
      }
    ];
    mockConfigStore._data.macros = records;

    // Only update name
    const req = createMockRequest({
      params: { id: 'macro-1' },
      body: {
        name: 'Updated Name'
      }
    });
    const res = createMockResponse();

    apiMacros.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.macros;
    subt.equal(storedRecords[0].name, 'Updated Name', 'should update name');
    subt.equal(storedRecords[0].description, 'Home all axes', 'should keep original description');
    subt.equal(storedRecords[0].content, 'G28', 'should keep original content');
    subt.end();
  });

  t.test('PUT /api/macros/:id - update - converts values to strings', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'macro-1',
        mtime: 1000,
        name: 'Test',
        description: 'Test',
        content: 'G0'
      }
    ];
    mockConfigStore._data.macros = records;

    const req = createMockRequest({
      params: { id: 'macro-1' },
      body: {
        name: 123,  // Number
        description: null,  // null
        content: undefined  // undefined
      }
    });
    const res = createMockResponse();

    apiMacros.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.macros;
    subt.equal(storedRecords[0].name, '123', 'should convert name to string');
    subt.equal(storedRecords[0].description, '', 'should convert null description to empty string');
    subt.equal(storedRecords[0].content, '', 'should convert undefined content to empty string');
    subt.end();
  });

  t.test('PUT /api/macros/:id - update - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.macros = [
      { id: 'macro-1', name: 'Test', content: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' },
      body: {
        name: 'Updated'
      }
    });
    const res = createMockResponse();

    apiMacros.update(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('PUT /api/macros/:id - update - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'macro-1', mtime: 1000, name: 'Test', content: 'G0' }
    ];
    mockConfigStore._data.macros = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'macro-1' },
      body: {
        name: 'Updated'
      }
    });
    const res = createMockResponse();

    apiMacros.update(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('DELETE /api/macros/:id - __delete - deletes record', (subt) => {
    setupMocks();
    const records = [
      { id: 'macro-1', mtime: 1000, name: 'Macro 1', content: 'G0' },
      { id: 'macro-2', mtime: 2000, name: 'Macro 2', content: 'G28' },
      { id: 'macro-3', mtime: 3000, name: 'Macro 3', content: 'G90' }
    ];
    mockConfigStore._data.macros = records;

    const req = createMockRequest({
      params: { id: 'macro-2' }
    });
    const res = createMockResponse();

    apiMacros.__delete(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.id, 'macro-2', 'should return deleted record ID');

    const storedRecords = mockConfigStore._data.macros;
    subt.equal(storedRecords.length, 2, 'should remove one record');
    subt.equal(storedRecords[0].id, 'macro-1', 'should keep first record');
    subt.equal(storedRecords[1].id, 'macro-3', 'should keep third record');
    subt.ok(!storedRecords.find(r => r.id === 'macro-2'), 'should not have deleted record');
    subt.end();
  });

  t.test('DELETE /api/macros/:id - __delete - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.macros = [
      { id: 'macro-1', name: 'Test', content: 'G0' }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiMacros.__delete(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('DELETE /api/macros/:id - __delete - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'macro-1', mtime: 1000, name: 'Test', content: 'G0' }
    ];
    mockConfigStore._data.macros = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'macro-1' }
    });
    const res = createMockResponse();

    apiMacros.__delete(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/macros - fetch - filters records to only include id, mtime, name, description, content', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'macro-1',
        mtime: 1000,
        name: 'Test Macro',
        description: 'Test description',
        content: 'G0 X0',
        extraField: 'should not appear',
        anotherField: 123
      }
    ];
    mockConfigStore._data.macros = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMacros.fetch(req, res);

    subt.equal(res.statusCode, 200);
    const returnedRecord = res.body.records[0];
    subt.ok(returnedRecord.id, 'should have id');
    subt.ok(returnedRecord.mtime, 'should have mtime');
    subt.ok(returnedRecord.name, 'should have name');
    subt.ok('description' in returnedRecord, 'should have description');
    subt.ok(returnedRecord.content, 'should have content');
    subt.ok(!returnedRecord.extraField, 'should not have extraField');
    subt.ok(!returnedRecord.anotherField, 'should not have anotherField');
    subt.end();
  });

  t.test('GET /api/macros - fetch - sanitizes records on every fetch', (subt) => {
    setupMocks();
    // Start with records missing IDs
    mockConfigStore._data.macros = [
      { name: 'Macro 1', content: 'G0 X0' },
      { name: 'Macro 2', content: 'G28' }
    ];

    const req1 = createMockRequest();
    const res1 = createMockResponse();
    apiMacros.fetch(req1, res1);

    subt.equal(res1.body.records.length, 2);
    const id1 = res1.body.records[0].id;
    const id2 = res1.body.records[1].id;
    subt.ok(id1, 'first record should have ID after first fetch');
    subt.ok(id2, 'second record should have ID after first fetch');

    // Second fetch should not regenerate IDs (they're already stored)
    const req2 = createMockRequest();
    const res2 = createMockResponse();
    apiMacros.fetch(req2, res2);

    subt.equal(res2.body.records[0].id, id1, 'should keep same ID on second fetch');
    subt.equal(res2.body.records[1].id, id2, 'should keep same ID on second fetch');
    subt.end();
  });

  t.end();
});
