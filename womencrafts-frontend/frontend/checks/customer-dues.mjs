/** Use an isolated fixed-code account. Creates and removes one synthetic customer record. */
import assert from 'node:assert/strict';
import {launch,APP,codeSignIn,CHECK_MEMBER_EMAIL} from './_shared.mjs';
const browser=await launch();const page=await browser.newPage();const errors=[];
page.on('pageerror',e=>errors.push(e.message));
const waitText=text=>page.waitForFunction(text=>document.body.innerText.includes(text),{},text);
const click=async text=>{await page.waitForFunction(text=>[...document.querySelectorAll('button')].some(b=>b.innerText.trim()===text&&!b.disabled),{},text);await page.evaluate(text=>[...document.querySelectorAll('button')].find(b=>b.innerText.trim()===text&&!b.disabled).click(),text);};
const api=async(path,method='GET',body)=>page.evaluate(async(path,method,body)=>{const r=await fetch(`/api/v1${path}`,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json()};},path,method,body);
let id;
try{
 await page.setViewport({width:1440,height:1000});await page.goto(`${APP}/signin`,{waitUntil:'networkidle2'});
 const signed=await codeSignIn(CHECK_MEMBER_EMAIL,async(path,body)=>page.evaluate(async(path,body)=>{const r=await fetch(`/api/v1/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},path,body));
 await page.evaluate(id=>localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),signed.user.id);
 await page.goto(`${APP}/app/money`,{waitUntil:'networkidle2'});await page.waitForSelector('[data-money-workspace] a[href="/app/books"]');
 await page.goto(`${APP}/app/books`,{waitUntil:'networkidle2'});await waitText('No outstanding customer dues');
 assert.equal(await page.$eval('h1',el=>el.innerText),'Customer dues');
 const before=(await api('/me/khata/entries')).data;
 await click('Add customer record');await page.locator('input[name="customer_name"]').fill('Audit blouse customer');await page.locator('input[name="customer_work"]').fill('Audit stitching order');await page.locator('input[name="customer_amount"]').fill('750.25');await click('Save customer record');await page.waitForSelector('[role=dialog]',{hidden:true});await waitText('Audit blouse customer');
 id=(await api('/me/books')).data.entries.find(row=>row.who==='Audit blouse customer').id;
 assert.equal((await api('/me/books')).data.owed_minor,75025);
 assert.equal((await api('/me/books')).data.late_count,0);
 await click('Record money received');await click('Save receipt record');await page.waitForSelector('[role=dialog]',{hidden:true});await waitText('Received from customer');
 let books=(await api('/me/books')).data;assert.equal(books.entries.length,1);assert.equal(books.paid_minor,75025);assert.equal(books.owed_minor,0);
 const after=(await api('/me/khata/entries')).data;assert.deepEqual(after,before);
 await page.screenshot({path:'/tmp/womsakhi-dues-desktop.png',fullPage:true});
 await page.locator('button[aria-label="Hide customer amounts"]').click();assert.equal(await page.$eval('[data-customer-dues]',el=>/₹\s*\d/.test(el.innerText)),false);
 await page.locator('button[aria-label="Show customer amounts"]').click();
 await click('Edit');await page.locator('input[name="customer_amount"]').fill('800.50');await click('Save customer record');await page.waitForSelector('[role=dialog]',{hidden:true});
 assert.equal((await api('/me/books')).data.paid_minor,80050);
 for(const mode of ['light','dark']){await page.evaluate(mode=>localStorage.setItem('theme',mode),mode);await page.setViewport({width:390,height:844});await page.reload({waitUntil:'networkidle2'});await click('Received');await waitText('Audit blouse customer');assert.equal(await page.$eval('[data-customer-dues]',el=>el.scrollWidth>el.clientWidth),false);await page.$eval('[data-customer-dues]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`/tmp/womsakhi-dues-${mode}.png`,fullPage:true});}
 await click('Remove');await click('Remove record');await waitText('No customer receipts recorded');id=null;
 await page.setRequestInterception(true);page.on('request',r=>r.url().includes('/me/books')?r.respond({status:503,contentType:'application/json',body:'{"detail":"audit unavailable"}'}):r.continue());await page.reload({waitUntil:'networkidle2'});await waitText('Your customer records could not load.');assert.equal(await page.$eval('[data-customer-dues]',el=>el.innerText.includes('No outstanding customer dues')),false);
 assert.deepEqual(errors,[]);console.log('PASS: My Money link, customer create → receipt → edit → remove, exact amounts, no duplicate notebook income, hidden amounts, mobile themes, honest error state.');
}catch(error){await page.screenshot({path:'/tmp/womsakhi-dues-failure.png',fullPage:true});console.error('Failed at',page.url());throw error;}
finally{page.removeAllListeners('request');await page.setRequestInterception(false).catch(()=>{});if(id)await api(`/me/books/${id}`,'DELETE').catch(()=>{});await browser.close();}
