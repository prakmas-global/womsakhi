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
await p.evaluate(() => [...document.querySelectorAll("nav[aria-label='Sections'] a")].find((a) => a.innerText.trim() === "Learn").click());
for (const t of [500, 1500, 3000]) {
  await settle(t === 500 ? 500 : 1000);
  console.log(`  +${t}ms after the click: scrollWidth`, await p.evaluate(() => {
    const sc = document.querySelector("#ux-scroll");
    return { scrollWidth: sc.scrollWidth, canScrollTo: (sc.scrollLeft = 999, sc.scrollLeft) };
  }));
  await p.evaluate(() => { document.querySelector("#ux-scroll").scrollLeft = 0; });
}

console.log("\n── does anything paint outside main today? ──");
for (const path of ["/app", "/app/learn", "/app/earn", "/app/work", "/app/circle", "/app/opportunities", "/app/wallet"]) {
  await go(path);
  console.log(" ", path, await p.evaluate(() => {
    const main = document.querySelector("#content");
    const m = main.getBoundingClientRect();
    let worstLeft = 0, worstRight = 0, who = null;
    main.querySelectorAll("*").forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") return;
      const r = el.getBoundingClientRect();
      if (r.width === 0) return;
      const l = m.left - r.left, rt = r.right - m.right;
      if (l > worstLeft) { worstLeft = l; who = el.tagName + "." + String(el.className).slice(0, 30); }
      if (rt > worstRight) { worstRight = rt; who = el.tagName + "." + String(el.className).slice(0, 30); }
    });
    return { mainWidth: Math.round(m.width), outsideLeftPx: Math.round(worstLeft), outsideRightPx: Math.round(worstRight), widest: who };
  }));
}
await b.close();
