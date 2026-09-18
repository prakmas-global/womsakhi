/** Phase 7: forms. */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
const open = async (route, w=430) => {
  const p = await pageAs(b, tok, {width:w,height:900});
  p.__cons=[]; p.__net=[];
  p.on("console",m=>{if(m.type()==="error")p.__cons.push(m.text().slice(0,200));});
  p.on("pageerror",e=>p.__cons.push("[pageerror] "+String(e).slice(0,200)));
  p.on("response",r=>{const u=r.url(); if(/\/api\/v1\//.test(u)) p.__net.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+\/api\/v1/,"")}`);});
  await p.evaluateOnNewDocument(()=>{window.__fx=[]; try{navigator.clipboard.writeText=t=>{window.__fx.push(String(t));return Promise.resolve();};}catch{}});
  await p.goto(APP+route,{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200));
  return p;
};
const T = p=>p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," ").trim());

console.log("=== opportunities search ===");
{ const p = await open("/app/opportunities");
  const t0 = await T(p);
  p.__net.length=0;
  await p.click('input[placeholder*="Search work"]');
  await p.type('input[placeholder*="Search work"]', "tailor", {delay:60});
  await new Promise(r=>setTimeout(r,1500)); const t1 = await T(p);
  await p.evaluate(()=>{const i=document.querySelector('input[placeholder*="Search work"]'); i.value=""; i.dispatchEvent(new Event("input",{bubbles:true}));});
  await p.type('input[placeholder*="Search work"]', "zzzzqqqq", {delay:50});
  await new Promise(r=>setTimeout(r,1500)); const t2 = await T(p);
  console.log(`  "tailor": ${t0.length}→${t1.length} ${t1===t0?"NO CHANGE (search inert)":"filtered"}`);
  console.log(`  "zzzzqqqq": →${t2.length} ${/no |nothing|found nothing|0 /i.test(t2.slice(0,240))?"shows an empty state":"ALSO "+(t2===t0?"unchanged":"changed")}  head="${t2.slice(0,110)}"`);
  console.log("  net:",[...new Set(p.__net)].join(" | ")||"none (client-side filter)");
  // the select
  const sel = await p.evaluate(()=>{const s=document.querySelector("select"); return s?{name:s.name,opts:[...s.options].map(o=>o.text).slice(0,8),val:s.value}:null;});
  console.log("  select:",JSON.stringify(sel));
  if (sel) { const t3a=await T(p);
    await p.evaluate(()=>{const s=document.querySelector("select"); s.selectedIndex=Math.min(1,s.options.length-1); s.dispatchEvent(new Event("change",{bubbles:true}));});
    await new Promise(r=>setTimeout(r,1400)); const t3b=await T(p);
    console.log(`  select change: ${t3a.length}→${t3b.length} ${t3a===t3b?"NO EFFECT":"content changed"}`); }
  await p.close(); }

console.log("\n=== circles composer ===");
{ const p = await open("/app/circles");
  const sel = 'input[placeholder*="Ask the circle"]';
  const before = await T(p);
  // empty submit
  p.__net.length=0;
  await p.click(sel); await p.keyboard.press("Enter"); await new Promise(r=>setTimeout(r,1200));
  const afterEmpty = await T(p);
  console.log(`  empty Enter: ${before.length}→${afterEmpty.length} net=${[...new Set(p.__net)].join(",")||"none"} ${afterEmpty===before?"(silent, nothing sent)":"(something changed)"}`);
  const msg = `Audit check ${Date.now()}`;
  p.__net.length=0;
  await p.type(sel, msg, {delay:25}); await p.keyboard.press("Enter");
  await new Promise(r=>setTimeout(r,2500));
  const afterMsg = await T(p);
  console.log(`  typed+Enter: net=${[...new Set(p.__net)].join(" | ")||"NONE"}  message on screen: ${afterMsg.includes(msg)}`);
  await p.reload({waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2200));
  const afterReload = await T(p);
  console.log(`  after reload, message present: ${afterReload.includes(msg)}`);
  await p.close(); }

console.log("\n=== collect: make a payment link ===");
{ const p = await open("/app/collect");
  const st = ()=>p.evaluate(()=>{const bs=[...document.querySelectorAll("button")].map(x=>({t:(x.innerText||"").trim().slice(0,30),d:x.disabled}));
    const ins=[...document.querySelectorAll("input")].map(i=>({ph:i.placeholder,v:i.value})); return {bs,ins};});
  console.log("  before:",JSON.stringify(await st()));
  await p.evaluate(()=>{const ins=[...document.querySelectorAll("input")];
    const set=(el,v)=>{const d=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set; d.call(el,v); el.dispatchEvent(new Event("input",{bubbles:true}));};
    set(ins[0],"750"); set(ins[1],"Kurta stitching");});
  await new Promise(r=>setTimeout(r,1200));
  console.log("  after typing:",JSON.stringify(await st()));
  p.__net.length=0;
  const clicked = await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/Make the link/i.test(x.innerText||"")); if(!e||e.disabled) return "still disabled"; window.__fx=[]; e.click(); return "clicked";});
  await new Promise(r=>setTimeout(r,2000));
  const after = await T(p);
  console.log(`  Make the link: ${clicked}  net=${[...new Set(p.__net)].join(" | ")||"NONE — no request made"}`);
  console.log(`  screen now: ${after.slice(0,220)}`);
  const fx = await p.evaluate(()=>window.__fx||[]); console.log("  fx:",JSON.stringify(fx));
  await p.reload({waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,1800));
  const rl = await T(p);
  console.log(`  after reload, "Kurta stitching" still there: ${rl.includes("Kurta stitching")}`);
  await p.close(); }

console.log("\n=== sakhi: send a message ===");
{ const p = await open("/app/sakhi");
  const sel = 'textarea[placeholder*="Ask anything"]';
  const vis = await p.evaluate(()=>[...document.querySelectorAll("textarea")].map(t=>({ph:t.placeholder,vis:t.getBoundingClientRect().width>0})));
  console.log("  textareas:",JSON.stringify(vis));
  p.__net.length=0;
  await p.evaluate(()=>{const t=[...document.querySelectorAll("textarea")].find(x=>x.getBoundingClientRect().width>0); t.focus();});
  await p.keyboard.type("What did I earn this month?",{delay:25});
  await new Promise(r=>setTimeout(r,600));
  const sendState = await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/^Send$/i.test((x.innerText||x.getAttribute("aria-label")||"").trim())); return e?{d:e.disabled}:null;});
  console.log("  Send button after typing:",JSON.stringify(sendState));
  await p.evaluate(()=>{const e=[...document.querySelectorAll("button")].find(x=>/^Send$/i.test((x.innerText||x.getAttribute("aria-label")||"").trim())); if(e&&!e.disabled) e.click();});
  await new Promise(r=>setTimeout(r,6000));
  console.log("  net:",[...new Set(p.__net)].join(" | ")||"NONE");
  const t = await T(p); console.log("  screen:",t.slice(0,260));
  console.log("  cons:",[...new Set(p.__cons)].slice(0,3).join(" | ")||"clean");
  await p.close(); }
await b.close();
