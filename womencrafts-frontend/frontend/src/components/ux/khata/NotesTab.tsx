"use client";

import { useCallback, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, EmptyState, v } from "@/components/ux/kit";
import { Label, Toggle } from "@/components/ux/kit/form";
import { Sheet } from "@/components/ux/kit/sheet";
import { toast } from "@/components/ux/mobile/Toast";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { apiErrorMessage } from "@/lib/api";
import {
  NOTE_COLOURS, apiKhataAddNote, apiKhataDeleteNote, apiKhataEditNote, apiKhataNotes,
  type KhataNote, type NoteColour,
} from "@/lib/khata-api";
import { useResource } from "@/lib/use-resource";
import { Amount, useKhata } from "./KhataGate";
import { addDays, dayName, isoDay, toMinor } from "./days";

/**
 * Notes — the scraps of paper on the fridge: what to buy, whom to call, what
 * someone owes. A grid of coloured notes, pinned ones first. A note can carry
 * an amount and a day to be reminded on, both by tap.
 *
 * The colours are soft pastels mixed into the surface, so they stay readable
 * in dark mode and never compete with the brand on the buttons.
 */

// The tints are tokens (`--khata-note-*` in tokens.css) so dark mode can mix
// less of the pastel in — at the light-mode share yellow turns olive.
const TINT: Record<NoteColour, string> = {
  plain: "var(--ux-surface)",
  pink: "var(--khata-note-pink)",
  yellow: "var(--khata-note-yellow)",
  green: "var(--khata-note-green)",
  blue: "var(--khata-note-blue)",
  violet: "var(--khata-note-violet)",
};
const DOT: Record<NoteColour, string> = {
  plain: "var(--ux-line-strong)", pink: "#f472b6", yellow: "#facc15", green: "#34d399", blue: "#60a5fa", violet: "#a78bfa",
};

