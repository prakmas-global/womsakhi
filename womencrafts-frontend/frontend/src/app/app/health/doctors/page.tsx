"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

import { Btn } from "@/components/ux/kit";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { toast } from "@/components/ux/mobile/Toast";
import {
  Chips, Cols, Disclaimer, Empty, HealthFrame, HUE, I, Metric, MetricGrid, Panel, useEntries,
} from "@/components/ux/health/kit";
import { apiErrorMessage } from "@/lib/api";
import {
  SPECIALITIES, apiBookDoctor, apiCancelConsultation, apiConsultationNotes, apiDoctor, apiDoctorSlots, apiDoctors,
  apiMyConsultations, apiRescheduleConsultation, apiShareConsultation,
  feeLabel, timeLabel, whenLabel, type Consultation, type Doctor, type Mode, type SharedItem,
} from "@/lib/doctors-api";
import type { Entry } from "@/lib/health-api";
import { unitOf } from "@/components/ux/health/records-data";
import { DocumentSheet } from "@/app/app/health/records/record-parts";
import { useResource } from "@/lib/use-resource";
import { WatchListen } from "@/components/ux/health/WatchListen";
import { PicChoice, Review, StepSheet, type FlowStep } from "@/components/ux/health/StepFlow";

/**
 * Doctor Consultation — book a doctor our team has added and checked.
 *
 * Doctors come from `doctors` (staff add them in the admin dashboard; see
 * routes/doctors.py). A booking is a request for a real free slot; staff
 * confirm it with how to join and, afterwards, add the prescription, which
 * she can keep in Health Records. WomSakhi takes no money: the fee is paid to
 * the doctor or clinic.
 *
 * Until our team has added doctors, the page says so and points to the free
 * government options that exist today.
 */

const TABS = [
  { id: "find", label: "Find a doctor" },
  { id: "consultations", label: "My consultations" },
  { id: "prescriptions", label: "Prescriptions" },
  { id: "watch", label: "Watch & listen" },
];

const REASONS = [
  "Irregular or painful periods", "Pregnancy check-up", "PCOS / weight concerns", "Tiredness or weakness",
  "Skin or hair problem", "Child's health", "Feeling low or anxious", "Diet advice",
];
const SYMPTOMS = ["Pain", "Fever", "Bleeding", "Cramps", "Headache", "Nausea", "Fatigue", "Itching", "Sleeplessness"];

/** A picture for each reason, so the common ones are tiles to tap. */
const REASON_ART: Record<string, string> = {
  "Irregular or painful periods": "Cramps", "Pregnancy check-up": "Prenatal checkup", "PCOS / weight concerns": "Weight",
  "Tiredness or weakness": "Tiredness", "Skin or hair problem": "Dermatologist", "Child's health": "Pediatrician",
  "Feeling low or anxious": "Mental health professional", "Diet advice": "Nutrition specialist",
};

const MODE_ICON: Record<Mode, string> = { Video: "Video", Phone: "Phone", Clinic: "MapPin" };
const MODE_ART: Record<Mode, string> = { Video: "Video", Phone: "Audio", Clinic: "In person" };
const MODE_LABEL: Record<Mode, string> = { Video: "Video call", Phone: "Phone call", Clinic: "At the clinic" };

const STATUS: Record<Consultation["status"], { label: string; tint: string; ink: string }> = {
  requested: { label: "Requested — waiting to confirm", tint: "var(--ux-tint-amber)", ink: "var(--ux-amber-ink)" },
  confirmed: { label: "Confirmed", tint: "var(--ux-tint-green)", ink: "var(--ux-green-ink)" },
  completed: { label: "Completed", tint: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)" },
  cancelled: { label: "Cancelled", tint: "var(--ux-surface-2)", ink: "var(--ux-muted)" },
};

export default function DoctorConsultation() {
  const consults = useResource(useCallback((s: AbortSignal) => apiMyConsultations(s), []), [] as Consultation[]);
  const [booking, setBooking] = useState<{ doctor: Doctor; reason?: string } | null>(null);
  // "Book follow-up" on a past visit: same doctor, reason filled in.
  const followUp = async (c: Consultation) => {
    try {
      const doctor = await apiDoctor(c.doctor_id);
      setBooking({ doctor, reason: `Follow-up${c.reason ? `: ${c.reason}` : ""}`.slice(0, 300) });
    } catch {
      toast(`${c.doctor_name} is not taking bookings right now. Find another doctor.`, { tone: "error" });
    }
  };

  return (
    <HealthFrame active="/app/health/doctors" hue="green" icon="Stethoscope" eyebrow="Doctor Consultation"
                 title="Doctor Consultation" art="/ux/health/ill/hero-records.webp"
                 sub="Book a video, phone or clinic consultation with a doctor our team has checked. You share only what you choose."
                 tabs={TABS}
                 actions={<>
                   <Btn href="/app/health/doctors" icon="CalendarClock">Book consultation</Btn>
                   <Btn href="/app/health/doctors?tab=consultations" variant="outline">My consultations</Btn>
                 </>}>
      {(tab) => (
        <>
          {tab === "find" && <Find onBook={(doctor) => setBooking({ doctor })} consults={consults.data} />}
          {tab === "consultations" && <Mine rows={consults.data} loading={consults.source === "loading"} reload={consults.refetch} onFollowUp={followUp} />}
          {tab === "prescriptions" && <Prescriptions rows={consults.data} onFollowUp={followUp} />}
          {tab === "watch" && <WatchListen section="doctor" hue="green" sub="Doctors explain common questions in plain words." />}
          <BookSheet booking={booking} onClose={() => setBooking(null)} onBooked={() => { setBooking(null); consults.refetch(); }} />
        </>
      )}
    </HealthFrame>
  );
}

