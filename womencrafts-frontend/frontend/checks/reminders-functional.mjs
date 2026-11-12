/** Isolated reminder workflow: never runs against the ordinary development database. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { launch, APP, API, codeSignIn } from './_shared.mjs';
assert.equal(new URL(APP).port,'3111');assert.equal(new URL(API).port,'8031');
const backend=new URL('../../../womencrafts-backend/backend/',import.meta.url).pathname;
const python=code=>execFileSync(`${backend}venv/bin/python`,['-c',code],{cwd:backend,encoding:'utf8',env:{...process.env,MONGODB_URI:'mongodb://127.0.0.1:27099',DB_NAME:'womsakhi_reminders_browser_check',ENGINES_ENABLED:'true',ENGINES_LOCAL_WORKER:'true',DEMO_SEED_ENABLED:'false',VAPID_PUBLIC_KEY:'',VAPID_PRIVATE_KEY:'',SMTP_HOST:'',SMS_PROVIDER:'',WHATSAPP_PROVIDER:''}});
python(`import asyncio
from datetime import datetime,timezone
from app.db.mongodb import connect_db,get_database,close_db
from app.models.user import UserModel
async def main():
 await connect_db();db=get_database()
 if not await db.users.find_one({'email':'reminders.audit@example.com'}):
  member=(await db.members.insert_one({'full_name':'Reminder Test Member','status':'active'})).inserted_id
  user=UserModel.create_document('Reminder Test Member','reminders.audit@example.com','unused-test-only',role='Member',member_id=str(member),phone='+919000000009',country='IN',verification_status='active')
  user.update({'email_verified_at':datetime.now(timezone.utc),'phone_verified_at':datetime.now(timezone.utc),'onboarding_complete':True,'is_active':True,'token_version':0})
  await db.users.insert_one(user)
 await close_db()
asyncio.run(main())`);
const auth=await codeSignIn('reminders.audit@example.com');
const headers={Authorization:`Bearer ${auth.access_token}`,'Content-Type':'application/json'};
const call=async(path,method='GET',body)=>{const response=await fetch(`${API}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});assert.ok(response.ok,`${method} ${path}: ${response.status} ${await response.clone().text()}`);return response.json();};
await call('/me/onboarding/skip','POST');
for(const row of (await call('/engines/reminders')).reminders)await call(`/engines/reminders/${row.id}`,'DELETE');
const user=await call('/users/me');
const browser=await launch();const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
await page.setViewport({width:1440,height:1000});
await page.setCookie({name:'access_token',value:auth.access_token,domain:'localhost',path:'/'});
await page.evaluateOnNewDocument(id=>{localStorage.setItem(`ws.complete-profile.later.${id}`,String(Date.now()+86400000));},user.id);
const click=async(text,selector='button')=>{await page.waitForFunction((text,selector)=>[...document.querySelectorAll(selector)].some(b=>b.innerText.trim()===text&&!b.disabled),{},text,selector);const handle=await page.evaluateHandle((text,selector)=>[...document.querySelectorAll(selector)].find(b=>b.innerText.trim()===text&&!b.disabled),text,selector);await handle.asElement().click();};
try {
 await page.goto(`${APP}/app/reminders`,{waitUntil:'networkidle2'});await page.waitForSelector('h1');
 assert.equal(await page.$('button::-p-text(Drink water · every 30 min)'),null);
 await click('New reminder');await page.waitForSelector('[data-testid="reminder-modal"]');
 assert.equal(await page.$('[data-testid="reminder-modal"] button::-p-text(Drink water)'),null);
 await page.keyboard.press('Escape');
 await page.goto(`${APP}/app/health/reminders`,{waitUntil:'networkidle2'});await click('Water every 30 min','a');
 await page.waitForFunction(()=>document.querySelector('#content h1')?.innerText==='Water reminders');
 assert.equal(new URL(page.url()).pathname,'/app/health/reminders/water');
 await click('Add water reminder');await page.waitForSelector('[data-testid="reminder-modal"]');
 assert.equal(await page.$eval('select[aria-label="Repeat every"]',el=>el.value),'30');
 await page.waitForFunction(()=>document.querySelector('[data-testid="reminder-modal"] ol')?.children.length===5);
 assert.equal((await call('/engines/reminders')).reminders.length,0,'Preview does not save');
 await click('Set it');await page.waitForSelector('[data-testid="reminder-modal"]',{hidden:true});
 await page.waitForSelector('.reminder-row');let rows=(await call('/engines/reminders')).reminders;assert.equal(rows.length,1);
 const id=rows[0].id;assert.equal(rows[0].schedule.interval_minutes,30);assert.equal(rows[0].schedule.end_time,'21:00');
 await page.reload({waitUntil:'networkidle2'});await page.waitForSelector('.reminder-row');
 await click('Edit reminder');await page.select('select[aria-label="Repeat every"]','60');
 await page.waitForFunction(()=>document.querySelector('[data-testid="reminder-modal"] ol')?.children.length===5);
 await click('Set it');await page.waitForSelector('[data-testid="reminder-modal"]',{hidden:true});
 assert.equal((await call('/engines/reminders')).reminders[0].schedule.interval_minutes,60);
 await click('Pause');await page.waitForFunction(()=>[...document.querySelectorAll('.reminder-row button')].some(b=>b.innerText.trim()==='Resume'));
 assert.equal((await call('/engines/reminders')).reminders[0].state,'paused');
 await click('Resume');await page.waitForFunction(()=>[...document.querySelectorAll('.reminder-row button')].some(b=>b.innerText.trim()==='Pause'));
 python(`import asyncio\nfrom datetime import datetime,timedelta,timezone\nfrom bson import ObjectId\nfrom app.db.mongodb import connect_db,get_database,close_db\nfrom app.engines import tick,policy\nasync def main():\n await connect_db();db=get_database()\n rule=await db.reminder_definitions.find_one({'_id':ObjectId('${id}')})\n await policy.update(rule['user_id'],{'quiet':{'enabled':False},'channels':{'inapp':True,'push':False}})\n occ=await db.reminder_occurrences.find_one({'definition_id':'${id}','state':'scheduled'},sort=[('due_at',1)])\n await db.reminder_occurrences.update_one({'_id':occ['_id']},{'$set':{'due_at':datetime.now(timezone.utc)-timedelta(seconds=1)}})\n result=await tick.process_due();assert result['raised']==1,result\n await close_db()\nasyncio.run(main())`);
 await page.reload({waitUntil:'networkidle2'});await page.waitForFunction(()=>document.body.innerText.includes('Due now'));
 await click('Snooze 15 min');await page.waitForFunction(()=>!document.querySelector('.reminder-row')?.innerText.includes('Due now'));
 assert.equal((await call('/engines/reminders')).reminders[0].due_occurrence,null);
 await page.screenshot({path:'/tmp/womsakhi-reminders-desktop.png'});
 for(const mode of ['light','dark']) {
  await page.setViewport({width:390,height:844});await page.evaluate(mode=>localStorage.setItem('theme',mode),mode);await page.reload({waitUntil:'networkidle2'});
  await click('Edit reminder');await page.waitForSelector('[data-testid="reminder-modal"]');
  assert.equal(await page.$eval('[data-testid="reminder-modal"]',el=>el.scrollWidth>el.clientWidth),false);
  await page.$eval('select[aria-label="Repeat every"]',el=>el.scrollIntoView({block:'center'}));
  await page.screenshot({path:`/tmp/womsakhi-reminders-${mode}.png`});
  await page.keyboard.press('Escape');await page.waitForSelector('[data-testid="reminder-modal"]',{hidden:true});
 }
 await page.goto(`${APP}/app/reminders`,{waitUntil:'networkidle2'});assert.equal(await page.$('.reminder-row'),null);await page.goto(`${APP}/app/health/reminders/water`,{waitUntil:'networkidle2'});await page.waitForSelector('.reminder-row');
 await click('Stop this one');await click('Stop reminder');await page.waitForSelector('.reminder-row',{hidden:true});
 assert.equal((await call('/engines/reminders')).reminders.length,0);
 await page.goto(`${APP}/app/health/reminders`,{waitUntil:'networkidle2'});await click('Water every 30 min','a');await page.waitForFunction(()=>document.querySelector('#content h1')?.innerText==='Water reminders');await click('Add water reminder');await page.waitForSelector('[data-testid="reminder-modal"]');assert.equal(await page.$eval('select[aria-label="Repeat every"]',el=>el.value),'30');await page.keyboard.press('Escape');
 await page.goto(`${APP}/app/reminders?preset=rem.preset.water`,{waitUntil:'networkidle2'});assert.equal(new URL(page.url()).pathname,'/app/health/reminders/water');
 assert.deepEqual(errors,[]);console.log('PASS: preview without saving, create/reload, edit interval, pause/resume, real in-app delivery, snooze, stop, mobile themes and dialog keyboard close.');
} catch(error) {await page.screenshot({path:'/tmp/womsakhi-reminders-browser-failure.png'});throw error;} finally {await browser.close();}
