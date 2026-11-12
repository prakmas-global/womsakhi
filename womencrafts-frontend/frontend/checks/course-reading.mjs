/** End-to-end article/book reading checks. All API calls are redirected to an isolated local test API. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {launch,APP} from './_shared.mjs';
const identities=JSON.parse(readFileSync(process.env.CHECK_READER_IDENTITY || '/tmp/womsakhi-reading-identity.json','utf8'));
let failSave=false;
const testApi=process.env.CHECK_READER_API_ORIGIN || 'http://127.0.0.1:8021';
const browser=await launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.setViewport({width:1440,height:1000});await page.setRequestInterception(true);
page.on('request',async req=>{
 const u=new URL(req.url());if(!u.pathname.startsWith('/api/v1/'))return req.continue();
 if(failSave&&u.pathname.endsWith('/reading')){failSave=false;return req.respond({status:503,contentType:'application/json',body:'{}'});}
 try {const headers={...req.headers()};delete headers.host;delete headers['content-length'];
 const res=await fetch(testApi+u.pathname+u.search,{method:req.method(),headers,body:['GET','HEAD'].includes(req.method())?undefined:req.postData()});
 await req.respond({status:res.status,contentType:res.headers.get('content-type')||'application/json',body:Buffer.from(await res.arrayBuffer())});
 }catch(e){await req.abort();errors.push(e.message);}
});
await page.evaluateOnNewDocument(ids=>{for(const u of [ids.reader])localStorage.setItem(`ws.complete-profile.later.${u.id}`,String(Date.now()+86400000));},identities);
const login=role=>page.setCookie({name:'access_token',value:identities[role].token,domain:'localhost',path:'/'});
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(el=>el.textContent.trim()===text&&!el.disabled),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(el=>el.textContent.trim()===text&&!el.disabled).click(),text);};
try {
 const pid=identities.course_id;await login('reader');
 await page.goto(`${APP}/app/programs/${pid}/lesson/2`,{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Book reader"]');
 const saved=()=>page.waitForFunction(()=>document.querySelector('[aria-label="Book reader"]')?.innerText.includes('Place saved to your account'));
 await saved();await page.select('select[aria-label="Go to reading page"]','0');await saved();await click('Next page →');await saved();await click('Next page →');await saved();
 assert.equal(await page.$eval('select[aria-label="Go to reading page"]',el=>el.value),'2');
 await page.reload({waitUntil:'networkidle2'});await saved();assert.equal(await page.$eval('select[aria-label="Go to reading page"]',el=>el.value),'2');
 const before=await page.$eval('[aria-label="Reading page 3"]',el=>getComputedStyle(el).fontSize);await page.click('[aria-label="Larger reading text"]');assert.notEqual(await page.$eval('[aria-label="Reading page 3"]',el=>getComputedStyle(el).fontSize),before);
 failSave=true;await click('Next page →');await page.waitForFunction(()=>document.querySelector('[aria-label="Book reader"]').innerText.includes('Could not save'));await click('Retry save');await saved();
 for(const [width,mode] of [[1440,'light'],[390,'light'],[390,'dark']]){
  await page.setViewport({width,height:1000});await page.evaluate(mode=>{localStorage.setItem('theme',mode);document.documentElement.classList.toggle('dark',mode==='dark');const el=document.querySelector('[aria-label="Book reader"]');const scroller=document.querySelector('#ux-scroll');scroller.scrollTop+=el.getBoundingClientRect().top-95;},mode);
  assert.equal(await page.$eval('#content',el=>el.scrollWidth>el.clientWidth+2),false);await page.screenshot({path:`/tmp/womsakhi-reading-${width}-${mode}.png`});
 }
 await page.goto(`${APP}/app/programs/${pid}`,{waitUntil:'networkidle2'});await page.waitForFunction(()=>document.querySelector('#content')?.innerText.includes('Resume reading'));
 assert.ok(await page.$(`a[href="/app/programs/${pid}/lesson/2"]`));
 await page.goto(`${APP}/app/programs/${pid}/lesson/1`,{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Article reader"]');
 await page.goto(`${APP}/app/teach/new`,{waitUntil:'networkidle2'});await page.waitForSelector('[aria-label="Lesson 1 format"]');
 const freePreview=()=>page.$$eval('button[role="switch"]',buttons=>buttons.filter(button=>button.textContent.includes('Free preview')).map(button=>({disabled:button.disabled,on:button.getAttribute('aria-checked')})));
 assert.deepEqual(await freePreview(),[{disabled:true,on:'false'}]);
 await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.includes('Learners pay you by UPI. You confirm, then the lessons open.')).click());
 await page.waitForFunction(()=>document.body.innerText.includes('Public previews are unavailable for paid courses.'));
 assert.deepEqual(await freePreview(),[]);
 await page.$$eval('button',buttons=>buttons.find(button=>button.textContent.includes('Anyone on WomSakhi can join and start at once.')).click());
 assert.deepEqual(await freePreview(),[{disabled:true,on:'false'}]);
 await click('Book');
 assert.equal(await page.$eval('[aria-label="Lesson text"]',el=>el.maxLength),200000);await click('Article');assert.equal(await page.$eval('[aria-label="Lesson text"]',el=>el.maxLength),50000);
 assert.deepEqual(errors,[]);console.log('PASS: disabled free-course preview, paid-preview restriction, book/article authoring, page changes, saved-page reload, font size, failed-save/retry, course resume link, desktop/mobile light/dark. Isolated local data only.');
}catch(e){await page.screenshot({path:'/tmp/womsakhi-reading-failure.png'});throw e;}finally{await browser.close();}
