# Coverage Improvement Suggestions

Generated from `yarn test:coverage` (tap on `apps/server/test/*.js`).

**Last updated:** After Sender.js tests. All 645 tests pass. **Statements & lines ≥ 90%** ✅

## Current vs target

| Metric     | Current | Target (package.json) | Gap    |
|------------|---------|------------------------|--------|
| Statements | 90.21%  | 90%                    | +0.21% ✅ |
| Branches   | 81.72%  | 90%                    | −8.28% |
| Functions  | 70.10%  | 85%                    | −14.90%|
| Lines      | 90.21%  | 90%                    | +0.21% ✅ |

**Largest gap:** function coverage (68.04% vs 85%, gap: -16.96%). Still improving!

**Progress:** 
- Initial: 87.29% stmts, 78.01% branches, 53.09% funcs, 87.29% lines
- After high-impact work: 87.77% stmts, 79.75% branches, 56.70% funcs, 87.77% lines
- After Runner tests: 88.89% stmts, 80.06% branches, 68.04% funcs, 88.89% lines
- After **Sender.js** tests: **90.21% stmts (+1.32%), 81.72% branches (+1.66%), 70.10% funcs (+2.06%), 90.21% lines (+1.32%)** ✅

**Milestones:** Statements & lines now **≥ 90%** (target met). Function coverage +17 pts from baseline (53% → 70.1%).

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

### 2.1 `lib/Sender.js` ✅ **PARTIALLY COMPLETED**

- **Status:** **70.27% stmts, 75.55% branches, 81.57% funcs** (was 62%, 63%, 71%).
- **Action taken:** Extended `test/sender.js` with:
  - `load()` failure paths (empty, null, non-string gcode)
  - `ack()` / `next()` / `rewind()` when no gcode loaded; `ack()` when received ≥ sent
  - `hold()` / `unhold()` and event emission
  - `peek()` stateChanged behavior
  - `rewind()` resets sent/received/hold
  - `dataFilter` option (filtering lines)
  - `Sender.isValidTool`, tool stats, `parseGcodeWord`, `calculateDistance`
- **Still uncovered:** e.g. 1047, 1051–1060 (tool tracking / `updateToolTime` paths), more `processLineForDistance` branches.
- **Impact:** Statements & lines crossed 90% target; overall coverage up.

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
  - **TinyGRunner:** 43.47% functions (was 17.39%) — improved but still needs work
- **Impact:** Function coverage improved by **+11.34 percentage points** overall!

### 2.3 Grbl *Result* helpers (Echo, Help, Option, Version) — 52% stmts, lines 9–18

- **Uncovered:** Shared factory/helper block (lines 9–18).
- **Action:** Add parser tests that trigger those result types (e.g. echo, `$` help, option, version) so the helper code runs.
- **Impact:** Several files with the same pattern; one or two tests per type can cover them.

---

## 3. Lower priority / structural

### 3.1 `lib/decimal-places.js` (88% stmts, 25% branches)

- **Uncovered:** Lines 5–6 (branch).
- **Action:** Add tests that hit both branches (e.g. different `precision` or input cases).
- **Impact:** Small; useful for reaching branch target.

### 3.2 `lib/logger.js` (87.5% stmts, 50% branches, 40% funcs)

- **Uncovered:** Lines 8–11, 47–48, 56–57.
- **Action:** Unit tests for logging levels and any env-based or override behavior.
- **Impact:** Modest; improves lib coverage.

### 3.3 `evaluate-expression` / `evaluate-assignment-expression` / `translate-expression`

- **Current:** ~76–88% stmts; some branches and edge cases missing.
- **Action:** Add cases for malformed input, deeper nesting, and error paths already exercised in `exceptions` subtests.
- **Impact:** Solidifies existing coverage and branches.

---

## 4. API and `test/api/**` tests

- **Current:** `test:coverage` runs only `apps/server/test/*.js`. `test/api/**` is excluded.
- **Observation:** Running `apps/server/test/**/*.js` includes API tests but many fail (173 failures in a recent run). Coverage then also includes `api/*`, `services/*`, etc., and **overall** coverage drops (e.g. 73.75% stmts) because many uncovered modules are pulled in.
- **Action:**
  1. Fix and stabilize API tests (mock auth, configstore, etc.) so they pass.
  2. Then include `apps/server/test/**/*.js` in `test:coverage` and track API coverage separately if helpful.
- **Impact:** Important for API reliability; do after fixing failing tests.

---

## 5. Suggested order of work

1. ✅ Add **`ensure-type`** and **`gcode`** tests ( § 1.1, § 1.2 ) — **COMPLETED**
2. ✅ Add **config** tests ( § 1.3 ) — **PARTIALLY COMPLETED** (66.66% branches, up from 33%)
3. ✅ Add **Runner** tests ( § 2.2 ) — **COMPLETED**
4. ✅ Add **Sender** tests ( § 2.1 ) — **PARTIALLY COMPLETED** (70% stmts, 81% funcs; statements/lines ≥ 90%).
5. 🔄 **NEXT:** Continue **Sender** edge cases or **TinyGRunner** / **Grbl Result** helpers.
6. Cover **Grbl Result** helpers ( § 2.3 ) and **decimal-places** / **logger** ( § 3.1, § 3.2 ).
7. Fix **API** tests and then include them in coverage ( § 4 ).

**Next up:** See § 7 below for the prioritized list.

---

## 7. What's next for test coverage

**Current:** Statements & lines **≥ 90%** ✅. Focus on **functions (70.1% vs 85%)** and **branches (81.72% vs 90%)**.

| Priority | Area | Why |
|----------|------|-----|
| **1** | **Sender.js** (§ 2.1) | 70% stmts, 81% funcs; more tool-tracking / `processLineForDistance` edge cases |
| 2 | TinyGRunner | Still 43.47% functions; more parse() edge cases |
| 3 | Grbl Result helpers (§ 2.3) | Echo, Help, Option, Version — trigger those result types in parser tests |
| 4 | decimal-places (§ 3.1), logger (§ 3.2) | Small, easy wins for branch coverage |
| 5 | API tests (§ 4) | Fix failing `test/api/**` tests, then include in coverage |

**Remaining gaps:** Functions −14.9%; branches −8.28%.

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

Use the text coverage table and “Uncovered Line #s” to add tests for the specific files and lines above.
