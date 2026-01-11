import { test } from 'tap';
import proxyquire from 'proxyquire';
import { createMockRequest, createMockResponse, createMockConfigStore } from './helpers';
import {
  ERR_BAD_REQUEST,
  ERR_NOT_FOUND,
  ERR_INTERNAL_SERVER_ERROR
} from '../../src/server/constants/index';

test('api.machines', (t) => {
  // Mock dependencies
  let mockConfigStore;
  let mockUuid;
  let apiMachines;

  // Helper to create fresh mocks for each test
  const setupMocks = () => {
    mockConfigStore = createMockConfigStore({ machines: [] });
    mockUuid = {
      v4: () => 'mock-uuid-' + Math.random().toString(36).substr(2, 9)
    };

    apiMachines = proxyquire('../../src/server/api/api.machines.js', {
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

  t.test('GET /api/machines - fetch - returns all records without paging', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'CNC Router',
        limits: {
          xmin: -100,
          xmax: 100,
          ymin: -100,
          ymax: 100,
          zmin: 0,
          zmax: 50
        }
      },
      {
        id: 'machine-2',
        name: 'Mill',
        limits: {
          xmin: -200,
          xmax: 200,
          ymin: -150,
          ymax: 150,
          zmin: -10,
          zmax: 100
        }
      }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest({ query: {} });
    const res = createMockResponse();

    apiMachines.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.records, 'should have records array');
    subt.equal(res.body.records.length, 2, 'should return all records');
    subt.ok(res.body.records[0].id, 'should have id');
    subt.equal(res.body.records[0].name, 'CNC Router', 'should have name');
    subt.ok(res.body.records[0].limits, 'should have limits');
    subt.equal(res.body.records[0].limits.xmin, -100, 'should have xmin');
    subt.ok(!res.body.pagination, 'should not have pagination when paging=false');
    subt.end();
  });

  t.test('GET /api/machines - fetch - returns paged records with pagination metadata', (subt) => {
    setupMocks();
    const records = [];
    for (let i = 0; i < 25; i++) {
      records.push({
        id: `machine-${i}`,
        name: `Machine ${i}`,
        limits: { xmin: 0, xmax: 100, ymin: 0, ymax: 100, zmin: 0, zmax: 50 }
      });
    }
    mockConfigStore._data.machines = records;

    const req = createMockRequest({
      query: {
        paging: 'true',
        page: '2',
        pageLength: '10'
      }
    });
    const res = createMockResponse();

    apiMachines.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(res.body.pagination, 'should have pagination object');
    subt.equal(res.body.pagination.page, 2, 'should return correct page');
    subt.equal(res.body.pagination.pageLength, 10, 'should return correct pageLength');
    subt.equal(res.body.pagination.totalRecords, 25, 'should return correct totalRecords');
    subt.equal(res.body.records.length, 10, 'should return 10 records for page 2');
    subt.equal(res.body.records[0].id, 'machine-10', 'should return records starting from index 10');
    subt.end();
  });

  t.test('GET /api/machines - fetch - handles invalid page/pageLength', (subt) => {
    setupMocks();
    const records = [{ id: 'machine-1', name: 'Test', limits: {} }];
    mockConfigStore._data.machines = records;

    // Test invalid page (negative)
    const req1 = createMockRequest({
      query: {
        paging: 'true',
        page: '-1',
        pageLength: '10'
      }
    });
    const res1 = createMockResponse();
    apiMachines.fetch(req1, res1);
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
    apiMachines.fetch(req2, res2);
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
    apiMachines.fetch(req3, res3);
    subt.equal(res3.statusCode, 200, 'should handle page beyond total');
    subt.equal(res3.body.pagination.page, 100, 'pagination metadata uses original query param');
    subt.equal(res3.body.records.length, 1, 'should return records from last valid page');

    subt.end();
  });

  t.test('GET /api/machines - fetch - sanitizes records (adds IDs, handles non-plain objects)', (subt) => {
    setupMocks();
    const records = [
      {
        // Missing ID - should be added
        name: 'Machine 1',
        limits: { xmin: 0, xmax: 100 }
      },
      {
        id: 'existing-id',
        name: 'Machine 2',
        limits: { xmin: 0, xmax: 100 }
      },
      // Not a plain object - should be converted to {}
      ['not', 'an', 'object']
    ];

    mockConfigStore._data.machines = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMachines.fetch(req, res);

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
    const storedRecords = mockConfigStore._data.machines;
    subt.ok(storedRecords[0].id, 'stored records should have IDs');
    subt.ok(typeof storedRecords[2] === 'object' && !Array.isArray(storedRecords[2]), 'stored record should be sanitized to object');

    subt.end();
  });

  t.test('GET /api/machines - fetch - ensures machine profile structure with default limits', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'Test Machine'
        // missing limits
      },
      {
        id: 'machine-2',
        name: 'Partial Limits',
        limits: {
          xmin: 10,
          xmax: 20
          // missing other limit fields
        }
      }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMachines.fetch(req, res);

    subt.equal(res.statusCode, 200);
    // First record should have default limits
    subt.ok(res.body.records[0].limits, 'should have limits object');
    subt.equal(res.body.records[0].limits.xmin, 0, 'should default xmin to 0');
    subt.equal(res.body.records[0].limits.xmax, 0, 'should default xmax to 0');
    subt.equal(res.body.records[0].limits.ymin, 0, 'should default ymin to 0');
    subt.equal(res.body.records[0].limits.ymax, 0, 'should default ymax to 0');
    subt.equal(res.body.records[0].limits.zmin, 0, 'should default zmin to 0');
    subt.equal(res.body.records[0].limits.zmax, 0, 'should default zmax to 0');

    // Second record should have provided values and defaults for missing
    subt.equal(res.body.records[1].limits.xmin, 10, 'should keep provided xmin');
    subt.equal(res.body.records[1].limits.xmax, 20, 'should keep provided xmax');
    subt.equal(res.body.records[1].limits.ymin, 0, 'should default ymin to 0');
    subt.equal(res.body.records[1].limits.zmax, 0, 'should default zmax to 0');

    subt.end();
  });

  t.test('GET /api/machines - fetch - returns empty array when no machines', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [];

    const req = createMockRequest();
    const res = createMockResponse();

    apiMachines.fetch(req, res);

    subt.equal(res.statusCode, 200);
    subt.ok(Array.isArray(res.body.records), 'should have records array');
    subt.equal(res.body.records.length, 0, 'should return empty array');
    subt.end();
  });

  t.test('POST /api/machines - create - creates record with required fields', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [];

    const req = createMockRequest({
      body: {
        name: 'CNC Router',
        limits: {
          xmin: -100,
          xmax: 100,
          ymin: -100,
          ymax: 100,
          zmin: 0,
          zmax: 50
        }
      }
    });
    const res = createMockResponse();

    apiMachines.create(req, res);

    subt.equal(res.statusCode, 200);
    // Note: create sends back id from request body (if provided), not generated
    subt.ok('id' in res.body, 'should have id in response');

    // Check that record was stored
    const storedRecords = mockConfigStore._data.machines;
    subt.equal(storedRecords.length, 1, 'should store one record');
    subt.equal(storedRecords[0].name, 'CNC Router', 'stored record should have name');
    subt.ok(storedRecords[0].limits, 'stored record should have limits');
    subt.equal(storedRecords[0].limits.xmin, -100, 'stored record should have xmin');
    subt.end();
  });

  t.test('POST /api/machines - create - creates record with ID if provided', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [];

    const req = createMockRequest({
      body: {
        id: 'custom-id',
        name: 'Custom Machine',
        limits: { xmin: 0, xmax: 100 }
      }
    });
    const res = createMockResponse();

    apiMachines.create(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.id, 'custom-id', 'should return provided ID');

    const storedRecords = mockConfigStore._data.machines;
    subt.equal(storedRecords[0].id, 'custom-id', 'stored record should have provided ID');
    subt.end();
  });

  t.test('POST /api/machines - create - ensures machine profile structure with default limits', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [];

    const req = createMockRequest({
      body: {
        name: 'Test Machine'
        // missing limits
      }
    });
    const res = createMockResponse();

    apiMachines.create(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.machines;
    subt.ok(storedRecords[0].limits, 'should have limits object');
    subt.equal(storedRecords[0].limits.xmin, 0, 'should default xmin to 0');
    subt.equal(storedRecords[0].limits.xmax, 0, 'should default xmax to 0');
    subt.end();
  });

  t.test('POST /api/machines - create - returns 400 when name is empty', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        name: '',
        limits: { xmin: 0, xmax: 100 }
      }
    });
    const res = createMockResponse();

    apiMachines.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /name.*must not be empty/i, 'error message should mention name');
    subt.end();
  });

  t.test('POST /api/machines - create - returns 400 when name is missing', (subt) => {
    setupMocks();
    const req = createMockRequest({
      body: {
        limits: { xmin: 0, xmax: 100 }
        // name missing
      }
    });
    const res = createMockResponse();

    apiMachines.create(req, res);

    subt.equal(res.statusCode, ERR_BAD_REQUEST);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /name.*must not be empty/i, 'error message should mention name');
    subt.end();
  });

  t.test('POST /api/machines - create - handles config.set errors', (subt) => {
    setupMocks();
    // Make config.set throw an error
    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      body: {
        name: 'Test Machine',
        limits: { xmin: 0, xmax: 100 }
      }
    });
    const res = createMockResponse();

    apiMachines.create(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.ok(res.body.msg, 'should have error message');
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/machines/:id - read - returns record by ID', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'CNC Router',
        limits: {
          xmin: -100,
          xmax: 100,
          ymin: -100,
          ymax: 100,
          zmin: 0,
          zmax: 50
        }
      },
      {
        id: 'machine-2',
        name: 'Mill',
        limits: {
          xmin: -200,
          xmax: 200
        }
      }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest({
      params: { id: 'machine-2' }
    });
    const res = createMockResponse();

    apiMachines.read(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.id, 'machine-2', 'should return correct id');
    subt.equal(res.body.name, 'Mill', 'should return correct name');
    subt.ok(res.body.limits, 'should have limits');
    subt.equal(res.body.limits.xmin, -200, 'should return correct xmin');
    subt.equal(res.body.limits.xmax, 200, 'should return correct xmax');
    // Missing fields should default to 0
    subt.equal(res.body.limits.ymin, 0, 'should default ymin to 0');
    subt.end();
  });

  t.test('GET /api/machines/:id - read - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [
      { id: 'machine-1', name: 'Test', limits: {} }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiMachines.read(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.ok(res.body.msg, 'should have error message');
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('GET /api/machines/:id - read - sanitizes records before reading', (subt) => {
    setupMocks();
    // Record without ID - should be sanitized
    const records = [
      {
        name: 'Test Machine',
        limits: { xmin: 0, xmax: 100 }
      }
    ];
    mockConfigStore._data.machines = records;

    // First call sanitizes and adds ID
    apiMachines.fetch(createMockRequest(), createMockResponse());
    const sanitizedId = mockConfigStore._data.machines[0].id;

    const req = createMockRequest({
      params: { id: sanitizedId }
    });
    const res = createMockResponse();

    apiMachines.read(req, res);

    subt.equal(res.statusCode, 200, 'should find record after sanitization');
    subt.ok(res.body.id, 'should return record with ID');
    subt.end();
  });

  t.test('PUT /api/machines/:id - update - updates existing record', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'Original Name',
        limits: {
          xmin: -100,
          xmax: 100,
          ymin: -100,
          ymax: 100,
          zmin: 0,
          zmax: 50
        }
      }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest({
      params: { id: 'machine-1' },
      body: {
        name: 'Updated Name',
        limits: {
          xmin: -200,
          xmax: 200,
          ymin: -150,
          ymax: 150
        }
      }
    });
    const res = createMockResponse();

    apiMachines.update(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.id, 'machine-1', 'should return ID');

    const storedRecords = mockConfigStore._data.machines;
    subt.equal(storedRecords[0].name, 'Updated Name', 'should update name');
    subt.equal(storedRecords[0].limits.xmin, -200, 'should update xmin');
    subt.equal(storedRecords[0].limits.xmax, 200, 'should update xmax');
    subt.equal(storedRecords[0].limits.ymin, -150, 'should update ymin');
    subt.equal(storedRecords[0].limits.ymax, 150, 'should update ymax');
    // Missing fields should keep original values
    subt.equal(storedRecords[0].limits.zmin, 0, 'should keep original zmin');
    subt.equal(storedRecords[0].limits.zmax, 50, 'should keep original zmax');
    subt.end();
  });

  t.test('PUT /api/machines/:id - update - handles partial updates', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'Original Name',
        limits: {
          xmin: -100,
          xmax: 100,
          ymin: -100,
          ymax: 100,
          zmin: 0,
          zmax: 50
        }
      }
    ];
    mockConfigStore._data.machines = records;

    // Only update name
    const req = createMockRequest({
      params: { id: 'machine-1' },
      body: {
        name: 'Updated Name'
      }
    });
    const res = createMockResponse();

    apiMachines.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.machines;
    subt.equal(storedRecords[0].name, 'Updated Name', 'should update name');
    subt.equal(storedRecords[0].limits.xmin, -100, 'should keep original xmin');
    subt.equal(storedRecords[0].limits.xmax, 100, 'should keep original xmax');
    subt.end();
  });

  t.test('PUT /api/machines/:id - update - ensures number types for limits', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'Test',
        limits: {
          xmin: -100,
          xmax: 100,
          ymin: -100,
          ymax: 100,
          zmin: 0,
          zmax: 50
        }
      }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest({
      params: { id: 'machine-1' },
      body: {
        limits: {
          xmin: '123',  // String
          xmax: '456',  // String
          ymin: null,   // null
          ymax: undefined  // undefined
        }
      }
    });
    const res = createMockResponse();

    apiMachines.update(req, res);

    subt.equal(res.statusCode, 200);
    const storedRecords = mockConfigStore._data.machines;
    subt.equal(typeof storedRecords[0].limits.xmin, 'number', 'should convert xmin to number');
    subt.equal(storedRecords[0].limits.xmin, 123, 'should convert string xmin to number');
    subt.equal(typeof storedRecords[0].limits.xmax, 'number', 'should convert xmax to number');
    subt.equal(storedRecords[0].limits.xmax, 456, 'should convert string xmax to number');
    // null/undefined should use original value
    subt.equal(storedRecords[0].limits.ymin, -100, 'should keep original ymin when null');
    subt.equal(storedRecords[0].limits.ymax, 100, 'should keep original ymax when undefined');
    subt.end();
  });

  t.test('PUT /api/machines/:id - update - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [
      { id: 'machine-1', name: 'Test', limits: {} }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' },
      body: {
        name: 'Updated'
      }
    });
    const res = createMockResponse();

    apiMachines.update(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('PUT /api/machines/:id - update - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'machine-1', name: 'Test', limits: {} }
    ];
    mockConfigStore._data.machines = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'machine-1' },
      body: {
        name: 'Updated'
      }
    });
    const res = createMockResponse();

    apiMachines.update(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('DELETE /api/machines/:id - __delete - deletes record', (subt) => {
    setupMocks();
    const records = [
      { id: 'machine-1', name: 'Machine 1', limits: {} },
      { id: 'machine-2', name: 'Machine 2', limits: {} },
      { id: 'machine-3', name: 'Machine 3', limits: {} }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest({
      params: { id: 'machine-2' }
    });
    const res = createMockResponse();

    apiMachines.__delete(req, res);

    subt.equal(res.statusCode, 200);
    subt.equal(res.body.id, 'machine-2', 'should return deleted record ID');

    const storedRecords = mockConfigStore._data.machines;
    subt.equal(storedRecords.length, 2, 'should remove one record');
    subt.equal(storedRecords[0].id, 'machine-1', 'should keep first record');
    subt.equal(storedRecords[1].id, 'machine-3', 'should keep third record');
    subt.ok(!storedRecords.find(r => r.id === 'machine-2'), 'should not have deleted record');
    subt.end();
  });

  t.test('DELETE /api/machines/:id - __delete - returns 404 when not found', (subt) => {
    setupMocks();
    mockConfigStore._data.machines = [
      { id: 'machine-1', name: 'Test', limits: {} }
    ];

    const req = createMockRequest({
      params: { id: 'non-existent-id' }
    });
    const res = createMockResponse();

    apiMachines.__delete(req, res);

    subt.equal(res.statusCode, ERR_NOT_FOUND);
    subt.equal(res.body.msg, 'Not found', 'error message should be "Not found"');
    subt.end();
  });

  t.test('DELETE /api/machines/:id - __delete - handles config.set errors', (subt) => {
    setupMocks();
    const records = [
      { id: 'machine-1', name: 'Test', limits: {} }
    ];
    mockConfigStore._data.machines = records;

    mockConfigStore.set = () => {
      throw new Error('Config save failed');
    };

    const req = createMockRequest({
      params: { id: 'machine-1' }
    });
    const res = createMockResponse();

    apiMachines.__delete(req, res);

    subt.equal(res.statusCode, ERR_INTERNAL_SERVER_ERROR);
    subt.match(res.body.msg, /Failed to save/i, 'error message should mention save failure');
    subt.end();
  });

  t.test('GET /api/machines - fetch - filters records to only include id, name, limits', (subt) => {
    setupMocks();
    const records = [
      {
        id: 'machine-1',
        name: 'Test Machine',
        limits: { xmin: 0, xmax: 100 },
        extraField: 'should not appear',
        anotherField: 123
      }
    ];
    mockConfigStore._data.machines = records;

    const req = createMockRequest();
    const res = createMockResponse();

    apiMachines.fetch(req, res);

    subt.equal(res.statusCode, 200);
    const returnedRecord = res.body.records[0];
    subt.ok(returnedRecord.id, 'should have id');
    subt.ok(returnedRecord.name, 'should have name');
    subt.ok(returnedRecord.limits, 'should have limits');
    subt.ok(!returnedRecord.extraField, 'should not have extraField');
    subt.ok(!returnedRecord.anotherField, 'should not have anotherField');
    subt.end();
  });

  t.test('GET /api/machines - fetch - sanitizes records on every fetch', (subt) => {
    setupMocks();
    // Start with records missing IDs
    mockConfigStore._data.machines = [
      { name: 'Machine 1', limits: {} },
      { name: 'Machine 2', limits: {} }
    ];

    const req1 = createMockRequest();
    const res1 = createMockResponse();
    apiMachines.fetch(req1, res1);

    subt.equal(res1.body.records.length, 2);
    const id1 = res1.body.records[0].id;
    const id2 = res1.body.records[1].id;
    subt.ok(id1, 'first record should have ID after first fetch');
    subt.ok(id2, 'second record should have ID after first fetch');

    // Second fetch should not regenerate IDs (they're already stored)
    const req2 = createMockRequest();
    const res2 = createMockResponse();
    apiMachines.fetch(req2, res2);

    subt.equal(res2.body.records[0].id, id1, 'should keep same ID on second fetch');
    subt.equal(res2.body.records[1].id, id2, 'should keep same ID on second fetch');
    subt.end();
  });

  t.end();
});
