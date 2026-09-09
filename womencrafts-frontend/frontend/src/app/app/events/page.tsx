"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { apiCancelEvent, apiRegisterForEvent } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";

import {
  Btn, Card, Chip, EmptyState, IconTile,
  Pill, Progress, SectionHead, SourceNote, Tabs, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import {
  EVENT_ART, EVENT_KINDS, rupees, type Ev, type EventKind,
} from "@/components/ux/events/data";
import { useEvents } from "@/components/ux/growth";

/**
 * Events — melas, workshops, webinars and meets.
 *
 * A full event says so instead of offering a button that fails on tap, and a
 * paid one shows the fee beside the button rather than after it. Both are the
 * same principle: the cost of a decision belongs next to the decision.
 */
export default function EventsPage() {
  // Split in the fetcher, not here: reading the clock during render makes the
  // same props produce different output.
  const { data: events, source, refetch } = useEvents();
  const EVENTS = events.upcoming;
  const PAST_EVENTS = events.past;
  const [tab, setTab] = useState("Coming up");
  const [kinds, setKinds] = useState<EventKind[]>([]);

  /**
   * Which events she has a place at — the server's answer, with a press still
   * in flight allowed to show through.
   *
   * This was `useState(EVENTS.filter((e) => e.going).map((e) => e.id))`, which
   * runs on the first render — before the fetch has landed — so it was seeded
   * from the mock fallback and never corrected. "You are going" was empty for
   * a woman with two places booked, and pressing "Join" only rewrote that same
   * local array: the organiser never heard.
   */
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const isGoing = (e: Ev) => pending[e.id] ?? e.going;
  const going = EVENTS.filter(isGoing);

  const place = useAction(
    async (id: string, want: string) => {
      if (want === "going") await apiRegisterForEvent(id);
      else await apiCancelEvent(id);
    },
    {
      onDone: refetch,
      optimistic: (id, want) => setPending((p) => ({ ...p, [id]: want === "going" })),
      rollback: (id) => setPending((p) => { const n = { ...p }; delete n[id]; return n; }),
      fallbackError: "That did not go through. Your place is not booked — try again in a moment.",
    },
  );

  // No `useMemo`. It had one, and it was missing `EVENTS`: the list was built
  // once from the mock fallback and never rebuilt when the real events landed,
  // so the header said "4 coming up" above four events nobody had organised.
  const pool = tab === "You are going" ? going : EVENTS;
  const shown = kinds.length ? pool.filter((e) => kinds.includes(e.kind)) : pool;

  return (
    <HomeShell
      active="/app/events"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="Where you have been" sub="And what it brought in" />
            <ul className="ux-stagger space-y-3">
              {PAST_EVENTS.map((p) => (
                <li key={p.id} className="ux-hov flex items-center gap-3">
                  <IconTile icon={p.kind === "Mela" ? "Store" : "GraduationCap"}
                            tint={p.kind === "Mela" ? "--ux-tint-pink" : "--ux-tint-violet"}
                            ink={p.kind === "Mela" ? "--ux-pink" : "--ux-violet"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xsm font-medium" style={{ color: "var(--ux-ink)" }}>{p.title}</p>
                    <p className="mt-0.5 text-2xs" style={{ color: "var(--ux-muted)" }}>{p.when}</p>
                  </div>
                  {/* What she earned at a past mela is not recorded anywhere —
                      the takings went into her own hand, not through us. The
                      line is dropped rather than showing a figure we invented
                      about her income. */}
                </li>
              ))}
            </ul>
            <p className="mt-3.5 rounded-[12px] p-3 text-xs leading-relaxed"
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
              One mela last Diwali brought in more than three weeks of orders.
            </p>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-pink), var(--ux-tint-orange))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={EVENT_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[104px] w-[104px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>
              Host something
            </h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Teach what you know to ten women near you. We handle the room.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/feedback" variant="soft" size="sm" iconEnd="ArrowRight">Propose an event</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Events</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {going.length} {plural("event", going.length)} you are going to · {EVENTS.length} coming up
          </p>

      <SourceNote source={source} what="events" />
      {place.error && (
        <p role="alert" className="ux-slide-up mt-2 text-xsm leading-relaxed"
           style={{ color: "var(--ux-orange-ink)" }}>
          {place.error}
        </p>
      )}
        </div>
        <Tabs items={["Coming up", "You are going"]} active={tab} onChange={setTab} />
      </div>

      <div className="mb-[16px] flex flex-wrap gap-2">
        {EVENT_KINDS.map((k) => (
          <Chip key={k} selected={kinds.includes(k)}
                onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
            {plural(k, 2)}
          </Chip>
        ))}
      </div>

      {shown.length ? (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {shown.map((e, i) => {
            // `seats: 0` from the API means the organiser has not set a limit,
            // not that every place has gone. `taken >= spots` read 0 >= 0 and
            // stamped "Full" on an open talk anybody could join.
            const limited = e.spots > 0;
            const full = limited && e.taken >= e.spots;
            const on = isGoing(e);
            const busy = place.busyWith === e.id;
            return (
              <Card key={e.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }} pad={0}>
                <div className="flex">
                  <span className="relative h-[168px] w-[190px] shrink-0 overflow-hidden"
                        style={{ background: `var(${e.tint})` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={e.art} alt="" className="ux-art h-full w-full object-cover" />
                    <span className="absolute start-3 top-3 grid h-[52px] w-[46px] place-items-center rounded-[12px]"
                          style={{ background: "var(--ux-surface)", boxShadow: "var(--ux-shadow-card)" }}>
                      <span className="text-lg font-bold leading-none" style={{ color: "var(--ux-brand)" }}>{e.day}</span>
                      <span className="text-2xs font-semibold" style={{ color: "var(--ux-brand)" }}>{e.month}</span>
                    </span>
                  </span>

                  <div className="flex min-w-0 flex-1 flex-col p-[16px]">
                    <div className="flex items-start gap-2">
                      <h2 className="min-w-0 flex-1 text-base font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {e.title}
                      </h2>
                      <Pill tone={e.kind === "Mela" ? "pink" : e.kind === "Webinar" ? "blue" : e.kind === "Workshop" ? "green" : "orange"} size="sm">
                        {e.kind}
                      </Pill>
                      {on && <Pill tone="brand" size="sm">Going</Pill>}
                    </div>

                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--ux-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {e.time}</span>
                      <span className="inline-flex items-center gap-1">
                        <Icons.MapPin className="h-3.5 w-3.5" /> {e.place}
                      </span>
                    </p>

                    <p className="mt-2 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{e.blurb}</p>

                    <div className="mt-3">
                      <div className="mb-1.5 flex items-center justify-between text-2xs">
                        <span style={{ color: full ? "var(--ux-orange-ink)" : "var(--ux-muted)" }}>
                          {!limited ? "Open to everyone" : full ? "Full" : `${e.spots - e.taken} of ${e.spots} places left`}
                        </span>
                        <span className="font-semibold" style={{ color: "var(--ux-ink)" }}>{rupees(e.fee_minor)}</span>
                      </div>
                      {limited && (
                        <Progress pct={(e.taken / e.spots) * 100} track="--ux-track" h={5}
                                  tone={full ? "--ux-orange" : "--ux-brand-600"} />
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-3.5">
                      <span className="text-xs" style={{ color: "var(--ux-faint)" }}>
                        {e.online ? "Joining link sent on the day" : "Bring your own stock"}
                      </span>
                      <span className="flex items-center gap-2">
                        {/* "Remind me" and "Tell me if a place opens" used to
                            live here. Both were ActionBtns with no action at
                            all: nothing schedules a reminder and nothing keeps
                            a waiting list, so both said "we will" about
                            something nobody had arranged. A full event now
                            says it is full, in words, where the button was. */}
                        <Btn href={`/app/events/${e.id}`} variant="outline" size="sm">The details</Btn>
                        {full && !on ? (
                          <span className="text-xs font-medium" style={{ color: "var(--ux-orange-ink)" }}>
                            Every place has gone
                          </span>
                        ) : (
                          <Btn variant={on ? "outline" : "primary"} size="sm"
                               icon={busy ? "Loader" : on ? "Check" : undefined}
                               iconEnd={busy || on ? undefined : "ArrowRight"}
                               disabled={busy}
                               onClick={() => void place.run(e.id, on ? "not going" : "going")}>
                            {busy ? "Sending…" : on ? "Going" : e.fee_minor > 0 ? `Book · ${rupees(e.fee_minor)}` : "Join"}
                          </Btn>
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="CalendarX"
            title={tab === "You are going" ? "Nothing booked yet" : "Nothing of that kind coming up"}
            body="Melas, workshops and meets are added every month."
            action={<Btn onClick={() => { setTab("Coming up"); setKinds([]); }} variant="soft">See everything</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
