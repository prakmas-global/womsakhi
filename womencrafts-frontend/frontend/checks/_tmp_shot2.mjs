/** The three Circle screen-states whose artwork changed. */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const OUT = process.env.OUT;
const tok = await seededMemberToken();
const b = await launch();

const measure = (p) => p.evaluate(() => [...document.querySelectorAll("img")]
  .map((el) => { const q = el.getBoundingClientRect(); const cs = getComputedStyle(el);
    return { src: (el.currentSrc || el.src).replace(/^https?:\/\/[^/]+/, ""), nw: el.naturalWidth,
             nh: el.naturalHeight, w: Math.round(q.width), h: Math.round(q.height), fit: cs.objectFit }; })
  .filter((x) => x.w > 2 && /ux\/art\/circle-/.test(x.src)));

const report = (label, rows) => {
  console.log(`\n[${label}]`);
  for (const x of rows) {
    let painted = x.w;
    if (x.fit === "cover") painted = x.nw * Math.max(x.w / x.nw, x.h / x.nh);
    if (x.fit === "contain") painted = x.nw * Math.min(x.w / x.nw, x.h / x.nh);
    console.log(`  ${(x.nw / painted).toFixed(2)}x  nat ${x.nw}x${x.nh}  box ${x.w}x${x.h} ${x.fit}  painted@${Math.round(painted)}  ${x.src}`);
  }
};

// 1 — the Circle board
let p = await pageAs(b, tok, { width: 1600, height: 1100 });
await p.goto(APP + "/app/circles", { waitUntil: "domcontentloaded", timeout: 180000 });
await new Promise((z) => setTimeout(z, 5000));
report("/app/circles", await measure(p));
await p.screenshot({ path: `${OUT}/final-circles.png` });
await p.close();

// 2 — Create a circle, as it opens
p = await pageAs(b, tok, { width: 1600, height: 1100 });
await p.goto(APP + "/app/circles/create", { waitUntil: "domcontentloaded", timeout: 180000 });
await new Promise((z) => setTimeout(z, 5000));
report("/app/circles/create", await measure(p));
await p.screenshot({ path: `${OUT}/final-create.png` });

// 3 — the same screen once she picks a cover: the live preview carries it
const picked = await p.evaluate(() => {
  const btn = [...document.querySelectorAll('button[aria-label^="Use this cover"]')][1];
  if (!btn) return null;
  btn.click(); return btn.getAttribute("aria-label");
});
console.log("\npicked cover ->", picked);
await new Promise((z) => setTimeout(z, 1800));
report("/app/circles/create (cover chosen)", await measure(p));
await p.screenshot({ path: `${OUT}/final-create-picked.png` });
await p.close();

// 4 — dark theme, since these pictures are dark and the band is not
p = await pageAs(b, tok, { width: 1600, height: 1100, mode: "dark" });
await p.goto(APP + "/app/circles", { waitUntil: "domcontentloaded", timeout: 180000 });
await new Promise((z) => setTimeout(z, 5000));
await p.screenshot({ path: `${OUT}/final-circles-dark.png` });
await p.close();
await b.close();
console.log("\nshots written");
