"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  GOAL_KINDS, goalState, useMyGoals,
  type Goal, type GoalState,
} from "@/components/ux/discovery/data";
import { apiAddGoal, apiDropGoal, apiMoveGoal } from "@/lib/money-api";
import {
  DisciplineCard, GoalCard, GoalInsights, GoalStats, GoalsHero,
  QuickActions,
  type QuickAction,
} from "./goal-views";

/**
 * My goals.
 *
 * ── A goal here can never make her feel late ────────────────────────────────
 * The failure mode of every goal feature is a list of things a woman said she
 * would do and did not. So nothing on this screen turns red, nothing says
 * "overdue", and there is no "needs attention" any more — it was computed from
 * a target date the fixture invented, so the screen was telling her she was
 * behind on a deadline she had never set.
 *
 * ── What this screen used to be ─────────────────────────────────────────────
 * Five goals written in the first person — "Buy my own machine", "So I stop
 * paying rent on someone else's", "We have not all been together at her house
 * in three years" — under a heading reading *My goals*, shown to every woman
 * on the platform as though she had typed them. Its own docstring said "there
 * is no goals endpoint", and marking one done was `setGoals` on local state
 * that vanished on reload.
 *
 * There has been a goals endpoint since August. `/me/goals` reads them,
 * `PATCH /me/goals/{id}` moves one and `DELETE` removes one — none of the
 * three had a single caller in the app. They do now.
 *
 * ── One function, read everywhere ───────────────────────────────────────────
 * The four figures, the chips, the ring in the rail and the badge on each card
 * all call `goalState`, so they cannot disagree about how many have moved.
 * The percentage itself is never recomputed here: the server scores a goal — a
 * money goal counts her wallet credits, a learning goal the sessions she
 * attended — and a figure recalculated on this side that disagrees with the
 * screen that produced it is how a woman stops believing both.
 */

const ALL = "All goals";

/** Only a goal she moves herself can be marked by hand. See GoalCard. */
const manual = (g: Goal) => g.manual || g.kind === "count";

export default function GoalsPage() {
  const goals = useMyGoals();
  const [kind, setKind] = useState(ALL);
  const [status, setStatus] = useState<"all" | GoalState>("all");
  const [menu, setMenu] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 3400);
  }, []);

  const rows = goals.data;

  /** Everything on the screen counts from here, so nothing can disagree. */
  const by = useMemo(() => {
    const t: Record<GoalState, number> = { reached: 0, moving: 0, "not-started": 0 };
    for (const g of rows) t[goalState(g)] += 1;
    return t;
  }, [rows]);

  const chips = useMemo(() => [
    { label: ALL, n: rows.length },
    ...GOAL_KINDS.map((k) => ({ label: k.label, n: rows.filter((g) => g.kind === k.id).length })),
  ], [rows]);

  const shown = useMemo(() => {
    const stateRows = status === "all" ? rows : rows.filter((g) => goalState(g) === status);
    if (kind === ALL) return stateRows;
    const k = GOAL_KINDS.find((x) => x.label === kind);
    return k ? stateRows.filter((g) => g.kind === k.id) : stateRows;
  }, [rows, kind, status]);

  /** The ring: how far along all of them are together, not how many are done. */
  const overall = useMemo(() => rows.length === 0 ? 0
    : Math.round(rows.reduce((n, g) => n + g.pct, 0) / rows.length), [rows]);

  /*
    Every write goes to the server and then re-reads. The endpoints return the
    whole updated list, but this screen refetches rather than trusting the
    reply: the server is what scores a goal, and a locally patched row would be
    the one figure on the page that came from somewhere else.
  */
  const write = useCallback(async (job: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await job();
      goals.refetch();
      say(ok);
    } catch {
      say("That did not save. Your connection may have dropped — try once more.");
    } finally {
      setBusy(false);
    }
  }, [goals, say]);

  const markReached = useCallback((g: Goal) => {
    void write(() => apiMoveGoal(g.id, g.reached ? 0 : g.target),
               g.reached ? `"${g.label}" is open again` : `"${g.label}" is marked reached`);
  }, [write]);

  const remove = useCallback((g: Goal) => {
    void write(() => apiDropGoal(g.id), `"${g.label}" is removed`);
  }, [write]);

  const actions: QuickAction[] = useMemo(() => [
    { id: "add", label: "Write a new goal", icon: "Plus", onClick: () => setAdding(true) },
    { id: "journey", label: "See my journey", icon: "Sparkles",
      onClick: () => { window.location.href = "/app/journey"; } },
    { id: "money", label: "Where my money goes", icon: "TrendingUp",
      onClick: () => { window.location.href = "/app/wallet"; } },
  ], []);

  const rail = (
    <div className="space-y-4">
      <Btn full icon="Plus" onClick={() => setAdding(true)}>Add a goal</Btn>
      <GoalInsights pct={overall} onTrack={by.moving + by.reached} total={rows.length} by={by} />
      <QuickActions rows={actions} />
      <DisciplineCard />
    </div>
  );

  return (
    <HomeShell active="/app/goals" rail={rail} loadFailed="your goals">
      <div className="flex flex-col">
        <GoalsHero chips={chips} active={kind} onPick={setKind} />

        <GoalStats total={rows.length} by={by} active={status} onPick={setStatus} />

        {adding && (
          <AddGoal
            busy={busy}
            onCancel={() => setAdding(false)}
            onSave={(body) => {
              void write(() => apiAddGoal(body), `"${body.label}" is written down`);
              setAdding(false);
            }}
          />
        )}

        {goals.source === "loading" ? (
          <Card><EmptyState icon="Target" title="Reading your goals…" body="" /></Card>
        ) : goals.error ? (
          <Card>
            <EmptyState icon="CloudOff" title="We could not load your goals"
                        body="Nothing has been lost — the list is on the server and this screen could not reach it."
                        action={<Btn size="sm" onClick={goals.refetch}>Try again</Btn>} />
          </Card>
        ) : shown.length > 0 ? (
          shown.map((g) => (
            <GoalCard key={g.id} g={g} money={formatRupees} busy={busy}
                      menu={menu === g.id} onMenu={(open) => setMenu(open ? g.id : null)}
                      onDone={manual(g) ? markReached : undefined}
                      onArchive={remove} />
          ))
        ) : (
          <Card>
            <EmptyState
              icon="Target"
              title={kind === ALL ? "No goals yet" : `Nothing under ${kind.toLowerCase()} yet`}
              body={kind === ALL
                ? "A goal is just the thing you are working towards, written down. It can be small, and you can put it down whenever you like."
                : "Your goals under the other headings are still there — press All goals to see them."}
              action={kind === ALL
                ? <Btn size="sm" icon="Plus" onClick={() => setAdding(true)}>Add a goal</Btn>
                : <Btn size="sm" onClick={() => setKind(ALL)}>See all goals</Btn>}
            />
          </Card>
        )}

        {/* The screen's primary action. On desktop it heads the rail; the rail
            is not drawn on a phone, so it sits here — full width, at the foot
            of the list, where a thumb reaches. Same handler as the rail's. */}
        {!adding && goals.source !== "loading" && !goals.error && shown.length > 0 && (
          <div className="mt-3 lg:hidden">
            <Btn full icon="Plus" className="ux-action-primary" onClick={() => setAdding(true)}>Add a goal</Btn>
          </div>
        )}

        <div className="ux-toast rounded-[12px] px-5 py-3.5 text-xsm font-bold"
             data-on={note ? "true" : "false"} role="status" aria-live="polite"
             style={{ background: v("--ux-ink"), color: v("--ux-canvas"),
                      boxShadow: "0 20px 44px -18px rgba(0,0,0,.6)",
                      pointerEvents: note ? undefined : "none" }}>
          {note}
        </div>
      </div>
    </HomeShell>
  );
}

