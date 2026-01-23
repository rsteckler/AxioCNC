import { test } from 'tap';
import ImmutableStore from '../src/lib/ImmutableStore';

test('ImmutableStore', (t) => {
  t.test('constructor - with initial state', (subt) => {
    const initialState = { foo: 'bar', nested: { key: 'value' } };
    const store = new ImmutableStore(initialState);

    subt.same(store.state, initialState);
    subt.equal(store.get('foo'), 'bar');
    subt.equal(store.get('nested.key'), 'value');
    subt.end();
  });

  t.test('constructor - without initial state', (subt) => {
    const store = new ImmutableStore();

    subt.same(store.state, {});
    subt.end();
  });

  t.test('get - retrieves value by key', (subt) => {
    const store = new ImmutableStore({ foo: 'bar', nested: { key: 'value' } });

    subt.equal(store.get('foo'), 'bar');
    subt.equal(store.get('nested.key'), 'value');
    subt.end();
  });

  t.test('get - returns defaultValue when key not found', (subt) => {
    const store = new ImmutableStore({ foo: 'bar' });

    subt.equal(store.get('nonexistent', 'default'), 'default');
    subt.equal(store.get('nested.key', 'default'), 'default');
    subt.end();
  });

  t.test('set - sets value and emits change event', (subt) => {
    const store = new ImmutableStore({ foo: 'bar' });
    let changeCount = 0;
    let lastState = null;

    store.on('change', (state) => {
      changeCount++;
      lastState = state;
    });

    const result = store.set('baz', 'qux');

    subt.equal(changeCount, 1, 'should emit change event');
    subt.same(lastState, { foo: 'bar', baz: 'qux' }, 'change event should receive new state');
    subt.same(result, { foo: 'bar', baz: 'qux' }, 'should return new state');
    subt.equal(store.get('baz'), 'qux', 'should set the value');
    subt.equal(store.get('foo'), 'bar', 'should preserve existing values');
    subt.end();
  });

  t.test('set - sets nested value', (subt) => {
    const store = new ImmutableStore({ nested: { key: 'value' } });

    store.set('nested.newKey', 'newValue');

    subt.equal(store.get('nested.newKey'), 'newValue');
    subt.equal(store.get('nested.key'), 'value', 'should preserve existing nested values');
    subt.end();
  });

  t.test('unset - removes key and emits change event', (subt) => {
    const store = new ImmutableStore({ foo: 'bar', baz: 'qux' });
    let changeCount = 0;
    let lastState = null;

    store.on('change', (state) => {
      changeCount++;
      lastState = state;
    });

    const result = store.unset('baz');

    subt.equal(changeCount, 1, 'should emit change event');
    subt.same(lastState, { foo: 'bar' }, 'change event should receive new state');
    subt.same(result, { foo: 'bar' }, 'should return new state');
    subt.equal(store.get('baz'), undefined, 'should remove the key');
    subt.equal(store.get('foo'), 'bar', 'should preserve other values');
    subt.end();
  });

  t.test('unset - removes nested key', (subt) => {
    const store = new ImmutableStore({ nested: { key: 'value', other: 'data' } });

    store.unset('nested.key');

    subt.equal(store.get('nested.key'), undefined);
    subt.equal(store.get('nested.other'), 'data', 'should preserve other nested values');
    subt.end();
  });

  t.test('unset - does not emit change if key does not exist', (subt) => {
    const store = new ImmutableStore({ foo: 'bar' });
    let changeCount = 0;

    store.on('change', () => {
      changeCount++;
    });

    store.unset('nonexistent');

    subt.equal(changeCount, 1, 'should still emit change event');
    subt.same(store.state, { foo: 'bar' }, 'state should remain unchanged');
    subt.end();
  });

  t.test('replace - removes key then sets new value', (subt) => {
    const store = new ImmutableStore({ foo: 'bar', baz: 'old' });
    let changeCount = 0;

    store.on('change', () => {
      changeCount++;
    });

    store.replace('baz', 'new');

    subt.equal(changeCount, 2, 'should emit change event twice (unset then set)');
    subt.equal(store.get('baz'), 'new', 'should have new value');
    subt.equal(store.get('foo'), 'bar', 'should preserve other values');
    subt.end();
  });

  t.test('replace - replaces nested value', (subt) => {
    const store = new ImmutableStore({ nested: { key: 'old', other: 'data' } });

    store.replace('nested.key', 'new');

    subt.equal(store.get('nested.key'), 'new');
    subt.equal(store.get('nested.other'), 'data', 'should preserve other nested values');
    subt.end();
  });

  t.test('clear - clears all state and emits change event', (subt) => {
    const store = new ImmutableStore({ foo: 'bar', baz: 'qux', nested: { key: 'value' } });
    let changeCount = 0;
    let lastState = null;

    store.on('change', (state) => {
      changeCount++;
      lastState = state;
    });

    const result = store.clear();

    subt.equal(changeCount, 1, 'should emit change event');
    subt.same(lastState, {}, 'change event should receive empty state');
    subt.same(result, {}, 'should return empty state');
    subt.same(store.state, {}, 'state should be cleared');
    subt.equal(store.get('foo'), undefined, 'should clear all values');
    subt.end();
  });

  t.test('clear - works on already empty store', (subt) => {
    const store = new ImmutableStore();
    let changeCount = 0;

    store.on('change', () => {
      changeCount++;
    });

    store.clear();

    subt.equal(changeCount, 1, 'should still emit change event');
    subt.same(store.state, {}, 'state should remain empty');
    subt.end();
  });

  t.test('immutability - set does not mutate original state', (subt) => {
    const initialState = { foo: 'bar' };
    const store = new ImmutableStore(initialState);

    store.set('baz', 'qux');

    subt.same(initialState, { foo: 'bar' }, 'original state should not be mutated');
    subt.same(store.state, { foo: 'bar', baz: 'qux' }, 'store state should be new object');
    subt.notSame(store.state, initialState, 'store state should be different object');
    subt.end();
  });

  t.test('immutability - unset does not mutate original state', (subt) => {
    const initialState = { foo: 'bar', baz: 'qux' };
    const store = new ImmutableStore(initialState);

    store.unset('baz');

    subt.same(initialState, { foo: 'bar', baz: 'qux' }, 'original state should not be mutated');
    subt.same(store.state, { foo: 'bar' }, 'store state should be new object');
    subt.notSame(store.state, initialState, 'store state should be different object');
    subt.end();
  });

  t.end();
});
