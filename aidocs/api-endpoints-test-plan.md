# REST API Endpoints Test Plan

## Overview

This plan outlines testing strategy for all REST API endpoints in `src/server/api/`. These endpoints currently have **0% test coverage**. Tests will be written using the `tap` framework and follow existing test patterns in the codebase.

## Goals

1. Achieve high coverage of all endpoint functions (target: 85%+ function coverage)
2. Test inputs and outputs at function level (unit tests) and integration level (full request/response cycle)
3. Enable confident refactoring by ensuring behavior is preserved
4. Test both happy paths and error conditions (400, 401, 404, 500, etc.)

## Test Structure

### File Organization

```
test/
├── api/                          # New directory for API tests
│   ├── settings.test.js          # api.settings.js
│   ├── extensions.test.js        # api.extensions.js
│   ├── controllers.test.js       # api.controllers.js
│   ├── machine.test.js           # api.machine.js
│   ├── commands.test.js          # api.commands.js
│   ├── events.test.js            # api.events.js
│   ├── macros.test.js            # api.macros.js
│   ├── users.test.js             # api.users.js (includes signin)
│   ├── version.test.js           # api.version.js
│   ├── themes.test.js            # api.themes.js
│   ├── watchfolders.test.js      # api.watchfolders.js
│   ├── gcode.test.js             # api.gcode.js
│   ├── mdi.test.js               # api.mdi.js
│   ├── machines.test.js          # api.machines.js
│   ├── tool.test.js              # api.tool.js
│   ├── watch.test.js             # api.watch.js (legacy)
│   └── helpers.js                # Shared test utilities
└── fixtures/
    └── api/                      # API test fixtures
        ├── test-settings.json
        └── test-gcode.gcode
```

### Testing Approach

**Two Levels of Testing:**

1. **Unit Tests (Direct Function Calls)**
   - Test exported functions directly with mocked dependencies
   - Fast, isolated, focused on logic
   - Example: Call `api.settings.get(req, res)` with mock req/res

2. **Integration Tests (HTTP Request/Response)**
   - Test via HTTP using `supertest` against Express app
   - Tests full middleware stack (auth, body parsing, etc.)
   - More realistic but slower

**Primary Focus:** Unit tests for coverage, integration tests for critical paths.

## Dependencies to Add

```bash
yarn add -D supertest  # For HTTP integration tests
```

## Mock Strategy

### Core Mocks Needed

1. **ConfigStore** (`src/server/services/configstore`)
   - Mock `get()`, `set()`, `has()`, `unset()`, `delete()`
   - Use in-memory store for tests

2. **Store** (`src/server/store`)
   - Mock `store.get('controllers')` for controllers endpoint

3. **MachineStatusManager** (`src/server/services/machinestatus/MachineStatusManager`)
   - Mock `getStatusSummary()`, `getAllStatuses()`

4. **CNCEngine/Controllers** (for gcode/mdi endpoints)
   - Mock controller instances and their methods

5. **File System** (for gcode, themes, watch endpoints)
   - Use `mock-fs` or similar, or spy on `fs` module

6. **JWT/Authentication**
   - Mock `express-jwt` middleware
   - Create test tokens for authenticated requests

7. **Logger**
   - Mock logger to avoid console output during tests

### Test Helper Utilities (`test/api/helpers.js`)

```javascript
// Mock authentication middleware
export const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user', name: 'Test User' };
  next();
};

// Create mock request object
export const createMockRequest = (overrides = {}) => ({
  query: {},
  body: {},
  params: {},
  ...overrides
});

// Create mock response object with spies
export const createMockResponse = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.send = (data) => { res.body = data; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.end = () => res;
  res.statusCode = 200;
  res.body = null;
  return res;
};

// Generate test JWT token
export const generateTestToken = (payload = { id: 'test-user', name: 'Test User' }) => {
  // Use same secret as app for consistency
};
```

## Endpoint Coverage Plan

### Phase 1: Core System Endpoints (Highest Priority)

#### 1. `api.settings.js` ✅ Priority: HIGH
**Endpoints:**
- `GET /api/settings` - Returns settings with defaults
- `POST /api/settings` - Updates settings (Zod validated)
- `DELETE /api/settings` - Resets to defaults

**Test Cases:**
- GET: Returns defaults when no stored settings
- GET: Returns merged defaults when stored settings incomplete
- GET: Returns stored settings when valid
- GET: Returns defaults when stored settings corrupted/invalid
- POST: Accepts valid partial update
- POST: Merges with existing settings correctly
- POST: Validates against Zod schema (rejects invalid)
- POST: Returns 400 with error details on validation failure
- DELETE: Resets to defaults
- DELETE: Clears stored settings

**Dependencies to Mock:**
- `configstore.get()`, `configstore.set()`
- Zod schema validation

---

#### 2. `api.extensions.js` ✅ Priority: HIGH
**Endpoints:**
- `GET /api/extensions` - Get all or by key
- `POST /api/extensions` - Set extension data
- `DELETE /api/extensions` - Delete by key

