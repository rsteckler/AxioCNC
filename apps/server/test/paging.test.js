import { test } from 'tap';
import { getPagingRange } from '../src/api/paging';

test('getPagingRange', (t) => {
  t.test('returns correct range for normal case', (st) => {
    const result = getPagingRange({ page: 1, pageLength: 10, totalRecords: 25 });
    st.same(result, [0, 10], 'should return correct range for first page');
    st.end();
  });

  t.test('returns correct range for second page', (st) => {
    const result = getPagingRange({ page: 2, pageLength: 10, totalRecords: 25 });
    st.same(result, [10, 20], 'should return correct range for second page');
    st.end();
  });

  t.test('returns correct range for last page with fewer records', (st) => {
    const result = getPagingRange({ page: 3, pageLength: 10, totalRecords: 25 });
    st.same(result, [20, 25], 'should return correct range for last page');
    st.end();
  });

  t.test('handles invalid page (negative)', (st) => {
    const result = getPagingRange({ page: -1, pageLength: 10, totalRecords: 25 });
    st.same(result, [0, 10], 'should adjust negative page to 1');
    st.end();
  });

  t.test('handles invalid page (zero)', (st) => {
    const result = getPagingRange({ page: 0, pageLength: 10, totalRecords: 25 });
    st.same(result, [0, 10], 'should adjust zero page to 1');
    st.end();
  });

  t.test('handles invalid page (non-numeric)', (st) => {
    const result = getPagingRange({ page: 'abc', pageLength: 10, totalRecords: 25 });
    st.same(result, [0, 10], 'should adjust non-numeric page to 1');
    st.end();
  });

  t.test('handles invalid pageLength (negative)', (st) => {
    const result = getPagingRange({ page: 1, pageLength: -5, totalRecords: 25 });
    st.same(result, [0, 10], 'should adjust negative pageLength to 10');
    st.end();
  });

  t.test('handles invalid pageLength (zero)', (st) => {
    const result = getPagingRange({ page: 1, pageLength: 0, totalRecords: 25 });
    st.same(result, [0, 10], 'should adjust zero pageLength to 10');
    st.end();
  });

  t.test('handles invalid pageLength (non-numeric)', (st) => {
    const result = getPagingRange({ page: 1, pageLength: 'xyz', totalRecords: 25 });
    st.same(result, [0, 10], 'should adjust non-numeric pageLength to 10');
    st.end();
  });

  t.test('adjusts page when beyond total records', (st) => {
    const result = getPagingRange({ page: 10, pageLength: 10, totalRecords: 25 });
    st.same(result, [20, 25], 'should adjust page to last valid page');
    st.end();
  });

  t.test('handles empty totalRecords', (st) => {
    const result = getPagingRange({ page: 1, pageLength: 10, totalRecords: 0 });
    st.same(result, [-10, 0], 'should return adjusted range for no records');
    st.end();
  });

  t.test('handles large pageLength', (st) => {
    const result = getPagingRange({ page: 1, pageLength: 100, totalRecords: 25 });
    st.same(result, [0, 25], 'should not exceed total records');
    st.end();
  });

  t.test('uses default values when parameters omitted', (st) => {
    const result = getPagingRange({});
    st.same(result, [-10, 0], 'should use defaults and return adjusted range');
    st.end();
  });

  t.end();
});