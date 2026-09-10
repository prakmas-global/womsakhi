/**
 * Static audit: no colour is written literally.
 *
 * Runs in a second with no browser, so it can gate every commit. The browser
 * checks prove the tokens MEET contrast; this one proves nothing bypasses them.
 *
 * It exists because the same regression is easy to reintroduce one className at
 * a time — a `text-slate-400` here, a `#22c55e` there — and each looks harmless
 * until 2,679 text nodes are failing AA and themes only recolour the buttons.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");

// Every directory that can produce a class name. `src/lib` was missing at
// first, and an entire tone→chip map of raw Tailwind pairs sat there unseen —
// a blind spot in the check and in the codemod at the same time.
const ROOTS = [
  "src/app", "src/components", "src/design-system",
  "src/theme-engine", "src/layout-engine", "src/lib", "src/context", "src/i18n",
];

/** Third-party brand marks. Recolouring these would misrepresent someone else. */
const ALLOWED_HEX = new Set([
  "#4285f4", "#ea4335", "#fbbc05", "#34a853",            // Google
  "#f25022", "#7fba00", "#00a4ef", "#ffb900",            // Microsoft
  "#eb001b", "#f79e1b",                                   // Mastercard
]);

/**
 * Files that draw a figure rather than a surface.
 *
 * Sakhi's skin and lips are not theme colours and must not become them: a face
 * that recolours with the palette is a different person in dark mode, which is
 * the opposite of what a familiar face is for. This is the same category as the
 * brand marks above — colour that is deliberately outside the theme — so it is
 * exempted the same way, by name and with the reason written down.
 *
 * The narrowness matters. This is a list of files, not a pattern: anything that
 * paints a SURFACE stays subject to the tokens, including the surfaces inside
 * these same components.
 */
const ILLUSTRATION = new Set([
  "src/components/sakhi/SakhiFace.tsx",
  // The printable document. It opens in its own window, which has none of this
  // app's tokens in it, and it deliberately prints black on white whatever the
  // theme — a dark-mode statement wastes a cartridge and is refused at a
  // counter for being unreadable.
  "src/components/ux/kit/download.ts",
  // The crash screen. It renders when the React tree is gone, OUTSIDE the `.ux`
  // wrapper that every colour token is declared on — so `var(--ux-ink)` there
  // resolves to nothing and the apology renders invisible on invisible. Literal
  // hex is the only thing that can work on this one file.
  "src/app/global-error.tsx",
]);

/**
 * `var(--token, #fallback)` is a fallback FOR a token, not a bypass OF one.
 *
 * A component that renders outside the `.ux` scope — the sign-in showcase, for
 * instance — resolves no tokens at all, so the fallback is the only thing
 * standing between it and a transparent background. Requiring it to be a token
 * would be requiring it to be nothing.
 */
const VAR_FALLBACK = /var\(\s*--[a-z0-9-]+\s*,\s*#[0-9a-fA-F]{3,8}\s*\)/g;

const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|purple|fuchsia|pink|rose";
const PROPS = "text|bg|border|divide|ring|from|via|to|fill|stroke|placeholder|decoration|outline|accent|caret|shadow";

const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(e.name)) files.push(p);
  }
};
ROOTS.forEach((r) => fs.existsSync(r) && walk(r));
if (fs.existsSync("src/design-system/styles.css")) files.push("src/design-system/styles.css");

const findings = [];

/**
 * The backend must not send CSS class names.
 *
 * `settings_security.py` returned `note_color: "text-slate-400"` and the client
 * applied it verbatim. No frontend check could see it — a class name living in
 * Python is invisible to anything that greps TypeScript — so it quietly
 * rendered text at 2.37:1 while every other check reported zero.
 *
 * The API describes meaning; the client decides colour.
 */
