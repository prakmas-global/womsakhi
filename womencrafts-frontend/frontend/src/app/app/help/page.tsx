"use client";

import { useMemo, useState } from "react";
import * as Icons from "lucide-react";

import { Btn, Card, EmptyState, IconTile, NoteBtn, SectionHead, plural } from "@/components/ux/kit";
import { apiSendMessage } from "@/lib/member-api";
import { HomeShell } from "@/components/ux/home/HomeShell";

/**
 * The topic tiles.
 *
 * Each carried an `n` — "8 answers", "9 answers" — adding up to 41 against
 * eight actual FAQs. The count is now counted.
 */
const TOPICS = [
  { id: "t1", label: "Money and payments", icon: "Wallet", tint: "--ux-tint-green", ink: "--ux-green" },
  { id: "t2", label: "Work and applying", icon: "Briefcase", tint: "--ux-tint-blue", ink: "--ux-blue" },
  { id: "t3", label: "Courses and certificates", icon: "BookOpen", tint: "--ux-tint-violet", ink: "--ux-violet" },
  { id: "t4", label: "Your shop and orders", icon: "Store", tint: "--ux-tint-orange", ink: "--ux-orange" },
  { id: "t5", label: "Circles and savings", icon: "UsersRound", tint: "--ux-tint-pink", ink: "--ux-pink" },
  { id: "t6", label: "Your account", icon: "User", tint: "--ux-tint-lilac", ink: "--ux-brand" },
];

const FAQS = [
  { id: "f1", topic: "t1", q: "When does money reach my bank?",
    a: "Withdrawals reach most banks in one working day, and always within three. If it has been longer than three working days, tell us and we will trace it." },
  { id: "f2", topic: "t1", q: "Why is my balance lower than what I earned?",
    a: "Money from an order stays pending until the buyer confirms delivery, usually three days. The Earn screen shows what is still on its way, above the list." },
  { id: "f3", topic: "t2", q: "How long until an employer replies?",
    a: "About one in three write back, usually within three days. You will see the stage change on My Applications the moment they open your profile." },
  { id: "f4", topic: "t3", q: "Is my certificate worth anything outside the app?",
    a: "Each one carries a code anyone can check at womsakhi.in/verify. Employers hiring through WomSakhi see them on your profile automatically." },
  { id: "f5", topic: "t4", q: "A buyer has not paid. What now?",
    a: "Message her first from the order — most cases are a forgotten payment. If there is no reply in two days, open the order and choose Report a problem." },
  { id: "f6", topic: "t5", q: "What if someone in my savings circle stops paying?",
    a: "The circle decides together, and we help you talk it through. The pot for that month is smaller; nobody loses a turn." },
  { id: "f7", topic: "t6", q: "Can I change my language?",
    a: "Yes, in Settings. Sakhi will speak and write in whichever language you choose, and it changes everything on screen too." },
  { id: "f8", topic: "t1", q: "Does WomSakhi take a cut of what I earn?",
    a: "No. What a buyer or employer pays is what reaches your wallet. Courses and stall fees are the only things you ever pay for, and both are shown before you agree." },
];

/**
 * Help — answers, then a person.
 *
 * Questions come before contact details on purpose: most of what she needs is
 * one paragraph, and making her wait for a reply to learn that money takes
 * three days is a worse experience than reading it now. The way to reach a
 * human is still on the page, not buried.
 */
