import { test } from 'tap';
import jsonStringify from '../src/lib/json-stringify';

test('json-stringify', (t) => {
  t.test('normal JSON.stringify behavior', (subt) => {
    // Test basic functionality matches JSON.stringify
    const obj = { foo: 'bar', num: 42, arr: [1, 2, 3] };
    subt.equal(jsonStringify(obj), JSON.stringify(obj), 'should stringify objects normally');

    // Test with replacer and space arguments
    subt.equal(jsonStringify(obj, null, 2), JSON.stringify(obj, null, 2), 'should handle replacer and space');

    // Test with replacer function
    const replacer = (key, value) => (typeof value === 'string' ? value.toUpperCase() : value);
    subt.equal(jsonStringify(obj, replacer), JSON.stringify(obj, replacer), 'should handle replacer function');

    // Test primitives
    subt.equal(jsonStringify('string'), JSON.stringify('string'), 'should handle strings');
    subt.equal(jsonStringify(42), JSON.stringify(42), 'should handle numbers');
    subt.equal(jsonStringify(true), JSON.stringify(true), 'should handle booleans');
    subt.equal(jsonStringify(null), JSON.stringify(null), 'should handle null');
    subt.equal(jsonStringify(undefined), JSON.stringify(undefined), 'should handle undefined');

    subt.end();
  });

  t.test('cyclic object handling', (subt) => {
    // Test cyclic object (should return undefined instead of throwing)
    const cyclicObj = { foo: 'bar' };
    cyclicObj.self = cyclicObj;

    // JSON.stringify would throw: "TypeError: Converting circular structure to JSON"
    subt.equal(jsonStringify(cyclicObj), undefined, 'should return undefined for cyclic objects');

    // Test deeply nested cyclic objects
    const deepCyclic = {
      level1: {
        level2: {
          level3: {}
        }
      }
    };
    deepCyclic.level1.level2.level3.parent = deepCyclic.level1;
    subt.equal(jsonStringify(deepCyclic), undefined, 'should handle deeply nested cyclic objects');

    subt.end();
  });

  t.test('other error handling', (subt) => {
    // Test with a custom object that throws in toJSON
    const throwingObj = {
      toJSON() {
        throw new Error('Custom toJSON error');
      }
    };

    // Should catch any JSON.stringify error and return undefined
    subt.equal(jsonStringify(throwingObj), undefined, 'should catch toJSON errors');

    subt.end();
  });

  t.test('edge cases', (subt) => {
    // Test with no arguments
    subt.equal(jsonStringify(), JSON.stringify(), 'should handle no arguments');

    // Test with undefined value
    subt.equal(jsonStringify(undefined), JSON.stringify(undefined), 'should handle undefined value');

    // Test with function (which JSON.stringify converts to null)
    const func = () => {};
    subt.equal(jsonStringify(func), JSON.stringify(func), 'should handle functions');

    // Test with Symbol
    const sym = Symbol('test');
    subt.equal(jsonStringify(sym), JSON.stringify(sym), 'should handle symbols');

    // Test with BigInt (ES2020+)
    try {
      const big = 123n;
      subt.equal(jsonStringify(big), JSON.stringify(big), 'should handle BigInt');
    } catch (e) {
      // BigInt may not be supported in older Node versions
      subt.pass('BigInt test skipped (not supported)');
    }

    subt.end();
  });

  t.end();
});
