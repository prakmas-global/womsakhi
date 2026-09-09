"use client";

import { useState } from "react";
import { COPY } from "@/components/ux/copy";

import { useDiary } from "@/components/ux/diary";
import * as Icons from "@/components/ux/icons";

import { ActionBtn, Btn, Card, EmptyState, IconTile, SectionHead, SourceNote, Stat, Tabs, copy } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";

/** Upcoming Activities — what she has committed to. */


export default function Schedule() {
  const [tab, setTab] = useState("Upcoming");
  /** Her diary — bookings, events she registered for, accepted mentor sessions. */
  const { data: diary, source } = useDiary();
  const EVENTS = diary.entries;
  // Today and the six days after it, built in the fetcher — see `useDiary`.
  const week = diary.week;
  const shown = EVENTS.filter((e) => (tab === "Upcoming" ? !e.past : e.past));
  /**
   * Counted, not asserted.
   *
   * The rail said "5 Activities this month" and "12 Attended so far" to every
   * woman, including one with an empty diary. Both come off the diary she is
   * looking at.
   */
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthCount = EVENTS.filter((e) => e.on.startsWith(thisMonth)).length;
  const attended = EVENTS.filter((e) => e.past).length;

  return (
    <HomeShell
      active="/app/schedule"
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title="This week" />
            <div className="flex justify-between">
              {week.map((w, i) => (
                <div key={w.iso} className="flex flex-col items-center gap-2" style={{ ["--i" as string]: i }}>
                  <span className="text-2xs" style={{ color: "var(--ux-muted)" }}>{w.letter}</span>
                  <span className="ux-pop grid h-[30px] w-[30px] place-items-center rounded-full text-xs font-semibold"
                        style={{ background: w.has ? "var(--ux-brand-600)" : "var(--ux-surface-2)",
                                 color: w.has ? "var(--ux-on-brand)" : "var(--ux-muted)" }}>
                    {w.date}
                  </span>
                </div>
              ))}
            </div>
          </Card>
          <Card><Stat value={String(monthCount)} label="Activities this month" icon="CalendarDays" tint="--ux-tint-violet" ink="--ux-violet" /></Card>
          <Card><Stat value={String(attended)} label="Been to so far" icon="CheckCheck" tint="--ux-tint-green" ink="--ux-green" /></Card>
          <div className="relative overflow-hidden rounded-[16px] p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-lilac), var(--ux-tint-pink))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src="/ux/art/scene-woman-planning-board.webp" alt=""
                 className="ux-float pointer-events-none absolute -bottom-2 -end-3 h-[96px] w-[96px] object-contain" />
            <h3 className="relative text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>Plan your week</h3>
            <p className="relative mt-2 w-[62%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Two hours booked in advance is two hours you actually get.
            </p>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Your calendar</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            Sessions, classes and events you have said yes to.
          </p>
          <SourceNote source={source} what="your diary" />
        </div>
        {/* "Cancelled" is gone: a cancelled booking is not in her diary, and
            the tab was permanently empty because nothing ever filled it. */}
        <Tabs items={["Upcoming", "Past"]} active={tab} onChange={setTab} />
      </div>

      {shown.length ? (
        <div className="ux-stagger space-y-[16px]">
          {shown.map((e, i) => (
            <Card key={e.id} className="ux-i ux-rise" style={{ ["--i" as string]: i }}>
              <div className="flex items-center gap-4">
                <div className="grid h-[58px] w-[54px] shrink-0 place-items-center rounded-[12px]"
                     style={{ background: "var(--ux-brand-tint)" }}>
                  <span className="text-lg font-bold leading-none" style={{ color: "var(--ux-brand)" }}>{e.d}</span>
                  <span className="mt-0.5 text-2xs font-semibold" style={{ color: "var(--ux-brand)" }}>{e.m}</span>
                </div>
                <IconTile icon={e.icon} tint={e.tint} ink={e.ink} size={40} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{e.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--ux-muted)" }}>
                    <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {e.time}</span>
                    <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {e.where}</span>
                    <span className="inline-flex items-center gap-1"><Icons.Tag className="h-3.5 w-3.5" /> {e.kind}</span>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {/* "Remind me" answered "We will remind you" and set nothing
                      going: this API has no reminder — notifications are
                      written by staff, and there is nothing a member can
                      schedule. Rather than promise one, the row opens the
                      thing it is about. */}
                  <Btn href={e.href} variant="outline" size="sm" iconEnd="ArrowRight">Open</Btn>
                  {e.cta === "Join" ? (
                    <ActionBtn variant="primary" size="sm" icon="Video" doneIcon="Copy" done="Link copied"
                               act={() => copy(`https://meet.womsakhi.in/${e.id}`, COPY.linkCopied, "meet.womsakhi.in/" + e.id)}>
                      Join
                    </ActionBtn>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState icon="CalendarX" title={`Nothing ${tab.toLowerCase()}`}
            body="Sessions and events you join will be listed here, with the time and where to go."
            action={<Btn href="/app/events" variant="soft" iconEnd="ArrowRight">Browse events</Btn>} />
        </Card>
      )}
    </HomeShell>
  );
}
