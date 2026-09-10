/**
 * One way to tell the user what happened.
 *
 * Before this, 66 files each kept their own `saved` boolean and their own
 * `setTimeout(() => setSaved(false), 2500)`. Every one picked its own duration
 * and wording, and — the part that actually hurt — its own answer to "is a
 * failure worth mentioning?". Several answered no.
 *
 * This check keeps the app from drifting back. It is static, so it runs in the
 * fast lane.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", OFF = "\x1b[0m";

const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith(".tsx") || e.name.endsWith(".ts")) files.push(p);
  }
})("src");

/**
 * Blank comments and string literals, keeping positions, so prose about code is
 * not read as code.
 *
 * ── Why this is a scanner and not four `.replace()` calls ───────────────────
 * It used to be four passes: strings, then templates, then block comments,
 * then line comments. Each pass is correct on its own and wrong in company,
 * because every one of them can see a delimiter that belongs to another.
 *
 * The first version blanked from `/*` to the next `*\/` with no idea what was
 * a string, so `accept="image/*"` — an ordinary file input — opened a comment
 * that swallowed fourteen lines of real JSX. Blanking strings first fixed
 * that and broke something subtler. On this line, which is ordinary CSV
 * escaping:
 *
 *     .map((c) => `"${String(c ?? "").replace(/"/g, \'""\')}"`)
 *
 * the string pass blanks `"${String(c ?? "` — a perfectly good quoted string,
 * as far as a regex can tell — and leaves the backticks it was nested inside.
 * The template pass then pairs THAT line\'s surviving backtick with one 130
 * lines further down and blanks everything between. `settings/activity` was
 * reported as recording an error and showing it to nobody; the JSX that shows
 * it, `error={error}`, had been erased by the check, not by the author.
 *
 * A single left-to-right pass cannot make that mistake: whatever opens first
 * wins, exactly as the JavaScript parser sees it. Regex literals are tracked
 * too, because `/"/g` is otherwise an unterminated string.
 *
 * Positions and line breaks are preserved throughout, because every finding
 * reports a line number and an offset that has drifted is worse than no
 * offset.
 */
const strip = (src) => {
  const out = src.split("");
  const wipe = (i) => { if (out[i] !== "\n") out[i] = " "; };

  // The last meaningful character, which is what decides whether a `/` opens a
  // regex literal or divides two numbers.
  let prev = "";
  let i = 0;
  const n = src.length;

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];

    // ── comments ──────────────────────────────────────────────────────────
    if (c === "/" && d === "/") {
      while (i < n && src[i] !== "\n") wipe(i++);
      continue;
    }
    if (c === "/" && d === "*") {
      wipe(i++); wipe(i++);
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) wipe(i++);
      if (i < n) { wipe(i++); wipe(i++); }
      continue;
    }

    // ── regex literal ─────────────────────────────────────────────────────
    // Only where a value is expected. After an identifier, a number or a
    // closing bracket a `/` is division, and consuming to the next `/` would
    // eat real code.
    if (c === "/" && (prev === "" || "(,=:[!&|?{};+-*%~^<>".includes(prev))) {
      let j = i + 1, inClass = false, ok = false;
      while (j < n && src[j] !== "\n") {
        const k = src[j];
        if (k === "\\") { j += 2; continue; }
        if (k === "[") inClass = true;
        else if (k === "]") inClass = false;
        else if (k === "/" && !inClass) { ok = true; break; }
        j++;
      }
      if (ok) {
        while (i <= j) wipe(i++);
        while (i < n && /[a-z]/.test(src[i])) wipe(i++);   // flags
        prev = "/";
        continue;
      }
    }

    // ── quotes ────────────────────────────────────────────────────────────
    if (c === "'" || c === '"' || c === "`") {
      const quote = c;
      wipe(i++);
      while (i < n) {
        if (src[i] === "\\") { wipe(i); wipe(i + 1); i += 2; continue; }
        if (src[i] === quote) { wipe(i++); break; }
        // A single- or double-quoted string cannot cross a line. If one
        // appears to, it was an apostrophe in prose — stop rather than run on.
        if (quote !== "`" && src[i] === "\n") break;
        wipe(i++);
      }
      prev = quote;
      continue;
    }

    if (!/\s/.test(c)) prev = c;
    i++;
  }

  return out.join("");
};

const problems = [];
const lineOf = (src, i) => src.slice(0, i).split("\n").length;