export function NotesTab() {
  const { locked } = useKhata();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<KhataNote | "new" | null>(null);
  // All of them once (500 at most), filtered here — no request per keystroke.
  const notes = useResource(
    useCallback((s: AbortSignal) => apiKhataNotes("", s).catch((e) => { locked(e); throw e; }), [locked]),
    [] as KhataNote[],
  );
  const needle = q.trim().toLowerCase();
  const shown = needle ? notes.data.filter((n) => n.text.toLowerCase().includes(needle)) : notes.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <label className="relative min-w-0 flex-1">
          <Icons.Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: v("--ux-muted") }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a note" aria-label="Find a note"
                 className="ux-sq min-h-[46px] w-full rounded-full border ps-10 pe-4 text-xsm outline-none"
                 style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
        </label>
        <Btn icon="Plus" onClick={() => setEditing("new")}>New note</Btn>
      </div>

      {notes.source === "error" ? (
        <Card><p role="alert">Your notes could not load. Your saved notes have not changed.</p><div className="mt-3"><Btn onClick={notes.refetch} variant="outline">Try again</Btn></div></Card>
      ) : notes.source === "loading" && !notes.data.length ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[0, 1, 2].map((i) => <span key={i} className="ux-skeleton h-[140px] rounded-[18px]" />)}</div>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState icon="NotebookPen" title={q ? "No note has those words" : "No notes yet"}
                      body={q ? "Try another word." : "Write down what you must not forget — what to buy, whom to call, who owes you."}
                      action={!q ? <Btn icon="Plus" onClick={() => setEditing("new")}>Write your first note</Btn> : undefined} />
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((n, i) => (
            <button key={n.id} type="button" onClick={() => setEditing(n)}
                    className="ux-press ux-rise relative flex min-h-[132px] flex-col gap-2 rounded-[18px] border p-3.5 text-start"
                    style={{ ["--i" as string]: Math.min(i, 10), background: TINT[n.colour] ?? TINT.plain,
                             borderColor: `color-mix(in oklab, ${DOT[n.colour] ?? DOT.plain} 35%, var(--ux-line))` }}>
              {n.pinned && <Icons.Pin className="absolute end-3 top-3 h-4 w-4 rotate-45" style={{ color: v("--ux-brand") }} aria-label="Pinned" />}
              <p className="line-clamp-5 whitespace-pre-line pe-4 text-xsm leading-snug" style={{ color: v("--ux-ink") }}>{n.text}</p>
              <span className="mt-auto flex flex-wrap items-center gap-1.5">
                {n.amount_minor != null && (
                  <span className="rounded-full px-2 py-0.5 text-2xs font-bold" style={{ background: v("--ux-surface"), color: v("--ux-ink") }}>
                    <Amount minor={n.amount_minor} />
                  </span>
                )}
                {n.remind_on && (
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-semibold"
                        style={{ background: v("--ux-surface"), color: n.remind_on <= isoDay() ? v("--ux-brand") : v("--ux-ink-2") }}>
                    <Icons.Bell className="h-3 w-3" /> {dayName(n.remind_on)}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}

      {editing && (
        <NoteSheet note={editing === "new" ? null : editing} onClose={() => setEditing(null)}
                   onSaved={() => { setEditing(null); notes.refetch(); }} />
      )}
    </div>
  );
}

const REMIND = [
  { label: "Today", day: () => isoDay() },
  { label: "Tomorrow", day: () => addDays(1) },
  { label: "Next week", day: () => addDays(7) },
];

function NoteSheet({ note, onClose, onSaved }: { note: KhataNote | null; onClose: () => void; onSaved: () => void }) {
  const { locked } = useKhata();
  const confirm = useConfirm();
  const [text, setText] = useState(note?.text ?? "");
  const [colour, setColour] = useState<NoteColour>(note?.colour ?? "yellow");
  const [pinned, setPinned] = useState(note?.pinned ?? false);
  const [amount, setAmount] = useState(note?.amount_minor != null ? String(note.amount_minor / 100) : "");
  const [remind, setRemind] = useState(note?.remind_on ?? "");
  const [busy, setBusy] = useState(false);

  const fail = (e: unknown) => { if (!locked(e)) toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" }); };

  const save = async () => {
    setBusy(true);
    const minor = amount.trim() ? toMinor(amount) : null;
    try {
      if (note) {
        await apiKhataEditNote(note.id, {
          text: text.trim(), colour, pinned,
          ...(minor != null ? { amount_minor: minor } : { clear_amount: true }),
          ...(remind ? { remind_on: remind } : { clear_reminder: true }),
        });
      } else {
        await apiKhataAddNote({ text: text.trim(), colour, pinned, amount_minor: minor, remind_on: remind || null });
      }
      toast(note ? "Note saved" : "Note added", { tone: "success" });
      onSaved();
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!note) return;
    const sure = await confirm({ title: "Remove this note?", description: "It cannot be brought back.", confirmLabel: "Remove", cancelLabel: "Keep it" });
    if (!sure) return;
    try { await apiKhataDeleteNote(note.id); toast("Note removed", { tone: "success" }); onSaved(); } catch (e) { fail(e); }
  };

  return (
    <Sheet open onClose={onClose} title={note ? "Your note" : "New note"} icon="NotebookPen" width={520}
           footer={
             <div className="flex items-center gap-2">
               {note && <Btn variant="ghost" icon="Trash2" onClick={() => void remove()}>Remove</Btn>}
               <span className="flex-1" />
               <Btn variant="primary" icon="Check" loading={busy} disabled={!text.trim()} onClick={() => void save()}>Save</Btn>
             </div>
           }>
      <div className="flex flex-col gap-4">
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} rows={6} autoFocus={!note}
                  aria-label="Your note" placeholder="Buy school shoes · Call Sunita about the chit · Rent due on the 5th"
                  className="ux-sq w-full resize-none rounded-[16px] border p-4 text-sm leading-relaxed outline-none"
                  style={{ borderColor: v("--ux-line"), background: TINT[colour], color: v("--ux-ink") }} />
        <div>
          <Label>Colour</Label>
          <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Colour">
            {NOTE_COLOURS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={colour === c} aria-label={c} onClick={() => setColour(c)}
                      className="ux-press grid h-10 w-10 place-items-center rounded-full border-2"
                      style={{ background: TINT[c], borderColor: colour === c ? v("--ux-brand") : DOT[c] }}>
                {colour === c && <Icons.Check className="h-4 w-4" style={{ color: v("--ux-brand") }} />}
              </button>
            ))}
          </div>
        </div>
        <Toggle on={pinned} onChange={setPinned} label="Pin it to the top" sub="Pinned notes stay first." />
        <div>
          <Label hint="optional">Amount</Label>
          <span className="relative block max-w-[220px]">
            <span className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-sm font-bold" style={{ color: v("--ux-muted") }}>₹</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" aria-label="Amount in rupees"
                   placeholder="0" className="ux-sq min-h-[46px] w-full rounded-[12px] border ps-8 pe-4 text-sm font-semibold outline-none"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
          </span>
        </div>
        <div>
          <Label hint="optional">Remind me</Label>
          <div className="flex flex-wrap items-center gap-2">
            {REMIND.map((r) => {
              const on = remind === r.day();
              return (
                <button key={r.label} type="button" aria-pressed={on} onClick={() => setRemind(on ? "" : r.day())}
                        className="ux-press inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold"
                        style={{ borderColor: on ? v("--ux-brand") : v("--ux-line"), background: on ? v("--ux-brand-tint") : v("--ux-surface"),
                                 color: on ? v("--ux-brand") : v("--ux-ink-2") }}>
                  <Icons.Bell className="h-3.5 w-3.5" /> {r.label}
                </button>
              );
            })}
            <input type="date" value={remind} min={isoDay()} onChange={(e) => setRemind(e.target.value)} aria-label="Pick a day"
                   className="ux-sq min-h-[40px] rounded-full border px-3 text-xs outline-none"
                   style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink") }} />
            {remind && (
              <button type="button" onClick={() => setRemind("")} className="text-xs font-semibold underline" style={{ color: v("--ux-muted") }}>
                No reminder
              </button>
            )}
          </div>
        </div>
      </div>
    </Sheet>
  );
}
