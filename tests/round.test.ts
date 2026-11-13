/**
 * Tests for Calculator#round.
 *
 * Every expected value comes from exact decimal arithmetic on BigInt (see
 * exact-decimal.ts), never from the library itself. The rounding rule the
 * reference implements is: round to `n` fraction digits, halves away from zero
 * (0.125 -> 0.13, -0.125 -> -0.13).
 *
 * Run with `yarn test`.
 */
import { test } from "node:test";
import { strict as assert } from "node:assert";
import Calculator from "../index";
import {
  Decimal,
  parseDecimal,
  addDecimal,
  multiplyDecimal,
  roundHalfAwayFromZero,
  significantDigits,
  makeRandom,
  randomDecimal,
  expectAll,
} from "./exact-decimal";

type RoundOptions = Parameters<Calculator["round"]>[1];

/** The double the theoretical result is stored as (the nearest double to it). */
function expectedRound(dec: Decimal, n: number): number {
  return Number(roundHalfAwayFromZero(dec, n));
}

const round = (value: number, n?: number, options?: RoundOptions): number =>
  new Calculator(value).round(n, options);
const SNAP: RoundOptions = { snap: true };

test("with snap: every half cent from 0.005 to 1000.005 rounds away from zero, both signs", () => {
  function* halfCents() {
    for (let cents = 0; cents <= 100000; cents++) {
      const str = `${(cents / 100).toFixed(2)}5`;
      yield { str };
      yield { str: `-${str}` };
    }
  }
  expectAll(halfCents(), ({ str }) => ({
    actual: round(Number(str), 2, SNAP),
    expected: expectedRound(parseDecimal(str), 2),
  }));
});

test("with snap: random decimals (up to 12 significant digits) match exact rounding", () => {
  const random = makeRandom(1);
  function* cases() {
    for (let i = 0; i < 200000; i++) {
      const n = 1 + Math.floor(random() * 4); // 1..4
      const decimals = Math.floor(random() * 7); // 0..6, so some are already rounded
      const str = randomDecimal(random, 1000000, Math.min(decimals, 12 - 7));
      yield { str, n };
    }
  }
  expectAll(cases(), ({ str, n }) => ({
    actual: round(Number(str), n, SNAP),
    expected: expectedRound(parseDecimal(str), n),
  }));
});

test("with snap: float error from plain JS sums is removed (a + b rounds as the exact sum)", () => {
  // Same-sign operands, so the float error stays within a few ULPs of the sum
  // itself, which is what snap's allowance is sized for. See the todo test on
  // cancellation below for opposite signs.
  const random = makeRandom(2);
  function* cases() {
    for (let i = 0; i < 100000; i++) {
      const a = randomDecimal(random, 1000000, 3, false);
      const b = randomDecimal(random, 1000000, 3, false);
      yield { a, b };
      yield { a: `-${a}`, b: `-${b}` };
    }
  }
  expectAll(cases(), ({ a, b }) => ({
    actual: round(Number(a) + Number(b), 2, SNAP),
    expected: expectedRound(addDecimal(parseDecimal(a), parseDecimal(b)), 2),
  }));
});

test("with snap: float error from plain JS products is removed (a * b rounds as the exact product)", () => {
  const random = makeRandom(3);
  function* cases() {
    for (let i = 0; i < 100000; i++) {
      const a = randomDecimal(random, 100000, 2);
      const b = randomDecimal(random, 100, 1);
      yield { a, b };
    }
  }
  expectAll(cases(), ({ a, b }) => {
    const exact = multiplyDecimal(parseDecimal(a), parseDecimal(b));
    assert.ok(significantDigits(exact) <= 12);
    return {
      actual: round(Number(a) * Number(b), 2, SNAP),
      expected: expectedRound(exact, 2),
    };
  });
});

test("with snap: (t / m) * m in plain JS rounds as t, for half cents t", () => {
  const random = makeRandom(4);
  const divisors = [3, 7, 9, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47];
  function* cases() {
    for (let i = 0; i < 100000; i++) {
      const cents = Math.floor(random() * 1000000);
      const sign = random() < 0.5 ? "-" : "";
      const t = `${sign}${(cents / 100).toFixed(2)}5`;
      const m = divisors[Math.floor(random() * divisors.length)];
      yield { t, m };
    }
  }
  // Mathematically (t / m) * m === t; only the float evaluation is off.
  expectAll(cases(), ({ t, m }) => ({
    actual: round((Number(t) / m) * m, 2, SNAP),
    expected: expectedRound(parseDecimal(t), 2),
  }));
});

