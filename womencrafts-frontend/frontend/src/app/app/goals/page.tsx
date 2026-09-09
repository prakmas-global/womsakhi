"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, Field, I, Pill, SectionHead, TextInput, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { GOALS, goalPct, type Goal } from "@/components/ux/discovery/data";
import { useToast } from "@/design-system";
import { useT } from "@/i18n";

/**
 * My Goals — hers, in her words.
 *
 * ── The failure mode this is designed against ───────────────────────────────
 * A goal feature usually becomes a guilt machine: a list of things she said she
 * would do and did not, going red as dates pass. For a woman whose time is not
 * fully her own, that is not motivating — it is one more thing telling her she
 * is behind.
 *
 * So: **nothing here ever turns red, and nothing is ever overdue.** A goal that
 * has stalled is paused, not failed. "Before Diwali" and "No rush" are valid
 * dates, because they are how the deadline actually exists in her head.
 *
 * ── Why every goal carries a "why" ──────────────────────────────────────────
 * "Buy a machine" is a purchase. "So I stop paying rent on someone else's" is a
 * reason, and it is what she will still recognise in four months when the
 * saving is dull. The field is required by the form for that reason.
 *
 * ── Full CRUD, because this is where CRUD actually belongs ──────────────────
 * Create, edit, pause, resume, complete and delete — each with confirmation and
 * a success state. Deleting asks once, because a goal represents months of
 * saving and a mis-tap should not erase it.
 */
export default function GoalsPage() {
  const tr = useT();
  const [goals, setGoals] = useState<Goal[]>(GOALS);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const toast = useToast();

  const live = useMemo(() => goals.filter((g) => g.state === "on"), [goals]);
  const paused = useMemo(() => goals.filter((g) => g.state === "paused"), [goals]);
  const done = useMemo(() => goals.filter((g) => g.state === "done"), [goals]);

  const say = useCallback((m: string) => toast.success(m), [toast]);

  const setState = useCallback((id: string, s: Goal["state"], msg: string) => {
    setGoals((r) => r.map((g) => (g.id === id ? { ...g, state: s } : g)));
    say(msg);
  }, [say]);

  const remove = useCallback((id: string) => {
    const g = goals.find((x) => x.id === id);
    setGoals((r) => r.filter((x) => x.id !== id));
    setConfirmDelete(null);
    say(`"${g?.title}" removed. Nothing you saved towards it was touched.`);
  }, [goals, say]);

  const save = useCallback((g: Goal) => {
    setGoals((r) => (r.some((x) => x.id === g.id) ? r.map((x) => (x.id === g.id ? g : x)) : [g, ...r]));
    say(r_msg(goals, g));
    setEditing(null); setCreating(false);
  }, [goals, say]);

  return (
    <HomeShell active="/app/goals">
      <div className="flex flex-col gap-5">

        <header className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("goals.myGoals")}</p>
            <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
                style={{ color: v("--ux-ink") }}>{tr("goals.whatYouAreWorkingTowards")}</h1>
            <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
              In your words, on your timing. Nothing here goes red, nothing is ever late, and you can
              put any of it down without explaining.
            </p>
          </div>
          <Btn icon="Plus" onClick={() => { setCreating(true); setEditing(null); }}>{tr("goals.addAGoal")}</Btn>
        </header>

        {(creating || editing) && (
          <GoalForm goal={editing} onCancel={() => { setCreating(false); setEditing(null); }} onSave={save} />
        )}

        {goals.length === 0 && !creating ? (
          <Card>
            <EmptyState icon="Target" title={tr("goals.noGoalsYet")}
                        body="A goal is just the thing you are saving or working towards, written down — a machine, a month's fees, a skill. Writing it down is what makes the app able to help."
                        action={<Btn size="sm" onClick={() => setCreating(true)}>{tr("goals.addYourFirstGoal")}</Btn>} />
          </Card>
        ) : (
          <>
            {live.length > 0 && (
              <div>
                <SectionHead title={tr("goals.workingOn")} icon="Target" chip={String(live.length)} />
                <div className="flex flex-col gap-3">
                  {live.map((g) => (
                    <GoalRow key={g.id} g={g}
                             onEdit={() => { setEditing(g); setCreating(false); }}
                             onPause={() => setState(g.id, "paused", `"${g.title}" put aside. It is still here when you want it.`)}
                             onDone={() => setState(g.id, "done", `"${g.title}" done. That is a real thing you did.`)}
                             onDelete={() => setConfirmDelete(g.id)} />
                  ))}
                </div>
              </div>
            )}

            {paused.length > 0 && (
              <div>
                <SectionHead title={tr("goals.putAsideForNow")} sub={tr("goals.notFailedJustNotNow")} icon="PauseCircle" />
                <div className="flex flex-col gap-3">
                  {paused.map((g) => (
                    <GoalRow key={g.id} g={g}
                             onEdit={() => setEditing(g)}
                             onResume={() => setState(g.id, "on", `"${g.title}" picked back up.`)}
                             onDelete={() => setConfirmDelete(g.id)} />
                  ))}
                </div>
              </div>
            )}

            {done.length > 0 && (
              <div>
                <SectionHead title="Done" icon="CheckCheck" chip={String(done.length)} />
                <div className="flex flex-col gap-3">
                  {done.map((g) => <GoalRow key={g.id} g={g} onDelete={() => setConfirmDelete(g.id)} />)}
                </div>
              </div>
            )}
          </>
        )}

        {/* Confirmation — a goal can be months of saving, so it asks once. */}
        {confirmDelete && (
          <Card pad={20} style={{ borderColor: v("--ux-danger-solid") }}>
            <p className="text-smd font-bold" style={{ color: v("--ux-ink") }}>
              Remove &ldquo;{goals.find((g) => g.id === confirmDelete)?.title}&rdquo;?
            </p>
            <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>
              The goal goes. Any money you actually saved stays exactly where it is — this only
              removes the note about what it was for.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Btn size="sm" onClick={() => remove(confirmDelete)}>{tr("goals.yesRemoveIt")}</Btn>
              <Btn size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>{tr("goals.keepIt")}</Btn>
            </div>
          </Card>
        )}
      </div>
    </HomeShell>
  );
}

