/**
 * The layout engine's split pane, on the screen that adopted it first.
 *
 * `/dashboard/messages/members` is the pilot: a member list beside her thread.
 * What this guards is not that the component renders, but that the four things
 * it promises actually happen — it drags, it persists, it works from the
 * keyboard, and it gets out of the way on a phone.
 *
 * Note the selector. `ResizeHandle` also carries `role="separator"`, so a bare
 * `[role="separator"]` query silently matches a different component — which is
 * exactly how this check first reported a false failure on mobile and, worse,
 * three false passes on desktop.
 */
import { APP, launch, pageAs, staffToken } from "./_shared.mjs";

const SEL = '[role="separator"][aria-label="Resize panels"]';
const token = await staffToken();
const browser = await launch();
const pass = [], fail = [];
const check = (n, ok, d = "") => { (ok ? pass : fail).push(n); console.log(`${ok ? "  ok  " : " FAIL "} ${n}${!ok && d ? "  — " + d : ""}`); };

// desktop: a real, draggable divider
const page = await pageAs(browser, token, { width: 1440, height: 900 });
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${APP}/dashboard/messages/members`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 2000));

const sep = await page.$(SEL);
check("the split has a real separator", !!sep);
check("it is labelled for assistive tech",
  !!sep && (await page.$eval(SEL, (e) => e.getAttribute("aria-label"))) !== null);

const widthOf = () => page.$eval(SEL, (e) => Math.round(e.getBoundingClientRect().left));
if (sep) {
  const before = await widthOf();
  const box = await sep.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 180, box.y + box.height / 2, { steps: 12 });
  await page.mouse.up();
  await new Promise((r) => setTimeout(r, 800));
  const after = await widthOf();
  check("dragging moves it", Math.abs(after - before) > 40, `${before} -> ${after}`);

  // and it survives a reload — the whole point of persisting
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2000));
  const reloaded = await widthOf();
  check("where she left it is remembered", Math.abs(reloaded - after) < 40, `${after} -> ${reloaded}`);

  // keyboard
  await page.focus(SEL);
  const kb = await widthOf();
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await new Promise((r) => setTimeout(r, 500));
  check("arrow keys move it too", Math.abs((await widthOf()) - kb) > 2, `${kb} -> ${await widthOf()}`);
}

// phone: stacks, no divider
const phone = await pageAs(browser, token, { width: 390, height: 844 });
await phone.goto(`${APP}/dashboard/messages/members`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 1500));
check("on a phone it stacks instead", !(await phone.$(SEL)));
const box = await phone.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
check("and still fits the screen", box.s <= box.c + 1, JSON.stringify(box));

const real = errors.filter((e) => !/favicon|React DevTools/i.test(e));
check("no console errors", real.length === 0, real.slice(0, 2).join(" | "));
await browser.close();
console.log(`\n${pass.length} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
