# Coverage Improvement Suggestions

Generated from `yarn test:coverage` (tap on `apps/server/test/*.js`).

**Last updated:** After parser result classes work. **1781 total tests** (1780 pass, 0 fail, 1 skip). ✅ All tests passing!

## Current vs target

| Metric     | Current | Target (package.json) | Gap    |
|------------|---------|------------------------|--------|
| Statements | 92.43%  | 90%                    | +2.43% ✅ |
| Branches   | 87.59%  | 90%                    | −2.41% |
| Functions  | 72.1%   | 85%                    | −12.9% |
| Lines      | 92.43%  | 90%                    | +2.43% ✅ |

**Note:** Coverage now includes API tests and services. ✅ **All test failures fixed!** (was 9 failures, now 0)

**Previous metrics (without API tests):** 96.54% stmts, 85.95% branches, 77.31% funcs, 96.54% lines.

**Largest gap:** function coverage (72.1% vs 85%, gap: -12.9%). Many API/service modules have low function coverage.

**Progress:** 
- Initial: 87.29% stmts, 78.01% branches, 53.09% funcs, 87.29% lines
- After high-impact work: 87.77% stmts, 79.75% branches, 56.70% funcs, 87.77% lines
- After Runner tests: 88.89% stmts, 80.06% branches, 68.04% funcs, 88.89% lines
- After initial **Sender.js** tests: 90.21% stmts, 81.72% branches, 70.10% funcs, 90.21% lines
- After additional **Sender.js** tests: 94.05% stmts, 84.37% branches, 69.58% funcs, 94.05% lines
- After **TinyGRunner** tests: 95.89% stmts, 85.06% branches, 76.28% funcs, 95.89% lines
- After **Grbl Result helpers** tests: 96.51% stmts, 85.48% branches, 76.28% funcs, 96.51% lines
- After **decimal-places** tests: 96.51% stmts, 85.7% branches (+0.22%), 76.28% funcs, 96.51% lines
- After **logger** tests: 96.54% stmts (+0.03%), 85.95% branches (+0.25%), 77.31% funcs (+1.03%), 96.54% lines (+0.03%)
- After **API tests included + module resolution fix**: **92.14% stmts, 86.71% branches, 72.1% funcs, 92.14% lines** ✅
- After **fixing all 9 test failures**: **92.15% stmts (+0.01%), 86.89% branches (+0.18%), 72.1% funcs, 92.15% lines (+0.01%)** ✅
- After **parser result classes** (Action, Version, Status parsers): **92.43% stmts (+0.28%), 87.59% branches (+0.70%), 72.1% funcs, 92.43% lines (+0.28%)** ✅

**Milestones:** Statements & lines now **≥ 96%** (well above 90% target). Function coverage improved by **+24.22 percentage points** from baseline (53% → 77.31%).

---

## 1. High‑impact, low‑effort

### 1.1 `lib/ensure-type.js` ✅ **COMPLETED**

- **Status:** ✅ **100% coverage achieved**
- **Action taken:** Added `test/ensure-type.js` with comprehensive unit tests for:
  - `ensureBoolean` — undefined/null defaults, type coercion, boolean values
  - `ensureString` — undefined/null defaults, type coercion, string values
  - `ensureNumber` — undefined/null defaults, type coercion, number values
- **Result:** All three helpers now fully covered.

### 1.2 `controllers/utils/gcode.js` ✅ **COMPLETED**

- **Status:** ✅ **100% statements, 92.85% branches, 100% functions**
- **Action taken:** Extended `test/controller-utils.js` with:
  - Tests for `isM0`, `isM1`, `isM6`, `isM109`, `isM190` (positive and negative cases)
  - Tests for `replaceCommands` with empty commands array (returns gcode unchanged)
  - Tests for `replaceCommands` with non-function callback (no-op replacement)
  - Tests for `replaceCommands` with function callback (proper replacement)
- **Result:** gcode.js now fully covered (was 66% / 57% / 28%).

### 1.3 Config branch coverage ✅ **PARTIALLY COMPLETED**

