/**
 * She has to answer FROM the library, not point at it.
 *
 * Two things had to be true before this could work, and neither was:
 *
 *   1. The library held **zero words of prose** — eight rows, every one a title
 *      with an empty description. Retrieval has nothing to retrieve.
 *   2. `search_library` returned titles. "Here are three guides" leaves a woman
 *      to go and read them herself, on a phone, possibly in her third language.
 *      That is a search box wearing an assistant's face.
 *
 * So this asks real questions and requires that she (a) goes and looks, and
 * (b) answers with something that is actually in the guide — not from her own
 * general knowledge, which is the failure mode that looks identical from
 * outside until the day it invents something.
 */
import { seededMemberToken, API } from "./_shared.mjs";

const token = await seededMemberToken();
const head = { "Content-Type": "application/json", Cookie: `access_token=${token}` };

async function ask(text) {
  const res = await fetch(`${API}/sakhi/chat`, {
    method: "POST", headers: head, body: JSON.stringify({ text }),
  });
  const rd = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", said = "", tools = [];
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const l = part.split("\n").find((x) => x.startsWith("data:"));
      if (!l) continue;
      try {
        const e = JSON.parse(l.slice(5));
        if (e.type === "text") said += e.text;
        if (e.type === "tool") tools.push(e.name);
      } catch { /* partial frame */ }
    }
  }
  return { said: said.trim(), tools };
}

// Each: a question, and words that only appear if she read the right guide.
const CASES = [
  ["what to charge", "What should I charge for my work?",
   ["material", "time", "hour", "cost"]],
  ["a customer not paying", "A customer took delivery and keeps saying next week. What do I do?",
   ["advance", "writing", "record", "outstanding", "full payment"]],
  ["maternity rights", "Am I allowed maternity leave?",
   ["maternity", "leave", "dismiss", "workplace"]],
  ["selling food safely", "I want to sell the food I cook at home. What must I be careful about?",
   ["hygiene", "hot", "cold", "package", "licence", "label"]],
];

const fail = [];
const lines = [];
for (const [label, question, expect] of CASES) {
  const { said, tools } = await ask(question);
  const looked = tools.includes("search_library");
  const body = said.toLowerCase();
  const grounded = expect.some((w) => body.includes(w.toLowerCase()));
  const empty = /don't have|do not have|no tool|nothing/i.test(said) && !grounded;

  lines.push(`  ${looked && grounded ? "ok  " : "✗   "} ${label.padEnd(22)} ` +
             `${looked ? "read the guides" : "did NOT look"} · ` +
             `${grounded ? "answered from them" : "answer not grounded"}`);
  if (!looked) fail.push(`asked about ${label}, she never opened the library`);
  if (!grounded) fail.push(`her answer about ${label} contains nothing from the guide: "${said.slice(0, 90)}"`);
  if (empty) fail.push(`she said she had nothing for ${label}, but a guide covers it`);
}

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : "\n  she reads the guides and answers out of them\n");
process.exit(fail.length ? 1 : 0);
