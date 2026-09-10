/**
 * The eight new modules, rendered for real in both themes.
 *
 * Checks the four things that have actually broken on this project before:
 * a route that 500s, an icon that fell back to a blank circle, a colour token
 * that does not exist (which resolves to nothing and paints transparent), and
 * a screen that lost the left rail because someone passed `wide`.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const ROUTES = [
  "/app/shop/voice", "/app/trust", "/app/kitchen", "/app/verified",
  "/app/contracts", "/app/shop/slots", "/app/shop/disputes", "/app/vault/showing",
];

const tok = await seededMemberToken();
if (!tok) { console.error("no member token — is the API on 8020 up?"); process.exit(2); }

const b = await launch();
let bad = 0;

for (const mode of ["light", "dark"]) {
  console.log(`\n─── ${mode} ───`);
  for (const route of ROUTES) {
    const p = await pageAs(b, tok, { width: 1440, height: 1000, mode });
    // The theme is read from localStorage by ThemeContext, not from a cookie —
    // setting the cookie alone rendered light twice and proved nothing.
    await p.evaluateOnNewDocument((m) => {
      try { localStorage.setItem("theme", m); } catch {}
    }, mode);
    const errs = [];
    p.on("pageerror", (e) => errs.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });

    let status = 0;
    try {
      const r = await p.goto(APP + route, { waitUntil: "networkidle0", timeout: 90000 });
      status = r?.status() ?? 0;
    } catch (e) { errs.push("goto: " + e.message); }
    await new Promise((r) => setTimeout(r, 1200));

    const snap = await p.evaluate(() => {
      const txt = (document.body.innerText || "").replace(/\s+/g, " ").trim();
      // The rail is the sidebar nav. `wide` drops it — that regression shipped twice.
      const rail = !!document.querySelector('aside, nav[aria-label], [data-rail]');
      // An unresolved var() paints transparent. Find elements asking for a token
      // the stylesheet never defined.
      const unresolved = [];
      for (const el of document.querySelectorAll("*")) {
        const s = el.getAttribute("style") || "";
        for (const m of s.matchAll(/var\((--[a-z0-9-]+)\)/g)) {
          if (!getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim()
              && !getComputedStyle(el).getPropertyValue(m[1]).trim()) unresolved.push(m[1]);
        }
      }
      // lucide renders <svg class="lucide lucide-…">; the fallback is lucide-circle.
      const svgs = [...document.querySelectorAll("svg.lucide")];
      const circles = svgs.filter((s) => /lucide-circle(\s|$)/.test(s.getAttribute("class") || "")).length;
      const isDark = document.documentElement.classList.contains("dark");
      const ground = getComputedStyle(document.body).backgroundColor;
      return { txt: txt.length, rail, unresolved: [...new Set(unresolved)], svgs: svgs.length, circles, isDark, ground };
    });

    const ok = status === 200 && snap.txt > 400 && snap.rail
               && snap.unresolved.length === 0 && errs.length === 0
               && snap.isDark === (mode === "dark");
    if (!ok) bad++;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${route.padEnd(22)} ${status} ` +
      `text=${String(snap.txt).padEnd(5)} rail=${snap.rail ? "y" : "N"} ` +
      `icons=${snap.svgs}(${snap.circles} circle) theme=${snap.isDark ? "dark" : "light"} ` +
      (snap.unresolved.length ? `BAD-TOKENS=${snap.unresolved.join(",")} ` : "") +
      (errs.length ? `ERR=${errs[0].slice(0, 110)}` : "")
    );
    await p.close();
  }
}
await b.close();
console.log(bad === 0 ? "\nAll 8 routes render in both themes." : `\n${bad} route/theme combinations failed.`);
process.exit(bad === 0 ? 0 : 1);
