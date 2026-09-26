/** Verify the complete circle wizard payload survives a real database round trip. */
import { APP, launch } from "./_shared.mjs";
const browser = await launch();
const page = await browser.newPage();
const checks = [];
const check = (ok, label, detail = "") => checks.push({ ok: Boolean(ok), label, detail });

async function request(path, method = "GET", body) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(`/api/v1${path}`, { method, credentials: "include", headers: { "Content-Type": "application/json", "Idempotency-Key": `circle-check-${Date.now()}` }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, data: await response.json().catch(() => null) };
  }, { path, method, body });
}

try {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.deleteCookie(...await page.cookies());
  check((await request("/auth/signin", "POST", { email: "priya.sharma@example.com", password: "Womsakhi!2026" })).status === 200, "member signs in");
  const name = `Launch persistence check ${Date.now()}`;
  const made = await request("/community/circles", "POST", {
    name, topic: "Business", desc: "Temporary automated persistence check circle.",
    is_private: true, is_savings: false, monthly_minor: 0,
    cover: "/media/test-cover.webp", icon: "/media/test-icon.webp", tags: ["business", "makers"],
    guidelines: "Be kind", who_posts: "hosts", review_first: true, tell_me: false,
    invites: ["Meera", "+919876543210"],
  });
  check(made.status === 201 && made.data?.id, "circle creates", String(made.status));
  if (made.data?.id) {
    const got = await request(`/community/circles/${made.data.id}`);
    check(got.status === 200, "circle reloads", String(got.status));
    check(got.data?.is_private === true, "privacy persists");
    check(got.data?.who_posts === "hosts", "posting policy persists");
    check(got.data?.review_first === true && got.data?.tell_me === false, "moderation and notifications persist");
    check(JSON.stringify(got.data?.tags) === JSON.stringify(["business", "makers"]), "tags persist");
    check(got.data?.invite_count === 2, "pending invitations persist", String(got.data?.invite_count));
  }
} finally { await browser.close(); }
for (const row of checks) console.log(`${row.ok ? "PASS" : "FAIL"}: ${row.label}${row.detail ? ` (${row.detail})` : ""}`);
const failed = checks.filter((x) => !x.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} circle persistence checks passed`);
if (failed.length) process.exit(1);
