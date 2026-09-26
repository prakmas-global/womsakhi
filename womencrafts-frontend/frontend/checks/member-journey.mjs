/**
 * Launch journey ledger for the signed-in member application.
 *
 * Static route checks miss the screens people reach from API data. This sweep
 * starts with every page on disk, follows real member-app links, and records
 * the final destination and visible state on desktop and phone. The JSON
 * artifact is intentionally reviewable and can be compared between releases.
 */
import { createRequire } from "module";
import { writeFileSync } from "fs";
import { resolve } from "path";
import { API, APP, launch, pageAs, seededMemberToken } from "./_shared.mjs";

const require = createRequire(import.meta.url);
const fs = require("fs"), path = require("path");

function routesOnDisk(dir = "src/app/app", base = "/app") {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...routesOnDisk(file, `${base}/${entry.name}`));
    else if (entry.name === "page.tsx") out.push(base);
  }
  return out.sort();
}

const diskRoutes = routesOnDisk();
const concrete = diskRoutes.filter((route) => !route.includes("["));
const patterns = diskRoutes.filter((route) => route.includes("[")).map((route) => ({
  route,
  re: new RegExp(`^${route.replace(/\[[^/]+\]/g, "[^/]+")}$`),
}));
const dynamicPatternFor = (href) => patterns.find(({ re }) => re.test(href));

const token = await seededMemberToken();
if (!token) {
  console.error("FAIL: could not sign in as the seeded member");
  process.exit(1);
}

