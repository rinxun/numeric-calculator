/**
 * Tests for plus, minus, times, divide, chaining, operand types, toFixed and
 * toPrecision.
 *
 * Every expected value comes from exact decimal arithmetic on BigInt (see
 * exact-decimal.js), never from the library itself. The library documents its
 * results as precise to 15 significant digits (toPrecision() defaults to 15),
 * so the theoretical result of an operation is the exact result rounded to 15
 * significant digits, stored as the nearest double.
 *
 * Some 1.0.x limitations are kept as todo tests: they run and report on every
 * run without failing it. Each todo names the cause.
 *
 * Run with `yarn test` (builds index.js first).
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const Calculator = require("../index.js").default;
const {
  parseDecimal,
  addDecimal,
  subtractDecimal,
  multiplyDecimal,
  roundHalfAwayFromZero,
  roundSignificant,
  significantCandidates,
  divideDecimal,
  makeRandom,
  randomDecimal,
  expectAll,
} = require("./exact-decimal");

const PRECISION = 15;
/**
 * Theoretical public result of an exact decimal: rounded to 15 significant
 * digits, as a double. Within one double step of a 15-digit tie either
 * neighbour is accepted (see significantCandidates).
 */
const expected15 = (dec) => significantCandidates(dec, PRECISION).map(Number);
/** Theoretical public result of the exact quotient a / b. */
const expectedQuotient = (a, b) =>
  significantCandidates(divideDecimal(parseDecimal(a), parseDecimal(b), PRECISION), PRECISION).map(Number);

/** Random operand: below 10^7 with 0-4 decimals, so sums stay within 12 digits. */
const operand = (random, allowNegative = true) =>
  randomDecimal(random, 10000000, Math.floor(random() * 5), allowNegative);

/** Random money amount: below 10^7 with 2 decimals. */
const money = (random, allowNegative = true) =>
  randomDecimal(random, 10000000, 2, allowNegative);

/** n random pairs from `make`. */
function* pairs(seed, n, make) {
  const random = makeRandom(seed);
  for (let i = 0; i < n; i++) yield { a: make(random), b: make(random) };
}

const N = 100000;

/**
 * Known 1.0.x limitations, used as `todo` reasons. Each is fixed by scaling
 * operands to exact integers (Math.round) in processTimes/processDivide and by
 * dividing once in processDivide; drop the todo when that lands.
 */
const KNOWN = {
  scaling:
    "1.0.x scales operands with a float multiply (4486513.64 * 100 = 448651363.99999994), " +
    "so about 0.5-1.5% of results are off in the last digits",
  divide:
    "1.0.x rounds the quotient to 15 digits, scales it, and the caller rounds again, " +
    "so a few quotients are off by one in the 15th digit",
};

// #region plus / minus
test("plus: a + b equals the exact sum, operands of the same sign", () => {
  const random = makeRandom(11);
  function* cases() {
    for (let i = 0; i < N; i++) {
      const sign = random() < 0.5 ? "-" : "";
      yield { a: sign + operand(random, false), b: sign + operand(random, false) };
    }
  }
  expectAll(cases(), ({ a, b }) => ({
    actual: new Calculator(Number(a)).plus(Number(b)).toPrecision(),
    expected: expected15(addDecimal(parseDecimal(a), parseDecimal(b))),
  }));
});

test("plus: a + b equals the exact sum, operands of any sign", { todo: KNOWN.scaling }, () => {
  expectAll(pairs(12, N, operand), ({ a, b }) => ({
    actual: new Calculator(Number(a)).plus(Number(b)).toPrecision(),
    expected: expected15(addDecimal(parseDecimal(a), parseDecimal(b))),
  }));
});

test("minus: a - b equals the exact difference", { todo: KNOWN.scaling }, () => {
  expectAll(pairs(13, N, operand), ({ a, b }) => ({
    actual: new Calculator(Number(a)).minus(Number(b)).toPrecision(),
    expected: expected15(subtractDecimal(parseDecimal(a), parseDecimal(b))),
  }));
});

test("minus: money a - b equals the exact difference", { todo: KNOWN.scaling }, () => {
  expectAll(pairs(14, N, money), ({ a, b }) => ({
    actual: new Calculator(Number(a)).minus(Number(b)).toPrecision(),
    expected: expected15(subtractDecimal(parseDecimal(a), parseDecimal(b))),
  }));
});