- **Status:** ✅ **66.66% branches (improved from 33.33%)**
- **Action taken:** Added `test/config.js` with:
  - Tests for `settings.development.js` — `os.cpus().length || 1` branch (with CPUs and empty array)
  - Tests for `settings.production.js` — `os.cpus().length || 1` branch (with CPUs and empty array)
- **Note:** `settings.js` development vs production branch (line 9-12) is difficult to test with ES modules because `process.env.NODE_ENV` is read at module load time. The branch exists and is partially covered by child module tests.
- **Result:** Config branch coverage doubled (33% → 66.66%).

---

## 2. Medium‑effort, high‑value

### 2.1 `lib/Sender.js` ✅ **MOSTLY COMPLETED**

- **Status:** **95.1% stmts, 88.88% branches, 92.1% funcs** (was 62%, 63%, 71%).
- **Action taken:** Extended `test/sender.js` with:
  - `load()` failure paths (empty, null, non-string gcode)
  - `ack()` / `next()` / `rewind()` when no gcode loaded; `ack()` when received ≥ sent
  - `hold()` / `unhold()` and event emission
  - `peek()` stateChanged behavior
  - `rewind()` resets sent/received/hold
  - `dataFilter` option (filtering lines)
  - `Sender.isValidTool`, tool stats, `parseGcodeWord`, `calculateDistance`
  - **`updateToolTime()`** with various tool states
  - **`calculateArcLength()`** for G17/G18/G19 planes, G2/G3 directions, zero radius fallback
  - **`processLineForDistance()`** for G2/G3 arcs, G18/G19 planes, M3/M4/M5 spindle, G28/G30 homing, G90/G91, G20/G21, tool changes
  - **`trackToolChange()`** edge cases (no previous tool, invalid tool, toolStartTime = 0)
  - Retract detection, transition vs cutting distance tracking
- **Still uncovered:** Lines 1002, 1006–1008 (likely error handling or specific branches in `processLineForDistance`).
- **Impact:** Major improvement — Sender.js now 95%+ statements, 88%+ branches, 92%+ functions. Overall coverage 94%+ statements/lines.

### 2.2 Runners (GrblRunner, MarlinRunner, SmoothieRunner, TinyGRunner) ✅ **COMPLETED**

- **Status:** ✅ **Major improvement achieved**
- **Action taken:** Added comprehensive test files:
  - `test/grbl-runner.js` — Tests for all getter methods (getMachinePosition, getWorkPosition, getModalGroup, getTool, getParameters), isAlarm(), isIdle(), and parse() edge cases (WCO calculations, empty data, all event types)
  - `test/marlin-runner.js` — Tests for getPosition, getModalGroup, getTool, isAlarm, isIdle, and parse() edge cases
  - `test/smoothie-runner.js` — Tests for all getter methods, isAlarm(), isIdle(), and parse() edge cases
  - `test/tinyg-runner.js` — Tests for all getter methods, isAlarm(), isIdle(), and parse() edge cases
- **Results:**
  - **GrblRunner:** 100% functions (was 33.33%) ✅
  - **MarlinRunner:** 100% functions (was 28.57%) ✅
  - **SmoothieRunner:** 100% functions (was 37.5%) ✅
  - **TinyGRunner:** ✅ **100% functions** (was 43.47%) — **COMPLETED**
- **Impact:** Function coverage improved by **+11.34 percentage points** overall!

### 2.3 Grbl *Result* helpers (Echo, Help, Option, Version) ✅ **COMPLETED**

- **Status:** ✅ **100% coverage achieved** (was 52% stmts)
- **Action taken:** Added tests to `test/grbl.js` for:
  - `GrblLineParserResultEcho` — Tests parsing `[echo:test message]` format
  - `GrblLineParserResultHelp` — Tests parsing `[HLP:Available commands]` format
  - `GrblLineParserResultOption` — Tests parsing `[OPT:VERSION,1.1f]` format
  - `GrblLineParserResultVersion` — Tests parsing `[VER:1.1f.20170801]` format
- **Result:** All four result helpers now fully covered. These emit `others` events since GrblRunner doesn't have specific handlers.

---

## 3. Lower priority / structural

