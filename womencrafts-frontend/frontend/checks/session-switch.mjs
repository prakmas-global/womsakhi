/** Verify one browser can safely switch between staff and member sessions. */
import { APP, launch } from "./_shared.mjs";

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 800 });

const checks = [];
const check = (ok, label, detail = "") => checks.push({ ok: Boolean(ok), label, detail });

async function auth(path, body) {
  return page.evaluate(async ({ path, body }) => {
    const response = await fetch(`/api/v1/auth/${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, data: await response.json().catch(() => null) };
  }, { path, body });
}

async function session() {
  return page.evaluate(async () => {
    const response = await fetch("/api/v1/auth/session", { credentials: "include" });
    return { status: response.status, data: await response.json() };
  });
}

async function go(path) {
  await page.goto(`${APP}${path}`, { waitUntil: "domcontentloaded", timeout: 20000 });
  return new URL(page.url()).pathname;
}

try {
  await page.goto(APP, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.deleteCookie(...await page.cookies());

  const admin = await auth("signin", { email: "admin@womsakhi.com", password: "admin12345" });
  check(admin.status === 200, "staff sign-in succeeds", String(admin.status));
  const adminSession = await session();
  check(adminSession.data?.user?.audience === "staff", "staff session reports staff audience", adminSession.data?.user?.audience);
  check((await go("/dashboard")) === "/dashboard", "staff can enter the dashboard", page.url());
  check((await go("/app")) === "/dashboard", "staff is routed away from the member app", page.url());

  const out = await auth("signout");
  check(out.status === 200, "sign-out succeeds", String(out.status));
  check((await session()).data?.user === null, "sign-out clears the browser session");

  const member = await auth("signin", { email: "priya.sharma@example.com", password: "Womsakhi!2026" });
  check(member.status === 200, "member sign-in succeeds", String(member.status));
  const memberSession = await session();
  check(memberSession.data?.user?.audience === "member", "member session reports member audience", memberSession.data?.user?.audience);
  check((await go("/app")) === "/app", "member can enter the member app", page.url());
  check((await go("/dashboard")) === "/app", "member is routed away from staff pages", page.url());

  await auth("signout");
  const adminAgain = await auth("signin", { email: "admin@womsakhi.com", password: "admin12345" });
  check(adminAgain.status === 200, "same browser can switch back to staff", String(adminAgain.status));
  check((await session()).data?.user?.audience === "staff", "replacement cookie belongs to staff");
  check((await go("/dashboard")) === "/dashboard", "switched staff session reaches dashboard", page.url());
} finally {
  await browser.close();
}

for (const row of checks) console.log(`${row.ok ? "PASS" : "FAIL"}: ${row.label}${row.detail ? ` (${row.detail})` : ""}`);
const failed = checks.filter((x) => !x.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} session checks passed`);
if (failed.length) process.exit(1);
