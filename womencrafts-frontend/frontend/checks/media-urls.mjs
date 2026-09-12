/**
 * No hostname is ever stored in the database.
 *
 * `POST /uploads` used to store the absolute URL it had just built —
 * `f"{MEDIA_BASE_URL}/media/{kind}/{name}"` — so the host of whichever machine
 * did the upload was written into Atlas permanently. A file uploaded from a
 * laptop carried `http://localhost:8020` into production, and the browser
 * refused it: forty CORS errors on a real phone, on images that existed and
 * were served correctly the whole time.
 *
 * **Nothing caught it, and the reason matters.** The value was right on the
 * machine that wrote it. The layout and screenshot checks never looked at the
 * console, so a broken <img> measured the same as a working one. `api.mjs`
 * asks for status codes, and the endpoint returned 200 with a poisoned string
 * inside it. The bug was only visible to a browser, in a different
 * environment, reading the console — which is to say, to nobody.
 *
 * So this asserts the invariant directly, in three places that each fail on
 * their own:
 *
 *   1. the SOURCE cannot build a stored URL — `MEDIA_BASE_URL` is readable
 *      only from the two files allowed to know about it;
 *   2. the DATABASE holds no loopback URL — delegated to the backend, which
 *      is the only thing here with a Mongo driver;
 *   3. a REAL upload round-trips — stored as a path, returned as a URL that
 *      actually loads, and an older absolute row still reads back unchanged.
 *
 * Run:  node checks/media-urls.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { API, staffToken, seededMemberToken } from "./_shared.mjs";

const BACKEND = "../../womencrafts-backend/backend";
const fails = [];
const note = (s) => console.log("  " + s);

// ── 1. The source cannot bake a host into anything ──────────────────────────
// Only the settings object that declares it and the module that builds URLs
// from it may name MEDIA_BASE_URL. Anywhere else is a value being assembled
// somewhere it will be stored, which is the original bug exactly.
// Matching the bare name caught prose: the migration script explains the bug
// in its docstring and was reported as committing it. Match the two shapes
// that are actually CODE instead — reading the setting, and declaring it.
const READS = /settings\.MEDIA_BASE_URL/;
const DECLARES = /^\s*MEDIA_BASE_URL\s*:/;
const MAY_READ = "app/core/media.py";
const MAY_DECLARE = "app/core/config.py";
if (!fs.existsSync(BACKEND)) {
  fails.push("backend source not found at " + BACKEND + " — cannot check the source");
} else {
  const py = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (["__pycache__", "venv", "media", "private_media", "outbox", ".git"].includes(e.name)) continue;
        walk(p);
      } else if (e.name.endsWith(".py")) py.push(p);
    }
  })(BACKEND);

  let scanned = 0;
  for (const file of py) {
    const rel = path.relative(BACKEND, file);
    scanned++;
    fs.readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      const code = line.split("#")[0];
      if (READS.test(code) && rel !== MAY_READ) {
        fails.push(`${rel}:${i + 1} reads settings.MEDIA_BASE_URL — only ${MAY_READ} may. ` +
                   `A host read anywhere else is a host about to be stored.`);
      }
      if (DECLARES.test(code) && rel !== MAY_DECLARE) {
        fails.push(`${rel}:${i + 1} declares MEDIA_BASE_URL — only ${MAY_DECLARE} may`);
      }
    });
  }
  note(`${scanned} backend files scanned — only ${MAY_READ} reads MEDIA_BASE_URL`);
}

// ── 2. The database holds no loopback URL ───────────────────────────────────
// The backend owns the Mongo connection, so the assertion is made there and
// its exit code is the answer. A missing venv is a FAILURE, not a skip: a
// check that quietly measures nothing is how this shipped the first time.
function dbHoldsNoHost(when) {
  try {
    const py = path.join(BACKEND, "venv/bin/python");
    if (!fs.existsSync(py)) throw new Error(`no interpreter at ${py}`);
    execFileSync(py, ["-m", "scripts.migrate_media_urls", "--strict"], {
      cwd: BACKEND, stdio: "pipe",
    });
    note(`database holds no loopback media URL (${when})`);
  } catch (e) {
    const out = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
    const lines = out.split("\n").filter((l) => /uploads\.|\w+\.\w+\s+[0-9a-f]{24}|FAIL/.test(l));
    fails.push(`a media URL with a loopback host is stored in the database (${when}):\n` +
               (lines.slice(0, 8).join("\n") || String(e.message)));
  }
}
// Once now, for rows that were already wrong …
dbHoldsNoHost("existing rows");

// ── 3. A real upload round-trips ────────────────────────────────────────────
const staff = await staffToken();
if (!staff) {
  fails.push("cannot sign in as staff — is the API running?");
} else {
  // A genuine 1×1 PNG. The endpoint sniffs the content type, so bytes that are
  // not really an image are rejected and would fail for the wrong reason.
  const PNG = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64");
  const form = new FormData();
  form.append("file", new Blob([PNG], { type: "image/png" }), `media-check-${Date.now()}.png`);
  form.append("kind", "avatar");

  const made = await fetch(`${API}/uploads`, {
    method: "POST", headers: { Authorization: `Bearer ${staff}` }, body: form,
  }).then((r) => r.json()).catch((e) => ({ error: String(e) }));

  if (!made?.id) {
    fails.push("upload failed: " + JSON.stringify(made).slice(0, 200));
  } else {
    const origin = API.replace(/\/api\/v1$/, "");
    // What comes BACK must be absolute and must load. Storing a path is only
    // correct if the read side puts a working host back on.
    if (!/^https?:\/\//.test(made.url || "")) {
      fails.push(`upload response url is not absolute: ${made.url}`);
    }
    const res = await fetch(made.url.replace("localhost", "127.0.0.1")).catch(() => null);
    // Read the body, not just the status. A 200 carrying nothing is a broken
    // image that measures exactly like a working one — and the body has to be
    // consumed anyway, or the socket stays half-open and the next request on
    // the pool dies with a bare "fetch failed".
    const bytes = res && res.ok ? (await res.arrayBuffer()).byteLength : 0;
    if (!res || !res.ok || bytes === 0) {
      fails.push(`the returned url does not load: ${made.url} → ` +
                 `${res ? `${res.status}, ${bytes} bytes` : "no response"}`);
    } else {
      note(`upload round-trip: stored a path, returned ${made.url} → ${res.status}, ${bytes} bytes`);
    }
    // `stored_name` is the relative name on disk and must agree with the URL,
    // so a build that quietly points somewhere else is caught too.
    if (made.stored_name && !made.url.endsWith(made.stored_name)) {
      fails.push(`url and stored_name disagree: ${made.url} vs ${made.stored_name}`);
    }
    // `_shared.mjs` rewrites localhost → 127.0.0.1 for the API it calls, while
    // the server builds from its own MEDIA_BASE_URL. Same host, two spellings —
    // comparing them raw reported a passing round trip as a failure.
    const sameHost = (u) => u.replace("localhost", "127.0.0.1");
    if (made.url && !sameHost(made.url).startsWith(sameHost(origin))) {
      fails.push(`url is not on this environment's host: ${made.url} (expected ${origin})`);
    }
    // … and again now, while the row this check just created still exists.
    // Checking only before the upload meant a reintroduced bug wrote a poisoned
    // row that nothing afterwards ever looked at — the DB assertion passed on
    // the very run that proved the bug was back.
    dbHoldsNoHost("the row this check just wrote");

    // Clean up after itself — the media library is a real screen and a check
    // that leaves litter in it is a check that degrades the thing it guards.
    // A swallowed failure here is how the media library fills up with probe
    // files nobody put there, so the status is asserted rather than ignored.
    // Retried once: `dbHoldsNoHost` runs execFileSync, which blocks the event
    // loop for as long as the scan takes. A keep-alive socket opened before it
    // is dead by the time it returns, and the first request after it fails with
    // a bare "fetch failed" that has nothing to do with the server.
    const del = () => fetch(`${API}/uploads/${made.id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${staff}` },
    }).catch((e) => ({ ok: false, status: e.message }));
    let gone = await del();
    if (!gone.ok) gone = await del();
    if (!gone.ok) fails.push(`could not delete the probe upload ${made.id}: ${gone.status}`);
  }

  // ── An older row that still holds an absolute URL must pass through ───────
  // There are rows written before the fix, on a host that still resolves.
  // Re-prefixing one would produce `https://api…/https://api…` — so read the
  // surfaces that carry media and assert no value has two schemes in it.
  const member = await seededMemberToken();
  if (!member) {
    fails.push("cannot sign in as the seeded member — cannot check the read side");
  } else {
    const seen = [];
    for (const p of ["/shop/listings", "/community/overview", "/me/profile", "/market/listings"]) {
      const body = await fetch(`${API}${p}`, {
        headers: { Authorization: `Bearer ${member}` },
      }).then((r) => r.json()).catch(() => null);
      if (!body) continue;
      (function walk(v, at) {
        if (typeof v === "string") { if (/\/media\//.test(v)) seen.push([`${p}${at}`, v]); }
        else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
        else if (v && typeof v === "object") for (const k in v) walk(v[k], `${at}.${k}`);
      })(body, "");
    }
    for (const [at, url] of seen) {
      if ((url.match(/https?:\/\//g) || []).length > 1) {
        fails.push(`double-prefixed media URL at ${at}: ${url}`);
      }
      if (!/^https?:\/\//.test(url)) {
        fails.push(`a media URL reached the client relative at ${at}: ${url}`);
      }
    }
    note(`${seen.length} media URL(s) across 4 endpoints — all absolute, none double-prefixed`);
  }
}

console.log();
if (!fails.length) {
  console.log("  \x1b[32mno hostname is stored in the database\x1b[0m\n");
  process.exit(0);
}
console.log(`  \x1b[31m${fails.length} failure(s)\x1b[0m\n`);
fails.forEach((f) => console.log("    " + f));
console.log();
process.exit(1);
