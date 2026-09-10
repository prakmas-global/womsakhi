import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const go = async (path) => {
  await p.goto(APP + path, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
  await settle(2600);
};
await go("/app");
console.log("  overflow-x on #ux-scroll:", await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector("#ux-scroll"));
  return { x: cs.overflowX, y: cs.overflowY };
}));
console.log("  sampled across a slide:", await p.evaluate(async () => {
  const sc = document.querySelector("#ux-scroll");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = []; const t0 = performance.now();
  [...document.querySelectorAll("nav[aria-label='Sections'] a")].find((a) => a.innerText.trim() === "Learn").click();
  for (let i = 0; i < 8; i++) {
    await wait(50);
    sc.scrollLeft = 999; const pannable = sc.scrollLeft; sc.scrollLeft = 0;
    seen.push(`${Math.round(performance.now() - t0)}ms w=${sc.scrollWidth} pan=${pannable} left=${Math.round(document.querySelector("#content").firstElementChild?.getBoundingClientRect().left ?? -999)}`);
  }
  return seen;
}));
// Vertical scrolling must still work.
await go("/app/earn");
console.log("  vertical scroll still works:", await p.evaluate(() => {
  const s = document.querySelector("#ux-scroll"); s.scrollTop = 400;
  return { scrollTop: s.scrollTop, scrollable: s.scrollHeight - s.clientHeight };
}));
await b.close();
