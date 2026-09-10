/**
 * The Earn board, against `Womsakhi-user-ux/Earn-assets`.
 *
 * The drawing is 1586x992 and fills it exactly: a hero band, then eight cards
 * in two rows of four, then canvas. So there are three separate claims here
 * and they pull against each other:
 *
 *   **Everything drawn is there.** Eight places, each titled, sub-titled,
 *   linked, and carrying its own picture; and the pills under them — nineteen
 *   across the board — each linking to the child route it names. A card that
 *   renders its title and silently drops its pills still looks fine in a
 *   screenshot, which is why they are counted rather than eyeballed.
 *
 *   **It fits the window.** No scrollbar from `xl` up, at the board's own size
 *   and on a 1440x900 laptop. Density steps down by window height; the layout
 *   does not.
 *
 *   **Nothing was clipped to make it fit.** The first way to pass the fit test
 *   is to squash the cards until the pills overflow their box invisibly, so
 *   the pill rows are measured against their container and the two rows are
 *   asserted to still be four columns wide.
 *
 * And on a phone the opposite is required: it must scroll rather than hide.
 */
import puppeteer from "puppeteer-core";
import { CHROME, APP, seededMemberToken } from "./_shared.mjs";

/** title, href, how many pills, which picture. Straight from the drawing. */
const PLACES = [
  ["Your shop", "/app/documents", 3, "earn-shop"],
  ["Ways to sell", "/app/shop", 9, "earn-ways"],
  ["Your link, and getting paid", "/app/collect", 0, "earn-link"],
  ["The market", "/app/market", 1, "earn-market"],
  ["Selling food from home", "/app/kitchen", 0, "earn-kitchen"],
  ["Who owes you money", "/app/books", 2, "earn-books"],
  ["Your money", "/app/money", 2, "earn-money"],
  ["Your wallet", "/app/wallet", 2, "earn-wallet"],
  /* The two the drawing leaves out, drawn wide beneath the eight. */
  ["Your locker", "/app/vault", 4, "icon-padlock"],
  ["What you are owed", "/app/haq", 2, "scene-woman-reading-document"],
];

/** Every pill, and the route it must actually go to. */
const CHIPS = [
  ["Everything you sell", "/app/documents/listings"],
  ["Add something to sell", "/app/documents/new"],
  ["Your shop papers", "/app/documents/vault"],
  ["What should you charge", "/app/shop/pricing"],
  ["Take the money first", "/app/shop/preorders"],
  ["Regular customers", "/app/shop/subscriptions"],
  ["Who buys from you", "/app/shop/buyers"],
  ["Sell while you work", "/app/shop/live"],
  ["Sell to shops", "/app/shop/wholesale"],
  ["Say it instead of typing", "/app/shop/voice"],
  ["Sell your time", "/app/shop/slots"],
  ["When something goes wrong", "/app/shop/disputes"],
  ["Buy together", "/app/group-buy"],
  ["Proof you earn", "/app/books/proof"],
  ["Your busy months", "/app/books/season"],
  ["What you paid", "/app/payments"],
  ["If something goes wrong", "/app/cover"],
  ["Your statement", "/app/wallet/statement"],
  ["Take money out", "/app/wallet/withdraw"],
  ["Save without thinking", "/app/vault/rules"],
  ["What you put aside", "/app/vault/history"],
  ["Who can see it", "/app/vault/privacy"],
  ["Showing someone your phone", "/app/vault/showing"],
  ["Your papers", "/app/haq/papers"],
  ["What you can recover", "/app/haq/recover"],
];

const tok = await seededMemberToken();
const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
await p.setViewport({ width: 1586, height: 992, deviceScaleFactor: 1 });
await p.goto(APP + "/app/earn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForFunction(() => /Sell it, and get paid/.test(document.querySelector("#content")?.innerText ?? ""),
                        { timeout: 90000 });
await new Promise(x => setTimeout(x, 2200));