/* ── when there are no doctors yet, and always in the side column ──────── */

function FreeHelp() {
  return (
    <Panel title="Free government help" sub="Available to everyone in India, today.">
      <ul className="flex flex-col gap-3 text-sm">
        <li className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE.green.tint, color: HUE.green.ink }}><I name="Video" className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0">
            <b style={{ color: "var(--ux-ink)" }}>eSanjeevani</b> — free video consultation with a government doctor.{" "}
            <a href="https://esanjeevani.mohfw.gov.in" target="_blank" rel="noreferrer" className="font-bold underline" style={{ color: "var(--ux-green-ink)" }}>Open eSanjeevani</a>
          </span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: HUE.blue.tint, color: HUE.blue.ink }}><I name="Phone" className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0"><b style={{ color: "var(--ux-ink)" }}>104</b> — health helpline for advice and the nearest centre. <a href="tel:104" className="font-bold underline" style={{ color: "var(--ux-blue-ink)" }}>Call 104</a></span>
        </li>
        <li className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--ux-danger-tint)", color: "var(--ux-danger-ink)" }}><I name="Siren" className="h-[18px] w-[18px]" /></span>
          <span className="min-w-0"><b style={{ color: "var(--ux-ink)" }}>108</b> — emergency ambulance. <a href="tel:108" className="font-bold underline" style={{ color: "var(--ux-danger-ink)" }}>Call 108</a></span>
        </li>
      </ul>
    </Panel>
  );
}

/* ── Find a doctor ───────────────────────────────────────────────────── */

