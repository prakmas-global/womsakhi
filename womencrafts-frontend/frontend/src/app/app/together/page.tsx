"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  ASSIST_QUEUE, HELPED, LESSONS, SEEDS, assistEarned, noPhone,
} from "@/components/ux/together/data";

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
  const router = useRouter();
  const [note, setNote] = useState<string | null>(null);

  const earned = useMemo(() => assistEarned(HELPED), []);
  const shared = useMemo(() => noPhone(HELPED), []);
  const urgent = useMemo(() => ASSIST_QUEUE.filter((t) => t.urgent).length, []);
  const learners = useMemo(() => LESSONS.reduce((n, l) => n + l.learners, 0), []);

  return (
    <HomeShell active="/app/together">
      <div className="flex flex-col gap-5">

        <header>
          <p className="text-[0.6875rem] font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>
            Together
          </p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>
            Things only a circle can do
          </h1>
          <p className="mt-1.5 max-w-[56ch] text-[0.875rem] leading-relaxed" style={{ color: v("--ux-muted") }}>
            Not a group chat. The four things that genuinely work better with women you already
            trust than alone.
          </p>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-[0.8125rem] font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(HELPED.length)} label="Women you run this for"
                  icon="UserPlus" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={formatRupees(earned)} label="You earned helping them"
                  icon="Wallet" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(learners)} label="Women learning from your circle"
                  icon="GraduationCap" tint="--ux-tint-blue" ink="--ux-blue-ink" />
          </div>
        </Card>

        {/* Assisted mode */}
        <Card pad={0} style={{ overflow: "hidden", borderColor: v("--ux-brand") }}>
          <div className="flex flex-wrap items-start gap-4 p-5" style={{ background: v("--ux-brand-tint") }}>
            <IconTile icon="UserPlus" tint="--ux-surface" ink="--ux-brand" size={48} radius={14} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>You run this for {HELPED.length} women</p>
                {urgent > 0 && <Pill tone="orange" size="sm">{urgent} needs you today</Pill>}
              </div>
              <p className="mt-1.5 max-w-[52ch] text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                <b>{shared} of them do not own the phone they use.</b> Without you they would not be
                here at all — and you are paid for every thing you do on their behalf.
              </p>
            </div>
            <Btn onClick={() => router.push("/app/together/assist")}>Open</Btn>
          </div>
        </Card>

        {/* The other three */}
        <div className="grid gap-3 md:grid-cols-3">
          {[
            { href: "/app/library", icon: "GraduationCap", tint: "--ux-tint-blue", ink: "--ux-blue-ink",
              title: "Learn it from her", body: "Women teach what they actually do — and you learn it beside a friend, which is the only way it sticks." },
            { href: "/app/circles", icon: "Users", tint: "--ux-tint-pink", ink: "--ux-pink-ink",
              title: "Who is missing", body: "A circle works when the money can go round it. Four women near you would close the loop." },
            { href: "/app/together/move", icon: "MapPin", tint: "--ux-tint-violet", ink: "--ux-violet",
              title: "If you move", body: "Marriage, work, or something worse. Everything you built comes with you." },
          ].map((t) => (
            <button key={t.href} type="button" onClick={() => router.push(t.href)}
                    className="ux-press ux-sq flex flex-col items-start gap-3 rounded-[var(--ux-r-card)] border p-5 text-left"
                    style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
              <IconTile icon={t.icon} tint={t.tint} ink={t.ink} size={44} radius={13} />
              <p className="text-[1rem] font-bold" style={{ color: v("--ux-ink") }}>{t.title}</p>
              <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-muted") }}>{t.body}</p>
            </button>
          ))}
        </div>

        {/* Seeding — who would close the cycle */}
        <div>
          <SectionHead title="Who is missing from your circle"
                       sub="Not the nearest women — the ones whose trade completes yours" icon="Users" />
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              Money only goes round a circle if the trades fit together. A circle of six tailors
              is six women waiting for the same customer.
            </p>
          </Card>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {SEEDS.map((s) => (
              <Card key={s.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={s.icon} tint="--ux-tint-green" ink="--ux-green-ink" size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.875rem] font-bold" style={{ color: v("--ux-ink") }}>{s.name}</p>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: v("--ux-muted") }}>
                      {s.trade} · {s.km} km away
                    </p>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: v("--ux-ink-2") }}>{s.closes}</p>
                  </div>
                </div>
                <Btn size="sm" variant="outline" full className="mt-3"
                     onClick={() => setNote(`Invited ${s.name}. She sees who invited her, and nothing else about you.`)}>
                  Ask her to join
                </Btn>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </HomeShell>
  );
}
