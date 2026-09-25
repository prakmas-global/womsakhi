"use client";

import { use, useState } from "react";
import { COPY } from "@/components/ux/copy";
import Link from "next/link";
import * as Icons from "@/components/ux/icons";

import { Back, ActionBtn, Btn, Card, copy, EmptyState, NoteBtn, Pill, RailSkeleton, ScreenSkeleton, SectionHead } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useBookings } from "@/components/ux/live";
import { useAction } from "@/lib/use-action";
import { apiCancelBooking, apiLeaveFeedback } from "@/lib/member-api";
import { useT } from "@/i18n";

/**
 * One booking.
 *
 * The reference number is large and copyable, because it is the thing she will
 * be asked for at a door or on a call. Cancelling asks once and names who it
 * costs — a booking someone else is holding a place for is not a tab she is
 * closing.
 */
export default function BookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { data: BOOKINGS, source, refetch } = useBookings();

  // Same bug as the list had: this set local state and never told the server.
  const cancel = useAction(
    async (bookingId: string) => apiCancelBooking(bookingId),
    {
      onDone: refetch,
      optimistic: () => setCancelled(true),
      rollback: () => setCancelled(false),
      fallbackError: COPY.booking.cancelFailed,
    },
  );
  const b = BOOKINGS.find((x) => x.id === id);
  const [asking, setAsking] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [copied, setCopied] = useState(false);

  // "Not here" is a claim, and it cannot be made while the answer is still on
  // its way. Saying it during the fetch means every booking she opens flashes
  // "that booking is not here" before showing itself.
  if (!b && source === "loading") {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }

  if (!b) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="CalendarX"
            title={tr("bookings.thatBookingIsNotHere")}
            body={COPY.goneOrOld}
            action={<Btn href="/app/bookings" variant="primary" iconEnd="ArrowRight">{tr("bookings.allBookings")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  // Cancelled by her just now, or already cancelled on the server. The second
  // half was missing, so a booking the server had cancelled still offered a
  // live Cancel button and answered with a 400 she had done nothing to earn.
  const live = !cancelled && b.state !== "Cancelled" && b.state !== "Finished";

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={tr("bookings.showThisOnTheDay")} />
            {/* Large and copyable — this is what she is asked for at a door. */}
            <button
              // It said "Copied" and copied nothing — `setCopied(true)` on a
              // timer, with no clipboard write anywhere. She taps the code she
              // has been told to show at a door, is told it is on her
              // clipboard, and it is not.
              onClick={async () => {
                const said = await copy(b.ref);
                setCopied(said === "Copied");
                window.setTimeout(() => setCopied(false), 1800);
              }}
              className="ux-press ux-hov ux-sq flex w-full flex-col items-center rounded-[12px] px-4 py-5"
              style={{ background: "var(--ux-surface-2)" }}
            >
              <span className="font-mono text-2xl font-bold tracking-[0.06em]" style={{ color: "var(--ux-ink)" }}>
                {b.ref}
              </span>
              <span className="mt-2 flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--ux-brand)" }}>
                <Icons.Copy className="h-[13px] w-[13px]" />
                <span role="status">{copied ? "Copied" : "Tap to copy"}</span>
              </span>
            </button>
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              {b.kind === "Mentor"
                ? tr("bookings.youWillNotBeAskedFor")
              : tr("bookings.haveThisReadyAtTheDoor")}
            </p>
          </Card>

          <Card>
            <SectionHead title={tr("bookings.whatItCost")} />
            <div className="flex items-baseline justify-between">
              <span className="text-xsm" style={{ color: "var(--ux-muted)" }}>{b.cost}</span>
              {b.cost.includes("paid") && <Pill tone="green" size="sm">Paid</Pill>}
            </div>
            {live && (
              <>
                <div className="my-4 h-px" style={{ background: "var(--ux-line)" }} />
                <Btn href="/app/payments" variant="outline" size="sm" full icon="Receipt">Receipt</Btn>
              </>
            )}
          </Card>
        </div>
      }
    >
      <Back to="/app/bookings" label={tr("bookings.allBookings2")} className="mb-4" />

      <Card className="mb-[16px]">
        <div className="flex items-start gap-4">
          <span className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[16px]"
                style={{ background: "var(--ux-brand-tint)" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={b.art} alt="" className="h-full w-full object-cover" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h1 className="min-w-0 flex-1 text-xl font-bold leading-tight"
                  style={{ color: cancelled ? "var(--ux-muted)" : "var(--ux-ink)" }}>
                {b.what}
              </h1>
              <Pill tone={cancelled ? "neutral" : b.state === "Confirmed" ? "green" : b.state === "Waitlisted" ? "orange" : "neutral"}>
                {cancelled ? "Cancelled" : b.state}
              </Pill>
            </div>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
              <span className="inline-flex items-center gap-1.5"><Icons.Clock className="h-4 w-4" /> {b.when}</span>
              <span className="inline-flex items-center gap-1.5"><Icons.MapPin className="h-4 w-4" /> {b.where}</span>
            </p>
            {b.state === "Waitlisted" && !cancelled && (
              <p className="mt-3 rounded-[12px] p-3 text-xsm leading-relaxed"
                 style={{ background: "var(--ux-tint-orange)", color: "var(--ux-ink-2)" }}>
                You are third on the list. We will message you the moment a place opens — you do not need to
                check back.
              </p>
            )}
          </div>
        </div>

        {asking ? (
          <div className="ux-slide-up mt-4 flex items-center justify-between gap-4 rounded-[12px] p-3.5"
               style={{ background: "var(--ux-tint-orange)" }}>
            <p className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>
              {b.kind === "Mentor"
                ? "She has kept this hour free for you. Cancel it?"
                : b.kind === "Event"
                  ? COPY.booking.refundNote
                  : COPY.booking.placeGoesOn}
            </p>
            <span className="flex shrink-0 items-center gap-2">
              <Btn variant="outline" size="sm" onClick={() => setAsking(false)}>{tr("bookings.keepIt")}</Btn>
              <Btn variant="primary" size="sm"
                   className={cancel.busy ? "pointer-events-none opacity-60" : ""}
                   onClick={async () => { if (await cancel.run(id)) setAsking(false); }}>
                {cancel.busy ? "Cancelling…" : "Yes, cancel"}
              </Btn>
            </span>
          </div>
        ) : (
          <div className="mt-4 flex items-center justify-end gap-2 border-t pt-4" style={{ borderColor: "var(--ux-line)" }}>
            {live && (
              <>
                {/* Said "It is in your diary" and wrote nothing: there is no
                    reminder or calendar endpoint here. Her diary is built from
                    her bookings, so this one is already in it. */}
                <Btn href="/app/schedule" variant="outline" icon="CalendarDays">{tr("bookings.inYourDiary")}</Btn>
                <Btn variant="ghost" onClick={() => setAsking(true)}>{tr("bookings.cancelBooking")}</Btn>
              </>
            )}
            {live && b.kind === "Mentor" && (
              <ActionBtn variant="primary" icon="Video" doneIcon="Copy"
                         done={COPY.linkCopied}
                         act={() => copy(`https://meet.womsakhi.com/${b.id}`, COPY.linkCopied, "Copy it by hand: meet.womsakhi.com/" + b.id)}>{tr("bookings.joinTheCall")}</ActionBtn>
            )}
            {cancelled && <Btn href={b.kind === "Mentor" ? "/app/mentors" : "/app/events"} variant="soft" icon="RotateCcw">{tr("bookings.bookAgain")}</Btn>}
            {/* Went nowhere, and named a recipient who would never have seen
                it either way. /me/feedback reaches the team. */}
            {b.state === "Finished" && (
              <NoteBtn label={tr("bookings.leaveANote")} size="md" icon="Star" stars
                       title={`How was ${b.what}?`} to="the WomSakhi team"
                       placeholder={COPY.booking.feedbackAsk}
                       send={(n) => apiLeaveFeedback({
                         text: n.text, rating: n.rating,
                         type: b.kind === "Mentor" ? tr("bookings.mentoringSession")
              : tr("bookings.programFeedback"),
                         program: b.what,
                       })}
                       sent={COPY.noteReceived}
                       sentBody={COPY.booking.feedbackPrivate}
                       sentLink={null} />
            )}
          </div>
        )}

        {cancel.error && (
          <p className="ux-slide-up mt-3 text-xsm" style={{ color: "var(--ux-orange-ink)" }}>
            {cancel.error}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-[16px]">
        <Card>
          <SectionHead title={tr("bookings.whatToExpect")} />
          <ol className="ux-stagger space-y-3.5">
            {(b.kind === "Mentor"
              ? [["A reminder an hour before", "By message, with the joining link"],
                 ["Forty-five minutes together", "Video or voice — your choice on the day"],
                 ["Two lines each afterwards", "What to do next, so neither of you forgets"]]
              : [["Arrive a little early", "Doors open thirty minutes before"],
                 ["Bring your reference or your name", "Either works at the door"],
                 ["A recording or notes afterwards", "Sent within two days"]]
            ).map(([t, note], i) => (
              <li key={t} className="flex items-start gap-3">
                <span className="grid h-[24px] w-[24px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                      style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{t}</p>
                  <p className="mt-0.5 text-xsm leading-snug" style={{ color: "var(--ux-muted)" }}>{note}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <SectionHead title={tr("bookings.ifSomethingChanges")} icon="Info" />
          <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
            Cancelling is always allowed and never counts against you. Telling someone early is just kinder —
            it lets the place go to a woman who can use it.
          </p>
          <div className="mt-3.5">
            <Btn href="/app/help" variant="outline" size="sm" full iconEnd="ArrowRight">{tr("bookings.getHelp")}</Btn>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
