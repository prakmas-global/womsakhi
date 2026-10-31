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
await page.setViewport({width:1440,height:1000});await page.emulateTimezone('Asia/Kolkata');
await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});
await page.evaluateOnNewDocument(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),identity.id);
const click=async(text,root='button')=>{await page.waitForFunction((text,root)=>[...document.querySelectorAll(root)].some(el=>el.textContent.trim()===text),{},text,root);const el=await page.evaluateHandle((text,root)=>[...document.querySelectorAll(root)].find(el=>el.textContent.trim()===text),text,root);await el.asElement().click();};
const active=selector=>page.waitForSelector(selector,{visible:true});
try {
 await page.goto(`${APP}/app/schedule`,{waitUntil:'networkidle2'});await active('[aria-label="Week calendar"]');
 await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('[DEMO]'));
 const week=await page.evaluate(async()=>{const date=new Date();const start=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;return (await fetch(`/api/v1/me/week?start=${start}&tz=Asia/Kolkata`)).json();});
 assert.ok(week.items.filter(i=>i.title.startsWith('[DEMO]')).length>=9);assert.equal(week.days.length,7);
 await click('day');await active('[aria-label="Day calendar"]');
 assert.equal(await page.$$eval('[aria-label="Day calendar"] > button',el=>el.length),1);
 await click('month');await active('[aria-label="Month calendar"]');
 assert.equal(await page.$$eval('[aria-label="Month calendar"] button[aria-pressed]',el=>el.length),42);
 await page.waitForFunction(()=>document.querySelector('[aria-label="Month calendar"]')?.innerText.includes('[DEMO]'));
 const heading=await page.$eval('button[aria-label="Next month"]',el=>el.parentElement.parentElement.querySelector('h2').innerText);
 await page.click('button[aria-label="Next month"]');await page.waitForFunction(text=>document.querySelector('button[aria-label="Next month"]')?.parentElement.parentElement.querySelector('h2').innerText!==text,{},heading);
 await click('Today');await click('list');await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Your agenda'));
 assert.ok(await page.$$eval('#content a[href^="/app/bookings/"]',els=>els.length)>0);
 await click('My bookings');await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('View booking'));
 await click('Reminders');await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Small prompts'));
 await click('Focus time');await click('Start 25 min');await active('[role="timer"]');
 await page.evaluate(()=>{window.__calendarNow=Date.now;Date.now=()=>window.__calendarNow()+60000;});
 await page.waitForFunction(()=>!document.querySelector('[role="timer"]').innerText.startsWith('25:'));
 await click('Calendar');await click('Focus time');
 assert.ok(Number((await page.$eval('[role="timer"]',el=>el.innerText)).split(':')[0])<25,'Timer survives switching tabs');
 await click('Stop');assert.equal(await page.$('[role="timer"]'),null);
 await click('Calendar');await click('month');await active('[aria-label="Month calendar"]');
 for(const [width,mode] of [[1440,'light'],[390,'light'],[390,'dark']]) {
  await page.setViewport({width,height:1000});await page.evaluate(mode=>localStorage.setItem('theme',mode),mode);
  if(mode==='dark'){await page.reload({waitUntil:'networkidle2'});await click('month');await active('[aria-label="Month calendar"]');}
  assert.equal(await page.$eval('#content',el=>el.scrollWidth>el.clientWidth+2),false);
  await page.$eval('[aria-label="Month calendar"]',el=>{const scroller=document.querySelector('#ux-scroll');scroller.scrollTo({top:scroller.scrollTop+el.getBoundingClientRect().top-100,behavior:'instant'});});
  await page.waitForFunction(()=>document.querySelectorAll('[aria-label="Month calendar"] a').length>=18);
  await page.screenshot({path:`/tmp/womsakhi-calendar-${width}-${mode}.png`});
 }
 assert.deepEqual(errors,[]);console.log('PASS: labelled current-week data, real month/day views, period navigation, agenda links, booking/reminder tabs, focus timer persistence and mobile themes.');
} catch(error) {await page.screenshot({path:'/tmp/womsakhi-calendar-failure.png'});throw error;} finally {await browser.close();}
