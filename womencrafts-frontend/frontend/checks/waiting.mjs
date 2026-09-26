/**
 * Does the app say what it is doing while she waits?
 *
 * ── What this is here to stop coming back ───────────────────────────────────
 * Signing out put a single 20px spinner in the middle of an empty page. No
 * logo, no words, nothing to distinguish "working" from "this phone has
 * stopped". On the connections this app is actually used on that screen could
 * last five or ten seconds, and for a woman who is new to a smartphone it is
 * not a loading state — it is a dead app.
 *
 * `checks/feedback.mjs` proves the source is consistent about telling her what
 * HAPPENED. This one is about the gap before that: what she is looking at while
 * it is still happening. Half of it is static, because a threshold that has
 * drifted is worth catching in a second; half of it drives a real browser on a
 * throttled connection, because "the curtain has words on it" is only true if
 * the stylesheet reached it, and that is a runtime fact.
 *
 * ── The one thing to know before editing ────────────────────────────────────
 * The curtain is portalled into <body>, which is outside the `.ux` wrapper that
 * every colour token in this app is declared on. It carries `ux` itself. If
 * somebody removes that class the screen still renders, still has the right
 * words in the DOM, and paints invisible ink on an invisible sheet — which no
 * static check can see. Test 4 below is the one that catches it.
 */
import { readFileSync, readdirSync } from "fs";

import { APP, launch, pageAs, seededMemberToken } from "./_shared.mjs";

const RED = "\x1b[31m", GREEN = "\x1b[32m", DIM = "\x1b[2m", OFF = "\x1b[0m";
const problems = [];
const ok = [];
const check = (name, pass, detail = "") =>
  pass ? ok.push(name) : problems.push(`${name}${detail ? ` — ${detail}` : ""}`);

const read = (f) => readFileSync(f, "utf8");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ═══ static ═══════════════════════════════════════════════════════════════ */

// ── 1. the thresholds are declared once, and are still sane ─────────────────
// Every one of these is a judgement about a person's attention, and each was
// argued for in `lib/wait.ts`. A number that drifts silently is a decision
// nobody made.
{
  const src = read("src/lib/wait.ts");
  const num = (name) => {
    const m = src.match(new RegExp(`export const ${name} = (\\d+)`));
    return m ? Number(m[1]) : null;
  };
  const showAfter = num("SHOW_AFTER");
  const minOn = num("MIN_ON");
  const slowAfter = num("SLOW_AFTER");
  const stuckAfter = num("STUCK_AFTER");

  check("the wait thresholds are exported from lib/wait.ts",
    showAfter !== null && minOn !== null && slowAfter !== null && stuckAfter !== null);

  // Under ~200ms a loader flashes; over ~1s she has already decided nothing
  // happened. Fluent 2 and the EC design system both put the floor at 1s of
  // total wait before an indicator is worth showing at all.
  check("nothing is shown before a grace period", showAfter >= 200 && showAfter <= 1000,
    `SHOW_AFTER is ${showAfter}ms`);
  // Oracle calls this the "linger". Without it a loader that goes up and comes
  // straight back down is a flicker, and a flicker reads as a fault.
  check("once shown it stays long enough to be read", minOn >= 300, `MIN_ON is ${minOn}ms`);
  // Nielsen's third limit is 10s. Saying "this is slow" only after she has
  // already given up is not saying it.
  check("it admits to being slow before attention leaves",
    slowAfter >= 3000 && slowAfter <= 10000, `SLOW_AFTER is ${slowAfter}ms`);
  check("it offers a way out after that", stuckAfter > slowAfter, `STUCK_AFTER is ${stuckAfter}ms`);
}

// ── 2. the bar never claims a percentage it does not have ───────────────────
// `aria-valuenow` on an indeterminate progressbar is a lie told to exactly the
// people who cannot check it against the screen. ARIA says to omit the
// attribute entirely when the value is unknown; this app draws a moving bar
// and puts the truth in words beside it.
{
  // Comments stripped first. This file EXPLAINS at length why there is no
  // `aria-valuenow` on it, and the first version of this rule read that
  // explanation as the offence.
  const src = read("src/components/ux/WaitScreen.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  check("the wait screen invents no progress figure", !/aria-valuenow\s*=/.test(src),
    "aria-valuenow on a bar that does not know");
  check("the bar is marked as decoration", /ux-wait-track[\s\S]{0,120}aria-hidden/.test(src));
  check("the words are a live region", /role="status"[\s\S]{0,80}aria-live="polite"/.test(src));
}

