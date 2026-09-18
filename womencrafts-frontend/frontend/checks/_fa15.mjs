import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
const p = await pageAs(b, tok, {width:430,height:900});
const net=[]; p.on("response",r=>{const u=r.url(); if(/\/api\/v1\//.test(u)) net.push(r.status()+" "+r.request().method()+" "+u.replace(/^https?:\/\/[^/]+\/api\/v1/,""));});
await p.goto(APP+"/app/market/i1",{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200));
const T=()=>p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," "));
for (const lbl of ["Book her","Ask her something"]) {
  net.length=0; const t0=await T();
  await p.evaluate((l)=>{const e=[...document.querySelectorAll("button")].find(x=>(x.innerText||"").trim()===l); e.scrollIntoView({block:"center"}); e.click();},lbl);
  await new Promise(r=>setTimeout(r,1800));
  const t1=await T();
  console.log(`"${lbl}": net=${[...new Set(net)].join(",")||"NONE"}`);
  console.log(`   new text: ${t1.replace(t0.slice(0,60),"").slice(0,180)}`);
  console.log(`   full after: ${t1.slice(0,230)}`);
}
await p.reload({waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
console.log("after reload:",(await T()).slice(0,200));
await p.close(); await b.close();
