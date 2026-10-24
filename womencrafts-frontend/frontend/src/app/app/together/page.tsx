"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { useResource } from "@/lib/use-resource";
import { apiSisters, apiTogether, type Sister, type Together } from "@/lib/life-api";
import { useT } from "@/i18n";
import { MessageHer } from "@/components/ux/MessageHer";
import { MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";
import { artFor } from "@/components/ux/media/art";
import { GroupLabel, PhoneTitle, phonePrimary } from "@/components/ux/PhoneParts";

/** The three places the circle does together, besides assisting. */
const PLACES = [
  { href: "/app/library", icon: "GraduationCap", tint: "--ux-tint-blue", ink: "--ux-blue-ink", art: "/ux/art/course-teaching-another-woman.webp",
    title: "Learn it from her", body: "Women teach what they actually do — and you learn it beside a friend, which is the only way it sticks." },
  { href: "/app/circles", icon: "Users", tint: "--ux-tint-pink", ink: "--ux-pink-ink", art: "/ux/art/circle-vision-board.webp",
    title: "Who is missing", body: "A circle works when the money can go round it. See the trades in your circles, and which are missing." },
  { href: "/app/together/move", icon: "MapPin", tint: "--ux-tint-violet", ink: "--ux-violet", art: "/ux/art/circle-dashboard-hero-v2.webp",
    title: "If you move", body: "Marriage, work, or something worse. A checklist so you keep what you built." },
];

/** Lines she can tap instead of typing to a woman from her circle. */
const PHRASES = (trade: string) => [
  ...(trade ? [`I need help with ${trade.toLowerCase()}`] : []),
  "Can we work on an order together?", "Do you know someone who can help?", "Hello from our circle!",
];

/**
 * Together — the circle doing the things a circle is uniquely able to do.
 *
 * Each tile below exists because of a specific finding, not because it sounded
 * nice: assisted mode because the device gap is widening and no onboarding flow
 * fixes it; learning in pairs because that is the only training design with a
 * real effect; seeding by trade because circulation requires closed cycles;
 * carrying her record because migration is how women lose everything at once.
 */
export default function TogetherHub() {
  const tr = useT();
  const router = useRouter();
  const [note] = useState<string | null>(null);

  /**
   * Hers, and her circles'.
   *
   * Everything on this hub was written into the file: four women she was
   * already assisting with dated consents, three tasks waiting, four skills
   * being taught by named women, and four neighbours to invite — each with a
   * distance and a worked-out reason the two of them fit.
   *
   * The distances and the reasons are gone rather than recomputed. Nothing in
   * this product knows how far apart two women live, and nothing knows that
   * she buys vegetables from Rekha every week.
   */
  const together = useResource<Together>(
    useCallback((sig: AbortSignal) => apiTogether(sig), []),
    { helping: [], queue: [], teaching: [], helped_count: 0, consented_count: 0, waiting: 0 },
  );
  const sisters = useResource<{ sisters: Sister[]; count: number }>(
    useCallback((sig: AbortSignal) => apiSisters(sig), []),
    { sisters: [], count: 0 },
  );

  const HELPED = together.data.helping;
  const LESSONS = together.data.teaching;
  const SEEDS = sisters.data.sisters;

  const shared = useMemo(() => HELPED.filter((w) => !w.owns_phone).length, [HELPED]);
  const urgent = useMemo(() => together.data.queue.filter((t) => t.urgent).length, [together.data.queue]);
  const learners = useMemo(() => LESSONS.reduce((n, l) => n + l.learners, 0), [LESSONS]);

  return (
    <HomeShell active="/app/together">
      <div className="flex flex-col gap-5">

        {/* On a phone the section's name is the large title; the headline and
            the paragraph follow it as quiet text. */}
        <PhoneTitle title="Together" sub={tr("together.thingsOnlyACircleCanDo")}
                    note={tr("together.notAGroupChatTheFour")} />
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Together
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("together.thingsOnlyACircleCanDo")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Not a group chat. The four things that genuinely work better with women you already
            trust than alone.
          </p>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(HELPED.length)} label={tr("together.womenYouRunThisFor")}
                  icon="UserPlus" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={String(together.data.queue.length)} label="Waiting to be done"
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(learners)} label={tr("together.womenLearningFromYourCircle")}
                  icon="GraduationCap" tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
        </Card>

        {/* Assisted mode */}
        <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-brand") }}>
          <div className="flex flex-wrap items-start gap-4 p-5 max-lg:p-4" style={{ background: v("--ux-brand-tint") }}>
            <IconTile icon="UserPlus" tint="--ux-surface" ink="--ux-brand" size={48} radius={14} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>You run this for {HELPED.length} women</p>
                {urgent > 0 && <Pill tone="orange" size="sm">{urgent} needs you today</Pill>}
              </div>
              <p className="mt-1.5 max-w-[52ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                <b>{shared} of them do not own the phone they use.</b> Without you they would not be
                here at all — and you are paid for every thing you do on their behalf.
              </p>
            </div>
            <Btn className={phonePrimary} onClick={() => router.push("/app/together/assist")}>Open</Btn>
          </div>
        </Card>

        {/* The other three, each with a picture of what happens there. */}
        <MediaGrid>
          {PLACES.map((t) => (
            <MediaCard key={t.href} href={t.href} image={t.art} alt="" title={t.title}>
              <p className="text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{t.body}</p>
            </MediaCard>
          ))}
        </MediaGrid>

        {/* Seeding — who would close the cycle */}
        <div>
          <GroupLabel sub={tr("together.notTheNearestWomenTheOnes")}>{tr("together.whoIsMissingFromYourCircle")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("together.whoIsMissingFromYourCircle")}
                         sub={tr("together.notTheNearestWomenTheOnes")} icon="Users" />
          </div>
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Money only goes round a circle if the trades fit together. A circle of six tailors
              is six women waiting for the same customer.
            </p>
          </Card>
          {/* The women who would close the loop — each shown with her trade. */}
          <MediaGrid className="mt-3">
            {SEEDS.map((s) => (
              <MediaCard key={s.id} image={artFor([s.trade], "generic", null, s.id)} alt="" ratio="3/2"
                         topLeft={s.trade ? { text: s.trade } : null}
                         title={s.name}
                         avatar={{ name: s.name }}
                         subtitle={[s.where, "In a circle with you"].filter(Boolean).join(" · ")}
                         footer={<MessageHer userId={s.id} name={s.name} full about="From your circle" phrases={PHRASES(s.trade)} />} />
            ))}
          </MediaGrid>
        </div>
      </div>
    </HomeShell>
  );
}
