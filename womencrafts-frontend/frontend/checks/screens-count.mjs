/**
 * How many screens this app actually has — counted, not remembered.
 *
 * The 445 was folklore: a number agreed once, then quoted for weeks with no way
 * to check it. This file makes it checkable by writing the counting rule down
 * and applying it to the source.
 *
 * **The rule.** A screen-state is a distinct thing a woman can be looking at.
 * That is:
 *
 *   1. the route itself, or each of its tabs where it has them (tabs REPLACE
 *      the page, so they are not added on top of it)
 *   2. every `<EmptyState>` — a list with nothing in it is a screen she meets,
 *      and it was the most-skipped one in the whole redesign
 *   3. every stage of a flow, and the success page at the end of it
 *   4. a loading state and an error state per route, both of which Phase 3
 *      built as real screens rather than spinners
 *   5. every dialog or sheet that covers the page
 *
 * What is deliberately NOT counted: dark mode (the same screen in another
 * palette), hover and focus states, and the eight brand themes. Counting those
 * would multiply the number by sixteen and measure nothing.
 *
 * Run it whenever the total is quoted. A number nobody can reproduce is a
 * number that drifts.
 */
import { readFileSync, globSync } from "node:fs";

/** Route prefix → the module it belongs to. Longest prefix wins. */
const MODULES = [
  ["/wallet", "Earn & withdraw"], ["/payments", "Payments"],
  ["/support-fund", "Schemes"], ["/cover", "Insurance & pension"],
  ["/opportunities", "Find work"], ["/applications", "Your applications"],
  ["/documents", "Your business"], ["/group-buy", "Buying together"],
  ["/programs", "Courses"], ["/mentors", "Mentors"], ["/library", "Skill exchange"],
  ["/assess", "Prove your skills"], ["/digital", "Using a phone"],
  ["/certificates", "Certificates"],
  ["/explore", "Explore"], ["/events", "Events"], ["/intake", "What you need"],
  ["/circles", "Circles"], ["/stories", "Sakhi Local"], ["/messages", "Messages"],
  ["/health", "Health"], ["/rights", "Your rights"], ["/family", "Family & childcare"],
  ["/travel", "Getting about"],
  ["/progress", "Your journey"], ["/schedule", "Your diary"],
  ["/notifications", "Notifications"], ["/saved", "Saved"], ["/search", "Search"],
  ["/profile", "Your profile"], ["/settings", "Settings"],
  ["/bookings", "Bookings"], ["/checkout", "Checkout"],
  ["/help", "Help"], ["/safety", "Safety"], ["/refer", "Refer a friend"],
  ["/feedback", "Feedback"], ["/sakhi", "Sakhi"],
  ["/welcome", "Getting started"], ["/verify", "Verification"],
  ["/", "Today"],
];
const moduleFor = (r) => (MODULES.find(([p]) => r === p || r.startsWith(p + "/")) ?? [, "?"])[1];

const rows = [];
for (const f of globSync("src/app/app/**/page.tsx")) {
  const src = readFileSync(f, "utf8");
  const route = f.replace("src/app/app", "").replace("/page.tsx", "") || "/";

  let tabs = 0;
  for (const m of src.matchAll(/(?:items=\{\[|(?:const|let)\s+TABS\s*(?::[^=]+)?=\s*\[)([^\]]*)\]/g)) {
    const n = m[1].split(",").filter((x) => x.trim()).length;
    if (n > 1) tabs = Math.max(tabs, n);
  }
  const empties = (src.match(/<EmptyState/g) ?? []).length;
  const stages = new Set(
    [...src.matchAll(/stage\s*===\s*"(\w+)"|step\s*===\s*(\d+)/g)].map((m) => m[1] ?? m[2]),
  ).size;
  const dialogs = (src.match(/role="dialog"|<NoteBtn/g) ?? []).length;
  // Phase 3 gave every route a real loading screen and a real error screen.
  const boundaries = 2;

  rows.push({
    route, module: moduleFor(route),
    states: Math.max(1, tabs) + empties + stages + dialogs + boundaries,
  });
}

const byModule = {};
for (const r of rows) {
  (byModule[r.module] ??= { routes: 0, states: 0 });
  byModule[r.module].routes++;
  byModule[r.module].states += r.states;
}

const mods = Object.entries(byModule).sort((a, b) => b[1].states - a[1].states);
const totalStates = rows.reduce((a, r) => a + r.states, 0);

console.log(`\n  ${mods.length} modules · ${rows.length} routes · ${totalStates} screen-states\n`);
for (const [name, m] of mods) {
  console.log(`  ${String(m.states).padStart(4)}  ${String(m.routes).padStart(2)} routes   ${name}`);
}
console.log(`\n  ${String(totalStates).padStart(4)}  ${String(rows.length).padStart(2)} routes   TOTAL\n`);
