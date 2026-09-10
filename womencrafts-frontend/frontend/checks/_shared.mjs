/** Shared plumbing for the browser checks. */
import { createRequire } from "module";
import puppeteer from "puppeteer-core";

export const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/**
 * The API the APP talks to — read from `.env.local`, the same file Next reads.
 *
 * Two things made this worth doing properly. A hardcoded port meant the checks
 * and the browser could drive different backends, so a fix verified by curl was
 * not necessarily the code the screens ran. And reading `process.env` alone was
 * not enough: these run outside Next, which is what loads `.env.local`, so the
 * variable was simply absent and the stale default won.
 */
function apiFromEnvFile() {
  const req = createRequire(import.meta.url);
  const fs = req("fs"), path = req("path");
  for (const name of [".env.local", ".env"]) {
    const file = path.resolve(process.cwd(), name);
    if (!fs.existsSync(file)) continue;
    const line = fs.readFileSync(file, "utf8")
      .split("\n")
      .find((l) => l.trim().startsWith("NEXT_PUBLIC_API_URL="));
    if (line) return line.split("=").slice(1).join("=").trim();
  }
  return null;
}

export const API = (
  process.env.NEXT_PUBLIC_API_URL || apiFromEnvFile() || "http://127.0.0.1:8000/api/v1"
).replace("localhost", "127.0.0.1");

/**
 * Where the APP is served. Port comes from the environment so the checks and
 * the dev server cannot drift apart. The app is on :3000; the API is on :8020
 * rather than :8000/:8002, because unrelated Docker containers on this machine
 * reclaim those the moment Docker Desktop starts.
 */
// 3100, never 3000: port 3000 on this machine belongs to an unrelated
// project. A check that defaults there does not just fail — it drives a
// real browser against someone else's running app.
export const APP = process.env.APP_URL || `http://localhost:${process.env.PORT || 3100}`;

export async function staffToken() {
  const r = await fetch(`${API}/auth/signin`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@womsakhi.com", password: "admin12345" }),
  }).then((x) => x.json());
  return r.access_token || r.token;
}

/** A verified member, created on the fly — seeded members have no usable password. */
export async function memberToken(staff) {
  const H = { "Content-Type": "application/json", Authorization: `Bearer ${staff}` };
  const email = `check.${Date.now()}@example.com`, pw = "TestMember!2345";
  const su = await fetch(`${API}/auth/signup`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ full_name: "Check Member", email, password: pw }),
  }).then((r) => r.json()).catch(() => null);
  const id = su?.user?.id || su?.user?._id;
  if (id) await fetch(`${API}/verification/${id}/approve`, {
    method: "POST", headers: H, body: JSON.stringify({ note: "checks" }) }).catch(() => {});
  const tok = await fetch(`${API}/auth/signin`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pw }),
  }).then((r) => r.json()).then((j) => j.access_token || j.token).catch(() => null);
  if (tok) await fetch(`${API}/theme/onboarding/finish`, {
    method: "POST", headers: { Authorization: `Bearer ${tok}` } }).catch(() => {});
  return tok;
}

/**
 * Sign in as a member who HAS data.
 *
 * `memberToken()` signs up a fresh account, which is right for testing what a
 * new member sees — and useless for testing whether a screen renders rows,
 * because a new member has none. Measuring "did seeding work?" against a
 * brand-new account reported every screen as still empty when the data was
 * there all along.
 */
export async function seededMemberToken() {
  const r = await fetch(`${API}/auth/signin`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "priya.sharma@example.com", password: "Womsakhi!2026" }),
  }).then((x) => x.json()).catch(() => null);
  return r?.access_token || r?.token || null;
}

export const launch = () =>
  puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

export async function pageAs(browser, token, { width = 1600, height = 1000, mode } = {}) {
  const p = await browser.newPage();
  await p.setViewport({ width, height });
  await p.setCookie({ name: "access_token", value: token, domain: "localhost", path: "/" });
  if (mode) await p.setCookie({ name: "theme", value: mode, domain: "localhost", path: "/" });
  return p;
}

/**
 * Measure text contrast on the current page.
 *
 * Canvas-based so `lab()`/`oklab()` resolve correctly, and skips text over a
 * gradient — a gradient has no computed backgroundColor, so walking up would
 * find the card beneath and report white-on-pale at 1.1:1 that nobody can see.
 */
