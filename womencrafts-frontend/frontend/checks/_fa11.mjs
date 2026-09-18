import { APP, API, seededMemberToken, launch, pageAs } from "./_shared.mjs";
const tok = await seededMemberToken(); const b = await launch();
const p = await pageAs(b, tok, {width:430,height:900});
await p.goto(APP+"/app",{waitUntil:"networkidle2",timeout:90000}); await new Promise(r=>setTimeout(r,2500));
const d = await p.evaluate(()=>{
  const c=document.querySelector("#content");
  const btn=[...c.querySelectorAll("button")][0];
  let card=btn, cardBox=null;
  for(let k=0;k<6&&card;k++){card=card.parentElement; const r=card.getBoundingClientRect(); if(r.width>100){cardBox={w:Math.round(r.width),h:Math.round(r.height),text:card.innerText.replace(/\s+/g," ").slice(0,120)};break;}}
  const t=(c.innerText||"").replace(/\s+/g," ");
  return {btn:{w:btn.getBoundingClientRect().width,h:btn.getBoundingClientRect().height, svgW:btn.querySelector("svg")?btn.querySelector("svg").getBoundingClientRect().width:null},
    card:cardBox, greeting:t.slice(0,120),
    earned:(t.match(/EARNED THIS MONTH[^₹]*₹[\d,]+/)||[])[0],
    balance:(t.match(/Total Balance ?₹[\d,]+/)||[])[0],
    savings:(t.match(/Savings Pot ?₹[\d,]+/)||[])[0],
    shop:(t.match(/My Shop ?\d+/)||[])[0]};
});
console.log(JSON.stringify(d,null,1));
const api = (path)=>fetch(API+path,{headers:{Authorization:`Bearer ${tok}`}}).then(r=>r.json()).catch(e=>({err:String(e)}));
const prof = await api("/me/profile"), wal = await api("/wallet"), sum = await api("/me/summary");
console.log("API /me/profile name:", prof.full_name||prof.name);
console.log("API /wallet:", JSON.stringify(wal).slice(0,260));
console.log("API /me/summary:", JSON.stringify(sum).slice(0,400));
await p.close(); await b.close();
