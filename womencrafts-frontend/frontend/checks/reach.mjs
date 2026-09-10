/**
 * The six outward-facing features, rendered for real.
 *
 * The two open routes are checked with NO session at all — that is the entire
 * point of them, and a cookie would hide a regression where they slipped behind
 * the proxy matcher.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const IN_APP = ["/app/collect", "/app/voice", "/app/safe-money", "/app/bringing", "/app/contracts/together"];
const OPEN   = ["/s/priya-tailoring", "/pay/PR-4820"];

const tok = await seededMemberToken();
if (!tok) { console.error("no member token"); process.exit(2); }
const b = await launch();
let bad = 0;

const snap = () => ({
  txt: (document.body.innerText || "").replace(/\s+/g, " ").trim().length,
  rail: !!document.querySelector("aside, nav[aria-label], [data-rail]"),
  isDark: document.documentElement.classList.contains("dark"),
  circles: [...document.querySelectorAll("svg.lucide")]
    .filter((s) => /lucide-circle(\s|$)/.test(s.getAttribute("class") || "")).length,
  svgs: document.querySelectorAll("svg.lucide").length,
  unresolved: [...new Set([...document.querySelectorAll("*")].flatMap((el) => {
    const st = el.getAttribute("style") || "";
    return [...st.matchAll(/var\((--[a-z0-9-]+)\)/g)]
      .map((m) => m[1])
      .filter((n) => !getComputedStyle(document.documentElement).getPropertyValue(n).trim()
                  && !getComputedStyle(el).getPropertyValue(n).trim());
  }))],
});

for (const mode of ["light", "dark"]) {
  console.log(`\n─── ${mode} ───`);
  for (const [route, authed] of [...IN_APP.map((r) => [r, true]), ...OPEN.map((r) => [r, false])]) {
    const p = await pageAs(b, authed ? tok : "", { width: 1440, height: 1000, mode });
    await p.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

    let status = 0;
    try { status = (await p.goto(APP + route, { waitUntil: "networkidle0", timeout: 90000 }))?.status() ?? 0; }
    catch (e) { errs.push("goto: " + e.message); }
    await new Promise((r) => setTimeout(r, 1000));
    const s = await p.evaluate(snap);

    // Open routes must NOT have the member rail, and must render without a session.
    const railOk = authed ? s.rail : !s.rail;
    const ok = status === 200 && s.txt > 300 && railOk
               && s.unresolved.length === 0 && errs.length === 0
               && s.isDark === (mode === "dark");
    if (!ok) bad++;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${route.padEnd(24)} ${status} text=${String(s.txt).padEnd(5)} ` +
      `${authed ? `rail=${s.rail ? "y" : "N"}` : `norail=${!s.rail ? "y" : "N"}`} ` +
      `icons=${s.svgs}(${s.circles} circle) theme=${s.isDark ? "dark" : "light"} ` +
      (s.unresolved.length ? `BAD-TOKENS=${s.unresolved.join(",")} ` : "") +
      (errs.length ? `ERR=${errs[0].slice(0, 100)}` : "")
    );
    await p.close();
  }
}
await b.close();
console.log(bad === 0 ? "\nAll 7 routes render in both themes." : `\n${bad} failures.`);
process.exit(bad === 0 ? 0 : 1);
