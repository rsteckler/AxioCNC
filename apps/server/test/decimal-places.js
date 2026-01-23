import { test } from 'tap';
import decimalPlaces from '../src/lib/decimal-places';

test('decimal-places', (t) => {
  t.test('normal cases', (st) => {
    st.equal(decimalPlaces(0), 0, '0 has 0 decimal places');
    st.equal(decimalPlaces(123), 0, '123 has 0 decimal places');
    st.equal(decimalPlaces(123.45), 2, '123.45 has 2 decimal places');
    st.equal(decimalPlaces(123.456789), 6, '123.456789 has 6 decimal places');
    st.equal(decimalPlaces(0.1), 1, '0.1 has 1 decimal place');
    st.equal(decimalPlaces(0.001), 3, '0.001 has 3 decimal places');
    st.equal(decimalPlaces('123.45'), 2, 'string "123.45" has 2 decimal places');
    st.equal(decimalPlaces('0.000'), 3, 'string "0.000" has 3 decimal places');
    st.end();
  });

  t.test('scientific notation', (st) => {
    st.equal(decimalPlaces(1e5), 0, '1e5 has 0 decimal places');
    st.equal(decimalPlaces(1.23e5), 0, '1.23e5 has 0 decimal places (adjusted)');
    st.equal(decimalPlaces(1.23e-2), 4, '1.23e-2 has 4 decimal places (2 + 2)');
    st.equal(decimalPlaces('1.23e5'), 0, 'string "1.23e5" has 0 decimal places');
    st.equal(decimalPlaces('1.23e-2'), 4, 'string "1.23e-2" has 4 decimal places');
    st.equal(decimalPlaces('1.23E5'), 0, 'string "1.23E5" (uppercase E) has 0 decimal places');
    st.equal(decimalPlaces('1.23E-2'), 4, 'string "1.23E-2" (uppercase E) has 4 decimal places');
    st.end();
  });

  t.test('edge cases', (st) => {
    st.equal(decimalPlaces(''), 0, 'empty string has 0 decimal places');
    st.equal(decimalPlaces('.'), 0, 'just decimal point has 0 decimal places');
    st.equal(decimalPlaces('.5'), 1, '.5 has 1 decimal place');
    st.equal(decimalPlaces('5.'), 0, '5. has 0 decimal places');
    st.equal(decimalPlaces(NaN), 0, 'NaN has 0 decimal places');
    st.equal(decimalPlaces(Infinity), 0, 'Infinity has 0 decimal places');
    st.equal(decimalPlaces(-Infinity), 0, '-Infinity has 0 decimal places');
    st.equal(decimalPlaces(null), 0, 'null has 0 decimal places');
    st.equal(decimalPlaces(undefined), 0, 'undefined has 0 decimal places');
    st.end();
  });

  t.end();
});
