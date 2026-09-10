import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 1440, height: 900 });
await p.goto(APP + "/app/programs", { waitUntil: "networkidle2", timeout: 120000 });
await new Promise(r => setTimeout(r, 2500));
console.log(JSON.stringify(await p.evaluate(() => {
  const main = document.getElementById("content");
  const tabs = [...document.querySelectorAll('[role="tablist"]')].map((t) => {
    const cs = getComputedStyle(t);
    return { cls: t.className.slice(0, 40), display: cs.display, w: Math.round(t.getBoundingClientRect().width) };
  });
  const h1 = document.querySelector("#content h1");
  const sizes = [...main.querySelectorAll("*")].filter(e => !e.children.length && (e.textContent||"").trim().length > 2)
    .map(e => parseFloat(getComputedStyle(e).fontSize)).sort((a,b)=>a-b);
  return { tabs, h1: h1 && { t: h1.textContent, size: getComputedStyle(h1).fontSize, weight: getComputedStyle(h1).fontWeight },
           smallestText: sizes.slice(0,5), n: sizes.length,
           deckCols: getComputedStyle(document.querySelector(".ux-deck") || document.body).gridTemplateColumns.slice(0,60) };
}), null, 1));
await p.close(); await b.close();
