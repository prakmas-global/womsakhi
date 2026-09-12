/** Phase 2: click every button on a screen, record the observable effect. */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
import fs from "fs";

const SCREENS = process.argv.slice(2);
const SKIP = /delete|remove|withdraw|leave circle|leave this|sign out|log ?out|pay now|pay ₹|buy now|place order|donate|block|report|unfriend|deactivate|close account|send money|transfer/i;

const tok = await seededMemberToken();
const b = await launch();
const out = [];

const snap = (p) => p.evaluate(() => {
  const c = document.querySelector("#content") || document.body;
  const txt = (c.innerText||"").replace(/\s+/g," ").trim();
  let h=0; for (let i=0;i<txt.length;i++){h=(h*31+txt.charCodeAt(i))|0;}
  const dialogs = document.querySelectorAll('[role="dialog"],[aria-modal="true"],dialog[open],[data-sheet],[data-state="open"]').length;
  // fixed/absolute overlays covering a lot of the screen = a sheet
  const overlays = [...document.querySelectorAll("body *")].filter(el=>{
    const cs=getComputedStyle(el); if(cs.position!=="fixed") return false;
    const r=el.getBoundingClientRect(); return r.width>innerWidth*0.6 && r.height>innerHeight*0.3 && cs.display!=="none";
  }).length;
  return { url: location.pathname+location.search, len: txt.length, h, dialogs, overlays,
           scroll: Math.round(scrollY), first: txt.slice(0,90) };
});