test("plus/minus on money, then toFixed(2), equal the exact result", () => {
  expectAll(pairs(15, N, money), ({ a, b }) => {
    const exact = subtractDecimal(parseDecimal(a), parseDecimal(b));
    return {
      actual: new Calculator(Number(a)).minus(Number(b)).toFixed(2),
      expected: roundHalfAwayFromZero(exact, 2).replace(/^-(0\.00)$/, "$1"),
    };
  });
});

test("plus: several operands at once equal the exact sum", { todo: KNOWN.scaling }, () => {
  const random = makeRandom(16);
  function* cases() {
    for (let i = 0; i < N / 4; i++) {
      yield { ops: Array.from({ length: 2 + Math.floor(random() * 5) }, () => money(random)) };
    }
  }
  expectAll(cases(), ({ ops }) => ({
    actual: new Calculator(Number(ops[0])).plus(...ops.slice(1).map(Number)).toPrecision(),
    expected: expected15(ops.map(parseDecimal).reduce(addDecimal)),
  }));
});

test("minus: x - x is 0 and x - 0 is x", () => {
  const random = makeRandom(17);
  for (let i = 0; i < 10000; i++) {
    const x = Number(operand(random));
    assert.equal(new Calculator(x).minus(x).toPrecision(), 0, `${x} - ${x}`);
    assert.equal(new Calculator(x).minus(0).toPrecision(), x, `${x} - 0`);
    assert.equal(new Calculator(x).plus(0).toPrecision(), x, `${x} + 0`);
  }
});

test("plus is commutative: a + b equals b + a", () => {
  expectAll(pairs(18, N, operand), ({ a, b }) => ({
    actual: new Calculator(Number(a)).plus(Number(b)).toPrecision(),
    expected: new Calculator(Number(b)).plus(Number(a)).toPrecision(),
  }));
});
// #endregion

// #region times
/**
 * The library multiplies the operands as integers (1.25 * 0.5 -> 125 * 5), so
 * results are exact only while that integer product stays a safe integer.
 * Beyond it, enableCheckBoundary warns (tested below).
 */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const productIsSafe = (a, b) => {
  const { unscaled } = multiplyDecimal(parseDecimal(a), parseDecimal(b));
  return (unscaled < 0n ? -unscaled : unscaled) <= MAX_SAFE;
};

test("times: a * b equals the exact product, within the safe-integer range", { todo: KNOWN.scaling }, () => {
  function* cases() {
    for (const pair of pairs(21, N, operand)) if (productIsSafe(pair.a, pair.b)) yield pair;
  }
  expectAll(cases(), ({ a, b }) => ({
    actual: new Calculator(Number(a)).times(Number(b)).toPrecision(),
    expected: expected15(multiplyDecimal(parseDecimal(a), parseDecimal(b))),
  }));
});

test("enableCheckBoundary warns when the integer product leaves the safe range", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  new Calculator(4408410.0051, { enableCheckBoundary: true }).times(-8862149.1585);
  assert.ok(warn.mock.callCount() > 0, "expected a boundary warning");
  warn.mock.resetCalls();
  new Calculator(1.25, { enableCheckBoundary: true }).times(0.5);
  assert.equal(warn.mock.callCount(), 0, "no warning for a small product");
});

test("times: money * rate equals the exact product", () => {
  const random = makeRandom(22);
  function* cases() {
    for (let i = 0; i < N; i++) {
      yield { a: money(random), r: randomDecimal(random, 100, 4) };
    }
  }
  expectAll(cases(), ({ a, r }) => ({
    actual: new Calculator(Number(a)).times(Number(r)).toPrecision(),
    expected: expected15(multiplyDecimal(parseDecimal(a), parseDecimal(r))),
  }));
});

