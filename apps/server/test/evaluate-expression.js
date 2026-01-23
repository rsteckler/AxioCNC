import { test } from 'tap';
import evaluateExpression from '../src/lib/evaluate-expression';

test('resolved', (t) => {
  const src = '[1,2,3+4*10+(n||6),foo(3+5),obj[""+"x"].y]';
  const res = evaluateExpression(src, {
    n: false,
    foo: function (x) {
      return x * 100;
    },
    obj: {
      x: {
        y: 555
      }
    }
  });
  t.same(res, [1, 2, 49, 800, 555]);
  t.end();
});

test('unresolved', (t) => {
  const src = '[1,2,3+4*10*z+n,foo(3+5),obj[""+"x"].y]';
  const res = evaluateExpression(src, {
    n: 6,
    foo: function (x) {
      return x * 100;
    },
    obj: {
      x: {
        y: 555
      }
    }
  });
  t.equal(res, undefined);
  t.end();
});

test('boolean', (t) => {
  const src = '[ 1===2+3-16/4, [2]==2, [2]!==2, [2]!==[2] ]';
  t.same(evaluateExpression(src), [true, true, true, true]);
  t.end();
});

test('array methods', (t) => {
  const src = '[1, 2, 3].map(function(n) { return n * 2 })';
  t.same(evaluateExpression(src), [2, 4, 6]);
  t.end();
});

test('array methods with vars', (t) => {
  const src = '[1, 2, 3].map(function(n) { return n * x })';
  t.same(evaluateExpression(src, { x: 2 }), [2, 4, 6]);
  t.end();
});

test('evaluate this', (t) => {
  const src = 'this.x + this.y.z';
  const res = evaluateExpression(src, {
    'this': {
      x: 1,
      y: {
        z: 100
      }
    }
  });
  t.equal(res, 101);
  t.end();
});

test('unresolved function expression', (t) => {
  const src = '(function(){console.log("Not Good")})';
  const res = evaluateExpression(src);
  t.equal(res, undefined);
  t.end();
});

test('immediate-invoked function expression with a return value', (t) => {
  const src = '(function(){ return !!x; }(x))';
  const res = evaluateExpression(src, { x: 1 });
  t.equal(res, true);
  t.end();
});

test('function property', (t) => {
  const src = '[1,2,3+4*10+n,beep.boop(3+5),obj[""+"x"].y]';
  const res = evaluateExpression(src, {
    n: 6,
    beep: {
      boop: function (x) {
        return x * 100;
      }
    },
    obj: {
      x: {
        y: 555
      }
    }
  });
  t.same(res, [1, 2, 49, 800, 555]);
  t.end();
});

test('untagged template strings', (t) => {
  const src = '`${1},${2 + n},${"4,5"}`'; // eslint-disable-line no-template-curly-in-string
  const res = evaluateExpression(src, {
    n: 6
  });
  t.same(res, '1,8,4,5');
  t.end();
});

test('tagged template strings', (t) => {
  const src = 'taggedTemplate`${1},${2 + n},${"4,5"}`'; // eslint-disable-line no-template-curly-in-string
  const res = evaluateExpression(src, {
    taggedTemplate: function (strings, ...values) {
      t.same(strings, ['', ',', ',', '']);
      t.same(values, [1, 8, '4,5']);
      return 'foo';
    },
    n: 6
  });

  t.same(res, 'foo');
  t.end();
});

test('unary operators', (t) => {
  // Test all unary operators: +, -, ~, !
  t.test('positive operator', (st) => {
    st.equal(evaluateExpression('+"42"'), 42);
    st.equal(evaluateExpression('+42'), 42);
    st.end();
  });

  t.test('negative operator', (st) => {
    st.equal(evaluateExpression('-42'), -42);
    st.equal(evaluateExpression('-"42"'), -42);
    st.end();
  });

  t.test('bitwise not operator', (st) => {
    st.equal(evaluateExpression('~5'), ~5);
    st.equal(evaluateExpression('~"5"'), ~5);
    st.end();
  });

  t.test('logical not operator', (st) => {
    st.equal(evaluateExpression('!true'), false);
    st.equal(evaluateExpression('!false'), true);
    st.equal(evaluateExpression('!0'), true);
    st.equal(evaluateExpression('!1'), false);
    st.end();
  });

  t.end();
});

test('binary operators', (t) => {
  t.test('arithmetic operators', (st) => {
    st.equal(evaluateExpression('2 + 3'), 5);
    st.equal(evaluateExpression('5 - 2'), 3);
    st.equal(evaluateExpression('3 * 4'), 12);
    st.equal(evaluateExpression('8 / 2'), 4);
    st.equal(evaluateExpression('7 % 3'), 1);
    st.end();
  });

  t.test('comparison operators', (st) => {
    st.equal(evaluateExpression('2 < 3'), true);
    st.equal(evaluateExpression('3 <= 3'), true);
    st.equal(evaluateExpression('4 > 3'), true);
    st.equal(evaluateExpression('3 >= 3'), true);
    st.equal(evaluateExpression('3 === 3'), true);
    st.equal(evaluateExpression('3 !== 4'), true);
    st.end();
  });

  t.test('logical operators', (st) => {
    st.equal(evaluateExpression('true && false'), false);
    st.equal(evaluateExpression('true || false'), true);
    st.end();
  });

  t.end();
});

test('complex expressions', (t) => {
  t.test('computed member access', (st) => {
    const vars = {
      arr: [10, 20, 30],
      obj: { prop: 'value' }
    };
    st.equal(evaluateExpression('arr[1]', vars), 20);
    st.equal(evaluateExpression('obj["prop"]', vars), 'value');
    st.end();
  });

  t.test('array literals', (st) => {
    st.same(evaluateExpression('[1, 2, 3]'), [1, 2, 3]);
    st.end();
  });

  t.end();
});

test('conditional expressions', (t) => {
  t.test('ternary operator', (st) => {
    st.equal(evaluateExpression('true ? "yes" : "no"'), 'yes');
    st.equal(evaluateExpression('false ? "yes" : "no"'), 'no');
    st.end();
  });

  t.end();
});

test('edge cases', (t) => {
  t.test('empty variables object', (st) => {
    st.equal(evaluateExpression('42'), 42);
    st.end();
  });

  t.test('invalid vars parameter', (st) => {
    st.equal(evaluateExpression('42', null), 42);
    st.equal(evaluateExpression('42', undefined), 42);
    st.equal(evaluateExpression('42', "string"), 42);
    st.end();
  });

  t.end();
});
