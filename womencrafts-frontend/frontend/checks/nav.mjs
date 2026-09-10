/**
 * The navigation tree is the map, and the map must match the territory.
 *
 * Three invariants, each of which was broken before the rewrite:
 *
 *   1. ONE NAME PER THING — no two nodes share an href. The old model had
 *      every one of its seven sections repeating its own destination as the
 *      first item of its own list, and ten hrefs appearing in two different
 *      navigation surfaces at once.
 *
 *   2. NOTHING ORPHANED — every route on disk resolves to a node. Twenty-six
 *      routes belonged to no section, so nothing highlighted, no Back could
 *      name their parent, and on a phone there was no way to reach them.
 *
 *   3. NOTHING IMAGINARY — every node's href is a route on disk. The old
 *      model pointed at `/app/checkout`, which has never existed.
 */
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const SRC = "src/app/app";

/* ── What is on disk ──────────────────────────────────────────────────────── */

const routes = [];
(function walk(dir, href) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, `${href}/${e}`);
    else if (e === "page.tsx") routes.push(href || "/app");
  }
})(SRC, "/app");
routes.sort();

/* ── What the tree says ───────────────────────────────────────────────────── */

// Read the tree as text rather than importing it: this check must run without
// a bundler, and the file is plain data below its types.
const src = readFileSync("src/components/ux/nav-tree.ts", "utf8");
// Split on node boundaries and read each object whole, so a flag that sits
// after `note:` is still seen. Matching field-by-field missed exactly that.
const nodes = src.split(/\{\s*(?=(?:tab:\s*(?:true|false),\s*)?id:\s*")/)
  .map((chunk) => {
    const id = chunk.match(/^\s*(?:tab:\s*(?:true|false),\s*)?id:\s*"([^"]+)"/);
    const href = chunk.match(/\bhref:\s*"([^"]+)"/);
    const label = chunk.match(/\blabel:\s*"((?:[^"\\]|\\.)*)"/);
    if (!id || !href) return null;
    return { id: id[1], label: label ? label[1] : id[1], href: href[1],
             unlisted: /\bunlisted:\s*true/.test(chunk.split(/\bchildren:/)[0]) };
  })
  .filter(Boolean);

if (nodes.length < 80) {
  console.log(` FAIL  only ${nodes.length} nodes parsed out of the tree — the parser is wrong, not the tree`);
  process.exit(1);
}

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) bad++; };

/* 1 ── one name per thing */
const byHref = new Map();
for (const n of nodes) {
  if (!byHref.has(n.href)) byHref.set(n.href, []);
  byHref.get(n.href).push(n.id);
}
const dupes = [...byHref].filter(([, ids]) => ids.length > 1);
say(dupes.length === 0, `every destination is named once (${nodes.length} nodes, ${byHref.size} hrefs)`);
for (const [href, ids] of dupes) console.log(`         ${href} — ${ids.join(", ")}`);

/* 2 ── nothing orphaned */
const owns = (href, path) => href === path || (href !== "/app" && path.startsWith(href + "/"));
const orphans = routes.filter((r) => !nodes.some((n) => owns(n.href, r)));
say(orphans.length === 0, `every route on disk has a parent (${routes.length} routes)`);
for (const r of orphans) console.log(`         ${r}`);

/* 3 ── nothing imaginary */
const onDisk = (href) => routes.some((r) => {
  const a = r.split("/"), b = href.split("/");
  return a.length === b.length && a.every((seg, i) => seg === b[i] || seg.startsWith("["));
});
// An unlisted node owns a subtree and has no page of its own — by design.
const imaginary = nodes.filter((n) => !n.unlisted && !onDisk(n.href));
say(imaginary.length === 0, "every node points at a real route");
for (const n of imaginary) console.log(`         ${n.href} — ${n.label}`);

console.log(bad ? `\n FAIL  ${bad} of 3` : `\n PASS  ${routes.length} routes, ${nodes.length} nodes, one map`);
process.exit(bad ? 1 : 0);
