/**
 * Checks the exact-decimal reference itself against values worked out by hand,
 * since every other test trusts it.
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const E = require("./exact-decimal");

const d = E.parseDecimal;
const sig = (str, p) => E.roundSignificant(d(str), p);

test("reference: exact add, subtract and multiply", () => {
  assert.deepEqual(E.addDecimal(d("0.1"), d("0.2")), { unscaled: 3n, scale: 1 });
  assert.deepEqual(E.subtractDecimal(d("1.5"), d("2.25")), { unscaled: -75n, scale: 2 });
  assert.deepEqual(E.multiplyDecimal(d("1.2"), d("-0.05")), { unscaled: -60n, scale: 3 });
  assert.deepEqual(E.addDecimal(d("-615403.718"), d("613501.153")), { unscaled: -1902565n, scale: 3 });
});

test("reference: rounding to fraction digits, halves away from zero", () => {
  assert.equal(E.roundHalfAwayFromZero(d("1.005"), 2), "1.01");
  assert.equal(E.roundHalfAwayFromZero(d("-1.005"), 2), "-1.01");
  assert.equal(E.roundHalfAwayFromZero(d("1.0049"), 2), "1.00");
  assert.equal(E.roundHalfAwayFromZero(d("-0.004"), 2), "0.00");
  assert.equal(E.roundHalfAwayFromZero(d("2.5"), 0), "3");
  assert.equal(E.roundHalfAwayFromZero(d("7"), 2), "7.00");
});

test("reference: rounding to significant digits", () => {
  assert.equal(sig("123456", 3), "123000");
  assert.equal(sig("0.00012345", 3), "0.000123");
  assert.equal(sig("-2.5", 1), "-3");
  assert.equal(Number(sig("9.9999", 3)), 10); // carries into a new digit
  assert.equal(sig("0.3", 15), "0.3");
  assert.equal(sig("0", 15), "0");
});

test("reference: division rounded to significant digits", () => {
  const div = (a, b, p) => E.divideSignificant(d(a), d(b), p);
  assert.equal(div("1", "3", 15), "0.333333333333333");
  assert.equal(div("2", "3", 15), "0.666666666666667");
  assert.equal(div("100", "7", 15), "14.2857142857143");
  assert.equal(div("-1", "8", 2), "-0.13");
  assert.equal(div("1", "-8", 2), "-0.13");
  assert.equal(div("0.69", "10", 15), "0.0690000000000000");
  assert.equal(div("0", "5", 15), "0");
  // 1/16 = 0.0625 exactly: a true tie at 2 digits rounds away from zero.
  assert.equal(div("1", "16", 3), "0.0625");
  assert.equal(div("1", "16", 2), "0.063");
  // 1/16.0001 is just below 0.0625, so it rounds down even though the digits start 0.0624999...
  assert.equal(div("1", "16.0001", 2), "0.062");
});

test("reference: tie zone accepts both neighbours only within one double step", () => {
  // 16 digits ending in 5: an exact tie at 15 digits, so both neighbours are accepted.
  assert.deepEqual(E.significantCandidates(d("1234567890123.455"), 15), [
    "1234567890123.46",
    "1234567890123.45",
  ]);
  // Clearly below the tie: only the nearest.
  assert.deepEqual(E.significantCandidates(d("1234567890123.454"), 15), ["1234567890123.45"]);
  // Short values are exact: only themselves.
  assert.deepEqual(E.significantCandidates(d("0.3"), 15), ["0.3"]);
});
