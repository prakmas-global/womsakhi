/** Exercise every formerly-placeholder shop workflow against the real API. */
import { APP, launch } from "./_shared.mjs";

const kinds = ["preorder", "subscription", "slot", "wholesale", "live", "voice", "dispute"];
const browser = await launch();
const page = await browser.newPage();
const checks = [];
const check = (ok, label, detail = "") => checks.push({ ok: Boolean(ok), label, detail });

async function request(path, method = "GET", body) {
  return page.evaluate(async ({ path, method, body }) => {
    const response = await fetch(`/api/v1${path}`, {
      method, credentials: "include", headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  }, { path, method, body });
}

try {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.deleteCookie(...await page.cookies());
  const unauth = await request("/shop/operations?kind=preorder");
  check(unauth.status === 401, "anonymous access is refused", String(unauth.status));

  const login = await request("/auth/signin", "POST", { email: "priya.sharma@example.com", password: "Womsakhi!2026" });
  check(login.status === 200, "member signs in", String(login.status));

  for (const kind of kinds) {
    const marker = `Launch check ${kind} ${Date.now()}`;
    const made = await request("/shop/operations", "POST", {
      kind, title: marker, contact: "API check", amount_minor: 12500,
      status: kind === "live" ? "scheduled" : "draft", due_on: "2026-10-01T10:00", note: "Removed by automated check", details: {},
    });
    check(made.status === 201 && made.data?.id, `${kind}: create persists`, String(made.status));
    if (!made.data?.id) continue;
    const id = made.data.id;

    const listed = await request(`/shop/operations?kind=${kind}`);
    check(listed.status === 200 && listed.data?.some((x) => x.id === id), `${kind}: list returns own record`, String(listed.status));

    const changed = await request(`/shop/operations/${id}`, "PATCH", { status: "resolved" });
    check(changed.status === 200 && changed.data?.status === "resolved", `${kind}: status update persists`, String(changed.status));

    const removed = await request(`/shop/operations/${id}`, "DELETE");
    check(removed.status === 204, `${kind}: archive succeeds`, String(removed.status));
    const after = await request(`/shop/operations?kind=${kind}`);
    check(after.status === 200 && !after.data?.some((x) => x.id === id), `${kind}: archived record leaves active list`, String(after.status));
  }
} finally { await browser.close(); }

for (const row of checks) console.log(`${row.ok ? "PASS" : "FAIL"}: ${row.label}${row.detail ? ` (${row.detail})` : ""}`);
const failed = checks.filter((x) => !x.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} shop workflow checks passed`);
if (failed.length) process.exit(1);
