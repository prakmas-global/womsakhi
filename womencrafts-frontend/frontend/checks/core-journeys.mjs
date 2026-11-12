/** Read-only journey navigation against the running release; use an isolated fixed-code test API. */
import assert from "node:assert/strict";
import { launch, APP, CHECK_MEMBER_EMAIL, CHECK_LOGIN_CODE } from "./_shared.mjs";

assert.match(CHECK_LOGIN_CODE, /^\d{6}$/, "Configure the isolated API's fixed test code in CHECK_LOGIN_CODE");
const browser = await launch();
const results = [];

async function browserLogin(page) {
  await page.goto(`${APP}/signin`, { waitUntil: "networkidle2" });
  await page.evaluate(async ({ email, code }) => {
    for (const [part, body] of [["start", { email }], ["verify", { email, code }]]) {
      const response = await fetch(`/api/v1/auth/${part}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`Isolated browser sign-in failed: ${response.status}`);
    }
  }, { email: CHECK_MEMBER_EMAIL, code: CHECK_LOGIN_CODE });
}

async function visibleCard(page) {
  return page.evaluateHandle(() => [...document.querySelectorAll("[data-home-pathways]")].find((el) => el.getBoundingClientRect().width > 0));
}

try {
  for (const width of [390, 1440]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width, height: 1000 });
    await page.evaluateOnNewDocument(() => sessionStorage.setItem("wsa-opened", "1"));
    const errors = [], failedAssets = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("response", (response) => {
      if (response.url().includes("/_next/static/") && response.status() >= 400) failedAssets.push(response.url());
    });
    await browserLogin(page);
    await page.goto(`${APP}/app`, { waitUntil: "networkidle2" });
    const journeys = await page.evaluate(async () => (await fetch("/api/v1/me/journeys")).json());
    assert.equal(journeys.length, 3);

    for (const [id, label] of [["learn", "Learn a skill"], ["sell", "Sell something"], ["work", "Work from home"]]) {
      await page.goto(`${APP}/app?goal=${id}`, { waitUntil: "networkidle2" });
      const card = await visibleCard(page);
      await card.evaluate((el, label) => el.querySelector("button[aria-pressed=true]")?.textContent.includes(label), label).then((value) => assert.ok(value));
      const expected = journeys.find((journey) => journey.id === id);
      await page.waitForFunction((action) => [...document.querySelectorAll("[data-home-pathways]")].find((el) => el.getBoundingClientRect().width > 0)?.querySelector("[data-journey-next]")?.textContent.includes(action), {}, expected.action);
      const links = await card.evaluate((el) => [...el.querySelectorAll("[data-journey-next]")].map((a) => a.getAttribute("href")));
      assert.deepEqual(links, [expected.href]);
      assert.equal(await card.evaluate((el) => el.lang), "en");
      await card.evaluate((el) => el.querySelector("[data-journey-next]").click());
      await page.waitForSelector("[data-journey-trail]", { timeout: 30000 });
      assert.ok(await page.$eval("[data-journey-trail]", (el, title) => el.textContent.includes(title), expected.title));
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      results.push(`${width}px ${label}: one primary action and return path`);
    }

    // The choice survives a reload, while progress comes from member-owned records.
    await page.goto(`${APP}/app`, { waitUntil: "networkidle2" });
    let card = await visibleCard(page);
    await card.evaluate((el) => [...el.querySelectorAll("button")].find((button) => button.textContent.trim() === "Work from home").click());
    await page.reload({ waitUntil: "networkidle2" });
    card = await visibleCard(page);
    assert.ok(await card.evaluate((el) => el.querySelector("button[aria-pressed=true]").textContent.includes("Work from home")));

    await page.goto(`${APP}/app/programs?price=free`, { waitUntil: "networkidle2" });
    assert.ok(await page.$$eval("button", (buttons) => buttons.some((button) => button.textContent.trim() === "Free" && button.getAttribute("aria-pressed") === "true")));
    const requests = [];
    const onRequest = (request) => { if (request.url().includes("/growth/opportunities")) requests.push(request.url()); };
    page.on("request", onRequest);
    await page.goto(`${APP}/app/opportunities?where=Remote&view=all`, { waitUntil: "networkidle2" });
    page.off("request", onRequest);
    assert.ok(requests.length && requests.every((url) => new URL(url).searchParams.get("mode") === "Remote" && !new URL(url).searchParams.has("for_me")));
    results.push(`${width}px free-course and first-request from-home filters`);

    await page.setRequestInterception(true);
    page.on("request", (request) => request.url().includes("/me/journeys")
      ? request.respond({ status: 503, contentType: "application/json", body: '{"detail":"check unavailable"}' })
      : request.continue());
    await page.goto(`${APP}/app`, { waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.body.textContent.includes("Your progress could not load"));
    card = await visibleCard(page);
    assert.ok(await card.$("[data-journey-next]"), "Start action remains usable when progress fails");
    assert.deepEqual(errors, []);
    assert.deepEqual(failedAssets, []);
    results.push(`${width}px progress failure stays actionable; no runtime/static-asset errors`);
    await context.close();
  }
  for (const result of results) console.log(`PASS ${result}`);
} finally {
  await browser.close();
}
