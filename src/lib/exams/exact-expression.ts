/** Bounded exact arithmetic in Q(pi, sqrt(positive rationals)). No evaluation of code,
 * floating point sampling, variables or arbitrary function calls. Unsupported input
 * has an explicit unknown result and can never receive credit by string equality. */
type Rational = { n: bigint; d: bigint };
type Polynomial = Map<string, Rational>; // key = pi exponent : square-free radicand
type Value = { n: Polynomial; d: Polynomial };
const LIMIT = 48;
const abs = (n: bigint) => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint {
  while (b) [a, b] = [b, a % b];
  return abs(a);
}
function rational(n: bigint, d = 1n): Rational {
  if (!d || abs(n).toString(2).length > 2048 || abs(d).toString(2).length > 2048) throw new Error("limit_or_zero_division");
  const g = gcd(n, d);
  return { n: n / g * (d < 0n ? -1n : 1n), d: abs(d / g) };
}
const addR = (a: Rational, b: Rational) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
const mulR = (a: Rational, b: Rational) => rational(a.n * b.n, a.d * b.d);
function poly(r: Rational, key = "0:1"): Polynomial { return new Map(r.n ? [[key, r]] : []); }
function add(a: Polynomial, b: Polynomial, sign = 1n): Polynomial {
  const out = new Map(a);
  for (const [key, v] of b) {
    const sum = addR(out.get(key) ?? rational(0n), mulR(v, rational(sign)));
    if (sum.n) out.set(key, sum); else out.delete(key);
  }
  if (out.size > LIMIT) throw new Error("complexity_limit");
  return out;
}
function mul(a: Polynomial, b: Polynomial): Polynomial {
  let out: Polynomial = new Map();
  for (const [ka, ra] of a) for (const [kb, rb] of b) {
    const [pa, da] = ka.split(":").map(Number);
    const [pb, db] = kb.split(":").map(Number);
    const common = gcd(BigInt(da), BigInt(db));
    const rad = BigInt(da) / common * (BigInt(db) / common);
    if (pa + pb > 48 || rad > 1000000000n) throw new Error("complexity_limit");
    out = add(out, poly(mulR(mulR(ra, rb), rational(common)), `${pa + pb}:${rad}`));
  }
  return out;
}
const constant = (r: Rational): Value => ({ n: poly(r), d: poly(rational(1n)) });
function combine(a: Value, b: Value, op: string): Value {
  if (op === "+" || op === "-") return { n: add(mul(a.n, b.d), mul(b.n, a.d), op === "+" ? 1n : -1n), d: mul(a.d, b.d) };
  if (op === "*") return { n: mul(a.n, b.n), d: mul(a.d, b.d) };
  if (!b.n.size) throw new Error("division_by_zero");
  return { n: mul(a.n, b.d), d: mul(a.d, b.n) };
}
function asRational(v: Value): Rational {
  if (!v.n.size) return rational(0n);
  if (v.n.size !== 1 || v.d.size !== 1 || !v.n.has("0:1") || !v.d.has("0:1")) throw new Error("unsupported_radical_or_power");
  const a = v.n.get("0:1")!, b = v.d.get("0:1")!;
  return rational(a.n * b.d, a.d * b.n);
}
function sqrt(v: Value): Value {
  const r = asRational(v);
  if (r.n < 0n || r.n * r.d > 1000000000n) throw new Error("unsupported_radical");
  let rest = r.n * r.d, outside = 1n;
  if (!rest) return constant(rational(0n));
  for (let factor = 2n; factor * factor <= rest; factor++) {
    while (rest % (factor * factor) === 0n) { rest /= factor * factor; outside *= factor; }
  }
  return { n: poly(rational(outside, r.d), `0:${rest}`), d: poly(rational(1n)) };
}

function parse(raw: string): Value {
  if (!raw.trim() || raw.length > 256) throw new Error("length_limit");
  const text = raw.trim().replace(/\\(?:left|right)/g, "").replace(/\\(?:dfrac|tfrac)/g, "\\frac")
    .replace(/\\(?:cdot|times)/g, "*").replace(/\\pi|π/g, "pi")
    .replace(/−/g, "-").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/,/g, ".")
    .replace(/√/g, "sqrt").replace(/²/g, "^2").replace(/³/g, "^3");
  const tokens = text.match(/\\frac|\\sqrt|sqrt|pi|\d+(?:\.\d+)?|[+\-*/^(){}]|\s+|./g)!.filter(t => !/^\s+$/.test(t));
  if (tokens.length > 128) throw new Error("token_limit");
  let position = 0, operations = 0;
  function take(expected?: string): string {
    const token = tokens[position++];
    if (!token || (expected && token !== expected) || ++operations > 512) throw new Error("invalid_expression");
    return token;
  }
  function group(): Value {
    const open = take();
    if (open !== "(" && open !== "{") throw new Error("group_required");
    const value = sum(); take(open === "(" ? ")" : "}"); return value;
  }
  function atom(): Value {
    const t = tokens[position];
    if (t === "(" || t === "{") return group();
    take();
    if (t === "pi") return { n: poly(rational(1n), "1:1"), d: poly(rational(1n)) };
    if (t === "\\frac") return combine(group(), group(), "/");
    if (t === "sqrt" || t === "\\sqrt") return sqrt(atom());
    if (!/^\d+(?:\.\d+)?$/.test(t) || t.length > 32) throw new Error("unsupported_token");
    const [whole, fraction = ""] = t.split(".");
    return constant(rational(BigInt(whole + fraction), 10n ** BigInt(fraction.length)));
  }
  function unary(): Value {
    if (tokens[position] === "+" || tokens[position] === "-") {
      const sign = take(); return combine(constant(rational(sign === "-" ? -1n : 1n)), unary(), "*");
    }
    let value = atom();
    if (tokens[position] === "^") {
      take(); const exponent = asRational(unary());
      if (exponent.d !== 1n || abs(exponent.n) > 12n) throw new Error("unsupported_power");
      const base = value; value = constant(rational(1n));
      for (let i = 0n; i < abs(exponent.n); i++) value = combine(value, base, "*");
      if (exponent.n < 0n) value = combine(constant(rational(1n)), value, "/");
    }
    return value;
  }
  function product(): Value {
    let value = unary();
    while (position < tokens.length) {
      const t = tokens[position];
      if (t === "*" || t === "/") { take(); value = combine(value, unary(), t); }
      else if (["(", "{", "pi", "sqrt", "\\sqrt", "\\frac"].includes(t)) value = combine(value, unary(), "*");
      else break;
    }
    return value;
  }
  function sum(): Value {
    let value = product();
    while (tokens[position] === "+" || tokens[position] === "-") { const op = take(); value = combine(value, product(), op); }
    return value;
  }
  const value = sum();
  if (position !== tokens.length || !value.d.size) throw new Error("invalid_expression");
  return value;
}

export function canParseExactExpression(raw: string): boolean {
  try { parse(raw); return true; } catch { return false; }
}

export function compareExactExpressions(a: string, b: string): "equivalent" | "different" | "unverified" {
  try {
    const left = parse(a), right = parse(b);
    return add(mul(left.n, right.d), mul(right.n, left.d), -1n).size === 0 ? "equivalent" : "different";
  } catch { return "unverified"; }
}
