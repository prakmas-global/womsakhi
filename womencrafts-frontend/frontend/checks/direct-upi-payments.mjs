/** Synthetic payer/recipient flow. Seed fresh course/session fixtures in a throwaway database first. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { launch, APP, codeSignIn, CHECK_MEMBER_EMAIL } from './_shared.mjs';
const fixtures = JSON.parse(await readFile(process.env.CHECK_UPI_FIXTURES || '/tmp/womsakhi-upi-browser-fixtures.json', 'utf8'));
const browser = await launch();
const errors = [];
const pages = [];
const waitText = (page, text) => page.waitForFunction(text => document.body.innerText.includes(text), {}, text);
const click = async (page, text) => {
  await page.waitForFunction(text => [...document.querySelectorAll('button')].some(b => b.innerText.trim() === text && !b.disabled), {}, text);
  await page.evaluate(text => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === text && !b.disabled).click(), text);
};
async function login(email) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();pages.push(page);
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewport({width:1440,height:1000});
  await page.goto(`${APP}/signin`, {waitUntil:'networkidle2'});
  const signed = await codeSignIn(email, async(path,body) => page.evaluate(async(path,body) => {
    const response = await fetch(`/api/v1/auth/${path}`, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    return {status:response.status,data:await response.json()};
  },path,body));
  await page.evaluate(id => localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000)),signed.user.id);
  return page;
}
try {
  const payer = await login(CHECK_MEMBER_EMAIL);
  for(const path of ['/app/wallet','/app/wallet/statement','/app/checkout/legacy-audit']) {
    await payer.goto(`${APP}${path}`,{waitUntil:'networkidle2'});
    assert.match(payer.url(),/\/app\/payments$/);
    await waitText(payer,'My Payments');
  }
  console.log('Legacy wallet and gateway URLs lead to My Payments');
  await payer.goto(`${APP}/app/programs/${fixtures.course_id}`,{waitUntil:'networkidle2'});
  await payer.waitForSelector('#pay-ref');
  assert.equal(await payer.$eval('button::-p-text(Submit payment reference)',button=>button.disabled),true);
  await payer.locator('#pay-ref').fill('TEST-UPI-COURSE-123');
  await click(payer,'Submit payment reference');
  await waitText(payer,'Waiting for Audit Teacher to confirm');
  await payer.goto(`${APP}/app/payments`,{waitUntil:'networkidle2'});
  await waitText(payer,'TEST-UPI-COURSE-123');
  const course = `[data-payment-id="course:${fixtures.enrollment_id}"]`;
  assert.ok((await payer.$eval(course,el=>el.innerText)).includes('Awaiting confirmation'));
  assert.equal((await payer.$eval(course,el=>el.innerText)).includes('Confirmed received'),false);
  const recipient = await login(process.env.CHECK_RECIPIENT_EMAIL || 'teacher.audit@example.com');
  await recipient.goto(`${APP}/app/payments`,{waitUntil:'networkidle2'});
  await waitText(recipient,'TEST-UPI-COURSE-123');
  await recipient.locator(`${course} a`).click();
  await waitText(recipient,'Payment received');
  const courseConfirmed = recipient.waitForResponse(r=>r.url().includes(`/teach/learners/${fixtures.enrollment_id}/confirm`)&&r.request().method()==='POST');
  await click(recipient,'Payment received');assert.equal((await courseConfirmed).status(),200);
  await payer.goto(`${APP}/app/payments`,{waitUntil:'networkidle2'});
  await waitText(payer,'Confirmed received');
  assert.ok((await payer.$eval(course,el=>el.innerText)).includes('Recipient confirmed'));
  console.log('Course reference remains pending until the real recipient confirms');
  await payer.goto(`${APP}/app/mentors`,{waitUntil:'networkidle2'});
  await payer.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.innerText.startsWith('My sessions')));
  await payer.evaluate(()=>[...document.querySelectorAll('button')].find(b=>b.innerText.startsWith('My sessions')).click());
  await click(payer,'Submit payment reference');
  await payer.locator('input[name="payment_reference"]').fill('TEST-UPI-MENTOR-456');
  await click(payer,'Submit reference');
  await payer.waitForSelector('[role=dialog]',{hidden:true});
  await waitText(payer,'Waiting for her to confirm your payment');
  await recipient.goto(`${APP}/app/mentoring`,{waitUntil:'networkidle2'});
  await waitText(recipient,'Payment received');
  const mentorConfirmed = recipient.waitForResponse(r=>r.url().includes(`/mentoring/requests/${fixtures.session_id}/payment-received`)&&r.request().method()==='POST');
  await click(recipient,'Payment received');assert.equal((await mentorConfirmed).status(),200);
  await payer.goto(`${APP}/app/payments`,{waitUntil:'networkidle2'});
  await waitText(payer,'TEST-UPI-MENTOR-456');
  assert.equal(await payer.$$eval('[data-payment-id]',rows=>rows.filter(row=>row.innerText.includes('Confirmed received')).length),2);
  console.log('Mentoring requires a transaction reference and recipient confirmation');
  await payer.screenshot({path:'/tmp/womsakhi-upi-desktop.png',fullPage:true});
  await payer.locator('button[aria-label="Hide payment amounts"]').click();
  assert.equal(await payer.$eval('[data-my-payments]',el=>/₹\s*\d/.test(el.innerText)),false);
  for(const mode of ['light','dark']) {
    await payer.evaluate(mode=>localStorage.setItem('theme',mode),mode);
    await payer.setViewport({width:390,height:844});await payer.reload({waitUntil:'networkidle2'});
    await waitText(payer,'TEST-UPI-MENTOR-456');
    assert.equal(await payer.$eval('[data-my-payments]',el=>el.scrollWidth>el.clientWidth),false);
    await payer.$eval('[data-my-payments]',el=>el.scrollIntoView({block:'start',behavior:'instant'}));
    await payer.screenshot({path:`/tmp/womsakhi-upi-${mode}.png`,fullPage:true});
  }
  const blocked = await payer.evaluate(async()=>{
    const result=await fetch('/api/v1/payments/orders/legacy/confirm',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method:'upi',provider_payload:{}})});
    return result.status;
  });assert.equal(blocked,501);
  await payer.setRequestInterception(true);
  payer.on('request',request=>request.url().includes('/payments/activity')?request.respond({status:503,contentType:'application/json',body:'{"detail":"audit unavailable"}'}):request.continue());
  await payer.reload({waitUntil:'networkidle2'});await waitText(payer,'Your payment records could not load.');
  assert.equal(await payer.$eval('[data-my-payments]',el=>el.innerText.includes('No matching payment records')),false);
  assert.deepEqual(errors,[]);
  console.log('PASS: direct-UPI course and mentoring proof → recipient confirmation, redirects, hidden amounts, mobile themes, gateway guard and honest outage state.');
} catch(error) {
  for(let i=0;i<pages.length;i++){await pages[i].screenshot({path:`/tmp/womsakhi-upi-failure-${i}.png`,fullPage:true});console.error('Page',i,pages[i].url());}
  throw error;
} finally {
  for(const page of pages){page.removeAllListeners('request');await page.setRequestInterception(false).catch(()=>{});}
  await browser.close();
}