/** No stock picture stands in for a doctor: her photo, or her initials. */
function initialsArt(d: Doctor) {
  const letters = d.name.replace(/^(dr|ms|mrs|mr)\.?\s+/i, "").split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f4ec"/><stop offset="1" stop-color="#efecff"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="200" cy="150" r="78" fill="#ffffff"/><text x="200" y="174" text-anchor="middle" font-family="system-ui,sans-serif" font-size="64" font-weight="800" fill="#007d38">${letters}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function DoctorCard({ d, onBook }: { d: Doctor; onBook: (d: Doctor) => void }) {
  return (
    <MediaCard ratio="4/3" onClick={() => onBook(d)}
      image={d.photo || initialsArt(d)} alt={d.name}
      topLeft={{ text: d.speciality }}
      topRight={{ text: feeLabel(d.fee_minor), tone: d.fee_minor ? "dark" : "green" }}
      title={<span className="inline-flex items-center gap-1.5">{d.name}{d.verified && <I name="BadgeCheck" className="h-4 w-4" style={{ color: "var(--ux-blue)" }} />}</span>}
      subtitle={[d.qualifications, d.experience_years ? `${d.experience_years} yrs` : ""].filter(Boolean).join(" · ")}
      avatar={null}
      meta={<>
        {d.languages.length > 0 && <Fact icon="Languages">{d.languages.slice(0, 2).join(", ")}</Fact>}
        <Fact icon={MODE_ICON[d.modes[0]] ?? "Video"}>{d.modes.join(" · ")}</Fact>
        {d.city && <Fact icon="MapPin">{d.city}</Fact>}
      </>}
      footer={<Btn full size="sm" icon="CalendarClock" onClick={() => onBook(d)}>{d.next_slot ? `Book · next ${whenLabel(d.next_slot, { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "Book"}</Btn>}>
      {d.bio && <p className="line-clamp-2 text-[13px] leading-snug" style={{ color: "var(--ux-muted)" }}>{d.bio}</p>}
    </MediaCard>
  );
}

function Find({ onBook, consults }: { onBook: (d: Doctor) => void; consults: Consultation[] }) {
  // Fertility, Pregnancy, Mental Wellness and Nutrition link here with ?speciality= already chosen.
  const asked = useSearchParams().get("speciality") ?? "";
  const [spec, setSpec] = useState((SPECIALITIES as readonly string[]).includes(asked) ? asked : "");
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");
  const all = useResource(useCallback((s: AbortSignal) => apiDoctors({}, s), []), [] as Doctor[]);
  const loading = all.source === "loading";
  // The chosen kind stays on the list even before any doctor of that kind is added.
  const specs = SPECIALITIES.filter((s) => s === spec || all.data.some((d) => d.speciality === s));
  const shown = all.data.filter((d) => (!spec || d.speciality === spec) && (!mode || d.modes.includes(mode as Mode)) &&
    (!q.trim() || [d.name, d.speciality, d.bio, d.clinic, d.city, d.qualifications].join(" ").toLowerCase().includes(q.trim().toLowerCase())));
  const next = consults.filter((c) => c.status === "requested" || c.status === "confirmed").sort((a, b) => a.start.localeCompare(b.start))[0];

  return (
    <Cols
      main={
        !loading && all.data.length === 0 ? (
          <Panel title="Doctors are being added">
            <Empty icon="Stethoscope" title="No doctors on WomSakhi yet"
                   body="Our team is checking doctors' registrations before they appear here. Until then, the free government services on this page can help you today." />
          </Panel>
        ) : (
          <>
            <Panel title="1. What kind of doctor?">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }}>
                {["", ...specs].map((s) => {
                  const on = spec === s;
                  return (
                    <button key={s || "all"} type="button" aria-pressed={on} onClick={() => setSpec(s)}
                            className="ux-press flex min-h-[86px] flex-col items-start justify-between gap-2 rounded-[14px] border-[1.5px] p-3 text-start text-[13px] font-bold"
                            style={on ? { borderColor: HUE.green.ink, background: HUE.green.tint, color: "var(--ux-ink)" }
                                      : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}>
                      <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
                        <I name={s === "Paediatrician" ? "Baby" : s === "Counsellor" ? "Brain" : s === "Nutritionist" ? "Apple" : s === "Gynaecologist" ? "Flower2" : s === "Fertility specialist" ? "Sprout" : s === "Endocrinologist" ? "Activity" : "Stethoscope"} className="h-[18px] w-[18px]" />
                      </span>
                      {s || "All doctors"}
                    </button>
                  );
                })}
              </div>
            </Panel>
            <Panel title={`2. Choose a doctor${spec ? ` · ${spec}` : ""}`} sub={loading ? "Loading doctors…" : `${shown.length} ${shown.length === 1 ? "doctor" : "doctors"}`}>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-[44px] min-w-0 flex-1 basis-[240px] items-center gap-2 rounded-[12px] border px-3.5"
                       style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)" }}>
                  <I name="Search" className="h-4 w-4" style={{ color: "var(--ux-muted)" }} />
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, concern or city" aria-label="Search doctors"
                         className="w-full bg-transparent text-sm outline-none" style={{ color: "var(--ux-ink)" }} />
                </label>
                <Chips label="Consultation type" hue="green" options={["Any", "Video", "Phone", "Clinic"]} value={mode || "Any"} onChange={(v) => setMode(v === "Any" ? "" : v)} />
              </div>
              {loading ? (
                <MediaGrid>{[0, 1, 2].map((i) => <div key={i} className="h-[320px] animate-pulse rounded-[16px]" style={{ background: "var(--ux-surface-2)" }} />)}</MediaGrid>
              ) : shown.length ? (
                <MediaGrid>{shown.map((d) => <DoctorCard key={d.id} d={d} onBook={onBook} />)}</MediaGrid>
              ) : (
                <Empty icon="SearchX" title="No doctors match" body="Try another kind of doctor or consultation type."
                       action={<Btn size="sm" variant="outline" onClick={() => { setSpec(""); setMode(""); setQ(""); }}>Show all doctors</Btn>} />
              )}
            </Panel>
          </>
        )
      }
      side={<>
        {next && (
          <Panel title="Your next consultation" hue="green" tint>
            <ConsultLine c={next} />
            <Btn size="sm" variant="outline" href="/app/health/doctors?tab=consultations">See details</Btn>
          </Panel>
        )}
        <FreeHelp />
        <Disclaimer>
          WomSakhi does not take any money. The fee shown is paid to the doctor or clinic. In an emergency, call 108 or go to the nearest hospital.
        </Disclaimer>
      </>}
    />
  );
}

/* ── Booking: mode → day → time → reason → confirm ─────────────────────── */

function nextDays(n: number) {
  const out: { day: string; dow: string; date: number; month: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    out.push({
      day: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      dow: d.toLocaleDateString("en-US", { weekday: "short" }), date: d.getDate(),
      month: d.toLocaleDateString("en-IN", { month: "short" }),
    });
  }
  return out;
}

const pill = (on: boolean) => on
  ? { borderColor: HUE.green.ink, background: HUE.green.tint, color: "var(--ux-ink)", boxShadow: `0 10px 22px -14px ${HUE.green.ink}` }
  : { borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" };

/** Day tiles, shared by booking and rescheduling. */
function DayTiles({ days, value, onPick }: { days: { day: string; dow: string; date: number; month: string }[]; value: string; onPick: (d: string) => void }) {
  return (
    <div role="group" aria-label="Day" className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))" }}>
      {days.map((x) => (
        <button key={x.day} type="button" aria-pressed={value === x.day} onClick={() => onPick(x.day)}
                aria-label={new Date(`${x.day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                className="ux-press flex flex-col items-center rounded-[14px] border-[1.5px] px-2 py-2 text-xs font-bold transition-[transform,border-color,background] duration-200 hover:-translate-y-0.5"
                style={pill(value === x.day)}>
          {x.dow}<b className="text-lg leading-tight">{x.date}</b>{x.month}
        </button>
      ))}
    </div>
  );
}

/** A doctor's free times on the day, as tiles; "loading" while they are fetched. */
function SlotTiles({ slots, value, onPick, empty }: { slots: string[] | null; value: string; onPick: (s: string) => void; empty: React.ReactNode }) {
  if (slots === null) return <p className="text-sm" style={{ color: "var(--ux-muted)" }} aria-live="polite">Finding free times…</p>;
  if (!slots.length) return <>{empty}</>;
  return (
    <div role="group" aria-label="Time" className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
      {slots.map((s) => (
        <button key={s} type="button" aria-pressed={value === s} onClick={() => onPick(s)}
                className="ux-press min-h-[48px] rounded-[12px] border-[1.5px] text-sm font-bold tabular-nums transition-[transform,border-color,background] duration-200 hover:-translate-y-0.5"
                style={pill(value === s)}>
          {timeLabel(s)}
        </button>
      ))}
    </div>
  );
}

