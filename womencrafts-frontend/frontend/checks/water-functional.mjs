/** Water logging and reminder navigation, against an explicitly isolated API only. */
import assert from 'node:assert/strict';
import { launch, APP, API, codeSignIn, CHECK_MEMBER_EMAIL } from './_shared.mjs';

assert.equal(new URL(APP).port, '3111', 'Use the isolated production preview');
assert.equal(new URL(API).port, '8031', 'Use the isolated test API');
const signed = await codeSignIn(CHECK_MEMBER_EMAIL);
const headers = { Authorization: `Bearer ${signed.access_token}`, 'Content-Type': 'application/json' };
const call = async (path, method = 'GET', body) => {
  const response = await fetch(API + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
};
const initial = await call('/me/health/entries?kind=water');
assert.equal(initial.length, 0, 'Use a fresh synthetic member with no water entries');
const settings = await call('/me/health/settings');
await call('/me/health/settings', 'PUT', { onboarded: true });
const browser = await launch();
const page = await browser.newPage();
const errors = [];
const made = [];
page.on('pageerror', error => errors.push(error.message));
await page.setCookie({ name: 'access_token', value: signed.access_token, domain: 'localhost', path: '/' });
await page.evaluateOnNewDocument(id => localStorage.setItem(`ws.complete-profile.later.${id}`, String(Date.now() + 86400000)), signed.user.id);
async function add(selector, ml) {
  const saved = page.waitForResponse(r => r.url().includes('/me/health/entries') && r.request().method() === 'POST');
  await page.$$eval(`${selector} button`, (buttons, ml) => buttons.find(button => button.textContent.trim() === `${ml} ml`).click(), ml);
  const response = await saved;
  assert.equal(response.status(), 201);
  made.push((await response.json()).id);
}
try {
  await page.setViewport({ width: 390, height: 1000 });
  await page.goto(APP + '/app/health/nutrition#nt-water', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#nt-water [data-water-glasses]');
  await add('#nt-water', 250);
  await page.waitForFunction(() => document.querySelector('#nt-water').textContent.includes('0.25 L'));
  await add('#nt-water', 500);
  await page.waitForFunction(() => document.querySelector('#nt-water').textContent.includes('0.75 L'));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.waitForFunction(() => document.querySelector('#nt-water')?.textContent.includes('0.75 L'));
  const entries = await call('/me/health/entries?kind=water');
  assert.equal(entries.reduce((total, row) => total + row.data.ml, 0), 750);
  assert.equal((await call('/me/health/summary?days=1'))[0].water_ml, 750);

  await page.goto(APP + '/app/wellness', { waitUntil: 'networkidle2' });
  await page.waitForSelector('[aria-label="Log in one tap"]');
  await page.$$eval('[aria-label="Log in one tap"] button', buttons => buttons.find(button => button.textContent.trim() === 'Water').click());
  await page.waitForFunction(() => document.querySelector('[data-form="water"]')?.textContent.includes('0.75 L'));
  await add('[data-form="water"]', 150);
  await page.waitForFunction(() => document.querySelector('[data-form="water"]').textContent.includes('0.9 L'));
  await page.$eval('[data-form="water"] a[href="/app/health/reminders/water"]', link => link.click());
  await page.waitForSelector('a[href="/app/health/nutrition#nt-water"]');
  await page.$eval('a[href="/app/health/nutrition#nt-water"]', link => link.click());
  await page.waitForFunction(() => document.querySelector('#nt-water')?.textContent.includes('0.9 L'));
  const removed = page.waitForResponse(r => r.url().includes('/me/health/entries/') && r.request().method() === 'DELETE');
  await page.$$eval('#nt-water button', buttons => buttons.find(button => button.textContent.trim() === 'Undo').click());
  assert.equal((await removed).status(), 204);
  await page.waitForFunction(() => document.querySelector('#nt-water').textContent.includes('0.75 L'));
  for (const width of [390, 1440]) {
    await page.setViewport({ width, height: 1000 });
    await page.waitForFunction(() => {
      const element = document.querySelector('#content');
      return element.scrollWidth <= element.clientWidth + 2;
    }, { timeout: 3000 });
  }
  assert.deepEqual(errors, []);
  console.log('PASS: water entries save/reload, daily summary, shared Wellness total, logging → reminder → logging, undo and responsive layout.');
} catch (error) {
  console.error(error.message);
  await page.screenshot({ path: '/tmp/womsakhi-water-functional-failure.png' }).catch(() => {});
  throw error;
} finally {
  await browser.close();
  const remaining = await call('/me/health/entries?kind=water');
  for (const row of remaining.filter(row => made.includes(row.id))) await call(`/me/health/entries/${row.id}`, 'DELETE');
  await call('/me/health/settings', 'PUT', { onboarded: settings.onboarded });
}
