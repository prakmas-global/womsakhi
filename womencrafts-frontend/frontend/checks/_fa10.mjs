import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
const open = async (route,w=430) => { const p = await pageAs(b,tok,{width:w,height:900});
  p.__net=[]; p.__cons=[];
  p.on("console",m=>{if(m.type()==="error")p.__cons.push(m.text().slice(0,220));});
  p.on("pageerror",e=>p.__cons.push("[pageerror] "+String(e).slice(0,220)));
  p.on("response",r=>{const u=r.url(); if(/\/api\/v1\//.test(u)) p.__net.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+\/api\/v1/,"")}`);});
  await p.evaluateOnNewDocument(()=>{ window.__fx=[];
    try{navigator.clipboard.writeText=t=>{window.__fx.push("copy:"+String(t));return Promise.resolve();};}catch{}
    const ic=HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click=function(){ if(this.type==="file") window.__fx.push("file picker opened"); return ic.call(this); };
    if(navigator.mediaDevices){const g=navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia=function(c){window.__fx.push("getUserMedia");return g.call(this,c);} }
  });
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200)); return p; };
const T = p=>p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," ").trim());

console.log("=== does the circle page consume ?ask= ? ===");
{ const p = await open("/app/circles/6a7f5463c928867bcc30440e?ask=AUDITPING12345");
  const t = await T(p);
  const inputs = await p.evaluate(()=>[...document.querySelectorAll("input,textarea")].map(i=>({ph:i.placeholder||"",v:i.value||"",vis:i.getBoundingClientRect().width>0})));
  console.log("  text contains AUDITPING12345:", t.includes("AUDITPING12345"));
  console.log("  inputs:", JSON.stringify(inputs));
  await p.close(); }

console.log("\n=== sakhi attach/mic AFTER a conversation exists ===");
{ const p = await open("/app/sakhi");
  await p.evaluate(()=>{const t=[...document.querySelectorAll("textarea")].find(x=>x.getBoundingClientRect().width>0); t.focus();});
  await p.keyboard.type("hello",{delay:20}); await new Promise(r=>setTimeout(r,500));
  await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].filter(x=>/^Send$/i.test((x.innerText||x.getAttribute("aria-label")||"").trim())).find(x=>!x.disabled&&x.getBoundingClientRect().width>0); if(e)e.click();});
  await new Promise(r=>setTimeout(r,8000));
  for (const lbl of ["Attach a file","Speak instead of typing"]) {
    await p.evaluate(()=>{window.__fx=[];});
    const t0 = await T(p);
    const r = await p.evaluate((lbl)=>{const e=[...document.querySelectorAll("button")].filter(x=>new RegExp(lbl,"i").test(x.getAttribute("aria-label")||x.getAttribute("title")||"")).find(x=>x.getBoundingClientRect().width>0);
      if(!e) return "not found / invisible"; e.scrollIntoView({block:"center"}); e.click(); return "clicked";},lbl);
    await new Promise(x=>setTimeout(x,1800));
    console.log(`  "${lbl}" → ${r}; fx=${JSON.stringify(await p.evaluate(()=>window.__fx))}; text ${t0.length}→${(await T(p)).length}; cons=${[...new Set(p.__cons)].slice(-1).join("")}`);
  }
  await p.close(); }

console.log("\n=== Home: the unlabelled button inside #content ===");
{ const p = await open("/app");
  const info = await p.evaluate(()=>{const c=document.querySelector("#content");
    return [...c.querySelectorAll("button")].map(e=>{const r=e.getBoundingClientRect();
      return {label:(e.innerText||"").trim(), aria:e.getAttribute("aria-label"), title:e.getAttribute("title"),
        w:Math.round(r.width),h:Math.round(r.height),x:Math.round(r.x),y:Math.round(r.y),
        cls:String(e.className).slice(0,90), html:e.outerHTML.slice(0,200),
        parent:(e.parentElement?e.parentElement.innerText:"").replace(/\s+/g," ").slice(0,80)};});});
  console.log(JSON.stringify(info,null,1));
  const t0 = await T(p); p.__net.length=0;
  await p.evaluate(()=>{const c=document.querySelector("#content"); const e=[...c.querySelectorAll("button")][0]; e.scrollIntoView({block:"center"}); window.__fx=[]; e.click();});
  await new Promise(r=>setTimeout(r,1800));
  console.log("  after click: url",p.url().replace(APP,""),"text",t0.length,"→",(await T(p)).length,"net",[...new Set(p.__net)].join(",")||"none","fx",JSON.stringify(await p.evaluate(()=>window.__fx)));
  await p.close(); }
await b.close();
