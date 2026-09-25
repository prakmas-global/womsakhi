/*
  WomSakhi service worker — deliberately, aggressively conservative.

  ── What this file refuses to do, and why ──────────────────────────────────
  This app is authenticated and every screen is somebody's private life: her
  savings, her circle, her health records, her complaints. A service worker
  sits between the browser and the network with no idea who is signed in, so
  ANY cached HTML or API response is a page that can be handed to whoever
  opens the browser next. On a shared phone — which is the normal case for the
  women this is built for — that is not a stale-data bug, it is one woman
  reading another's money.

  So this worker caches static bytes only, and everything that could carry a
  person in it is passed straight through to the network untouched:

    NEVER cached   navigations and HTML, RSC payloads, /api/*, anything
                   cross-origin, anything non-GET, /_next/image (it proxies
                   arbitrary URLs, including member photos), and any response
                   that says `Vary: Cookie` or `Cache-Control: private`.
    Cached         /_next/static/* (content-hashed, so it cannot go stale),
                   /icons/*, /ux/* (the art, brand and vector assets), and the
                   handful of root-level brand files.

  The honest consequence: this app does NOT work offline. It cannot — the HTML
  is per-woman and must come from the server. What offline buys is a proper
  offline page instead of the browser's dinosaur, and instant paint of the
  shell's CSS, JS and art on every repeat visit including flaky 2G.

  ── The update path ────────────────────────────────────────────────────────
  A service worker with no way to update pins an old build forever and is
  worse than no service worker at all. Three things prevent that here:
    1. cache names carry VERSION, and `activate` deletes everything else;
    2. the page posts SKIP_WAITING as soon as a new worker is installed, so
       the replacement never sits waiting for every tab to close;
    3. the registrar re-checks for a new worker each time the app is brought
       back to the foreground, which is the only moment an installed PWA has.
*/

const VERSION = "v1";
const SHELL = `womsakhi-shell-${VERSION}`;
const ART = `womsakhi-art-${VERSION}`;
const KEEP = [SHELL, ART];

/* Cache ceilings. Without them a long-lived install grows without limit and
   the browser eventually evicts the whole origin — including, on some
   platforms, IndexedDB and localStorage. */
const LIMITS = { [SHELL]: 220, [ART]: 140 };

/* Only these prefixes are ever written to a cache. An allow-list, not a
   deny-list: a new authenticated route added next month is excluded by
   default rather than by somebody remembering to exclude it. */
const SHELL_PREFIXES = ["/_next/static/"];
const ART_PREFIXES = ["/icons/", "/ux/"];
const ART_FILES = [
  "/brand-mark.png",
  "/womsakhi-mark.png",
  "/womsakhi-wordmark.png",
  "/womsakhi-symbol.png",
  "/womsakhi-lockup.png",
  "/womsakhi-lotus.png",
  "/icon.png",
  "/apple-icon.png",
  "/favicon.ico",
];

