/** Read-only checks. Uses a short-lived local token for an existing development member; never sends a share. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
const browser=await launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:1280,height:1000});await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});
await page.evaluateOnNewDocument(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),identity.id);
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(el=>{const r=el.getBoundingClientRect();return el.textContent.trim()===text&&r.width>0&&r.top>=0&&r.bottom<=innerHeight;}),{},text);const handle=await page.evaluateHandle(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text&&el.getBoundingClientRect().width>0),text);assert.ok(handle.asElement(),`Button ${text}`);await handle.asElement().click();};
const time=async(label,value)=>page.$eval(`input[aria-label="${label}, exact time"]`,(el,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
try {
 await page.goto(`${APP}/app/health/sleep?tab=log`,{waitUntil:'networkidle2'});await click('Start');await page.waitForSelector('[role="dialog"]');await click('Next');
 await page.waitForSelector('[aria-label="Bedtime: hour clock"]');
 await page.click('[aria-label="Bedtime: hour 7"]');await page.waitForSelector('[aria-label="Bedtime: minute clock"]');await page.click('[aria-label="Bedtime: minute 0"]');
 await page.$eval('[aria-label="Bedtime: AM or PM"] button:last-child',el=>el.click());
 assert.equal(await page.$eval('input[aria-label="Bedtime, exact time"]',el=>el.value),'19:00');
 await click('Next');await time('Wake-up time','06:00');await page.waitForFunction(()=>document.querySelector('[role="dialog"]').innerText.includes('11h of sleep'));
 await click('Back');await time('Bedtime','02:17');await click('Next');await time('Wake-up time','08:17');
 await page.waitForFunction(()=>document.querySelector('[role="dialog"]').innerText.includes('6h of sleep'));
 assert.ok((await page.$eval('[role="dialog"]',el=>el.innerText)).includes('same day'));
 await click('Back');await time('Bedtime','00:00');await click('Next');await time('Wake-up time','08:00');await page.waitForFunction(()=>document.querySelector('[role="dialog"]').innerText.includes('8h of sleep'));
 await click('Back');await time('Bedtime','12:00');await click('Next');await time('Wake-up time','18:00');await page.waitForFunction(()=>document.querySelector('[role="dialog"]').innerText.includes('6h of sleep'));
 await click('Back');await time('Bedtime','02:00');
 for(const [width,theme] of [[1280,'light'],[390,'light'],[390,'dark']]){await page.setViewport({width,height:1000});await page.evaluate(theme=>{localStorage.setItem("theme",theme);document.documentElement.classList.toggle("dark",theme==="dark");},theme);assert.equal(await page.$eval('[role="dialog"]',el=>el.scrollWidth>el.clientWidth+2),false);await page.screenshot({path:`/tmp/womsakhi-sleep-${width}-${theme}.png`});}
 await page.goto(`${APP}/app/wellness`,{waitUntil:'networkidle2'});await page.$eval('button[aria-label$=". Log sleep"]',el=>el.click());await page.waitForSelector('[aria-label="Bedtime: hour clock"]');await time('Bedtime','02:00');assert.equal(await page.$eval('input[aria-label="Bedtime, exact time"]',el=>el.value),'02:00');
 assert.deepEqual(errors,[]);console.log('PASS: 7 PM overnight, 2:17 AM same-day, midnight/noon, precise minutes, hour/minute dial, AM/PM, duration and responsive clock. No sleep record saved.');
} catch(e){await page.screenshot({path:'/tmp/womsakhi-sleep-failure.png'});throw e;}finally{await browser.close();}