// ── 3. no full-screen wait without words ────────────────────────────────────
//
// The original fault, as a rule. A viewport-height box whose only content is a
// spinner is the screen this whole piece of work exists to remove.
//
// `src/app/app/MemberShell.tsx` is exempt, and it is the ONLY exemption: it is
// being rewritten by someone else as this lands, so editing it would mean two
// people writing the same file. It still has two of these gates. They are
// covered in practice — the sign-out curtain is fixed, opaque and above them,
// so she never sees either — but the exemption should be deleted, not renewed,
// the moment that rewrite is in.
const OWNED_ELSEWHERE = new Set(["src/app/app/MemberShell.tsx"]);
{
  const files = [];
  (function walk(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".tsx")) files.push(p);
    }
  })("src");

  const owed = [];
  for (const file of files) {
    const src = read(file);
    // A container that fills the window, and a spinner as its whole content.
    for (const m of src.matchAll(
      /<div[^>]*min-h-screen[^>]*>\s*(?:\{[^}]*\}\s*)?<(?:Spinner|Loader2?)\b[^>]*\/>\s*<\/div>/g,
    )) {
      const line = src.slice(0, m.index).split("\n").length;
      (OWNED_ELSEWHERE.has(file) ? owed : problems).push(
        `${file}:${line} — a full-screen wait with no words in it`,
      );
    }
  }
  check("no screen waits at full height without saying why", true);
  if (owed.length) {
    console.log(`\n  ${DIM}still owed (owned by another change right now):${OFF}`);
    owed.forEach((o) => console.log(`   ${DIM}· ${o}${OFF}`));
  }
}

