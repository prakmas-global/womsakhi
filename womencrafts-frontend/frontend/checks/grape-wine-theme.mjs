/** Read-only checks. Uses a short-lived local token for an existing development member; never sends a share. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { wcagContrast } from 'culori';
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
try{
 // A previously saved default palette should follow the restored brand.
 const old={id:'womsakhi',primary:'#c80066',secondary:'#4830f0'};await page.setCookie({name:'wc-theme',value:encodeURIComponent(JSON.stringify(old)),domain:'localhost',path:'/'});
 for(const[width,mode]of [[1440,'light'],[390,'light'],[1440,'dark'],[390,'dark']]){
  await page.setViewport({width,height:1000});await page.setCookie({name:'theme',value:mode,domain:'localhost',path:'/'});
  await page.evaluateOnNewDocument(mode=>{localStorage.setItem('theme',mode);},mode);
  for(const route of ['/app','/app/settings/payments','/app/programs','/app/money']){
   await page.goto(APP+route,{waitUntil:'networkidle2'});await page.waitForSelector('#content');
   await page.waitForFunction(mode=>document.documentElement.classList.contains('dark')===(mode==='dark'),{},mode);
   const colours=await page.$eval('.ux',el=>{const style=getComputedStyle(el);return Object.fromEntries(['--ux-brand','--ws-magenta-600','--ux-ink','--ux-muted','--ux-surface','--ux-surface-2','--ux-fill'].map(k=>[k,style.getPropertyValue(k).trim()]));});
   assert.equal(colours['--ws-magenta-600'].toLowerCase(),'#742a4f');assert.ok(wcagContrast(colours['--ux-ink'],colours['--ux-surface'])>=7);assert.ok(wcagContrast(colours['--ux-muted'],colours['--ux-surface-2'])>=4.5);assert.ok(wcagContrast('#ffffff',colours['--ux-fill'])>=4.5);
   await page.evaluate(()=>Promise.race([new Promise(resolve=>setTimeout(resolve,1000)),Promise.all(document.getAnimations().filter(a=>a.playState==='running'&&a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})))]));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,`${route} ${width} ${mode}`);
   if(route==='/app'||route==='/app/settings/payments')await page.screenshot({path:`/tmp/womsakhi-grape-${route==='/app'?'home':'settings'}-${width}-${mode}.png`});
  }
  console.log(`Checked ${width}px ${mode}`);
 }
 assert.deepEqual(errors,[]);console.log('PASS: wine palette, text/action contrast, saved-default normalization and 16 route/viewport/theme combinations. No account preference or banner artwork changed.');
}catch(e){console.error(e.message);await page.screenshot({path:'/tmp/womsakhi-grape-failure.png'}).catch(()=>{});throw e;}finally{await browser.close();}
