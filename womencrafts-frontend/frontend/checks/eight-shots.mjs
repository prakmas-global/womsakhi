import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const OUT = process.argv[2];
const ROUTES = ["/app/shop/voice","/app/trust","/app/kitchen","/app/verified",
                "/app/contracts","/app/shop/slots","/app/shop/disputes","/app/vault/showing"];
const tok = await seededMemberToken();
const b = await launch();
for (const mode of ["light","dark"]) for (const r of ROUTES) {
  const p = await pageAs(b, tok, { width: 1440, height: 1100, mode });
  await p.evaluateOnNewDocument((m) => { try { localStorage.setItem("theme", m); } catch {} }, mode);
  await p.goto(APP + r, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((x) => setTimeout(x, 1200));
  await p.screenshot({ path: `${OUT}/${mode}${r.replace(/\//g,"_")}.png`, fullPage: true });
  await p.close();
}
await b.close(); console.log("done");