/*
  The offline page lives here, in the worker, rather than in a route.

  A cached `/offline` route would be one more HTML document to keep in sync
  with the build and one more thing that can go stale. Inline, it ships with
  the worker, is versioned with it, and needs no network fetch at install
  time — so a first visit on a dying connection still installs successfully.
*/
const OFFLINE_HTML = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>No connection — WomSakhi</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100dvh; display:grid; place-items:center; padding:28px;
         background:#f4f2fa; color:#161734;
         font:400 15px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; }
  .box { max-width:22rem; text-align:center; }
  img { width:88px; height:88px; border-radius:22px; margin:0 auto 20px; display:block; }
  h1 { font-size:20px; font-weight:700; margin:0 0 8px; }
  p { margin:0 0 22px; color:#5c6180; }
  button { font:inherit; font-weight:600; color:#fff; background:#7648b3; border:0;
           border-radius:14px; padding:13px 26px; min-height:48px; cursor:pointer; }
  .lines { list-style:none; margin:26px 0 0; padding:18px 0 0; border-top:1px solid #e0dcee;
           text-align:start; }
  .lines a { display:flex; align-items:baseline; gap:10px; min-height:48px; padding:6px 0;
             font-weight:700; font-size:17px; color:#7648b3; text-decoration:none; }
  .lines span { font-weight:400; font-size:13px; color:#5c6180; }
  @media (prefers-color-scheme: dark) {
    body { background:#14122a; color:#f2f0fb; } p { color:#a09bc2; }
    button { background:#8f6ae8; }
    .lines { border-top-color:#2b2748; } .lines a { color:#b79cf5; } .lines span { color:#a09bc2; }
  }
</style></head>
<body><div class="box">
  <img src="/icons/icon-192.png" alt="">
  <h1>You are offline</h1>
  <p>WomSakhi needs a connection to show your account. Your data is safe — nothing was lost.</p>
  <button onclick="location.reload()">Try again</button>

  <!--
    The numbers, written into this page.

    The Offline settings screen promises that "the helpline numbers" stay
    available without a connection. They did not: bucketFor refuses every
    /api/ path on purpose, and rightly — a cached wallet balance is her money
    written to disk, and the API's responses vary on her cookie. So the promise
    was true of nothing.

    These six are public, national and non-personal, they do not change, and
    they matter most in exactly the situation this page exists for. Written in
    here they need no cache, no session and no signal: the page is served by
    the worker itself, and tel: dials on a phone with no data at all.
  -->
  <ul class="lines">
    <li><a href="tel:181">181<span>Women&rsquo;s Helpline, all India</span></a></li>
    <li><a href="tel:112">112<span>Emergency &mdash; police, fire, ambulance</span></a></li>
    <li><a href="tel:7827170170">7827 170 170<span>Domestic abuse &mdash; NCW</span></a></li>
    <li><a href="tel:1098">1098<span>Childline</span></a></li>
    <li><a href="tel:14416">14416<span>Mental health &mdash; Tele-MANAS</span></a></li>
    <li><a href="tel:1091">1091<span>Women in distress</span></a></li>
  </ul>
</div></body></html>`;

const offlineResponse = () =>
  new Response(OFFLINE_HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Never let this stand in for a real page in the HTTP cache.
      "cache-control": "no-store",
    },
  });

self.addEventListener("install", () => {
  /* Nothing is pre-fetched. A precache list would be a second copy of the
     build's asset names, wrong the moment a chunk hash changes, and would make
     installing fail on the connections this is meant to help. Everything is
     cached as it is genuinely used. */
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n.startsWith("womsakhi-") && !KEEP.includes(n))
          .map((n) => caches.delete(n)),
      );
      // Take over open tabs now rather than at the next navigation, so the
      // caches this worker owns are the ones actually being read.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  // The page's half of the update path — see the registrar component.
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

/** Which cache, if any, is allowed to hold this URL. */
function bucketFor(url) {
  if (url.origin !== self.location.origin) return null;
  const p = url.pathname;
  // Belt and braces: these can never match the allow-list below, but naming
  // them makes the intent unmissable to the next person editing this file.
  if (p.startsWith("/api/") || p.startsWith("/_next/image")) return null;
  if (SHELL_PREFIXES.some((x) => p.startsWith(x))) return SHELL;
  if (ART_PREFIXES.some((x) => p.startsWith(x))) return ART;
  if (ART_FILES.includes(p)) return ART;
  return null;
}

/**
 * Is this response safe to keep?
 *
 * `basic` means same-origin and fully readable — an `opaque` cross-origin
 * response would be stored blind, and a 206 partial would be stored broken.
 * The `Vary` and `Cache-Control` checks are the ones that matter: they are how
 * a response says "I depend on who asked", and such a response must never be
 * replayed to someone else.
 */
function storable(res) {
  if (!res || !res.ok || res.status !== 200 || res.type !== "basic") return false;
  const vary = res.headers.get("vary") || "";
  if (/cookie|authorization/i.test(vary)) return false;
  const cc = res.headers.get("cache-control") || "";
  if (/no-store|private/i.test(cc)) return false;
  return true;
}

async function trim(name) {
  const limit = LIMITS[name];
  if (!limit) return;
  const cache = await caches.open(name);
  const keys = await cache.keys();
  // Cache keys come back in insertion order, so the front of the list is the
  // oldest — a good enough eviction order for immutable assets.
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
    await cache.delete(key);
  }
}

async function put(name, request, response) {
  try {
    const cache = await caches.open(name);
    await cache.put(request, response);
    await trim(name);
  } catch {
    // Quota exceeded, or storage disabled by policy. The response was already
    // returned to the page; caching it was only ever a bonus.
  }
}

/** Immutable assets: from cache when present, from the network otherwise. */
async function cacheFirst(bucket, request) {
  const hit = await caches.match(request, { cacheName: bucket });
  if (hit) return hit;
  const res = await fetch(request);
  if (storable(res)) put(bucket, request, res.clone());
  return res;
}

/** Documents: always the network. Offline is the only time we substitute. */
async function networkOnlyDocument(request) {
  try {
    return await fetch(request);
  } catch {
    return offlineResponse();
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // A POST is an action, not a document. Never intercept one — replaying a
  // payment or a message from a cache is unthinkable.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Chrome's dev-tools and extensions issue chrome-extension:// requests that
  // a worker cannot serve.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (request.mode === "navigate") {
    event.respondWith(networkOnlyDocument(request));
    return;
  }

  const bucket = bucketFor(url);
  if (!bucket) return; // Not ours: the browser fetches it exactly as it would without us.

  event.respondWith(cacheFirst(bucket, request));
});

/* ── web push ─────────────────────────────────────────────────────────────
   A reminder arriving while the app is closed.

   Without these two handlers a push is delivered to the worker and nothing
   happens: the subscription is live, the server records a successful send,
   and her phone stays silent — the hardest kind of failure to notice, because
   every log says it worked.

   `showNotification` is not optional. The subscription is created with
   `userVisibleOnly: true`, so a push that does not display something is a
   promise broken to the browser, and Chrome eventually revokes the
   subscription for it.
*/

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    // A payload that is not JSON is still worth showing rather than dropping.
    data = { title: "WomSakhi", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "WomSakhi";
  const options = {
    body: data.body || "",
    icon: "/icon.png",
    badge: "/icon.png",
    // Her own reminder, on a phone that may be shared: no amounts, no health
    // detail. The server already renders these short — this is the second
    // place that has to stay true.
    tag: data.tag || data.occurrence_id || "womsakhi",
    // Replace rather than stack: five of the same reminder on a lock screen is
    // how a woman turns the whole thing off.
    renotify: Boolean(data.tag || data.occurrence_id),
    data: {
      url: data.url || "/app/reminders",
      occurrence_id: data.occurrence_id || "",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/app/reminders";

  // Focus a tab she already has open rather than opening a third one. A woman
  // who taps three reminders should not end up with three copies of the app.
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((tabs) => {
      for (const tab of tabs) {
        if ("focus" in tab) {
          if ("navigate" in tab) void tab.navigate(target);
          return tab.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
