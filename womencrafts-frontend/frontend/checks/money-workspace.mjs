/** Run only against a throwaway API with an explicitly configured fixed-code account. */
import assert from 'node:assert/strict';
import {launch, APP, codeSignIn, CHECK_MEMBER_EMAIL} from './_shared.mjs';
const browser = await launch();
const p = await browser.newPage();
const errors=[]; p.on('pageerror',e=>errors.push(e.message));
await p.setViewport({width:1440,height:1000});
const waitText = text=>p.waitForFunction(t=>document.body.innerText.includes(t),{},text);
const click = async text=>{console.log('Click',text);await p.waitForFunction(t=>[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===t&&!b.disabled),{},text);await p.evaluate(t=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===t&&!b.disabled).click(),text);};
const fill=async(selector,value)=>{console.log('Fill',selector);await p.locator(selector).fill(value);};
const api=async(path,method='GET',body)=>p.evaluate(async(path,method,body)=>{const key=sessionStorage.getItem('ws.khata.key');const r=await fetch(`/api/v1${path}`,{method,headers:{'Content-Type':'application/json',...(key?{'X-Khata-Key':key}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};},path,method,body);
let billId, noteId;const entryIds=[];
try {
 await p.goto(`${APP}/signin`,{waitUntil:'networkidle2'});
 const signed=await codeSignIn(CHECK_MEMBER_EMAIL,async(path,body)=>p.evaluate(async(path,body)=>{const r=await fetch(`/api/v1/auth/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};},path,body));
 await p.evaluate(uid=>localStorage.setItem(`ws.complete-profile.later.${uid}`,String(Date.now()+86400000)),signed.user?.id || signed.me?.id || (await api('/me')).data.id);
 // Suppress the optional profile prompt on every subsequent document.
 await p.evaluateOnNewDocument(()=>{for(const k of Object.keys(localStorage))if(k.startsWith('ws.complete-profile.later.'))localStorage.setItem(k,String(Date.now()+86400000));});
 await p.goto(`${APP}/app/khata`,{waitUntil:'networkidle2'});await p.waitForSelector('[data-money-workspace]');
 assert.match(p.url(),/\/app\/money/);assert.equal(await p.$$eval('[role=tab]',els=>els.length),3);
 // Clean only fixtures left by an interrupted run in this throwaway account.
 const initial=(await api('/me/khata/entries')).data;
 for(const row of initial.items || [])if(row.note.startsWith('Audit ') && row.source==='me')await api(`/me/khata/entries/${row.id}`,'DELETE');
 for(const row of (await api('/me/money/commitments')).data || [])if(row.what.startsWith('Audit ')){await api(`/me/money/commitments/${row.id}/payment`,'DELETE');await api(`/me/money/commitments/${row.id}`,'DELETE');}
 await p.reload({waitUntil:'networkidle2'});await p.waitForSelector('[data-money-workspace]');
 // Money in and out through the actual entry sheets.
 for(const [label,amount,note] of [['Money in','2500','Audit tailoring income'],['Money out','150','Audit grocery expense']]){
  await click(label);await fill('input[aria-label="Amount in rupees"]',amount);await fill('input[aria-label="A word about it"]',note);await click('Save');await p.waitForSelector('[role=dialog]',{hidden:true});await waitText(note);
 }
 const month=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',timeZone:'Asia/Kolkata'}).format(new Date()).slice(0,7);
 let ledger=await api(`/me/khata/entries?month=${month}`);
 assert.equal(ledger.status,200,JSON.stringify(ledger));
 entryIds.push(...ledger.data.items.filter(x=>x.note.startsWith('Audit ')).map(x=>x.id));
 assert.equal(ledger.data.in_minor,250000);assert.equal(ledger.data.out_minor,15000);
 await click('Bills & plans');await click('Add a bill or plan');
 await fill('input[name="bill_name"]','Audit electricity bill');await fill('input[name="bill_amount"]','650');await click('Save plan');await p.waitForSelector('[role=dialog]',{hidden:true});await waitText('Audit electricity bill');
 billId=(await api('/me/money/commitments')).data.find(x=>x.what==='Audit electricity bill').id;
 await click('Record as paid');await click('Save payment record');await p.waitForSelector('[role=dialog]',{hidden:true});
 await click('Completed');await waitText('Undo payment record');
 await click('Money in & out');await waitText('From a bill');
 ledger=await api(`/me/khata/entries?month=${month}`);assert.equal(ledger.data.out_minor,80000);assert.equal(ledger.data.items.filter(x=>x.commitment_id===billId).length,1);
 await p.$eval(`a[href*="bill=${billId}"]`,el=>el.scrollIntoView({block:'center',behavior:'instant'}));
 await p.locator(`a[href*="bill=${billId}"]`).click();await waitText('Undo payment record');
 await click('Undo payment record');await click('Undo record');await p.waitForFunction(()=>!document.body.innerText.includes('Undo payment record'));
 assert.equal((await api(`/me/khata/entries?month=${month}`)).data.out_minor,15000);
 await click('Upcoming');await waitText('Audit electricity bill');
 await click('Money in & out');await waitText('Audit tailoring income');
 await p.screenshot({path:'/tmp/womsakhi-money-desktop.png',fullPage:true});
 // Hide amounts across the ledger, plans and a note with an amount.
 noteId=(await api('/me/khata/notes','POST',{text:'Audit money reminder',amount_minor:10000})).data.id;
 await p.locator('button[aria-label="Hide amounts"]').click();
 assert.equal(await p.$eval('[data-money-workspace]',el=>/₹\s*[\d]/.test(el.innerText)),false);
 await click('Notes');await waitText('Audit money reminder');
 assert.equal(await p.$eval('[data-money-workspace]',el=>/₹\s*[\d]/.test(el.innerText)),false);
 await click('Bills & plans');await waitText('Audit electricity bill');
 assert.equal(await p.$eval('[data-bills-plans]',el=>/₹\s*[\d]/.test(el.innerText)),false);
 await p.locator('button[aria-label="Show amounts"]').click();
 // PIN covers both the existing ledger and the new bill section.
 await p.locator('button[aria-label="Set a PIN"]').click();await waitText('Choose a 4-number PIN');
 for(const digit of '2468')await p.locator(`button[aria-label="${digit}"]`).click();
 await p.waitForSelector('button[aria-label="PIN is on"]');
 await p.evaluate(()=>sessionStorage.removeItem('ws.khata.key'));await p.reload({waitUntil:'networkidle2'});await waitText('Enter your money PIN');
 for(const digit of '2468')await p.locator(`button[aria-label="${digit}"]`).click();
 await p.waitForSelector('[data-money-workspace]');await waitText('Audit electricity bill');
 assert.equal((await api('/me/money/commitments')).status,200);
 await api('/me/khata/pin','DELETE',{pin:'2468'});await p.evaluate(()=>sessionStorage.removeItem('ws.khata.key'));
 for(const mode of ['light','dark']){
  await p.evaluate(mode=>localStorage.setItem('theme',mode),mode);await p.setViewport({width:390,height:844});await p.reload({waitUntil:'networkidle2'});await waitText('Audit electricity bill');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${mode} mobile overflow`);
  await p.$eval('[data-bill-id]',el=>el.scrollIntoView({block:'center',behavior:'instant'}));
  assert.equal(await p.$eval('[data-money-workspace]',el=>el.scrollWidth>el.clientWidth),false);
  await p.screenshot({path:`/tmp/womsakhi-money-plans-${mode}.png`,fullPage:true});
 }
 await p.goto(`${APP}/app/khata?tab=notes`,{waitUntil:'networkidle2'});await waitText('Audit money reminder');
 assert.match(p.url(),/tab=notes/);
 await p.goto(`${APP}/app/khata?add=in&amount=95`,{waitUntil:'networkidle2'});
 await p.waitForSelector('input[aria-label="Amount in rupees"]',{visible:true});
 assert.equal(await p.$eval('input[aria-label="Amount in rupees"]',el=>el.value),'95');
 await p.keyboard.press('Escape');await p.waitForSelector('[role=dialog]',{hidden:true});
 await click('Bills & plans');await waitText('Audit electricity bill');
 // Distinguish unavailable data from a genuinely empty notebook.
 await p.setRequestInterception(true);p.on('request',r=>(/\/me\/khata\/(entries|notes)/.test(r.url()))?r.respond({status:503,contentType:'application/json',body:'{"detail":"audit unavailable"}'}):r.continue());
 await click('Money in & out');await p.waitForFunction(()=>new URL(location.href).searchParams.get('tab')==='money');await p.reload({waitUntil:'networkidle2'});await waitText('Your money entries could not load.');
 assert.equal(await p.$eval('[data-money-workspace]',el=>el.innerText.includes('Nothing written')),false);
 await click('Notes');await p.waitForFunction(()=>new URL(location.href).searchParams.get('tab')==='notes');await p.reload({waitUntil:'networkidle2'});await waitText('Your notes could not load.');
 assert.deepEqual(errors,[]);
 console.log('PASS: legacy redirect, 3 tabs, income/expense, plan → one expense → undo, PIN, hidden amounts, responsive light/dark, explicit error state, no browser exceptions.');
} catch(e) {await p.screenshot({path:'/tmp/womsakhi-money-failure.png',fullPage:true});console.error('At',p.url(),await p.$$eval('[role=dialog]',els=>els.map(e=>e.innerText.slice(0,250))));throw e;} finally {
 p.removeAllListeners('request');await p.setRequestInterception(false).catch(()=>{});
 await api('/me/khata/pin','DELETE',{pin:'2468'}).catch(()=>{});
 await api('/me/khata/settings','PATCH',{hide_amounts:false}).catch(()=>{});
 if(noteId)await api(`/me/khata/notes/${noteId}`,'DELETE').catch(()=>{});
 if(billId)await api(`/me/money/commitments/${billId}/payment`,'DELETE').catch(()=>{});
 if(billId)await api(`/me/money/commitments/${billId}`,'DELETE').catch(()=>{});
 for(const id of entryIds)await api(`/me/khata/entries/${id}`,'DELETE').catch(()=>{});
 await browser.close();
}
