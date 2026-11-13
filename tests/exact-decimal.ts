/**
 * Exact decimal arithmetic on BigInt, used as the theoretical reference in the
 * tests. Nothing here calls the library, so expected values never come from the
 * code under test.
 */
import { strict as assert } from "node:assert";

// #region Exact decimals
/** An exact decimal number: value = unscaled / 10^scale. */
export type Decimal = { unscaled: bigint; scale: number };

const abs = (n: bigint): bigint => (n < 0n ? -n : n);
const pow10 = (n: number): bigint => 10n ** BigInt(n);

export function parseDecimal(str: string): Decimal {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) throw new Error(`not a plain decimal: ${str}`);
  const fraction = match[3] || "";
  const magnitude = BigInt(match[2] + fraction);
  return { unscaled: match[1] === "-" ? -magnitude : magnitude, scale: fraction.length };
}

/** Rescale to a larger scale without changing the value. */
function rescale(dec: Decimal, scale: number): Decimal {
  return { unscaled: dec.unscaled * pow10(scale - dec.scale), scale };
}

/** Exact a + b. */
export function addDecimal(a: Decimal, b: Decimal): Decimal {
  const scale = Math.max(a.scale, b.scale);
  return { unscaled: rescale(a, scale).unscaled + rescale(b, scale).unscaled, scale };
}

/** Exact a - b. */
export function subtractDecimal(a: Decimal, b: Decimal): Decimal {
  return addDecimal(a, { unscaled: -b.unscaled, scale: b.scale });
}

/** Exact a * b. */
export function multiplyDecimal(a: Decimal, b: Decimal): Decimal {
  return { unscaled: a.unscaled * b.unscaled, scale: a.scale + b.scale };
}

/** Decimal string for unscaled / 10^scale; scale may be negative. */
function formatDecimal(unscaled: bigint, scale: number): string {
  const negative = unscaled < 0n;
  let digits = abs(unscaled).toString();
  if (scale <= 0) {
    digits += "0".repeat(-scale);
  } else {
    digits = digits.padStart(scale + 1, "0");
    digits = `${digits.slice(0, -scale)}.${digits.slice(-scale)}`;
  }
  return (negative && unscaled !== 0n ? "-" : "") + digits;
}

/** Drop `drop` trailing digits of a non-negative integer, rounding half away from zero. */
function dropDigitsHalfAway(magnitude: bigint, drop: number): bigint {
  if (drop <= 0) return magnitude * pow10(-drop);
  const divisor = pow10(drop);
  const quotient = magnitude / divisor;
  return (magnitude % divisor) * 2n >= divisor ? quotient + 1n : quotient;
}

/** Round to n fraction digits, halves away from zero. Returns a decimal string. */
export function roundHalfAwayFromZero(dec: Decimal, n: number): string {
  const sign = dec.unscaled < 0n ? -1n : 1n;
  const magnitude = dropDigitsHalfAway(abs(dec.unscaled), dec.scale - n);
  return formatDecimal(sign * magnitude, n);
}

/** Round to p significant digits, halves away from zero. Returns a decimal string. */
export function roundSignificant(dec: Decimal, p: number): string {
  const magnitude = abs(dec.unscaled);
  if (magnitude === 0n) return "0";
  const drop = magnitude.toString().length - p;
  if (drop <= 0) return formatDecimal(dec.unscaled, dec.scale);
  const sign = dec.unscaled < 0n ? -1n : 1n;
  return formatDecimal(sign * dropDigitsHalfAway(magnitude, drop), dec.scale - drop);
}

/**
 * The values a double-based result may take when it claims p significant
 * digits: the exact value rounded to p digits and, only when the exact value
 * sits within one double step (2^-52 relative) of a p-digit tie, the other
 * neighbour too. A double cannot tell which side of such a tie the exact value
 * is on, so either answer is as good as the format allows.
 * @returns acceptable decimal strings, the nearest first
 */
