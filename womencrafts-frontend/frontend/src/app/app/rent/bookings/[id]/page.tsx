"use client";
/* eslint-disable @next/next/no-img-element */

import { use, useCallback, useState } from "react";
import Link from "next/link";

import * as Icons from "@/components/ux/icons";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Avatar, Back, Btn, Card, EmptyState, I, ScreenSkeleton, v } from "@/components/ux/kit";
import { Area, Label, Picks, Toggle } from "@/components/ux/kit/form";
import { formatMoney } from "@/components/ux/kit/money";
import { Sheet } from "@/components/ux/kit/sheet";
import { MessageHer } from "@/components/ux/MessageHer";
import { toast } from "@/components/ux/mobile/Toast";
import { PhotoPicker } from "@/components/ux/rent/PhotoPicker";
import {
  CANCEL_REASONS, DAMAGE_NOTES, DECLINE_REASONS, PROBLEM_LINES, daysUntil, nextFor,
} from "@/components/ux/rent/bookings/look";
import { History, MoneyBox, PhotosCompare, RentSafety, ReviewCard, StepTrack, datesLine } from "@/components/ux/rent/bookings/parts";
import { addDays, isoOf, nice } from "@/components/ux/rent/board/DateRange";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  CONDITION_LOOK, apiAcceptBooking, apiCancelBooking, apiDeclineBooking, apiDepositBack, apiHandover, apiRentalBooking,
  apiRentalProblem, apiRentalReview, apiReturned, type Booking, type Condition,
} from "@/lib/rentals-api";

/**
 * One rental, from her side (backend: routes/rentals.py /rentals/bookings/{id}).
 *
 * The track says where it stands; one lit card says what SHE does next, with
 * the button for it. Each step that changes money or the thing's condition —
 * handing over, taking back — opens a short sheet of taps and photos, because
 * those are the moments a disagreement starts from later. Everything that
 * happened is listed at the bottom, the record both women can point to.
 */

type Open = "" | "decline" | "cancel" | "handover" | "return" | "problem";