const dayLong = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" });

/**
 * A doctor's free times on a day, keyed by the day (and a reload count) they
 * were fetched for; a key that does not match yet reads as "loading" (null).
 */
function useSlots(doctorId: string, day: string) {
  const [got, setGot] = useState<{ key: string; slots: string[] }>({ key: "", slots: [] });
  const [reload, setReload] = useState(0);
  const key = `${day}|${reload}`;
  useEffect(() => {
    if (!day) return;
    const ctl = new AbortController();
    apiDoctorSlots(doctorId, day, ctl.signal)
      .then((r) => setGot({ key, slots: r.slots }))
      .catch(() => { if (!ctl.signal.aborted) setGot({ key, slots: [] }); });
    return () => ctl.abort();
  }, [doctorId, day, key]);
  return { slots: got.key === key ? got.slots : null, refresh: () => setReload((n) => n + 1) };
}

/* What she can show a doctor: her Health Records, as copies she ticks one by one. */
type Shareable = SharedItem & { key: string; group: string };
const SHARE_KINDS = ["medication", "allergy", "measure", "document", "history"] as const;
const SHARE_GROUPS = ["Medicines I take", "Allergies", "Latest readings", "Medical history", "Reports and papers"];

function shareables(rows: Entry[]): Shareable[] {
  const out: Shareable[] = [];
  const latest = new Map<string, Entry<"measure">>();
  for (const r of rows) {
    if (r.kind === "measure") {
      const m = r as Entry<"measure">;
      const cur = latest.get(m.data.type);
      if (!cur || m.date > cur.date) latest.set(m.data.type, m);
    } else if (r.kind === "medication") {
      const d = (r as Entry<"medication">).data;
      if (d.status !== "Stopped") out.push({ key: r.id, group: SHARE_GROUPS[0], kind: "medication", label: d.name, detail: [d.dose, d.schedule].filter(Boolean).join(" · ") });
    } else if (r.kind === "allergy") {
      const d = (r as Entry<"allergy">).data;
      out.push({ key: r.id, group: SHARE_GROUPS[1], kind: "allergy", label: d.name, detail: [d.severity, d.reaction].filter(Boolean).join(" · ") });
    } else if (r.kind === "history") {
      const d = (r as Entry<"history">).data;
      out.push({ key: r.id, group: SHARE_GROUPS[3], kind: "history", label: d.condition, detail: [d.cat, d.since].filter(Boolean).join(" · ") });
    } else if (r.kind === "document") {
      const d = (r as Entry<"document">).data;
      if (d.shareable !== false) out.push({ key: r.id, group: SHARE_GROUPS[4], kind: "document", label: d.title, detail: [d.type, d.provider, r.date].filter(Boolean).join(" · ") });
    }
  }
  for (const m of latest.values()) {
    const unit = unitOf(m.data.type);
    out.push({ key: m.id, group: SHARE_GROUPS[2], kind: "reading", label: `${m.data.type}: ${m.data.value}${unit ? ` ${unit}` : ""}`, detail: m.date });
  }
  return out.map((x) => ({ ...x, label: x.label.slice(0, 120), detail: x.detail.slice(0, 200) }));
}

function BookSheet({ booking, onClose, onBooked }: { booking: { doctor: Doctor; reason?: string } | null; onClose: () => void; onBooked: () => void }) {
  return booking ? <BookFlow key={booking.doctor.id} doctor={booking.doctor} initialReason={booking.reason} onClose={onClose} onBooked={onBooked} /> : null;
}