const r_msg = (existing: Goal[], g: Goal) =>
  existing.some((x) => x.id === g.id) ? `"${g.title}" updated.` : `"${g.title}" added. It will show on your journey.`;

function GoalRow({ g, onEdit, onPause, onResume, onDone, onDelete }: {
  g: Goal; onEdit?: () => void; onPause?: () => void; onResume?: () => void;
  onDone?: () => void; onDelete: () => void;
}) {
  const tr = useT();
  const pct = goalPct(g);
  return (
    <Card pad={0} style={{ overflow: "hidden", opacity: g.state === "paused" ? 0.72 : 1 }}>
      <div className="flex flex-wrap items-start gap-4 p-5">
        <span className="grid h-[2.75rem] w-[2.75rem] shrink-0 place-items-center rounded-[12px]"
              style={{ background: v(g.tint), color: v(g.ink) }}>
          <I name={g.icon} className="h-[1.25rem] w-[1.25rem]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{g.title}</p>
            {g.state === "done" && <Pill tone="green" size="sm">Done</Pill>}
            {g.state === "paused" && <Pill tone="neutral" size="sm">{tr("goals.putAside")}</Pill>}
          </div>
          <p className="mt-0.5 text-xsm italic" style={{ color: v("--ux-muted") }}>{g.why}</p>

          {g.targetMinor !== null && (
            <>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="text-sm font-bold tabular-nums" style={{ color: v("--ux-ink") }}>
                  {formatRupees(g.haveMinor)}
                  <span className="font-normal" style={{ color: v("--ux-muted") }}> of {formatRupees(g.targetMinor)}</span>
                </p>
                <p className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>{g.by}</p>
              </div>
              <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full" style={{ background: v("--ux-line") }}>
                <div className="h-full rounded-full"
                     style={{ width: `${pct}%`, background: v(g.ink), transition: "width var(--ux-t-slow) var(--ux-ease)" }} />
              </div>
            </>
          )}
          {g.targetMinor === null && (
            <p className="mt-2 text-xs font-semibold" style={{ color: v("--ux-muted") }}>{g.by}</p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t px-5 py-3.5" style={{ borderColor: v("--ux-line") }}>
        {g.state !== "done" && <Btn size="sm" href={g.nextHref} icon="ArrowRight">{g.nextLabel}</Btn>}
        {onEdit && <Btn size="sm" variant="ghost" icon="Pencil" onClick={onEdit}>Edit</Btn>}
        {onDone && <Btn size="sm" variant="ghost" icon="Check" onClick={onDone}>Done</Btn>}
        {onPause && <Btn size="sm" variant="ghost" icon="PauseCircle" onClick={onPause}>{tr("goals.putAside2")}</Btn>}
        {onResume && <Btn size="sm" variant="outline" icon="PlayCircle" onClick={onResume}>{tr("goals.pickItBackUp")}</Btn>}
        <Btn size="sm" variant="ghost" icon="Trash2" onClick={onDelete} ariaLabel={`Remove ${g.title}`}>Remove</Btn>
      </div>
    </Card>
  );
}

/** Create and edit. Real labels, validation that explains, no placeholder-as-label. */
function GoalForm({ goal, onCancel, onSave }: {
  goal: Goal | null; onCancel: () => void; onSave: (g: Goal) => void;
}) {
  const tr = useT();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [why, setWhy] = useState(goal?.why ?? "");
  const [amount, setAmount] = useState(goal?.targetMinor ? String(goal.targetMinor / 100) : "");
  const [by, setBy] = useState(goal?.by ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const submit = useCallback(() => {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Give it a name — anything you would call it yourself.";
    if (!why.trim()) e.why = "Write why it matters. In four months this is what you will recognise.";
    setErrors(e);
    if (Object.keys(e).length) return;

    setSaving(true);
    // Returned, not fired and forgotten. `Btn` holds itself busy until a
    // returned promise settles, which is what stops three taps on a slow phone
    // from creating three goals — `setSaving(true)` alone cannot, because all
    // three clicks land before React re-renders.
    return new Promise<void>((resolve) => setTimeout(() => {
      const n = Number(amount.replace(/[^0-9]/g, ""));
      onSave({
        id: goal?.id ?? `g${Date.now()}`,
        title: title.trim(), why: why.trim(),
        targetMinor: n ? n * 100 : null,
        haveMinor: goal?.haveMinor ?? 0,
        by: by.trim() || "No rush",
        nextHref: goal?.nextHref ?? "/app/circles",
        nextLabel: goal?.nextLabel ?? "See your pot",
        icon: goal?.icon ?? "Target",
        tint: goal?.tint ?? "--ux-tint-violet",
        ink: goal?.ink ?? "--ux-violet",
        state: goal?.state ?? "on",
      });
      setSaving(false);
      resolve();
    }, 400));
  }, [title, why, amount, by, goal, onSave]);

  return (
    <Card pad={20} style={{ borderColor: v("--ux-brand") }}>
      <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>
        {goal ? tr("goals.editThisGoal")
              : tr("goals.whatAreYouWorkingTowards")}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <Field label={tr("goals.whatIsIt")} error={errors.title} hint={tr("goals.howeverYouWouldSayItOut")}>
          {(p) => <TextInput {...p} value={title} onChange={setTitle} invalid={!!errors.title} />}
        </Field>

        <Field label={tr("goals.whyItMatters")} error={errors.why} hint={tr("goals.theReasonYouWillStillRecognise")}>
          {(p) => <TextInput {...p} value={why} onChange={setWhy} invalid={!!errors.why} />}
        </Field>

        <div className="flex flex-wrap gap-4">
          <div className="min-w-[140px] flex-1">
            <Field label={tr("goals.howMuchIfItNeedsMoney")} required={false} hint={tr("goals.leaveEmptyIfItDoesNot")}>
              {(p) => <TextInput {...p} value={amount} onChange={setAmount} inputMode="numeric" />}
            </Field>
          </div>
          <div className="min-w-[140px] flex-1">
            <Field label={tr("goals.byWhen")} required={false} hint='"Before Diwali" and "No rush" are fine'>
              {(p) => <TextInput {...p} value={by} onChange={setBy} />}
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Btn onClick={submit} disabled={saving} icon={saving ? "Loader" : "Check"}>
          {saving ? "Saving…" : goal ? tr("goals.saveChanges")
              : tr("goals.addThisGoal")}
        </Btn>
        <Btn variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Btn>
      </div>
    </Card>
  );
}

