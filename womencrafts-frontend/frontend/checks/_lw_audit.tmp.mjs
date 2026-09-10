/**
 * The Learn + Work phone audit. Temporary; delete when the pass is signed off.
 *
 * Four assertions per screen per width, plus a screenshot to look at:
 *   1. no sideways scroll   2. every control >= 44x44
 *   3. no visible text under 12px   4. nothing overlapping the tab bar
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const OUT = process.env.OUT || "/private/tmp/claude-501/-Users-praveenmaddela-Desktop-PRAKMAS-GLOBAL/ab20bff5-1632-4dd1-8eb2-2ed0e468a687/scratchpad/lw";
const TAG = process.env.TAG || "before";
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const PROG = "6a46b2126244d4a2445e94fb";

const ROUTES = [
  ["learn",         "/app/learn"],
  ["programs",      "/app/programs"],
  ["program",       `/app/programs/${PROG}`],
  ["lesson",        `/app/programs/${PROG}/lesson/1`],
  ["mentors",       "/app/mentors"],
  ["mentor",        "/app/mentors/m1"],
  ["certificates",  "/app/certificates"],
  ["assess",        "/app/assess"],
  ["digital",       "/app/digital"],
  ["library",       "/app/library"],
  ["swap",          "/app/library/6a8a9fd2d73850c53579b2e1"],
  ["work",          "/app/work"],
  ["opportunities", "/app/opportunities"],
  ["opening",       "/app/opportunities/w1"],
  ["applications",  "/app/applications"],
  ["verified",      "/app/verified"],
  ["contracts",     "/app/contracts"],
  ["together",      "/app/contracts/together"],
  ["trust",         "/app/trust"],
];

const measure = (page) => page.evaluate(() => {
  const doc = document.documentElement;
  const scroller = document.getElementById("ux-scroll");
  const overflow = Math.round(doc.scrollWidth - doc.clientWidth);
  const overflowScroller = scroller ? Math.round(scroller.scrollWidth - scroller.clientWidth) : 0;
  const coarse = matchMedia("(pointer: coarse)").matches;

  const vis = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false;
    }
    return true;
  };
  // Only what THIS pass owns. The topbar, the nav, the help pill and the
  // assistant belong to other agents; counting their rows as failures here
  // would report someone else's screen as mine.
  const mine = (el) => {
    const main = document.getElementById("content");
    return !!(main && main.contains(el));
  };

  const small = [];
  document.querySelectorAll('button, a[href], [role="button"], [role="tab"], input:not([type=hidden]), select, textarea').forEach((el) => {
    if (!vis(el) || !mine(el)) return;
    if (el.closest(".ux-tap-exempt") || el.classList.contains("ux-tap-exempt")) return;
    const r = el.getBoundingClientRect();
    if (r.width < 43.5 || r.height < 43.5) {
      small.push(`${el.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${(el.textContent || "").trim().slice(0, 26)}"`);
    }
  });

  const tiny = [];
  document.querySelectorAll("*").forEach((el) => {
    if (el.children.length || !vis(el) || !mine(el)) return;
    const t = (el.textContent || "").trim();
    if (t.length < 2) return;
    const size = parseFloat(getComputedStyle(el).fontSize);
    if (size < 11.5) tiny.push(`${Math.round(size * 10) / 10}px "${t.slice(0, 28)}"`);
  });

  const nav = document.querySelector('nav[class*="fixed"][class*="bottom-0"], .ux-tabbar');
  const navBox = nav ? nav.getBoundingClientRect() : null;
  const over = [];
  if (navBox) {
    document.querySelectorAll("#content *").forEach((el) => {
      if (!vis(el)) return;
      const cs = getComputedStyle(el);
      if (cs.position !== "fixed" && cs.position !== "sticky") return;
      const r = el.getBoundingClientRect();
      if (r.bottom > navBox.top + 1 && r.top < navBox.bottom - 1 && r.width > 8 && r.height > 8) {
        over.push(`${el.tagName.toLowerCase()} bottom=${Math.round(r.bottom)} navTop=${Math.round(navBox.top)}`);
      }
    });
  }
  // The guard that this measurement is worth anything at all.
  //
  // Every assertion above is scoped to `#content`, and a Next build-error
  // overlay renders OUTSIDE it — so a screen that failed to compile measured
  // as perfectly clean, and a whole 32-screen run reported green against an
  // app that was showing a red error page. Ask whether the screen rendered.
  const overlay = !!document.querySelector("nextjs-portal") &&
    /Build Error|Unhandled Runtime Error|Parsing ecmascript/i.test(document.body.innerText || "");
  const rendered = !!document.querySelector("#content")?.children.length;

  return { overflow, overflowScroller, coarse, overlay, rendered, hasNav: !!navBox,
           small: [...new Set(small)], tiny: [...new Set(tiny)], over: [...new Set(over)] };
});

const tok = await seededMemberToken();
if (!tok) throw new Error("no member token — is the backend on 8020?");
const b = await launch();

for (const [name, route] of ROUTES) {
  if (ONLY && !ONLY.includes(name)) continue;
  for (const [w, h, label] of [[390, 844, "390"], [1440, 900, "1440"]]) {
    const p = await pageAs(b, tok, { width: w, height: h });
    if (w === 390) await p.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    let m = { error: null };
    try {
      await p.goto(APP + route, { waitUntil: "networkidle2", timeout: 120000 });
      await new Promise((r) => setTimeout(r, 2200));
      await p.screenshot({ path: `${OUT}/${TAG}-${name}-${label}.png`, fullPage: w === 390 });
      m = await measure(p);
    } catch (e) { m.error = e.message.slice(0, 100); }
    const bad = [];
    if (m.overflow || m.overflowScroller) bad.push(`OVERFLOW ${m.overflow}/${m.overflowScroller}`);
    if (m.small?.length) bad.push(`SMALL ${m.small.length}`);
    if (m.tiny?.length) bad.push(`TINY ${m.tiny.length}`);
    if (m.over?.length) bad.push(`OVERLAP ${m.over.length}`);
    if (m.error) bad.push(`ERROR`);
    if (m.overlay) bad.push(`BUILD-ERROR-OVERLAY`);
    if (m.rendered === false) bad.push(`EMPTY`);
    console.log(`${bad.length ? "FAIL" : "ok  "} ${name.padEnd(14)} ${label.padEnd(5)} ${bad.join(" ") || "clean"} ${JSON.stringify({ s: m.small, t: m.tiny, o: m.over, e: m.error })}`);
    await p.close();
  }
}
await b.close();
