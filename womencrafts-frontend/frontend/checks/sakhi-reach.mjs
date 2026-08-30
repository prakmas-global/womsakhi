/**
 * Sakhi has to be able to see the app she works in.
 *
 * She shipped with tools for services, programmes and bookings — three of the
 * app's areas — and nothing else. Asked about the library or her circles she
 * replied "I don't have a tool for that": honest, and useless. An assistant
 * that can see a tenth of the product is not wrong to say it cannot help; it
 * just is not much of an assistant, and to the woman asking it reads as the
 * thing being broken.
 *
 * So this asks a real question of each area and requires that she reaches for
 * the right tool. It deliberately does NOT grade her wording — only whether she
 * went and looked. What she says depends on the seeded data, which changes; that
 * she looks at all is the thing that must not regress.
 */
import { seededMemberToken, API } from "./_shared.mjs";

const token = await seededMemberToken();

async function ask(text) {
  const res = await fetch(`${API}/sakhi/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `access_token=${token}` },
    body: JSON.stringify({ text }),
  });
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", said = "", tools = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      try {
        const e = JSON.parse(line.slice(5));
        if (e.type === "text") said += e.text;
        if (e.type === "tool") tools.push(e.name);
      } catch { /* a partial frame; the next chunk completes it */ }
    }
  }
  return { said: said.trim(), tools };
}

const AREAS = [
  ["the library",     "Is there a guide about selling online?",     "search_library"],
  ["circles",         "How many circles am I in?",                  "list_circles"],
  ["events",          "What events are coming up?",                 "list_events"],
  ["mentors",         "Who can mentor me?",                         "list_mentors"],
  ["opportunities",   "Is there any work I can apply for?",         "list_opportunities"],
  ["certificates",    "What certificates have I earned?",           "my_records"],
  ["her bookings",    "What sessions do I have booked?",            "list_my_bookings"],
  ["her programmes",  "Which programmes am I in?",                  "list_my_programs"],
  ["her wallet",      "How much money is in my wallet?",             "my_records"],
  ["what she missed", "Have I missed any notifications?",            "my_records"],
];

const fail = [];
const lines = [];
for (const [area, question, expected] of AREAS) {
  const { said, tools } = await ask(question);
  const looked = tools.includes(expected);
  lines.push(`  ${looked ? "ok  " : "✗   "} ${area.padEnd(16)} ${tools.join(", ") || "(looked at nothing)"}`);
  if (!looked) fail.push(`asked about ${area}, she did not use ${expected}`);
  // the specific failure this was written for
  if (/do not have a tool|don't have a tool/i.test(said))
    fail.push(`she says she has no tool for ${area}`);
}

console.log("\n" + lines.join("\n"));
console.log(fail.length
  ? "\n  " + fail.map((f) => "✗ " + f).join("\n  ") + "\n"
  : `\n  she can reach all ${AREAS.length} areas she is asked about\n`);
process.exit(fail.length ? 1 : 0);
