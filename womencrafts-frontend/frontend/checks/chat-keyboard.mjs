/**
 * The chat screen's three mobile-only failure modes, measured.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * None of the three shows up in a screenshot and none can be caught by reading
 * the code:
 *
 *   1. **The composer under the keyboard.** `100vh`, `100dvh` and
 *      `position: fixed; bottom: 0` all ignore the on-screen keyboard, so a
 *      composer pinned to the bottom of the page ends up beneath the keys the
 *      moment she taps it, and she types blind. Only the VisualViewport API
 *      knows the keyboard is there.
 *
 *      Headless Chrome has no keyboard, so the two getters the shipped
 *      listener reads — `visualViewport.height` and `.offsetTop` — are shadowed
 *      on the live instance and the real `resize` event is fired on it. The
 *      listener, the arithmetic, the custom property and the CSS under test are
 *      all the ones that ship; only the number is ours. What is NOT covered is
 *      iOS's own behaviour of scrolling the visual viewport inside the layout
 *      one — the code handles it (`--ux-vv-top`), a real iPhone is the only
 *      thing that can prove it.
 *
 *   2. **Scroll theft.** A thread that re-pins to the bottom on every update
 *      throws her out of the history she is reading — the single most
 *      infuriating bug a chat can have. Asserted both ways: a message arriving
 *      while she is scrolled up must not move her, and one arriving while she
 *      is at the end must.
 *
 *   3. **The field that will not grow, or will not stop.** It has to grow with
 *      what she types up to a ceiling, then scroll inside itself, then shrink
 *      back when the draft is sent.
 *
 * Not wired into `checks/all.mjs` — that file belongs to another pass. Add the
 * line there when this lands.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

const OUT = process.env.SHOT_DIR || "/tmp";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const tok = await seededMemberToken();
if (!tok) { console.error("No member token — is the API up?"); process.exit(1); }

const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
// `setViewport({ hasTouch })` does not make `pointer: coarse` match, and the
// 16px input rule in `mobile.css` is gated on it.
const cdp = await p.createCDPSession();
await cdp.send("Emulation.setEmulatedMedia", {
  features: [{ name: "pointer", value: "coarse" }, { name: "any-pointer", value: "coarse" }, { name: "hover", value: "none" }],
});

await p.goto(`${APP}/app/messages`, { waitUntil: "domcontentloaded", timeout: 120000 });
await wait(3500);

// Open the first conversation — on a phone the inbox and the thread are one
// panel at a time, so there is nothing to measure until one is open.
const opened = await p.evaluate(() => {
  const rows = [...document.querySelectorAll("section button")].filter((b) => b.offsetHeight > 44 && b.querySelector("img"));
  rows[0]?.click();
  return rows.length > 0;
});
if (!opened) { console.error("No conversation to open — seeded data missing?"); await b.close(); process.exit(1); }
await wait(2500);
await p.screenshot({ path: `${OUT}/chat-thread.png` });

const shape = await p.evaluate(() => {
  const ta = document.querySelector(".ux-chat-dock textarea");
  return {
    taFont: ta && getComputedStyle(ta).fontSize,
    enterKeyHint: ta && ta.getAttribute("enterkeyhint"),
    inputMode: ta && ta.getAttribute("inputmode"),
    autocomplete: ta && ta.getAttribute("autocomplete"),
    label: ta && ta.getAttribute("aria-label"),
    role: document.querySelector('[role="log"]')?.getAttribute("role") ?? null,
    live: document.querySelector('[role="log"]')?.getAttribute("aria-live") ?? null,
  };
});

/* ── 1. the keyboard ──────────────────────────────────────────────────────── */
const KB = 336;   // an iPhone 14's keyboard, portrait, with the suggestion strip
await p.evaluate((kb) => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight - kb });
  Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => 0 });
  vv.dispatchEvent(new Event("resize"));
}, KB);
await p.evaluate(() => document.querySelector(".ux-chat-dock textarea")?.focus());
await wait(500);
await p.screenshot({ path: `${OUT}/chat-keyboard.png` });

const withKb = await p.evaluate((kb) => {
  const dock = document.querySelector(".ux-chat-dock");
  const r = dock?.getBoundingClientRect();
  return {
    kbVar: getComputedStyle(document.documentElement).getPropertyValue("--ux-kb").trim(),
    dataAttr: document.documentElement.getAttribute("data-ux-kb"),
    dockBottom: r ? Math.round(r.bottom) : null,
    dockPadBottom: dock && getComputedStyle(dock).paddingBottom,
    visibleBottom: window.innerHeight - kb,
  };
}, KB);
withKb.composerFullyVisible = withKb.dockBottom !== null && withKb.dockBottom <= withKb.visibleBottom + 1;

