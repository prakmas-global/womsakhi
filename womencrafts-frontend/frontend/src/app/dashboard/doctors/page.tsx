"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, Plus, Search, Stethoscope, Trash2, UserRoundCheck, Users } from "lucide-react";

import {
  Badge, Card, EmptyState, ImageUpload, Input, Modal, Select, StatCard, Switch, Textarea, useToast,
} from "@/design-system";
import { memberError } from "@/lib/member-api";
import { useMaster } from "@/lib/masters-api";
import {
  MODES, SPECIALITIES, WEEKDAYS, apiAdminAddDoctor, apiAdminDoctors, apiAdminEditDoctor, feeLabel,
  type Doctor, type DoctorInput, type Hours, type Mode,
} from "@/lib/doctors-api";

/**
 * Doctors — the directory behind Health → Doctor Consultation
 * (backend: routes/doctors.py, /admin/doctors; permission: Appointments).
 *
 * Only doctors listed and switched on here are shown to members. Add a doctor
 * only after checking her registration number with the medical council. A
 * doctor is never deleted — switching her off hides her and keeps the
 * consultations she gave.
 */

/** What the languages list shipped with; staff edit it as the `languages` master. */
const LANGS = ["Hindi", "English", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Gujarati", "Urdu", "Punjabi"];

const BLANK: DoctorInput = {
  name: "", speciality: "Gynaecologist", qualifications: "", registration_no: "", languages: ["Hindi", "English"],
  experience_years: 0, fee_minor: 0, modes: ["Video"], clinic: "", city: "", photo: null, bio: "",
  availability: [{ day: "Mon", start: "10:00", end: "13:00", slot_minutes: 20 }], active: true,
};

export default function DoctorsAdminPage() {
  const toast = useToast();
  const [rows, setRows] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ id: string | null; form: DoctorInput } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await apiAdminDoctors()); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const shown = useMemo(() => rows.filter((d) => !q.trim() ||
    [d.name, d.speciality, d.city, d.clinic].join(" ").toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const active = rows.filter((d) => d.active);

  const openNew = () => setEditing({ id: null, form: { ...BLANK, availability: [...BLANK.availability] } });
  const openEdit = (d: Doctor) => setEditing({
    id: d.id,
    form: {
      name: d.name, speciality: d.speciality, qualifications: d.qualifications, registration_no: d.registration_no,
      languages: d.languages, experience_years: d.experience_years, fee_minor: d.fee_minor, modes: d.modes,
      clinic: d.clinic, city: d.city, photo: d.photo || null, bio: d.bio, availability: d.availability, active: d.active,
    },
  });
  const set = (patch: Partial<DoctorInput>) => setEditing((e) => (e ? { ...e, form: { ...e.form, ...patch } } : e));

  const save = async () => {
    if (!editing) return;
    const f = editing.form;
    if (f.name.trim().length < 2) { toast.error("Add the doctor's name"); return; }
    if (!f.modes.length) { toast.error("Pick at least one way to consult"); return; }
    setBusy(true);
    try {
      const body = { ...f, name: f.name.trim() };
      if (editing.id) await apiAdminEditDoctor(editing.id, body); else await apiAdminAddDoctor(body);
      toast.success(editing.id ? "Doctor updated" : "Doctor added", { description: f.active ? "Members can book her now." : "Switched off: members do not see her." });
      setEditing(null);
      await load();
    } catch (e) {
      toast.error("Could not save the doctor", { description: memberError(e) });
    } finally { setBusy(false); }
  };

  const toggle = async (d: Doctor) => {
    try {
      await apiAdminEditDoctor(d.id, {
        name: d.name, speciality: d.speciality, qualifications: d.qualifications, registration_no: d.registration_no,
        languages: d.languages, experience_years: d.experience_years, fee_minor: d.fee_minor, modes: d.modes, clinic: d.clinic,
        city: d.city, photo: d.photo || null, bio: d.bio, availability: d.availability, active: !d.active,
      });
      toast.success(d.active ? `${d.name} switched off` : `${d.name} is bookable again`);
      await load();
    } catch (e) { toast.error("Could not change the doctor", { description: memberError(e) }); }
  };

  const f = editing?.form;
  // Both lists are masters staff edit in Settings → Masters. A doctor keeps a
  // value that has since been disabled, so it stays in her form.
  const specialityMaster = useMaster("doctor_specialities", [...SPECIALITIES]);
  const languageMaster = useMaster("languages", LANGS);
  const specialityOptions = f && f.speciality && !specialityMaster.labels.includes(f.speciality)
    ? [f.speciality, ...specialityMaster.labels] : specialityMaster.labels;
  const languageOptions = [...languageMaster.labels, ...(f?.languages ?? []).filter((l) => !languageMaster.labels.includes(l))];
  const setHours = (i: number, patch: Partial<Hours>) => f && set({ availability: f.availability.map((h, k) => (k === i ? { ...h, ...patch } : h)) });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><Stethoscope className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Doctors</h1>
            <p className="mt-1 text-sm text-ink-subtle">The doctors members can book in Health → Doctor Consultation. Check each registration before adding.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/doctors/consultations" className="btn btn-outline"><CalendarClock className="h-4 w-4" /> Consultations</Link>
          <button className="btn btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add doctor</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Bookable doctors" value={String(active.length)} icon={UserRoundCheck} tone="emerald" deltaNote="Switched on" />
        <StatCard label="All doctors" value={String(rows.length)} icon={Users} tone="brand" deltaNote="Including switched off" />
        <StatCard label="Specialities" value={String(new Set(active.map((d) => d.speciality)).size)} icon={Stethoscope} tone="violet" deltaNote="Members can choose from" />
        <StatCard label="Consultations given" value={rows.reduce((n, d) => n + d.consultations_done, 0).toLocaleString()} icon={BadgeCheck} tone="sky" deltaNote="Completed" />
      </div>

      <Card className="mt-6">
        <label className="relative mb-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input aria-label="Search doctors" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, speciality or city…"
                 className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300" />
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : loading ? (
          <p className="py-8 text-center text-sm text-ink-subtle">Loading doctors…</p>
        ) : shown.length === 0 ? (
          <EmptyState icon={Stethoscope} title={rows.length ? "No doctors match" : "No doctors yet"}
                      description={rows.length ? "Try another search." : "Add the first doctor members can book. Until then, members see free government options."} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-ink-subtle">
                <tr><th className="py-2 pr-3">Doctor</th><th className="pr-3">Ways</th><th className="pr-3">Hours</th><th className="pr-3">Fee</th><th className="pr-3">Status</th><th /></tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id} className="border-t border-line">
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-tint text-sm font-bold text-brand-ink">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {d.photo ? <img src={d.photo} alt="" className="h-full w-full object-cover" /> : d.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold text-ink">{d.name}</p>
                          <p className="text-xs text-ink-subtle">{d.speciality}{d.qualifications ? ` · ${d.qualifications}` : ""}{d.city ? ` · ${d.city}` : ""}</p>
                        </div>
                      </div>
                    </td>
                    <td className="pr-3 text-ink-muted">{d.modes.join(", ")}</td>
                    <td className="pr-3 text-ink-muted">{d.days.length ? d.days.join(" ") : <span className="text-amber-700">No hours</span>}</td>
                    <td className="pr-3 text-ink-muted">{feeLabel(d.fee_minor)}</td>
                    <td className="pr-3">{d.active ? <Badge tone="emerald">Bookable</Badge> : <Badge tone="slate">Switched off</Badge>}</td>
                    <td className="whitespace-nowrap text-right">
                      <button className="btn btn-outline btn-sm mr-2" onClick={() => openEdit(d)}>Edit</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(d)}>{d.active ? "Switch off" : "Switch on"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!editing} onClose={() => setEditing(null)} size="lg" icon={Stethoscope}
             title={editing?.id ? "Edit doctor" : "Add a doctor"}
             description="Members see her name, speciality, languages, ways to consult, fee, clinic and hours."
             footer={<>
               <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
               <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save doctor"}</button>
             </>}>
        {f && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Name" required value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Dr Asha Verma" />
              <Select label="Speciality" value={f.speciality} options={specialityOptions} onChange={(e) => set({ speciality: e.target.value })} />
              <Input label="Qualifications" value={f.qualifications} onChange={(e) => set({ qualifications: e.target.value })} placeholder="MBBS, MS (OBG)" />
              <Input label="Registration number" value={f.registration_no} onChange={(e) => set({ registration_no: e.target.value })} hint="Checked with the medical council before adding." />
              <Input label="Years of experience" type="number" value={String(f.experience_years)} onChange={(e) => set({ experience_years: Math.max(0, Number(e.target.value) || 0) })} />
              <Input label="Fee per consultation (₹)" type="number" value={String(Math.round(f.fee_minor / 100))} hint="0 = free. Paid to the doctor or clinic, never through WomSakhi."
                     onChange={(e) => set({ fee_minor: Math.max(0, Math.round(Number(e.target.value) || 0)) * 100 })} />
              <Input label="Clinic or hospital" value={f.clinic} onChange={(e) => set({ clinic: e.target.value })} />
              <Input label="City" value={f.city} onChange={(e) => set({ city: e.target.value })} />
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink-muted">Ways to consult</p>
              <div className="flex flex-wrap gap-2">
                {MODES.map((m) => {
                  const on = f.modes.includes(m);
                  return (
                    <button key={m} type="button" aria-pressed={on}
                            onClick={() => set({ modes: on ? f.modes.filter((x) => x !== m) : [...f.modes, m as Mode] })}
                            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-brand bg-brand-tint text-brand-ink" : "border-line-strong text-ink-muted"}`}>
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink-muted">Languages</p>
              <div className="flex flex-wrap gap-2">
                {languageOptions.map((l) => {
                  const on = f.languages.includes(l);
                  return (
                    <button key={l} type="button" aria-pressed={on}
                            onClick={() => set({ languages: on ? f.languages.filter((x) => x !== l) : [...f.languages, l] })}
                            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${on ? "border-brand bg-brand-tint text-brand-ink" : "border-line-strong text-ink-muted"}`}>
                      {l}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-muted">Weekly hours</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ availability: ["Mon", "Tue", "Wed", "Thu", "Fri"].map((day) => ({ day: day as Hours["day"], start: "10:00", end: "13:00", slot_minutes: 20 })) })}>
                    Mon–Fri mornings
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set({ availability: [...f.availability, { day: "Sat", start: "10:00", end: "13:00", slot_minutes: 20 }] })}>
                    <Plus className="h-4 w-4" /> Add hours
                  </button>
                </div>
              </div>
              {f.availability.length === 0 && <p className="text-sm text-amber-700">No hours: members will not be able to book her.</p>}
              <div className="space-y-2">
                {f.availability.map((h, i) => (
                  <div key={i} className="grid grid-cols-[90px_1fr_1fr_100px_36px] items-center gap-2">
                    <select aria-label="Day" value={h.day} onChange={(e) => setHours(i, { day: e.target.value as Hours["day"] })}
                            className="rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm text-ink">
                      {WEEKDAYS.map((w) => <option key={w}>{w}</option>)}
                    </select>
                    <input aria-label="From" type="time" value={h.start} onChange={(e) => setHours(i, { start: e.target.value })}
                           className="rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm text-ink" />
                    <input aria-label="To" type="time" value={h.end} onChange={(e) => setHours(i, { end: e.target.value })}
                           className="rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm text-ink" />
                    <select aria-label="Slot length" value={h.slot_minutes} onChange={(e) => setHours(i, { slot_minutes: Number(e.target.value) })}
                            className="rounded-lg border border-line-strong bg-surface px-2 py-2 text-sm text-ink">
                      {[10, 15, 20, 30, 45, 60].map((n) => <option key={n} value={n}>{n} min</option>)}
                    </select>
                    <button type="button" aria-label="Remove these hours" className="grid h-9 w-9 place-items-center rounded-lg text-ink-subtle hover:bg-surface-hover"
                            onClick={() => set({ availability: f.availability.filter((_, k) => k !== i) })}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <ImageUpload label="Photo" kind="avatar" variant="avatar" name={f.name} value={f.photo ?? null} onChange={(url) => set({ photo: url })} />
            <Textarea label="About her" rows={3} value={f.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="What she helps with, in plain words." />
            <Switch label="Bookable" description="Members see and can book her only while this is on." checked={f.active} onChange={(v) => set({ active: v })} />
          </div>
        )}
      </Modal>
    </div>
  );
}