let bad = 0;
const say = (ok, msg) => { console.log(`  ${ok ? "ok  " : "FAIL"}  ${msg}`); if (!ok) bad++; };

/* ── everything drawn is there ──────────────────────────────────────────── */

const seen = await p.evaluate((args) => {
  const c = document.querySelector("#content");
  const text = c.innerText;
  const hrefs = [...c.querySelectorAll("a")].map(a => a.getAttribute("href"));
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden";
  };
  const cards = [...c.querySelectorAll("[data-earn-card]")];
  return {
    heading: /^Earn$/m.test(text) && /Sell it, and get paid/.test(text),
    count: /10 places, nothing hidden/.test(text),
    banner: (() => {
      const im = c.querySelector('img[src*="earn-hero-banner"]');
      return !!im && im.naturalWidth > 0 && shown(im);
    })(),
    cardCount: cards.length,
    places: args.PLACES.map(([t, href, pills, art]) => {
      const card = cards.find(el => el.dataset.earnCard === href);
      const im = card && card.querySelector(`img[src*="${art}"]`);
      return {
        t,
        titled: text.includes(t),
        linked: hrefs.includes(href),
        pills: card ? card.querySelectorAll("[data-earn-chip]").length : -1,
        wantPills: pills,
        art: !!im && im.naturalWidth > 0 && shown(im),
      };
    }),
    chips: args.CHIPS.map(([label, href]) => {
      const el = [...c.querySelectorAll("[data-earn-chip]")]
        .find(x => (x.textContent || "").trim() === label);
      return { label, there: !!el && shown(el), linked: !!el && el.getAttribute("href") === href };
    }),
    /* The two the board does not draw a card for still have to be reachable,
       or "nothing hidden" is a lie. They live in the rail. */
    also: ["/app/vault", "/app/haq"].filter(h =>
      [...document.querySelectorAll("a")].some(a => a.getAttribute("href") === h)).length,
  };
}, { PLACES, CHIPS });

say(seen.heading, "the band leads with “Earn” and “Sell it, and get paid”");
say(seen.count, "and says how many places there are");
say(seen.banner, "the supplied hero art is drawn");
say(seen.cardCount === 10, `all ten places have a card (${seen.cardCount})`);

const untitled = seen.places.filter(x => !x.titled || !x.linked).map(x => x.t);
say(untitled.length === 0,
    untitled.length ? `every place is named and linked (missing: ${untitled.join(", ")})`
                    : "every place is named and linked");
const wrongPills = seen.places.filter(x => x.pills !== x.wantPills)
  .map(x => `${x.t} has ${x.pills}, drawn with ${x.wantPills}`);
say(wrongPills.length === 0,
    wrongPills.length ? `each card carries the pills it is drawn with (${wrongPills.join("; ")})`
                      : "each card carries exactly the pills it is drawn with");
const dark = seen.places.filter(x => !x.art).map(x => x.t);
say(dark.length === 0,
    dark.length ? `every card's picture is drawn (missing: ${dark.join(", ")})`
                : "every card's picture is drawn");

const lostChips = seen.chips.filter(x => !x.there).map(x => x.label);
const misrouted = seen.chips.filter(x => x.there && !x.linked).map(x => x.label);
say(lostChips.length === 0,
    lostChips.length ? `all ${CHIPS.length} pills are on screen (missing: ${lostChips.join(", ")})`
                     : `all ${CHIPS.length} pills are on screen`);
say(misrouted.length === 0,
    misrouted.length ? `every pill goes where it says (wrong: ${misrouted.join(", ")})`
                     : "every pill goes where it says");
say(seen.also === 2, `the two places without a card are still reachable in the rail (${seen.also} of 2)`);

/* ── it fits, and nothing was clipped to make it fit ─────────────────────── */

/* Three real windows, one per density tier below the drawing: its own
   size, a 1440x900 laptop, and a 1366x768 one. A tier with no viewport
   exercising it is a tier nobody notices is wrong. */