async function rows(pathname) {
  const response = await fetch(`${API}${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return response.ok ? response.json() : [];
}

// Some parameterized screens are the destination of a transaction and do not
// appear as links in ordinary lists. Seed them from the same read APIs the UI
// uses so checkout, circle contribution, and catalogue detail screens are
// still covered without creating or changing user data.
const [programs, services, orders, community] = await Promise.all([
  rows("/catalog/programs"),
  rows("/catalog/services"),
  rows("/payments/orders"),
  rows("/community/overview"),
]);
const savingsCircle = community?.circles?.find((circle) => circle.is_savings);
const seededDetails = [
  ...programs.slice(0, 2).map((program) => `/app/explore/program/${program.id}`),
  ...services.slice(0, 2).map((service) => `/app/explore/service/${service.id}`),
  ...orders.slice(0, 2).map((order) => `/app/checkout/${order.id}`),
  ...(savingsCircle ? [`/app/circles/${savingsCircle.id}/pay`] : []),
];

const browser = await launch();
const report = {
  generatedAt: new Date().toISOString(),
  app: APP,
  routesOnDisk: diskRoutes.length,
  staticRoutes: concrete.length,
  dynamicPatterns: patterns.map((x) => x.route),
  passes: [],
};

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "phone", width: 390, height: 844 },
];

for (const viewport of viewports) {
  const page = await pageAs(browser, token, viewport);
  const queue = [...new Set([...concrete, ...seededDetails])];
  const queued = new Set(queue);
  const dynamicSamples = new Map();
  const results = [];

  for (let cursor = 0; cursor < queue.length; cursor++) {
    const route = queue[cursor];
    const errors = [];
    const failedApi = [];
    const onError = (error) => errors.push(String(error));
    const onConsole = (message) => {
      if (message.type() === "error" && !/^Failed to load resource/.test(message.text())) {
        errors.push(message.text());
      }
    };
    const onResponse = (response) => {
      if (response.url().includes("/api/v1/") && response.status() >= 400) {
        failedApi.push(`${response.status()} ${new URL(response.url()).pathname}`);
      }
    };
    page.on("pageerror", onError);
    page.on("console", onConsole);
    page.on("response", onResponse);

    let status = 0;
    try {
      const response = await page.goto(`${APP}${route}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      status = response?.status() ?? 0;
      // Let hydration mount the route state before asking whether it has
      // finished. Without this pause the check can observe the server's
      // one-word fallback just before the client adds its skeleton.
      await new Promise((done) => setTimeout(done, 250));
      await page.waitForFunction(() => {
        const visible = (element) => {
          const box = element.getBoundingClientRect();
          return box.width > 0 && box.height > 0;
        };
        return ![...document.querySelectorAll(
          '.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]'
        )].some(visible);
      }, { timeout: 5000 }).catch(() => {});
      await new Promise((done) => setTimeout(done, 120));

      const state = await page.evaluate(() => {
        const visible = (element) => {
          const box = element.getBoundingClientRect();
          if (box.width < 1 || box.height < 1) return false;
          for (let node = element; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (style.display === "none" || style.visibility === "hidden") return false;
          }
          return true;
        };
        const main = document.querySelector("main");
        const text = (main?.innerText || "").replace(/\s+/g, " ").trim();
        const links = [...document.querySelectorAll('a[href^="/app/"]')]
          .map((a) => a.getAttribute("href")?.split(/[?#]/)[0])
          .filter(Boolean);
        const unnamed = [...document.querySelectorAll("button,a[href]")]
          .filter((el) => visible(el) && !(el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim()).length;
        const unlabelled = [...document.querySelectorAll("input,select,textarea")]
          .filter((el) => {
            if (!visible(el) || el.type === "hidden") return false;
            if (el.getAttribute("aria-label") || el.getAttribute("placeholder") || el.getAttribute("aria-labelledby")) return false;
            return !el.closest("label") && !(el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`));
          }).length;
        const loading = [...document.querySelectorAll('.wc-skeleton,[class*="animate-pulse"],[class*="animate-spin"]')]
          .filter(visible).length;
        return {
          pathname: location.pathname,
          title: document.title,
          h1: [...document.querySelectorAll("h1")].filter(visible).map((h) => h.textContent.trim()),
          hasMain: Boolean(main),
          textLength: text.length,
          sample: text.slice(0, 180),
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          unnamed,
          unlabelled,
          loading,
          forms: document.querySelectorAll("form").length,
          buttons: [...document.querySelectorAll("button")].filter(visible).length,
          notReady: Boolean(document.querySelector('[data-not-ready="true"]')),
          links: [...new Set(links)],
        };
      });

      for (const href of state.links) {
        const pattern = dynamicPatternFor(href);
        const samples = pattern ? dynamicSamples.get(pattern.route) ?? 0 : 0;
        // Two real records per parameterized screen catch data-dependent
        // rendering without turning a route audit into a crawl of the entire
        // production-shaped catalogue.
        if (pattern && samples < 2 && !queued.has(href)) {
          queued.add(href);
          queue.push(href);
          dynamicSamples.set(pattern.route, samples + 1);
        }
      }
      delete state.links;
      results.push({ route, status, ...state, failedApi: [...new Set(failedApi)], errors: [...new Set(errors)] });
    } catch (error) {
      results.push({ route, status, loadError: String(error), failedApi: [...new Set(failedApi)], errors: [...new Set(errors)] });
    } finally {
      page.off("pageerror", onError);
      page.off("console", onConsole);
      page.off("response", onResponse);
    }

    if ((cursor + 1) % 25 === 0 || cursor + 1 === queue.length) {
      console.log(`  ${viewport.name}: ${cursor + 1}/${queue.length}`);
    }
  }

  report.passes.push({ viewport, checked: results.length, results });
  await page.close();
}

await browser.close();

const findings = [];
for (const pass of report.passes) {
  for (const row of pass.results) {
    const where = `${pass.viewport.name} ${row.route}`;
    if (row.loadError) findings.push(`${where}: failed to load`);
    if (row.status >= 400) findings.push(`${where}: document returned ${row.status}`);
    if (row.pathname && (/^\/signin/.test(row.pathname) || /^\/dashboard/.test(row.pathname))) findings.push(`${where}: escaped member app to ${row.pathname}`);
    if (row.hasMain === false) findings.push(`${where}: no main landmark`);
    if (row.textLength != null && row.textLength < 120) findings.push(`${where}: only ${row.textLength} characters of content`);
    if (row.h1 && row.h1.length !== 1) findings.push(`${where}: ${row.h1.length} visible h1 elements`);
    if (row.loading) findings.push(`${where}: ${row.loading} loader(s) still visible`);
    if (row.overflow) findings.push(`${where}: horizontal overflow`);
    if (row.unnamed) findings.push(`${where}: ${row.unnamed} unnamed control(s)`);
    if (row.unlabelled) findings.push(`${where}: ${row.unlabelled} unlabelled field(s)`);
    if (row.failedApi?.length) findings.push(`${where}: API failures ${row.failedApi.join(", ")}`);
    if (row.errors?.length) findings.push(`${where}: console error ${row.errors[0].slice(0, 120)}`);
  }
}
report.findings = findings;
report.summary = {
  checked: report.passes.reduce((sum, pass) => sum + pass.checked, 0),
  uniqueDestinations: new Set(report.passes.flatMap((pass) => pass.results.map((row) => row.route))).size,
  findings: findings.length,
  explicitNotReady: new Set(report.passes.flatMap((pass) => pass.results.filter((row) => row.notReady).map((row) => row.route))).size,
};

const output = resolve(process.cwd(), "../../docs/member-journey-step-02.json");
writeFileSync(output, JSON.stringify(report, null, 2) + "\n");
console.log(`\n  ${report.summary.checked} screen/viewport checks`);
console.log(`  ${report.summary.uniqueDestinations} unique destinations`);
console.log(`  ${report.summary.explicitNotReady} explicit not-ready destinations`);
console.log(`  ${report.summary.findings} findings`);
console.log(`  wrote ${output}`);
if (findings.length) findings.slice(0, 30).forEach((finding) => console.log(`   · ${finding}`));
process.exit(findings.length ? 1 : 0);
