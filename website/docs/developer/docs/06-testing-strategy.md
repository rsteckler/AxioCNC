---
id: 06-testing-strategy
sidebar_position: 6
title: Testing Strategy
---

# Testing Strategy

What kinds of tests exist, how to run them, and coverage expectations.

## Test Types

### Unit Tests

**Location:** `apps/server/test/`

**Framework:** [tap](https://node-tap.org/) (Test Anything Protocol)

**Purpose:** Test individual functions and modules in isolation

**Example:**
```javascript
import { test } from 'tap';
import { parseStatus } from '../src/server/lib/parser';

test('parseStatus handles valid input', (t) => {
  const result = parseStatus('<Idle|MPos:0,0,0>');
  t.same(result, {
    state: 'Idle',
    position: { x: 0, y: 0, z: 0 }
  });
  t.end();
});
```

## Running Tests Locally

### Server Tests

```bash
# Run all tests
yarn test:test

# Run with coverage
yarn test:coverage

# Run specific test file
node --require @babel/register apps/server/test/sender.js
```

**Test command breakdown:**
```bash
tap apps/server/test/*.js \
  --allow-incomplete-coverage \
  --timeout=0 \
  --node-arg=--require \
  --node-arg=@babel/register
```

### Frontend Tests

:::caution Placeholder
**Placeholder:** Frontend testing setup not yet configured. Consider Vitest for Vite-based testing.
:::

## Fixtures/Mocks Patterns

### Test Fixtures

**Location:** `apps/server/test/fixtures/`

**Example:**
```javascript
import fs from 'fs';
import path from 'path';

const fixturePath = path.resolve(__dirname, 'fixtures/test.gcode');
const gcode = fs.readFileSync(fixturePath, 'utf8');
```

### Mocking Dependencies

**For serial ports:**
```javascript
// Use mock-serialport or similar
const MockSerialPort = require('mock-serialport');
```

**For file system:**
```javascript
// Use fs mocks or temporary directories
import { tmpdir } from 'os';
import { mkdtemp } from 'fs/promises';
```

**For API calls:**
```javascript
// Mock HTTP requests with supertest or nock
import request from 'supertest';
```

## Coverage Expectations

**Target coverage** (from `ai/plans/testing.md`):

| Metric | Target |
|--------|--------|
| Statements | 90% |
| Branches | 80% |
| Functions | 60% |
| Lines | 90% |

### Checking Coverage

After running `yarn test:coverage`, review the output to identify:
1. Files with low coverage (< 80%)
2. Untested branches (if/else paths)
3. Untested functions
4. Uncovered lines

See `ai/plans/testing.md` for detailed testing priorities.

## Test Structure

### Basic Test File

```javascript
import { test } from 'tap';
import ModuleUnderTest from '../src/server/module/path';

test('test group name', (t) => {
  // Setup
  const instance = new ModuleUnderTest();
  
  // Assertions
  t.equal(actual, expected, 'descriptive message');
  t.same(actual, expected, 'deep equality');
  t.ok(condition, 'truthy');
  t.notOk(condition, 'falsy');
  
  t.end();
});
```

### Async Tests

```javascript
test('async operation', async (t) => {
  const result = await someAsyncFunction();
  t.equal(result, expected);
  // No t.end() needed with async functions
});
```

### Subtests

```javascript
test('main test group', (t) => {
  t.test('subtest 1', (subt) => {
    subt.equal(actual, expected);
    subt.end();
  });
  
  t.test('subtest 2', (subt) => {
    subt.equal(actual, expected);
    subt.end();
  });
  
  t.end();
});
```

## Testing Protected Code

**⚠️ Critical Rules:**

1. **DO NOT modify protected code** - Test what exists
2. **Test behavior, not implementation** - Focus on inputs/outputs
3. **Use mocks for hardware dependencies** - Mock serial ports, file system
4. **Test safety-critical paths** - Error handling, edge cases, state transitions

**Protected files:**
- `apps/server/src/lib/Sender.js`
- `apps/server/src/lib/Feeder.js`
- `apps/server/src/lib/Workflow.js`
- `apps/server/src/lib/SerialConnection.js`
- `apps/server/src/controllers/**`

See [Making Changes Safely](./07-making-changes-safely.md#protected-code) for details.

## Next Steps

- **[Making Changes Safely](./07-making-changes-safely.md)** - Security and protected code
- **[Contributing](./08-contributing.md)** - PR process
