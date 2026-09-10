import { launch, pageAs, seededMemberToken, APP } from "./_shared.mjs";
const tok = await seededMemberToken();
const b = await launch();
const p = await pageAs(b, tok, { width: 390, height: 844 });
await p.goto(APP + "/app/learn", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.waitForSelector('nav[aria-label="Sections"] a', { timeout: 180000 });
await new Promise(r => setTimeout(r, 2600));
console.log(await p.evaluate(() => {
  const nav = document.querySelector("nav[aria-label='Sections']");
  const uxs = [...document.querySelectorAll(".ux")].map((e, i) => ({
    i, tag: e.tagName, cls: e.className.slice(0, 60), containsNav: e.contains(nav),
    saBottom: getComputedStyle(e).getPropertyValue("--sa-bottom").trim(),
  }));
  const contents = [...document.querySelectorAll("#content")].map((e) => ({
    tag: e.tagName, cls: e.className, kids: e.children.length,
    first: e.firstElementChild ? e.firstElementChild.tagName + "." + String(e.firstElementChild.className).slice(0, 40) : null,
    firstAnim: e.firstElementChild ? getComputedStyle(e.firstElementChild).animationName : null,
  }));
  const swaps = [...document.querySelectorAll(".ux-swap")].map((e) => ({
    tag: e.tagName, id: e.id, kids: e.children.length,
    childAnims: [...e.children].map((c) => c.tagName + ":" + getComputedStyle(c).animationName),
  }));
  const headStyles = [...document.head.querySelectorAll("style")].map((s) => (s.textContent || "").slice(0, 44).replace(/\n/g, " "));
  const bodyStyles = [...document.body.querySelectorAll("style")].map((s) => (s.textContent || "").slice(0, 44).replace(/\n/g, " "));
  const tabIdx = [...nav.querySelectorAll("a")].map((a) => a.innerText.trim() + ":" + a.tabIndex);
  const barCs = getComputedStyle(nav);
  return { uxs, contents, swaps, headStyles, bodyStyles, tabIdx,
    bar: { backdrop: barCs.backdropFilter, webkit: barCs.webkitBackdropFilter, bg: barCs.backgroundColor, z: barCs.zIndex, pos: barCs.position } };
}));
await b.close();
