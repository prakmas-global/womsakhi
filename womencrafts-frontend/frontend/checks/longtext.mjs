/**
 * Does the layout survive translation? (§78)
 *
 * German and Tamil routinely run 30–40% longer than English, and a card built
 * around an English string length breaks silently when it arrives. This grows
 * every visible string by 40% in the DOM and looks for the two failures that
 * follow: the page scrolling sideways, and text escaping its own box.
 */
import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";

const R = process.argv.slice(2);
const tok = await seededMemberToken();
const b = await launch();
let bad = 0;

for (const r of R) {
  const p = await pageAs(b, tok, { width: 390, height: 844 });
  await p.emulate({ viewport: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
                    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148" });
  await p.setCookie({ name: "access_token", value: tok, domain: "localhost", path: "/" });
  await p.goto(APP + r, { waitUntil: "networkidle0", timeout: 90000 });
  await new Promise((x) => setTimeout(x, 1200));

  const res = await p.evaluate(() => {
    // Grow every text node by ~40%, the way a German or Tamil catalogue would.
    const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walk.nextNode()) {
      const t = walk.currentNode.nodeValue.trim();
      if (t.length > 3 && !/^[\d\s₹%.,:·—–-]+$/.test(t)) nodes.push(walk.currentNode);
    }
    for (const n of nodes) {
      const words = n.nodeValue.split(" ");
      n.nodeValue = words.map((w) => (w.length > 4 ? w + w.slice(0, Math.ceil(w.length * 0.4)) : w)).join(" ");
    }
    // Let it reflow.
    void document.body.offsetHeight;
    const overflowX = document.documentElement.scrollWidth - window.innerWidth;
    // Text wider than the box it is in, on something that cannot scroll.
    const escaped = [...document.querySelectorAll("p,h1,h2,h3,span,button,a")].filter((el) => {
      const cs = getComputedStyle(el);
      // Must actually contain text: an icon container whose SVG is a few pixels
      // wider than its box is not a translation failure, and counting it made
      // every page look broken.
      if (!(el.innerText || "").trim()) return false;
      return el.scrollWidth > el.clientWidth + 4 && cs.overflowX === "visible"
          && cs.display !== "inline" && el.clientWidth > 40;
    }).length;
    return { overflowX, escaped, grown: nodes.length };
  }).catch(() => ({ overflowX: -1, escaped: -1, grown: 0 }));

  const ok = res.overflowX <= 2 && res.escaped === 0;
  if (!ok) bad++;
  console.log(`${ok ? "ok  " : "FAIL"} ${r.padEnd(22)} strings=${String(res.grown).padEnd(4)} overflowX=${String(res.overflowX).padEnd(4)} textEscaped=${res.escaped}`);
  await p.close();
}
await b.close();
console.log(bad === 0 ? "\nLayout survives +40% text at 390px." : `\n${bad} break with longer text.`);
process.exit(bad === 0 ? 0 : 1);
