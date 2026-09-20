"use client";

import { useCallback, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Sheet } from "@/components/ux/kit/sheet";
import { Column, CycleHeader, CyButton, DeskTitle, ErrorLine, SoftHeart, heroBg } from "@/components/ux/cycle/parts";
import { HEALTH_TAGS, MENTOR_TABS } from "@/components/ux/cycle/data";
import { apiMentors, type ApiMentor } from "@/lib/me-api";
import { apiRequestMentor } from "@/lib/growth-api";
import { useResource } from "@/lib/use-resource";
import { messageFrom } from "@/lib/use-action";

/**
 * "You're not alone. Talk to our expert mentors."
 *
 * Asking is the existing mentor request: she writes what she wants to talk
 * about, and a person on the team introduces them. Nothing here is a chat
 * with a doctor, and the screen does not pretend it is — a question about
 * heavy bleeding needs an examination, which the guides say plainly.
 */
export default function HealthMentors() {
  const { data, refetch, source } = useResource(
    useCallback(async (s: AbortSignal) => (await apiMentors(s)).filter((m) => m.expertise.some((e) => HEALTH_TAGS.includes(e))), []),
    [] as ApiMentor[],
  );
  const [tab, setTab] = useState<(typeof MENTOR_TABS)[number]["key"]>("womens");
  const [asking, setAsking] = useState<ApiMentor | null>(null);
  const [goal, setGoal] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const tags = MENTOR_TABS.find((t) => t.key === tab)?.tags ?? [];
  const shown = tags.length ? data.filter((m) => m.expertise.some((e) => (tags as readonly string[]).includes(e))) : data;

  const send = async () => {
    if (!asking || goal.trim().length < 5) return;
    setSending(true);
    setError(null);
    try {
      await apiRequestMentor(asking.id, goal.trim());
      setSent(asking.name);
      setAsking(null);
      setGoal("");
      refetch();
    } catch (e) {
      setError(messageFrom(e, "That did not send. Try again in a moment."));
    } finally {
      setSending(false);
    }
  };

  return (
    <HomeShell immersive bare>
      <Column>
        <CycleHeader title="Health Mentors" />
        <DeskTitle title="Health Mentors" sub="Doctors and coaches who answer women's questions." />

        <div className="relative overflow-hidden rounded-[20px] px-5 py-5" style={{ background: heroBg }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden className="absolute -end-10 -top-8 h-[150px] w-auto opacity-50 mix-blend-multiply" />
          <p className="ux-display relative text-[24px] font-bold leading-tight" style={{ color: "var(--cy-period-ink)" }}>You&apos;re not alone</p>
          <p className="relative mt-1 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>Talk to our expert mentors</p>
        </div>

        <div className="ux-scroll-x -mx-[20px] mt-4 flex gap-2 px-[20px]" role="tablist" aria-label="Kind of mentor">
          {MENTOR_TABS.map((t) => {
            const on = t.key === tab;
            return (
              <button key={t.key} type="button" role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                      className="ux-press h-[40px] shrink-0 whitespace-nowrap rounded-full px-4 text-[13px]"
                      style={on
                        ? { background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)", fontWeight: 600 }
                        : { background: "var(--ux-surface)", color: "var(--ux-ink-2)", border: "1px solid var(--ux-line-strong)" }}>
                {t.label}
              </button>
            );
          })}
        </div>

        {sent && (
          <p role="status" className="mt-4 flex items-start gap-2 rounded-[14px] px-3.5 py-3 text-[15px]"
             style={{ background: "var(--ux-tint-green)", color: "var(--ux-ink)" }}>
            <Icons.CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--ux-green)" }} aria-hidden />
            Sent. We&apos;ll introduce you to {sent} once she confirms — look in your notifications.
          </p>
        )}

        <ul className="mt-4 space-y-2.5">
          {source === "loading" && shown.length === 0 && [0, 1, 2].map((i) => (
            <li key={i} className="h-[96px] animate-pulse rounded-[16px]" style={{ background: "var(--ux-surface-2)" }} />
          ))}
          {source !== "loading" && shown.length === 0 && (
            <li className="rounded-[16px] px-4 py-6 text-center text-[15px]" style={{ background: "var(--ux-surface)", color: "var(--ux-muted)", border: "1px solid var(--ux-line)" }}>
              No mentors here yet. We are adding more every week.
            </li>
          )}
          {shown.map((m) => (
            <li key={m.id} className="flex items-start gap-3.5 rounded-[16px] p-3.5" style={{ background: "var(--ux-surface)", border: "1px solid var(--ux-line)" }}>
              <span className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-full" style={{ background: "var(--cy-predicted)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {m.photo ? <img src={m.photo} alt="" className="h-full w-full object-cover object-top" /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[15px] font-semibold" style={{ color: "var(--ux-ink)" }}>{m.name}</b>
                <span className="block text-[13px]" style={{ color: "var(--ux-ink-2)" }}>{m.headline}</span>
                <span className="mt-0.5 block text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{m.focus || m.bio}</span>
              </span>
              {m.requested ? (
                <span className="shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green)" }}>Asked</span>
              ) : (
                <button type="button" onClick={() => { setAsking(m); setGoal(""); setError(null); }}
                        className="ux-press h-[36px] shrink-0 rounded-[10px] px-4 text-[13px] font-semibold"
                        style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
                  Ask
                </button>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3.5" style={{ background: "var(--cy-predicted)", border: "1px solid var(--ux-line)" }}>
          <Icons.HeartHandshake className="h-5 w-5 shrink-0" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
          <p className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
            <b className="font-semibold" style={{ color: "var(--ux-ink)" }}>Real Women. Real Support.</b><br />
            Because every question matters. <SoftHeart className="h-3.5 w-3.5" />
          </p>
        </div>

        <Sheet open={!!asking} onClose={() => setAsking(null)} title={`Ask ${asking?.name ?? ""}`} icon="MessageCircle"
               description="What would you like to talk about? A sentence is enough.">
          <textarea value={goal} onChange={(e) => setGoal(e.target.value.slice(0, 400))} rows={4} autoFocus
                    placeholder="For example: My periods have been irregular for three months."
                    className="w-full resize-none rounded-[14px] p-3.5 text-[15px]"
                    style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line-strong)" }} />
          <div className="mt-3">
            <CyButton onClick={send} busy={sending} disabled={goal.trim().length < 5}>Send my question</CyButton>
          </div>
          <ErrorLine text={error} />
          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            A person on our team introduces you. For heavy bleeding, severe pain or feeling faint, go to a hospital — don&apos;t wait for a reply.
          </p>
        </Sheet>
      </Column>
    </HomeShell>
  );
}
