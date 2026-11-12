/** End-to-end Big Orders checks. All API calls are redirected to an isolated local test API. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launch,APP} from './_shared.mjs';
const identities=JSON.parse(readFileSync('/tmp/womsakhi-orders-identity.json','utf8'));
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
 await login('maker');await page.goto(`${APP}/app/contracts`,{waitUntil:'networkidle2'});
 await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Test nearby order'));
 assert.ok(!(await content()).includes('Test distant order'));
 await fill('Nearby town or city','Bengaluru');await click('Show nearby orders');
 await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Test distant order'));
 assert.ok(!(await content()).includes('Test nearby order'));
 await fill('Nearby town or city','Hyderabad');await click('Show nearby orders');
 await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Test nearby order'));
 for(const [width,mode]of [[1440,'light'],[390,'light'],[390,'dark']]){
  await page.setViewport({width,height:1000});await page.evaluate(mode=>{localStorage.setItem('theme',mode);document.documentElement.classList.toggle('dark',mode==='dark');},mode);
  assert.equal(await page.$eval('#content',el=>el.scrollWidth>el.clientWidth+2),false);
  await page.evaluate(()=>{const el=[...document.querySelectorAll('h2')].find(el=>el.textContent==='Orders near you');const scroller=document.querySelector('#ux-scroll');if(el&&scroller)scroller.scrollTop+=el.getBoundingClientRect().top-110;});
  await page.screenshot({path:`/tmp/womsakhi-orders-${width}-${mode}.png`});
 }
 await page.setViewport({width:1440,height:1000});await login('buyer');await page.goto(`${APP}/app/contracts`,{waitUntil:'networkidle2'});
 await page.click('a[href="/app/work/post?kind=Craft%20order"]');await page.waitForSelector('[aria-label="Order town or city"]');
 assert.ok((await content()).includes('Post a big order'));
 await page.$eval('[aria-label="Kinds of work"] button',el=>el.click());await page.waitForSelector('[aria-label="Skills"] button');await page.$eval('[aria-label="Skills"] button',el=>el.click());
 await fill('Order title','Test browser 200 bags');await fill('Order town or city','Hyderabad');await fill('Order area','Kukatpally');await fill('Order quantity','200');await fill('Order unit','bags');
 const delivery=new Date();delivery.setDate(delivery.getDate()+20);await fill('Order delivery date',delivery.toISOString().slice(0,10));
 await fill('Order materials','Buyer provides fabric');await fill('Order payment terms','UPI after accepted delivery');
 await click('Post the big order');await page.waitForFunction(()=>location.pathname==='/app/work/posts');
 await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Test browser 200 bags'));
 await login('maker');await page.goto(`${APP}/app/contracts`,{waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Test browser 200 bags'));
 assert.ok((await content()).includes('200 bags'));
 await page.evaluate(()=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()==='Apply for this').click());
 await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Your application is in'));
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('You applied'));
 assert.deepEqual(errors,[]);console.log('PASS: profile-town default, nearby/distant filtering, real order posting, quantity separate from makers, saved application/reload, desktop/mobile light/dark. All records isolated locally.');
}catch(e){await page.screenshot({path:'/tmp/womsakhi-orders-failure.png'});throw e;}finally{await browser.close();}
