import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
for (const w of [430, 1600]) {
  const p = await pageAs(b, tok, {width:w,height:1000});
  await p.goto(APP+"/app",{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,3500));
  const t = await p.evaluate(()=>((document.querySelector("#content")||document.body).innerText||"").replace(/\s+/g," "));
  console.log(`\n### width ${w}`);
  console.log("  head:", t.slice(0,200));
  console.log("  mentions 'Ananya':", /Ananya/.test(t), " mentions '24,350':", /24,350/.test(t), " mentions 'Priya':", /Priya/.test(t));
  console.log("  money figures:", (t.match(/₹[\d,]+/g)||[]).slice(0,10).join(" "));
  const links = await p.evaluate(()=>[...(document.querySelector("#content")||document.body).querySelectorAll("a")].filter(a=>a.getBoundingClientRect().width>0).length);
  const btns  = await p.evaluate(()=>[...(document.querySelector("#content")||document.body).querySelectorAll("button")].filter(a=>a.getBoundingClientRect().width>0).length);
  console.log(`  visible links=${links} visible buttons=${btns}`);
  await p.close();
}
await b.close();
