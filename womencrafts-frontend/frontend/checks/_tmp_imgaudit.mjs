import { launch, pageAs, seededMemberToken, routes, APP } from "./_shared.mjs";

const extra = [
  "/app/circles/create", "/app/opportunities", "/app/mentors", "/app/stories",
  "/app/library", "/app/documents", "/app/journey", "/app/goals", "/app/circles",
];
const list = [...new Set([...routes().member, ...extra])];

const tok = await seededMemberToken();
if (!tok) { console.log("NO TOKEN"); process.exit(1); }
const b = await launch();
const seen = new Map();

for (const r of list) {
  const p = await pageAs(b, tok, { width: 1600, height: 1000 });
  try {
    await p.goto(APP + r, { waitUntil: "networkidle2", timeout: 25000 });
    await p.evaluate(() => new Promise((res) => {
      window.scrollTo(0, document.body.scrollHeight); setTimeout(() => { window.scrollTo(0, 0); res(); }, 700);
    }));
    await new Promise((r2) => setTimeout(r2, 600));
    const rows = await p.evaluate(() => [...document.querySelectorAll("img")].map((el) => {
      const rect = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        src: el.currentSrc || el.src, nw: el.naturalWidth, nh: el.naturalHeight,
        w: Math.round(rect.width), h: Math.round(rect.height), fit: cs.objectFit,
      };
    }).filter((x) => x.w > 0 && x.nw > 0));
    for (const row of rows) {
      const src = row.src.replace(/^https?:\/\/[^/]+/, "");
      if (/^data:|^blob:/.test(src)) continue;
      // effective sampled resolution under object-fit
      const ar = row.nw / row.nh;
      let usedW = row.w;
      if (row.fit === "cover") {
        const s = Math.max(row.w / row.nw, row.h / row.nh);
        usedW = row.nw * s; // painted width before crop
      } else if (row.fit === "contain") {
        const s = Math.min(row.w / row.nw, row.h / row.nh);
        usedW = row.nw * s;
      }
      const ratio = row.nw / Math.max(usedW, 1);
      const key = src;
      const prev = seen.get(key);
      if (!prev || ratio < prev.ratio) {
        seen.set(key, { src, nw: row.nw, nh: row.nh, box: `${row.w}x${row.h}`, fit: row.fit,
                        usedW: Math.round(usedW), ratio, route: r, ar: ar.toFixed(2) });
      }
    }
  } catch (e) { console.log("ERR", r, String(e).slice(0, 90)); }
  await p.close();
}
await b.close();

const all = [...seen.values()].sort((a, b2) => a.ratio - b2.ratio);
console.log("\n== WORST FIRST (ratio = natural px per painted CSS px; <1.5 soft on 2x, <1.0 blurry) ==");
for (const x of all) {
  console.log(`${x.ratio.toFixed(2)}x  nat ${x.nw}x${x.nh}  box ${x.box} ${x.fit}  painted@${x.usedW}  ${x.src}   [${x.route}]`);
}