export function significantCandidates(dec: Decimal, p: number): string[] {
  const magnitude = abs(dec.unscaled);
  const drop = magnitude.toString().length - p;
  const nearest = roundSignificant(dec, p);
  if (magnitude === 0n || drop <= 0) return [nearest];
  const unit = pow10(drop);
  const remainder = magnitude % unit;
  const distanceToTie = abs(remainder * 2n - unit); // in half-units
  if (distanceToTie * 2n ** 52n > magnitude * 2n) return [nearest];
  const sign = dec.unscaled < 0n ? -1n : 1n;
  const down = formatDecimal(sign * (magnitude / unit), dec.scale - drop);
  const up = formatDecimal(sign * (magnitude / unit + 1n), dec.scale - drop);
  return [nearest, nearest === up ? down : up];
}

/**
 * Exact a / b to p + 3 extra digits plus a sticky digit. The sticky digit is 1
 * when the division leaves a remainder, so a truncated ...5000 that is really
 * above a half still rounds up; rounding the result to p digits is then exact.
 */
export function divideDecimal(a: Decimal, b: Decimal, p: number): Decimal {
  if (b.unscaled === 0n) throw new Error("division by zero");
  const numerator = abs(a.unscaled) * pow10(b.scale);
  const denominator = abs(b.unscaled) * pow10(a.scale);
  const extra =
    p + 3 + Math.max(0, denominator.toString().length - numerator.toString().length);
  const scaled = numerator * pow10(extra);
  const quotient = (scaled / denominator) * 10n + (scaled % denominator !== 0n ? 1n : 0n);
  const negative = a.unscaled < 0n !== b.unscaled < 0n && a.unscaled !== 0n;
  return { unscaled: negative ? -quotient : quotient, scale: extra + 1 };
}

/** a / b rounded to p significant digits, halves away from zero. */
export function divideSignificant(a: Decimal, b: Decimal, p: number): string {
  return roundSignificant(divideDecimal(a, b, p), p);
}

/** Number of significant digits of a decimal (trailing zeros not counted). */
export function significantDigits(dec: Decimal): number {
  const magnitude = abs(dec.unscaled);
  if (magnitude === 0n) return 1;
  return magnitude.toString().replace(/0+$/, "").length || 1;
}
// #endregion

// #region Test helpers
/** Seeded PRNG (mulberry32), so every run checks the same values. */
export function makeRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random decimal string: below `maxInt` before the point, exactly `decimals` after it. */
export function randomDecimal(
  random: () => number,
  maxInt: number,
  decimals: number,
  allowNegative = true
): string {
  const intPart = Math.floor(random() * maxInt);
  let fraction = "";
  for (let i = 0; i < decimals; i++) fraction += Math.floor(random() * 10);
  const sign = allowNegative && random() < 0.5 ? "-" : "";
  return `${sign}${intPart}${decimals ? `.${fraction}` : ""}`;
}

/** What a check returns: one expected value, or several acceptable ones (nearest first). */
export type Check = { actual: unknown; expected: unknown };

/**
 * Run `check` on every case and fail once with the first few mismatches, so a
 * failure shows concrete inputs instead of only a count.
 */
export function expectAll<C extends object>(cases: Iterable<C>, check: (c: C) => Check): void {
  const failures: object[] = [];
  let total = 0;
  for (const c of cases) {
    total++;
    const { actual, expected } = check(c);
    const accepted: unknown[] = Array.isArray(expected) ? expected : [expected];
    if (!accepted.some((e) => Object.is(actual, e))) {
      failures.push({ ...c, actual, expected: accepted.length === 1 ? accepted[0] : accepted });
    }
  }
  assert.ok(total > 0, "no cases were generated");
  assert.deepEqual(
    failures.slice(0, 10),
    [],
    `${failures.length} of ${total} cases differ from the exact result`
  );
}
// #endregion