export default function RentBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const res = useResource(useCallback((s: AbortSignal) => apiRentalBooking(id, s), [id]), null as Booking | null);
  const [b, setB] = useState<Booking | null>(null);
  const [busy, setBusy] = useState("");
  const [open, setOpen] = useState<Open>("");

  // The freshest copy: the one a step just returned, else what loaded.
  const bk = b && b.id === res.data?.id ? b : res.data;

  if (res.source === "loading" && !bk) return <HomeShell wide skeleton="detail"><ScreenSkeleton shape="detail" /></HomeShell>;
  if (!bk) {
    return (
      <HomeShell>
        <Back to="/app/rent/bookings" label="My rentals" className="mb-4" />
        <Card>
          <EmptyState icon="CalendarX" title="This rental could not load"
                      body="Check your connection and try again."
                      action={<Btn icon="RotateCw" variant="outline" onClick={res.refetch}>Try again</Btn>} />
        </Card>
      </HomeShell>
    );
  }

  const owner = bk.side === "owner";
  const step = async (key: string, run: () => Promise<Booking>, done: string) => {
    setBusy(key);
    try {
      const fresh = await run();
      setB(fresh);
      setOpen("");
      toast(done, { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e, "That did not go through. Try again."), { tone: "error" });
    } finally { setBusy(""); }
  };

  const next = nextFor(bk);
  const canHandOver = isoOf(new Date()) >= addDays(bk.start, -1);
  const canReview = (bk.status === "returned" || bk.status === "closed") && !bk.i_reviewed;
  const canRaise = ["active", "returned", "closed"].includes(bk.status) && !bk.problem;

  /** Her next step, with its button. */
  const action = (() => {
    if (bk.status === "requested" && owner) return (
      <div className="flex flex-col gap-2 sm:flex-row sm:[&>*]:flex-1">
        <Btn icon="Check" loading={busy === "accept"} onClick={() => void step("accept", () => apiAcceptBooking(bk.id), `Confirmed — ${bk.with.first_name} has been told`)}>
          Yes, she can have it
        </Btn>
        <Btn variant="outline" icon="X" onClick={() => setOpen("decline")}>Not this time</Btn>
      </div>
    );
    if (bk.status === "accepted" && owner) return (
      <div>
        <Btn icon="KeyRound" full disabled={!canHandOver} onClick={() => setOpen("handover")}>I handed it over</Btn>
        {!canHandOver && <p className="mt-1.5 text-2xs" style={{ color: v("--ux-muted") }}>This opens the day before {nice(bk.start)}.</p>}
      </div>
    );
    if (bk.status === "active" && owner) return <Btn icon="Undo2" full onClick={() => setOpen("return")}>It is back with me</Btn>;
    if (bk.status === "returned" && !owner && bk.deposit_back_minor > 0) return (
      <Btn icon="HandCoins" full loading={busy === "deposit"}
           onClick={() => void step("deposit", () => apiDepositBack(bk.id), "Thank you — all done")}>
        Yes, I got {formatMoney(bk.deposit_back_minor)} back
      </Btn>
    );
    return null;
  })();

  const rail = (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          <Avatar src={bk.with.avatar || null} name={bk.with.first_name} size={48} />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>{owner ? "Renting from you" : "Owner"}</p>
            <p className="flex items-center gap-1.5 text-sm font-bold" style={{ color: v("--ux-ink") }}>
              {bk.with.first_name} <Icons.BadgeCheck className="h-4 w-4" style={{ color: v("--ux-brand") }} aria-label="Verified" />
            </p>
            <p className="text-xs" style={{ color: v("--ux-muted") }}>
              {bk.with.stars ? `★ ${bk.with.stars} · ${bk.with.reviews} ${bk.with.reviews === 1 ? "review" : "reviews"}` : "No reviews yet"}
            </p>
          </div>
        </div>
        <div className="mt-3">
          <MessageHer userId={bk.with.id} name={bk.with.first_name} about={`Rent: ${bk.item.title}`} full
                      phrases={owner
                        ? ["When will you pick it up?", "Here is where to pick it up", "Please bring it back washed", "Is it coming back today?"]
                        : ["Where do I pick it up?", "What time suits you?", "I am on my way", "I will return it today"]} />
        </div>
      </Card>
      <RentSafety />
    </div>
  );

  return (
    <HomeShell rail={rail}>
      <Back to="/app/rent/bookings" label="My rentals" className="mb-4" />

      <Card>
        <div className="flex gap-3">
          <Link href={`/app/rent/${bk.item.id}`} className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[14px]" style={{ background: v("--ux-surface-2") }}>
            {bk.item.photo
              ? <img src={bk.item.photo} alt="" className="h-full w-full object-cover" />
              : <span className="grid h-full place-items-center" style={{ color: v("--ux-faint") }}><I name="Package" className="h-7 w-7" /></span>}
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>
              {owner ? `Renting to ${bk.with.first_name}` : `Renting from ${bk.with.first_name}`}
            </p>
            <h1 className="ux-screen-title truncate text-xl font-extrabold" style={{ color: v("--ux-ink") }}>{bk.item.title}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 text-xs" style={{ color: v("--ux-ink-2") }}>
              <Icons.CalendarRange className="h-3.5 w-3.5" style={{ color: v("--ux-brand") }} /> {datesLine(bk)}
            </p>
          </div>
        </div>
        <div className="mt-5"><StepTrack b={bk} /></div>

        {(next || action) && (
          <div className="mt-5 rounded-[16px] border-2 p-3.5"
               style={{ background: v("--ux-brand-tint"), borderColor: next?.urgent ? v("--ux-brand") : "transparent", color: v("--ux-ink") }}>
            {next && (
              <p className="flex items-center gap-2.5 text-sm font-bold">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white" style={{ background: "var(--ux-pic-ground)" }}>
                  <I name={next.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">{next.text}</span>
                {next.urgent && (
                  <span className="shrink-0 rounded-full px-2 py-0.5 text-2xs font-extrabold" style={{ background: v("--ux-fill"), color: v("--ux-on-brand") }}>Your turn</span>
                )}
              </p>
            )}
            {bk.note && bk.status === "requested" && (
              <p className="mt-2 text-xs" style={{ color: v("--ux-ink-2") }}>{owner ? "Her note" : "Your note"}: “{bk.note}”</p>
            )}
            {action && <div className="mt-3">{action}</div>}
          </div>
        )}
      </Card>

      <div className="mt-4 space-y-4">
        <MoneyBox b={bk} />

        {canReview && (
          <ReviewCard b={bk} busy={busy === "review"}
                      onSend={(r) => void step("review", () => apiRentalReview(bk.id, r), "Thank you — that helps other women")} />
        )}
        {bk.i_reviewed && (
          <p className="flex items-center gap-2 rounded-[14px] p-3 text-xs font-semibold" style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
            <Icons.Star className="h-4 w-4" /> You said how it went{bk.they_reviewed ? `, and so did ${bk.with.first_name}` : ""}.
          </p>
        )}

        <PhotosCompare b={bk} />

        {bk.problem && (
          <Card>
            <p className="flex items-center gap-2 text-sm font-bold" style={{ color: v("--ux-ink") }}>
              <Icons.Flag className="h-4 w-4" style={{ color: v("--ux-danger-ink") }} /> A problem was raised
            </p>
            <p className="mt-1.5 text-sm" style={{ color: v("--ux-ink-2") }}>
              <b style={{ color: v("--ux-ink") }}>{bk.problem.startsWith(`${bk.side}:`) ? "You" : bk.with.first_name}:</b>{" "}
              {bk.problem.replace(/^(renter|owner):\s*/, "")}
            </p>
            <p className="mt-2 rounded-[12px] p-3 text-xs" style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
              {bk.problem_settled ? <><b>WomSakhi:</b> {bk.problem_settled}</> : "WomSakhi is looking into it. Both of you will be told."}
            </p>
          </Card>
        )}

        <History b={bk} />

        <div className="flex flex-wrap gap-2">
          {/* The owner answers a request with "Not this time"; once it is confirmed either of them can call it off. */}
          {((bk.status === "requested" && !owner) || bk.status === "accepted") && (
            <Btn variant="ghost" icon="X" onClick={() => setOpen("cancel")}>{owner ? "Call it off" : "Cancel"}</Btn>
          )}
          {canRaise && <Btn variant="ghost" icon="Flag" onClick={() => setOpen("problem")}>Something is not right</Btn>}
        </div>
      </div>

      <ReasonSheet open={open === "decline"} onClose={() => setOpen("")} title={`Say no to ${bk.with.first_name}?`} icon="X"
                   reasons={DECLINE_REASONS} cta="Say no" busy={busy === "decline"}
                   onSend={(why) => void step("decline", () => apiDeclineBooking(bk.id, why), "Declined — she has been told")} />
      <ReasonSheet open={open === "cancel"} onClose={() => setOpen("")} title="Call off this rental?" icon="X"
                   reasons={owner ? DECLINE_REASONS : CANCEL_REASONS} cta="Call it off" busy={busy === "cancel"}
                   onSend={(why) => void step("cancel", () => apiCancelBooking(bk.id, why), "Called off — she has been told")} />
      <ReasonSheet open={open === "problem"} onClose={() => setOpen("")} title="Tell WomSakhi" icon="Flag" min={5}
                   description="Someone from WomSakhi reads every one, looks at the photos and history, and tells you both."
                   reasons={PROBLEM_LINES} cta="Send to WomSakhi" busy={busy === "problem"}
                   onSend={(text) => void step("problem", () => apiRentalProblem(bk.id, text), "Sent — WomSakhi will look into it")} />
      {open === "handover" && (
        <HandoverSheet b={bk} busy={busy === "handover"} onClose={() => setOpen("")}
                       onSend={(body) => void step("handover", () => apiHandover(bk.id, body), "Handed over — the return day is in her reminders")} />
      )}
      {open === "return" && (
        <ReturnSheet b={bk} busy={busy === "return"} onClose={() => setOpen("")}
                     onSend={(body) => void step("return", () => apiReturned(bk.id, body), "Marked as returned")} />
      )}
    </HomeShell>
  );
}