test("times: small numbers written in exponent form", () => {
  const random = makeRandom(23);
  function* cases() {
    for (let i = 0; i < N / 4; i++) {
      // e.g. 1.234e-9 * 5.6e-7: mantissas with up to 4 digits, exponents -12..-5
      const a = `${(1 + Math.floor(random() * 9999)) / 1000}e-${5 + Math.floor(random() * 8)}`;
      const b = `${(1 + Math.floor(random() * 9999)) / 1000}e-${5 + Math.floor(random() * 8)}`;
      yield { a, b };
    }
  }
  const toDec = (str) => {
    const [mantissa, exponent] = str.split("e");
    const dec = parseDecimal(mantissa);
    return { unscaled: dec.unscaled, scale: dec.scale - Number(exponent) };
  };
  expectAll(cases(), ({ a, b }) => ({
    actual: new Calculator(Number(a)).times(Number(b)).toPrecision(),
    expected: expected15(multiplyDecimal(toDec(a), toDec(b))),
  }));
});

test("times is commutative and has 1 as identity", () => {
  expectAll(pairs(24, N, operand), ({ a, b }) => ({
    actual: new Calculator(Number(a)).times(Number(b)).toPrecision(),
    expected: new Calculator(Number(b)).times(Number(a)).toPrecision(),
  }));
  const random = makeRandom(25);
  for (let i = 0; i < 10000; i++) {
    const x = Number(operand(random));
    assert.equal(new Calculator(x).times(1).toPrecision(), x, `${x} * 1`);
  }
});
// #endregion

// #region divide
test("divide: a / b equals the exact quotient rounded to 15 significant digits", { todo: KNOWN.divide }, () => {
  const random = makeRandom(31);
  function* cases() {
    for (let i = 0; i < N; i++) {
      const a = operand(random);
      let b = operand(random);
      if (Number(b) === 0) b = "1";
      yield { a, b };
    }
  }
  expectAll(cases(), ({ a, b }) => ({
    actual: new Calculator(Number(a)).divide(Number(b)).toPrecision(),
    expected: expectedQuotient(a, b),
  }));
});

test("divide: money / pay periods equals the exact quotient", () => {
  const random = makeRandom(32);
  const periods = ["1", "12", "24", "26", "52"];
  function* cases() {
    for (let i = 0; i < N; i++) {
      yield { a: money(random), p: periods[Math.floor(random() * periods.length)] };
    }
  }
  expectAll(cases(), ({ a, p }) => ({
    actual: new Calculator(Number(a)).divide(Number(p)).toPrecision(),
    expected: expectedQuotient(a, p),
  }));
});

test("divide: (a * b) / b gives back a when the product is exact", () => {
  const random = makeRandom(33);
  function* cases() {
    for (let i = 0; i < N; i++) {
      const a = money(random);
      let b = randomDecimal(random, 1000, 2);
      if (Number(b) === 0) b = "1.25";
      const product = roundHalfAwayFromZero(multiplyDecimal(parseDecimal(a), parseDecimal(b)), 4);
      yield { a, b, product };
    }
  }
  expectAll(cases(), ({ a, b, product }) => ({
    actual: new Calculator(Number(product)).divide(Number(b)).toPrecision(),
    expected: Number(a),
  }));
});
// #endregion

// #region chaining and operands
test("chained plus/minus/times equal the exact result", { todo: KNOWN.scaling }, () => {
  const random = makeRandom(41);
  function* cases() {
    for (let i = 0; i < N / 2; i++) {
      // (a + b) * r - c, all money except a 2-decimal rate below 10
      yield { a: money(random), b: money(random), r: randomDecimal(random, 10, 2), c: money(random) };
    }
  }
  expectAll(cases(), ({ a, b, r, c }) => {
    const exact = subtractDecimal(
      multiplyDecimal(addDecimal(parseDecimal(a), parseDecimal(b)), parseDecimal(r)),
      parseDecimal(c)
    );
    return {
      actual: new Calculator(Number(a)).plus(Number(b)).times(Number(r)).minus(Number(c)).toPrecision(),
      expected: expected15(exact),
    };
  });
});

test("string, number and Calculator operands give the same result", () => {
  const random = makeRandom(42);
  for (let i = 0; i < 10000; i++) {
    const a = operand(random);
    const b = operand(random);
    const fromNumbers = new Calculator(Number(a)).plus(Number(b)).toPrecision();
    assert.equal(new Calculator(a).plus(b).toPrecision(), fromNumbers, `"${a}" + "${b}"`);
    assert.equal(
      new Calculator(new Calculator(a)).plus(new Calculator(b)).toPrecision(),
      fromNumbers,
      `Calculator(${a}) + Calculator(${b})`
    );
  }
});