// Put the keyboard away again before measuring the rest.
await p.evaluate(() => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight });
  vv.dispatchEvent(new Event("resize"));
});
await wait(400);

/* ── 2. scroll pinning ────────────────────────────────────────────────────── */
const pin = await p.evaluate(async () => {
  const log = document.querySelector(".ux-chat-log");
  const ol = log.querySelector("ol");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const add = (h, text) => { const li = document.createElement("li"); li.style.height = `${h}px`; li.textContent = text; ol.appendChild(li); };
  const out = {};

  // A thread short enough to fit has no history to be thrown out of.
  for (let i = 0; i < 6; i++) add(140, `filler ${i}`);
  await sleep(250);

  log.scrollTop = 0;
  log.dispatchEvent(new Event("scroll"));
  await sleep(200);
  out.scrolledTo = Math.round(log.scrollTop);

  add(120, "a message arrives while she is reading");
  await sleep(400);
  out.afterNewMessage = Math.round(log.scrollTop);
  out.jumpButtonShown = [...document.querySelectorAll(".ux-chat-dock button")]
    .some((b) => /latest/i.test(b.textContent || ""));

  log.scrollTop = log.scrollHeight;
  log.dispatchEvent(new Event("scroll"));
  await sleep(200);
  add(120, "and one arrives while she is at the end");
  await sleep(400);
  out.followedWhenAtBottom = Math.round(log.scrollHeight - log.scrollTop - log.clientHeight) <= 4;
  return out;
});

/* ── 3. the growing field ─────────────────────────────────────────────────── */
const grow = await p.evaluate(async () => {
  const ta = document.querySelector(".ux-chat-dock textarea");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // React owns `value`, so setting it has to go through the native setter or
  // the component never hears about it.
  const set = (v) => {
    Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ta), "value").set.call(ta, v);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const h = () => Math.round(ta.getBoundingClientRect().height);
  const out = {};
  set("one line");           await sleep(200); out.oneLine = h();
  set(Array(8).fill("a long line of text that will certainly wrap on a phone").join("\n"));
  await sleep(250);
  out.manyLines = h();
  out.overflowY = getComputedStyle(ta).overflowY;
  out.scrollsInternally = ta.scrollHeight > ta.clientHeight + 2;
  set("");                   await sleep(200); out.backToOneLine = h();
  return out;
});

await b.close();

console.log("shape   ", JSON.stringify(shape));
console.log("keyboard", JSON.stringify(withKb));
console.log("pinning ", JSON.stringify(pin));
console.log("growth  ", JSON.stringify(grow));

const fail = [];
if (!withKb.composerFullyVisible) fail.push(`the composer ends at ${withKb.dockBottom}, below the visible ${withKb.visibleBottom} — it is under the keyboard`);
if (withKb.kbVar !== `${KB}px`) fail.push(`--ux-kb read "${withKb.kbVar}", expected ${KB}px`);
if (withKb.dataAttr !== "1") fail.push("data-ux-kb was not set");
if (shape.taFont !== "16px") fail.push(`composer font-size ${shape.taFont} — iOS zooms in below 16px and never back out`);
if (shape.enterKeyHint !== "send") fail.push("the return key is not labelled Send");
if (shape.inputMode !== "text") fail.push("no inputmode on the composer");
if (shape.autocomplete !== "off") fail.push("no autocomplete on the composer");
if (!shape.label) fail.push("the composer has no accessible name");
if (shape.role !== "log" || shape.live !== "polite") fail.push("the thread is not a polite role=log live region");
if (pin.afterNewMessage !== pin.scrolledTo) fail.push(`a new message moved her from ${pin.scrolledTo} to ${pin.afterNewMessage}`);
if (!pin.jumpButtonShown) fail.push("no way back to the newest message while scrolled up");
if (!pin.followedWhenAtBottom) fail.push("the thread did not follow a new message when she was at the end");
if (grow.manyLines <= grow.oneLine) fail.push("the composer does not grow with what she types");
if (grow.overflowY !== "auto" || !grow.scrollsInternally) fail.push("the composer does not scroll once it hits its ceiling");
if (grow.backToOneLine !== grow.oneLine) fail.push("the composer does not shrink back after sending");

if (fail.length) {
  console.error("FAIL\n - " + fail.join("\n - "));
  process.exit(1);
}
console.log("chat-keyboard: ok");
