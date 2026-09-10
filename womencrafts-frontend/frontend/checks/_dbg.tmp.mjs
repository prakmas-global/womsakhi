import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
await p.goto(APP + "/app/learn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
await new Promise(r => setTimeout(r, 2600));
const r1 = await p.evaluate(() => {
  const nav = document.querySelector("nav[aria-label='Sections']");
  const probe = document.createElement("div");
  probe.style.setProperty("--zz", "40px");
  probe.style.paddingBottom = "var(--zz)";
  probe.style.paddingTop = "var(--sa-bottom)";
  nav.appendChild(probe);
  const out = {
    ownVar: getComputedStyle(probe).paddingBottom,
    inheritedSa: getComputedStyle(probe).paddingTop,
    saValue: getComputedStyle(probe).getPropertyValue("--sa-bottom").trim(),
  };
  probe.remove();
  return out;
});
console.log("same-tick:", r1);
// Now across a task boundary: set it, wait a frame, then read.
await p.evaluate(() => { document.querySelector(".ux").style.setProperty("--sa-bottom", "34px"); });
await new Promise(r => setTimeout(r, 500));
console.log("after a tick:", await p.evaluate(() => {
  const nav = document.querySelector("nav[aria-label='Sections']");
  return { navPad: getComputedStyle(nav).paddingBottom,
           navH: Math.round(nav.getBoundingClientRect().height),
           scrollerPad: getComputedStyle(document.querySelector("#ux-scroll")).paddingBottom };
}));
await b.close();
