/**
 * Accessible names, checked in the source rather than the browser.
 *
 * ── Why a static check when screens.mjs already measures this ────────────────
 * screens.mjs is the ground truth: it knows what actually rendered, in the
 * theme and viewport a person would see. But it drives 228 page loads through
 * six browsers and takes about ten minutes, which is too slow to run while
 * fixing things — and a check you avoid running is a check that stops working.
 *
 * This reads the same rule off the source in about a second. It cannot see
 * everything the browser sees, so it is deliberately CONSERVATIVE: it only
 * reports a control it is certain about, and stays quiet where it cannot tell.
 * A clean run here does not prove the app is fine; a dirty run always means
 * something is. screens.mjs remains the authority.
 *
 * ── What counts as certain ──────────────────────────────────────────────────
 * A <button> or <a href> whose children are ONLY icon elements (<Foo />) and
 * whitespace, with no aria-label, aria-labelledby or title. There is no reading
 * of that markup where a screen reader has anything to announce — it says
 * "button" and stops. Anything containing a {expression} is skipped, because
 * the expression may well be the label.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", OFF = "\x1b[0m";
const ROOT = "src";

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".tsx")) files.push(p);
  }
})(ROOT);

/**
 * Find the matching close tag, counting nesting. Regex alone cannot do this —
 * a <button> containing a <span> would end at the span's close and the check
 * would read the wrong children.
 */
function inner(src, tag, openEnd) {
  const open = new RegExp(`<${tag}[\\s>]`, "g");
  const close = new RegExp(`</${tag}>`, "g");
  let depth = 1, i = openEnd;
  while (i < src.length) {
    open.lastIndex = i; close.lastIndex = i;
    const o = open.exec(src), c = close.exec(src);
    if (!c) return null;
    if (o && o.index < c.index) { depth++; i = o.index + 1; continue; }
    depth--;
    if (depth === 0) return src.slice(openEnd, c.index);
    i = c.index + 1;
  }
  return null;
}

/** Walk the opening tag to its closing '>', respecting {…} and "…" so a `>` inside them doesn't end it early. */
function openTagEnd(src, start) {
  let i = start, brace = 0, quote = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) { if (ch === quote) quote = null; }
    else if (ch === '"' || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") brace++;
    else if (ch === "}") brace--;
    else if (ch === ">" && brace === 0) return i + 1;
    i++;
  }
  return -1;
}

const problems = [];
const lineOf = (src, idx) => src.slice(0, idx).split("\n").length;