// ── 4. an actionable toast has no deadline ──────────────────────────────────
// React Aria states it plainly: "actionable toasts will not auto dismiss."
// There is no duration long enough for a woman reading her second language
// word by word to finish the sentence, decide, and reach the button — and an
// Undo that expires while she reaches for it is worse than no Undo, because
// she believes she still has one.
{
  const src = read("src/design-system/feedback/ToastProvider.tsx");
  const def = Number((src.match(/const DEFAULT_MS = (\d+)/) || [])[1]);
  const act = Number((src.match(/const WITH_ACTION_MS = (\d+)/) || [])[1]);
  check("a plain confirmation lasts at least five seconds", def >= 5000, `DEFAULT_MS is ${def}ms`);
  check("a toast with a button on it never expires", act === 0, `WITH_ACTION_MS is ${act}ms`);
  check("a toast can always be dismissed", /aria-label={`Dismiss/.test(src));
}

/* ═══ in a browser, on a bad connection ════════════════════════════════════ */

const token = await seededMemberToken();
if (!token) {
  console.log(`\n  ${RED}could not sign in as a member — is the API up?${OFF}\n`);
  process.exit(1);
}

const browser = await launch();

/**
 * Slow enough that every loader this check is about stays on screen — and it
 * has to be lifted before each navigation, because the dev server ships an
 * unminified megabyte per route and 24 kbps will not finish it inside any
 * timeout worth having.
 */
const SLOW = { offline: false, latency: 1400, downloadThroughput: 24 * 1024, uploadThroughput: 12 * 1024 };
const FAST = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };

/**
 * A fresh page per scenario.
 *
 * These used to share one. Signing out on a shared page drops the session
 * cookie for every other tab in the same browser, and a hard `goto` layered on
 * top of an in-flight client navigation detaches the frame — which surfaces as
 * a puppeteer crash rather than as the race it is. One page, one journey.
 */
async function member(path) {
  const p = await pageAs(browser, token, { width: 412, height: 900, mode: "light" });
  // Retried once. Against a dev server the first request to a route pays for
  // compiling it, and a cold member app can take minutes — a timeout there is
  // a fact about the toolchain, not about the app.
  for (let attempt = 0; ; attempt++) {
    try {
      await p.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 180000 });
      break;
    } catch (e) {
      if (attempt >= 1) throw e;
    }
  }
  // The member shell hydrates and then fetches; `domcontentloaded` is only the
  // first of those.
  await p.waitForFunction(() => !!document.querySelector("button, a"), { timeout: 60000 })
    .catch(() => {});
  await sleep(2000);
  const cdp = await p.target().createCDPSession();
  await cdp.send("Network.enable");
  return { p, cdp };
}

try {
  /* ── 5. a slow route change grows words ─────────────────────────────────
     The 3px bar at the top of the window is a fine answer for 200ms and no
     answer at all for eight seconds — on a phone it sits beside the notch,
     above where anyone is looking. */
  {
    const { p, cdp } = await member("/app/settings");
    const beforePath = new URL(p.url()).pathname;
    await cdp.send("Network.emulateNetworkConditions", SLOW);
    const went = await p.evaluate(() => {
      const a = [...document.querySelectorAll("a[href^='/app/']")]
        .find((x) => new URL(x.href).pathname !== window.location.pathname);
      if (!a) return false;
      a.click();
      return true;
    });
    check("there is an internal link to press", went);

    let word = null;
    for (let i = 0; i < 45 && !word; i++) {
      await sleep(200);
      word = await p.evaluate(() => {
        const el = document.querySelector(".ux-loadword");
        if (!el) return null;
        const s = getComputedStyle(el.firstElementChild || el);
        return {
          text: (el.textContent || "").trim(),
          bg: s.backgroundColor,
          role: el.getAttribute("role"),
          live: el.getAttribute("aria-live"),
        };
      });
    }
    const afterPath = new URL(p.url()).pathname;
    check("a slow route change says so in words", !!word || afterPath !== beforePath,
      afterPath !== beforePath ? "the route completed before words were needed" : "no .ux-loadword appeared in 9s");
    if (word) {
      check("those words are more than one", word.text.split(/\s+/).filter(Boolean).length >= 2,
        `it said "${word.text}"`);
      check("they are announced politely", word.role === "status" && word.live === "polite",
        `role="${word.role}" aria-live="${word.live}"`);
      // The label carries `ux` for its variables and must put the canvas back:
      // left as-is it lays a bar of solid page colour across the top of the app.
      check("the label is a pill, not a bar across the screen",
        word.bg !== "rgba(0, 0, 0, 0)" && word.bg !== "transparent", `background was ${word.bg}`);
    }
    await cdp.send("Network.emulateNetworkConditions", FAST).catch(() => {});
    await p.close().catch(() => {});
  }

  /* ── 6-9. signing out ───────────────────────────────────────────────────── */
  {
    const { p, cdp } = await member("/app/settings");
    await cdp.send("Network.emulateNetworkConditions", SLOW);

    // 6. The press is answered before anything else happens. `Btn` holds itself
    // busy while a returned promise settles; the sign-out button used to be
    // `onClick={() => void signOut()}`, and the `void` threw that promise away —
    // so the one button in the app with the longest wait behind it was the one
    // button that did not answer a press.
    const pressed = await p.evaluate(() => {
      const b = [...document.querySelectorAll("button")]
        .find((x) => /sign out/i.test((x.textContent || "").trim()));
      if (!b) return "no sign-out button on /app/settings";
      b.setAttribute("data-signout-probe", "");
      b.click();
      return null;
    });
    if (pressed) {
      problems.push(`could not reach the sign-out button — ${pressed}`);
    } else {
      await sleep(150);
      const busy = await p.evaluate(() => {
        const b = document.querySelector("[data-signout-probe]");
        return b ? b.disabled === true || b.getAttribute("aria-disabled") === "true" : null;
      });
      check("the sign-out button answers the press at once", busy === true,
        "it stayed live while the request was in flight");

      // 7. The curtain: a mark, words, and a sheet you cannot see through.
      let curtain = null;
      for (let i = 0; i < 35 && !curtain; i++) {
        await sleep(200);
        curtain = await p.evaluate(() => {
          const el = document.querySelector(".ux-wait");
          if (!el) return null;
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const status = el.querySelector('[role="status"]');
          return {
            covers: r.width >= window.innerWidth - 1 && r.height >= window.innerHeight - 1,
            bg: s.backgroundColor,
            brand: !!el.querySelector('img[src*="brand"]'),
            words: (status?.textContent || "").trim(),
            live: status?.getAttribute("aria-live") || null,
            busy: el.getAttribute("aria-busy"),
            focusInside: el.contains(document.activeElement),
            inkColour: status?.querySelector("p") ? getComputedStyle(status.querySelector("p")).color : null,
            barValueNow: !!el.querySelector("[aria-valuenow]"),
          };
        });
      }
      check("signing out puts a real screen up, not a bare spinner", !!curtain,
        "nothing matching .ux-wait appeared within 7s");

      if (curtain) {
        check("it covers the app it is replacing", curtain.covers);
        // THE token test. A portal into <body> with no `ux` class resolves
        // every var(--ux-*) to nothing, and this is transparent.
        check("its tokens resolved — it is opaque",
          curtain.bg !== "rgba(0, 0, 0, 0)" && curtain.bg !== "transparent",
          `background was ${curtain.bg}`);
        check("the ink resolved too",
          !!curtain.inkColour && curtain.inkColour !== "rgba(0, 0, 0, 0)",
          `heading colour was ${curtain.inkColour}`);
        check("it shows the WomSakhi mark", curtain.brand, "no brand artwork on the screen");
        check("it says what is happening, in words",
          curtain.words.split(/\s+/).filter(Boolean).length >= 4, `it said "${curtain.words}"`);
        check("those words are announced politely", curtain.live === "polite",
          `aria-live="${curtain.live}"`);
        check("the region is marked busy", curtain.busy === "true");
        check("it does not steal focus", curtain.focusInside === false,
          "focus was moved into a screen that is about to be replaced");
        check("it claims no percentage it cannot know", curtain.barValueNow === false,
          "an aria-valuenow appeared on an indeterminate bar");
      }

      // 8. She lands on the front door, and is told she is out. The sign-in
      // screen still has to be fetched, and the wait being measured is over.
      await cdp.send("Network.emulateNetworkConditions", FAST).catch(() => {});
      await p.waitForFunction(() => window.location.pathname === "/signin", { timeout: 120000 })
        .catch(() => {});
      check("it ends on the sign-in screen", new URL(p.url()).pathname === "/signin", p.url());

      let toast = null;
      for (let i = 0; i < 30 && !toast; i++) {
        await sleep(200);
        toast = await p.evaluate(() => {
          const li = document.querySelector('ol[aria-label="Notifications"] > li');
          return li ? { text: (li.textContent || "").trim(), role: li.getAttribute("role") } : null;
        });
      }
      check("signing out confirms itself", !!toast,
        "no toast on the sign-in screen — the operation completed silently");
      if (toast) {
        check("the confirmation says she is signed out", /signed out/i.test(toast.text),
          `it said "${toast.text}"`);
        check("it is announced", toast.role === "status", `role="${toast.role}"`);
      }

      // 9. The curtain has gone.
      await p.waitForFunction(() => !document.querySelector(".ux-wait"), { timeout: 2000 }).catch(() => {});
      const lingering = await p.$(".ux-wait");
      check("the curtain comes down on arrival", !lingering, "it is still covering the sign-in form");

      /* ── 10. reduced motion switches the decoration off, not the message ──
         A member who asked her system to stop animations still needs to know
         the app is working. So the travelling sheen goes and the words stay. */
      await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
      const calm = await p.evaluate(() => {
        const host = document.createElement("div");
        host.className = "ux";
        host.innerHTML =
          '<div class="ux-wait-track"><div class="ux-wait-fill"><span class="ux-wait-sheen"></span></div></div>' +
          '<span class="ux-turn"></span>';
        document.body.appendChild(host);
        const sheen = getComputedStyle(host.querySelector(".ux-wait-sheen"));
        const fill = getComputedStyle(host.querySelector(".ux-wait-fill"));
        const turn = getComputedStyle(host.querySelector(".ux-turn"));
        const out = {
          sheen: sheen.display,
          fillTransition: `${fill.transitionProperty} ${fill.transitionDuration}`,
          turn: turn.animationName,
        };
        host.remove();
        return out;
      });
      check("reduced motion stops the travelling sheen", calm.sheen === "none", `display: ${calm.sheen}`);
      check("reduced motion stops the turning ring", calm.turn === "none", `animation: ${calm.turn}`);
      // Either the property list is empty or the duration is effectively zero.
      // The app has a global reduced-motion rule that collapses durations to
      // 0.001s, which is not "0s" and is not gliding either.
      const secs = Number((calm.fillTransition.match(/([\d.]+)s/) || [])[1] ?? 1);
      check("reduced motion stops the bar gliding",
        /(^|\s)none(\s|$)/.test(calm.fillTransition) || secs < 0.05,
        `transition: ${calm.fillTransition}`);
    }
    await p.close().catch(() => {});
  }
} finally {
  await browser.close().catch(() => {});
}

console.log(`\n  ${ok.length + problems.length} behaviours checked`);
if (!problems.length) {
  console.log(`  ${GREEN}every wait says what it is doing, in words she can read${OFF}\n`);
} else {
  console.log(`  ${RED}${problems.length} problems${OFF}\n`);
  problems.forEach((p) => console.log(`   · ${p}`));
  console.log();
}
process.exit(problems.length ? 1 : 0);
