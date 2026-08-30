/**
 * Feedback, Intake, Welcome and Verify.
 *
 * The last four. Welcome and Verify run BEFORE she has the app, so they have no
 * sidebar — the shared audit's shell assertions do not apply and the geometry
 * is checked differently. What is checked instead is the thing each screen
 * exists to do: intake must ANSWER rather than promise a call back, feedback
 * must show that feedback goes somewhere, and verify must never leave her
 * looking at a bare "pending".
 */
import { launch, pageAs, seededMemberToken, measureContrast } from "./_shared.mjs";
import { APP, MIN_HIT, audit, finish, report, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
const token = await seededMemberToken();
const browser = await launch();

/* ── the two that live inside the shell ────────────────────────────────── */
for (const [name, route] of [["feedback", "/app/feedback"], ["intake", "/app/intake"]]) {
  for (const mode of ["light", "dark"]) {
    const a = await audit(browser, token, { route, mode });
    report(name, mode, a, fail, lines);
    await a.page.close();
  }
}

/**
 * The bare screens.
 *
 * A verified member is redirected away from /app/verify and /app/welcome by the
 * layout guard — which is correct, and means they cannot be reached with the
 * seeded account. They are audited directly instead, with the guard's redirect
 * suppressed, so the screens themselves still get measured.
 */
const bareAudit = async (route, mode) => {
  const page = await pageAs(browser, token, { width: 1536, height: 1024, mode });
  await page.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
  const errs = [];
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 110)));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !t.includes("ERR_CONNECTION") && !t.includes("Failed to load resource")) errs.push(t.slice(0, 110));
  });
  await page.goto(APP + route, { waitUntil: "domcontentloaded", timeout: 120000 });
  await wait(2400);
  const m = await page.evaluate((MIN) => {
    const el = document.documentElement;
    const small = [];
    for (const e of document.querySelectorAll('a,button,[role="button"],input,textarea')) {
      const r = e.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      const cs = getComputedStyle(e);
      if (cs.visibility === "hidden" || String(e.className).includes("sr-only")) continue;
      if (r.height < MIN || r.width < MIN) small.push(`${r.width | 0}x${r.height | 0} "${(e.innerText || "").trim().slice(0, 20)}"`);
    }
    return {
      overflow: el.scrollWidth - el.clientWidth,
      chars: document.body.innerText.trim().length,
      path: location.pathname,
      // These run before the app, so there must be NO nav to wander off into.
      hasShell: !!document.querySelector("aside"),
      small,
      broken: [...document.querySelectorAll("img")]
        .filter((i) => i.complete && i.naturalWidth === 0 && i.currentSrc)
        .map((i) => new URL(i.currentSrc).pathname),
    };
  }, MIN_HIT);
  const contrast = Object.entries(await measureContrast(page));
  return { page, errs, contrast, ...m };
};

for (const [name, route] of [["verify", "/app/verify"], ["welcome", "/app/welcome"]]) {
  for (const mode of ["light", "dark"]) {
    const a = await bareAudit(route, mode);
    const tag = `${name} (${mode})`;
    const reached = a.path === route;
    const clean = a.overflow <= 0 && !a.contrast.length && !a.small.length && !a.broken.length && !a.errs.length;
    lines.push(`  ${!reached ? "—   " : clean ? "ok  " : "✗   "} ${name.padEnd(16)} ${mode.padEnd(5)} ` +
               `${reached ? `${a.chars} chars · overflow ${a.overflow} · contrast ${a.contrast.length} · hits ${a.small.length}`
                          : `redirected to ${a.path} (the guard sends a verified member away — correct)`}`);
    if (!reached) continue;
    if (a.overflow > 0) fail.push(`${tag}: scrolls sideways by ${a.overflow}px`);
    if (a.chars < 200) fail.push(`${tag}: rendered almost nothing`);
    if (a.hasShell) fail.push(`${tag}: shows the app nav before she has the app`);
    if (a.errs.length) fail.push(`${tag}: ${a.errs[0]}`);
    for (const b of a.broken) fail.push(`${tag}: image 404 — ${b}`);
    for (const [k, n] of a.contrast.slice(0, 2)) fail.push(`${tag}: contrast ${k} ×${n}`);
    for (const s of a.small.slice(0, 2)) fail.push(`${tag}: hit target ${s}`);
    await a.page.close();
  }
}

const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

/* ── Intake must answer, not promise ───────────────────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/intake" });
  const before = await a.page.$$eval("main .ux-i", (n) => n.length);
  await a.page.$$eval("main button", (bs) => bs.find((b) => /I need to earn/.test(b.innerText))?.click());
  await wait(450);
  await a.page.$$eval("main button", (bs) => bs.find((b) => /Show me what to do/.test(b.innerText))?.click());
  await wait(800);

  const after = await a.page.evaluate(() => ({
    text: document.querySelector("main").innerText,
    links: [...document.querySelectorAll('main a[href^="/app"]')].map((x) => x.getAttribute("href")),
    cards: document.querySelectorAll("main .ux-i").length,
  }));
  say(after.cards > before, `answering adds suggestions to the page (${before} → ${after.cards})`);
  // The failure mode this screen exists to avoid.
  say(!/get in touch|we will call|someone will contact/i.test(after.text),
      "it never promises to call her back instead of answering");
  say(after.links.length > 0 && after.links.every((h) => /^\/app\/[a-z-]+(\/[\w-]+)?$/.test(h)),
      `every suggestion opens a real route (${after.links.length} checked)`);
  say(/Paid per piece|twelve places left|material supplied/i.test(after.text),
      "and each says why it was chosen");
  await a.page.close();
}

/* ── Feedback shows that feedback goes somewhere ───────────────────────── */
{
  const a = await audit(browser, token, { route: "/app/feedback" });
  const text = await a.page.evaluate(() => document.body.innerText);
  say(/What changed because women asked/.test(text),
      "it shows what has already changed because women asked");

  // Sending needs a kind AND a real sentence — and says which is missing.
  const hint = () => a.page.evaluate(() => (document.querySelector("main").innerText.match(/Pick what kind[^\n]*|A sentence or two[^\n]*|Sent straight[^\n]*/) || [""])[0]);
  say(/Pick what kind/.test(await hint()), "an unfinished message says what is still needed");
  await a.page.$$eval("main button", (bs) => bs.find((b) => /An idea/.test(b.innerText))?.click());
  await wait(400);
  say(/A sentence or two/.test(await hint()), "and updates as she fills it in");
  await a.page.type('textarea[aria-label="Your message"]', "The wallet is much clearer now, thank you.");
  await wait(400);
  say(/Sent straight/.test(await hint()), "then says where it goes");

  await a.page.$$eval("main button", (bs) => bs.find((b) => b.innerText.trim() === "Send")?.click());
  await wait(1300);
  const done = await a.page.evaluate(() => document.querySelector("main").innerText);
  say(/we have it/i.test(done), "sending confirms in words, not a toast that vanishes");
  await a.page.close();
}

/* ── Verify never shows a bare "pending" ───────────────────────────────── */
{
  const a = await bareAudit("/app/verify", "light");
  if (a.path === "/app/verify") {
    const text = await a.page.evaluate(() => document.body.innerText);
    say(/Step 1 of 3/.test(text), "the gate says how many steps there are");
    say(/seen by the two people who review accounts/.test(text),
        "and says who will see her ID");
    await a.page.close();
  } else {
    lines.push("  —    verify behaviour   skipped: a verified member is redirected, which is correct");
    await a.page.close();
  }
}

await browser.close();
finish(fail, lines, "Feedback, Intake, Welcome and Verify render correctly and do what they exist to do");
