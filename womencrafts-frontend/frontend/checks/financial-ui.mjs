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
const browser = await launch(); const page = await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:390,height:844,isMobile:true,hasTouch:true});
await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});
await page.evaluateOnNewDocument(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),identity.id);
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(el=>el.innerText.trim()===text),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(el=>el.innerText.trim()===text).click(),text);};
try {
 await page.goto(`${APP}/app/money`,{waitUntil:'networkidle2'});
 await page.waitForSelector('[data-money-workspace]');
 await page.focus('[role="tab"][aria-selected="true"]');await page.keyboard.press('ArrowRight');
 await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-selected="true"]')?.innerText.includes('Bills & plans'));
 await page.keyboard.press('End');await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-selected="true"]')?.innerText.includes('Notes'));
 await page.keyboard.press('Home');await page.waitForFunction(()=>document.querySelector('[role="tab"][aria-selected="true"]')?.innerText.includes('Money in & out'));
 await click('Money in');await page.waitForSelector('[role="dialog"]');
 await page.focus('[role="dialog"] input');
 assert.ok(await page.$eval('[role="dialog"] input',el=>parseFloat(getComputedStyle(el).fontSize)>=16));
 assert.equal(await page.$eval('[role="dialog"]',el=>el.scrollWidth>el.clientWidth),false);
 await page.keyboard.press('Escape');await page.waitForSelector('[role="dialog"]',{hidden:true});
 await page.goto(`${APP}/app/books`,{waitUntil:'networkidle2'});
 await click('Add customer record');await page.waitForSelector('[role="dialog"]');
 await page.focus('input[name="customer_name"]');await page.keyboard.press('Tab');
 assert.equal(await page.$eval('[role="dialog"]',el=>el.contains(document.activeElement)),true);
 assert.equal(await page.$eval('[role="dialog"]',el=>el.scrollWidth>el.clientWidth),false);
 await page.keyboard.press('Escape');await page.waitForSelector('[role="dialog"]',{hidden:true});
 await page.click('button[aria-label="Hide customer amounts"]');
 assert.ok(await page.$eval('[data-customer-dues]',el=>el.innerText.includes('••••')));
 await page.click('button[aria-label="Show customer amounts"]');
 assert.equal(await page.$eval('[data-customer-dues]',el=>el.innerText.includes('••••')),false);
 assert.equal(await page.$eval('.ux-safety-trigger',el=>new URL(el.href).pathname),'/app/safety');
 assert.deepEqual(errors,[]);
 console.log('PASS: keyboard money tabs, readable mobile fields, contained dialogs, Escape close, amount privacy and safety destination. No records changed.');
} catch(error) {await page.screenshot({path:'/tmp/womsakhi-financial-ui-failure.png'});throw error;} finally {await browser.close();}