test("the first operand can come from the operation when the constructor has none", () => {
  assert.equal(new Calculator().plus(0.1, 0.2).toPrecision(), 0.3);
  assert.equal(new Calculator().minus(1, 0.9).toPrecision(), 0.1);
  assert.equal(new Calculator().times(0.1, 3).toPrecision(), 0.3);
  assert.equal(new Calculator().divide(0.3, 0.1).toPrecision(), 3);
});

test("well-known float traps give the exact decimal result", () => {
  const cases = [
    { op: "plus", a: "0.1", b: "0.2", exact: "0.3" },
    { op: "plus", a: "0.7", b: "0.1", exact: "0.8" },
    { op: "minus", a: "1", b: "0.9", exact: "0.1" },
    { op: "minus", a: "0.3", b: "0.1", exact: "0.2" },
    { op: "times", a: "0.1", b: "3", exact: "0.3" },
    { op: "times", a: "1.005", b: "1000", exact: "1005" },
    { op: "times", a: "19.9", b: "100", exact: "1990" },
    { op: "divide", a: "0.3", b: "0.1", exact: "3" },
    { op: "divide", a: "0.69", b: "10", exact: "0.069" },
  ];
  expectAll(cases, ({ op, a, b, exact }) => ({
    actual: new Calculator(Number(a))[op](Number(b)).toPrecision(),
    expected: Number(exact),
  }));
});
// #endregion

// #region documented behaviour that is not arithmetic
test("non-numeric string operands count as 0", () => {
  assert.equal(new Calculator("abc").plus(5).toPrecision(), 5);
  assert.equal(new Calculator(5).plus("abc").toPrecision(), 5);
  assert.equal(new Calculator(5).times("abc").toPrecision(), 0);
});

test("times by 0 and divide by 0 both give 0", () => {
  assert.equal(new Calculator(12.34).times(0).toPrecision(), 0);
  assert.equal(new Calculator(12.34).divide(0).toPrecision(), 0);
});
// #endregion

// #region toFixed / toPrecision
test("toFixed(n): values not on a half match exact rounding", () => {
  const random = makeRandom(51);
  function* cases() {
    for (let i = 0; i < N; i++) {
      const n = 1 + Math.floor(random() * 4);
      const str = randomDecimal(random, 1000000, n + 1 + Math.floor(random() * 2));
      const dec = parseDecimal(str);
      const tail = dec.unscaled % 10n ** BigInt(dec.scale - n);
      const half = 5n * 10n ** BigInt(dec.scale - n - 1);
      if (tail === half || tail === -half) continue;
      yield { str, n };
    }
  }
  expectAll(cases(), ({ str, n }) => ({
    actual: new Calculator(Number(str)).toFixed(n),
    expected: roundHalfAwayFromZero(parseDecimal(str), n).replace(/^-(0\.0+)$/, "$1"),
  }));
});

test("toFixed() pads to the configured fraction digits, default 2", () => {
  assert.equal(new Calculator(3).toFixed(), "3.00");
  assert.equal(new Calculator(3.1).toFixed(4), "3.1000");
  assert.equal(new Calculator(3.1, { fractionDigits: 3 }).toFixed(), "3.100");
});

test("toPrecision(p): matches the exact value rounded to p significant digits, off a half", () => {
  const random = makeRandom(52);
  function* cases() {
    for (let i = 0; i < N; i++) {
      const p = 1 + Math.floor(random() * 12);
      const str = operand(random);
      const dec = parseDecimal(str);
      // Skip exact halves at digit p; how they round depends on the stored double.
      const digits = (dec.unscaled < 0n ? -dec.unscaled : dec.unscaled).toString();
      if (digits.length > p && /^50*$/.test(digits.slice(p))) continue;
      yield { str, p };
    }
  }
  expectAll(cases(), ({ str, p }) => ({
    actual: new Calculator(Number(str)).toPrecision(p),
    expected: Number(roundSignificant(parseDecimal(str), p)),
  }));
});
// #endregion
