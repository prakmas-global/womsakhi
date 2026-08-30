/**
 * A write Sakhi makes has to show up on the screen the woman is already
 * looking at.
 *
 * This is the bug it exists for: she asked Sakhi to leave a programme, Sakhi
 * left it, the database was correct — and the programme sat on her screen
 * until she reloaded the page herself. The write looked lost and the app
 * looked broken, when the only thing missing was telling the screen.
 *
 * So: leave a programme through Sakhi, and assert it disappears from the list
 * WITHOUT a reload. The check reloads only at the very end, to prove the
 * database agreed all along.
 */
import { launch, pageAs, seededMemberToken, APP, API } from "./_shared.mjs";

const browser = await launch();
const token = await seededMemberToken();
const page = await pageAs(browser, token, { width: 1440, height: 950 });

const enrolled = async () => {
  const r = await fetch(`${API}/me/programs`, { headers: { Cookie: `access_token=${token}` } });
  const body = await r.json();
  const list = Array.isArray(body) ? body : (body.items ?? []);
  return list.filter((e) => e.status === "active");
};

const before = await enrolled();
if (!before.length) {
  console.log("\n  the seeded member is not in any programme — nothing to leave\n");
  await browser.close();
  process.exit(1);
}
const target = before[0];
const name = target.program_name;
if (!name) { console.log("\n  could not read the programme name\n"); await browser.close(); process.exit(1); }

await page.goto(`${APP}/app/programs`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("button", { timeout: 30000 });
await new Promise((r) => setTimeout(r, 3000));

// Scoped to the programme list on purpose. Sakhi says the programme's name in
// her own confirmation and reply, so a whole-page text match is true even after
// the card has correctly gone — which makes a working fix look broken.
const onScreen = () => page.evaluate((n) => {
  const main = document.querySelector("main") ?? document.body;
  const clone = main.cloneNode(true);
  clone.querySelectorAll(".wc-card").forEach((c) => {
    if ([...c.querySelectorAll("p")].some((x) => x.textContent.trim() === "Sakhi")) c.remove();
  });
  return clone.innerText.includes(n);
}, name);
const shownBefore = await onScreen();

await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Ask Sakhi")?.click());
await new Promise((r) => setTimeout(r, 4500));

await page.evaluate(() => [...document.querySelectorAll("button")]
  .find((b) => b.getAttribute("aria-label") === "Type instead")?.click());
await new Promise((r) => setTimeout(r, 600));
await page.type("input[placeholder]", `Please take me out of ${name}`);
await page.keyboard.press("Enter");

// wait for her to ask before doing it
let confirmed = false;
for (let i = 0; i < 40; i++) {
  const yes = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => /yes, do it/i.test(x.textContent));
    if (!b) return false;
    b.click();
    return true;
  });
  if (yes) { confirmed = true; break; }
  await new Promise((r) => setTimeout(r, 1000));
}

await new Promise((r) => setTimeout(r, 6000));
const shownAfter = await onScreen();          // still no reload

const after = await enrolled();
const goneFromDb = after.length < before.length;

// only now, to show the database agreed the whole time
await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
const shownReloaded = await onScreen();

const fail = [];
if (!shownBefore) fail.push(`"${name}" was not on the screen to begin with`);
if (!confirmed) fail.push("she never asked before writing — the confirmation never appeared");
if (!goneFromDb) fail.push("the programme was not actually left — nothing was written");
if (shownAfter) fail.push(`"${name}" is still on screen after Sakhi left it — the screen was never told`);
if (shownReloaded) fail.push(`"${name}" is still there after a reload — the write did not land`);

console.log(`\n  left "${name}" through Sakhi`);
console.log(`  enrolled before ${before.length}, after ${after.length}`);
console.log(`  on screen — before: ${shownBefore}, after (no reload): ${shownAfter}, after reload: ${shownReloaded}`);
console.log(fail.length
  ? "  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "  what she changes shows up straight away, without a reload\n");

await browser.close();
process.exit(fail.length ? 1 : 0);
