/** Does Home show a stranger's name and money before the real data lands? */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
for (const pass of [1,2,3]) {
  const p = await pageAs(b, tok, {width:430,height:900});
  await p.evaluateOnNewDocument(()=>{ window.__samples=[]; window.__t0=Date.now();
    const tick=()=>{ const c=document.querySelector("#content");
      if(c){ const t=(c.innerText||"").replace(/\s+/g," ").slice(0,90); const last=window.__samples[window.__samples.length-1];
        if(!last||last.t!==t) window.__samples.push({ms:Date.now()-window.__t0,t}); }
      if(Date.now()-window.__t0<9000) requestAnimationFrame(tick); };
    document.addEventListener("DOMContentLoaded",tick); requestAnimationFrame(tick); });
  await p.goto(APP+"/app",{waitUntil:"domcontentloaded",timeout:90000});
  await new Promise(r=>setTimeout(r,9500));
  const s = await p.evaluate(()=>window.__samples||[]);
  console.log(`--- pass ${pass} ---`);
  s.forEach(x=>console.log(`  +${String(x.ms).padStart(5)}ms  ${x.t}`));
  await p.close();
}
await b.close();
