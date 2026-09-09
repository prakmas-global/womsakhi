"use client";

import { useCallback, useMemo, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import {
  GOALS, GOAL_KINDS, goalPct, goalStatus,
  type Goal, type GoalStatus,
} from "@/components/ux/discovery/data";
import {
  DisciplineCard, GoalCard, GoalInsights, GoalStats, GoalsHero,
  QuickActions, StaircaseNote,
  type QuickAction,
} from "./goal-views";

/**
 * My goals.
 *
 * ── A goal here can never make her feel late ────────────────────────────────
 * The failure mode of every goal feature is a list of things a woman said she
 * would do and did not. So nothing on this screen turns red, nothing says
 * "overdue", and "needs attention" is amber and means one of two facts: the
 * date has arrived, or nothing has moved yet. Neither is a claim about her.
 *
 * ── One function, read twice ────────────────────────────────────────────────
 * The four figures, the chips, the ring in the rail and the badge on each card
 * all call `goalStatus`. They cannot disagree about how many are on track,
 * which is the way that kind of screen usually goes wrong.
 *
 * ── Held in this screen, not on a server ────────────────────────────────────
 * There is no goals endpoint. Marking one done or archiving it changes what
 * she sees now and is gone on reload — and the screen says so rather than
 * letting her believe it was written down.
 */

const ALL = "All goals";

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>(GOALS);
  const [kind, setKind] = useState(ALL);
  const [menu, setMenu] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const say = useCallback((msg: string) => {
    setNote(msg);
    window.setTimeout(() => setNote((n) => (n === msg ? null : n)), 3400);
  }, []);

  /** Everything on the screen counts from here, so nothing can disagree. */
  const by = useMemo(() => {
    const t: Record<GoalStatus, number> = {
      "on-track": 0, "needs-attention": 0, completed: 0, "not-started": 0,
    };
    for (const g of goals) t[goalStatus(g)] += 1;
    return t;
  }, [goals]);

  const chips = useMemo(() => [
    { label: ALL, n: goals.length },
    ...GOAL_KINDS.map((k) => ({ label: k, n: goals.filter((g) => g.kind === k).length })),
  ], [goals]);

  const shown = useMemo(
    () => (kind === ALL ? goals : goals.filter((g) => g.kind === kind)), [goals, kind]);

  /** The ring: how far along all of them are together, not how many are done. */
  const overall = useMemo(() => goals.length === 0 ? 0
    : Math.round(goals.reduce((n, g) => n + goalPct(g), 0) / goals.length), [goals]);

  const soon = useCallback((what: string) =>
    say(`${what} is on the way. Goals live only on this screen for now — nothing here is saved yet.`), [say]);

  const markDone = useCallback((g: Goal) => {
    setGoals((rows) => rows.map((r) => r.id === g.id
      ? { ...r, state: r.state === "done" ? "on" : "done" } : r));
    say(g.state === "done"
      ? `"${g.title}" is open again`
      : `"${g.title}" is done. Nothing is saved yet — it comes back on reload.`);
  }, [say]);

  const archive = useCallback((g: Goal) => {
    setGoals((rows) => rows.filter((r) => r.id !== g.id));
    say(`"${g.title}" is out of the way. It is not deleted, and it comes back on reload.`);
  }, [say]);

  const actions: QuickAction[] = useMemo(() => [
    { id: "add",       label: "Add a new goal",      icon: "Plus",      onClick: () => soon("Writing a new goal") },
    { id: "templates", label: "View goal templates", icon: "LayoutGrid", onClick: () => soon("Goal templates") },
    { id: "remind",    label: "Set a reminder",      icon: "Bell",      onClick: () => soon("Reminders") },
    { id: "download",  label: "Download my goals",   icon: "Download",  onClick: () => soon("Downloading your goals") },
    { id: "mentor",    label: "Share with a mentor", icon: "Users",     onClick: () => soon("Sharing a goal with a mentor") },
    { id: "journey",   label: "See my journey",      icon: "Sparkles",  onClick: () => { window.location.href = "/app/journey"; } },
  ], [soon]);

  const rail = (
    <div className="space-y-4">
      <Btn full icon="Plus" onClick={() => soon("Writing a new goal")}>Add a goal</Btn>
      <GoalInsights pct={overall} onTrack={by["on-track"]} total={goals.length} by={by} />
      <QuickActions rows={actions} />
      <DisciplineCard />
    </div>
  );

  return (
    <HomeShell active="/app/goals" rail={rail} loadFailed="your goals">
      <div className="flex flex-col">
        <GoalsHero chips={chips} active={kind} onPick={setKind} />

        <GoalStats total={goals.length} by={by} />
        <StaircaseNote />

        {shown.length > 0 ? (
          shown.map((g) => (
            <GoalCard key={g.id} g={g} money={formatRupees}
                      menu={menu === g.id} onMenu={(open) => setMenu(open ? g.id : null)}
                      onDone={markDone} onArchive={archive}
                      onEdit={() => soon("Changing a goal")}
                      onNote={() => soon("Notes on a goal")} />
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
                ? <Btn size="sm" icon="Plus" onClick={() => soon("Writing a new goal")}>Add a goal</Btn>
                : <Btn size="sm" onClick={() => setKind(ALL)}>See all goals</Btn>}
            />
          </Card>
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
