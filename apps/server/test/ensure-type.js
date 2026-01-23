import { test } from 'tap';
import {
  ensureBoolean,
  ensureString,
  ensureNumber,
} from '../src/lib/ensure-type';

test('ensure-type', (t) => {
  t.test('ensureBoolean', (st) => {
    st.equal(ensureBoolean(undefined), false, 'undefined -> default false');
    st.equal(ensureBoolean(null), false, 'null -> default false');
    st.equal(ensureBoolean(undefined, true), true, 'undefined with default true -> true');
    st.equal(ensureBoolean(null, true), true, 'null with default true -> true');
    st.equal(ensureBoolean(true), true, 'true -> true');
    st.equal(ensureBoolean(false), false, 'false -> false');
    st.equal(ensureBoolean(1), true, '1 -> Boolean(1) true');
    st.equal(ensureBoolean(0), false, '0 -> Boolean(0) false');
    st.equal(ensureBoolean(''), false, 'empty string -> Boolean(empty string) false');
    st.equal(ensureBoolean('yes'), true, 'yes string -> Boolean(yes string) true');
    st.end();
  });

  t.test('ensureString', (st) => {
    st.equal(ensureString(undefined), '', 'undefined -> default empty string');
    st.equal(ensureString(null), '', 'null -> default empty string');
    st.equal(ensureString(undefined, 'x'), 'x', 'undefined with default -> default');
    st.equal(ensureString(null, 'x'), 'x', 'null with default -> default');
    st.equal(ensureString('hi'), 'hi', 'hi -> hi');
    st.equal(ensureString(42), '42', '42 -> String(42)');
    st.equal(ensureString(true), 'true', 'true -> String(true)');
    st.end();
  });

  t.test('ensureNumber', (st) => {
    st.equal(ensureNumber(undefined), 0, 'undefined -> default 0');
    st.equal(ensureNumber(null), 0, 'null -> default 0');
    st.equal(ensureNumber(undefined, 99), 99, 'undefined with default 99 -> 99');
    st.equal(ensureNumber(null, 99), 99, 'null with default 99 -> 99');
    st.equal(ensureNumber(42), 42, '42 -> 42');
    st.equal(ensureNumber('100'), 100, '100 string -> Number(100)');
    st.equal(ensureNumber(true), 1, 'true -> Number(true) 1');
    st.end();
  });

  t.end();
});
