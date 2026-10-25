"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Btn, Sheet } from "@/components/ux/kit";
import { MediaCard, MediaGrid, Fact } from "@/components/ux/media/MediaCard";
import { toast } from "@/components/ux/mobile/Toast";
import {
  Chips, Cols, Disclaimer, Empty, HealthFrame, HUE, I, Metric, MetricGrid, Panel, useEntries,
} from "@/components/ux/health/kit";
import { apiErrorMessage } from "@/lib/api";
import {
  SPECIALITIES, apiBookDoctor, apiCancelConsultation, apiDoctorSlots, apiDoctors, apiMyConsultations,
  feeLabel, timeLabel, whenLabel, type Consultation, type Doctor, type Mode,
} from "@/lib/doctors-api";
import { useResource } from "@/lib/use-resource";

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
];

const REASONS = [
  "Irregular or painful periods", "Pregnancy check-up", "PCOS / weight concerns", "Tiredness or weakness",
  "Skin or hair problem", "Child's health", "Feeling low or anxious", "Diet advice",
];
const SYMPTOMS = ["Pain", "Fever", "Bleeding", "Cramps", "Headache", "Nausea", "Fatigue", "Itching", "Sleeplessness"];

const MODE_ICON: Record<Mode, string> = { Video: "Video", Phone: "Phone", Clinic: "MapPin" };
const MODE_LABEL: Record<Mode, string> = { Video: "Video call", Phone: "Phone call", Clinic: "At the clinic" };

const STATUS: Record<Consultation["status"], { label: string; tint: string; ink: string }> = {
  requested: { label: "Requested — waiting to confirm", tint: "var(--ux-tint-amber)", ink: "var(--ux-amber-ink)" },
  confirmed: { label: "Confirmed", tint: "var(--ux-tint-green)", ink: "var(--ux-green-ink)" },
  completed: { label: "Completed", tint: "var(--ux-tint-blue)", ink: "var(--ux-blue-ink)" },
  cancelled: { label: "Cancelled", tint: "var(--ux-surface-2)", ink: "var(--ux-muted)" },
};

