/** Phase 4: (a) do "dead" default tabs work when NOT active? (b) do Save/like toggles persist a reload? */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";

const tok = await seededMemberToken();
const b = await launch();
const txt = (p) => p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," ").trim());
const clickLabel = async (p, label, nth=0) => p.evaluate((label,nth)=>{
  const bs=[...(document.querySelector("#content")||document.body).querySelectorAll("button")]
    .filter(x=>((x.innerText||x.getAttribute("aria-label")||"").trim().replace(/\s+/g," "))===label && x.getBoundingClientRect().width>0);
  if(!bs[nth]) return "NOT FOUND";
  bs[nth].scrollIntoView({block:"center"}); bs[nth].click(); return "clicked";
}, label, nth);

console.log("=== (a) default tabs: does clicking them RESTORE after a sibling tab? ===");
const TABS = [
  ["/app/wallet","All","Money in"],
  ["/app/programs","Keep going","Explore"],
  ["/app/family","Childcare near you","Worth knowing"],
  ["/app/notifications","Your day","One at a time"],
  ["/app/stories","Women near you","Groups"],
  ["/app/profile","Overview","Skills"],
  ["/app/market","Everything","Food"],
  ["/app/mentors","Find a mentor","My sessions"],
  ["/app/opportunities","Opportunities","Freelance"],
  ["/app/circles","All Discussions 45","Savings"],
];
for (const [route, dead, other] of TABS) {
  const p = await pageAs(b, tok, {width:430,height:900});
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
  const t0 = await txt(p);
  const c1 = await clickLabel(p, other); await new Promise(r=>setTimeout(r,1200));
  const t1 = await txt(p);
  const c2 = await clickLabel(p, dead); await new Promise(r=>setTimeout(r,1200));
  const t2 = await txt(p);
  const verdict = (t1!==t0 && t2===t0) ? "OK (restores default)" : (t2===t1 ? "BROKEN: clicking it did nothing after sibling" : "changed but did not restore default");
  console.log(`  ${route.padEnd(20)} "${dead}" via "${other}" (${c1}/${c2}) → ${verdict}   [${t0.length}/${t1.length}/${t2.length}]`);
  await p.close();
}

console.log("\n=== (b) does a Save / like survive a reload? ===");
const SAVES = [
  ["/app/market","Save",0],
  ["/app/opportunities","Save",0],
  ["/app/circles","Save",0],
];
for (const [route,label,nth] of SAVES) {
  const p = await pageAs(b, tok, {width:430,height:900});
  const net=[]; p.on("response",r=>{const u=r.url(); if(/\/api\/v1\//.test(u)&&r.request().method()!=="GET") net.push(r.request().method()+" "+u.replace(/^https?:\/\/[^/]+\/api\/v1/,""));});
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
  const before = await txt(p);
  const st0 = await p.evaluate((label,nth)=>{const bs=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()===label&&x.getBoundingClientRect().width>0);
    const e=bs[nth]; return e?{ap:e.getAttribute("aria-pressed"),t:e.innerText.trim(),cls:String(e.className).slice(0,80)}:null;},label,nth);
  net.length=0;
  await clickLabel(p,label,nth); await new Promise(r=>setTimeout(r,1500));
  const st1 = await p.evaluate((label,nth)=>{const bs=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()===label||(x.innerText||"").trim()==="Saved");
    const e=bs[nth]; return e?{ap:e.getAttribute("aria-pressed"),t:e.innerText.trim(),cls:String(e.className).slice(0,80)}:null;},label,nth);
  const posted = [...new Set(net)];
  await p.reload({waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
  const st2 = await p.evaluate((label,nth)=>{const bs=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()===label||(x.innerText||"").trim()==="Saved");
    const e=bs[nth]; return e?{ap:e.getAttribute("aria-pressed"),t:e.innerText.trim()}:null;},label,nth);
  console.log(`  ${route.padEnd(20)} "${label}" before=${JSON.stringify(st0&&{ap:st0.ap,t:st0.t})} afterClick=${JSON.stringify(st1&&{ap:st1.ap,t:st1.t})} afterReload=${JSON.stringify(st2)}`);
  console.log(`      writes fired: ${posted.length?posted.join(", "):"NONE"}  → ${posted.length?"":"nothing sent to the server; "}${JSON.stringify(st1)===JSON.stringify(st2)?"state survived reload":"STATE LOST ON RELOAD"}`);
  await p.close();
}
await b.close();