/**
 * Writing one down.
 *
 * Four fields, because that is what `POST /me/goals` takes. `by` is free text
 * on purpose — "before Diwali" and "when the school term starts" are how the
 * deadline is actually held in her head, and a date picker would turn it into
 * something this screen could later tell her she had missed.
 *
 * A money target is typed in RUPEES and sent in paise. That conversion is the
 * one place on this screen it happens, and it is the reason the field says ₹.
 */
function AddGoal({ busy, onCancel, onSave }: {
  busy: boolean;
  onCancel: () => void;
  onSave: (body: { label: string; kind: Goal["kind"]; target: number; by: string; unit?: string }) => void;
}) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<Goal["kind"]>("money");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [by, setBy] = useState("");

  const n = Number(target.replace(/[^\d.]/g, ""));
  const ready = label.trim().length > 1 && Number.isFinite(n) && n > 0;

  const field = "w-full rounded-[12px] px-3.5 py-3 text-smd";
  const fieldStyle = {
    background: v("--ux-surface-2"), color: v("--ux-ink"),
    border: "1px solid var(--ux-line)",
  } as const;

  return (
    <Card className="mb-3.5" pad={18}>
      <h2 className="text-base font-extrabold" style={{ color: v("--ux-ink") }}>
        Write down a goal
      </h2>

      <div className="mt-3.5 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>
            What are you working towards?
          </span>
          <input className={field} style={fieldStyle} value={label} maxLength={80}
                 onChange={(e) => setLabel(e.target.value)}
                 placeholder="Say it in your own words" />
        </label>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-xs font-bold" style={{ color: v("--ux-ink-2") }}>
            What kind of goal is it?
          </legend>
          <div className="flex flex-wrap gap-2">
            {GOAL_KINDS.map((k) => (
              <button key={k.id} type="button" onClick={() => setKind(k.id)}
                      aria-pressed={kind === k.id}
                      className="ux-press ux-sq min-h-[44px] rounded-full px-4 text-xsm font-bold"
                      style={{
                        background: v(kind === k.id ? "--ux-fill" : "--ux-surface-2"),
                        color: v(kind === k.id ? "--ux-on-brand" : "--ux-ink"),
                        border: "1px solid var(--ux-line)",
                      }}>
                {k.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex flex-wrap gap-3">
          <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
            <span className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>
              {kind === "money" ? "How much, in ₹" : "How many"}
            </span>
            <input className={field} style={fieldStyle} value={target} inputMode="numeric"
                   onChange={(e) => setTarget(e.target.value)} placeholder="0" />
          </label>

          {kind === "count" && (
            <label className="flex min-w-[9rem] flex-1 flex-col gap-1.5">
              <span className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>
                How many what?
              </span>
              <input className={field} style={fieldStyle} value={unit} maxLength={24}
                     onChange={(e) => setUnit(e.target.value)} placeholder="clients, sarees, weeks" />
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold" style={{ color: v("--ux-ink-2") }}>
            By when? Your own words are fine.
          </span>
          <input className={field} style={fieldStyle} value={by} maxLength={40}
                 onChange={(e) => setBy(e.target.value)} placeholder="before Diwali" />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Btn icon="Check" disabled={!ready || busy}
             onClick={() => onSave({
               label: label.trim(),
               kind,
               // Rupees in, paise out — the one conversion on this screen.
               target: kind === "money" ? Math.round(n * 100) : Math.round(n),
               by: by.trim(),
               ...(kind === "count" && unit.trim() ? { unit: unit.trim() } : {}),
             })}>
          Save it
        </Btn>
        <Btn variant="ghost" onClick={onCancel}>Not now</Btn>
      </div>
    </Card>
  );
}
