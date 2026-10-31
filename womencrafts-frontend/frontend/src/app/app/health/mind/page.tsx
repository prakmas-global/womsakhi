"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import * as Icons from "@/components/ux/icons";
import { Btn } from "@/components/ux/kit";
import {
  BarChart, Cols, Disclaimer, Empty, HealthFrame, Metric, MetricGrid, Panel, lastDays, useEntries, useHealthSettings,
} from "@/components/ux/health/kit";
import {
  ActivityFlow, AffirmationCard, CHECK_IN, CheckInFlow, CrisisCard, FaceRow, JournalFlow, LOOK, MoodFace, PROMPTS, PrivateNote,
  QuickCalm, ROUTINES, RoutineCard, RoutinePlayer, feelingLabel, lookOf, streakOf, useMoodHistory, useMounted,
  type JournalDraft, type JournalType, type Routine,
} from "@/components/ux/health/mind/parts";
import { FormLauncher } from "@/components/ux/health/StepFlow";
import { fmtDay, today, type Entry } from "@/lib/health-api";
import type { Mood } from "@/lib/engines-api";
import { WatchListen } from "@/components/ux/health/WatchListen";
import { Sounds } from "@/components/ux/health/Sounds";
import { illSrc } from "@/components/ux/health/art";

/**
 * Mental Wellness — a calmer mind. Everything here is private.
 *
 * Mood check-ins go to the one mood store (`/engines/mood`, kept on her day
 * in `cycle_days`); journal entries and calming activities to the Health
 * store (`journal`, `activity`). Game sessions are read for "what helps".
 * Nothing here diagnoses: patterns are counted from her own check-ins and
 * said in plain words.
 */

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "mood", label: "Mood Tracker" },
  { id: "journal", label: "Journal" },
  { id: "activities", label: "Activities" },
  { id: "insights", label: "Insights" },
  { id: "listen", label: "Meditate & listen" },
];

type Card = { title: string; body: string } | null;