const BACKEND = "../../womencrafts-backend/backend/app";
if (fs.existsSync(BACKEND)) {
  const py = [];
  (function walkPy(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name === "__pycache__") continue; walkPy(p); }
      else if (e.name.endsWith(".py")) py.push(p);
    }
  })(BACKEND);
  for (const file of py) {
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      if (line.trim().startsWith("#")) return;
      const cls = line.match(new RegExp(`["'](?:${PROPS})-(?:${PALETTE}|brand|violet|ink)-\\d{2,3}["']`, "g"));
      if (cls) findings.push({
        at: `${file.replace(/^.*backend\//, "backend/")}:${i + 1}`,
        kind: "CSS class name sent from the API",
        detail: cls.join(" "),
      });
    });
  }
}
for (const file of files) {
  // Where literals legitimately belong:
  //  · the palette definition files — that is their whole job
  //  · the theme engine itself, which GENERATES colour: its preset seeds,
  //    its black/white contrast targets and its gamut fallbacks are inputs
  //    to the maths, not colours the app paints.
  if (/tokens\.css$|globals\.css$/.test(file)) continue;
  if (file.startsWith("src/theme-engine/")) continue;
  // Strip multi-line comments before splitting: a hex documenting a bug that
  // was fixed is not a colour the app paints, and CSS comments span lines.
  const raw = fs.readFileSync(file, "utf8");
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  src.split("\n").forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    // A hex inside a comment is documentation of a bug that was fixed, not a
    // colour the app paints.
    const code = line.replace(/\/\*.*?\*\//g, "").replace(/\/\/.*$/, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    if (!code.trim()) return;

    // A raw palette class used for anything visible.
    const cls = code.match(new RegExp(`(?<![\\w-])(?:${PROPS})-(?:${PALETTE})-\\d{2,3}`, "g"));
    if (cls) {
      // `bg-white/20`-style alpha overlays on gradients are legitimate.
      const real = cls.filter((c) => !new RegExp(`${c}/\\d`).test(code));
      if (real.length) findings.push({ at, kind: "raw palette class", detail: [...new Set(real)].join(" ") });
    }

    // A literal hex that is not a third-party brand mark, an illustration
    // colour, or the fallback half of a var().
    if (!ILLUSTRATION.has(file)) {
      const scanned = code.replace(VAR_FALLBACK, "var()");
      for (const hex of scanned.match(/#[0-9a-fA-F]{6}\b/g) ?? []) {
        if (!ALLOWED_HEX.has(hex.toLowerCase())) findings.push({ at, kind: "literal hex", detail: hex });
      }
    }

    // Literal rgb()/rgba() in component code — but pure black and pure white
    // carry no hue, so they cannot clash with a theme. A translucent white
    // highlight or a black scrim is theme-agnostic by construction.
    if (/\.tsx?$/.test(file) && !ILLUSTRATION.has(file)) {
      for (const c of code.match(/\brgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g) ?? []) {
        const [r, g, b] = c.match(/\d+/g).map(Number);
        const greyscale = r === g && g === b;
        if (!greyscale) findings.push({ at, kind: "literal rgb()", detail: c });
      }
    }
  });
}

/* ──────────────────────────────────────────────────────────────────────────
   Every `var(--ux-…)` must resolve to a token that exists.

   `--ux-tint-amber` was used on three surfaces — the Sakhi disclosure, the
   star rating, and the notice that says a screen is showing example figures —
   and was never defined. CSS does not complain about that: it silently paints
   nothing, so all three rendered transparent and looked almost right. Almost
   right is how a missing token survives review.
   ────────────────────────────────────────────────────────────────────────── */
{
  const defined = new Set();
  for (const m of fs.readFileSync("src/app/ux/tokens.css", "utf8").matchAll(/(--ux-[a-z0-9-]+)\s*:/g)) {
    defined.add(m[1]);
  }
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8");
    for (const m of code.matchAll(/var\(\s*(--ux-[a-z0-9-]+)\s*[),]/g)) {
      if (!defined.has(m[1])) {
        findings.push({ at: `${file}:${code.slice(0, m.index).split("\n").length}`,
                        kind: "undefined token", detail: m[1] });
      }
    }
  }
}

const byKind = {};
findings.forEach((f) => { (byKind[f.kind] ??= []).push(f); });

console.log(`\n  scanned ${files.length} files`);

/* ──────────────────────────────────────────────────────────────────────────
   Type sizes come from the scale, for the same reason colours come from tokens.

   226 usages had written their own size as an arbitrary value, in NINETEEN
   steps: 0.68rem, 0.7rem and 0.72rem are 10.9px, 11.2px and 11.5px. Nobody
   chose three of those on purpose — each was copied from whichever file was
   nearest, and the difference is invisible on screen while being very visible
   in a diff.

   The scale extends below Tailwind's `text-xs`: 3xs / 2xs / xs / xsm / smd.
   ────────────────────────────────────────────────────────────────────────── */
const ALLOWED_SIZES = new Set([
  // The sign-in hero. A one-off display size with no second use to share a
  // scale step with; naming it would imply a system that does not exist.
  "text-[2.3rem]",
]);
const sizeOffenders = [];
for (const file of files) {
  const src = fs.readFileSync(file, "utf8");
  for (const m of src.matchAll(/text-\[[0-9.]+rem\]/g)) {
    if (ALLOWED_SIZES.has(m[0])) continue;
    sizeOffenders.push(`${file}:${src.slice(0, m.index).split("\n").length}  ${m[0]}`);
  }
}
if (sizeOffenders.length) {
  console.log(`  \x1b[31m${sizeOffenders.length} arbitrary text size(s) — use the scale\x1b[0m`);
  sizeOffenders.slice(0, 10).forEach((o) => console.log(`      ${o}`));
} else {
  console.log("  \x1b[32mevery type size comes from the scale\x1b[0m");
}


if (!findings.length) {
  console.log("  \x1b[32mno literal colours — every colour comes from a token\x1b[0m\n");
  process.exit(0);
}
console.log(`  \x1b[31m${findings.length} literal colours\x1b[0m\n`);
for (const [kind, list] of Object.entries(byKind)) {
  console.log(`   ${String(list.length).padStart(4)} ${kind}`);
  list.slice(0, 6).forEach((f) => console.log(`        ${f.at}  ${f.detail}`));
  if (list.length > 6) console.log(`        … and ${list.length - 6} more`);
}
console.log();
process.exit(1);