test("with snap: known values with float error from upstream arithmetic", () => {
  const cases = [
    // 3 * 0.075 in plain JS is 0.22499999999999998; the exact product is 0.225.
    { value: 3 * 0.075, exact: "0.225" },
    { value: -3 * 0.075, exact: "-0.225" },
    // A garnishment withheld amount whose exact value is 602.015.
    { value: 602.0149999999994, exact: "602.015" },
    { value: -602.0149999999994, exact: "-602.015" },
    { value: 95.01499999999942, exact: "95.015" },
  ];
  expectAll(cases, ({ value, exact }) => ({
    actual: round(value, 2, SNAP),
    expected: expectedRound(parseDecimal(exact), 2),
  }));
});

/**
 * round(n) multiplies the value, as an integer, by 10^n (1.25 -> 125 * 100), so
 * like times() it is exact only while that integer product is a safe integer;
 * enableCheckBoundary warns beyond it. Random large-magnitude cases stay inside.
 */
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
function inSafeRange(str: string, n: number): boolean {
  const { unscaled } = parseDecimal(str);
  return (unscaled < 0n ? -unscaled : unscaled) * 10n ** BigInt(n) <= MAX_SAFE;
}

test("with snap: whole numbers and cent amounts are unchanged at any magnitude", () => {
  // Already rounded to 2 digits, so the exact result is the value itself. 64
  // ULPs pass half a cent from about 3.5e11, so before the snap nudge was capped
  // 4e11 became 400000000000.01 (and 9e14 was 13 cents off, but 9e14 * 100 is
  // past the safe-integer range, so it is not asserted here; 9e13 is).
  const random = makeRandom(7);
  function* cases() {
    for (const str of ["400000000000", "90000000000000", "1000000000000"]) {
      yield { str };
      yield { str: `-${str}` };
    }
    for (let exponent = 0; exponent <= 13; exponent++) {
      for (const lead of ["1", "2", "4", "5", "9"]) {
        yield { str: lead + "0".repeat(exponent) };
        yield { str: `-${lead}${"0".repeat(exponent)}` };
      }
    }
    for (let i = 0; i < 50000; i++) {
      const digits = 9 + Math.floor(random() * 4); // 10^9 .. 10^12, across the 3.5e11 threshold
      const str = randomDecimal(random, 10 ** digits, 2);
      if (inSafeRange(str, 2)) yield { str };
    }
  }
  expectAll(cases(), ({ str }) => ({
    actual: round(Number(str), 2, SNAP),
    expected: expectedRound(parseDecimal(str), 2),
  }));
});

test("with snap: values more than a quarter unit from a half match exact rounding", () => {
  // The third decimal is 0-2 (at least 0.3 of a cent below the half) or 6-9
  // (above it), so the nudge, capped at a quarter cent, can never carry them across.
  // Exactly a quarter unit below still moves once the cap binds (from about
  // 1.76e11): 200000000000.0625 rounds to .07 with snap.
  const random = makeRandom(8);
  function* cases() {
    for (let i = 0; i < 100000; i++) {
      const digits = 1 + Math.floor(random() * 10);
      const third = "0126789"[Math.floor(random() * 7)];
      const str = randomDecimal(random, 10 ** digits, 2) + third;
      if (inSafeRange(str, 2)) yield { str };
    }
  }
  expectAll(cases(), ({ str }) => ({
    actual: round(Number(str), 2, SNAP),
    expected: expectedRound(parseDecimal(str), 2),
  }));
});

test("with snap: halves at large magnitudes still round away from zero", () => {
  const random = makeRandom(9);
  function* cases() {
    for (let i = 0; i < 100000; i++) {
      const digits = 6 + Math.floor(random() * 5); // 10^6 .. 10^10
      const str = `${randomDecimal(random, 10 ** digits, 2)}5`;
      if (inSafeRange(str, 2)) yield { str };
    }
  }
  expectAll(cases(), ({ str }) => ({
    actual: round(Number(str), 2, SNAP),
    expected: expectedRound(parseDecimal(str), 2),
  }));
});

