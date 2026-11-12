/** Read-only checks. Uses a short-lived local token for an existing development member; never sends a share. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {wcagContrast} from 'culori';
import { launch, APP } from './_shared.mjs';
const backend = new URL('../../../womencrafts-backend/backend/', import.meta.url).pathname;
const identity = JSON.parse(execFileSync(`${backend}venv/bin/python`, ['-c', `
import asyncio,json
from datetime import timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings
from app.core.security import create_access_token,token_version_of
async def run():
 assert not settings.is_production
 c=AsyncIOMotorClient(settings.MONGODB_URI)
 u=await c[settings.DB_NAME].users.find_one({'role':'Member','verification_status':'active','is_active':True},sort=[('full_name',1)])
 assert u
 print(json.dumps({'id':str(u['_id']),'name':u.get('full_name') or 'Account holder','token':create_access_token({'sub':str(u['_id']),'role':'Member','tv':token_version_of(u)},expires_delta=timedelta(minutes=5))}))
 c.close()
asyncio.run(run())`], { cwd: backend, encoding: 'utf8' }));
const browser=await launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});
await page.evaluateOnNewDocument(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),identity.id);
let whiteControls=0,buttonStates=0;
try{
 for(const[width,mode]of [[1440,'light'],[390,'light'],[1440,'dark'],[390,'dark']]){
  await page.setViewport({width,height:1000});await page.setCookie({name:'theme',value:mode,domain:'localhost',path:'/'});await page.evaluateOnNewDocument(mode=>localStorage.setItem('theme',mode),mode);
  for(const route of ['/app','/app/contracts','/app/settings/payments','/app/reminders']){
   await page.goto(APP+route,{waitUntil:'networkidle2'});await page.waitForSelector('#content');await page.waitForFunction(mode=>document.documentElement.classList.contains('dark')===(mode==='dark'),{},mode);
   await page.evaluate(()=>Promise.race([new Promise(resolve=>setTimeout(resolve,1000)),Promise.all(document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))]));
   const controls=await page.$$eval('#content button,#content a',els=>els.flatMap(el=>{
    const r=el.getBoundingClientRect(),s=getComputedStyle(el);if(el.disabled||!el.textContent.trim()||r.width===0||r.top>innerHeight||r.bottom<70)return[];
    let opacity=1;for(let n=el;n;n=n.parentElement)opacity*=Number(getComputedStyle(n).opacity);if(opacity<.95)return[];
    const rgb=s.color.match(/[\d.]+/g)?.map(Number);if(!rgb||rgb.slice(0,3).some(v=>v<235))return[];
    if(s.backgroundImage.includes('url('))return[];
    const stops=s.backgroundImage.match(/rgba?\([^)]+\)/g)||[];
    const opaque=c=>!c.startsWith('rgba')||Number(c.match(/[\d.]+/g)?.[3])===1;
    const backgrounds=stops.length&&stops.every(opaque)?stops:s.backgroundImage==='none'&&opaque(s.backgroundColor)?[s.backgroundColor]:[];
    return backgrounds.map(bg=>({text:el.textContent.trim().slice(0,60),fg:s.color,bg}));
   }));
   for(const c of controls){assert.ok(wcagContrast(c.fg,c.bg)>=4.5,`${route} ${mode} ${c.text}: ${c.fg}/${c.bg}`);whiteControls++;}
   if(route==='/app'){
    await page.evaluate(()=>{const probe=document.createElement('div');probe.id='contrast-probe';probe.style.cssText='position:fixed;right:20px;top:100px;z-index:99999;display:flex;gap:12px';probe.innerHTML='<button class="btn btn-primary" id="probe-primary">Primary</button><button class="btn btn-secondary" id="probe-secondary">Secondary</button>';document.querySelector('.ux').append(probe);});
    for(const kind of ['primary','secondary'])for(const hover of [false,true]){if(hover)await page.hover(`#probe-${kind}`);else await page.mouse.move(0,0);await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,200)));const c=await page.$eval(`#probe-${kind}`,el=>{const s=getComputedStyle(el);return{bg:s.backgroundColor,fg:s.color};});assert.ok(wcagContrast(c.bg,c.fg)>=4.5,`${mode}/${kind}/${hover}: ${c.bg}/${c.fg}`);buttonStates++;}
    await page.$eval('#contrast-probe',el=>el.remove());
    await page.screenshot({path:`/tmp/womsakhi-white-home-${width}-${mode}.png`});
   }
  }
  console.log(`Checked ${width}px ${mode}`);
 }
 assert.deepEqual(errors,[]);console.log(`PASS: ${whiteControls} visible white-control background samples, ${buttonStates} primary/secondary normal/hover states, 16 responsive route/theme combinations. No member data changed.`);
}catch(e){console.error(e.message);await page.screenshot({path:'/tmp/womsakhi-white-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