**Test Cases:**
- GET: Returns all extensions when no key
- GET: Returns specific key value
- GET: Returns 404 when key not found
- POST: Sets root-level extension data
- POST: Sets nested key with dot notation
- POST: Merges object values correctly
- DELETE: Deletes specific key
- DELETE: Returns 404 when key not found
- DELETE: Returns all when no key specified (doesn't delete everything)

**Dependencies to Mock:**
- `configstore.get()`, `configstore.set()`, `configstore.has()`, `configstore.unset()`
- `deepKeys` function

---

#### 3. `api.version.js` ✅ Priority: MEDIUM
**Endpoints:**
- `GET /api/version/current` - Current package version
- `GET /api/version/latest` - Latest version from npm registry

**Test Cases:**
- GET /current: Returns package.json version
- GET /latest: Returns version from npm registry
- GET /latest: Handles registry connection errors (500)
- GET /latest: Handles invalid registry responses

**Dependencies to Mock:**
- `superagent` request library
- `package.json` version
- `registry-url`, `registry-auth-token`

---

#### 4. `api.controllers.js` ✅ Priority: MEDIUM
**Endpoints:**
- `GET /api/controllers` - List all controller statuses

**Test Cases:**
- GET: Returns empty array when no controllers
- GET: Returns array of controller statuses
- GET: Filters out null controllers

**Dependencies to Mock:**
- `store.get('controllers')`

---

#### 5. `api.machine.js` ✅ Priority: MEDIUM
**Endpoints:**
- `GET /api/machine/status` - Machine status (single or all)

**Test Cases:**
- GET: Returns single status when port specified
- GET: Returns 404 when port not found
- GET: Returns all statuses when no port specified
- GET: Handles errors gracefully (500)
- GET: Query param vs body param (both supported)

**Dependencies to Mock:**
- `machineStatusManager.getStatusSummary()`
- `machineStatusManager.getAllStatuses()`

---

### Phase 2: CRUD Endpoints (Similar Patterns)

These endpoints follow similar CRUD patterns. Test structure will be consistent:

#### 6. `api.commands.js` ✅ Priority: HIGH
**Endpoints:**
- `GET /api/commands` - List (with optional paging)
- `POST /api/commands` - Create
- `GET /api/commands/:id` - Read
- `PUT /api/commands/:id` - Update
- `DELETE /api/commands/:id` - Delete
- `POST /api/commands/run/:id` - Execute command

**Test Cases (per endpoint type):**
- **Fetch (GET):**
  - Returns all records without paging
  - Returns paged records with pagination metadata
  - Handles invalid page/pageLength
  - Sanitizes records (adds IDs, defaults)
- **Create (POST):**
  - Creates record with required fields
  - Returns 400 when required field missing
  - Auto-generates ID and mtime
  - Sets defaults (enabled=true)
- **Read (GET /:id):**
  - Returns record by ID
  - Returns 404 when not found
- **Update (PUT /:id):**
  - Updates existing record
  - Returns 404 when not found
- **Delete (DELETE /:id):**
  - Deletes record
  - Returns 404 when not found
- **Run (POST /run/:id):**
  - Executes command via taskRunner
  - Returns 404 when not found
  - Handles execution errors

**Dependencies to Mock:**
- `configstore` (CRUD operations)
- `taskRunner.run()` (for run endpoint)
- `uuid.v4()` (for ID generation)

**Apply same pattern to:**
- `api.events.js` (same CRUD structure)
- `api.macros.js` (same CRUD structure)
- `api.users.js` (same CRUD + special signin endpoint)
- `api.watchfolders.js` (same CRUD + browse endpoint)
- `api.machines.js` (same CRUD structure)
- `api.mdi.js` (same CRUD + bulkUpdate)

---

### Phase 3: Specialized Endpoints

#### 7. `api.users.js` ✅ Priority: HIGH (includes auth)
**Special Endpoint:**
- `POST /api/signin` - Authentication (public, no auth required)

**Test Cases for signin:**
- Returns token when no users configured (enabled: false)
- Returns token on valid name/password
- Returns 401 on invalid credentials
- Validates existing token
- Returns 401 when token user not found

**CRUD Tests:** Same as other CRUD endpoints

---

#### 8. `api.gcode.js` ✅ Priority: MEDIUM
**Endpoints:**
- `GET /api/gcode` - List gcode files
- `POST /api/gcode` - Upload gcode file
- `GET /api/gcode/download` - Download gcode file

**Test Cases:**
- GET: Lists files from configured directory
- POST: Uploads and saves file
- GET /download: Returns file content
- GET /download: Returns 404 when file not found
- Handles file system errors

**Dependencies to Mock:**
- File system operations (`fs`)
- File upload middleware (`multiparty`)

---

#### 9. `api.themes.js` ✅ Priority: LOW
**Endpoints:**
- `GET /api/themes` - List themes
- `POST /api/themes` - Create theme
- `GET /api/themes/path` - Get themes directory path
- `GET /api/themes/:id` - Read theme
- `PUT /api/themes/:id` - Update theme
- `DELETE /api/themes/:id` - Delete theme

**Test Cases:**
- File-based operations (read/write theme files)
- Validates theme structure
- Handles missing theme files (404)

**Dependencies to Mock:**
- File system operations
- Theme directory path

---

#### 10. `api.tool.js` ✅ Priority: LOW
**Endpoints:**
- `GET /api/tool` - Get tool config
- `POST /api/tool` - Set tool config

**Test Cases:**
- GET: Returns tool configuration
- POST: Updates tool configuration

---

#### 11. `api.watch.js` ✅ Priority: LOW (Legacy API)
**Endpoints:**
- `GET /api/watch/files` - List files in watch folder
- `GET /api/watch/file` - Read file content

**Test Cases:**
- Legacy single-folder watch API
- File listing and reading

---

## Testing Patterns

### Pattern 1: Unit Test (Direct Function Call)

```javascript
import { test } from 'tap';
import * as apiSettings from '../../src/server/api/api.settings';
import config from '../../src/server/services/configstore';

// Mock configstore
const mockConfig = {
  get: () => ({}),
  set: () => {},
};

test('api.settings.get returns defaults', (t) => {
  const req = createMockRequest();
  const res = createMockResponse();
  
  // Temporarily replace configstore
  // (using proxyquire or similar)
  
  apiSettings.get(req, res);
  
  t.equal(res.statusCode, 200);
  t.has(res.body, {
    connection: Object,
    general: Object,
  });
  t.end();
});
```

### Pattern 2: Integration Test (HTTP via supertest)

```javascript
import { test } from 'tap';
import request from 'supertest';
import appMain from '../../src/server/app';

// Create app instance with mocked dependencies
const app = appMain();

test('GET /api/settings returns defaults', async (t) => {
  const res = await request(app)
    .get('/api/settings')
    .set('Authorization', 'Bearer test-token')
    .expect(200);
  
  t.has(res.body, {
    connection: Object,
    general: Object,
  });
});
```

## Authentication Handling

Most endpoints require JWT authentication. Two approaches:

1. **Mock auth middleware** in unit tests (bypass auth)
2. **Generate valid test tokens** for integration tests

For unit tests, we'll mock the auth layer. For integration tests, we'll:
- Create a test user via signin endpoint
- Use that token for authenticated requests
- Or mock express-jwt middleware in test app setup

## Error Code Coverage

Ensure all error paths are tested:
- `400` (ERR_BAD_REQUEST) - Invalid input
- `401` (ERR_UNAUTHORIZED) - Auth failed
- `403` (ERR_FORBIDDEN) - Access denied
- `404` (ERR_NOT_FOUND) - Resource not found
- `409` (ERR_CONFLICT) - Resource conflict
- `500` (ERR_INTERNAL_SERVER_ERROR) - Server error

## Test Execution Strategy

### Phased Approach

**Phase 1 (Foundation):**
1. Set up test infrastructure (helpers, mocks)
2. Test `api.settings.js` (establishes patterns)
3. Test `api.extensions.js` (validates mock strategy)

**Phase 2 (CRUD Pattern):**
4. Test one full CRUD endpoint (`api.commands.js`)
5. Replicate pattern to other CRUD endpoints

**Phase 3 (Special Cases):**
6. Test specialized endpoints (gcode, themes, watch)
7. Test authentication flows (`api.users.js`)

**Phase 4 (Coverage & Edge Cases):**
8. Fill in missing edge cases
9. Add integration tests for critical paths
10. Verify coverage targets met

### Coverage Goals

- **Function Coverage:** 85%+ (currently 0%)
- **Branch Coverage:** 80%+ for all endpoints
- **Statement Coverage:** 90%+ for all endpoints

## Implementation Notes

1. **Isolation:** Each test should be independent, clean up after itself
2. **Speed:** Prefer unit tests (direct function calls) over integration tests where possible
3. **Clarity:** Use descriptive test names, group related tests with subtests
4. **Maintainability:** Extract common patterns to helper functions
5. **No Behavior Changes:** Test existing behavior only, do not modify source code

## Dependencies & Setup

### Required Dependencies
```bash
yarn add -D supertest  # HTTP testing
```

### Optional (if needed)
```bash
yarn add -D proxyquire  # Module mocking
yarn add -D mock-fs     # File system mocking
yarn add -D sinon       # Spies/stubs (if proxyquire insufficient)
```

## Estimated Scope

- **Test Files:** 16 endpoint test files + 1 helper file = 17 files
- **Test Cases:** ~200-250 individual test cases
- **Estimated Time:** 3-4 days of focused work

## Success Criteria

✅ All 16 endpoint files have test coverage  
✅ Function coverage for API endpoints > 85%  
✅ All error paths tested (400, 401, 404, 500)  
✅ Tests run successfully with `yarn test`  
✅ Tests enable confident refactoring of endpoint code  
