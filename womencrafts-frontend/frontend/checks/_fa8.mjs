import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
const open = async (route,w=430) => { const p = await pageAs(b,tok,{width:w,height:900});
  p.__net=[]; p.__cons=[];
  p.on("console",m=>{if(m.type()==="error")p.__cons.push(m.text().slice(0,200));});
  p.on("pageerror",e=>p.__cons.push("[pageerror] "+String(e).slice(0,200)));
  p.on("response",r=>{const u=r.url(); if(/\/api\/v1\//.test(u)) p.__net.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+\/api\/v1/,"")}`);});
  await p.evaluateOnNewDocument(()=>{window.__fx=[];try{navigator.clipboard.writeText=t=>{window.__fx.push(String(t));return Promise.resolve();};}catch{}});
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200)); return p; };
const T = p=>p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," ").trim());

console.log("=== opportunities SORT select, no search active ===");
{ const p = await open("/app/opportunities");
  const t0 = await T(p);
  const order0 = await p.evaluate(()=>[...document.querySelectorAll("a[href^='/app/opportunities/']")].map(a=>a.getAttribute("href")).slice(0,8));
  for (const v of ["new","pay"]) {
    const opts = await p.evaluate(()=>[...document.querySelector("select").options].map(o=>({v:o.value,t:o.text})));
    await p.evaluate((v)=>{const s=document.querySelector("select");
      const d=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set; d.call(s,v);
      s.dispatchEvent(new Event("change",{bubbles:true}));},opts.find(o=>o.v!=="match"&&(v==="new"?/new/i.test(o.t):/pay/i.test(o.t)))?.v||opts[1].v);
    await new Promise(r=>setTimeout(r,1500));
    const t1 = await T(p);
    const order1 = await p.evaluate(()=>[...document.querySelectorAll("a[href^='/app/opportunities/']")].map(a=>a.getAttribute("href")).slice(0,8));
    console.log(`  set to ${v}: value=${await p.evaluate(()=>document.querySelector("select").value)} text ${t0.length}→${t1.length} ${t0===t1?"IDENTICAL":"changed"}  order ${JSON.stringify(order0)===JSON.stringify(order1)?"UNCHANGED":"re-sorted"}`);
  }
  console.log("  options:",JSON.stringify(await p.evaluate(()=>[...document.querySelector("select").options].map(o=>o.value+":"+o.text))));
  await p.close(); }

console.log("\n=== circles composer 'Ask the circle…' ===");
{ const p = await open("/app/circles");
  const info = await p.evaluate(()=>{const i=[...document.querySelectorAll("input")].find(x=>/Ask the circle/i.test(x.placeholder||""));
    if(!i) return null; const r=i.getBoundingClientRect();
    let f=i.closest("form"); let a=i.closest("a");
    return {ro:i.readOnly,dis:i.disabled,inForm:!!f,inLink:!!a,linkHref:a?a.getAttribute("href"):null,w:r.width}; });
  console.log("  input:",JSON.stringify(info));
  if (info) { await p.evaluate(()=>{const i=[...document.querySelectorAll("input")].find(x=>/Ask the circle/i.test(x.placeholder||"")); i.focus(); i.scrollIntoView({block:"center"});});
    await p.keyboard.type("Audit typing test",{delay:30}); await new Promise(r=>setTimeout(r,800));
    const v = await p.evaluate(()=>{const i=[...document.querySelectorAll("input")].find(x=>/Ask the circle/i.test(x.placeholder||"")); return i?i.value:"(input gone — navigated)";});
    console.log("  after typing, value =",JSON.stringify(v),"url =",p.url().replace(APP,""));
  }
  await p.close(); }