function BookFlow({ doctor: d, initialReason = "", onClose, onBooked }: { doctor: Doctor; initialReason?: string; onClose: () => void; onBooked: () => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>(d.modes[0]);
  const days = useMemo(() => nextDays(14).filter((x) => d.days.includes(x.dow)), [d.days]);
  const [day, setDay] = useState(() => (d.next_slot ? d.next_slot.slice(0, 10) : days[0]?.day ?? ""));
  const { slots, refresh } = useSlots(d.id, day);
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState(initialReason);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const records = useEntries([...SHARE_KINDS]);
  const items = useMemo(() => shareables(records.rows as Entry[]), [records.rows]);
  const [picked, setPicked] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const chosen = items.filter((x) => picked.includes(x.key));
  const pickDay = (x: string) => { setDay(x); setSlot(""); };
  const reasonShort = reason.trim().length > 0 && reason.trim().length < 2;
  const fee = `${feeLabel(d.fee_minor)}${d.fee_minor ? ", paid to the doctor or clinic" : ""}`;

  const book = async () => {
    setBusy(true);
    try {
      await apiBookDoctor(d.id, {
        start: slot, mode, reason: reason.trim(), symptoms,
        shared: chosen.map(({ kind, label, detail }) => ({ kind, label, detail })), share_consent: consent,
      });
      toast("Request sent — we will confirm it and tell you how to join", { tone: "success" });
      onBooked();
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
      // Someone took the slot meanwhile: back to the times, freshly loaded.
      if (apiErrorMessage(e).toLowerCase().includes("time")) { setStep(2); setSlot(""); refresh(); }
    } finally { setBusy(false); }
  };

  const steps: FlowStep[] = [
    { id: "how", title: "How would you like to consult?", hint: `${d.speciality} · ${fee}`, valid: !!mode,
      body: <PicChoice label="Consultation type" hue="green" value={mode} onChange={(v) => setMode(v as Mode)} onPicked={() => setStep(1)}
                       options={d.modes.map((m) => ({ value: m, label: MODE_LABEL[m], art: MODE_ART[m],
                                                      sub: m === "Clinic" && d.clinic ? `${d.clinic}${d.city ? `, ${d.city}` : ""}` : "" }))} /> },
    { id: "day", title: "Which day suits you?", valid: !!day,
      body: days.length
        ? <DayTiles days={days} value={day} onPick={pickDay} />
        : <Empty icon="CalendarX" title="No days open" body="This doctor has no hours in the next two weeks. Try another doctor." /> },
    { id: "time", title: "Pick a time", hint: day ? dayLong(day) : undefined, valid: !!slot,
      body: <SlotTiles slots={slots} value={slot} onPick={setSlot}
                       empty={<Empty icon="CalendarX" title="Fully booked" body="No free times on this day. Go back and pick another day." />} /> },
    { id: "reason", title: "What is it about?", hint: "Tap the closest one, or write it in your own words.", valid: reason.trim().length >= 2,
      body: <>
        <PicChoice label="Reason" hue="green" columns={4} value={reason} onChange={setReason}
                   options={REASONS.map((r) => ({ value: r, label: r, art: REASON_ART[r] ?? "Doctor consultation" }))} />
        <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={3} aria-label="Reason in your words"
                  aria-invalid={reasonShort || undefined} placeholder="Or write it in your own words"
                  className="w-full resize-none rounded-[12px] border-[1.5px] p-3 text-sm"
                  style={{ borderColor: reasonShort ? "var(--ux-danger-ink)" : "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
        {reasonShort && <p className="text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>Write a little more, so the doctor knows why you are coming.</p>}
      </> },
    { id: "feel", title: "Anything you are feeling?", hint: "Optional. Tap all that apply.", optional: true, valid: symptoms.length > 0,
      body: <Chips label="Symptoms" hue="green" options={SYMPTOMS} value={symptoms}
                   onChange={(v) => setSymptoms((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))} /> },
    { id: "share", title: `Share records with ${d.name}?`, hint: "Nothing is shared unless you tick it. You can stop sharing any time before the visit.",
      valid: !chosen.length || consent,
      body: <div className="flex flex-col gap-4">
        {records.loading ? (
          <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading your records…</p>
        ) : !items.length ? (
          <Empty icon="FileHeart" title="Nothing in your records yet"
                 body="You can still book. Medicines, allergies and reports you add to Health Records can be shared next time." />
        ) : (
          SHARE_GROUPS.filter((g) => items.some((x) => x.group === g)).map((g) => (
            <fieldset key={g} className="flex flex-col gap-1.5">
              <legend className="mb-1 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>{g}</legend>
              {items.filter((x) => x.group === g).map((x) => (
                <label key={x.key} className="flex cursor-pointer items-start gap-2.5 rounded-[12px] border p-2.5 text-sm"
                       style={{ borderColor: picked.includes(x.key) ? HUE.green.ink : "var(--ux-line)", background: picked.includes(x.key) ? HUE.green.tint : "var(--ux-surface)" }}>
                  <input type="checkbox" checked={picked.includes(x.key)} className="mt-0.5 h-[18px] w-[18px] shrink-0" style={{ accentColor: HUE.green.ink }}
                         onChange={(e) => setPicked((p) => (e.target.checked ? [...p, x.key] : p.filter((k) => k !== x.key)))} />
                  <span className="min-w-0">
                    <b className="block" style={{ color: "var(--ux-ink)" }}>{x.label}</b>
                    {x.detail && <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{x.detail}</span>}
                  </span>
                </label>
              ))}
            </fieldset>
          ))
        )}
        {chosen.length > 0 && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-[12px] p-3 text-sm font-semibold"
                 style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0"
                   style={{ accentColor: HUE.green.ink }} />
            I agree to share these {chosen.length} {chosen.length === 1 ? "item" : "items"} with {d.name} and the WomSakhi team arranging this consultation.
          </label>
        )}
        {chosen.length > 0 && !consent && (
          <p className="text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>
            Tick &ldquo;I agree&rdquo; to share what you chose, or untick the records to share nothing.
          </p>
        )}
      </div> },
    { id: "review", title: "Check, then send", valid: !!slot && (!chosen.length || consent),
      body: <>
        <Review rows={[
          ["Doctor", `${d.name} · ${d.speciality}`],
          ["When", whenLabel(slot)],
          ["How", `${MODE_LABEL[mode]}${mode === "Clinic" && d.clinic ? ` · ${d.clinic}` : ""}`],
          ["About", `${reason}${symptoms.length ? ` · ${symptoms.join(", ")}` : ""}`],
          ["Sharing", chosen.length ? chosen.map((x) => x.label).join(", ") : "Nothing from your records"],
          ["Fee", `${feeLabel(d.fee_minor)}${d.fee_minor ? " — paid to the doctor or clinic, not to WomSakhi" : ""}`],
        ]} />
        <p className="text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
          This sends a request. Our team confirms it with the doctor and tells you how to join. Only the reason, symptoms and the records you ticked are shared.
        </p>
      </> },
  ];

  return (
    <StepSheet open onClose={onClose} icon="CalendarClock" title={`Book ${d.name}`} hue="green"
               steps={steps} step={step} setStep={setStep} onSubmit={book} busy={busy} submitLabel="Send booking request" />
  );
}

/* ── My consultations ────────────────────────────────────────────────── */

function ConsultLine({ c }: { c: Consultation }) {
  const st = STATUS[c.status];
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-sm font-extrabold" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
        {c.doctor_photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={c.doctor_photo} alt="" className="h-full w-full object-cover" />
          : <I name={MODE_ICON[c.mode] ?? "Stethoscope"} />}
      </span>
      <div className="min-w-0 flex-1">
        <b className="block text-[15px]" style={{ color: "var(--ux-ink)" }}>{c.doctor_name}</b>
        <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{c.speciality} · {MODE_LABEL[c.mode]} · {whenLabel(c.start)}</p>
        <span className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: st.tint, color: st.ink }}>{st.label}</span>
      </div>
    </div>
  );
}