test("without snap: values not on a half match exact rounding", () => {
  const random = makeRandom(5);
  function* cases() {
    for (let i = 0; i < 200000; i++) {
      const n = 1 + Math.floor(random() * 4); // 1..4
      const str = randomDecimal(random, 1000000, n + 1 + Math.floor(random() * 2));
      const dec = parseDecimal(str);
      // Skip exact halves: whether 1.005 is a half depends on how it is stored.
      const tail = dec.unscaled % 10n ** BigInt(dec.scale - n);
      const half = 5n * 10n ** BigInt(dec.scale - n - 1);
      if (tail === half || tail === -half) continue;
      yield { str, n };
    }
  }
  expectAll(cases(), ({ str, n }) => ({
    actual: round(Number(str), n),
    expected: expectedRound(parseDecimal(str), n),
  }));
});

test("without snap: halves stored exactly in binary round away from zero", () => {
  // k + j/8 and k + j/4 are exact doubles, so there is no ambiguity about the half.
  function* cases() {
    for (let k = 0; k <= 20000; k++) {
      for (const fraction of ["125", "375", "625", "875"]) {
        yield { str: `${k}.${fraction}`, n: 2 };
        yield { str: `-${k}.${fraction}`, n: 2 };
      }
      for (const fraction of ["25", "75"]) {
        yield { str: `${k}.${fraction}`, n: 1 };
        yield { str: `-${k}.${fraction}`, n: 1 };
      }
    }
  }
  expectAll(cases(), ({ str, n }) => ({
    actual: round(Number(str), n),
    expected: expectedRound(parseDecimal(str), n),
  }));
});

test("negative values round as the mirror of their positive value", () => {
  // Rounding half away from zero is odd-symmetric: round(-x) = -round(x).
  const random = makeRandom(6);
  function* cases() {
    for (let i = 0; i < 100000; i++) {
      const n = 1 + Math.floor(random() * 4);
      const str = randomDecimal(random, 1000000, Math.floor(random() * 7), false);
      for (const options of [undefined, SNAP]) yield { str, n, options };
    }
  }
  expectAll(cases(), ({ str, n, options }) => {
    const positive = round(Number(str), n, options);
    return { actual: round(-Number(str), n, options), expected: positive === 0 ? 0 : -positive };
  });
});

test("rounding to zero gives 0, not -0", () => {
  for (const value of [-0.004, -0.0049, -0.00001]) {
    assert.ok(Object.is(round(value, 2), 0), `round(${value}, 2)`);
    assert.ok(Object.is(round(value, 2, SNAP), 0), `round(${value}, 2, snap)`);
  }
});

test("fractionDigits defaults to the configured value, which defaults to 2", () => {
  assert.equal(new Calculator(2.3456).round(), expectedRound(parseDecimal("2.3456"), 2));
  assert.equal(
    new Calculator(2.3456, { fractionDigits: 3 }).round(),
    expectedRound(parseDecimal("2.3456"), 3)
  );
});

// Known limitations of 1.0.x, kept as todo tests so they show up in every run
// without failing it.
test(
  "without snap: a decimal half that is not exact in binary rounds as written",
  { todo: "round() scales with a float multiply (1.005 * 1000 = 1004.9999999999999); use { snap: true }" },
  () => {
    for (const str of ["1.005", "1.015", "4.015", "-1.005"]) {
      assert.equal(round(Number(str), 2), expectedRound(parseDecimal(str), 2), str);
    }
  }
);

test(
  "with snap: float error from cancellation (large a + large negative b) is removed",
  {
    todo:
      "snap's allowance scales with the result, but the error of -615403.718 + 613501.153 " +
      "scales with the operands, so it is about 25x too large; compute such values with NC instead",
  },
  () => {
    const cases = [
      { a: "-615403.718", b: "613501.153" }, // exact -1902.565
      { a: "568756.460", b: "-565399.545" }, // exact 3356.915
      { a: "-917513.753", b: "917501.658" }, // exact -12.095
    ];
    for (const { a, b } of cases) {
      assert.equal(
        round(Number(a) + Number(b), 2, SNAP),
        expectedRound(addDecimal(parseDecimal(a), parseDecimal(b)), 2),
        `${a} + ${b}`
      );
    }
  }
);

test(
  "round(0) rounds to an integer",
  { todo: "fractionDigits 0 currently falls back to the default of 2" },
  () => {
    assert.equal(round(2.5, 0), expectedRound(parseDecimal("2.5"), 0));
  }
);
