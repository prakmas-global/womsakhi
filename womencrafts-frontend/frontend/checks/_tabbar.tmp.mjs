/**
 * What the new bottom bar and the page transition actually do, in a browser.
 *
 * Two things this had to learn the hard way:
 *  · headless Chrome reports `prefers-reduced-motion: reduce` by DEFAULT, so
 *    every animation reads as `none` unless it is emulated away. Every
 *    animation measurement below therefore sets `no-preference` explicitly.
 *  · a custom property written with `element.style.setProperty` is not visible
 *    to `getComputedStyle` on a DEPENDENT property until the next task. Read in
 *    the same tick, `--sa-bottom: 34px` still reported `padding-bottom: 0px`.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const SHOTS = process.env.SHOTS;
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const motion = (v) => p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: v }]);

const go = async (path) => {
  await p.goto(APP + path, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
  await settle(2600);
};

await motion("no-preference");

for (const [path, name] of [["/app", "home"], ["/app/learn", "learn"], ["/app/earn", "earn"]]) {
  await go(path);
  await p.screenshot({ path: `${SHOTS}/after-${name}.png` });
}

// A close-up of the bar, in colour and in greyscale.
const clip = await p.evaluate(() => {
  const r = document.querySelector("nav[aria-label='Sections']").getBoundingClientRect();
  return { x: 0, y: Math.floor(r.top) - 4, width: Math.round(r.width), height: Math.ceil(r.height) + 6 };
});
await p.screenshot({ path: `${SHOTS}/bar-colour.png`, clip });
await p.evaluate(() => { document.documentElement.style.filter = "grayscale(1)"; });
await settle(250);
await p.screenshot({ path: `${SHOTS}/bar-grey.png`, clip });
await p.evaluate(() => { document.documentElement.style.filter = ""; });

console.log("\n── the bar ──────────────────────────────────────────");
console.log(await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  const cs = getComputedStyle(n);
  const r = n.getBoundingClientRect();
  return { tag: n.tagName, cls: n.className, role: n.getAttribute("aria-label"),
    position: cs.position, zIndex: cs.zIndex, display: cs.display,
    sitsAtBottom: Math.round(innerHeight - r.bottom) === 0, height: Math.round(r.height),
    backdrop: cs.backdropFilter, background: cs.backgroundColor,
    solidFallbackDeclared: [...document.styleSheets].some((s) => { try {
      return [...s.cssRules].some((x) => /\.ux-glass/.test(x.cssText) && !/backdrop/.test(x.cssText)); } catch { return false; } }),
    borderTop: cs.borderTopWidth + " " + cs.borderTopStyle };
}));

console.log("\n── each tab ─────────────────────────────────────────");
for (const t of await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  return [...n.querySelectorAll("a")].map((a) => {
    const label = a.querySelector(".ux-tab-label"), pill = a.querySelector(".ux-tab-pill");
    const ind = getComputedStyle(a, "::before"), r = a.getBoundingClientRect();
    return { text: a.innerText.trim(), href: a.getAttribute("href"), current: a.getAttribute("aria-current"),
      box: `${Math.round(r.width)}x${Math.round(r.height)}`, tabIndex: a.tabIndex,
      colour: getComputedStyle(a).color, labelWeight: getComputedStyle(label).fontWeight,
      truncated: label.scrollWidth > label.clientWidth + 1,
      pillBg: getComputedStyle(pill).backgroundColor, pillBorder: getComputedStyle(pill).borderTopWidth + " " + getComputedStyle(pill).borderTopColor,
      indicator: ind.content !== "none" ? `${ind.width}x${ind.height}` : "none",
      stroke: a.querySelector("svg")?.getAttribute("stroke-width") };
  });
})) console.log(" ", JSON.stringify(t));

console.log("\n── clears the home indicator (34px bottom inset simulated) ──");
console.log("  no inset:", await p.evaluate(() => ({
  tabbarPaddingBottom: getComputedStyle(document.querySelector("nav[aria-label='Sections']")).paddingBottom,
  tabbarBox: Math.round(document.querySelector("nav[aria-label='Sections']").getBoundingClientRect().height),
  scrollerPaddingBottom: getComputedStyle(document.querySelector("#ux-scroll")).paddingBottom })));
await p.evaluate(() => document.querySelector(".ux").style.setProperty("--sa-bottom", "34px"));
await settle(400);
console.log("  34px inset:", await p.evaluate(() => ({
  tabbarPaddingBottom: getComputedStyle(document.querySelector("nav[aria-label='Sections']")).paddingBottom,
  tabbarBox: Math.round(document.querySelector("nav[aria-label='Sections']").getBoundingClientRect().height),
  scrollerPaddingBottom: getComputedStyle(document.querySelector("#ux-scroll")).paddingBottom,
  lastTabBottomEdgeAboveIndicator: (() => {
    const a = document.querySelector("nav[aria-label='Sections'] a:last-of-type").getBoundingClientRect();
    return Math.round(innerHeight - a.bottom); })() })));
await p.screenshot({ path: `${SHOTS}/bar-with-inset.png` });
await p.evaluate(() => document.querySelector(".ux").style.removeProperty("--sa-bottom"));
await settle(300);

console.log("\n── keyboard ─────────────────────────────────────────");
await p.evaluate(() => document.querySelector("nav[aria-label='Sections']").querySelectorAll("a")[2].focus());
console.log(" ", await p.evaluate(() => {
  const el = document.activeElement, cs = getComputedStyle(el);
  return { focused: el.innerText.trim(), tag: el.tagName,
    outline: `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, offset: cs.outlineOffset,
    everyTabIndex: [...document.querySelectorAll("nav[aria-label='Sections'] a")].map((a) => a.tabIndex) };
}));
console.log("  Enter on the focused tab:", await (async () => {
  await p.keyboard.press("Enter"); await settle(2400); return p.evaluate(() => location.pathname);
})());

console.log("\n── direction ────────────────────────────────────────");
const dx = () => p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--ux-page-dx").trim() || "(unset)");
const tapTab = async (label) => { await p.evaluate((l) => {
  [...document.querySelectorAll("nav[aria-label='Sections'] a")].find((a) => a.innerText.trim() === l).click();
}, label); await settle(2200); };
await go("/app");
console.log("  fresh load of /app:            ", await dx(), "(0px default = fade only, nothing arriving)");
await tapTab("Learn");
console.log("  tap Learn (forward):           ", await dx(), await p.evaluate(() => location.pathname));
await tapTab("Earn");
console.log("  tap Earn (forward):            ", await dx(), await p.evaluate(() => location.pathname));
await p.goBack({ waitUntil: "domcontentloaded" }); await settle(2200);
console.log("  browser Back:                  ", await dx(), await p.evaluate(() => location.pathname));
await p.goBack({ waitUntil: "domcontentloaded" }); await settle(2200);
console.log("  browser Back again:            ", await dx(), await p.evaluate(() => location.pathname));
await p.goForward({ waitUntil: "domcontentloaded" }); await settle(2200);
console.log("  browser Forward:               ", await dx(), await p.evaluate(() => location.pathname));

console.log("\n── the animation on the arriving screen ─────────────");
console.log("  motion allowed:", await p.evaluate(() => {
  const el = document.querySelector("#content").firstElementChild, cs = getComputedStyle(el);
  return { on: el.tagName + "." + String(el.className).split(" ")[0], name: cs.animationName,
           duration: cs.animationDuration, easing: cs.animationTimingFunction, fill: cs.animationFillMode };
}));
await motion("reduce");
await go("/app/earn");
console.log("  reduced motion:", await p.evaluate(() => ({
  name: getComputedStyle(document.querySelector("#content").firstElementChild).animationName })));
await motion("no-preference");

console.log("\n── mid-slide, can the screen be panned sideways? ────");
await go("/app");
console.log(" ", await p.evaluate(async () => {
  const sc = document.querySelector("#ux-scroll");
  const at = () => ({ scrollWidth: sc.scrollWidth, clientWidth: sc.clientWidth });
  const before = at();
  [...document.querySelectorAll("nav[aria-label='Sections'] a")].find((a) => a.innerText.trim() === "Learn").click();
  await new Promise((r) => setTimeout(r, 90));
  const during = at();
  await new Promise((r) => setTimeout(r, 700));
  return { before, during, after: at(), docOverflow: document.documentElement.scrollWidth - innerWidth };
}));

console.log("\n── scroll: down, navigate, where does the next screen start? ──");
for (const mode of ["reduce", "no-preference"]) {
  await motion(mode); await go("/app/learn");
  await p.evaluate(() => { document.querySelector("#ux-scroll").scrollTop = 600; });
  await settle(400);
  const from = await p.evaluate(() => document.querySelector("#ux-scroll").scrollTop);
  await tapTab("Earn");
  const to = await p.evaluate(() => document.querySelector("#ux-scroll").scrollTop);
  await p.goBack({ waitUntil: "domcontentloaded" }); await settle(2200);
  const back = await p.evaluate(() => document.querySelector("#ux-scroll").scrollTop);
  console.log(`  ${mode.padEnd(14)} scrolled to ${from} → forward lands at ${to} → Back restores to ${back}`);
}
await motion("no-preference");

console.log("\n── desktop, above lg ────────────────────────────────");
await p.setViewport({ width: 1440, height: 900 });
await go("/app/learn");
console.log(" ", await p.evaluate(() => {
  const n = document.querySelector("nav[aria-label='Sections']");
  return { barDisplay: n ? getComputedStyle(n).display : "(absent)",
           pageAnimation: getComputedStyle(document.querySelector("#content").firstElementChild).animationName };
}));

console.log(errs.length ? "\n  PAGE ERRORS: " + [...new Set(errs)].slice(0, 4).join(" | ") : "\n  no page errors");
await b.close();
