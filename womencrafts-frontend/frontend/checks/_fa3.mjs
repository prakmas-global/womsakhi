/** Phase 3: every link destination found on the 16 screens — does it render? */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
import fs from "fs";
const SP="/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/";
const fa1 = JSON.parse(fs.readFileSync(SP+"fa1.json","utf8"));
const map = new Map(); // href -> [{screen,label}]
for (const s of fa1) for (const l of s.dom.links||[]) {
  const h = l.href;
  if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:") || /^https?:/.test(h)) continue;
  if (!map.has(h)) map.set(h, []);
  map.get(h).push({screen:s.route, label:l.label});
}
console.log(`unique internal hrefs: ${map.size}`);
const tok = await seededMemberToken();
const b = await launch();
const rows = [];
for (const [href, srcs] of map) {
  const p = await pageAs(b, tok, { width: 430, height: 900 });
  const cons=[], net=[];
  p.on("console", m=>{ if(m.type()==="error") cons.push(m.text().slice(0,200)); });
  p.on("pageerror", e=>cons.push("[pageerror] "+String(e).slice(0,200)));
  p.on("response", r=>{ const u=r.url(); if(/\/api\/v1\//.test(u)) net.push({s:r.status(),m:r.request().method(),u:u.replace(/^https?:\/\/[^/]+\/api\/v1/,"")}); });
  let navErr=null, status=null;
  try { const resp = await p.goto(APP+href,{waitUntil:"networkidle2",timeout:90000}); status = resp&&resp.status(); }
  catch(e){ navErr=String(e.message).slice(0,120); }
  await new Promise(r=>setTimeout(r,1600));
  const d = await p.evaluate(() => {
    const portal=document.querySelector("nextjs-portal");
    let overlay=null;
    if(portal&&portal.shadowRoot){
      const dlg=portal.shadowRoot.querySelector("[data-nextjs-dialog],#nextjs__container_errors_label,.nextjs-container-errors-header");
      const t=(portal.shadowRoot.textContent||"");
      if(dlg||/Unhandled Runtime Error|Build Error|Failed to compile|Runtime Error|Console Error/.test(t))
        overlay=(portal.shadowRoot.innerText||t).replace(/\s+/g," ").slice(0,220);
    }
    const c=document.querySelector("#content");
    const txt=((c?c.innerText:document.body.innerText)||"").replace(/\s+/g," ").trim();
    return { overlay, hasContent:!!c, len:txt.length, head:txt.slice(0,130),
      notFound:/This page has moved/.test(txt),
      screenError:/Something went wrong|could not be loaded|try again/i.test(txt.slice(0,400)),
      empty:/^(Nothing|No |You have no|Nothing here)/i.test(txt) || txt.length<120 };
  }).catch(e=>({err:String(e).slice(0,120)}));
  const bad=net.filter(n=>n.s>=400);
  let verdict="ok";
  if (navErr) verdict="NAV-ERROR";
  else if (d.overlay) verdict="ERROR-OVERLAY";
  else if (d.notFound) verdict="404-NOT-FOUND";
  else if (d.screenError) verdict="SCREEN-ERROR";
  else if (!d.hasContent) verdict="NO-#content";
  else if (d.len<120) verdict="NEARLY-EMPTY";
  else if (bad.length) verdict="ok(but "+bad.map(x=>x.s+" "+x.u).join(",")+")";
  rows.push({href,srcs,verdict,len:d.len,head:d.head,overlay:d.overlay,cons:[...new Set(cons)].slice(0,3),bad,api:net.length,navErr});
  console.log(`${verdict.padEnd(14)} ${href.padEnd(46)} len=${String(d.len).padEnd(5)} api=${net.length} :: ${d.head.slice(0,70)}`);
  if(d.overlay) console.log(`     OVERLAY: ${d.overlay}`);
  bad.forEach(x=>console.log(`     !! ${x.s} ${x.m} ${x.u}`));
  [...new Set(cons)].slice(0,3).forEach(c=>console.log(`     CON ${c}`));
  await p.close();
}
fs.writeFileSync(SP+"fa3.json",JSON.stringify(rows,null,1));
await b.close();