for (const [w, h] of [[1586, 992], [1440, 900], [1366, 768]]) {
  await p.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await new Promise(x => setTimeout(x, 900));
  const m = await p.evaluate(() => {
    const sc = document.getElementById("ux-scroll");
    const grid = document.querySelector("[data-earn-grid]");
    const cards = [...grid.querySelectorAll("[data-earn-card]")];
    const rows = new Set(cards.map(el => Math.round(el.getBoundingClientRect().top)));
    /* A pill row that overflows its card is invisible in a screenshot and is
       exactly how a squashed card passes a fit test. Measured, not looked at. */
    const spill = [...document.querySelectorAll("[data-earn-card]")].filter(card => {
      const box = card.querySelector("[data-earn-chips]");
      if (!box) return false;
      /* A sideways-scrolling strip is not a spill — the two wide cards are
         built that way on purpose, and the fade on the end says so. What is
         never allowed is a wrapping row taller than its own box, because that
         hides a row of links with nothing on screen to reveal them. */
      if (getComputedStyle(box).overflowX === "auto") return false;
      return box.scrollHeight - box.clientHeight > 1 || box.scrollWidth - box.clientWidth > 1;
    }).map(card => card.dataset.earnCard);
    return {
      over: sc.scrollHeight - sc.clientHeight,
      cols: getComputedStyle(grid).gridTemplateColumns.split(" ").length,
      rows: rows.size,
      spill,
      shortest: Math.min(...cards.map(c => Math.round(c.getBoundingClientRect().height))),
    };
  });
  say(m.over <= 0, `${w}x${h}: the whole board is on screen (overflow ${m.over}px)`);
  say(m.cols === 4, `${w}x${h}: the cards are in four columns (${m.cols})`);
  say(m.rows === 2, `${w}x${h}: in two rows (${m.rows})`);
  say(m.spill.length === 0,
      m.spill.length ? `${w}x${h}: no card's pills overflow their box (spilling: ${m.spill.join(", ")})`
                     : `${w}x${h}: no card's pills overflow their box`);
  say(m.shortest > 120, `${w}x${h}: no card is squeezed to nothing (shortest ${m.shortest}px)`);
}

/* ── and a phone scrolls instead of hiding ──────────────────────────────── */

await p.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 1000));
const phone = await p.evaluate(() => {
  const sc = document.getElementById("ux-scroll");
  const cards = [...document.querySelectorAll("[data-earn-card]")];
  return {
    sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    cards: cards.length,
    shortest: Math.min(...cards.map(c => Math.round(c.getBoundingClientRect().height))),
    scrolls: sc.scrollHeight > sc.clientHeight,
  };
});
say(phone.sideways === 0, `390px: nothing runs off the side (${phone.sideways}px)`);
say(phone.cards === 10, `390px: every card is still rendered (${phone.cards})`);
say(phone.shortest > 100, `390px: no card is squeezed to nothing (shortest ${phone.shortest}px)`);
say(phone.scrolls, "390px: the page scrolls, rather than hiding what will not fit");

/* ── and every tap target is a tap target ───────────────────────────────── */

await p.setViewport({ width: 1586, height: 992, deviceScaleFactor: 1 });
await new Promise(x => setTimeout(x, 900));
const small = await p.evaluate(() =>
  [...document.querySelectorAll("#content [data-earn-chip]")]
    .map(el => ({ label: (el.textContent || "").trim(),
                  h: Math.round(el.getBoundingClientRect().height) }))
    .filter(x => x.h < 24));
say(small.length === 0,
    small.length ? `every pill clears the 24px target size (short: ${small.map(s => `${s.label} ${s.h}px`).join(", ")})`
                 : "every pill clears the 24px target size");

console.log(bad ? `\n FAIL  ${bad} failed` : "\n PASS  every part of the board is there, and it fits");
await b.close();
process.exit(bad ? 1 : 0);
