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
const browser = await launch();
const page = await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const waitText=text=>page.waitForFunction(text=>document.body.innerText.includes(text),{},text);
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.innerText.trim()===text&&!b.disabled),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===text&&!b.disabled).click(),text);};
try{
 await page.setViewport({width:1440,height:1000});await page.setCookie({name:'access_token',value:identity.token,domain:'localhost',path:'/'});
 await page.evaluateOnNewDocument(id=>{localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000));window.__printedIncome='';window.open=()=>({document:{write:html=>{window.__printedIncome=html;},close:()=>{}},setTimeout:fn=>{fn();},focus:()=>{},print:()=>{window.__incomePrintCalled=true;}});Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.__sharedIncome=data;}});},identity.id);
 await page.goto(`${APP}/app/books/proof`,{waitUntil:'networkidle2'});await waitText('Monthly breakdown');
 assert.equal(await page.$eval('h1',el=>el.innerText),'Business income summary');
 const summary=await page.$eval('[data-business-income-summary]',el=>el.innerText);
 for(const old of ['What do you need it for?','Renting a room','Standing as a guarantor','Make the statement','prepared for'])assert.equal(summary.includes(old),false,old);
 const proof=await page.evaluate(async()=>{const r=await fetch('/api/v1/me/books/proof?months=6');return r.json();});
 const money=minor=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',minimumFractionDigits:2,maximumFractionDigits:2}).format(minor/100);
 assert.ok(summary.includes(money(proof.total_minor)));assert.ok(summary.includes(identity.name));
 assert.equal(await page.$$eval('[data-business-income-summary] tbody tr',els=>els.length),proof.months.length);
 await click('Share summary');const shared=await page.evaluate(()=>window.__sharedIncome);
 assert.equal(shared.title,'Business income summary');assert.ok(shared.text.includes(`Total received: ${money(proof.total_minor)}`));
 for(const month of proof.months)assert.ok(shared.text.includes(`${month.month}: ${money(month.minor)}`));
 await click('Print / save PDF');
 const printed=await page.evaluate(()=>({html:window.__printedIncome,called:window.__incomePrintCalled,text:new DOMParser().parseFromString(window.__printedIncome,'text/html').body.textContent}));
 assert.equal(printed.called,true);assert.ok(printed.text.includes('Business income summary'));assert.ok(printed.text.includes(money(proof.total_minor)));assert.ok(printed.text.includes(identity.name));
 assert.equal(printed.text.includes('womsakhi.com/verify'),false);assert.equal(printed.text.includes('prepared for'),false);
 for(const month of proof.months)assert.ok(printed.text.includes(money(month.minor)));
 await page.screenshot({path:'/tmp/womsakhi-income-desktop.png',fullPage:true});
 for(const mode of ['light','dark']){await page.evaluate(mode=>localStorage.setItem('theme',mode),mode);await page.setViewport({width:390,height:844});await page.reload({waitUntil:'networkidle2'});await waitText('Monthly breakdown');assert.equal(await page.$eval('[data-business-income-summary]',el=>el.scrollWidth>el.clientWidth),false);await page.$eval('[data-business-income-summary]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`/tmp/womsakhi-income-${mode}.png`,fullPage:true});}
 await page.setRequestInterception(true);let response='error';
 page.on('request',r=>r.url().includes('/me/books/proof')?r.respond({status:response==='error'?503:200,contentType:'application/json',body:response==='error'?'{}':JSON.stringify({months:[{month:'October 2026',minor:0,orders:0,customers:0}],total_minor:0,average_minor:0,months_counted:1,months_with_earnings:0})}):r.continue());
 await page.reload({waitUntil:'networkidle2'});await waitText('Your business income summary could not load.');assert.equal(await page.$('button::-p-text(Share summary)'),null);
 response='empty';await page.reload({waitUntil:'networkidle2'});await waitText('No received payments recorded for this period');assert.equal(await page.$eval('button::-p-text(Share summary)',el=>el.disabled),true);assert.equal(await page.$eval('button::-p-text(Print / save PDF)',el=>el.disabled),true);
 assert.deepEqual(errors,[]);console.log('PASS: purpose choices removed, live recorded totals, matching preview/share/print, no verification claims, mobile themes, error and empty states.');
}catch(error){await page.screenshot({path:'/tmp/womsakhi-income-failure.png',fullPage:true});throw error;}
finally{page.removeAllListeners('request');await page.setRequestInterception(false).catch(()=>{});await browser.close();}
