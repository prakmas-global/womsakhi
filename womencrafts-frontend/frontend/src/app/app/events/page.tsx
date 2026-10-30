"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import { apiCancelEvent, apiRegisterForEvent } from "@/lib/growth-api";
import { useAction } from "@/lib/use-action";

import {
  Btn, Card, EmptyState, IconTile,
  Progress, SectionHead, SourceNote, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ChipRow, Segments } from "@/components/ux/learning/native";
import {
  EVENT_ART as RAW_EVENT_ART, EVENT_KINDS as RAW_EVENT_KINDS, EVENTS as SAMPLE_EVENTS, eventLook, rupees, type Ev, type EventKind,
} from "@/components/ux/events/data";
import { useEvents } from "@/components/ux/growth";
import { PicChip, pictureOr, useMasterPictures } from "@/components/ux/media/MasterPictures";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";

/**
 * Events — melas, workshops, webinars and meets.
 *
 * A full event says so instead of offering a button that fails on tap, and a
 * paid one shows the fee beside the button rather than after it. Both are the
 * same principle: the cost of a decision belongs next to the decision.
 */
export default function EventsPage() {
  // Categories are the staff-controlled master; the old list shows until it loads.
  const kindPics = useMasterPictures("event_categories", RAW_EVENT_KINDS);
  const EVENT_KINDS = kindPics.labels;
  const EVENT_ART = useTranslated(RAW_EVENT_ART);
  const tr = useT();
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
  const shown = kinds.length ? pool.filter((e) => kinds.some((k) => k.toLowerCase() === (e.kind || "").toLowerCase())) : pool;

  return (
    <HomeShell
      active="/app/events"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("events.whereYouHaveBeen")} sub={tr("events.andWhatItBroughtIn")} />
            <ul className="ux-stagger space-y-3">
              {PAST_EVENTS.map((p) => (
                <li key={p.id} className="ux-hov flex items-center gap-3">
                  <IconTile icon={eventLook(p.kind).icon} tint={eventLook(p.kind).tint}
                            ink={eventLook(p.kind).ink} size={36} />
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
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{tr("events.oneMelaLastDiwaliBroughtIn")}</p>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-pink), var(--ux-tint-orange))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={EVENT_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[104px] w-[104px] object-contain" />
            <h2 className="relative w-[60%] text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{tr("events.hostSomething")}</h2>
            <p className="relative mt-2 w-[60%] text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>{tr("events.teachWhatYouKnowToTen")}</p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/feedback" variant="soft" size="sm" iconEnd="ArrowRight">{tr("events.proposeAnEvent")}</Btn>
            </div>
          </div>
        </div>
      }
    >
      {/* One large title with the segmented control under it on a phone; the
          title-left, tabs-right row it always was from `lg`. Written out rather
          than `ScreenHead`, whose sub-line carries a line-height this desktop
          header never had. */}
      <div className="mb-6 lg:mb-[20px] lg:flex lg:items-end lg:justify-between lg:gap-4">
        <div>
          <div className="flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title text-2xl font-bold min-w-0" style={{ color: "var(--ux-ink)" }}>Events</h1>
          </div>
          <p className="mt-2 text-xsm lg:mt-1.5" style={{ color: "var(--ux-muted)" }}>
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
        <div className="mt-4 lg:contents">
          <Segments items={["Coming up", "You are going"]} active={tab} onChange={setTab} label={tr("events.whichEvents")} />
        </div>
      </div>

      {/* One line the thumb pushes along on a phone; wraps as before on desktop. */}
      <ChipRow className="mb-6 lg:mb-[16px]">
        {/* The key is the server's English kind; only the label is translated.
            Filtering on the translated word matched nothing in Hindi. */}
        {EVENT_KINDS.map((k) => (
          <PicChip key={k} src={kindPics.pic(k)} selected={kinds.includes(k)}
                   onClick={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])}>
            {plural(k, 2)}
          </PicChip>
        ))}
      </ChipRow>

      {shown.length ? (
        <MediaGrid>
          {shown.map((e) => {
            // `seats: 0` from the API means the organiser has not set a limit,
            // not that every place has gone.
            const limited = e.spots > 0;
            const full = limited && e.taken >= e.spots;
            const on = isGoing(e);
            const busy = place.busyWith === e.id;
            // Its own cover when the organiser added one; otherwise the picture
            // of what happens there — a mela stall, a workshop, a talk — and
            // failing that, its category's.
            const cover = e.art && e.art !== SAMPLE_EVENTS[0]?.art ? e.art : null;
            return (
              <MediaCard
                key={e.id}
                href={`/app/events/${e.id}`}
                image={pictureOr(cover, [e.title, e.blurb], kindPics.of(e.kind))}
                topLeft={{ text: on ? "You are going" : e.kind, tone: on ? "brand" : "light" }}
                topRight={e.fee_minor > 0 ? { text: rupees(e.fee_minor), tone: "dark" } : { text: "Free", tone: "green" }}
                overlay={<><Icons.CalendarDays className="h-[13px] w-[13px]" /> {e.day} {e.month} · {e.time}</>}
                title={e.title}
                meta={<>
                  <Fact icon={e.online ? "Video" : "MapPin"}>{e.place}</Fact>
                  <Fact icon="Users">{!limited ? "Open to everyone" : full ? "Full" : `${e.spots - e.taken} of ${e.spots} places left`}</Fact>
                </>}
                footer={
                  <span className="flex items-center gap-2 [&>*]:flex-1">
                    <Btn href={`/app/events/${e.id}`} variant="outline" size="sm">{tr("events.theDetails")}</Btn>
                    {full && !on ? (
                      <span className="text-center text-xs font-medium" style={{ color: "var(--ux-orange-ink)" }}>{tr("events.everyPlaceHasGone")}</span>
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
                }
              >
                <p className="line-clamp-2 text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{e.blurb}</p>
                {limited && (
                  <div className="mt-2.5">
                    <Progress pct={(e.taken / e.spots) * 100} track="--ux-track" h={5}
                              tone={full ? "--ux-orange" : "--ux-brand-600"} />
                  </div>
                )}
              </MediaCard>
            );
          })}
        </MediaGrid>
      ) : (
        <Card>
          <EmptyState
            icon="CalendarX"
            title={tab === "You are going" ? tr("events.nothingBookedYet")
              : tr("events.nothingOfThatKindComingUp")}
            body={tr("events.melasWorkshopsAndMeetsAreAdded")}
            action={<Btn onClick={() => { setTab("Coming up"); setKinds([]); }} variant="soft">{tr("events.seeEverything")}</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
