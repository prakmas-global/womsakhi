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
const browser=await launch();const page=await browser.newPage();await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});await page.setViewport({width:1280,height:1000});
await page.evaluateOnNewDocument(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),identity.id);
try{
 await page.goto(`${APP}/app/teach/new`,{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Lesson 1 format"]');
 assert.ok(await page.$('[role="switch"]'));
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Learners pay you by UPI. You confirm, then the lessons open.')).click());
 await page.waitForFunction(()=>document.querySelector('#content').innerText.includes('Public previews are unavailable for paid courses.'));
 assert.equal(await page.$$eval('[role="switch"]',els=>els.filter(el=>el.textContent.includes('Free preview')).length),0);
 for(const width of [1280,390]){await page.setViewport({width,height:1000});assert.equal(await page.$eval('#content',el=>el.scrollWidth>el.clientWidth+2),false);}
 console.log('PASS: paid editor states owner-confirmed access and hides public-preview controls; desktop/mobile. No course saved.');
}finally{await browser.close();}