/**
 * Blank out comments, keeping every character position so reported line numbers
 * still point at the right place.
 *
 * Without this the check read prose as markup: the sentence "Deliberately NOT a
 * native <select>" inside a doc comment was reported as an unlabelled select,
 * and every `<button>` written in a comment became a nameless control. Three of
 * its first findings were sentences about code rather than code.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p + " ".repeat(m.length - p.length));
}

for (const file of files) {
  const src = stripComments(fs.readFileSync(file, "utf8"));

  /**
   * Which child elements are icons?
   *
   * Stripping every self-closing <Capitalized /> was wrong: it treated
   * `<StatCard label="Upcoming" />` as decoration, so a button wrapping a stat
   * tile was reported as having nothing to announce when it announces plenty.
   * Only the names actually imported from lucide-react are icons; any other
   * component might render text, so the check leaves it alone.
   */
  const icons = new Set();
  for (const im of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*"lucide-react"/g)) {
    for (const name of im[1].split(",")) {
      const clean = name.split(" as ").pop().trim();
      if (clean) icons.add(clean);
    }
  }
  /**
   * Has this element anything a screen reader could read out?
   *
   * The first version only stripped lucide icons, so a button whose child was a
   * plain <span> counted as "might have text" and was skipped. That let 138
   * real cases through — the toggle switches, whose markup is two nested empty
   * spans styled into a track and a knob, carrying no text at all. The browser
   * sweep caught them; this did not.
   *
   * So: remove the markup and keep what was between it. If nothing is left, the
   * control has no name. A `{expression}` is left alone and counts as content,
   * because it may well BE the label — the check stays quiet where it cannot
   * tell, and reports only what it can prove.
   */
  const iconOnly = (kids) => {
    let rest = kids.replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    // Non-icon components may render text of their own; leave those be.
    if (/<([A-Z][\w.]*)/.test(rest.replace(/<([A-Z][\w.]*)[^>]*\/>/g, (w, n) => (icons.has(n) ? "" : w)))) {
      return false;
    }
    let before;
    do {
      before = rest;
      rest = rest.replace(/<[^<>]*>/g, "");
    } while (rest !== before);
    return rest.trim() === "";
  };

  // ── Controls with no accessible name ──────────────────────────────────────
  for (const tag of ["button", "a"]) {
    const re = new RegExp(`<${tag}[\\s>]`, "g");
    let m;
    while ((m = re.exec(src))) {
      const end = openTagEnd(src, m.index);
      if (end < 0) continue;
      const attrs = src.slice(m.index, end);
      if (attrs.endsWith("/>")) continue;               // self-closing, no children
      if (tag === "a" && !/\bhref[=\s]/.test(attrs)) continue;   // not a link
      if (/aria-label|aria-labelledby|\btitle=/.test(attrs)) continue;
      const kids = inner(src, tag, end);
      if (kids === null) continue;

      if (iconOnly(kids)) {
        problems.push({ file, line: lineOf(src, m.index), kind: "unnamed", snippet: attrs.replace(/\s+/g, " ").slice(0, 90) });
      }
    }
  }

  // ── Inputs with nothing to announce ───────────────────────────────────────
  for (const tag of ["input", "select", "textarea"]) {
    const re = new RegExp(`<${tag}[\\s>]`, "g");
    let m;
    while ((m = re.exec(src))) {
      const end = openTagEnd(src, m.index);
      if (end < 0) continue;
      const attrs = src.slice(m.index, end);
      if (/type="hidden"/.test(attrs)) continue;
      if (/aria-label|aria-labelledby|placeholder|\bid=/.test(attrs)) continue;
      /**
       * An input nested inside <label>…</label> is labelled by it, with no id
       * or htmlFor needed. Missing that, the check reported the sign-in page's
       * "Remember me" tickbox — which is wrapped in exactly that — as having
       * nothing to announce.
       */
      const before = src.slice(0, m.index);
      const opens = (before.match(/<label[\s>]/g) || []).length;
      const closes = (before.match(/<\/label>/g) || []).length;
      if (opens > closes) continue;
      problems.push({ file, line: lineOf(src, m.index), kind: "unlabelled", snippet: attrs.replace(/\s+/g, " ").slice(0, 90) });
    }
  }

  // ── Images with nothing in place of the picture ───────────────────────────
  //
  // `alt` is not optional-with-a-default: omitting it makes a screen reader
  // read the FILE NAME, so a decorative flourish becomes "a-v-a-t-a-r dash 3
  // dot p-n-g". `alt=""` is the correct way to say "this carries no meaning,
  // skip it" — which is a decision, and has to be written down as one.
  for (const tag of ["img", "Image"]) {
    const re = new RegExp(`<${tag}[\\s>]`, "g");
    let m;
    while ((m = re.exec(src))) {
      const end = openTagEnd(src, m.index);
      if (end < 0) continue;
      const attrs = src.slice(m.index, end);
      if (/\balt[=\s]|\{\.\.\./.test(attrs)) continue;   // spread may carry alt
      problems.push({ file, line: lineOf(src, m.index), kind: "no-alt", snippet: attrs.replace(/\s+/g, " ").slice(0, 90) });
    }
  }

  // ── Table headers that do not say what they head ──────────────────────────
  //
  // `scope` tells a screen reader whether a <th> labels a column or a row.
  // Without it, reading a cell announces the value with no indication of which
  // column it came from — so a table of 8 columns × 15 rows becomes 120 numbers
  // in a row. Sighted users get this for free from the layout.
  {
    const re = /<th[\s>]/g;
    let m;
    while ((m = re.exec(src))) {
      const end = openTagEnd(src, m.index);
      if (end < 0) continue;
      const attrs = src.slice(m.index, end);
      if (/\bscope=/.test(attrs)) continue;
      problems.push({ file, line: lineOf(src, m.index), kind: "no-scope", snippet: attrs.replace(/\s+/g, " ").slice(0, 90) });
    }
  }
}

const KINDS = [
  ["unnamed",    "icon-only buttons and links with no aria-label"],
  ["unlabelled", "inputs with no label, aria-label or placeholder"],
  ["no-alt",     "images with no alt (use alt=\"\" if decorative)"],
  ["no-scope",   "table headers with no scope=\"col\" or \"row\""],
];

console.log(`\n  ${files.length} components scanned`);
if (!problems.length) {
  console.log(`  ${GREEN}every control, image and table header can be read out${OFF}\n`);
} else {
  console.log(`  ${RED}${problems.length} things a screen reader cannot make sense of${OFF}`);
  for (const [kind, label] of KINDS) {
    const n = problems.filter((p) => p.kind === kind).length;
    if (n) console.log(`    ${n} ${label}`);
  }
  console.log();
  const byFile = new Map();
  for (const p of problems) byFile.set(p.file, [...(byFile.get(p.file) || []), p]);
  for (const [file, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${file}  ${DIM}(${list.length})${OFF}`);
    for (const p of list.slice(0, 4)) console.log(`      ${p.line}: ${DIM}${p.snippet}${OFF}`);
    if (list.length > 4) console.log(`      ${DIM}…and ${list.length - 4} more${OFF}`);
  }
  console.log();
  process.exitCode = 1;
}
