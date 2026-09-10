import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const out = process.env.OUT || "/tmp/shots";
const routes = (process.env.ROUTES || "/app/circles").split(",");
const tok = await seededMemberToken();
const b = await launch();
for (const r of routes) {
  const p = await pageAs(b, tok, { width: 1600, height: 1100 });
  try {
    await p.goto(APP + r, { waitUntil: "domcontentloaded", timeout: 180000 });
    await new Promise((z) => setTimeout(z, 5000));
    const rows = await p.evaluate(() => [...document.querySelectorAll("img")].map((el) => {
      const q = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      return { src: (el.currentSrc || el.src).replace(/^https?:\/\/[^/]+/, ""), nw: el.naturalWidth,
               nh: el.naturalHeight, w: Math.round(q.width), h: Math.round(q.height), fit: cs.objectFit };
    }).filter((x) => x.w > 2 && /ux\/art/.test(x.src)));
    for (const x of rows) {
      let painted = x.w;
      if (x.fit === "cover") painted = x.nw * Math.max(x.w / x.nw, x.h / x.nh);
      if (x.fit === "contain") painted = x.nw * Math.min(x.w / x.nw, x.h / x.nh);
      console.log(`  ${(x.nw / painted).toFixed(2)}x  nat ${x.nw}x${x.nh}  box ${x.w}x${x.h} ${x.fit}  painted@${Math.round(painted)}  ${x.src}`);
    }
    await p.screenshot({ path: `${out}/${r.replace(/\W+/g, "_")}.png` });
    console.log("shot", r);
  } catch (e) { console.log("ERR", r, String(e).slice(0, 80)); }
  await p.close();
}
await b.close();
