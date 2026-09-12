/** Phase 1: render + network + console for the 16 priority screens. */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
import fs from "fs";

const SCREENS = ["/app","/app/wallet","/app/programs","/app/mentors","/app/opportunities",
  "/app/circles","/app/sakhi","/app/stories","/app/profile","/app/journey","/app/collect",
  "/app/documents","/app/explore","/app/family","/app/market","/app/notifications"];

const tok = await seededMemberToken();
if (!tok) { console.error("NO TOKEN"); process.exit(1); }
const b = await launch();
const report = [];

for (const route of SCREENS) {
  const p = await pageAs(b, tok, { width: 430, height: 900 });
  const net = [], cons = [], failed = [];
  p.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") cons.push(`[${m.type()}] ${m.text().slice(0,300)}`); });
  p.on("pageerror", (e) => cons.push(`[pageerror] ${String(e).slice(0,300)}`));
  p.on("requestfailed", (r) => failed.push(`${r.url().slice(0,160)} :: ${r.failure()?.errorText}`));
  p.on("response", async (r) => {
    const u = r.url();
    if (/\/api\/v1\//.test(u) || r.status() >= 400) net.push({ u: u.slice(0,180), s: r.status(), m: r.request().method() });
  });
  let navErr = null;
  try { await p.goto(APP + route, { waitUntil: "networkidle2", timeout: 90000 }); }
  catch (e) { navErr = String(e).slice(0,200); }
  await new Promise(r => setTimeout(r, 2500));

  const dom = await p.evaluate(() => {
    const portal = document.querySelector("nextjs-portal");
    let overlayText = "";
    if (portal && portal.shadowRoot) overlayText = (portal.shadowRoot.textContent||"").trim().slice(0,300);
    const c = document.querySelector("#content");
    const txt = (c ? c.innerText : document.body.innerText || "").trim();
    const imgs = [...document.querySelectorAll("img")].map(i => i.currentSrc || i.src).filter(Boolean);
    const badImgs = imgs.filter(s => /localhost:8020|127\.0\.0\.1:8020|localhost:8000/.test(s));
    const brokenImgs = [...document.querySelectorAll("img")].filter(i => i.complete && i.naturalWidth === 0).map(i=>i.src.slice(0,140));
    return {
      hasPortal: !!portal, overlayText,
      hasContent: !!c, textLen: txt.length, head: txt.slice(0,180).replace(/\n/g," | "),
      links: [...(c||document.body).querySelectorAll("a")].map(a=>({href:a.getAttribute("href")||"", label:(a.innerText||a.getAttribute("aria-label")||"").trim().replace(/\s+/g," ").slice(0,44)})),
      buttons: [...(c||document.body).querySelectorAll("button")].map((x,i)=>({i, label:(x.innerText||x.getAttribute("aria-label")||"").trim().replace(/\s+/g," ").slice(0,44), type:x.getAttribute("type")||"", disabled:x.disabled})),
      inputs: [...(c||document.body).querySelectorAll("input,textarea,select")].length,
      forms: [...(c||document.body).querySelectorAll("form")].length,
      badImgs, brokenImgs,
    };
  }).catch(e => ({ err: String(e) }));

  report.push({ route, navErr, net, cons, failed, dom });
  console.log(`\n=== ${route} ===`);
  console.log(`  render: portal=${dom.hasPortal} content=${dom.hasContent} textLen=${dom.textLen}`);
  if (dom.hasPortal) console.log(`  OVERLAY: ${dom.overlayText}`);
  console.log(`  head: ${dom.head}`);
  console.log(`  links=${dom.links?.length} buttons=${dom.buttons?.length} inputs=${dom.inputs} forms=${dom.forms}`);
  const api = net.filter(n=>/\/api\/v1\//.test(n.u));
  console.log(`  API calls: ${api.length}${api.length===0?"  <<< ZERO API CALLS":""}`);
  api.forEach(n=>console.log(`     ${n.s} ${n.m} ${n.u.replace(/^http:\/\/localhost:8020\/api\/v1/,"")}`));
  const bad = net.filter(n=>n.s>=400);
  bad.forEach(n=>console.log(`     !! ${n.s} ${n.m} ${n.u}`));
  if (dom.badImgs?.length) console.log(`  BAD IMG HOSTS: ${[...new Set(dom.badImgs)].slice(0,5).join(", ")}`);
  if (dom.brokenImgs?.length) console.log(`  BROKEN IMGS: ${[...new Set(dom.brokenImgs)].slice(0,5).join(", ")}`);
  [...new Set(cons)].slice(0,8).forEach(c=>console.log(`  CONSOLE ${c}`));
  failed.slice(0,6).forEach(f=>console.log(`  REQFAIL ${f}`));
  await p.close();
}
fs.writeFileSync("/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/fa1.json", JSON.stringify(report,null,1));
await b.close();
