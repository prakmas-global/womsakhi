/** Chat-specific measurements: keyboard, pinning, growing input. */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";
const OUT = "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/shots";
const TAG = process.argv[2] || "after";
const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const cdp = await p.createCDPSession();
await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "pointer", value: "coarse" }, { name: "any-pointer", value: "coarse" }, { name: "hover", value: "none" }] });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

await p.goto(APP + "/app/messages", { waitUntil: "domcontentloaded", timeout: 120000 });
await wait(3500);
await p.screenshot({ path: `${OUT}/${TAG}-m-messages-inbox.png` });

// open the first conversation
const opened = await p.evaluate(() => {
  const btns = [...document.querySelectorAll("section button")].filter((b) => b.offsetHeight > 44 && b.querySelector("img"));
  if (!btns.length) return false;
  btns[0].click();
  return true;
});
console.log("opened conversation:", opened);
await wait(2500);
await p.screenshot({ path: `${OUT}/${TAG}-m-messages-thread.png` });

const frame = await p.evaluate(() => {
  const f = document.querySelector(".ux-chat");
  const log = document.querySelector(".ux-chat-log");
  const dock = document.querySelector(".ux-chat-dock");
  const ta = document.querySelector(".ux-chat-dock textarea");
  const bar = document.querySelector(".ux-tabbar, nav[class*='fixed'][class*='bottom-0']");
  const r = (e) => e ? (({ x, y, width: w, height: h, top: t, bottom: bo }) => ({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), t: Math.round(t), b: Math.round(bo) }))(e.getBoundingClientRect()) : null;
  return {
    frame: r(f), log: r(log), dock: r(dock), ta: r(ta), bar: r(bar),
    logScrollable: log ? log.scrollHeight > log.clientHeight : null,
    atBottom: log ? Math.round(log.scrollHeight - log.scrollTop - log.clientHeight) : null,
    taFont: ta ? getComputedStyle(ta).fontSize : null,
    enterKeyHint: ta ? ta.getAttribute("enterkeyhint") : null,
    inputMode: ta ? ta.getAttribute("inputmode") : null,
    autocomplete: ta ? ta.getAttribute("autocomplete") : null,
    role: document.querySelector('[role="log"]') ? "log" : null,
    innerH: window.innerHeight, vvH: Math.round(window.visualViewport.height),
  };
});
console.log("NO KEYBOARD:", JSON.stringify(frame, null, 1));

// ── simulate the keyboard ────────────────────────────────────────────────────
// The production listener reads window.visualViewport.height / offsetTop. We
// shadow those two getters on the live instance and fire the real event, so the
// code path under test is the shipped one; only the number is ours.
const KB = 336;
await p.evaluate((kb) => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight - kb });
  Object.defineProperty(vv, "offsetTop", { configurable: true, get: () => 0 });
  vv.dispatchEvent(new Event("resize"));
}, KB);
await p.evaluate(() => document.querySelector(".ux-chat-dock textarea")?.focus());
await wait(500);
await p.screenshot({ path: `${OUT}/${TAG}-m-messages-keyboard.png` });

const withKb = await p.evaluate((kb) => {
  const f = document.querySelector(".ux-chat");
  const dock = document.querySelector(".ux-chat-dock");
  const ta = document.querySelector(".ux-chat-dock textarea");
  const r = (e) => e ? (({ top: t, bottom: b, height: h }) => ({ t: Math.round(t), b: Math.round(b), h: Math.round(h) }))(e.getBoundingClientRect()) : null;
  return {
    kbVar: getComputedStyle(document.documentElement).getPropertyValue("--ux-kb").trim(),
    dataAttr: document.documentElement.getAttribute("data-ux-kb"),
    frame: r(f), dock: r(dock), ta: r(ta),
    visibleBottom: window.innerHeight - kb,
    dockPadBottom: dock ? getComputedStyle(dock).paddingBottom : null,
  };
}, KB);
withKb.composerFullyVisible = withKb.dock && withKb.dock.b <= withKb.visibleBottom + 1;
console.log("WITH KEYBOARD:", JSON.stringify(withKb, null, 1));

// close the keyboard again
await p.evaluate(() => {
  const vv = window.visualViewport;
  Object.defineProperty(vv, "height", { configurable: true, get: () => window.innerHeight });
  vv.dispatchEvent(new Event("resize"));
});
await wait(400);

// ── scroll pinning ───────────────────────────────────────────────────────────
const pin = await p.evaluate(async () => {
  const log = document.querySelector(".ux-chat-log");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = {};
  out.startedAtBottom = Math.round(log.scrollHeight - log.scrollTop - log.clientHeight) <= 2;
  // scroll to the top and let React grow the list (simulated by appending a node
  // to the <ol>, which is what a new message does to the DOM)
  log.scrollTop = 0;
  log.dispatchEvent(new Event("scroll"));
  await sleep(120);
  out.scrolledTo = Math.round(log.scrollTop);
  const ol = log.querySelector("ol");
  const li = document.createElement("li");
  li.style.height = "120px";
  li.textContent = "a new message arrives";
  ol.appendChild(li);
  await sleep(400);
  out.afterNewMessage = Math.round(log.scrollTop);
  out.jumpButton = !!document.querySelector(".ux-chat-dock button [class*='ChevronDown'], .ux-chat-dock button svg");
  out.jumpLabel = [...document.querySelectorAll(".ux-chat-dock button")].map((b) => b.textContent.trim()).filter((t) => /latest/i.test(t))[0] || null;
  // now go back to the bottom and repeat: it SHOULD follow
  log.scrollTop = log.scrollHeight;
  log.dispatchEvent(new Event("scroll"));
  await sleep(120);
  const li2 = document.createElement("li");
  li2.style.height = "120px";
  li2.textContent = "another message";
  ol.appendChild(li2);
  await sleep(400);
  out.followedWhenAtBottom = Math.round(log.scrollHeight - log.scrollTop - log.clientHeight) <= 4;
  return out;
});
console.log("PINNING:", JSON.stringify(pin, null, 1));

// ── the input grows, then scrolls ────────────────────────────────────────────
const grow = await p.evaluate(async () => {
  const ta = document.querySelector(".ux-chat-dock textarea");
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const set = (v) => {
    const proto = Object.getPrototypeOf(ta);
    Object.getOwnPropertyDescriptor(proto, "value").set.call(ta, v);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const out = {};
  set("one line");
  await sleep(200); out.oneLine = Math.round(ta.getBoundingClientRect().height);
  set(Array(6).fill("a longer line of text that will certainly wrap on a phone").join("\n"));
  await sleep(250);
  out.manyLines = Math.round(ta.getBoundingClientRect().height);
  out.overflowY = getComputedStyle(ta).overflowY;
  out.scrollsInternally = ta.scrollHeight > ta.clientHeight + 2;
  set("");
  await sleep(150);
  out.backToOneLine = Math.round(ta.getBoundingClientRect().height);
  return out;
});
console.log("GROWTH:", JSON.stringify(grow, null, 1));

await b.close();
