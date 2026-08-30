/**
 * Which screens are actually wired to the server, and which only look it.
 *
 * Written after `/checkout/[orderId]` was found holding two hardcoded orders
 * and a Pay button that waited 1.1 seconds before announcing "Paid" without
 * ever calling the API. That screen passed every render check it had. The
 * only way to catch the next one is to ask, per route, whether it reads the
 * server, whether its buttons write to it, and whether any handler fakes an
 * outcome with a timer.
 *
 * It reads source, not the browser — so it is a map of where to look, not a
 * verdict. A route marked "static" may be right to be static.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/app/app";
const pages = [];
(function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e === "page.tsx") pages.push(p);
  }
})(ROOT);

// A timer that flips a stage to a finished-sounding word is the tell. A timer
// that resets a "Copied" label after two seconds is not.
const FAKE = /setTimeout\(\(\)\s*=>\s*set(Stage|Busy|Sending|Saving|Done|Sent|Paid)\b/;

/**
 * The quieter half of the same lie: a handler whose whole body is setting a
 * finished-sounding flag.
 *
 * The timer version is easy to spot. This one is not, and it is more common —
 * `onClick={() => setSaved(true)}` on a price editor, `setState("Cancelled")`
 * on an order the buyer is still expecting. Both editors in Your business and
 * both order screens were this, and the timer regex saw none of them.
 */
const FAKE_FLAG = /onClick=\{\(\)\s*=>\s*set(Saved|Sent|Done|Created|Cancelled|Joined|Applied)\(/;
// `use[A-Z]…(` with no closing paren required: the first version of this
// insisted on `()`, so every hook that takes an argument — `useCircle(id)`,
// the shape every detail screen uses — was counted as reading nothing.
const READ = /useResource|api[A-Z][A-Za-z]*\(|use[A-Z][A-Za-z]*\(/;
const WRITE = /api[A-Z][A-Za-z]*\(|apiClient\.(post|patch|put|delete)/;
const BUTTONS = /onClick=/g;

/**
 * A constant imported from a mock `data.ts` and then *rendered*.
 *
 * This is the signal that actually means something, and getting here took two
 * wrong ones. Requiring `use…()` with empty parens missed every detail screen,
 * because they all call `useCircle(id)`. Flagging any rendered UPPER_CASE name
 * missed the convention this codebase uses — `const { data: BOOKINGS } =
 * useBookings()` puts live data in an uppercase name on purpose, so the JSX
 * reads the way it did when it was a mock.
 *
 * What is left is precise: a name that comes from a `data` module and is
 * mapped, filtered or counted. `/circles/[id]` fetched its circle from the
 * server and then listed eleven fictional members underneath — that is what
 * this finds. A lookup table imported from the same file is not rendered, so
 * it does not trip.
 */
const MOCK_IMPORT = /import\s*\{([^}]+)\}\s*from\s*["'][^"']*\/data["']/g;
const usedAsData = (src, name) =>
  new RegExp(`\\b${name}\\s*\\.\\s*(map|filter|slice|length|find|reduce)\\b`).test(src);

const rows = pages.map((p) => {
  const src = readFileSync(p, "utf8");
  // A page whose whole job is `redirect(...)` reads nothing on purpose — the
  // two Discover detail routes are deliberate forwards to the real screens.
  const redirects = /from "next\/navigation"/.test(src) && /\bredirect\(/.test(src);
  return {
    route: "/" + p.replace(`${ROOT}/`, "").replace("/page.tsx", ""),
    reads: READ.test(src) || redirects,
    writes: WRITE.test(src),
    fake: FAKE.test(src) || FAKE_FLAG.test(src),
    buttons: (src.match(BUTTONS) ?? []).length,
    // Named so the report can say which constant, not just that there is one.
    hardcoded: [...src.matchAll(MOCK_IMPORT)]
      .flatMap((m) => m[1].split(","))
      .map((n) => n.replace(/\bas\b.*/, "").trim())
      .filter((n) => /^[A-Z][A-Z0-9_]{2,}$/.test(n) && usedAsData(src, n)),
  };
});

const faking = rows.filter((r) => r.fake);
const invented = rows.filter((r) => r.hardcoded.length);
const blind = rows.filter((r) => !r.reads);
const inert = rows.filter((r) => r.buttons >= 3 && !r.writes);

const show = (title, list, note) => {
  console.log(`\n${title} — ${list.length}`);
  if (note) console.log(`  ${note}`);
  for (const r of list) console.log(`   ${r.route.padEnd(34)} ${r.buttons} buttons`);
};

console.log(`${rows.length} routes under ${ROOT}`);
show("PRETENDS THE SERVER ANSWERED", faking, "a timer flips the stage to a finished word — nothing is sent");
show("READS NOTHING FROM THE SERVER", blind, "some of these are rightly static; the rest are showing invented data");
show("HAS BUTTONS BUT NEVER WRITES", inert, "three or more handlers, no call that changes anything");

console.log(`\nRENDERS A HARDCODED CONSTANT — ${invented.length}`);
console.log("  reads the server and still shows invented content beside it");
for (const r of invented) console.log(`   ${r.route.padEnd(34)} ${r.hardcoded.join(", ")}`);

const clean = rows.filter((r) => !r.fake && r.reads && (r.buttons < 3 || r.writes)).length;
console.log(`\n${clean} of ${rows.length} routes read the server and have no faked outcome.`);
