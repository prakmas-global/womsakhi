"use client";

import { useCallback, useState } from "react";

import { useT } from "@/i18n";
import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Sheet } from "@/components/ux/kit/sheet";
import { Column, CycleHeader, CyButton, DeskTitle, ErrorLine, SoftHeart, heroBg } from "@/components/ux/cycle/parts";
import { HEALTH_TAGS as RAW_HEALTH_TAGS, MENTOR_TABS as RAW_MENTOR_TABS } from "@/components/ux/cycle/data";
import { apiMentors, type ApiMentor } from "@/lib/me-api";
import { apiRequestMentor } from "@/lib/growth-api";
import { useResource } from "@/lib/use-resource";
import { messageFrom } from "@/lib/use-action";
import { useTranslated } from "@/i18n/data";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";

/**
 * "You're not alone. Talk to our expert mentors."
 *
 * Asking is the existing mentor request: she writes what she wants to talk
 * about, and a person on the team introduces them. Nothing here is a chat
 * with a doctor, and the screen does not pretend it is — a question about
 * heavy bleeding needs an examination, which the guides say plainly.
 */
const hasTag = (tags: readonly string[], e: string) => tags.some((t) => t.toLowerCase() === e.toLowerCase());

export default function HealthMentors() {
  // Labels are translated; the filtering is not. Expertise comes from the
  // server in English, so comparing it with TRANSLATED tags emptied this list
  // in every other language. Filter on the raw (English) tags, case-blind.
  const MENTOR_TABS = useTranslated(RAW_MENTOR_TABS);
  const tr = useT();
  const { data, refetch, source } = useResource(
    useCallback(async (s: AbortSignal) => (await apiMentors(s)).filter((m) => m.expertise.some((e) => hasTag(RAW_HEALTH_TAGS, e))), []),
    [] as ApiMentor[],
  );
  const [tab, setTab] = useState<(typeof MENTOR_TABS)[number]["key"]>("womens");
  const [asking, setAsking] = useState<ApiMentor | null>(null);
  const [goal, setGoal] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const tags = RAW_MENTOR_TABS.find((t) => t.key === tab)?.tags ?? [];
  const shown = tags.length ? data.filter((m) => m.expertise.some((e) => hasTag(tags as readonly string[], e))) : data;

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
        <CycleHeader title={tr("healthMentors.healthMentors")} />
        <DeskTitle title={tr("healthMentors.healthMentors")} sub={tr("healthMentors.doctorsAndCoachesWhoAnswerWomen")} />

        <div className="relative overflow-hidden rounded-[20px] px-5 py-5" style={{ background: heroBg }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ux/art/leaves-pink.webp" alt="" aria-hidden className="absolute -end-10 -top-8 h-[150px] w-auto opacity-50 mix-blend-multiply" />
          <p className="ux-display relative text-[24px] font-bold leading-tight" style={{ color: "var(--cy-period-ink)" }}>You&apos;re not alone</p>
          <p className="relative mt-1 text-[17px] font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthMentors.talkToOurExpertMentors")}</p>
        </div>

        <div className="ux-scroll-x -mx-[20px] mt-4 flex gap-2 px-[20px]" role="tablist" aria-label={tr("healthMentors.kindOfMentor")}>
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

        <div className="mt-4">
          {source === "loading" && shown.length === 0 && (
            <MediaGrid cols={2}>
              {[0, 1].map((i) => <div key={i} className="h-[300px] animate-pulse rounded-[16px]" style={{ background: "var(--ux-surface-2)" }} />)}
            </MediaGrid>
          )}
          {source !== "loading" && shown.length === 0 && (
            <p className="rounded-[16px] px-4 py-6 text-center text-[15px]" style={{ background: "var(--ux-surface)", color: "var(--ux-muted)", border: "1px solid var(--ux-line)" }}>
              {tr("healthMentors.noMentorsHereYetWeAre")}
            </p>
          )}
          {/* Her face first when she has a photo — you are choosing a person. */}
          <MediaGrid cols={2}>
            {shown.map((m) => (
              <MediaCard key={m.id} ratio="4/3"
                image={artFor([m.expertise.join(" "), m.headline, m.focus], "health", m.photo, m.id)} alt={m.name}
                topLeft={m.expertise[0] ? { text: m.expertise[0] } : null}
                topRight={m.requested ? { text: "Asked", tone: "green" } : m.rating ? { text: `★ ${m.rating.toFixed(1)}`, tone: "dark" } : null}
                title={m.name}
                subtitle={m.headline}
                avatar={m.photo ? null : { name: m.name }}
                meta={<>
                  {m.experience_years > 0 && <Fact icon="Briefcase">{m.experience_years} years</Fact>}
                  {m.languages.length > 0 && <Fact icon="Languages">{m.languages.slice(0, 2).join(", ")}</Fact>}
                </>}
                footer={m.requested ? (
                  <span className="flex min-h-[38px] items-center justify-center rounded-[10px] text-[13px] font-semibold"
                        style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>Asked — we will introduce you</span>
                ) : (
                  <button type="button" onClick={() => { setAsking(m); setGoal(""); setError(null); }}
                          className="ux-press h-[40px] w-full rounded-[10px] px-4 text-[14px] font-semibold"
                          style={{ background: "linear-gradient(90deg, var(--cy-period), var(--ux-fill))", color: "var(--ux-on-brand)" }}>
                    Ask {m.name.split(" ")[0]}
                  </button>
                )}>
                {(m.focus || m.bio) && <p className="line-clamp-2 text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{m.focus || m.bio}</p>}
              </MediaCard>
            ))}
          </MediaGrid>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-[16px] px-4 py-3.5" style={{ background: "var(--cy-predicted)", border: "1px solid var(--ux-line)" }}>
          <Icons.HeartHandshake className="h-5 w-5 shrink-0" style={{ color: "var(--cy-period-ink)" }} aria-hidden />
          <p className="text-[13px]" style={{ color: "var(--ux-ink-2)" }}>
            <b className="font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("healthMentors.realWomenRealSupport")}</b><br />
            {tr("healthMentors.becauseEveryQuestionMatters")} <SoftHeart className="h-3.5 w-3.5" />
          </p>
        </div>

        <Sheet open={!!asking} onClose={() => setAsking(null)} title={`Ask ${asking?.name ?? ""}`} icon="MessageCircle"
               description={tr("healthMentors.whatWouldYouLikeToTalk")}>
          <textarea value={goal} onChange={(e) => setGoal(e.target.value.slice(0, 400))} rows={4} autoFocus
                    placeholder={tr("healthMentors.forExampleMyPeriodsHaveBeen")}
                    className="w-full resize-none rounded-[14px] p-3.5 text-[15px]"
                    style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)", border: "1px solid var(--ux-line-strong)" }} />
          <div className="mt-3">
            <CyButton onClick={send} busy={sending} disabled={goal.trim().length < 5}>{tr("healthMentors.sendMyQuestion")}</CyButton>
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