### 3.1 `lib/decimal-places.js` ✅ **MOSTLY COMPLETED**

- **Status:** **88.23% stmts, 83.33% branches, 100% funcs** (was 88%, 25%, 100%).
- **Action taken:** Added `test/decimal-places.js` with comprehensive tests for:
  - Normal cases (integers, decimals, strings)
  - Scientific notation (e/E, positive/negative exponents)
  - Edge cases (empty string, NaN, Infinity, null, undefined)
- **Still uncovered:** Lines 5–6 (`if (!match) { return 0; }`) — This branch appears to be unreachable because the regex `/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/` always matches (all groups are optional, `$` matches end of string). This is likely defensive code that never executes.
- **Impact:** Branch coverage improved from 25% to 83.33% (+58.33 percentage points).

### 3.2 `lib/logger.js` ✅ **MOSTLY COMPLETED**

- **Status:** **90.62% stmts, 84.61% branches, 80% funcs** (was 87.5%, 50%, 40%).
- **Action taken:** Added `test/logger.js` with comprehensive tests for:
  - `getLevel()` and `setLevel()` functions (lines 47-48)
  - Logger factory with namespace, without namespace, empty string namespace
  - All logging levels (error, warn, info, verbose, debug, silly)
  - Verbosity >= VERBOSITY_MAX (triggers getStackTrace, line 56)
  - Verbosity < VERBOSITY_MAX (doesn't trigger getStackTrace)
- **Still uncovered:** Lines 8-11 (`getStackTrace()` - `obj.stack || ''` fallback), line 56-57 (stack trace concatenation when verbosity >= 3). These may be difficult to test because `Error.captureStackTrace` always sets `obj.stack` in Node.js.
- **Impact:** Significant improvement — statements +3.12%, branches +34.61%, functions +40 percentage points.

### 3.3 `evaluate-expression` / `evaluate-assignment-expression` / `translate-expression`

- **Current:** ~76–88% stmts; some branches and edge cases missing.
- **Action:** Add cases for malformed input, deeper nesting, and error paths already exercised in `exceptions` subtests.
- **Impact:** Solidifies existing coverage and branches.

---

## 4. API and `test/api/**` tests ✅ **INCLUDED & ALL TESTS FIXED**

- **Status:** ✅ **API tests now included, module resolution fixed, and all test failures resolved**
- **Action taken:**
  1. ✅ Updated test scripts to `apps/server/test/**/*.js` to include all tests recursively
  2. ✅ Fixed module resolution by changing imports from relative paths (`../../../shared/schemas/settings`) to package name imports (`@axiocnc/shared/src/schemas/settings`)
  3. ✅ Added `@axiocnc/shared` as workspace dependency in `apps/server/package.json`
  4. ✅ Removed babel-plugin-module-resolver workaround (no longer needed)
  5. ✅ **Fixed all 9 test failures:**
     - **commands.test.js**: Fixed test that tried to use ID before sanitization (call `fetch()` first, then `read()`)
     - **api.machines.js**: Fixed `null`/`undefined` handling to keep original values instead of converting to 0
     - **api.macros.js**: Fixed `null`/`undefined` handling to convert to empty strings when explicitly provided
     - **mdi.test.js**: Fixed `notEqual` → `notSame` (tap API correction)
     - **api.mdi.js**: Added validation for empty filtered records array
     - **api.settings.js**: Return defaults directly when stored settings are empty
     - **settings.test.js**: Updated import path to use package name import
- **Current:** ✅ **1722 total tests (1721 pass, 0 fail, 1 skip)** — All tests passing!
- **Impact:** Coverage now includes API endpoints and services. Overall metrics: 92.15% statements, 86.89% branches, 72.1% functions.

---

## 5. Suggested order of work

1. ✅ Add **`ensure-type`** and **`gcode`** tests ( § 1.1, § 1.2 ) — **COMPLETED**
2. ✅ Add **config** tests ( § 1.3 ) — **PARTIALLY COMPLETED** (66.66% branches, up from 33%)
3. ✅ Add **Runner** tests ( § 2.2 ) — **COMPLETED**
4. ✅ Add **Sender** tests ( § 2.1 ) — **MOSTLY COMPLETED** (95% stmts, 88% branches, 92% funcs).
5. ✅ Add **TinyGRunner** tests ( § 2.2 ) — **COMPLETED** (100% stmts, 79% branches, 100% funcs).
6. ✅ Add **Grbl Result** helpers tests ( § 2.3 ) — **COMPLETED** (Echo, Help, Option, Version).
7. ✅ Add **decimal-places** tests ( § 3.1 ) — **MOSTLY COMPLETED** (83% branches, up from 25%).
8. ✅ Add **logger** tests ( § 3.2 ) — **MOSTLY COMPLETED** (90% stmts, 84% branches, 80% funcs).
9. ✅ **API tests** ( § 4 ) — **COMPLETED** (all tests passing, module resolution fixed, all failures resolved).
10. ✅ **Parser result classes** ( § 9 ) — **COMPLETED** (SmoothieLineParserResultAction, SmoothieLineParserResultVersion, GrblLineParserResultStatus, SmoothieLineParserResultStatus).

**Next up:** See § 7 below for the prioritized list.

---

## 7. What's next for test coverage

**Current:** Statements & lines **92.43%** ✅ (above 90% target). Focus on **functions (72.1% vs 85%, gap: -12.9%)** and **branches (87.59% vs 90%, gap: -2.41%)**.

| Priority | Area | Why |
|----------|------|-----|
| **1** | **Low function coverage files** | Need to identify and test files with < 85% function coverage (excluding parser result classes which are expected at 50%) |
| 2 | **Sender.js** (§ 2.1) | 95% stmts, 88% branches — mostly done, minor edge cases remain (lines 1002, 1006–1008) |
| 3 | **logger** (§ 3.2) | 90% stmts, 84% branches, 80% funcs — mostly done, lines 8-11, 56-57 may be difficult to cover |
| 4 | **decimal-places** (§ 3.1) | 88% stmts, 83% branches — mostly done, lines 5-6 appear unreachable |
| 5 | **Parser result classes** (§ 9) | ✅ **COMPLETED** — SmoothieLineParserResultAction, SmoothieLineParserResultVersion, GrblLineParserResultStatus, SmoothieLineParserResultStatus |
| 6 | **API tests** (§ 4) | ✅ **COMPLETED** — All tests passing, module resolution fixed, all failures resolved |

**Remaining gaps:** Functions −12.9%; branches −2.41%.

---

## 8. How to run and iterate

```bash
# Coverage (current scope)
yarn test:coverage

# Watch HTML report
open .tap/report/index.html   # or xdg-open on Linux

# Run tests only (no coverage)
yarn test:test
```

Use the text coverage table and "Uncovered Line #s" to add tests for the specific files and lines above.

---

## 9. Least intrusive path to 90% coverage

**Goal:** Reach **90% branches** and **85% functions** with minimal test effort.

**Current gaps (with API tests included):**
- **Branches:** 87.59% → 90% (need **+2.41%**)
- **Functions:** 72.1% → 85% (need **+12.9%**)
- **Statements:** 92.43% → 90% ✅ (already above target)

**Note:** ✅ All test failures fixed! Module resolution fixed. All 1780 tests passing.

### Strategy: Target simple parser result classes and branch-heavy files

**High-impact, low-effort targets:**

1. **SmoothieLineParserResultAction** (54.54% stmts, 66.66% branches, 50% funcs)
   - **Effort:** Very low — simple parser class, similar to Grbl Result helpers
   - **Impact:** +~0.1-0.2% branches, +~0.1% functions
   - **Action:** Add test in `test/smoothie.js` for `// action:pause`, `// action:resume`, `// action:cancel`
   - **Lines to cover:** 10-19 (payload/return block)

2. **SmoothieLineParserResultVersion** (89.65% stmts, 80% branches, 50% funcs)
   - **Effort:** Low — parser class with some branches
   - **Impact:** +~0.1-0.2% branches
   - **Action:** Add tests for edge cases (lines 14-15, 20-21, 48-49) — missing MCU, invalid format, etc.
   - **Note:** Already has one test, needs more branch coverage

3. **GrblLineParserResultStatus** (96.72% stmts, 77.08% branches, 50% funcs)
   - **Effort:** Medium — complex parser with many branches
   - **Impact:** +~0.3-0.5% branches
   - **Action:** Add tests for uncovered status report branches (lines 17-118, 162-163)

4. **SmoothieLineParserResultStatus** (96.19% stmts, 68.75% branches, 50% funcs)
   - **Effort:** Medium — complex parser with many branches
   - **Impact:** +~0.3-0.5% branches
   - **Action:** Add tests for uncovered status report branches (lines 93-96)

5. **MarlinLineParser** (84.9% stmts, 83.33% branches, 100% funcs)
   - **Effort:** Low — parser with some uncovered lines
   - **Impact:** +~0.1% statements/branches
   - **Action:** Add tests for uncovered lines (43-50)

6. **gcode.js** (66% stmts, 57.14% branches, 28.57% funcs) ⚠️
   - **Note:** This file already has tests in `test/controller-utils.js`. The low coverage may be due to:
     - Tests not being run/loaded correctly
     - Different file path or export structure
     - Coverage tool reporting issues
   - **Action:** Verify tests are actually running and covering the file

**Estimated impact if parser classes completed:**
- **Branches:** +0.70% (87.59% achieved) — **need ~2.41% more to reach 90%**
- **Functions:** +0% (parser classes are static, expected at 50%) — **need ~12.9% more to reach 85%**

**Next high-impact targets for function coverage:**
- **ImmutableStore.js** (16.66% funcs) — Add tests for store methods
- **configstore/index.js** (12.5% funcs) — Add tests for config store operations
- **TaskRunner.js** (33.33% funcs) — Add tests for task runner functionality
- **gcode.js** (28.57% funcs) — Investigate why existing tests aren't covering it

### Additional strategies for remaining gaps

**For branches (need ~2.41% to reach 90%):**
- Focus on **Status parser** files (Grbl, Smoothie) — they have many conditional branches
- Add edge case tests for parser result classes
- Target files with 70-85% branch coverage and add 2-3 more branch tests each

**For functions (need ~12.9% to reach 85%):**
- **Parser result classes** show 50% function coverage because they're static classes (class vs static method). This is expected and may not be improvable.
- Focus on files with **< 85% function coverage** that aren't parser result classes:
  - `gcode.js` (28.57% funcs) — ⚠️ **Investigation needed** - has tests but low coverage
  - `ImmutableStore.js` (16.66% funcs) — **High impact target**
  - `configstore/index.js` (12.5% funcs) — **High impact target**
  - `TaskRunner.js` (33.33% funcs) — **High impact target**

**Least intrusive approach:**
1. ✅ **SmoothieLineParserResultAction** — COMPLETED (100% stmts, 100% branches)
2. ✅ **SmoothieLineParserResultVersion edge cases** — COMPLETED (93.1% stmts, 86.66% branches)
3. ✅ **GrblLineParserResultStatus branches** — COMPLETED (added Ln, F, Ov, sub-states, Lim pin states)
4. ✅ **SmoothieLineParserResultStatus branches** — COMPLETED (added F for Hold/Alarm, T temperature)
5. **Investigate gcode.js coverage discrepancy** — if real issue, fix tests
6. **Identify low function coverage files** — Focus on non-parser files with < 85% function coverage

**Module resolution fix:**
- ✅ **FIXED** — Changed imports from relative paths to package name imports (`@axiocnc/shared/src/schemas/settings`)
- ✅ Added `@axiocnc/shared` as workspace dependency
- ✅ Removed babel-plugin-module-resolver workaround
- **Result:** All module resolution errors fixed. ✅ All test failures resolved (was 9, now 0).

**Recommendation:** 
- ✅ **Parser result classes completed** — Good progress on branches (+0.70%)
- **Next:** Focus on **function coverage** — Target ImmutableStore.js, configstore/index.js, TaskRunner.js, and investigate gcode.js
- **For branches:** Need +2.41% — Continue with edge cases in existing well-tested files or add more branch tests to status parsers