export default function HelpPage() {
  const [q, setQ] = useState("");
  const [topic, setTopic] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return FAQS.filter((f) => {
      if (topic && f.topic !== topic) return false;
      if (t && !`${f.q} ${f.a}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [q, topic]);

  return (
    <HomeShell
      active="/app/settings"
      rail={
        <div className="space-y-[15px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Talk to a person" sub="Real people, in Hindi or English" />
            <ul className="space-y-3">
              {[
                ["Chat with us", "Usually replies in under an hour", "MessageCircle", "--ux-tint-violet", "--ux-violet"],
                ["Call 1800-102-9999", "Mon–Sat, 9 AM – 7 PM · Free", "Phone", "--ux-tint-green", "--ux-green"],
                ["WomSakhi Centre, Jaipur", "Walk in, Mon–Sat 10 AM – 5 PM", "Building2", "--ux-tint-blue", "--ux-blue"],
              ].map(([label, note, icon, tint, ink]) => (
                <li key={label} className="ux-hov flex items-start gap-3">
                  <IconTile icon={icon} tint={tint} ink={ink} size={38} radius={11} />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium leading-snug" style={{ color: "var(--ux-ink)" }}>{label}</p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--ux-muted)" }}>{note}</p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              {/* Both of these opened a box and threw the words away. There
                  is no ticketing endpoint in this API, but there is exactly
                  one member conversation — hers with the WomSakhi team, at
                  POST /me/messages — and it is what the Messages screen
                  shows. So a chat started here is a real message in a real
                  thread, and the reply arrives where the box says it will. */}
              <NoteBtn label="Start a chat" variant="primary" size="sm" full icon="MessageCircle"
                       title="What do you need help with?" to="the WomSakhi help team"
                       placeholder="Tell us what you were trying to do and what happened instead. Write in whichever language is easiest."
                       send={(n) => apiSendMessage(n.text)}
                       sent="Your message is with the team"
                       sentBody="Somebody reads every message. The reply arrives in Messages." />
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Something is broken" icon="Bug" />
            <p className="text-[12.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              If a screen will not load or a number looks wrong, tell us what you were doing. It helps more
              than you would think.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/feedback" variant="outline" size="sm" full iconEnd="ArrowRight">Report a problem</Btn>
            </div>
          </Card>
        </div>
      }
    >
      <h1 className="text-[24px] font-bold" style={{ color: "var(--ux-ink)" }}>Help</h1>
      <p className="mb-[18px] mt-1.5 text-[13px]" style={{ color: "var(--ux-muted)" }}>
        Most answers are here. A person is one tap away if they are not.
      </p>

      <label className="ux-sq mb-[18px] flex h-[48px] items-center gap-3 rounded-[13px] border px-4"
             style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
        <Icons.Search className="h-[18px] w-[18px] shrink-0" style={{ color: "var(--ux-faint)" }} strokeWidth={2} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What do you need help with?"
          aria-label="Search help"
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none"
          style={{ color: "var(--ux-ink)" }}
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="Clear"
                  className="ux-press grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                  style={{ background: "var(--ux-surface-2)" }}>
            <Icons.X className="h-[14px] w-[14px]" style={{ color: "var(--ux-muted)" }} />
          </button>
        )}
      </label>

      {!q && (
        <div className="ux-deck mb-[24px] grid grid-cols-3 gap-[13px]">
          {TOPICS.map((t, i) => (
            <button
              key={t.id}
              onClick={() => setTopic(topic === t.id ? null : t.id)}
              className="ux-i ux-sq ux-onscroll flex items-center gap-3 rounded-[14px] border p-3.5 text-start"
              style={{
                borderColor: topic === t.id ? "var(--ux-brand)" : "var(--ux-line)",
                background: topic === t.id ? "var(--ux-brand-tint)" : "var(--ux-surface)",
                ["--i" as string]: i,
              }}
            >
              <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={38} radius={11} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                  {t.label}
                </span>
                <span className="mt-0.5 block text-[11px]" style={{ color: "var(--ux-muted)" }}>
                  {countFor(t.id)} {plural("answer", countFor(t.id))}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      <SectionHead
        title={topic ? TOPICS.find((t) => t.id === topic)!.label : q ? `${shown.length} ${plural("answer", shown.length)}` : "Asked most often"}
        action={topic || q ? "Show all" : undefined}
        onAction={() => { setTopic(null); setQ(""); }}
      />

      {shown.length ? (
        <div className="ux-deck ux-stagger space-y-[11px]">
          {shown.map((f, i) => {
            const on = open === f.id;
            return (
              <Card key={f.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }} pad={0}>
                <button
                  onClick={() => setOpen(on ? null : f.id)}
                  aria-expanded={on}
                  className="flex w-full items-center gap-3 px-[18px] py-4 text-start"
                >
                  <span className="min-w-0 flex-1 text-[14px] font-semibold" style={{ color: "var(--ux-ink)" }}>
                    {f.q}
                  </span>
                  <Icons.ChevronDown
                    className="h-[18px] w-[18px] shrink-0 transition-transform"
                    style={{ color: "var(--ux-faint)", transform: on ? "rotate(180deg)" : "none" }}
                  />
                </button>
                {on && (
                  <p className="ux-slide-up border-t px-[18px] py-4 text-[13px] leading-relaxed"
                     style={{ borderColor: "var(--ux-line)", color: "var(--ux-ink-2)" }}>
                    {f.a}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="SearchX"
            title={`Nothing here about “${q.trim()}”`}
            body="Ask a person — they will know, and it helps us write the missing answer."
            action={<NoteBtn label="Start a chat" variant="primary" size="md" icon="MessageCircle"
                             title="What do you need help with?" to="the WomSakhi help team"
                             placeholder="Tell us what you were looking for. We will answer, and write the missing answer."
                             send={(n) => apiSendMessage(n.text)}
                             sent="Your message is with the team"
                             sentBody="Somebody reads every message. The reply arrives in Messages." />}
          />
        </Card>
      )}
    </HomeShell>
  );
}

/** How many answers a topic actually has. */
function countFor(topicId: string): number {
  return FAQS.filter((f) => f.topic === topicId).length;
}
