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
    window.__SR = !!(window.SpeechRecognition||window.webkitSpeechRecognition);
    if(navigator.mediaDevices){const g=navigator.mediaDevices.getUserMedia; navigator.mediaDevices.getUserMedia=function(c){window.__fx.push("getUserMedia");return g.call(this,c);} }
  });
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200)); return p; };
const T = p=>p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," ").trim());

console.log("=== collect: does 'Make the link' create anything real? ===");
{ const p = await open("/app/collect");
  const t0 = await T(p);
  await p.evaluate(()=>{const ins=[...document.querySelectorAll("input")];
    const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,v); e.dispatchEvent(new Event("input",{bubbles:true}));};
    set(ins[0],"750"); set(ins[1],"Kurta stitching");});
  await new Promise(r=>setTimeout(r,800)); p.__net.length=0;
  await p.evaluate(()=>{[...document.querySelectorAll("button")].find(x=>/Make the link/i.test(x.innerText||"")).click();});
  await new Promise(r=>setTimeout(r,2000));
  const t1 = await T(p);
  console.log(`  row added: ${t1.includes("Kurta stitching")}  net: ${[...new Set(p.__net)].join(",")||"NONE"}`);
  const ref = (t1.match(/PR-\d+/g)||[]).slice(0,3);
  console.log(`  refs shown: ${ref.join(", ")}`);
  await p.reload({waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
  console.log(`  after reload, "Kurta stitching" present: ${(await T(p)).includes("Kurta stitching")}`);
  await p.close(); }

console.log("\n=== sakhi: attach + mic, properly instrumented ===");
{ const p = await open("/app/sakhi");
  console.log("  SpeechRecognition available in this browser:", await p.evaluate(()=>window.__SR));
  for (const lbl of ["Attach a file","Speak instead of typing"]) {
    await p.evaluate(()=>{window.__fx=[];});
    const t0 = await T(p);
    const r = await p.evaluate((lbl)=>{const e=[...document.querySelectorAll("button")].find(x=>new RegExp(lbl,"i").test(x.getAttribute("aria-label")||x.getAttribute("title")||""));
      if(!e) return "not found"; const bb=e.getBoundingClientRect(); if(bb.width<1) return "invisible"; e.scrollIntoView({block:"center"}); e.click(); return "clicked"; },lbl);
    await new Promise(x=>setTimeout(x,1500));
    console.log(`  "${lbl}" → ${r}; fx=${JSON.stringify(await p.evaluate(()=>window.__fx))}; text ${t0.length}→${(await T(p)).length}`);
  }
  await p.close(); }

console.log("\n=== circles: post a real message ===");
{ const p = await open("/app/circles");
  const msg = `Audit ping ${Date.now()%100000}`;
  await p.evaluate((m)=>{const i=[...document.querySelectorAll("input")].find(x=>/Ask the circle/i.test(x.placeholder||""));
    i.scrollIntoView({block:"center"}); i.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(i,m); i.dispatchEvent(new Event("input",{bubbles:true}));},msg);
  await new Promise(r=>setTimeout(r,600)); p.__net.length=0;
  await p.keyboard.press("Enter"); await new Promise(r=>setTimeout(r,3000));
  console.log(`  url now: ${p.url().replace(APP,"")}`);
  console.log(`  net: ${[...new Set(p.__net)].join(" | ")||"NONE"}`);
  const t = await T(p);
  console.log(`  message visible after submit: ${t.includes(msg)}`);
  await p.close(); }

console.log("\n=== opportunities: is 'Newest first' meaningful in the data? ===");
{ const p = await open("/app/opportunities");
  const posted = await p.evaluate(async()=>{const r=await fetch("/api/nope").catch(()=>null); return null;});
  await p.close(); }

console.log("\n=== home: the one button ===");
{ const p = await open("/app");
  const info = await p.evaluate(()=>{const bs=[...document.querySelectorAll("button")].filter(x=>/Put this aside/i.test(x.innerText||""));
    return bs.map(e=>{const r=e.getBoundingClientRect(); const cs=getComputedStyle(e);
      let hidden=null; for(let n=e;n&&n!==document.body;n=n.parentElement){const c=getComputedStyle(n); if(c.display==="none"||c.visibility==="hidden"||c.opacity==="0"){hidden=`${n.tagName}.${String(n.className).slice(0,40)} ${c.display}/${c.visibility}/${c.opacity}`;break;}}
      return {w:r.width,h:r.height,display:cs.display,vis:cs.visibility,op:cs.opacity,hiddenAncestor:hidden,parentText:(e.parentElement?e.parentElement.innerText:"").replace(/\s+/g," ").slice(0,90)};});});
  console.log("  ",JSON.stringify(info,null,1));
  // scoped to #content only?
  const inContent = await p.evaluate(()=>{const c=document.querySelector("#content"); return [...c.querySelectorAll("button")].map(x=>(x.innerText||"").trim().slice(0,30));});
  console.log("  buttons inside #content:",JSON.stringify(inContent));
  const allButtons = await p.evaluate(()=>[...document.querySelectorAll("button")].map(x=>({t:(x.innerText||x.getAttribute("aria-label")||"").trim().slice(0,30),vis:x.getBoundingClientRect().width>0})));
  console.log("  ALL buttons on the page (incl. shell):",JSON.stringify(allButtons));
  await p.close(); }
await b.close();