/* ── the sheets ─────────────────────────────────────────────────────── */

function ReasonSheet({ open, onClose, title, description, icon, reasons, cta, busy, onSend, min = 0 }: {
  open: boolean; onClose: () => void; title: string; description?: string; icon: string;
  reasons: string[]; cta: string; busy: boolean; onSend: (text: string) => void; min?: number;
}) {
  const [text, setText] = useState("");
  return (
    <Sheet open={open} onClose={onClose} title={title} description={description} icon={icon}
           footer={<div className="flex gap-2 [&>*]:flex-1">
             <Btn variant="outline" onClick={onClose}>Back</Btn>
             <Btn icon="Send" loading={busy} disabled={text.trim().length < min} onClick={() => onSend(text.trim())}>{cta}</Btn>
           </div>}>
      <Label>Why?{min ? "" : " (optional)"}</Label>
      <Picks options={reasons} value={text} label="Reasons to tap" onPick={(r) => setText(text === r ? "" : r)} />
      <div className="mt-3"><Area value={text} onChange={setText} max={min ? 600 : 300} rows={3} label="In your words" placeholder="Or say it in your words" /></div>
    </Sheet>
  );
}

function HandoverSheet({ b, busy, onClose, onSend }: {
  b: Booking; busy: boolean; onClose: () => void;
  onSend: (body: { rent_paid: boolean; deposit_paid: boolean; condition: Condition; photos: string[]; note?: string }) => void;
}) {
  const [rent, setRent] = useState(true);
  const [deposit, setDeposit] = useState(b.deposit_minor > 0);
  const [condition, setCondition] = useState<Condition>("good");
  const [photos, setPhotos] = useState<string[]>([]);
  const early = daysUntil(b.start) > 0;
  return (
    <Sheet open onClose={onClose} title="Handed over" icon="KeyRound"
           description={`What ${b.with.first_name} paid you, and how it looked when it left.`}
           footer={<div className="flex gap-2 [&>*]:flex-1">
             <Btn variant="outline" onClick={onClose}>Back</Btn>
             <Btn icon="Check" loading={busy} onClick={() => onSend({ rent_paid: rent, deposit_paid: deposit, condition, photos })}>Done</Btn>
           </div>}>
      <div className="space-y-4">
        {early && (
          <p className="rounded-[12px] p-3 text-xs" style={{ background: v("--ux-brand-tint"), color: v("--ux-ink") }}>
            A day early is fine — the return day stays {nice(b.end)}.
          </p>
        )}
        <Toggle on={rent} onChange={setRent} label={`I got the rent — ${formatMoney(b.rent_minor)}`} sub="In cash or by UPI, in your hands." />
        {b.deposit_minor > 0 && (
          <Toggle on={deposit} onChange={setDeposit} label={`I got the deposit — ${formatMoney(b.deposit_minor)}`} sub="You give it back when it returns." />
        )}
        <div>
          <Label>How was it when it left?</Label>
          <Picks options={Object.values(CONDITION_LOOK)} value={CONDITION_LOOK[condition]} label="Condition"
                 onPick={(x) => setCondition((Object.keys(CONDITION_LOOK) as Condition[]).find((k) => CONDITION_LOOK[k] === x) ?? "good")} />
        </div>
        <div>
          <Label hint="both of you can see them">Photos as it leaves</Label>
          <PhotoPicker value={photos} onChange={setPhotos} max={4} label="Take a photo"
                       hint="These settle any question about its condition later." />
        </div>
      </div>
    </Sheet>
  );
}

