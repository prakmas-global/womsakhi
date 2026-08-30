/**
 * The render audit every member screen gets.
 *
 * Eight module checks had grown their own near-identical copy of this, which
 * meant a fix to one (the image-404 detection, say) reached only the screens
 * whose check happened to have it. One definition, used by all of them.
 */
import { pageAs, measureContrast } from "./_shared.mjs";

export const APP = process.env.UX_URL || "http://localhost:3100";
export const MIN_HIT = 24;
export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Open a member screen, optionally click a tab, and measure it.
 *
 * Returns the findings rather than printing them, so a caller can add its own
 * assertions about the same page before deciding anything.
 */
export async function audit(browser, token, {
  route, mode = "light", tab = null, settle = 1900, width = 1536, height = 1024,
}) {
  const page = await pageAs(browser, token, { width, height, mode });
  await page.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);

  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 110)));
  page.on("console", (m) => {
    const t = m.text();
    // A dead API in a dev sandbox is not this screen's problem.
    if (m.type() === "error" && !t.includes("ERR_CONNECTION") && !t.includes("Failed to load resource")) {
      errs.push(t.slice(0, 110));
    }
  });

  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => document.querySelector("aside") !== null, { timeout: 60000 }).catch(() => {});
  await wait(settle);

  if (tab) {
    await page.$$eval("main button", (bs, t) => bs.find((b) => b.innerText.trim() === t)?.click(), tab);
    await wait(850);
  }

  const m = await page.evaluate((MIN) => {
    // The shell scrolls its own column, so the page element is always exactly
    // the viewport — sideways overflow has to be read off that scroller.
    const sc = document.getElementById("ux-scroll") || document.documentElement;
    const small = [];
    for (const el of document.querySelectorAll('a,button,[role="button"],select,input,textarea')) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden") continue;
      // Skip-links are parked off-screen and only become a target once focused.
      if (String(el.className).includes("sr-only")) continue;
      const label = el.closest("label");
      const h = label ? Math.max(r.height, label.getBoundingClientRect().height) : r.height;
      const w = label ? Math.max(r.width, label.getBoundingClientRect().width) : r.width;
      if (h < MIN || w < MIN) {
        small.push(`${w | 0}x${h | 0} "${(el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 24)}"`);
      }
    }
    return {
      overflow: sc.scrollWidth - sc.clientWidth,
      chars: document.body.innerText.trim().length,
      sidebar: Math.round(document.querySelector("aside")?.getBoundingClientRect().width || 0),
      topbar: Math.round(document.querySelector("header")?.getBoundingClientRect().height || 0),
      path: location.pathname,
      small,
      // A 404 image renders as nothing at all — no error, no gap.
      broken: [...document.querySelectorAll("img")]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
        .map((i) => new URL(i.currentSrc).pathname),
      // Real glyph extents, so text clipped past its box is caught even when
      // the element's own rect looks fine.
      //
      // Only SILENT clipping counts. `text-overflow: ellipsis` is a deliberate
      // preview — the "…" tells her there is more — whereas text simply cut off
      // at a hidden edge loses words with no sign that anything is missing.
      clipped: (() => {
        const out = [];
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const txt = n.nodeValue.trim();
          if (!txt || !n.parentElement || n.parentElement.closest(".sr-only")) continue;
          const rng = document.createRange();
          rng.selectNodeContents(n);
          const g = rng.getBoundingClientRect();
          if (g.width < 1) continue;
          if (getComputedStyle(n.parentElement).textOverflow === "ellipsis") continue;
          let box = n.parentElement;
          for (let k = box; k && k !== document.body; k = k.parentElement) {
            const cs = getComputedStyle(k);
            if (cs.textOverflow === "ellipsis") { box = null; break; }
            if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" || cs.borderTopWidth !== "0px" || cs.overflow !== "visible") { box = k; break; }
          }
          if (!box) continue;
          const br = box.getBoundingClientRect();
          const pad = parseFloat(getComputedStyle(box).paddingRight) || 0;
          const over = Math.round(g.right - (br.right - pad));
          if (over > 1) out.push(`"${txt.slice(0, 26)}" by ${over}px`);
        }
        return out;
      })(),
    };
  }, MIN_HIT);

  const contrast = Object.entries(await measureContrast(page));
  return { page, errs, contrast, ...m };
}

/** Turn one audit into a status line plus any failures it earned. */
/**
 * Open a route and wait for the API call behind it to land.
 *
 * Screens render their fallback immediately and swap when the server answers,
 * so a fixed delay measures whichever happened to be on screen. That is how a
 * mentors check counted six, cleared a filter, and found twenty-four — and
 * reported a working list as broken.
 *
 * The waiter is attached BEFORE the navigation, or the response is already
 * past by the time we ask for it.
 */
export async function gotoWithApi(page, url, apiPath, { settle = 600, timeout = 120000 } = {}) {
  const landed = page
    .waitForResponse((r) => r.url().includes(apiPath) && r.status() < 400, { timeout })
    .catch(() => null);          // no endpoint yet: the fallback is the answer
  await page.goto(url, { waitUntil: "domcontentloaded", timeout });
  await landed;
  await wait(settle);
}

export function report(name, mode, a, fail, lines) {
  const tag = `${name} (${mode})`;
  const clean = a.overflow <= 0 && !a.contrast.length && !a.small.length && !a.broken.length && !a.clipped.length && !a.errs.length;
  lines.push(
    `  ${clean ? "ok  " : "✗   "} ${name.padEnd(16)} ${mode.padEnd(5)} ` +
    `${String(a.chars).padStart(4)} chars · overflow ${a.overflow} · contrast ${a.contrast.length} · ` +
    `hits ${a.small.length} · 404s ${a.broken.length} · clipped ${a.clipped.length}`,
  );
  if (!a.path.startsWith("/app")) fail.push(`${tag}: bounced to ${a.path}`);
  if (a.overflow > 0) fail.push(`${tag}: scrolls sideways by ${a.overflow}px`);
  if (a.chars < 250) fail.push(`${tag}: rendered almost nothing (${a.chars} chars)`);
  if (a.sidebar && a.sidebar !== 253) fail.push(`${tag}: sidebar is ${a.sidebar}px, not 253`);
  if (a.topbar && a.topbar !== 75) fail.push(`${tag}: topbar is ${a.topbar}px, not 75`);
  if (a.errs.length) fail.push(`${tag}: ${a.errs[0]}`);
  for (const b of a.broken) fail.push(`${tag}: image 404 — ${b}`);
  for (const [k, n] of a.contrast.slice(0, 2)) fail.push(`${tag}: contrast ${k} ×${n}`);
  for (const s of a.small.slice(0, 2)) fail.push(`${tag}: hit target ${s}`);
  for (const c of a.clipped.slice(0, 2)) fail.push(`${tag}: text clipped ${c}`);
  return clean;
}

/** Print and exit — the same ending every module check wants. */
export function finish(fail, lines, ok) {
  console.log("\n" + lines.join("\n"));
  console.log(fail.length
    ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
    : `\n  ${ok}\n`);
  process.exit(fail.length ? 1 : 0);
}
