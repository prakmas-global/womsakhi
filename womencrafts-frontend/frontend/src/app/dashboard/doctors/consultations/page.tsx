"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarClock, CheckCircle2, ClipboardList, FileText, Stethoscope, XCircle } from "lucide-react";

import { Badge, Card, EmptyState, ImageUpload, Input, Modal, StatCard, Textarea, useToast } from "@/design-system";
import type { Tone } from "@/design-system";
import { memberError } from "@/lib/member-api";
import {
  apiAdminCancelConsultation, apiAdminCompleteConsultation, apiAdminConfirmConsultation, apiAdminConsultations,
  feeLabel, whenLabel, type AdminConsultation, type ConsultStatus,
} from "@/lib/doctors-api";

/**
 * Doctor consultations — the queue staff work through
 * (backend: routes/doctors.py, /admin/doctors/consultations).
 *
 * A member's booking arrives as "requested". Confirm it once the doctor agrees,
 * with how to join (a video link, a phone note, the clinic address). After the
 * consultation, complete it with the prescription the doctor wrote; the member
 * is told at each step and the prescription shows in her app. Cancelling needs
 * a reason, which she is shown.
 */

const TABS: { id: ConsultStatus; label: string }[] = [
  { id: "requested", label: "To confirm" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Completed" },
  { id: "cancelled", label: "Cancelled" },
];
const TONE: Record<ConsultStatus, Tone> = { requested: "amber", confirmed: "emerald", completed: "sky", cancelled: "slate" };

type Action = { kind: "confirm" | "complete" | "cancel"; c: AdminConsultation } | null;

export default function ConsultationsAdminPage() {
  const toast = useToast();
  const [tab, setTab] = useState<ConsultStatus>("requested");
  const [rows, setRows] = useState<AdminConsultation[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [act, setAct] = useState<Action>(null);
  const [text, setText] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const all = await apiAdminConsultations();
      setRows(all);
      setCounts(all.reduce<Record<string, number>>((m, c) => ({ ...m, [c.status]: (m[c.status] || 0) + 1 }), {}));
      setError("");
    } catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const shown = rows.filter((c) => c.status === tab)
    .sort((a, b) => (tab === "requested" || tab === "confirmed" ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)));

  const open = (kind: "confirm" | "complete" | "cancel", c: AdminConsultation) => {
    setAct({ kind, c });
    setText(kind === "confirm" ? (c.mode === "Clinic" ? [c.clinic, c.city].filter(Boolean).join(", ") : "") : "");
    setFile(null);
  };

  const submit = async () => {
    if (!act) return;
    const t = text.trim();
    if (act.kind !== "confirm" && t.length < 2) {
      toast.error(act.kind === "complete" ? "Write the prescription" : "Give a reason she will be shown");
      return;
    }
    setBusy(true);
    try {
      if (act.kind === "confirm") await apiAdminConfirmConsultation(act.c.id, { join_info: t });
      if (act.kind === "complete") await apiAdminCompleteConsultation(act.c.id, { prescription: t, file });
      if (act.kind === "cancel") await apiAdminCancelConsultation(act.c.id, t);
      toast.success({ confirm: "Confirmed — she has been told", complete: "Completed — her prescription is in her app", cancel: "Cancelled — she has been told why" }[act.kind]);
      setAct(null);
      await load();
    } catch (e) {
      toast.error("Could not save", { description: memberError(e) });
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><ClipboardList className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Doctor consultations</h1>
            <p className="mt-1 text-sm text-ink-subtle">Confirm each request with the doctor, then complete it with the prescription.</p>
          </div>
        </div>
        <Link href="/dashboard/doctors" className="btn btn-outline"><Stethoscope className="h-4 w-4" /> Doctors</Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="To confirm" value={String(counts.requested || 0)} icon={CalendarClock} tone="amber" deltaNote="Waiting on us" />
        <StatCard label="Confirmed" value={String(counts.confirmed || 0)} icon={CalendarCheck} tone="emerald" deltaNote="Booked with the doctor" />
        <StatCard label="Completed" value={String(counts.completed || 0)} icon={CheckCircle2} tone="sky" deltaNote="With a prescription" />
        <StatCard label="Cancelled" value={String(counts.cancelled || 0)} icon={XCircle} tone="slate" deltaNote="By her or by us" />
      </div>

      <Card className="mt-6">
        <div role="tablist" className="mb-4 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold ${tab === t.id ? "border-brand bg-brand-tint text-brand-ink" : "border-line-strong text-ink-muted"}`}>
              {t.label} · {counts[t.id] || 0}
            </button>
          ))}
        </div>
        {error ? <p className="text-sm text-rose-700">{error}</p> : loading ? (
          <p className="py-8 text-center text-sm text-ink-subtle">Loading consultations…</p>
        ) : shown.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nothing here" description={tab === "requested" ? "No requests are waiting. New bookings appear here." : "No consultations in this list."} />
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start gap-4 py-4" data-admin-consult={c.status}>
                <div className="min-w-0 flex-1 basis-[320px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{c.member_name || "A member"}</p>
                    <Badge tone={TONE[c.status]}>{TABS.find((t) => t.id === c.status)?.label}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-muted">{c.doctor_name} · {c.speciality} · {c.mode} · <b>{whenLabel(c.start)}</b></p>
                  <p className="mt-1 text-sm text-ink">About: {c.reason}{c.symptoms.length ? ` · ${c.symptoms.join(", ")}` : ""}</p>
                  <p className="mt-0.5 text-xs text-ink-subtle">Fee {feeLabel(c.fee_minor)}{c.fee_minor ? " (paid to the doctor)" : ""} · booked {whenLabel(c.created_at, { day: "numeric", month: "short" })}</p>
                  {c.join_info && <p className="mt-1 text-xs text-emerald-700">How to join: {c.join_info}</p>}
                  {c.prescription && <p className="mt-1 line-clamp-2 text-xs text-sky-700"><FileText className="mr-1 inline h-3.5 w-3.5" />{c.prescription}</p>}
                  {c.cancel_reason && <p className="mt-1 text-xs text-ink-subtle">Cancelled by {c.cancelled_by === "staff" ? "us" : "her"}: {c.cancel_reason}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {c.status === "requested" && <button className="btn btn-primary btn-sm" onClick={() => open("confirm", c)}>Confirm</button>}
                  {(c.status === "requested" || c.status === "confirmed") && <button className="btn btn-outline btn-sm" onClick={() => open("complete", c)}>Complete</button>}
                  {(c.status === "requested" || c.status === "confirmed") && <button className="btn btn-ghost btn-sm" onClick={() => open("cancel", c)}>Cancel</button>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!act} onClose={() => setAct(null)} icon={act?.kind === "complete" ? FileText : act?.kind === "cancel" ? XCircle : CalendarCheck}
             iconTone={act?.kind === "cancel" ? "rose" : "brand"}
             title={act ? { confirm: "Confirm consultation", complete: "Complete with prescription", cancel: "Cancel consultation" }[act.kind] : ""}
             description={act ? `${act.c.member_name || "Member"} · ${act.c.doctor_name} · ${whenLabel(act.c.start)}` : ""}
             footer={<>
               <button className="btn btn-outline" onClick={() => setAct(null)}>Back</button>
               <button className={`btn ${act?.kind === "cancel" ? "btn-danger" : "btn-primary"}`} disabled={busy} onClick={submit}>
                 {busy ? "Saving…" : act?.kind === "confirm" ? "Confirm and tell her" : act?.kind === "complete" ? "Save prescription" : "Cancel consultation"}
               </button>
             </>}>
        {act?.kind === "confirm" && (
          <Input label="How to join" value={text} onChange={(e) => setText(e.target.value)}
                 placeholder={act.c.mode === "Video" ? "Video link the doctor will use" : act.c.mode === "Phone" ? "The doctor will call your registered number" : "Clinic address and room"}
                 hint="She sees this in My consultations and in her notification." />
        )}
        {act?.kind === "complete" && (
          <div className="space-y-4">
            <Textarea label="Prescription, as the doctor wrote it" rows={6} value={text} onChange={(e) => setText(e.target.value)}
                      placeholder={"Medicine — dose — when — how many days\nAdvice\nFollow-up"} hint="Copy it exactly. WomSakhi never changes a dose." />
            <ImageUpload label="Prescription file (optional)" kind="attachment" value={file} onChange={setFile} hint="A photo or scan of the signed prescription." />
          </div>
        )}
        {act?.kind === "cancel" && (
          <Textarea label="Reason (she will see this)" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="The doctor is unavailable that day. Please book another time." />
        )}
      </Modal>
    </div>
  );
}
