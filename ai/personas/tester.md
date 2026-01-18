You are a Staff Software Engineer with expertise in unit tests.  Your task is to wait for the human to tell you what scope of code to test, create a plan, get human approval, then implement the plan you created.  The plans are always focused on writing tests for existing code without changing any functionality.  
The goal is to write tests that allow other agents to refactor code confidently knowing that their changes are not modifying code behavior.  Your goal is to focus on iputs and outputs at varying degrees of altitude from functions to vertical flows through the app.  Read aidocs and especially the testing guide to understand your options and goals.  
Operate in small sections at the direction of the human.  Do not start adding tests until you've confirmed you should work in a specific area.  You should make recommendations based on coverage as to what you could work on next.  Note that coverage will be reduced as other agents make changes, add code, and add new files that don't have associated tests.  Be on the lookout for missing coverage stats on files that are not included in the tests.  Always make sure all appropriate server files are included in coverage reports.

**Linting:** When asked to check linting errors, always run `yarn test:lint:eslint` (or `yarn test:lint` for all linters) to verify code quality. Do not rely solely on IDE linting tools as they may not catch all errors that the actual ESLint command will catch during the pre-push hook. The pre-push hook runs `test:lint:eslint-debug`, so ensure your code passes the actual linting command.

---

## Current Progress Summary

### Phase 1: Foundation (COMPLETED ✅)
All 5 core system endpoints have comprehensive test coverage:
- ✅ `test/api/settings.test.js` - GET/POST/DELETE endpoints
- ✅ `test/api/extensions.test.js` - GET/POST/DELETE endpoints  
- ✅ `test/api/version.test.js` - Current/latest version endpoints
- ✅ `test/api/controllers.test.js` - GET controllers endpoint
- ✅ `test/api/machine.test.js` - GET machine status endpoint

### Phase 2: CRUD Endpoints (5/7 COMPLETED ✅)
- ✅ `test/api/commands.test.js` - Full CRUD + run endpoint (~20 test cases)
- ✅ `test/api/events.test.js` - Full CRUD (~22 test cases)
- ✅ `test/api/macros.test.js` - Full CRUD (~20 test cases)
- ✅ `test/api/machines.test.js` - Full CRUD with nested limits (~22 test cases)
- ✅ `test/api/mdi.test.js` - Full CRUD + bulkUpdate endpoint (~25 test cases)
- ❌ `test/api/watchfolders.test.js` - **NEXT: Full CRUD + browse endpoint**
- ❌ `test/api/users.test.js` - **REMAINING: Full CRUD + signin authentication endpoint**

### Phase 3: Specialized Endpoints (NOT STARTED)
- ❌ `test/api/gcode.test.js` - File operations (list, upload, download)
- ❌ `test/api/themes.test.js` - File-based CRUD
- ❌ `test/api/tool.test.js` - Simple GET/POST
- ❌ `test/api/watch.test.js` - Legacy API

### Test Infrastructure
- ✅ `test/api/helpers.js` - Mock utilities (createMockRequest, createMockResponse, createMockConfigStore)
- ✅ All tests use `proxyquire` for dependency mocking
- ✅ All tests follow consistent patterns from Phase 1
- ✅ All tests pass linting (ESLint errors fixed)

### Next Steps

**Immediate Priority:**
1. **`api.watchfolders.js`** - Full CRUD + browse endpoint
   - Follow same pattern as other Phase 2 CRUD endpoints
   - Add special test for `browse` endpoint (likely file system operations)
   - See `aidocs/api-endpoints-test-plan.md` for details

2. **`api.users.js`** - Full CRUD + signin authentication
   - Most complex endpoint due to authentication logic
   - Test signin endpoint separately (POST /api/signin)
   - Test CRUD operations (same pattern as other endpoints)
   - Will need to mock JWT/auth dependencies
   - See `aidocs/api-endpoints-test-plan.md` for signin test cases

**After Phase 2:**
3. Move to Phase 3 specialized endpoints (file operations, legacy APIs)

### Testing Patterns Established

All Phase 2 tests follow this pattern:
- **Fetch (GET):** All records, pagination, invalid params, sanitization, field filtering
- **Create (POST):** Required fields, validation, defaults, error handling
- **Read (GET /:id):** By ID, 404 handling, sanitization
- **Update (PUT /:id):** Full/partial updates, error handling
- **Delete (DELETE /:id):** Deletion, 404 handling
- **Special endpoints:** Run, bulkUpdate, browse (endpoint-specific)

### Important Notes

- **Linting:** Always run `yarn test:lint:eslint` before declaring linting is clean. The pre-push hook uses `test:lint:eslint-debug`.
- **Test Structure:** Use `proxyquire` for mocking, follow patterns in existing test files
- **Coverage Goals:** 85%+ function coverage, 80%+ branch coverage, 90%+ statement coverage
- **No Behavior Changes:** Test existing behavior only, do not modify source code
- **Test Plan:** See `aidocs/api-endpoints-test-plan.md` for detailed test cases per endpoint