export default function DoctorConsultation() {
  const consults = useResource(useCallback((s: AbortSignal) => apiMyConsultations(s), []), [] as Consultation[]);
  const [booking, setBooking] = useState<Doctor | null>(null);

  return (
    <HealthFrame active="/app/health/doctors" hue="green" icon="Stethoscope" eyebrow="Doctor Consultation"
                 title="Doctor Consultation" art="/ux/art/course-video-call-mentor.webp"
                 sub="Book a video, phone or clinic consultation with a doctor our team has checked. You share only what you choose."
                 tabs={TABS}
                 actions={<>
                   <Btn href="/app/health/doctors" icon="CalendarClock">Book consultation</Btn>
                   <Btn href="/app/health/doctors?tab=consultations" variant="outline">My consultations</Btn>
                 </>}>
      {(tab) => (
        <>
          {tab === "find" && <Find onBook={setBooking} consults={consults.data} />}
          {tab === "consultations" && <Mine rows={consults.data} loading={consults.source === "loading"} reload={consults.refetch} />}
          {tab === "prescriptions" && <Prescriptions rows={consults.data} />}
          <BookSheet doctor={booking} onClose={() => setBooking(null)} onBooked={() => { setBooking(null); consults.refetch(); }} />
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
  const [spec, setSpec] = useState("");
  const [mode, setMode] = useState("");
  const [q, setQ] = useState("");
  const all = useResource(useCallback((s: AbortSignal) => apiDoctors({}, s), []), [] as Doctor[]);
  const loading = all.source === "loading";
  const specs = SPECIALITIES.filter((s) => all.data.some((d) => d.speciality === s));
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
                        <I name={s === "Paediatrician" ? "Baby" : s === "Counsellor" ? "Brain" : s === "Nutritionist" ? "Apple" : s === "Gynaecologist" ? "Flower2" : "Stethoscope"} className="h-[18px] w-[18px]" />
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

const STEPS = ["How", "Day", "Time", "Reason", "Confirm"] as const;

function BookSheet({ doctor, onClose, onBooked }: { doctor: Doctor | null; onClose: () => void; onBooked: () => void }) {
  return doctor ? <BookFlow key={doctor.id} doctor={doctor} onClose={onClose} onBooked={onBooked} /> : null;
}

function BookFlow({ doctor: d, onClose, onBooked }: { doctor: Doctor; onClose: () => void; onBooked: () => void }) {
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>(d.modes[0]);
  const days = useMemo(() => nextDays(14).filter((x) => d.days.includes(x.dow)), [d.days]);
  const [day, setDay] = useState(() => (d.next_slot ? d.next_slot.slice(0, 10) : days[0]?.day ?? ""));
  // Free times, keyed by the day (and a reload count) they were fetched for;
  // a key that does not match yet reads as "loading".
  const [got, setGot] = useState<{ key: string; slots: string[] }>({ key: "", slots: [] });
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  const key = `${day}|${reload}`;
  const slots = got.key === key ? got.slots : null;
  useEffect(() => {
    if (!day) return;
    const ctl = new AbortController();
    apiDoctorSlots(d.id, day, ctl.signal)
      .then((r) => setGot({ key, slots: r.slots }))
      .catch(() => { if (!ctl.signal.aborted) setGot({ key, slots: [] }); });
    return () => ctl.abort();
  }, [d.id, day, key]);
  const pickDay = (x: string) => { setDay(x); setSlot(""); };

  const canNext = [!!mode, !!day, !!slot, reason.trim().length >= 2, true][step];

  const book = async () => {
    setBusy(true);
    try {
      await apiBookDoctor(d.id, { start: slot, mode, reason: reason.trim(), symptoms });
      toast("Request sent — we will confirm it and tell you how to join", { tone: "success" });
      onBooked();
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
      // Someone took the slot meanwhile: back to the times, freshly loaded.
      if (apiErrorMessage(e).toLowerCase().includes("time")) { setStep(2); setSlot(""); setReload((n) => n + 1); }
    } finally { setBusy(false); }
  };

  const chip = (on: boolean) => on
    ? { borderColor: HUE.green.ink, background: HUE.green.tint, color: "var(--ux-ink)" }
    : { borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink-2)" };

  return (
    <Sheet open onClose={onClose} icon="CalendarClock" title={`Book ${d.name}`} width={520}
           description={`${d.speciality} · ${feeLabel(d.fee_minor)}${d.fee_minor ? ", paid to the doctor or clinic" : ""}`}
           footer={
             <div className="flex gap-2">
               {step > 0 && <Btn variant="outline" icon="ChevronLeft" onClick={() => setStep(step - 1)}>Back</Btn>}
               {step < 4
                 ? <Btn full iconEnd="ArrowRight" disabled={!canNext} onClick={() => setStep(step + 1)}>Next</Btn>
                 : <Btn full icon="Send" loading={busy} onClick={book}>Send booking request</Btn>}
             </div>
           }>
      <ol className="mb-5 flex flex-wrap gap-1.5" aria-label="Booking steps">
        {STEPS.map((s, i) => (
          <li key={s} aria-current={i === step ? "step" : undefined}
              className="flex items-center gap-1.5 rounded-full py-1 pe-2.5 ps-1 text-xs font-bold"
              style={{ background: i === step ? HUE.green.tint : "var(--ux-surface-2)", color: i <= step ? "var(--ux-ink)" : "var(--ux-muted)" }}>
            <span className="grid h-5 w-5 place-items-center rounded-full text-[11px]"
                  style={{ background: i < step ? "var(--ux-green-ink)" : i === step ? HUE.green.ink : "var(--ux-surface)", color: i <= step ? "var(--ux-surface)" : "var(--ux-muted)" }}>
              {i < step ? "✓" : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="flex flex-col gap-2.5">
          <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>How would you like to consult?</p>
          {d.modes.map((m) => (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)}
                    className="ux-press flex min-h-[56px] items-center gap-3 rounded-[14px] border-[1.5px] px-4 text-start text-sm font-bold" style={chip(mode === m)}>
              <I name={MODE_ICON[m]} /> {MODE_LABEL[m]}
              {m === "Clinic" && d.clinic && <span className="ms-auto truncate text-xs font-semibold" style={{ color: "var(--ux-muted)" }}>{d.clinic}{d.city ? `, ${d.city}` : ""}</span>}
            </button>
          ))}
        </div>
      )}

      {step === 1 && (
        days.length ? (
          <div>
            <p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Pick a day</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((x) => (
                <button key={x.day} type="button" aria-pressed={day === x.day} onClick={() => pickDay(x.day)}
                        className="ux-press flex min-w-[64px] flex-col items-center rounded-[13px] border-[1.5px] px-2 py-2 text-xs font-bold" style={chip(day === x.day)}>
                  {x.dow}<b className="text-lg leading-tight">{x.date}</b>{x.month}
                </button>
              ))}
            </div>
          </div>
        ) : <Empty icon="CalendarX" title="No days open" body="This doctor has no hours in the next two weeks. Try another doctor." />
      )}

      {step === 2 && (
        <div>
          <p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>
            Pick a time · {new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
          </p>
          {slots === null ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Finding free times…</p> : slots.length ? (
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))" }}>
              {slots.map((s) => (
                <button key={s} type="button" aria-pressed={slot === s} onClick={() => setSlot(s)}
                        className="ux-press min-h-[44px] rounded-[11px] border-[1.5px] text-sm font-bold tabular-nums" style={chip(slot === s)}>
                  {timeLabel(s)}
                </button>
              ))}
            </div>
          ) : <Empty icon="CalendarX" title="Fully booked" body="No free times on this day. Go back and pick another day." />}
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>What is it about?</p>
            <Chips label="Reason" hue="green" options={REASONS} value={reason} onChange={setReason} />
            <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} rows={3} aria-label="Reason in your words"
                      placeholder="Or write it in your own words"
                      className="mt-2.5 w-full resize-none rounded-[12px] border p-3 text-sm"
                      style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </div>
          <div>
            <p className="mb-2 text-sm font-bold" style={{ color: "var(--ux-ink)" }}>Anything you are feeling? <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(optional)</span></p>
            <Chips label="Symptoms" hue="green" options={SYMPTOMS} value={symptoms}
                   onChange={(v) => setSymptoms((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]))} />
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="flex flex-col gap-3">
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 rounded-[14px] p-4 text-sm" style={{ background: "var(--ux-surface-2)" }}>
            <dt style={{ color: "var(--ux-muted)" }}>Doctor</dt><dd className="font-bold" style={{ color: "var(--ux-ink)" }}>{d.name} · {d.speciality}</dd>
            <dt style={{ color: "var(--ux-muted)" }}>When</dt><dd className="font-bold" style={{ color: "var(--ux-ink)" }}>{whenLabel(slot)}</dd>
            <dt style={{ color: "var(--ux-muted)" }}>How</dt><dd style={{ color: "var(--ux-ink)" }}>{MODE_LABEL[mode]}{mode === "Clinic" && d.clinic ? ` · ${d.clinic}` : ""}</dd>
            <dt style={{ color: "var(--ux-muted)" }}>About</dt><dd style={{ color: "var(--ux-ink)" }}>{reason}{symptoms.length ? ` · ${symptoms.join(", ")}` : ""}</dd>
            <dt style={{ color: "var(--ux-muted)" }}>Fee</dt><dd style={{ color: "var(--ux-ink)" }}>{feeLabel(d.fee_minor)}{d.fee_minor ? " — paid to the doctor or clinic, not to WomSakhi" : ""}</dd>
          </dl>
          <p className="text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
            This sends a request. Our team confirms it with the doctor and tells you how to join. Only the reason and symptoms above are shared.
          </p>
        </div>
      )}
    </Sheet>
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

function Mine({ rows, loading, reload }: { rows: Consultation[]; loading: boolean; reload: () => void }) {
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
                    <div className="mt-3 flex flex-wrap gap-2">
                      {(c.status === "requested" || c.status === "confirmed") && c.start > now && (
                        <Btn size="sm" variant="outline" onClick={() => cancel(c)}>Cancel</Btn>
                      )}
                      {c.status === "completed" && c.prescription && (
                        <Btn size="sm" variant="soft" icon="FileText" href="/app/health/doctors?tab=prescriptions">See prescription</Btn>
                      )}
                      {(c.status === "cancelled" || c.status === "completed") && (
                        <Btn size="sm" variant="ghost" href="/app/health/doctors">Book again</Btn>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
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

/* ── Prescriptions ───────────────────────────────────────────────────── */

function Prescriptions({ rows }: { rows: Consultation[] }) {
  const docs = useEntries("document");
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
        <Panel title="From your consultations" sub="Written by your doctor. WomSakhi never changes a dose.">
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
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="FileText" title="No prescriptions yet" body="After a consultation is completed, your doctor's prescription shows up here." />
          )}
        </Panel>
      }
      side={<>
        <Panel title="Saved in Health Records" action={<Btn size="sm" variant="ghost" href="/app/health/records?tab=reports" iconEnd="ArrowRight">Open</Btn>}>
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
          ) : <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Prescriptions you save, or add yourself in Health Records, are listed here.</p>}
        </Panel>
        <Disclaimer>Only your doctor can issue or change a prescription. Take medicines exactly as written, and ask your doctor before stopping one.</Disclaimer>
      </>}
    />
  );
}
