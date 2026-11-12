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
 print(json.dumps({'id':str(u['_id']),'name':u.get('full_name') or 'Account holder','token':create_access_token({'sub':str(u['_id']),'role':'Member','tv':token_version_of(u)},expires_delta=timedelta(minutes=15))}))
 c.close()
asyncio.run(run())`], { cwd: backend, encoding: 'utf8' }));
const browser = await launch();
const page = await browser.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
await page.setCookie({name:'access_token', value:identity.token, domain:'localhost', path:'/'});
await page.evaluateOnNewDocument(id => {
 localStorage.setItem(`ws.complete-profile.later.${id}`, String(Date.now()+86400000));
}, identity.id);
const routes = process.env.VISUAL_ROUTES?.split(',') || ['/app', '/app/learn', '/app/work', '/app/earn', '/app/money', '/app/books', '/app/books/proof', '/app/payments'];
try {
 for (const [width, mode] of (process.env.VISUAL_WIDTHS ? process.env.VISUAL_WIDTHS.split(',').map(w=>[Number(w),'light']) : process.env.VISUAL_QUICK ? [[390,'light']] : [[360,'light'], [390,'light'], [768,'light'], [1440,'light'], [390,'dark'], [1440,'dark']])) {
  await page.setViewport({width,height:1000});
  await page.evaluateOnNewDocument(mode => localStorage.setItem('theme',mode), mode);
  for (const route of routes) {
   await page.goto(`${APP}${route}`, {waitUntil:'networkidle2',timeout:90000});
   await page.waitForSelector('#content h1');
   await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
   await page.waitForFunction(() => [...document.querySelectorAll('#content [data-banner] img')].filter(el=>{const r=el.getBoundingClientRect();return r.height>0&&r.top<innerHeight&&r.bottom>0;}).every(el=>el.complete));
   const geometry = await page.evaluate(() => {
    const content = document.querySelector('#content');
    const scroll = document.querySelector('#ux-scroll').getBoundingClientRect();
    const visible = el => el.getBoundingClientRect().height>0 && getComputedStyle(el).display!=='none';
    return {
     overflow:document.querySelector('#ux-scroll').scrollWidth>document.querySelector('#ux-scroll').clientWidth+1,
     offenders:[...content.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>content.getBoundingClientRect().right+3 && el.getBoundingClientRect().width>0).filter(el=>{for(let p=el.parentElement;p&&p!==content;p=p.parentElement){if(['auto','hidden','scroll','clip'].includes(getComputedStyle(p).overflowX))return false;}return true;}).slice(0,16).map(el=>({tag:el.tagName,cls:el.className,parent:el.parentElement.className,parentWidth:el.parentElement.getBoundingClientRect().width,display:getComputedStyle(el).display,minWidth:getComputedStyle(el).minWidth,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})),
     banners:[...content.querySelectorAll('[data-banner]')].filter(visible).map(el=>({home:el.dataset.banner==='home',height:el.getBoundingClientRect().height,clipped:[...el.querySelectorAll('h1,h2,p,button,input,a')].filter(child=>{const r=child.getBoundingClientRect(),b=el.getBoundingClientRect();return r.height>10&&r.width>10&&(r.bottom>b.bottom+2||r.top<b.top-2);}).map(c=>c.innerText||c.getAttribute('aria-label')),copy:[...el.querySelectorAll('[data-banner-copy]')].map(c=>({height:c.clientHeight,scroll:c.scrollHeight}))})),
     controls:[...document.querySelectorAll('.ux-sakhi-trigger,.ux-safety-trigger')].filter(visible).map(el=>({label:el.getAttribute('aria-label'),top:el.getBoundingClientRect().top})),
     scrollBottom:scroll.bottom,
    };
   });
   if(route==='/app') {
    const fit=await page.$$eval('#content [data-banner="home"] > img',images=>images.filter(im=>im.getBoundingClientRect().width>0).map(im=>({ratio:im.clientWidth/im.clientHeight,natural:im.naturalWidth/im.naturalHeight,gap:im.closest('[data-banner]').clientHeight-im.clientHeight-im.nextElementSibling.offsetHeight})));
    assert.ok(fit.length>0);
    for(const image of fit){assert.ok(Math.abs(image.ratio-image.natural)<0.03,'Home artwork keeps its proportions');assert.ok(Math.abs(image.gap)<=2,'Home image has no empty bands');}
   }
   if(geometry.overflow)console.log(JSON.stringify(geometry));
   assert.equal(geometry.overflow,false,`${route} ${width} ${mode}: horizontal overflow`);
   for(const banner of geometry.banners) {
    if(!banner.home) assert.equal(banner.height,width>=1024?224:256,`${route}: banner height`);
    assert.deepEqual(banner.clipped,[],`${route} ${width}: banner text or controls outside frame`);
    for(const copy of banner.copy) assert.ok(copy.scroll<=copy.height+2,`${route} ${width}: default English banner copy clips (${JSON.stringify(copy)})`);
   }
   for(const control of geometry.controls) assert.ok(control.top>=geometry.scrollBottom,`${route} ${width}: ${control.label} overlaps content`);
   if(route==='/app/books/proof' && width!==768) {
    await page.setViewport({width,height:width>=1024?1200:1000});
    await page.$eval('#content h1',el=>{const scroll=document.querySelector('#ux-scroll');scroll.scrollTo({top:scroll.scrollTop+el.getBoundingClientRect().top-132,behavior:'instant'});});
    await page.screenshot({path:`/tmp/womsakhi-polish-income-${width}-${mode}.png`});
    await page.$eval('#ux-scroll',el=>el.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:`/tmp/womsakhi-polish-overview-${width}-${mode}.png`});
    await page.setViewport({width,height:1000});
   }
   if(mode==='light' && width!==768 && ['/app','/app/learn','/app/earn','/app/money','/app/books'].includes(route))
    await page.screenshot({path:`/tmp/womsakhi-polish-${route.split('/').pop()||'home'}-${width}.png`});
   console.log(`PASS ${width} ${mode} ${route}`);
  }
 }
 assert.deepEqual(errors,[]);
} catch(error) { await page.screenshot({path:'/tmp/womsakhi-polish-failure.png'}); throw error; } finally { await browser.close(); }
