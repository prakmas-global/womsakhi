import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 1586, height: 992 });
await p.goto(APP + "/app/learn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => /Learn\. Grow/.test(document.querySelector("#content")?.innerText ?? ""), { timeout: 90000 });
await new Promise((z) => setTimeout(z, 2000));
for (const [w, h] of [[1586, 992], [1440, 900], [1366, 768]]) {
  await p.setViewport({ width: w, height: h });
  await new Promise((z) => setTimeout(z, 900));
  const m = await p.evaluate(() => {
    const R = (el) => el ? { w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
    const board = document.querySelector("#content .ux-fitboard");
    const hero = board.children[0];
    const mid = board.children[1];
    const how = board.children[2];
    const grid = document.querySelector("#content .grid");
    const cards = [...grid.children];
    const img = hero.querySelector("img");
    const first = cards[0];
    const kids = [...first.children].map((c) => ({ cls: c.className.slice(0, 40), ...R(c) }));
    const cs = getComputedStyle(board);
    return {
      sc: (() => { const s = document.getElementById("ux-scroll"); return { h: s.clientHeight, sh: s.scrollHeight }; })(),
      board: R(board), hero: R(hero), mid: R(mid), how: R(how),
      heroImg: { ...R(img), nat: img.naturalWidth + "x" + img.naturalHeight },
      grid: R(grid), card: R(first), cardKids: kids,
      journey: R(mid.children[1]),
      vars: ["--fb-gap", "--fb-pad", "--fb-hero-y", "--fb-clamp", "--fb-lines"].map((k) => k + "=" + cs.getPropertyValue(k)).join(" "),
      gridAlign: getComputedStyle(grid).alignContent,
    };
  });
  console.log(`\n== ${w}x${h}`, m.vars);
  console.log("  scroll", JSON.stringify(m.sc), "board", JSON.stringify(m.board));
  console.log("  hero", JSON.stringify(m.hero), "img", JSON.stringify(m.heroImg));
  console.log("  mid", JSON.stringify(m.mid), "grid", JSON.stringify(m.grid), "align", m.gridAlign, "journey", JSON.stringify(m.journey));
  console.log("  how", JSON.stringify(m.how));
  console.log("  card", JSON.stringify(m.card));
  for (const k of m.cardKids) console.log("     ", k.h, k.cls);
}
await b.close();
