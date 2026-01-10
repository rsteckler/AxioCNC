# Testing Guide for AxioCNC Server

This document provides guidance for writing tests and improving code coverage in the AxioCNC server codebase.

---

## Test Framework

**Framework:** [tap](https://node-tap.org/) (Test Anything Protocol)
- **NOT Jest** — This project uses `tap`, not Jest
- All test files must use `import { test } from 'tap'`
- Test files live in the `test/` directory

### Running Tests

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn coveralls

# Run a specific test file
node --require @babel/register test/sender.js
```

### Test Command

```bash
tap test/*.js --allow-incomplete-coverage --timeout=0 --node-arg=--require --node-arg=@babel/register
```

---

## Current Test Coverage

**Overall Coverage (as of 2026-01-09):**
- Statements: **91.31%**
- Branches: **80.16%**
- Functions: **52.15%**
- Lines: **91.31%**

### Currently Tested Areas ✅

1. **Controller Parsers** (Well covered)
   - `test/grbl.js` — Grbl controller line parser (16 subtests)
   - `test/marlin.js` — Marlin controller line parser (7 subtests)
   - `test/smoothie.js` — Smoothie controller line parser (14 subtests)
   - `test/tinyg.js` — TinyG controller line parser (7 subtests)

2. **Core Libraries** (Partially covered)
   - `test/sender.js` — G-code streaming engine (`Sender.js`)
   - `test/evaluate-expression.js` — Expression evaluation
   - `test/evaluate-assignment-expression.js` — Assignment expressions
   - `test/translate-expression.js` — Expression translation
   - `test/controller-utils.js` — G-code utilities (M6 replacement)

---

## Priority Areas for New Tests

### 🔴 High Priority (No Coverage)

#### 1. **REST API Endpoints** (`src/server/api/`)
**Current Status:** Zero test coverage

**Endpoints to Test:**
- `api.settings.js` — System settings (GET/POST with Zod validation)
- `api.extensions.js` — Extension data (GET/POST schemaless)
- `api.controllers.js` — Controller status listing
- `api.machine.js` — Machine status queries
- `api.machines.js` — Multiple machine operations
- `api.gcode.js` — G-code file operations
- `api.commands.js` — Command execution
- `api.mdi.js` — Manual Data Input
- `api.macros.js` — Macro management
- `api.events.js` — Event trigger management
- `api.users.js` — User authentication/management
- `api.tool.js` — Tool management
- `api.themes.js` — Theme management
- `api.watch.js` — File watching
- `api.watchfolders.js` — Watch folder management
- `api.version.js` — Version info

**Testing Approach:**
```javascript
import { test } from 'tap';
import request from 'supertest'; // You may need to install this
import app from '../src/server/app';

test('GET /api/settings returns defaults', async (t) => {
  const res = await request(app)
    .get('/api/settings')
    .set('Authorization', 'Bearer test-token');
  
  t.equal(res.status, 200);
  t.has(res.body, {
    connection: Object,
    general: Object,
  });
  t.end();
});
```

#### 2. **Server Services** (`src/server/services/`)
**Current Status:** Zero test coverage

**Services to Test:**
- `services/cncengine/CNCEngine.js` — Core engine managing controllers
- `services/configstore/` — Configuration persistence (CRUD operations)
- `services/machinestatus/MachineStatusManager.js` — Machine status tracking
- `services/monitor/` — File system monitoring
- `services/taskrunner/TaskRunner.js` — System task execution

**Testing Approach:**
```javascript
import { test } from 'tap';
import configstore from '../src/server/services/configstore';

test('configstore sets and gets values', (t) => {
  configstore.set('test.key', 'value');
  t.equal(configstore.get('test.key'), 'value');
  t.end();
});
```

#### 3. **Protected Library Components** (`src/server/lib/`)
**Status:** ⚠️ **Protected Code** — Test only, do not modify without permission

**Files Needing Tests:**
- `lib/Feeder.js` — Command queue (currently 0% coverage)
- `lib/Workflow.js` — State machine (currently 0% coverage)
- `lib/SerialConnection.js` — Serial port handling (currently 0% coverage)
- `lib/EventTrigger.js` — Event triggers (currently 0% coverage)
- `lib/MessageSlot.js` — M0/M1 pause handling (currently 0% coverage)
- `lib/ImmutableStore.js` — Immutable state store (currently 0% coverage)
- `lib/logger.js` — Logging utilities (87.5% coverage — needs edge cases)
- `lib/decimal-places.js` — Decimal formatting (88.23% coverage)
- `lib/json-stringify.js` — JSON utilities (needs tests)
- `lib/urljoin.js` — URL joining (needs tests)
- `lib/delay.js` — Delay utilities (needs tests)

**⚠️ Important:** These are safety-critical components. When writing tests:
- Test behavior, not implementation
- Use mocks for serial port operations
- Test error conditions thoroughly
- Do NOT modify the source code — test what exists

#### 4. **Application Setup** (`src/server/`)
- `app.js` — Express app configuration
- `index.js` — Server startup
- `access-control.js` — Authentication middleware

---

### 🟡 Medium Priority (Partial Coverage)

#### 1. **Sender.js** (Currently 84.69% coverage)
**Missing Coverage:**
- Edge cases in streaming protocols
- Error recovery scenarios
- Buffer overflow conditions
- Concurrent operations

#### 2. **Expression Evaluation** (Currently ~81% coverage)
**Missing Coverage:**
- Complex nested expressions
- Error handling edge cases
- Performance with large expressions

#### 3. **Controller Line Parsers** (Currently ~92-93% coverage)
**Missing Coverage:**
- Unusual firmware variations
- Malformed input handling
- 6-axis edge cases (some parsers)

---

## Test Structure & Patterns

### Basic Test File Structure

```javascript
import { test } from 'tap';
import ModuleUnderTest from '../src/server/module/path';

test('test group name', (t) => {
  // Test setup
  const instance = new ModuleUnderTest();
  
  // Assertions
  t.equal(actual, expected, 'descriptive message');
  t.same(actual, expected, 'for deep equality');
  t.ok(condition, 'for truthy');
  t.notOk(condition, 'for falsy');
  
  t.end();
});
```

### Using Subtests

```javascript
test('main test group', (t) => {
  t.test('subtest 1', (subt) => {
    // subt assertions
    subt.end();
  });
  
  t.test('subtest 2', (subt) => {
    // subt assertions
    subt.end();
  });
  
  t.end();
});
```

### Async Tests

```javascript
test('async operation', async (t) => {
  const result = await someAsyncFunction();
  t.equal(result, expected);
  // No need to call t.end() with async functions
});
```

### Testing Event Emitters

```javascript
test('event emitter', (t) => {
  const emitter = new EventEmitter();
  
  emitter.on('event', (data) => {
    t.equal(data, expected);
    t.end();
  });
  
  emitter.emit('event', expected);
});
```

### Testing Error Conditions

```javascript
test('handles errors', (t) => {
  try {
    functionThatThrows();
    t.fail('should have thrown');
  } catch (err) {
    t.equal(err.message, 'expected error message');
  }
  t.end();
});
```

### Mocking Dependencies

```javascript
import { test } from 'tap';
import sinon from 'sinon'; // Install if needed: yarn add -D sinon

test('mocked dependency', (t) => {
  const stub = sinon.stub(dependency, 'method');
  stub.returns('mocked value');
  
  // Test code that uses dependency
  
  t.ok(stub.called);
  stub.restore();
  t.end();
});
```

---

## Testing REST API Endpoints

### Setup for API Tests

You'll likely need to:
1. Create a test Express app instance
2. Mock authentication middleware
3. Mock database/configstore
4. Use `supertest` for HTTP assertions

**Example:**
```javascript
import { test } from 'tap';
import request from 'supertest';
import express from 'express';

// Create minimal app for testing
const app = express();
app.use('/api/settings', settingsRouter);

test('API endpoint test', async (t) => {
  const res = await request(app)
    .get('/api/settings')
    .set('Authorization', 'Bearer test-token')
    .expect(200);
  
  t.has(res.body, { connection: Object });
});
```

### Authentication Mocking

Many endpoints require JWT authentication. Mock the auth middleware:

```javascript
// test/mocks/auth.js
export const mockAuth = (req, res, next) => {
  req.user = { id: 'test-user', name: 'Test User' };
  req.token = 'mock-token';
  next();
};
```

---

## Testing Protected Code

**⚠️ Critical Rules:**

1. **DO NOT modify protected code** — Test what exists
2. **Test behavior, not implementation** — Focus on inputs/outputs
3. **Use mocks for hardware dependencies** — Mock serial ports, file system
4. **Test safety-critical paths** — Error handling, edge cases, state transitions

### Protected Files (Test Only)

- `src/server/lib/Sender.js`
- `src/server/lib/Feeder.js`
- `src/server/lib/Workflow.js`
- `src/server/lib/SerialConnection.js`
- `src/server/lib/EventTrigger.js`
- `src/server/lib/MessageSlot.js`
- `src/server/controllers/**`

### Testing Approach for Protected Code

```javascript
// Test Sender.js (example - it already has tests)
test('Sender handles load error gracefully', (t) => {
  const sender = new Sender(SP_TYPE_SEND_RESPONSE);
  
  // Test invalid input
  const result = sender.load('file.gcode', null, {});
  t.notOk(result, 'should fail on null content');
  
  t.end();
});
```

**For SerialConnection (no tests yet):**
```javascript
test('SerialConnection mock test', (t) => {
  // Use mock serial port library
  const MockSerialPort = require('mock-serialport');
  const connection = new SerialConnection({
    port: '/dev/mock',
    SerialPort: MockSerialPort,
  });
  
  connection.on('open', () => {
    t.pass('connection opened');
    t.end();
  });
  
  connection.open();
});
```

---

## Code Coverage Goals

### Target Coverage
- **Statements:** 95%+ (currently 91.31%)
- **Branches:** 90%+ (currently 80.16%)
- **Functions:** 85%+ (currently 52.15%)
- **Lines:** 95%+ (currently 91.31%)

### Checking Coverage

After running `yarn coveralls`, review the output to identify:
1. Files with low coverage (< 80%)
2. Untested branches (if/else paths)
3. Untested functions
4. Uncovered lines

Focus on increasing function coverage (currently only 52.15%).

---

## Test File Organization

### Naming Convention
- Test files: `test/<module-name>.js`
- Match the source file name when possible
- Example: `src/server/lib/Feeder.js` → `test/feeder.js`

### Test Directory Structure

```
test/
├── fixtures/           # Test fixtures (gcode files, mock data)
│   └── jsdc.gcode
├── mocks/             # Mock objects and utilities (create if needed)
├── api/               # API endpoint tests (create)
│   ├── settings.test.js
│   ├── extensions.test.js
│   └── ...
├── services/          # Service tests (create)
│   ├── configstore.test.js
│   └── ...
├── lib/               # Library tests (add to existing)
│   ├── feeder.test.js
│   ├── workflow.test.js
│   └── ...
└── controllers/       # Controller parser tests (already exist)
    ├── grbl.js
    ├── marlin.js
    └── ...
```

---

## Best Practices

### 1. **Isolation**
- Each test should be independent
- Clean up after tests (restore mocks, clear state)
- Use `t.beforeEach` and `t.afterEach` for setup/teardown

### 2. **Descriptive Names**
```javascript
// Good
test('Sender rejects invalid buffer size', (t) => { ... });

// Bad
test('test 1', (t) => { ... });
```

### 3. **Test Edge Cases**
- Null/undefined inputs
- Empty strings/arrays
- Very large values
- Invalid types
- Network errors
- Timeouts

### 4. **Test Error Handling**
- Verify errors are thrown when expected
- Check error messages are descriptive
- Test error recovery paths

### 5. **Use Fixtures**
Store test data in `test/fixtures/`:
```javascript
import fs from 'fs';
import path from 'path';

const fixturePath = path.resolve(__dirname, 'fixtures/test-data.json');
const testData = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
```

### 6. **Mock External Dependencies**
- File system operations
- Network requests
- Serial port communication
- System commands

### 7. **Assertion Messages**
Always include descriptive messages:
```javascript
t.equal(result, expected, 'should return parsed status');
```

---

## Common Testing Patterns in This Codebase

### Testing Line Parsers (Current Pattern)

```javascript
test('GrblLineParserResultStatus', (t) => {
  const runner = new GrblRunner();
  
  runner.on('status', ({ raw, ...status }) => {
    t.equal(raw, '<Idle>');
    t.same(status, {
      activeState: 'Idle',
      subState: 0
    });
    t.end();
  });
  
  runner.parse('<Idle>');
});
```

### Testing Event-Driven Code

```javascript
test('Sender emits events', (t) => {
  const sender = new Sender(SP_TYPE_SEND_RESPONSE);
  
  sender.on('load', (name, gcode, context) => {
    t.equal(name, 'test.gcode');
    t.end();
  });
  
  sender.load('test.gcode', 'G0 X0', {});
});
```

### Testing with Fixtures

```javascript
test('Sender loads G-code file', (t) => {
  const file = path.resolve(__dirname, 'fixtures/jsdc.gcode');
  const content = fs.readFileSync(file, 'utf8');
  const sender = new Sender(SP_TYPE_SEND_RESPONSE);
  
  const ok = sender.load(path.basename(file), content, {});
  t.ok(ok, 'should load file successfully');
  t.end();
});
```

---

## Tools You May Need

### Dependencies to Install

```bash
# For API testing
yarn add -D supertest

# For mocking
yarn add -D sinon
yarn add -D proxyquire  # For module mocking

# For serial port mocking (if testing SerialConnection)
yarn add -D mock-serialport  # Or similar

# For test utilities
yarn add -D factory-girl  # If you need factories
yarn add -D faker  # For generating test data
```

### Existing Dependencies
- `tap` — Already installed
- `progress` — For progress bars in tests (see `test/sender.js`)

---

## Checklist for New Tests

- [ ] Test file follows naming convention (`test/<module>.js`)
- [ ] Uses `import { test } from 'tap'`
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests cover edge cases (null, empty, invalid)
- [ ] Uses descriptive test names
- [ ] Includes assertion messages
- [ ] Cleans up after itself (mocks, state)
- [ ] Runs successfully with `yarn test`
- [ ] Improves coverage metrics
- [ ] For protected code: Tests behavior only, doesn't modify source

---

## Resources

- [tap Documentation](https://node-tap.org/docs/getting-started/)
- [Test Anything Protocol](https://testanything.org/)
- Project: `aidocs/protected-code.md` — Protected code guidelines
- Project: `docs/API.md` — API documentation for endpoint testing

---

## Questions or Issues?

If you encounter:
- **Protected code** — Stop and ask for permission before modifying
- **Missing test utilities** — Check if dependency exists, propose addition
- **Complex mocking scenarios** — Document the approach for future reference
- **Coverage not improving** — Review coverage report for specific uncovered lines

---

## Getting Started

1. **Pick an area** from Priority Areas (start with High Priority)
2. **Review existing tests** in `test/` for patterns
3. **Check coverage** with `yarn coveralls` to see what's missing
4. **Write a test file** following the patterns above
5. **Run tests** with `yarn test`
6. **Verify coverage** improved with `yarn coveralls`
7. **Submit PR** with test file and coverage improvements

**Example First Test:**

Start with a simple service test:

```javascript
// test/services/configstore.test.js
import { test } from 'tap';
import configstore from '../../src/server/services/configstore';

test('configstore basic operations', (t) => {
  t.test('get returns undefined for missing key', (subt) => {
    const value = configstore.get('nonexistent.key');
    subt.equal(value, undefined);
    subt.end();
  });
  
  t.test('set and get', (subt) => {
    configstore.set('test.key', 'value');
    const value = configstore.get('test.key');
    subt.equal(value, 'value');
    // Cleanup
    configstore.delete('test.key');
    subt.end();
  });
  
  t.end();
});
```

Happy testing! 🧪
