/** End-to-end account UPI checks. All API calls are redirected to an isolated local test API. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launch,APP} from './_shared.mjs';
const identities=JSON.parse(readFileSync('/tmp/womsakhi-upi-identity.json','utf8'));
const testApi='http://127.0.0.1:8021';
const browser=await launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:1440,height:1000});await page.setRequestInterception(true);
page.on('request',async req=>{
 const u=new URL(req.url());if(!u.pathname.startsWith('/api/v1/'))return req.continue();
 try {const headers={...req.headers()};delete headers.host;delete headers['content-length'];
 const res=await fetch(testApi+u.pathname+u.search,{method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postData()});
 await req.respond({status:res.status,contentType:res.headers.get('content-type')||'application/json',body:Buffer.from(await res.arrayBuffer())});
 }catch(e){await req.abort();errors.push(e.message);}
});
await page.evaluateOnNewDocument(ids=>{for(const u of Object.values(ids))localStorage.setItem(`ws.complete-profile.later.${u.id}`,String(Date.now()+86400000));},identities);
const login=role=>page.setCookie({name:'access_token',value:identities[role].token,domain:'localhost',path:'/'});
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===text&&!el.disabled),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text&&!el.disabled).click(),text);};
const fill=async(label,value)=>page.$eval(`[aria-label="${label}"]`,(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));},value);
const content=()=>page.$eval('#content',el=>el.innerText);
try{
 await login('owner');await page.goto(`${APP}/app/settings/payments`,{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Account UPI ID"]');
 await fill('Account UPI ID','sample.owner@okaxis');await click('Save UPI for all payments');await page.waitForFunction(()=>document.querySelector('[data-account-upi]').innerText.includes('UPI updated across your account'));
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('[aria-label="Account UPI ID"]')?.value==='sample.owner@okaxis');
 await page.goto(`${APP}/app/teach/new`,{waitUntil:'networkidle2'});await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes('Learners pay you by UPI. You confirm, then the lessons open.')).click());
 await page.waitForFunction(()=>document.querySelector('[aria-label="Account UPI ID"]')?.value==='sample.owner@okaxis');
 await fill('Account UPI ID','sample.updated@oksbi');await click('Save UPI for all payments');await page.waitForFunction(()=>document.querySelector('[data-account-upi]').innerText.includes('UPI updated across your account'));
 await page.goto(`${APP}/app/mentoring`,{waitUntil:'networkidle2'});await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(el=>el.textContent.includes('A price per session, paid to you by UPI.')));await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.includes('A price per session, paid to you by UPI.')).click());
 await page.waitForFunction(()=>document.querySelector('[aria-label="Account UPI ID"]')?.value==='sample.updated@oksbi');
 await page.goto(`${APP}/app/collect`,{waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('[aria-label="Account UPI ID"]')?.value==='sample.updated@oksbi');
 await page.goto(`${APP}/app/settings/payments`,{waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('[aria-label="Account UPI ID"]')?.value==='sample.updated@oksbi');
 for(const[width,mode]of [[1440,'light'],[390,'light'],[390,'dark']]){await page.setViewport({width,height:1000});await page.evaluate(mode=>{localStorage.setItem('theme',mode);document.documentElement.classList.toggle('dark',mode==='dark');const el=document.querySelector('[data-account-upi]');const scroller=document.querySelector('#ux-scroll');scroller.scrollTop+=el.getBoundingClientRect().top-115;},mode);await page.evaluate(()=>Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{}))));assert.equal(await page.$eval('#content',el=>el.scrollWidth>el.clientWidth+2),false);await page.screenshot({path:`/tmp/womsakhi-global-upi-${width}-${mode}.png`});}
 assert.deepEqual(errors,[]);console.log('PASS: global UPI save/reload, update from course form, mentoring and collection use same ID, settings reflects module update, responsive light/dark. Isolated local account only; no course or mentor profile published.');
}catch(e){await page.screenshot({path:'/tmp/womsakhi-global-upi-failure.png'});throw e;}finally{await browser.close();}
