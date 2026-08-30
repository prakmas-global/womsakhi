/**
 * Her papers, against the real server.
 *
 * The vault faked all three of its upload buttons: each set a flag, cleared it
 * 1.2 seconds later, and left the row still saying the paper was missing. It
 * also printed a file size picked from a list of three by row position, and a
 * "Used by" list naming Mudra Yojana and Mahila Samman — beside its own note
 * that removing a paper "can quietly stop a loan application she is still
 * waiting on".
 */
import { API, launch, pageAs, seededMemberToken } from "./_shared.mjs";
import { APP, finish, wait } from "./_screen.mjs";

const fail = [];
const lines = [];
const say = (ok, msg) => { lines.push(`  ${ok ? "ok  " : "✗   "} ${msg}`); if (!ok) fail.push(msg); };

const token = await seededMemberToken();
const ask = (path, init) =>
  fetch(API + path, {
    headers: { Cookie: `access_token=${token}`, "Content-Type": "application/json" },
    ...init,
  }).then((r) => r.json());

const before = await ask("/me/documents");
const browser = await launch();
const page = await pageAs(browser, token, { width: 1500, height: 950 });
await page.goto(`${APP}/app/documents/vault`, { waitUntil: "domcontentloaded", timeout: 180000 });
await wait(5000);
const text = () => page.evaluate(() => document.getElementById("ux-scroll")?.innerText ?? "");

/* ── Nothing on the screen is invented ─────────────────────────────────── */
{
  const t = await text();
  say(!/Mudra Yojana|Mahila Samman|Stand-Up India/.test(t),
      "no scheme is named as using a paper — the API does not carry that");
  say(!/1\.2 MB|820 KB|2\.1 MB/.test(t) || before.length > 0,
      "file sizes are not picked from a hardcoded list");
}

/* ── The picker is real, and the upload reaches the server ─────────────── */
{
  const hasInput = await page.$$eval("input[type=file]", (i) => i.length > 0);
  say(hasInput, "there is a real file input behind the button");

  const accepts = await page.$eval("input[type=file]", (i) => i.getAttribute("accept") ?? "");
  say(accepts.includes("application/pdf") && accepts.includes("image/jpeg"),
      `and it accepts what the server accepts (${accepts.split(",").length} types)`);

  // A one-pixel PNG, set on the input the way a person choosing a file would.
  const sent = await page.evaluate(async () => {
    const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
    const file = new File([bytes], "aadhaar-check.png", { type: "image/png" });
    const input = document.querySelector("input[type=file]");
    if (!input) return false;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  });
  say(sent, "a chosen file reaches the screen's handler");
  await wait(6000);

  const after = await ask("/me/documents");
  say(after.length === before.length + 1,
      `THE SERVER RECEIVED THE PAPER (${before.length} → ${after.length})`);

  const fresh = after.find((d) => !before.some((b) => b.id === d.id));
  say(!!fresh && fresh.filename === "aadhaar-check.png",
      `and it is the file that was chosen ("${fresh?.filename ?? "none"}")`);
  say(!!fresh && fresh.size > 0, `with its real size recorded (${fresh?.size ?? 0} bytes)`);
}

/* ── A file it cannot take is refused before it is sent ────────────────── */
{
  const countBefore = (await ask("/me/documents")).length;
  await page.evaluate(async () => {
    const file = new File(["not a document"], "notes.txt", { type: "text/plain" });
    const input = document.querySelector("input[type=file]");
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(2500);
  const t = await text();
  say(/photo or a PDF/.test(t), "a text file is refused in words she can act on");
  const countAfter = (await ask("/me/documents")).length;
  say(countAfter === countBefore, "and nothing was sent (the refusal happened before the upload)");
}

await browser.close();
finish(fail, lines, "The vault sends real papers and invents nothing");
