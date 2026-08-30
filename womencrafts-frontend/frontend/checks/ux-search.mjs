/**
 * The search palette, driven the way a person drives it.
 *
 * Search is the one control on every screen, so it is checked by pressing keys
 * rather than by asserting that the markup exists: ⌘K opens it, typing filters,
 * the arrows move a highlight, Enter goes where the highlight is, Escape closes
 * it. A palette that only works with a mouse is a palette most people abandon.
 */
import { launch, pageAs, seededMemberToken } from "./_shared.mjs";

const APP = process.env.UX_URL || "http://localhost:3100";
const fail = [];
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

const token = await seededMemberToken();
const browser = await launch();
const page = await pageAs(browser, token, { width: 1536, height: 1024 });
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
await page.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

const open = () => page.$('[role="dialog"][aria-label="Search WomSakhi"]');
/** Focus lands a frame after the dialog mounts, so typing has to wait for it. */
const ready = () => page.waitForFunction(
  () => document.activeElement?.getAttribute("aria-label") === "Search", { timeout: 5000 });
/** And React re-renders after the value lands — assert what the field holds. */
const typed = async (text) => {
  await ready();
  await page.keyboard.type(text, { delay: 25 });
  await page.waitForFunction(
    (t) => document.querySelector('[role="dialog"] input')?.value === t, { timeout: 5000 }, text);
  await new Promise((r) => setTimeout(r, 250));
};
const rows = () => page.$$eval('[role="dialog"] button[data-sel], [role="dialog"] button',
  (bs) => bs.map((b) => (b.innerText || "").trim().split("\n")[0]).filter(Boolean));

say(!(await open()), "closed until asked for");

// ⌘K on macOS, Ctrl+K elsewhere — the component listens for both.
await page.keyboard.down("Meta"); await page.keyboard.press("KeyK"); await page.keyboard.up("Meta");
await new Promise((r) => setTimeout(r, 400));
say(!!(await open()), "⌘K opens it");

const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label"));
say(focused === "Search", `focus lands in the field (got ${focused ?? "nothing"})`);

await typed("digital");
const hits = await rows();
const filtered = hits.filter((t) => /digital/i.test(t));
say(filtered.length >= 2, `typing filters — ${filtered.length} rows mention "digital"`);

// The highlighted row is the one the palette marks, not the one under the mouse.
const selected = () => page.$eval('[role="dialog"] button[data-sel="1"]',
  (b) => (b.innerText || "").trim().split("\n")[0]).catch(() => null);
const first = await selected();
await page.keyboard.press("ArrowDown");
await new Promise((r) => setTimeout(r, 200));
const second = await selected();
say(!!first && !!second && first !== second, `arrows move the highlight (${first} → ${second})`);

await page.keyboard.press("ArrowUp");
await new Promise((r) => setTimeout(r, 200));
say((await selected()) === first, "and move it back");

await page.keyboard.press("Escape");
await new Promise((r) => setTimeout(r, 350));
say(!(await open()), "Escape closes it");

// "/" is the other habit people bring, but not while they are typing.
await page.keyboard.press("Slash");
await new Promise((r) => setTimeout(r, 350));
say(!!(await open()), "\"/\" opens it too");

await typed("mentor");
await page.keyboard.press("Enter");
await page.waitForFunction(() => !document.querySelector('[role="dialog"]'), { timeout: 8000 }).catch(() => {});
await new Promise((r) => setTimeout(r, 1200));
const url = page.url();
say(url.includes("/app/mentors"), `Enter opens the highlighted row (${url.replace(APP, "")})`);

// And the empty state has to say so rather than showing a blank box.
await page.goto(APP + "/app", { waitUntil: "domcontentloaded", timeout: 90000 });
await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
await page.keyboard.down("Control"); await page.keyboard.press("KeyK"); await page.keyboard.up("Control");
await new Promise((r) => setTimeout(r, 400));
say(!!(await open()), "Ctrl+K opens it as well");
await typed("qqqzzz");
const empty = await page.$eval('[role="dialog"]', (d) => d.innerText).catch(() => "");
say(/Nothing matched/i.test(empty), "a miss says nothing matched");

await browser.close();
console.log(fail.length ? `\n  ${fail.length} failing\n` : "\n  the palette works from the keyboard alone\n");
process.exit(fail.length ? 1 : 0);
