/** Phase 6: inputs inventory + a few targeted checks. */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
const open = async (route, w=430) => {
  const p = await pageAs(b, tok, {width:w,height:900});
  p.__cons=[]; p.__net=[];
  p.on("console",m=>{if(m.type()==="error")p.__cons.push(m.text().slice(0,240));});
  p.on("pageerror",e=>p.__cons.push("[pageerror] "+String(e).slice(0,240)));
  p.on("response",r=>{const u=r.url(); if(/\/api\/v1\//.test(u)||r.status()>=400) p.__net.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+/,"")}`);});
  await p.evaluateOnNewDocument(()=>{ window.__fx=[]; try{navigator.clipboard.writeText=t=>{window.__fx.push(String(t));return Promise.resolve();};}catch{} });
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200));
  return p;
};

console.log("=== (e) inputs inventory ===");
for (const route of ["/app","/app/wallet","/app/programs","/app/mentors","/app/opportunities","/app/circles","/app/sakhi","/app/stories","/app/profile","/app/journey","/app/collect","/app/documents","/app/explore","/app/family","/app/market","/app/notifications"]) {
  const p = await open(route);
  const ins = await p.evaluate(()=>[...(document.querySelector("#content")||document.body).querySelectorAll("input,textarea,select")]
    .map(e=>({tag:e.tagName.toLowerCase(),type:e.type||"",ph:e.placeholder||"",name:e.name||"",aria:e.getAttribute("aria-label")||"",
      vis:e.getBoundingClientRect().width>0, ro:e.readOnly||false, dis:e.disabled})));
  if (ins.length) console.log(`  ${route}: ${ins.map(i=>`${i.tag}/${i.type}${i.vis?"":"(hidden)"}${i.ro?"(readonly)":""} "${i.ph||i.aria||i.name}"`).join(" ; ")}`);
  await p.close();
}

console.log("\n=== (a) /app/assess truth ===");
{ const p = await open("/app/assess");
  const d = await p.evaluate(()=>{const c=document.querySelector("#content");return {len:(c?c.innerText:"").length, txt:(c?c.innerText:"").replace(/\s+/g," ").slice(0,300)};});
  console.log("  ",d.txt); console.log("   net:",[...new Set(p.__net)].join(" | ")); console.log("   cons:",[...new Set(p.__cons)].slice(0,3).join(" | "));
  await p.close(); }

console.log("\n=== (b) circle detail page — the 404 ===");
{ const p = await open("/app/circles/6a7f5463c928867bcc30440e");
  console.log("   net:",[...new Set(p.__net)].join("\n        "));
  const imgs = await p.evaluate(()=>[...document.querySelectorAll("img")].filter(i=>i.complete&&i.naturalWidth===0).map(i=>i.src));
  console.log("   broken imgs:",[...new Set(imgs)].slice(0,5).join(" | ")||"none");
  console.log("   cons:",[...new Set(p.__cons)].slice(0,4).join("\n         "));
  await p.close(); }

console.log("\n=== (c) circles Latest / Following ===");
{ const p = await open("/app/circles");
  const T = ()=>p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," "));
  const click = (l)=>p.evaluate((l)=>{const e=[...document.querySelectorAll("button")].find(x=>(x.innerText||"").trim()===l); if(!e)return "gone"; e.scrollIntoView({block:"center"}); e.click(); return "ok";},l);
  const t0=await T();
  await click("Following"); await new Promise(r=>setTimeout(r,1200)); const t1=await T();
  await click("Latest");    await new Promise(r=>setTimeout(r,1200)); const t2=await T();
  console.log(`   Latest(default)=${t0.length}  Following=${t1.length} (${t1===t0?"IDENTICAL — filter does nothing":"changed"})  back to Latest=${t2.length} (${t2===t0?"restores":"DID NOT RESTORE"})`);
  await p.close(); }

console.log("\n=== (d) shop Share targeting ===");
{ const p = await open("/app/documents",1400);
  const n = await p.evaluate(()=>[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="Share").length);
  for (let i=0;i<n;i++){
    const title = await p.evaluate((i)=>{const s=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="Share");
      let c=s[i]; for(let k=0;k<9&&c;k++){c=c.parentElement; if(c&&c.innerText.length>70) break;}
      window.__fx=[]; s[i].scrollIntoView({block:"center"}); s[i].click(); return (c?c.innerText:"").replace(/\s+/g," ").slice(0,50);},i);
    await new Promise(r=>setTimeout(r,700));
    const fx = await p.evaluate(()=>window.__fx);
    console.log(`   Share on "${title}" → ${fx[0]}`);
  }
  await p.close(); }
await b.close();