function ReturnSheet({ b, busy, onClose, onSend }: {
  b: Booking; busy: boolean; onClose: () => void;
  onSend: (body: { condition: "fine" | "damaged" | "lost"; deduction_rupees: number; note?: string; photos: string[]; rent_paid?: boolean }) => void;
}) {
  const [condition, setCondition] = useState<"fine" | "damaged" | "lost">("fine");
  const [keep, setKeep] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [rent, setRent] = useState(true);
  const deposit = Math.floor(b.deposit_minor / 100);
  const kept = condition === "fine" ? 0 : Math.min(deposit, Math.max(0, Math.floor(Number(keep) || 0)));
  const needNote = kept > 0 && note.trim().length < 3;
  const LOOK = { fine: ["Fine", "ThumbsUp"], damaged: ["Damaged", "AlertTriangle"], lost: ["Lost", "PackageX"] } as const;
  return (
    <Sheet open onClose={onClose} title="It is back" icon="Undo2"
           description="How it came back, and what goes back to her."
           footer={<div className="flex gap-2 [&>*]:flex-1">
             <Btn variant="outline" onClick={onClose}>Back</Btn>
             <Btn icon="Check" loading={busy} disabled={needNote}
                  onClick={() => onSend({ condition, deduction_rupees: kept, note: note.trim(), photos, rent_paid: b.rent_paid || rent })}>Done</Btn>
           </div>}>
      <div className="space-y-4">
        <div>
          <Label>How did it come back?</Label>
          <div role="radiogroup" aria-label="Condition" className="grid grid-cols-3 gap-2">
            {(Object.keys(LOOK) as (keyof typeof LOOK)[]).map((c) => {
              const on = condition === c;
              return (
                <button key={c} type="button" role="radio" aria-checked={on} onClick={() => setCondition(c)}
                        className="ux-press flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-[14px] border text-xs font-semibold"
                        style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"), color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                  <I name={LOOK[c][1]} className="h-6 w-6" /> {LOOK[c][0]}
                </button>
              );
            })}
          </div>
        </div>
        {!b.rent_paid && <Toggle on={rent} onChange={setRent} label={`I got the rent — ${formatMoney(b.rent_minor)}`} sub="Not marked at handover." />}
        {deposit > 0 && condition !== "fine" && (
          <div>
            <Label hint={`up to ₹${deposit.toLocaleString("en-IN")}`}>Keep from the deposit</Label>
            <Picks options={[...new Set([Math.round(deposit / 4), Math.round(deposit / 2), deposit])].filter((n) => n > 0).map((n) => `₹${n.toLocaleString("en-IN")}`)}
                   value={kept ? `₹${kept.toLocaleString("en-IN")}` : ""} label="Amounts to keep"
                   onPick={(x) => setKeep(x.replace(/[^\d]/g, ""))} />
            <input value={keep} onChange={(e) => setKeep(e.target.value.replace(/[^\d]/g, ""))} inputMode="numeric" aria-label="Amount to keep in rupees"
                   placeholder="Other amount" className="ux-sq mt-2 min-h-[46px] w-full max-w-[220px] rounded-[12px] border px-3 text-sm outline-none"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
          </div>
        )}
        {condition !== "fine" && (
          <div>
            <Label need={kept > 0}>What was wrong?</Label>
            <Picks options={DAMAGE_NOTES} value={note} label="Problems to tap" onPick={(x) => setNote(note === x ? "" : x)} />
            <div className="mt-2"><Area value={note} onChange={setNote} max={300} rows={2} label="What was wrong" placeholder="So she understands what you kept" /></div>
          </div>
        )}
        <div>
          <Label hint="both of you can see them">Photos as it came back</Label>
          <PhotoPicker value={photos} onChange={setPhotos} max={4} label="Take a photo" />
        </div>
        {deposit > 0 && (
          <p className="flex items-center justify-between rounded-[12px] p-3 text-sm font-bold" style={{ background: v("--ux-tint-green"), color: v("--ux-green-ink") }}>
            <span>Give back to {b.with.first_name}</span>
            <span className="tabular-nums">{formatMoney((deposit - kept) * 100)}</span>
          </p>
        )}
      </div>
    </Sheet>
  );
}