export default function MentalWellnessPage() {
  const router = useRouter();
  const t = today();
  const moods = useMoodHistory(120);
  const journal = useEntries("journal");
  const calm = useEntries(["activity", "game"]);
  const { settings, save } = useHealthSettings();
  const [playing, setPlaying] = useState<Routine | null>(null);
  // Each flow is mounted only while open: null is closed.
  const [checking, setChecking] = useState<{ step: number; mood?: string } | null>(null);
  const [writing, setWriting] = useState<{ draft: JournalDraft; step: number } | null>(null);
  const [card, setCard] = useState<Card>(null);

  const go = (tab: string) => router.replace(`/app/health/mind${tab === "overview" ? "" : `?tab=${tab}`}`, { scroll: false });
  const start = (r: Routine) => { setPlaying(r); go("activities"); };
  /** Opens the journal sheet. With words already in it, it opens on the writing step. */
  const writeJournal = (type: JournalType, text = "") => setWriting({ draft: { type, text }, step: text ? 1 : 0 });
  const editJournal = (j: Entry<"journal">) => setWriting({ draft: { type: j.data.type, text: j.data.text, id: j.id }, step: 1 });
  const checkIn = (step = 0, mood?: string) => setChecking({ step, mood });

  const saveCheckIn = async (m: Mood, feelings: string[], note: string) => {
    const r = await moods.checkIn(m, { feelings, note, msg: feelings.length || note.trim() ? "Feelings saved" : undefined });
    if (r) setCard(r.card ? { title: r.card.title, body: r.card.body } : null);
    return !!r;
  };
  const saveJournal = async (d: JournalDraft) => {
    const text = d.text.trim();
    if (!text) return false;
    const ok = d.id
      ? await journal.edit(d.id, { data: { type: d.type, text } }, "Journal entry updated")
      : await journal.add("journal", { type: d.type, text }, today(), "Saved to your journal");
    return !!ok;
  };

  const todayMood = moods.rows.find((d) => d.date === t);
  const streak = streakOf(moods.rows.filter((d) => d.mood).map((d) => d.date), t);
  const priv = settings.privateMode;
  const mounted = useMounted();

  const logRoutine = async (minutes: number) => {
    if (!playing) return;
    await calm.add("activity", { type: playing.activity, minutes }, t, `${playing.name} saved · ${minutes} min`);
    setPlaying(null);
  };

  return (
    <HealthFrame active="/app/health/mind" hue="blue" icon="Brain" eyebrow="Mental Wellness"
                 title="A calmer mind, a happier you"
                 sub="Check in with yourself, write it down, and take a few quiet minutes. Everything here is private."
                 art={illSrc("hero-mental")} tabs={TABS}
                 actions={<>
                   <Btn icon="Smile" onClick={() => checkIn(0)}>Check in</Btn>
                   <Btn variant="outline" icon="Wind" href="/app/health/games/breathe">Breathing break</Btn>
                 </>}>
      {(tab) => <>
        {checking && (
          <CheckInFlow onClose={() => setChecking(null)} onSave={saveCheckIn} startAt={checking.step}
                       initial={{ ...(todayMood ?? {}), mood: checking.mood ?? todayMood?.mood }} />
        )}
        {writing && <JournalFlow onClose={() => setWriting(null)} onSave={saveJournal} initial={writing.draft} startAt={writing.step} />}
        {renderTab(tab)}
      </>}
    </HealthFrame>
  );

  function renderTab(tab: string) {
        if (tab === "mood") return <MoodTab moods={moods} priv={priv} card={card} onCard={setCard} onCheckIn={checkIn} />;
        if (tab === "journal") return <JournalTab journal={journal} priv={priv} onWrite={writeJournal} onEdit={editJournal}
                                                  setPriv={(v) => save({ privateMode: v }, v ? "Private view on" : "Private view off")} />;
        if (tab === "activities") return <ActivitiesTab calm={calm} playing={playing} setPlaying={setPlaying} onLog={logRoutine}
                                                        onAffirmation={(a) => writeJournal("Affirmation", a)} />;
        if (tab === "insights") return <InsightsTab moods={moods.rows} journal={journal.rows} calm={calm.rows} />;
        if (tab === "listen") return (
          <Cols main={<WatchListen section="mental" hue="blue" title="Guided meditations" />}
                side={<Sounds hue="blue" title="Calming sounds" defaultTimer="15" />} />
        );
        return (
          <Cols
            main={<>
              <Panel title="How are you feeling today?" sub={mounted ? fmtDay(t, { weekday: "long", day: "numeric", month: "long" }) : "Today"}
                     action={<Btn size="sm" variant="ghost" icon="Plus" onClick={() => checkIn(todayMood?.mood ? 1 : 0)}>Feelings &amp; note</Btn>}>
                <CheckIn moods={moods} current={todayMood?.mood} card={card} onCard={setCard} compact />
              </Panel>
              <Panel title="Your last 14 days" action={<Btn size="sm" variant="ghost" iconEnd="ArrowRight" onClick={() => go("mood")}>Mood tracker</Btn>}>
                <MoodStrip days={14} rows={moods.rows} />
              </Panel>
              <MetricGrid>
                <Metric hue="blue" icon="Flame" label="Check-in streak" value={streak} unit={streak === 1 ? "day" : "days"}
                        sub={todayMood ? "Checked in today" : "Check in to keep it going"} />
                <Metric hue="lilac" icon="BookOpen" label="Journal, 7 days"
                        value={journal.rows.filter((j) => j.date >= lastDays(7)[0].day).length} unit="entries" href="/app/health/mind?tab=journal" />
                <Metric hue="green" icon="Leaf" label="Calm minutes, 7 days"
                        value={calmMinutes(calm.rows, 7)} unit="min" href="/app/health/mind?tab=activities" />
              </MetricGrid>
              <Panel title="From your journal" action={<Btn size="sm" variant="ghost" icon="PenLine" onClick={() => writeJournal("Reflection")}>Write</Btn>}>
                {journal.rows.length ? (
                  <ul className="flex flex-col">
                    {journal.rows.slice(0, 3).map((j) => (
                      <li key={j.id} className="border-t py-3 first:border-t-0 first:pt-0" style={{ borderColor: "var(--ux-line)" }}>
                        <p className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>{j.data.type} · {fmtDay(j.date)}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm" style={{ color: "var(--ux-ink-2)", filter: priv ? "blur(6px)" : undefined }}>{j.data.text}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Empty icon="BookOpen" title="Nothing written yet" body="A few lines a day — what went well, what you want to let go of — can lighten a heavy mind."
                         action={<Btn size="sm" icon="PenLine" onClick={() => writeJournal("Gratitude")}>Write your first entry</Btn>} />
                )}
                <PrivateNote />
              </Panel>
            </>}
            side={<>
              <Panel title="Quick calm">
                <QuickCalm items={[
                  { icon: "Wind", label: "Breathing", href: "/app/health/games/breathe" },
                  { icon: "Heart", label: "Gratitude", onClick: () => writeJournal("Gratitude", PROMPTS.Gratitude[0] + " ") },
                  { icon: "ScanFace", label: "Body scan", onClick: () => start(ROUTINES[0]) },
                  { icon: "Footprints", label: "Mindful walk", onClick: () => start(ROUTINES[3]) },
                ]} />
              </Panel>
              <AffirmationCard onSave={(a) => writeJournal("Affirmation", a)} />
              <Panel title="Talk to a mentor" hue="orange" tint>
                <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>
                  Guidance on stress, relationships, career and more, from women who have been there. Mentors are not
                  licensed mental-health professionals.
                </p>
                <div><Btn size="sm" icon="Users" href="/app/health/mentors?topic=Mental%20wellness">Find a mentor</Btn></div>
              </Panel>
              <CrisisCard />
            </>}
          />
        );
  }
}

function calmMinutes(rows: Entry<"activity" | "game">[], days: number) {
  const from = lastDays(days)[0].day;
  return Math.round(rows.filter((r) => r.date >= from).reduce((a, r) =>
    a + (r.kind === "activity" ? Number((r.data as { minutes: number }).minutes) || 0 : (Number((r.data as { seconds: number }).seconds) || 0) / 60), 0));
}

/* ── check-in ─────────────────────────────────────────────────────────── */

/** One tap on a face saves the day's mood. Feelings and a note are a separate, step-by-step sheet. */
function CheckIn({ moods, current, card, onCard, onMore, compact = false }: {
  moods: ReturnType<typeof useMoodHistory>; current?: string; card: Card; onCard: (c: Card) => void;
  /** Opens the feelings-and-note sheet for the mood she just tapped. */
  onMore?: (m: Mood) => void;
  compact?: boolean;
}) {
  const [picked, setPicked] = useState<Mood | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = picked ?? (CHECK_IN.includes(current as Mood) ? current : undefined);

  const send = async (m: Mood) => {
    setBusy(true);
    const r = await moods.checkIn(m, {});
    setBusy(false);
    if (r) onCard(r.card ? { title: r.card.title, body: r.card.body } : null);
  };

  return (
    <div className="flex flex-col gap-3" data-checkin>
      <FaceRow value={shown} busy={busy} narrow={!compact} onPick={(m) => { setPicked(m); void send(m); }} />
      <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
        {current ? `You checked in as ${lookOf(current).label.toLowerCase()} today. Tap again to change it.` : "Tap a face to save today's mood."}
      </p>
      {picked && !compact && onMore && (
        <div><Btn size="sm" variant="soft" icon="Plus" onClick={() => onMore(picked)}>Add feelings and a note</Btn></div>
      )}
      {card && (
        <div className="rounded-[14px] p-4" style={{ background: "var(--ux-tint-blue)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--ux-ink)" }}>{card.title}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{card.body}</p>
        </div>
      )}
    </div>
  );
}

function MoodStrip({ days, rows }: { days: number; rows: { date: string; mood: string }[] }) {
  const mounted = useMounted();
  const by = new Map(rows.map((r) => [r.date, r.mood]));
  const span = lastDays(days);
  const marked = span.filter((d) => by.get(d.day));
  const easy = marked.filter((d) => lookOf(by.get(d.day) || "").tone === "easy").length;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(days, 14)}, minmax(0, 1fr))` }} data-mood-strip>
        {span.slice(-14).map((d) => {
          const m = by.get(d.day);
          return (
            <div key={d.day} className="flex min-w-0 flex-col items-center gap-1" title={!mounted ? undefined : m ? `${fmtDay(d.day)}: ${lookOf(m).label}` : fmtDay(d.day)}>
              {m ? <MoodFace mood={m} size={26} />
                : <span className="h-[26px] w-[26px] rounded-full border-[1.5px] border-dashed" style={{ borderColor: "var(--ux-line-strong)" }} />}
              <span className="text-[11px] font-semibold tabular-nums" style={{ color: "var(--ux-muted)" }}>{Number(d.day.slice(8))}</span>
            </div>
          );
        })}
      </div>
      <p className="text-sm" style={{ color: "var(--ux-muted)" }}>
        {marked.length ? `${easy} easy ${easy === 1 ? "day" : "days"} out of ${marked.length} check-ins.` : "Your days appear here as you check in."}
      </p>
    </div>
  );
}

/* ── mood tracker ─────────────────────────────────────────────────────── */

function MoodTab({ moods, priv, card, onCard, onCheckIn }: {
  moods: ReturnType<typeof useMoodHistory>; priv: boolean; card: Card; onCard: (c: Card) => void;
  onCheckIn: (step?: number, mood?: string) => void;
}) {
  const mounted = useMounted();
  const [month, setMonth] = useState(() => today().slice(0, 7));
  const [confirm, setConfirm] = useState("");
  const by = useMemo(() => new Map(moods.rows.map((r) => [r.date, r])), [moods.rows]);
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const lead = (first.getDay() + 6) % 7;
  const count = new Date(y, m, 0).getDate();
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const t = today();

  return (
    <Cols
      main={<>
        <Panel title="Mood calendar"
               action={<div className="flex items-center gap-1">
                 <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="ux-press grid h-10 w-10 place-items-center rounded-full" style={{ color: "var(--ux-ink)" }}><Icons.ChevronLeft className="h-5 w-5" /></button>
                 <b className="min-w-[120px] text-center text-sm" style={{ color: "var(--ux-ink)" }}>{mounted ? first.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : month}</b>
                 <button type="button" aria-label="Next month" disabled={month >= t.slice(0, 7)} onClick={() => shift(1)} className="ux-press grid h-10 w-10 place-items-center rounded-full disabled:opacity-30" style={{ color: "var(--ux-ink)" }}><Icons.ChevronRight className="h-5 w-5" /></button>
               </div>}>
          <div className="grid grid-cols-7 gap-1.5" data-mood-calendar>
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
              <span key={d} className="pb-1 text-center text-[11.5px] font-extrabold" style={{ color: "var(--ux-muted)" }}>{d}</span>
            ))}
            {Array.from({ length: lead }, (_, i) => <span key={`b${i}`} />)}
            {Array.from({ length: count }, (_, i) => {
              const day = `${month}-${String(i + 1).padStart(2, "0")}`;
              const r = by.get(day);
              const look = r?.mood ? lookOf(r.mood) : null;
              return (
                <div key={day} className="flex h-[48px] flex-col items-center justify-center gap-0.5 rounded-[11px] text-[12.5px] font-bold tabular-nums sm:h-[58px]"
                     title={look ? `${fmtDay(day)}: ${look.label}` : undefined}
                     style={{ background: look ? look.tint : "var(--ux-surface-2)", color: look ? look.ink : "var(--ux-muted)",
                              boxShadow: day === t ? "inset 0 0 0 2px var(--ux-ink)" : undefined }}>
                  {i + 1}
                  {r?.mood && <MoodFace mood={r.mood} size={16} />}
                </div>
              );
            })}
          </div>
        </Panel>
        <Panel title="Mood history" sub="Only you see this.">
          {moods.loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p>
            : moods.rows.length === 0 ? <Empty icon="Smile" title="No check-ins yet" body="Tap a face on the right. One tap a day is enough." />
            : (
              <ul className="flex flex-col" data-mood-history>
                {moods.rows.slice(0, 40).map((r) => (
                  <li key={r.date} className="flex items-center gap-3 border-t py-3 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                    <MoodFace mood={r.mood} size={34} />
                    <div className="min-w-0 flex-1">
                      <b className="block text-sm" style={{ color: "var(--ux-ink)" }}>{r.mood ? lookOf(r.mood).label : "Feelings"} · <span className="font-semibold" style={{ color: "var(--ux-muted)" }}>{fmtDay(r.date, { weekday: "short", day: "numeric", month: "short" })}</span></b>
                      {(r.feelings.length > 0 || r.note) && (
                        <p className="truncate text-[13px]" style={{ color: "var(--ux-muted)", filter: priv ? "blur(6px)" : undefined }}>
                          {[r.feelings.map(feelingLabel).join(", "), r.note].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </div>
                    <Btn size="sm" variant={confirm === r.date ? "outline" : "ghost"} icon="Trash2"
                         onClick={() => (confirm === r.date ? (setConfirm(""), moods.clear(r.date)) : setConfirm(r.date))}
                         ariaLabel={confirm === r.date ? "Tap again to remove" : `Remove ${fmtDay(r.date)}`}>
                      {confirm === r.date ? "Remove?" : ""}
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
        </Panel>
      </>}
      side={<>
        <Panel title="Check in now" sub="One tap saves today's mood.">
          <CheckIn moods={moods} current={moods.rows.find((d) => d.date === t)?.mood} card={card} onCard={onCard}
                   onMore={(m) => onCheckIn(1, m)} />
        </Panel>
        <FormLauncher art="Mood" title="Check in with feelings" sub="Mood, feelings and a note · 4 quick steps" steps={4} hue="blue"
                      onStart={() => onCheckIn(0)} />
        <Panel title="Faces and what they mean">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(LOOK).filter(([k]) => CHECK_IN.includes(k as Mood) || ["happy", "calm", "sad", "irritable"].includes(k)).map(([k, l]) => (
              <span key={k} className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: "var(--ux-ink-2)" }}>
                <MoodFace mood={k} size={22} /> {l.label}
              </span>
            ))}
          </div>
          <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Days you log in the Cycle Tracker show here too.</p>
        </Panel>
        <CrisisCard />
      </>}
    />
  );
}

/* ── journal ─────────────────────────────────────────────────────────── */

function JournalTab({ journal, priv, setPriv, onWrite, onEdit }: {
  journal: ReturnType<typeof useEntries<"journal">>;
  priv: boolean;
  setPriv: (v: boolean) => void;
  onWrite: (type: JournalType, text?: string) => void;
  onEdit: (j: Entry<"journal">) => void;
}) {
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState("");
  const [peek, setPeek] = useState<string[]>([]);
  const rows = q.trim() ? journal.rows.filter((j) => `${j.data.type} ${j.data.text}`.toLowerCase().includes(q.toLowerCase())) : journal.rows;

  return (
    <Cols
      main={<>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[220px] flex-1">
            <Icons.Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--ux-muted)" }} />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your journal" aria-label="Search your journal"
                   className="min-h-[44px] w-full rounded-[12px] border-[1.5px] ps-9 pe-3 text-sm outline-none"
                   style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          </label>
          <Btn size="sm" variant="outline" icon={priv ? "Eye" : "EyeOff"} onClick={() => setPriv(!priv)}>
            {priv ? "Show entries" : "Hide entries"}
          </Btn>
        </div>
        <Panel title={q ? `Search results · ${rows.length}` : "Your journal"} sub="Private. Only you can see it.">
          {journal.loading ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Loading…</p>
            : rows.length === 0 ? (q
              ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>No entries match &ldquo;{q}&rdquo;.</p>
              : <Empty icon="BookOpen" title="Your journal is empty" body="Pick a prompt and write a few lines. There is no wrong way to do it."
                       action={<Btn size="sm" icon="PenLine" onClick={() => onWrite("Reflection")}>Write your first entry</Btn>} />)
            : (
              <ul className="flex flex-col" data-journal>
                {rows.map((j) => {
                  const hidden = priv && !peek.includes(j.id);
                  return (
                    <li key={j.id} className="flex flex-col gap-1.5 border-t py-3.5 first:border-t-0 first:pt-0" style={{ borderColor: "var(--ux-line)" }}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold" style={{ color: "var(--ux-muted)" }}>
                          <span className="rounded-full px-2 py-0.5" style={{ background: "var(--ux-tint-blue)", color: "var(--ux-blue-ink)" }}>{j.data.type}</span>
                          <span className="ms-2">{fmtDay(j.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span>
                        </span>
                        <span className="flex gap-1">
                          {hidden && <Btn size="sm" variant="ghost" icon="Eye" onClick={() => setPeek((p) => [...p, j.id])}>Show</Btn>}
                          <Btn size="sm" variant="ghost" icon="Pencil" ariaLabel="Edit" onClick={() => onEdit(j)}>{""}</Btn>
                          <Btn size="sm" variant={confirm === j.id ? "outline" : "ghost"} icon="Trash2" ariaLabel={confirm === j.id ? "Tap again to delete" : "Delete"}
                               onClick={() => (confirm === j.id ? (setConfirm(""), journal.remove(j.id, "Entry deleted")) : setConfirm(j.id))}>
                            {confirm === j.id ? "Delete?" : ""}
                          </Btn>
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed" style={{ color: "var(--ux-ink)", filter: hidden ? "blur(7px)" : undefined, userSelect: hidden ? "none" : undefined }}>
                        {j.data.text}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
        </Panel>
      </>}
      side={<>
        <FormLauncher art="Journaling" title="New journal entry" sub="Pick a type, then write freely · 3 quick steps" steps={3} hue="blue"
                      onStart={() => onWrite("Reflection")} cta="Write" />
        <Panel title="Start from a prompt" sub="Tap one to begin writing.">
          <div className="flex flex-col gap-1.5" data-journal-prompts>
            {(Object.keys(PROMPTS) as JournalType[]).map((type) => (
              <button key={type} type="button" onClick={() => onWrite(type, `${PROMPTS[type][0]} `)}
                      className="ux-press ux-hov flex min-h-[52px] items-center gap-3 rounded-[12px] px-3 text-start"
                      style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: "var(--ux-tint-blue)", color: "var(--ux-blue-ink)" }}>
                  <Icons.PenLine className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <b className="block text-[11.5px] font-extrabold uppercase tracking-[0.08em]" style={{ color: "var(--ux-blue-ink)" }}>{type}</b>
                  <span className="block text-[13.5px] font-semibold">{PROMPTS[type][0]}</span>
                </span>
                <Icons.ChevronRight className="h-4 w-4 shrink-0" style={{ color: "var(--ux-muted)" }} />
              </button>
            ))}
          </div>
          <PrivateNote />
        </Panel>
      </>}
    />
  );
}

/* ── activities ─────────────────────────────────────────────────────── */

function ActivitiesTab({ calm, playing, setPlaying, onLog, onAffirmation }: {
  calm: ReturnType<typeof useEntries<"activity" | "game">>;
  playing: Routine | null;
  setPlaying: (r: Routine | null) => void;
  onLog: (minutes: number) => void;
  onAffirmation: (a: string) => void;
}) {
  const [logging, setLogging] = useState(false);
  const [confirm, setConfirm] = useState("");
  const acts = calm.rows.filter((r) => r.kind === "activity") as Entry<"activity">[];
  const logActivity = async (type: string, mins: number) =>
    !!(await calm.add("activity", { type, minutes: Math.min(180, mins) }, today(), `${type} saved · ${mins} min`));

  return (
    <Cols
      main={<>
        {logging && <ActivityFlow onClose={() => setLogging(false)} onSave={logActivity} />}
        {playing && <RoutinePlayer key={playing.id} routine={playing} onDone={onLog} onClose={() => setPlaying(null)} />}
        <Panel title="Mindfulness sessions" sub="Guided, step by step. Press start and follow along.">
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
            {ROUTINES.map((r) => <RoutineCard key={r.id} r={r} onStart={() => { setPlaying(r); window.scrollTo({ top: 0, behavior: "smooth" }); }} />)}
          </div>
        </Panel>
        <AffirmationCard onSave={onAffirmation} />
        <Panel title="Calming games">
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" variant="outline" icon="Wind" href="/app/health/games/breathe">Breathing</Btn>
            <Btn size="sm" variant="outline" icon="Sprout" href="/app/health/games/garden">Mindful Garden</Btn>
            <Btn size="sm" variant="outline" icon="CircleDot" href="/app/health/games/bubbles">Bubble Pop</Btn>
          </div>
        </Panel>
      </>}
      side={<>
        <FormLauncher art="Meditation" title="Log a calming activity" sub="Did something on your own? 3 quick steps, mostly taps." steps={3} hue="blue"
                      onStart={() => setLogging(true)} />
        <Panel title="Calming activities">
          {acts.length === 0 ? <p className="text-sm" style={{ color: "var(--ux-muted)" }}>Nothing logged yet.</p> : (
            <ul className="flex flex-col" data-activities>
              {acts.slice(0, 12).map((a) => (
                <li key={a.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--ux-line)" }}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]" style={{ background: "var(--ux-tint-blue)", color: "var(--ux-blue-ink)" }}>
                    <Icons.Leaf className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <b className="block truncate text-sm" style={{ color: "var(--ux-ink)" }}>{a.data.type}</b>
                    <span className="text-xs" style={{ color: "var(--ux-muted)" }}>{a.data.minutes} min · {fmtDay(a.date)}</span>
                  </div>
                  <Btn size="sm" variant={confirm === a.id ? "outline" : "ghost"} icon="Trash2" ariaLabel={confirm === a.id ? "Tap again to delete" : "Delete"}
                       onClick={() => (confirm === a.id ? (setConfirm(""), calm.remove(a.id)) : setConfirm(a.id))}>
                    {confirm === a.id ? "Delete?" : ""}
                  </Btn>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </>}
    />
  );
}

/* ── insights ─────────────────────────────────────────────────────────── */

function InsightsTab({ moods, journal, calm }: {
  moods: { date: string; mood: string }[];
  journal: Entry<"journal">[];
  calm: Entry<"activity" | "game">[];
}) {
  const from = lastDays(30)[0].day;
  const ms = moods.filter((d) => d.mood && d.date >= from);
  const games = calm.filter((r) => r.kind === "game") as Entry<"game">[];
  const withMood = games.filter((g) => g.data.mood);
  const calmer = withMood.filter((g) => g.data.mood === "good").length;

  if (ms.length < 2) {
    return (
      <Panel title="Insights">
        <Empty icon="BarChart3" title="Not enough check-ins yet"
               body="Check in on a few days. Your own patterns appear here — how often you felt each way, and what seems to help." />
      </Panel>
    );
  }

  const counts = Object.entries(ms.reduce<Record<string, number>>((a, d) => { const l = lookOf(d.mood).label; a[l] = (a[l] || 0) + 1; return a; }, {}))
    .sort((a, b) => b[1] - a[1]);
  const max = Math.max(...counts.map((c) => c[1]));
  const weekday = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label, i) => {
    const xs = ms.filter((d) => (new Date(`${d.date}T00:00:00`).getDay() + 6) % 7 === i);
    return { label, value: xs.length ? Math.round((xs.filter((d) => lookOf(d.mood).tone === "easy").length / xs.length) * 100) : 0 };
  });
  const calmDays = new Set(calm.filter((r) => r.date >= from).map((r) => r.date));
  const easyShare = (xs: typeof ms) => (xs.length ? Math.round((xs.filter((d) => lookOf(d.mood).tone === "easy").length / xs.length) * 100) : null);
  const withCalm = easyShare(ms.filter((d) => calmDays.has(d.date)));
  const without = easyShare(ms.filter((d) => !calmDays.has(d.date)));

  return (
    <>
      <MetricGrid>
        <Metric hue="blue" icon="Smile" label="Check-ins, 30 days" value={ms.length} />
        <Metric hue="lilac" icon="BookOpen" label="Journal entries, 30 days" value={journal.filter((j) => j.date >= from).length} />
        <Metric hue="green" icon="Leaf" label="Calm minutes, 30 days" value={calmMinutes(calm, 30)} unit="min" />
        <Metric hue="amber" icon="Gamepad2" label="Calmer after a game" value={withMood.length ? `${Math.round((calmer / withMood.length) * 100)}%` : "–"}
                sub={withMood.length ? `of ${withMood.length} sessions with a mood` : "Pick a mood after playing"} />
      </MetricGrid>
      <Cols
        main={<>
          <Panel title="How often you felt each way" sub="Last 30 days">
            <div className="flex flex-col gap-2.5" data-mood-counts>
              {counts.map(([label, n]) => {
                const key = Object.keys(LOOK).find((k) => LOOK[k].label === label) || "";
                return (
                  <div key={label} className="grid items-center gap-2.5 text-[13px] font-semibold" style={{ gridTemplateColumns: "28px 90px minmax(0,1fr) 32px", color: "var(--ux-ink-2)" }}>
                    <MoodFace mood={key} size={24} />
                    <span>{label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full" style={{ background: "var(--ux-surface-2)" }}>
                      <span className="block h-full rounded-full" style={{ width: `${(n / max) * 100}%`, background: lookOf(key).ink }} />
                    </span>
                    <span className="text-end tabular-nums" style={{ color: "var(--ux-muted)" }}>{n}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
          <Panel title="Easy days by weekday" sub="Share of check-ins that felt good, happy or calm">
            <BarChart hue="blue" data={weekday} unit="%" />
          </Panel>
        </>}
        side={<>
          <Panel title="What seems to help" hue="green" tint>
            {withCalm != null && without != null ? (
              <p className="text-[14.5px] leading-relaxed" style={{ color: "var(--ux-ink)" }}>
                On days you took a calm break, <b>{withCalm}%</b> of your check-ins felt easy. On other days, <b>{without}%</b>.
                {withCalm > without ? " Those few quiet minutes seem to matter." : " Keep noticing what works for you."}
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>
                Take a calm break on some days and check in on others — this will show whether the breaks help you.
              </p>
            )}
          </Panel>
          <Disclaimer>These patterns come only from your own check-ins. They are not a diagnosis. If you feel low most days, please talk to someone you trust or a counsellor.</Disclaimer>
          <CrisisCard />
        </>}
      />
    </>
  );
}