export const measureContrast = (page) => page.evaluate(() => {
  const cv = document.createElement("canvas"); cv.width = cv.height = 1;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  const cache = new Map();
  const toRGB = (css) => {
    if (cache.has(css)) return cache.get(css);
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data; const v = [d[0], d[1], d[2]];
    cache.set(css, v); return v;
  };
  const lum = ([r, g, b]) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const vis = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const c = getComputedStyle(n);
      if (c.display === "none" || c.visibility === "hidden" || c.opacity === "0") return false;
    } return true;
  };
  /**
   * The colour actually painted behind `el`.
   *
   * Naively taking the first non-transparent `backgroundColor` up the chain is
   * wrong twice over:
   *
   *  · A translucent background (`bg-white/25`) has to be composited over what
   *    is beneath it. Painting it on the measuring canvas alone composited it
   *    over white, so a legible white badge on a brand gradient was reported as
   *    white-on-white at 1.00:1.
   *  · A gradient or image has no single colour at all. Those are returned as
   *    `null` and the element is skipped, rather than guessed at.
   */
  /**
   * Is this colour translucent?
   *
   * Determined by painting it over white and over black and comparing, rather
   * than by parsing the string. `bg-white/25` computes to
   * `oklab(0.999 … / 0.25)`, and a regex that only understands `rgba()` reads
   * that alpha as 1 — which is exactly the bug that made a legible white badge
   * on a brand gradient report as white-on-white at 1.00:1.
   *
   * The canvas understands every colour syntax the browser does. Parsing does
   * not, and every attempt to parse has been wrong at least once.
   */
  const isTranslucent = (css) => {
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
    const onWhite = ctx.getImageData(0, 0, 1, 1).data[0];
    ctx.clearRect(0, 0, 1, 1); ctx.fillStyle = "#000"; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = css; ctx.fillRect(0, 0, 1, 1);
    const onBlack = ctx.getImageData(0, 0, 1, 1).data[0];
    return Math.abs(onWhite - onBlack) > 1;
  };

  /**
   * The colour actually painted behind `el`.
   *
   * Layers are collected up the ancestor chain and then painted onto the canvas
   * in order — base first, translucent layers on top — so the browser's own
   * compositing produces the answer. Doing the alpha maths by hand meant
   * re-implementing something the canvas already does correctly.
   *
   * Returns `null` over a gradient or photo: those have no single colour, and
   * guessing produced phantom failures at 1.1:1 that nobody could see.
   */
  const resolveBg = (el) => {
    const layers = [];
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      const bi = cs.backgroundImage;
      if (bi && bi !== "none") return null;
      const bg = cs.backgroundColor;
      if (!bg || /rgba\(0, 0, 0, 0\)|^transparent$/.test(bg)) continue;
      layers.push(bg);
      if (!isTranslucent(bg)) break;
    }
    // The page canvas is the floor, and it is themed — not white.
    const body = getComputedStyle(document.body).backgroundColor;
    if (!layers.length || isTranslucent(layers[layers.length - 1])) {
      layers.push(body && !/rgba\(0, 0, 0, 0\)|^transparent$/.test(body) ? body : "rgb(255,255,255)");
    }
    ctx.clearRect(0, 0, 1, 1);
    for (let i = layers.length - 1; i >= 0; i--) {
      ctx.fillStyle = layers[i];
      ctx.fillRect(0, 0, 1, 1);
    }
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  };

  const out = {};
  document.querySelectorAll("p,span,a,h1,h2,h3,h4,li,td,th,label,button,div").forEach((el) => {
    if (el.children.length > 0 || !vis(el)) return;
    const t = (el.textContent || "").trim(); if (t.length < 3) return;
    const bg = resolveBg(el);
    if (!bg) return; // over a gradient or photo — cannot be measured this way
    const cs = getComputedStyle(el);
    const L1 = lum(toRGB(cs.color)), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), bold = parseInt(cs.fontWeight) >= 700;
    const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
    if (ratio < need) {
      const [r, g, b] = toRGB(cs.color), [br, bg2, bb] = bg;
      const key = `rgb(${r},${g},${b}) on rgb(${br},${bg2},${bb}) @${Math.round(size)}px = ${ratio.toFixed(2)}:1 (need ${need})`;
      out[key] = (out[key] || 0) + 1;
    }
  });
  return out;
});

/** Every route, read from the file tree so none can be forgotten. */
export function routes() {
  // `require` does not exist in an ES module — this threw for every caller.
  const req = createRequire(import.meta.url);
  const fs = req("fs"), path = req("path");
  const walk = (dir, base) => {
    let out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (e.name.startsWith("[")) continue; out = out.concat(walk(p, `${base}/${e.name}`)); }
      else if (e.name === "page.tsx") out.push(base || "/");
    } return out;
  };
  return { admin: walk("src/app/dashboard", "/dashboard"), member: walk("src/app/app", "/app") };
}

/**
 * A fresh, upcoming booking she can cancel.
 *
 * Checks that press "Cancel" consume one, and there is a finite supply in the
 * seed. Left alone, the first run passes and every run after it fails with
 * "the bookings list offers Cancel" — which reads exactly like a regression
 * and is not one. Each check that spends a booking makes its own first.
 */
export async function seedCancellableBooking(token, { paid = false } = {}) {
  const call = (path, init) =>
    fetch(API + path, {
      headers: { Cookie: `access_token=${token}`, "Content-Type": "application/json" },
      ...init,
    }).then((r) => r.json());

  const services = await call("/catalog/services");
  let list = Array.isArray(services) ? services : services.items ?? [];
  // `price` is a display string — "Free" or "₹499". A check that needs
  // something to pay for must not be handed the free one, which the server
  // rightly refuses to raise an order against.
  if (paid) list = list.filter((s) => s.price && !/free/i.test(s.price));
  if (!list.length) throw new Error(paid ? "no paid service in the catalogue" : "no service in the catalogue to book");

  // The server refuses a slot she already holds, which is right — so the
  // seeder walks forward until it finds one free rather than assuming.
  // Far enough ahead that no cut-off rule refuses the cancellation.
  const times = ["09:00", "11:00", "14:00", "16:00"];
  let last = null;
  // Start somewhere different each run. Always probing from day 21 means every
  // check after the first walks through slots the earlier ones already took —
  // hundreds of round trips to Atlas before it finds a free one.
  // A wide window, because every check that seeds a booking narrows it. With
  // a 120-day span the sweep started colliding once a dozen checks had each
  // taken a slot; a year is not expensive to search and collides far less.
  const from = 21 + Math.floor(Math.random() * 365);
  for (let day = from; day < from + 30; day++) {
    for (const time of times) {
      for (const svc of list.slice(0, 3)) {
        const when = new Date(Date.now() + day * 864e5).toISOString().slice(0, 10);
        const made = await call("/me/bookings", {
          method: "POST",
          body: JSON.stringify({ service_id: svc.id, date: when, time, mode: "online", note: "" }),
        });
        if (made?.id) return made;
        last = made;
      }
    }
  }
  throw new Error(`could not seed a booking: ${JSON.stringify(last).slice(0, 160)}`);
}
