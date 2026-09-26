"use client";

import { use, useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, EmptyState, I, IconTile, ScreenSkeleton, SectionHead, v } from "@/components/ux/kit";
import { apiErrorMessage } from "@/lib/api";
import { apiCatalogService, apiCreateBooking, type Booking, type CatalogService } from "@/lib/member-api";
import { useResource } from "@/lib/use-resource";

const TIMES = ["09:00", "11:00", "14:00", "16:00", "18:00"];
const MODES = ["Online", "In person"] as const;

/** A real catalogue service, with a complete member booking path. */
export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: service, source } = useResource(
    useCallback(async () => apiCatalogService(id), [id]),
    null as CatalogService | null,
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mode, setMode] = useState<(typeof MODES)[number]>("Online");
  const [booking, setBooking] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!service && source === "loading") {
    return <HomeShell><ScreenSkeleton shape="detail" /></HomeShell>;
  }

  if (!service) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title="That service is not available"
            body="It may have been paused. Browse the current services and choose another."
            action={<Btn href="/app/explore" iconEnd="ArrowRight">Browse services</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  async function book() {
    const current = service;
    if (!current || !date || !time || busy) return;
    setBusy(true);
    setError("");
    try {
      setBooking(await apiCreateBooking({
        service_id: current.id,
        date,
        time,
        mode,
        note: "Booked from the service catalogue",
      }));
    } catch (cause) {
      setError(apiErrorMessage(cause, "That booking did not go through. Nothing was reserved — try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <HomeShell
      rail={
        <Card>
          <SectionHead title="What happens next" icon="CalendarCheck" />
          <ol className="space-y-3 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
            {["Choose a day and time.", "We confirm who will meet you.", "Your booking and updates stay in your calendar."].map((line, index) => (
              <li key={line} className="flex gap-2.5">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-2xs font-bold"
                      style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>{index + 1}</span>
                {line}
              </li>
            ))}
          </ol>
        </Card>
      }
    >
      <Back to="/app/explore" label="Back to everything there is" className="mb-4" />

      <Card className="mb-4">
        <div className="flex items-start gap-4">
          <IconTile icon={service.icon || "Sparkles"} tint="--ux-brand-tint" ink="--ux-brand" size={58} radius={16} />
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-bold uppercase tracking-[0.12em]" style={{ color: v("--ux-brand") }}>{service.type}</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight" style={{ color: v("--ux-ink") }}>{service.name}</h1>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>{service.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>
              <span className="rounded-full px-3 py-1.5" style={{ background: v("--ux-surface-2") }}>{service.duration}</span>
              <span className="rounded-full px-3 py-1.5" style={{ background: v("--ux-tint-green") }}>{service.price}</span>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {booking ? (
          <div className="py-3 text-center" role="status">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: v("--ux-tint-green") }}>
              <I name="Check" className="h-7 w-7" style={{ color: v("--ux-green-ink") }} />
            </span>
            <h2 className="mt-4 text-lg font-bold" style={{ color: v("--ux-ink") }}>Your time is booked</h2>
            <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>{service.name} · {date} at {time} · {mode}</p>
            <div className="mt-4 flex justify-center gap-2">
              <Btn href={`/app/bookings/${booking.id}`} iconEnd="ArrowRight">See booking</Btn>
              <Btn href="/app/schedule" variant="outline">Open calendar</Btn>
            </div>
          </div>
        ) : (
          <>
            <SectionHead title="Choose a time" sub="Three quick choices, then it is in your calendar." icon="CalendarDays" />
            <label className="block text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>
              Day
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)}
                     className="ux-sq mt-1.5 h-11 w-full rounded-xl border px-3 text-sm"
                     style={{ borderColor: v("--ux-line-strong"), background: v("--ux-surface"), color: v("--ux-ink") }} />
            </label>
            <fieldset className="mt-4">
              <legend className="text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>Time</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TIMES.map((option) => (
                  <button key={option} type="button" aria-pressed={time === option} onClick={() => setTime(option)}
                          className="ux-press min-h-10 rounded-xl border px-4 text-xsm font-semibold"
                          style={{ borderColor: time === option ? v("--ux-brand") : v("--ux-line-strong"), background: time === option ? v("--ux-brand-tint") : v("--ux-surface"), color: time === option ? v("--ux-brand") : v("--ux-ink") }}>
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>How</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {MODES.map((option) => (
                  <button key={option} type="button" aria-pressed={mode === option} onClick={() => setMode(option)}
                          className="ux-press min-h-11 rounded-xl border px-3 text-xsm font-semibold"
                          style={{ borderColor: mode === option ? v("--ux-brand") : v("--ux-line-strong"), background: mode === option ? v("--ux-brand-tint") : v("--ux-surface"), color: mode === option ? v("--ux-brand") : v("--ux-ink") }}>
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>
            {error && <p role="alert" className="mt-3 text-xsm" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
            <div className="mt-5">
              <Btn full disabled={!date || !time || busy} loading={busy} onClick={() => void book()}>
                {busy ? "Booking…" : "Book this service"}
              </Btn>
            </div>
          </>
        )}
      </Card>
    </HomeShell>
  );
}
