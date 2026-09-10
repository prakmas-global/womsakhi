/** What the new bottom bar and the page transition actually do, in a browser. */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const SHOTS = process.env.SHOTS;
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
const settle = (ms) => new Promise((r) => setTimeout(r, ms));

const go = async (path) => {
  await p.goto(APP + path, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
  await settle(2600);
};

for (const [path, name] of [["/app", "home"], ["/app/learn", "learn"], ["/app/earn", "earn"]]) {
  await go(path);
  await p.screenshot({ path: `${SHOTS}/after-${name}.png` });
}

console.log("\n── the bar ──────────────────────────────────────────");
const bar = await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  const cs = getComputedStyle(n);
  const r = n.getBoundingClientRect();
  return {
    tag: n.tagName, cls: n.className,
    position: cs.position, zIndex: cs.zIndex, display: cs.display,
    bottom: Math.round(innerHeight - r.bottom), height: Math.round(r.height),
    backdrop: cs.backdropFilter || cs.webkitBackdropFilter,
    background: cs.backgroundColor,
    borderTop: cs.borderTopWidth + " " + cs.borderTopColor,
    padBottom: cs.paddingBottom,
    styleInHead: !!document.head.querySelector("style[data-href='ux-tabbar'], style"),
    hoisted: [...document.head.querySelectorAll("style")].some((s) => /ux-tabbar/.test(s.textContent || "")),
  };
});
console.log(bar);

console.log("\n── each tab ─────────────────────────────────────────");
const tabs = await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  return [...n.querySelectorAll("a")].map((a) => {
    const cs = getComputedStyle(a);
    const label = a.querySelector(".ux-tab-label");
    const pill = a.querySelector(".ux-tab-pill");
    const ind = getComputedStyle(a, "::before");
    const r = a.getBoundingClientRect();
    return {
      text: a.innerText.trim(),
      href: a.getAttribute("href"),
      current: a.getAttribute("aria-current"),
      w: Math.round(r.width), h: Math.round(r.height),
      colour: cs.color,
      labelWeight: getComputedStyle(label).fontWeight,
      labelSize: getComputedStyle(label).fontSize,
      truncated: label.scrollWidth > label.clientWidth + 1,
      pillBg: getComputedStyle(pill).backgroundColor,
      pillBorder: getComputedStyle(pill).borderTopColor,
      indicator: ind.content !== "none" ? `${ind.width} x ${ind.height} ${ind.backgroundColor}` : "none",
      strokeWidth: a.querySelector("svg")?.getAttribute("stroke-width"),
    };
  });
});
for (const t of tabs) console.log(" ", JSON.stringify(t));

console.log("\n── clears the home indicator (34px bottom inset simulated) ──");
const inset = await p.evaluate(() => {
  const ux = document.querySelector(".ux");
  ux.style.setProperty("--sa-bottom", "34px");
  const n = document.querySelector("nav[aria-label='Sections']");
  const sc = document.querySelector("#ux-scroll");
  const out = {
    tabbarPaddingBottom: getComputedStyle(n).paddingBottom,
    tabbarHeight: Math.round(n.getBoundingClientRect().height),
    scrollerPaddingBottom: getComputedStyle(sc).paddingBottom,
    safetyPinBottom: getComputedStyle([...document.querySelectorAll("a")]
      .find((a) => /get help now/i.test(a.getAttribute("aria-label") || ""))).bottom,
  };
  ux.style.removeProperty("--sa-bottom");
  return out;
});
console.log(" ", inset);

console.log("\n── keyboard ─────────────────────────────────────────");
await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  n.querySelectorAll("a")[2].focus();
});
const kb = await p.evaluate(() => {
  const el = document.activeElement;
  const cs = getComputedStyle(el);
  return { focused: el.innerText.trim(), outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, offset: cs.outlineOffset,
           tabbable: [...document.querySelectorAll("nav[aria-label='Sections'] a")].every((a) => a.tabIndex >= 0) };
});
console.log(" ", kb);

console.log("\n── direction, forward then back ─────────────────────");
const dxRead = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ux-page-dx").trim() || "(unset)");
console.log("  on arrival at /app/earn:", await dxRead());
await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  [...n.querySelectorAll("a")].find((a) => a.innerText.trim() === "Learn").click();
});
await settle(2200);
console.log("  after tapping Learn (forward):", await dxRead(), "at", await p.evaluate(() => location.pathname));
await p.goBack({ waitUntil: "domcontentloaded" });
await settle(2200);
console.log("  after browser Back:", await dxRead(), "at", await p.evaluate(() => location.pathname));
await p.goForward({ waitUntil: "domcontentloaded" });
await settle(2200);
console.log("  after browser Forward:", await dxRead(), "at", await p.evaluate(() => location.pathname));

console.log("\n── the animation itself ─────────────────────────────");
const anim = await p.evaluate(() => {
  const el = document.querySelector("#content").firstElementChild;
  const cs = getComputedStyle(el);
  return { name: cs.animationName, dur: cs.animationDuration, fill: cs.animationFillMode, ease: cs.animationTimingFunction,
           running: el.getAnimations().map((a) => a.animationName || a.constructor.name) };
});
console.log(" ", anim);

console.log("\n── does the slide leave the page pannable sideways? ──");
const over = await p.evaluate(() => {
  const sc = document.querySelector("#ux-scroll");
  return { scrollWidth: sc.scrollWidth, clientWidth: sc.clientWidth, docOverflow: document.documentElement.scrollWidth - innerWidth };
});
console.log(" ", over);

console.log("\n── scroll: down, navigate, does it start at the top? ──");
await p.evaluate(() => { document.querySelector("#ux-scroll").scrollTop = 600; });
await settle(400);
const beforeTop = await p.evaluate(() => document.querySelector("#ux-scroll").scrollTop);
await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  [...n.querySelectorAll("a")].find((a) => a.innerText.trim() === "Home").click();
});
await settle(2400);
const afterTop = await p.evaluate(() => document.querySelector("#ux-scroll").scrollTop);
console.log(`  scrolled to ${beforeTop}, navigated, new screen starts at ${afterTop}`);

console.log("\n── reduced motion ───────────────────────────────────");
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
await go("/app/learn");
console.log(" ", await p.evaluate(() => {
  const el = document.querySelector("#content").firstElementChild;
  return { animationName: getComputedStyle(el).animationName };
}));
await p.emulateMediaFeatures([]);

console.log("\n── desktop: the bar is gone ─────────────────────────");
await p.setViewport({ width: 1440, height: 900 });
await go("/app/learn");
console.log(" ", await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  const el = document.querySelector("#content").firstElementChild;
  return { barDisplay: n ? getComputedStyle(n).display : "(absent)", pageAnimation: getComputedStyle(el).animationName };
}));
await p.setViewport({ width: 390, height: 844 });
await go("/app");
await p.screenshot({ path: `${SHOTS}/after-home-2.png` });

console.log(errs.length ? "\n  PAGE ERRORS: " + [...new Set(errs)].slice(0, 4).join(" | ") : "\n  no page errors");
await b.close();