for (const route of SCREENS) {
  const p = await pageAs(b, tok, { width: 430, height: 900 });
  let net = [], cons = [];
  p.on("console", m => { if (m.type()==="error") cons.push(m.text().slice(0,220)); });
  p.on("pageerror", e => cons.push("[pageerror] "+String(e).slice(0,220)));
  p.on("response", r => { const u=r.url(); if(/\/api\/v1\//.test(u)||/_next\/data/.test(u)) net.push(`${r.status()} ${r.request().method()} ${u.replace(/^https?:\/\/[^/]+\/api\/v1/,"")}`); });

  await p.evaluateOnNewDocument(() => {
    window.__fx = [];
    const w = window.open; window.open = function(...a){ window.__fx.push("window.open "+a[0]); return null; };
    window.print = function(){ window.__fx.push("window.print()"); };
    if (navigator.share) { const s0=navigator.share.bind(navigator); navigator.share = function(d){ window.__fx.push("navigator.share "+JSON.stringify(d).slice(0,80)); return Promise.resolve(); }; }
    try { const wt = navigator.clipboard && navigator.clipboard.writeText;
      if (wt) navigator.clipboard.writeText = function(t){ window.__fx.push("clipboard.writeText "+String(t).slice(0,90)); return Promise.resolve(); }; } catch {}
    const ex = document.execCommand && document.execCommand.bind(document);
    if (ex) document.execCommand = function(c,...r){ if(c==="copy") window.__fx.push("execCommand copy"); return ex(c,...r); };
    const ic = HTMLInputElement.prototype.click;
    HTMLInputElement.prototype.click = function(){ if(this.type==="file") window.__fx.push("file picker opened"); return ic.call(this); };
    if (navigator.mediaDevices) { const gum = navigator.mediaDevices.getUserMedia;
      navigator.mediaDevices.getUserMedia = function(c){ window.__fx.push("getUserMedia "+JSON.stringify(c)); return gum.call(this,c); }; }
    else window.__fx.push && 0;
    window.__noMedia = !navigator.mediaDevices;
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    window.__noSR = !SR;
    const al = window.alert; window.alert = function(m){ window.__fx.push("alert "+String(m).slice(0,90)); };
    window.confirm = function(m){ window.__fx.push("confirm "+String(m).slice(0,90)); return false; };
  });
  const goHome = async () => {
    for (let k=0;k<3;k++){
      try { await p.goto(APP + route, { waitUntil: "networkidle2", timeout: 90000 }); break; }
      catch(e){ await new Promise(r=>setTimeout(r,1200)); if(k===2) console.log("   (goHome failed: "+String(e.message).slice(0,60)+")"); }
    }
    await new Promise(r=>setTimeout(r,1800));
  };
  await goHome();
  const labels = await p.evaluate(() => [...(document.querySelector("#content")||document.body).querySelectorAll("button")]
    .map((x,i)=>({i, label:(x.innerText||x.getAttribute("aria-label")||"").trim().replace(/\s+/g," ").slice(0,48), disabled:x.disabled,
      exp:x.getAttribute("aria-expanded"), sel:x.getAttribute("aria-selected"), pressed:x.getAttribute("aria-pressed")})));
  console.log(`\n########## ${route} — ${labels.length} buttons`);

  let dirty = false;
  for (const L of labels) {
    if (!L.label) L.label = `(unlabelled #${L.i})`;
    if (SKIP.test(L.label)) { console.log(`  SKIP(destructive) [${L.i}] ${L.label}`); out.push({route,...L,effect:"SKIPPED-destructive"}); continue; }
    if (L.disabled) { console.log(`  disabled         [${L.i}] ${L.label}`); out.push({route,...L,effect:"disabled"}); continue; }
    if (dirty) { await goHome(); dirty = false; }
    const before = await snap(p);
    net = []; cons = [];
    let clickErr = null;
    try {
      await p.evaluate((i)=>{ const el=(document.querySelector("#content")||document.body).querySelectorAll("button")[i];
        if(!el) throw new Error("gone"); el.scrollIntoView({block:"center"}); }, L.i);
      await new Promise(r=>setTimeout(r,180));
      const box = await p.evaluate((i)=>{ const el=(document.querySelector("#content")||document.body).querySelectorAll("button")[i];
        if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.x+r.width/2,y:r.y+r.height/2,w:r.width,h:r.height}; }, L.i);
      if (!box) throw new Error("gone from DOM");
      if (box.w<1||box.h<1) throw new Error(`zero-size ${box.w}x${box.h}`);
      const why = await p.evaluate((i)=>{ const el=(document.querySelector("#content")||document.body).querySelectorAll("button")[i];
        const r=el.getBoundingClientRect(); const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        if(!top) return "offscreen"; if(el.contains(top)||top.contains(el)) return null;
        return `covered by <${top.tagName.toLowerCase()} class="${(top.className||"").toString().slice(0,40)}">`; }, L.i);
      if (why) throw new Error(why);
      await p.evaluate(()=>{ window.__fx = []; });
      await p.mouse.click(box.x, box.y);
    } catch(e) { clickErr = String(e.message||e).slice(0,90); }
    await new Promise(r=>setTimeout(r,1400));
    try { await p.waitForNavigation({timeout:400}); } catch {}
    const after = await snap(p).catch(async()=>{ await new Promise(r=>setTimeout(r,900)); return snap(p).catch(()=>({url:"?",len:0,h:-1,dialogs:0,overlays:0,scroll:0,first:""})); });
    const attrs = await p.evaluate((i)=>{ const el=(document.querySelector("#content")||document.body).querySelectorAll("button")[i];
      if(!el) return null; return {exp:el.getAttribute("aria-expanded"),sel:el.getAttribute("aria-selected"),pressed:el.getAttribute("aria-pressed"),cls:String(el.className).slice(0,60)}; }, L.i).catch(()=>null);

    const eff = [];
    if (clickErr) eff.push(`clickerr:${clickErr}`);
    if (after.url !== before.url) eff.push(`route→${after.url}`);
    if (after.h !== before.h) eff.push(`text changed (${before.len}→${after.len})`);
    if (after.dialogs !== before.dialogs) eff.push(`dialogs ${before.dialogs}→${after.dialogs}`);
    if (after.overlays !== before.overlays) eff.push(`overlay ${before.overlays}→${after.overlays}`);
    if (Math.abs(after.scroll-before.scroll)>40) eff.push(`scroll ${before.scroll}→${after.scroll}`);
    if (attrs && (attrs.exp!==L.exp||attrs.sel!==L.sel||attrs.pressed!==L.pressed)) eff.push(`aria exp/sel/pressed changed`);
    const fx = await p.evaluate(()=>window.__fx||[]).catch(()=>[]);
    if (fx.length) eff.push(`fx: ${[...new Set(fx)].join(" ; ")}`);
    if (net.length) eff.push(`net: ${[...new Set(net)].slice(0,3).join(" ; ")}`);
    if (cons.length) eff.push(`CONSOLE: ${[...new Set(cons)].slice(0,2).join(" | ")}`);
    const effect = eff.length ? eff.join(" | ") : "NO OBSERVABLE EFFECT";
    console.log(`  ${eff.length?"ok  ":"DEAD"} [${L.i}] ${L.label.padEnd(40)} ${effect}`);
    out.push({route, ...L, effect, before, after});

    if (eff.length && !(eff.length===1 && eff[0].startsWith("clickerr"))) dirty = true;
    if (after.url !== before.url) { await goHome(); dirty = false; }
    else if (after.dialogs>before.dialogs || after.overlays>before.overlays) {
      await p.keyboard.press("Escape"); await new Promise(r=>setTimeout(r,500));
    }
  }
  await p.close();
}
fs.appendFileSync("/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/fa2.jsonl", out.map(o=>JSON.stringify(o)).join("\n")+"\n");
await b.close();
