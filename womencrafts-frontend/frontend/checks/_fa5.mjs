/** Phase 5: focused verification — circles Share targets, shop +/- targets, opportunities "Opportunities" tab. */
import { APP, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();

const inst = (p) => p.evaluateOnNewDocument(() => {
  window.__fx=[];
  try { navigator.clipboard.writeText = t => { window.__fx.push(String(t)); return Promise.resolve(); }; } catch {}
});

// ---- (1) circles: three different posts, three Share clicks, one fresh load
{
  const p = await pageAs(b, tok, {width:1400,height:1000}); await inst(p);
  await p.goto(APP+"/app/circles",{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2500));
  const res = await p.evaluate(()=>{
    const out=[];
    // a post card = the element that owns both a "Share" button and body text
    const shares=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="Share");
    for(let i=0;i<Math.min(5,shares.length);i++){
      let card=shares[i]; for(let k=0;k<8&&card;k++){ card=card.parentElement; if(card && card.innerText.length>120) break; }
      out.push({i, cardText:(card?card.innerText:"").replace(/\s+/g," ").slice(0,70)});
    }
    return out;
  });
  for (const r of res) {
    await p.evaluate(()=>{window.__fx=[];});
    await p.evaluate((i)=>{ const s=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="Share"); s[i].scrollIntoView({block:"center"}); s[i].click(); }, r.i);
    await new Promise(x=>setTimeout(x,600));
    const fx = await p.evaluate(()=>window.__fx);
    console.log(`CIRCLES share#${r.i}  card="${r.cardText}"\n           copied=${fx[0]}`);
  }
  await p.close();
}

// ---- (2) shop: which listing does each +/- hit?
{
  const p = await pageAs(b, tok, {width:1400,height:1000});
  const net=[]; p.on("response",r=>{const u=r.url(); if(/\/shop\/listings\//.test(u)&&r.request().method()==="PATCH") net.push(u.split("/shop/listings/")[1]);});
  await p.goto(APP+"/app/documents",{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2500));
  const cards = await p.evaluate(()=>{
    const plus=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="+");
    return plus.map((el,i)=>{ let c=el; for(let k=0;k<9&&c;k++){c=c.parentElement; if(c&&c.innerText.length>60) break;}
      return {i, title:(c?c.innerText:"").replace(/\s+/g," ").slice(0,60)}; });
  });
  console.log("\nSHOP '+' buttons:", JSON.stringify(cards,null,1));
  for (const c of cards) {
    net.length=0;
    await p.evaluate((i)=>{const pl=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="+"); pl[i].scrollIntoView({block:"center"}); pl[i].click();}, c.i);
    await new Promise(x=>setTimeout(x,1800));
    console.log(`SHOP  + on "${c.title}"  →  PATCH ${net.join(",")||"(none)"}`);
  }
  const minus = await p.evaluate(()=>[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="−").length);
  for (let i=0;i<minus;i++){
    net.length=0;
    const title = await p.evaluate((i)=>{const m=[...document.querySelectorAll("button")].filter(x=>(x.innerText||"").trim()==="−");
      let c=m[i]; for(let k=0;k<9&&c;k++){c=c.parentElement; if(c&&c.innerText.length>60) break;} m[i].scrollIntoView({block:"center"}); m[i].click(); return (c?c.innerText:"").replace(/\s+/g," ").slice(0,60);}, i);
    await new Promise(x=>setTimeout(x,1800));
    console.log(`SHOP  − on "${title}"  →  PATCH ${net.join(",")||"(none)"}`);
  }
  await p.close();
}
await b.close();
