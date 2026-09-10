"use client";

import { useCallback, useMemo, useState } from "react";
import { COPY } from "@/components/ux/copy";
import * as Icons from "@/components/ux/icons";

import {
  ActionBtn, Btn, Card, EmptyState, NoteBtn, Pill,
  SectionHead, SourceNote, Tabs, copy, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBookings } from "@/components/ux/live";
import { useAction } from "@/lib/use-action";
import { apiCancelBooking, apiLeaveFeedback } from "@/lib/member-api";
import { useT } from "@/i18n";


/**
 * Bookings — everything she has said yes to.
 *
 * Cancelling asks once and says what it costs, because a booking someone else
 * is holding a place for is not the same as closing a tab. A waitlisted place
 * says what it is waiting for rather than pretending to be confirmed.
 */
export default function BookingsPage() {
  const tr = useT();
  const { data: BOOKINGS, source, refetch } = useBookings();

  /**
   * Cancelling used to set local state and stop there.
   *
   * The endpoint existed the whole time and was never called, so a woman who
   * cancelled a mentor session was still expected on the day — the mentor held
   * an hour for somebody who thought she had said no. That is the worst kind
   * of bug in this app: the screen agreed with her and the world did not.
   *
   * Optimistic, because the tap has to feel instant on 2G; rolled back and
   * named if the server refuses, because a cancellation that silently failed
   * is the same bug wearing a different hat.
   */
  const cancel = useAction(
    async (id: string) => apiCancelBooking(id),
    {
      onDone: refetch,
      optimistic: (id: string) => setCancelled((c) => [...c, id]),
      rollback: (id: string) => setCancelled((c) => c.filter((x) => x !== id)),
      fallbackError: COPY.booking.cancelFailed,
    },
  );
  const [tab, setTab] = useState("Coming up");
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState<string[]>([]);

  /**
   * Cancelled means cancelled — by her just now, or by the server already.
   *
   * `cancelled` was only the local list, so a booking the server had already
   * cancelled still showed under "Coming up" with a live Cancel button on it.
   * Pressing it got a 400 she had done nothing to deserve, and the row looked
   * like a session she was still expected at.
   */
  const isGone = useCallback(
    (b: (typeof BOOKINGS)[number]) => cancelled.includes(b.id) || b.state === "Cancelled",
    [cancelled],
  );

  const shown = useMemo(() => BOOKINGS.filter((b) => {
    if (isGone(b)) return tab === "Past";
    return tab === "Coming up" ? b.state !== "Finished" : b.state === "Finished";
  }), [BOOKINGS, tab, isGone]);

  const upcoming = BOOKINGS.filter((b) => b.state !== "Finished" && !isGone(b)).length;

  return (
    <HomeShell
      active="/app/schedule"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("bookings.beforeYouCancel")} icon="Info" />
            <ul className="space-y-2.5">
              {[
                "A mentor has kept that hour free for you.",
                "A workshop place goes to whoever is next on the list.",
                "A paid stall fee comes back within 5–7 working days.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                  <Icons.Dot className="mt-[1px] h-[15px] w-[15px] shrink-0" style={{ color: "var(--ux-brand)" }} />
                  {t}
                </li>
              ))}
            </ul>
            <p className="mt-3.5 rounded-[12px] p-3 text-xs leading-relaxed"
               style={{ background: "var(--ux-surface-2)", color: "var(--ux-muted)" }}>{tr("bookings.cancellingIsAlwaysAllowedAndNever")}</p>
          </Card>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>Bookings</h1>
          <p className="mt-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            {upcoming} {plural("booking", upcoming)} coming up
          </p>
        </div>
        <Tabs items={["Coming up", "Past"]} active={tab} onChange={setTab} />
      </div>

      <SourceNote source={source} what="bookings" />

      {shown.length ? (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {shown.map((b, i) => {
            const gone = isGone(b);
            const asking = cancelling === b.id;
            return (
              <Card key={b.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <span className="h-[54px] w-[54px] shrink-0 overflow-hidden rounded-[12px]"
                        style={{ background: "var(--ux-brand-tint)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={b.art} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-sm font-semibold"
                          style={{ color: gone ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                        {b.what}
                      </h3>
                      <Pill tone={gone ? "neutral" : b.state === "Confirmed" ? "green" : b.state === "Waitlisted" ? "orange" : "neutral"} size="sm">
                        {gone ? "Cancelled" : b.state}
                      </Pill>
                    </div>
                    <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                       style={{ color: "var(--ux-muted)" }}>
                      <span className="inline-flex items-center gap-1"><Icons.Clock className="h-3.5 w-3.5" /> {b.when}</span>
                      <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" /> {b.where}</span>
                      <span>{b.ref}</span>
                    </p>
                    <p className="mt-2 text-xs" style={{ color: "var(--ux-ink-2)" }}>
                      {b.state === "Waitlisted"
                        ? "You are third on the list. We will tell you the moment a place opens."
                        : b.cost}
                    </p>
                  </div>
                </div>

                {/* A refusal is shown on the booking it happened to. A woman
                    who pressed cancel and saw the row unchanged has to be told
                    why, or she will assume it worked. */}
                {cancel.error && cancelling === b.id && (
                  <p className="ux-slide-up mt-3 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
                    {cancel.error}
                  </p>
                )}

                {/* Confirm in place, saying what it costs — a booking someone
                    else is holding a place for is not a tab she is closing. */}
                {asking ? (
                  <div className="ux-slide-up mt-3.5 flex items-center justify-between gap-4 rounded-[12px] p-3.5"
                       style={{ background: "var(--ux-tint-orange)" }}>
                    <p className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
                      {b.kind === "Mentor"
                        ? "She has kept this hour free. Cancel it?"
                        : b.kind === "Event"
                          ? COPY.booking.refundNote
                          : COPY.booking.placeGoesOn}
                    </p>
                    <span className="flex shrink-0 items-center gap-2">
                      <Btn variant="outline" size="sm" onClick={() => setCancelling(null)}>{tr("bookings.keepIt")}</Btn>
                      <Btn variant="primary" size="sm"
                           className={cancel.busyWith === b.id ? "pointer-events-none opacity-60" : ""}
                           onClick={async () => {
                             const ok = await cancel.run(b.id);
                             if (ok) setCancelling(null);
                           }}>
                        {cancel.busyWith === b.id ? "Cancelling…" : "Yes, cancel"}
                      </Btn>
                    </span>
                  </div>
                ) : (
                  <div className="mt-3.5 flex items-center justify-end gap-2 border-t pt-3.5"
                       style={{ borderColor: "var(--ux-line)" }}>
                    {/* The detail page existed and nothing linked to it: the only
                        ways in were the calendar and typing the URL. It holds
                        the reference code she shows at the door, so it is the
                        first action, not a hidden one. */}
                    <Btn href={`/app/bookings/${b.id}`} variant="ghost" size="sm" iconEnd="ArrowRight">
                      Open
                    </Btn>
                    {!gone && b.state !== "Finished" && (
                      <>
                        {/* "Add to calendar" said "It is in your diary" and
                            wrote nothing anywhere — there is no reminder
                            service and no calendar endpoint in this API. Her
                            diary is built from her bookings, so the booking
                            itself is already the entry; the link goes there
                            rather than promising a second one. */}
                        <Btn href="/app/schedule" variant="outline" size="sm" icon="CalendarDays">{tr("bookings.inYourDiary")}</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => setCancelling(b.id)}>Cancel</Btn>
                      </>
                    )}
                    {b.state === "Confirmed" && b.kind === "Mentor" && (
                      <ActionBtn variant="primary" size="sm" icon="Video" doneIcon="Copy"
                                 done={tr("bookings.linkCopied")}
                                 act={() => copy(`https://meet.womsakhi.in/${b.id}`, "Link copied", "meet.womsakhi.in/" + b.id)}>
                        Join
                      </ActionBtn>
                    )}
                    {/* The words went nowhere and the box promised other
                        women would read them. /me/feedback puts them in front
                        of the team who run the sessions, and nowhere else —
                        which is what it now says. */}
                    {b.state === "Finished" && (
                      <NoteBtn label={tr("bookings.leaveANote")} icon="Star" stars
                               title={`How was ${b.what}?`} to="the WomSakhi team"
                               placeholder={COPY.booking.feedbackAsk}
                               send={(n) => apiLeaveFeedback({
                                 text: n.text, rating: n.rating,
                                 type: "Program Feedback", program: b.what,
                               })}
                               sent={COPY.noteReceived}
                               sentBody={COPY.booking.feedbackPrivate}
                               sentLink={null} />
                    )}
                    {gone && <Btn href={b.kind === "Mentor" ? "/app/mentors" : "/app/events"} variant="soft" size="sm" icon="RotateCcw">{tr("bookings.bookAgain")}</Btn>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="CalendarX"
            title={tab === "Past" ? tr("bookings.nothingHasFinishedYet")
              : tr("bookings.nothingBooked")}
            body="Mentor sessions, workshops and melas you say yes to appear here."
            action={<Btn href="/app/events" variant="primary" iconEnd="ArrowRight">{tr("bookings.findSomething")}</Btn>}
          />
        </Card>
      )}
    </HomeShell>
  );
}
