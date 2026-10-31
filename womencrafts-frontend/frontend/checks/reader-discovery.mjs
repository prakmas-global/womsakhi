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
await page.setViewport({width:1440,height:1000});await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});
await page.evaluateOnNewDocument(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),identity.id);
// Inspect the real demo text while keeping the member's saved place unchanged.
await page.setRequestInterception(true);page.on('request',r=>r.method()==='PUT'&&new URL(r.url()).pathname.endsWith('/reading')?r.respond({status:200,contentType:'application/json',body:'{}'}):r.continue());
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===text&&!el.disabled),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text&&!el.disabled).click(),text);};
try{
 await page.goto(`${APP}/app/programs/97b788805c0129236adba48e`,{waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('#content').innerText.includes('Articles & books'));
 const link=await page.evaluateHandle(()=>[...document.querySelectorAll('#content a')].find(el=>el.textContent.trim()==='Read book'));assert.ok(link.asElement());await link.asElement().click();await page.waitForSelector('[aria-label="Book reader"]');
 await page.waitForFunction(()=>document.querySelector('[aria-label="Book reader"]').innerText.includes('Place saved'));
 assert.equal(await page.$eval('[aria-label="Book reader"]',el=>el.querySelector('article').previousElementSibling.querySelectorAll('button').length),2);
 await page.select('[aria-label="Book reader"] select','0');await page.waitForFunction(()=>document.querySelector('[aria-label="Book reader"]').innerText.includes('Place saved'));
 await click('Next page →');await page.waitForFunction(()=>document.querySelector('[aria-label="Book reader"]').innerText.includes('Place saved'));
 assert.ok((await page.$eval('[aria-label="Book reader"] article',el=>getComputedStyle(el).animationName)).includes('pageForward'));
 for(const [width,mode]of [[1440,'light'],[390,'light'],[390,'dark']]){await page.setViewport({width,height:1000});await page.evaluate(mode=>{localStorage.setItem('theme',mode);document.documentElement.classList.toggle('dark',mode==='dark');const el=document.querySelector('[aria-label="Book reader"]');const scroller=document.querySelector('#ux-scroll');scroller.scrollTop+=el.getBoundingClientRect().top-95;},mode);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));assert.equal(await page.$eval('#content',el=>el.scrollWidth>el.clientWidth+2),false);await page.screenshot({path:`/tmp/womsakhi-reader-discovery-${width}-${mode}.png`});}
 await page.goto(`${APP}/app/teach/new`,{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Lesson 1 format"]');await click('Article');
 await page.$eval('[aria-label="Lesson text"]',el=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,Array.from({length:18},(_,i)=>`Paragraph ${i+1}: This original article text is automatically arranged into reading pages, without any manual page design. You can preview the reading experience before publishing.`).join('\n\n'));el.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('Preview reading pages');await page.waitForSelector('[aria-label="Article reader"]');assert.ok(await page.$eval('[aria-label="Article reader"] select',el=>el.options.length)>1);await click('Next page →');assert.equal(await page.$eval('[aria-label="Article reader"] select',el=>el.value),'1');await click('Hide reading preview');assert.equal(await page.$('[aria-label="Article reader"]'),null);
 assert.deepEqual(errors,[]);console.log('PASS: direct article/book entry, top page controls, page-turn animation, automatic text pagination, author preview and responsive themes. No reading progress or course records changed.');
}catch(e){await page.screenshot({path:'/tmp/womsakhi-reader-discovery-failure.png'});throw e;}finally{await browser.close();}