for (const file of files) {
  // Two views of the same file, at identical character positions.
  //
  // `src` has comments blanked, so prose about code is never read as code.
  // `original` keeps them, because one rule below needs to READ a comment —
  // the reason someone gave for staying silent. Looking for that reason in the
  // stripped copy found nothing, every time, and reported five documented
  // decisions as unexplained.
  const original = fs.readFileSync(file, "utf8");
  const src = strip(original);

  // ── The browser's own dialogs ─────────────────────────────────────────────
  // They block the main thread, cannot be themed, and appear in the BROWSER's
  // language rather than the one the reader chose — which matters here, where
  // a member may be reading in Hindi, Marathi, Tamil or Bengali.
  for (const m of src.matchAll(/\bwindow\.(alert|confirm|prompt)\s*\(/g)) {
    problems.push({
      file, line: lineOf(src, m.index),
      what: `window.${m[1]}() — use useToast() or useConfirm()`,
    });
  }

  // ── A confirmation flag cleared by a timer ────────────────────────────────
  // This is the shape the toast replaced. Left alone it multiplies: each new
  // screen copies the nearest existing one.
  for (const m of src.matchAll(/setTimeout\(\s*\(\)\s*=>\s*set(\w*(?:Saved|Copied|Confirm|Done|Flash)\w*)\(/gi)) {
    /**
     * An in-place flag is not automatically wrong. A copy button whose icon
     * turns into a tick puts the feedback exactly where the action was, which
     * beats a message in the far corner of the screen.
     *
     * What made those wrong was being SILENT: the icon swap announces nothing,
     * so a screen-reader user pressing Copy got no confirmation at all. They
     * now fire a toast as well, and keep the tick.
     *
     * So the rule is not "no timers" — it is "nothing happens unannounced".
     */
    const near = src.slice(Math.max(0, m.index - 400), m.index + 400);
    if (/toast\.\w+\(/.test(near)) continue;
    // A live region announces it just as well as a toast, and keeps the
    // feedback where the action was — which for a copy button is better. The
    // rule is "nothing happens unannounced", not "always use a toast", so a
    // `role="status"` or `aria-live` anywhere in the file satisfies it.
    // Tested against `original`, not `src`: `strip` blanks string literals now,
    // so `role="status"` is spaces by the time the rules run. A rule that looks
    // for an attribute VALUE has to read the file as written.
    if (/role=["']status["']|aria-live=/.test(original)) continue;
    problems.push({
      file, line: lineOf(src, m.index),
      what: `hand-rolled "${m[1]}" confirmation on a timer, announced nowhere — use toast.success() or a role="status"`,
    });
  }

  // ── A failure recorded, and shown to nobody ───────────────────────────────
  //
  // The worst shape in this whole section: `catch (err) { setError(...) }` where
  // no JSX ever reads `error`. The code looks like it handles the failure — a
  // reviewer scanning it sees a catch block doing something sensible — and the
  // user sees nothing at all. Five of these were live, including a backup
  // download and a backup delete that silently did nothing.
  //
  // It is the same fault as `permSaved`, which was set on every successful save
  // and rendered nowhere.
  for (const m of src.matchAll(/const \[(\w*(?:rror|Error|essage|Note|Msg)\w*), (set\w+)\] = useState/g)) {
    const [, name, setter] = m;
    const calls = [...src.matchAll(new RegExp(`${setter}\\(([^)]*)\\)`, "g"))]
      .map((c) => c[1].trim())
      .filter((a) => a !== '""' && a !== "''" && a !== "null" && a !== "");
    if (!calls.length) continue;
    // Rendered in any of the shapes this codebase actually uses.
    //
    // This used to look for `{name`, `name &&` or `name ?` only — so the very
    // common `{(photoError || removePhoto.error) && (` read as "rendered
    // nowhere", because the name sits behind a paren and is joined with `||`.
    // A check that reports a working screen as broken gets ignored, and then
    // it stops catching the real ones.
    const shown =
      new RegExp(`\\{\\s*\\(?\\s*${name}\\b`).test(src) ||
      new RegExp(`\\b${name}\\s*(&&|\\|\\||\\?)`).test(src) ||
      new RegExp(`\\|\\|\\s*${name}\\b`).test(src) ||
      new RegExp(`\\{${name}\\}`).test(src);
    if (!shown) {
      problems.push({
        file, line: lineOf(src, m.index),
        what: `"${name}" is set ${calls.length}× and rendered nowhere — the failure is recorded and shown to nobody`,
      });
    }
  }

  // ── A button press that fails, and says nothing ───────────────────────────
  //
  // An empty catch in a LOAD path is covered: ConnectionBanner reports it at
  // the root. An empty catch in an ACTION path is covered by nothing — the
  // click simply does nothing, and a failure is indistinguishable from a dead
  // button. 61 of these were live, including "Cancel subscription".
  //
  // Silence IS sometimes right. It just has to be argued, in the allowlist
  // below, where the next person can check the reasoning rather than guess at
  // it. "keep the modal open" was rejected as a reason: it describes control
  // flow, not why the user should be left uninformed.
  //
  // Rather than a hardcoded list of blessed functions, the rule is the
  // principle itself: a silent catch is allowed when somebody has WRITTEN DOWN
  // why. That keeps the check honest as the app grows — a new silent catch
  // either carries a reason a reader can judge, or it fails.
  //
  // "ignore", "noop", and "could surface a toast" do not count as reasons.
  // Neither did "keep the modal open", which describes control flow rather
  // than why the user should be left uninformed.
  //
  // Browser storage is exempt structurally: localStorage throws in private
  // mode and when the quota is full, the app already falls back, and there is
  // nothing useful to tell anyone about it.
  const NOT_A_REASON = /^(ignore|noop|no-?op|silent|skip|todo)\b|could surface a toast/i;

  for (const raw of src.matchAll(/\}\s*catch\s*(?:\([^)]*\))?\s*\{([^{}]*)\}/g)) {
    const inner = raw[1];
    const body = inner.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "").trim();
    if (body) continue;                       // it does something

    const before = src.slice(0, raw.index);
    let fn = null;
    for (const f of before.matchAll(/(?:async function (\w+)|const (\w+) = async|const (\w+) = useCallback)/g)) {
      fn = f[1] || f[2] || f[3];
    }
    if (fn && /load|fetch|refresh|^get/i.test(fn)) continue;   // ConnectionBanner has these

    const context = src.slice(Math.max(0, raw.index - 400), raw.index);
    if (/localStorage|sessionStorage|router\.prefetch/.test(context)) continue;

    // The reason, if one was given — read from the ORIGINAL, where comments
    // still exist.
    const rawInner = original.slice(raw.index, raw.index + raw[0].length);
    const note = (rawInner.match(/\/\*([\s\S]*?)\*\/|\/\/([^\n]*)/) || [])
      .slice(1).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const reasoned = note.split(/\s+/).filter(Boolean).length >= 4 && !NOT_A_REASON.test(note);
    if (reasoned) continue;

    problems.push({
      file, line: lineOf(src, raw.index),
      what: `${fn ? `${fn}()` : "an action"} fails silently with no reason given — report it, or write down why not`,
    });
  }

  // ── A delete with nothing between the click and the loss ──────────────────
  // Every destructive call must sit behind either a confirm() or an explicit
  // modal. A row menu is one mis-click away from permanent.
  if (/\/app\/dashboard\//.test(file.replace(/\\/g, "/")) || /\/app\/app\//.test(file.replace(/\\/g, "/"))) {
    const deletes = [...src.matchAll(/const (\w*[Dd]elete\w*) = async|async function (\w*[Dd]elete\w*)\(/g)];
    for (const m of deletes) {
      const name = m[1] || m[2];
      if (/^deleteBackup|Selected$/.test(name)) continue;
      const body = src.slice(m.index, m.index + 900);
      const guarded = /await confirm\(|confirmOpen|setDelete|Modal/.test(body);
      if (!guarded) {
        problems.push({ file, line: lineOf(src, m.index), what: `${name}() destroys data with no confirmation` });
      }
    }
  }
}

console.log(`\n  ${files.length} files scanned for feedback consistency`);
if (!problems.length) {
  console.log(`  ${GREEN}one way to say what happened — no browser dialogs, no timer flags${OFF}\n`);
} else {
  console.log(`  ${RED}${problems.length} problems${OFF}\n`);
  for (const p of problems.slice(0, 25)) {
    console.log(`   ${p.file}:${p.line}`);
    console.log(`      ${DIM}${p.what}${OFF}`);
  }
  if (problems.length > 25) console.log(`   ${DIM}…and ${problems.length - 25} more${OFF}`);
  console.log();
  process.exitCode = 1;
}