function Mine({ rows, loading, reload, onFollowUp }: { rows: Consultation[]; loading: boolean; reload: () => void; onFollowUp: (c: Consultation) => void }) {
  const [open, setOpen] = useState("");
  const [moving, setMoving] = useState<Consultation | null>(null);
  const cancel = async (c: Consultation) => {
    try { await apiCancelConsultation(c.id); toast("Consultation cancelled", { tone: "success" }); reload(); }
    catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
  };
  const now = new Date().toISOString();
  const upcoming = rows.filter((c) => (c.status === "requested" || c.status === "confirmed")).sort((a, b) => a.start.localeCompare(b.start));
  const groups: [string, Consultation[]][] = [
    ["Upcoming", upcoming],
    ["Completed", rows.filter((c) => c.status === "completed")],
    ["Cancelled", rows.filter((c) => c.status === "cancelled")],
  ];

  if (!loading && !rows.length) {
    return (
      <Panel title="Your consultations">
        <Empty icon="Stethoscope" title="No consultations yet" body="Find a doctor and send a booking request. It shows up here with every update."
               action={<Btn size="sm" href="/app/health/doctors" icon="CalendarClock">Find a doctor</Btn>} />
      </Panel>
    );
  }

  return (
    <Cols
      main={
        <Panel title="Your consultations" sub="Every request you sent, and where it stands.">
          {groups.filter(([, cs]) => cs.length).map(([label, cs]) => (
            <div key={label}>
              <p className="mb-2 text-2xs font-extrabold uppercase tracking-[0.1em]" style={{ color: "var(--ux-muted)" }}>{label} · {cs.length}</p>
              <ul className="flex flex-col gap-3">
                {cs.map((c) => (
                  <li key={c.id} className="rounded-[14px] border p-3.5" style={{ borderColor: "var(--ux-line)" }} data-consult={c.status}>
                    <ConsultLine c={c} />
                    {c.reason && <p className="mt-2 text-xs" style={{ color: "var(--ux-ink-2)" }}>About: {c.reason}{c.symptoms.length ? ` · ${c.symptoms.join(", ")}` : ""}</p>}
                    {c.status === "confirmed" && c.join_info && (
                      <p className="mt-2.5 flex items-start gap-2 rounded-[10px] p-2.5 text-xs font-semibold" style={{ background: HUE.green.tint, color: HUE.green.ink }}>
                        <I name={MODE_ICON[c.mode] ?? "Info"} className="h-4 w-4 shrink-0" /> How to join: {c.join_info}
                      </p>
                    )}
                    {c.status === "requested" && (
                      <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>Our team will confirm this with the doctor and tell you how to join.</p>
                    )}
                    {c.status === "cancelled" && c.cancel_reason && (
                      <p className="mt-2 text-xs" style={{ color: "var(--ux-muted)" }}>{c.cancelled_by === "staff" ? "Reason: " : ""}{c.cancel_reason}</p>
                    )}
                    {c.rescheduled_from && (c.status === "requested" || c.status === "confirmed") && (
                      <p className="mt-1 text-xs" style={{ color: "var(--ux-muted)" }}>Moved from {whenLabel(c.rescheduled_from)}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {c.status !== "cancelled" && (
                        <Btn size="sm" variant="soft" icon={open === c.id ? "ChevronUp" : "ChevronDown"} aria-expanded={open === c.id}
                             onClick={() => setOpen(open === c.id ? "" : c.id)}>Details</Btn>
                      )}
                      {(c.status === "requested" || c.status === "confirmed") && c.start > now && (<>
                        <Btn size="sm" variant="outline" icon="CalendarClock" onClick={() => setMoving(c)}>Reschedule</Btn>
                        <Btn size="sm" variant="outline" onClick={() => cancel(c)}>Cancel</Btn>
                      </>)}
                      {c.status === "completed" && c.prescription && (
                        <Btn size="sm" variant="soft" icon="FileText" href="/app/health/doctors?tab=prescriptions">See prescription</Btn>
                      )}
                      {c.status === "completed" && <Btn size="sm" variant="ghost" icon="Repeat" onClick={() => onFollowUp(c)}>Book follow-up</Btn>}
                      {c.status === "cancelled" && <Btn size="sm" variant="ghost" href="/app/health/doctors">Book again</Btn>}
                    </div>
                    {open === c.id && <ConsultDetails c={c} onChanged={reload} />}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {moving && <RescheduleSheet c={moving} onClose={() => setMoving(null)} onDone={() => { setMoving(null); reload(); }} />}
        </Panel>
      }
      side={<>
        <MetricGrid>
          <Metric hue="amber" icon="Hourglass" label="Upcoming" value={upcoming.length} />
          <Metric hue="green" icon="CheckCircle2" label="Completed" value={rows.filter((c) => c.status === "completed").length} />
        </MetricGrid>
        <FreeHelp />
      </>}
    />
  );
}

/* What she shares, her own notes, and moving the time. */
function ConsultDetails({ c, onChanged }: { c: Consultation; onChanged: () => void }) {
  const live = c.status === "requested" || c.status === "confirmed";
  const [notes, setNotes] = useState(c.member_notes);
  const [busy, setBusy] = useState("");
  const share = async (next: SharedItem[], msg: string) => {
    setBusy("share");
    try { await apiShareConsultation(c.id, next); toast(msg, { tone: "success" }); onChanged(); }
    catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
    finally { setBusy(""); }
  };
  const saveNotes = async () => {
    setBusy("notes");
    try { await apiConsultationNotes(c.id, notes); toast("Notes saved", { tone: "success" }); onChanged(); }
    catch (e) { toast(apiErrorMessage(e), { tone: "error" }); }
    finally { setBusy(""); }
  };
  return (
    <div className="mt-3 flex flex-col gap-4 rounded-[12px] p-3.5" style={{ background: "var(--ux-surface-2)" }}>
      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <b className="text-sm" style={{ color: "var(--ux-ink)" }}>Shared with this doctor</b>
          {live && c.shared.length > 1 && (
            <Btn size="sm" variant="ghost" loading={busy === "share"} onClick={() => share([], "You stopped sharing your records")}>Stop sharing all</Btn>
          )}
        </div>
        {c.shared.length ? (
          <ul className="flex flex-col gap-1.5">
            {c.shared.map((x) => (
              <li key={`${x.kind}|${x.label}`} className="flex items-center gap-2.5 rounded-[10px] p-2.5 text-sm" style={{ background: "var(--ux-surface)" }}>
                <I name="FileHeart" className="h-4 w-4 shrink-0" style={{ color: HUE.green.ink }} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate" style={{ color: "var(--ux-ink)" }}>{x.label}</b>
                  {x.detail && <span className="block truncate text-xs" style={{ color: "var(--ux-muted)" }}>{x.detail}</span>}
                </span>
                {live && (
                  <Btn size="sm" variant="ghost" disabled={!!busy}
                       onClick={() => share(c.shared.filter((y) => !(y.kind === x.kind && y.label === x.label)), `Stopped sharing ${x.label}`)}>Stop sharing</Btn>
                )}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs" style={{ color: "var(--ux-muted)" }}>You are not sharing anything from your records{live ? "" : " for this visit"}.</p>}
      </div>
      <div>
        <label htmlFor={`notes-${c.id}`} className="mb-1.5 block text-sm font-bold" style={{ color: "var(--ux-ink)" }}>My notes</label>
        <textarea id={`notes-${c.id}`} value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 2000))} rows={3}
                  placeholder={live ? "Questions to ask, things to mention" : "What the doctor said, what to do next"}
                  className="w-full resize-y rounded-[12px] border p-3 text-sm"
                  style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs" style={{ color: "var(--ux-muted)" }}>Only you can see these notes.</span>
          <Btn size="sm" variant="soft" icon="Save" loading={busy === "notes"} disabled={notes === c.member_notes} onClick={saveNotes}>Save notes</Btn>
        </div>
      </div>
    </div>
  );
}

function RescheduleSheet({ c, onClose, onDone }: { c: Consultation; onClose: () => void; onDone: () => void }) {
  const doc = useResource(useCallback((s: AbortSignal) => apiDoctor(c.doctor_id, s), [c.doctor_id]), null as Doctor | null);
  const days = useMemo(() => nextDays(14).filter((x) => !doc.data || doc.data.days.includes(x.dow)), [doc.data]);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState("");
  const day = picked || days[0]?.day || "";
  const { slots } = useSlots(c.doctor_id, day);
  const [slot, setSlot] = useState("");
  const [busy, setBusy] = useState(false);
  const move = async () => {
    setBusy(true);
    try {
      await apiRescheduleConsultation(c.id, slot);
      toast("New time sent — we will confirm it and tell you how to join", { tone: "success" });
      onDone();
    } catch (e) { toast(apiErrorMessage(e), { tone: "error" }); setSlot(""); setStep(1); }
    finally { setBusy(false); }
  };
  const steps: FlowStep[] = [
    { id: "day", title: "Which day instead?", hint: `${c.doctor_name} · now ${whenLabel(c.start)}`, valid: !!day,
      body: days.length
        ? <DayTiles days={days} value={day} onPick={(x) => { setPicked(x); setSlot(""); }} />
        : <Empty icon="CalendarX" title="No days open" body="This doctor has no hours in the next two weeks. Cancel and book another doctor instead." /> },
    { id: "time", title: "Pick a new time", hint: day ? dayLong(day) : undefined, valid: !!slot,
      body: <SlotTiles slots={slots} value={slot} onPick={setSlot} empty={<Empty icon="CalendarX" title="No free times" body="Go back and pick another day." />} /> },
    { id: "check", title: "Move your consultation?", valid: !!slot,
      body: <>
        <Review rows={[["Doctor", c.doctor_name], ["Was", whenLabel(c.start)], ["New time", slot ? whenLabel(slot) : ""]]} />
        <p className="text-xs" style={{ color: "var(--ux-muted)" }}>A new time goes back to our team to confirm with the doctor. What you share stays the same.</p>
      </> },
  ];
  return (
    <StepSheet open onClose={onClose} icon="CalendarClock" title="Pick a new time" hue="green"
               steps={steps} step={step} setStep={setStep} onSubmit={move} busy={busy}
               submitLabel={`Move to ${slot ? whenLabel(slot) : "this time"}`} />
  );
}

/* ── Prescriptions ───────────────────────────────────────────────────── */

function Prescriptions({ rows, onFollowUp }: { rows: Consultation[]; onFollowUp: (c: Consultation) => void }) {
  const docs = useEntries("document");
  const [adding, setAdding] = useState(false);
  const saved = docs.rows.filter((r) => r.data.type === "Prescription");
  const done = rows.filter((c) => c.status === "completed" && c.prescription);
  const isSaved = (c: Consultation) => saved.some((s) => (s.data.note || "").includes(`#${c.id.slice(-6)}`));

  const keep = (c: Consultation) => docs.add("document", {
    title: `Prescription — ${c.doctor_name}`.slice(0, 100), type: "Prescription", provider: c.doctor_name.slice(0, 80),
    note: `From your consultation on ${whenLabel(c.start, { day: "numeric", month: "short", year: "numeric" })} #${c.id.slice(-6)}`.slice(0, 200),
  }, (c.prescription_at || c.start).slice(0, 10), "Saved to your Health Records");

  return (
    <Cols
      main={
        <Panel title="From your consultations" sub="Written by your doctor. WomSakhi never changes a dose."
               action={<Btn size="sm" icon="Plus" onClick={() => setAdding(true)}>Add a prescription</Btn>}>
          {adding && (
            <DocumentSheet initialType="Prescription" title="Add a prescription" onClose={() => setAdding(false)}
                           onSave={async (data, date) => { const ok = await docs.add("document", data, date, "Prescription saved"); if (ok) setAdding(false); }} />
          )}
          {done.length ? (
            <ul className="flex flex-col gap-3">
              {done.map((c) => (
                <li key={c.id} className="rounded-[14px] border p-4" style={{ borderColor: "var(--ux-line)" }} data-prescription>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="block text-[15px]" style={{ color: "var(--ux-ink)" }}>{c.doctor_name}</b>
                      <p className="text-xs" style={{ color: "var(--ux-muted)" }}>{c.speciality} · {whenLabel(c.prescription_at || c.start, { day: "numeric", month: "short", year: "numeric" })}</p>
                    </div>
                    {isSaved(c)
                      ? <span className="rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: "var(--ux-tint-green)", color: "var(--ux-green-ink)" }}>In Health Records</span>
                      : <Btn size="sm" variant="soft" icon="Save" onClick={() => keep(c)}>Save to Health Records</Btn>}
                  </div>
                  <p className="mt-3 whitespace-pre-line rounded-[12px] p-3 text-sm leading-relaxed" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
                    {c.prescription}
                  </p>
                  {c.prescription_file && (
                    <a href={c.prescription_file} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold underline" style={{ color: "var(--ux-green-ink)" }}>
                      <I name="Download" className="h-3.5 w-3.5" /> Open the prescription file
                    </a>
                  )}
                  <div className="mt-3"><Btn size="sm" variant="ghost" icon="Repeat" onClick={() => onFollowUp(c)}>Book follow-up</Btn></div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="FileText" title="No prescriptions yet" body="After a consultation is completed, your doctor's prescription shows up here." />
          )}
        </Panel>
      }
      side={<>
        <Panel title="Your saved prescriptions" action={<Btn size="sm" variant="ghost" href="/app/health/records?tab=reports" iconEnd="ArrowRight">All records</Btn>}>
          {saved.length ? (
            <ul className="flex flex-col gap-2">
              {saved.slice(0, 6).map((s) => (
                <li key={s.id} className="flex items-center gap-2.5 text-sm">
                  <I name="FileText" className="h-4 w-4 shrink-0" style={{ color: HUE.blue.ink }} />
                  <span className="min-w-0 flex-1 truncate" style={{ color: "var(--ux-ink)" }}>{s.data.title}</span>
                  <span className="shrink-0 text-xs" style={{ color: "var(--ux-muted)" }}>{s.date}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Prescriptions you save from a consultation, or add yourself, are listed here.</p>}
        </Panel>
        <Disclaimer>Only your doctor can issue or change a prescription. Take medicines exactly as written, and ask your doctor before stopping one.</Disclaimer>
      </>}
    />
  );
}
