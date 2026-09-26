/**
 * Every icon named in the app is one the app actually re-exports.
 *
 * `components/ux/icons.ts` is a curated list, and `I` / `IconTile` fall back to
 * a plain `Circle` when a name is not in it. That fallback is silent: no
 * console warning, no type error, no crash — just a grey ring where a wallet
 * or a lock should be, on a screen nobody looked at that week. Five of them
 * were found by eye in one session and a sixth (`Link2`) the next.
 *
 * Names are read from the four shapes the codebase uses:
 *   <I name="Wallet" />        icon="Wallet"        icon: "Wallet"        Icons.Wallet
 * Only PascalCase values are considered, which is what keeps `<input
 * name="email">` and `icon: someVariable` out of it.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const SRC = "src";
const REGISTER = "src/components/ux/icons.ts";

const registered = new Set(
  readFileSync(REGISTER, "utf8")
    .split("\n")
    .map((l) => l.match(/^\s{2}([A-Z][A-Za-z0-9]*),\s*$/)?.[1])
    .filter(Boolean));

if (registered.size < 50) {
  console.log(` FAIL  only ${registered.size} icons parsed out of ${REGISTER} — the parser is wrong, not the app`);
  process.exit(1);
}

const files = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { if (e !== "node_modules") walk(p); }
    else if (/\.(tsx|ts)$/.test(e) && p !== REGISTER) files.push(p);
  }
})(SRC);

const PATTERNS = [
  /\bname="([A-Z][A-Za-z0-9]*)"/g,   // <I name="Wallet" />
  /\bicon="([A-Z][A-Za-z0-9]*)"/g,   // icon="Wallet"
  /\bicon:\s*"([A-Z][A-Za-z0-9]*)"/g, // icon: "Wallet"
  /\bIcons\.([A-Z][A-Za-z0-9]*)\b/g,  // Icons.Wallet
];

const missing = new Map();
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const lines = src.split("\n");
  for (const re of PATTERNS) {
    for (const m of src.matchAll(re)) {
      const nm = m[1];
      if (registered.has(nm)) continue;
      const line = src.slice(0, m.index).split("\n").length;
      // `name="Something"` also appears on real form fields and on props that
      // are not icons at all, so only flag it where the file imports the set.
      if (re.source.startsWith("\\bname=") && !/<I\s+[^>]*\bname=/.test(lines[line - 1])) continue;
      if (!missing.has(nm)) missing.set(nm, []);
      missing.get(nm).push(`${f}:${line}`);
    }
  }
}

console.log(`  ${files.length} files scanned · ${registered.size} icons registered`);
if (missing.size === 0) {
  console.log("\n PASS  every icon named in the app is registered");
  process.exit(0);
}
for (const [nm, where] of [...missing].sort()) {
  console.log(`  ✗  ${nm.padEnd(22)} would render a blank circle`);
  for (const w of where.slice(0, 3)) console.log(`       ${w}`);
  if (where.length > 3) console.log(`       … and ${where.length - 3} more`);
}
console.log(`\n FAIL  ${missing.size} unregistered icon${missing.size === 1 ? "" : "s"}`);
process.exit(1);
