/**
 * The calculator's arithmetic — no `eval`, a small parser over what the keys
 * can type: numbers, + − × ÷, %, and the decimal point.
 *
 * Percent follows the shop calculator she already knows, because that is
 * what she will check it against:
 *   5000 + 18%   → 5000 + 900   = 5900   (add a percent OF what came before)
 *   5000 − 10%   → 5000 − 500   = 4500
 *   100000 × 5%  → 100000 × 0.05 = 5000 (a percent of it — a chit commission)
 *   18%          → 0.18
 */

export type Op = "+" | "−" | "×" | "÷";
export const OPS: Op[] = ["+", "−", "×", "÷"];

type Tok = { n: number; pct: boolean } | Op;

function tokens(expr: string): Tok[] | null {
  const out: Tok[] = [];
  let i = 0;
  while (i < expr.length) {
    const c = expr[i];
    if ((OPS as string[]).includes(c)) {
      // A leading minus, or one straight after an operator, belongs to the number.
      const prev = out[out.length - 1];
      if (c === "−" && (!prev || typeof prev === "string")) {
        const m = /^−(\d*\.?\d+|\d+\.)/.exec(expr.slice(i));
        if (!m) return null;
        i += m[0].length;
        const pct = expr[i] === "%";
        if (pct) i++;
        out.push({ n: -Number(m[1]), pct });
        continue;
      }
      out.push(c as Op);
      i++;
      continue;
    }
    const m = /^(\d*\.?\d+|\d+\.)/.exec(expr.slice(i));
    if (!m) return null;
    i += m[0].length;
    const pct = expr[i] === "%";
    if (pct) i++;
    out.push({ n: Number(m[1]), pct });
  }
  return out;
}

/** The value of what she has typed, or null while it is not a sum yet (or ÷ 0). */
export function evaluate(expr: string): number | null {
  const toks = tokens(expr);
  if (!toks || !toks.length) return null;
  let pos = 0;
  const num = (): { n: number; pct: boolean } | null => {
    const t = toks[pos];
    if (!t || typeof t === "string") return null;
    pos++;
    return t;
  };
  // term := number (× | ÷ number)*  — a percent inside a product is just /100.
  const term = (): { n: number; pct: boolean } | null => {
    const first = num();
    if (!first) return null;
    let acc = first;
    while (toks[pos] === "×" || toks[pos] === "÷") {
      const op = toks[pos++] as Op;
      const r = num();
      if (!r) return null;
      const rv = r.pct ? r.n / 100 : r.n;
      const lv = acc.pct ? acc.n / 100 : acc.n;
      if (op === "÷" && rv === 0) return null;
      acc = { n: op === "×" ? lv * rv : lv / rv, pct: false };
    }
    return acc;
  };
  const first = term();
  if (!first) return null;
  let total = first.pct ? first.n / 100 : first.n;
  // + and − : a percent is a percent OF the total so far.
  while (toks[pos] === "+" || toks[pos] === "−") {
    const op = toks[pos++] as Op;
    const r = term();
    if (!r) return null;
    const rv = r.pct ? (total * r.n) / 100 : r.n;
    total = op === "+" ? total + rv : total - rv;
  }
  if (pos !== toks.length) return null;
  // Money: two decimals, and no 0.1 + 0.2 tails.
  return Math.round(total * 100) / 100;
}

/** ₹1,23,456.5 → "1,23,456.50"; whole rupees stay whole. */
export function showRupees(n: number): string {
  const whole = Number.isInteger(n);
  return n.toLocaleString("en-IN", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 });
}

/** The typed sum, readable: numbers grouped Indian-style, operators spaced. */
export function showExpr(expr: string): string {
  return expr.replace(/\d+(\.\d*)?/g, (m) => {
    const [a, b] = m.split(".");
    const head = Number(a).toLocaleString("en-IN");
    return b !== undefined ? `${head}.${b}` : head;
  }).replace(/([+−×÷])/g, " $1 ").replace(/\s+/g, " ").trim();
}