console.log("\n=== collect: make a payment link ===");
{ const p = await open("/app/collect");
  const st = ()=>p.evaluate(()=>({bs:[...document.querySelectorAll("button")].map(x=>({t:(x.innerText||"").trim().slice(0,26),d:x.disabled})),
    ins:[...document.querySelectorAll("input")].map(i=>({ph:i.placeholder,v:i.value}))}));
  console.log("  before:",JSON.stringify(await st()));
  await p.evaluate(()=>{const ins=[...document.querySelectorAll("input")];
    const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(el,v); el.dispatchEvent(new Event("input",{bubbles:true}));};
    set(ins[0],"750"); set(ins[1],"Kurta stitching");});
  await new Promise(r=>setTimeout(r,1000));
  console.log("  after typing:",JSON.stringify(await st()));
  p.__net.length=0;
  const clicked = await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/Make the link/i.test(x.innerText||"")); if(!e) return "gone"; if(e.disabled) return "STILL DISABLED"; window.__fx=[]; e.click(); return "clicked";});
  await new Promise(r=>setTimeout(r,2500));
  console.log(`  Make the link → ${clicked}; net=${[...new Set(p.__net)].join(" | ")||"NONE"}`);
  console.log("  screen:",(await T(p)).slice(0,260));
  console.log("  fx:",JSON.stringify(await p.evaluate(()=>window.__fx||[])));
  await p.reload({waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
  console.log("  after reload, 'Kurta stitching' present:",(await T(p)).includes("Kurta stitching"));
  await p.close(); }

console.log("\n=== sakhi send ===");
{ const p = await open("/app/sakhi");
  await p.evaluate(()=>{const t=[...document.querySelectorAll("textarea")].find(x=>x.getBoundingClientRect().width>0); if(t){t.focus();}});
  await p.keyboard.type("What did I earn this month?",{delay:20});
  await new Promise(r=>setTimeout(r,700));
  const s1 = await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/^Send$/i.test((x.innerText||x.getAttribute("aria-label")||"").trim())); return e?{d:e.disabled,vis:e.getBoundingClientRect().width>0}:null;});
  console.log("  Send:",JSON.stringify(s1));
  p.__net.length=0;
  await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].filter(x=>/^Send$/i.test((x.innerText||x.getAttribute("aria-label")||"").trim())).find(x=>!x.disabled&&x.getBoundingClientRect().width>0); if(e)e.click();});
  await new Promise(r=>setTimeout(r,9000));
  console.log("  net:",[...new Set(p.__net)].join(" | ")||"NONE");
  console.log("  screen:",(await T(p)).slice(0,300));
  console.log("  cons:",[...new Set(p.__cons)].slice(0,3).join(" | ")||"clean");
  // attach + mic
  const att = await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/Attach a file/i.test(x.getAttribute("aria-label")||x.innerText||"")); return e?{vis:e.getBoundingClientRect().width>0,d:e.disabled}:null;});
  const mic = await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/Speak instead/i.test(x.getAttribute("aria-label")||x.innerText||"")); return e?{vis:e.getBoundingClientRect().width>0,d:e.disabled}:null;});
  console.log("  Attach a file:",JSON.stringify(att)," Speak instead of typing:",JSON.stringify(mic));
  // click them now that a conversation exists
  for (const lbl of ["Attach a file","Speak instead of typing","New conversation"]) {
    const t0=await T(p); p.__net.length=0;
    const r = await p.evaluate((lbl)=>{const e=[...document.querySelectorAll("button")].find(x=>new RegExp(lbl,"i").test(x.getAttribute("aria-label")||x.innerText||""));
      if(!e) return "not found"; if(e.getBoundingClientRect().width<1) return "invisible"; window.__fx=[]; e.click(); return "clicked";},lbl);
    await new Promise(x=>setTimeout(x,1600));
    const t1=await T(p);
    console.log(`  "${lbl}" → ${r}; text ${t0.length}→${t1.length} ${t0===t1?"NO CHANGE":"changed"}; fx=${JSON.stringify(await p.evaluate(()=>window.__fx||[]))}; net=${[...new Set(p.__net)].join(",")||"none"}`);
  }
  await p.close(); }
await b.close();
