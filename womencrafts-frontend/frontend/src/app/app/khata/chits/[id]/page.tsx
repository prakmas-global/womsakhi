"use client";

import { use, useCallback, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Back, Btn, Card, I, v } from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Segments } from "@/components/ux/learning/native";
import { toast } from "@/components/ux/mobile/Toast";
import { Amount, KhataGate, useKhata } from "@/components/ux/khata/KhataGate";
import { MonthPanel, type Run } from "@/components/ux/khata/chits/MonthPanel";
import { MembersPanel, SettingsPanel, Timeline } from "@/components/ux/khata/chits/ChitPanels";
import { MonthBar, SafetyCard, viewerLine } from "@/components/ux/khata/chits/parts";
import { METHOD_LOOK, lakhs, monthName } from "@/components/ux/khata/chits/look";
import { useKhataLoad } from "@/components/ux/khata/chits/useKhataLoad";
import { apiErrorMessage } from "@/lib/api";
import { apiChit, type Chit } from "@/lib/khata-api";

/**
 * One chit, month by month (backend: routes/khata.py).
 *
 * The top says where it stands in one look — how big, which month, what has
 * come in and what is still owed (for her), or what she owes (for a linked
 * member). Below, four tabs: the month in hand, every month as a timeline,
 * the members, and — for the organiser only — the record's own settings.
 * Every change hands back the whole chit, so the screen never shows a number
 * the server did not work out.
 */
export default function ChitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <HomeShell rail={<div className="space-y-4"><SafetyCard /></div>}>
      <KhataGate><ChitView id={id} /></KhataGate>
    </HomeShell>
  );
}

function ChitView({ id }: { id: string }) {
  const { locked } = useKhata();
  const { data: chit, setData, error, reload } = useKhataLoad(useCallback((s: AbortSignal) => apiChit(id, s), [id]));
  const [tab, setTab] = useState("Month");
  const [month, setMonth] = useState(0);

  const run: Run = useCallback(async (work, done) => {
    try {
      const c = await work();
      setData(c);
      if (done) toast(done, { tone: "success" });
      return true;
    } catch (e) {
      if (locked(e)) return false;
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
      return false;
    }
  }, [locked, setData]);

  if (error) {
    return (
      <Card>
        <p className="text-sm" style={{ color: v("--ux-muted") }}>{error}</p>
        <div className="mt-3 flex gap-2">
          <Btn size="sm" variant="outline" icon="RotateCw" onClick={reload}>Try again</Btn>
          <Btn size="sm" variant="ghost" href="/app/khata/chits">All chits</Btn>
        </div>
      </Card>
    );
  }
  if (!chit) return <span className="ux-skeleton block h-[420px] rounded-[20px]" />;

  // The month in hand: the one she picked, else this month (or the nearest one that exists).
  const shownMonth = month || Math.min(Math.max(chit.month_now, 1), chit.members_count);
  const owner = chit.viewer === "owner";
  const tabs = ["Month", "All months", "Members", ...(owner ? ["Settings"] : [])];
  const monthTab = shownMonth === chit.month_now ? "This month" : `Month ${shownMonth}`;
  const label = (t: string) => (t === "Month" ? monthTab : t);

  return (
    <>
      <div className="hidden lg:block"><Back to="/app/khata/chits" label="My chits" className="mb-4" /></div>
      <ChitHero chit={chit} />

      <div className="mb-4 mt-5">
        <Segments items={tabs.map(label)} active={label(tab)} label="Chit"
                  onChange={(t) => setTab(t === monthTab ? "Month" : t)} />
      </div>

      {tab === "Month" && (
        <>
          {/* Step between months without leaving the tab. */}
          <div className="mb-3 flex items-center justify-between gap-2">
            <Btn size="sm" variant="ghost" icon="ChevronLeft" disabled={shownMonth <= 1} onClick={() => setMonth(shownMonth - 1)}>Earlier</Btn>
            <span className="text-xs font-semibold" style={{ color: v("--ux-muted") }}>Month {shownMonth} of {chit.members_count}</span>
            <Btn size="sm" variant="ghost" iconEnd="ChevronRight" disabled={shownMonth >= chit.members_count}
                 onClick={() => setMonth(shownMonth + 1)}>Later</Btn>
          </div>
          <MonthPanel chit={chit} month={shownMonth} run={run} onMembers={() => setTab("Members")} />
        </>
      )}
      {tab === "All months" && <Timeline chit={chit} onPick={(m) => { setMonth(m); setTab("Month"); }} />}
      {tab === "Members" && <MembersPanel chit={chit} run={run} />}
      {tab === "Settings" && owner && <SettingsPanel chit={chit} run={run} />}
    </>
  );
}

function ChitHero({ chit }: { chit: Chit }) {
  const who = viewerLine(chit);
  const owner = chit.viewer === "owner";
  const stats: { icon: string; label: string; node: React.ReactNode }[] = owner
    ? [
        { icon: "Coins", label: "Collected so far", node: <Amount minor={chit.collected_minor} /> },
        { icon: "Hourglass", label: "Still owed", node: <Amount minor={chit.owed_minor} /> },
      ]
    : [];
  if (chit.my_member_id) {
    stats.push(chit.i_won
      ? { icon: "Trophy", label: "You took the pot", node: <>Month {chit.my_turn_month}</> }
      : { icon: "Wallet", label: "You owe", node: <Amount minor={chit.my_due_minor} /> });
  }
  stats.push({ icon: "CalendarDays", label: "Ends", node: <>{monthName(chit.end_month)}</> });

  return (
    <section className="ux-grain relative isolate overflow-hidden rounded-[22px] p-5 text-white sm:p-6"
             style={{ background: "var(--ux-banner-ground)", boxShadow: "var(--ux-shadow-card)" }}>
      <span aria-hidden className="absolute -end-6 -top-8 opacity-15"><Icons.Coins className="h-40 w-40" /></span>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-2xs font-bold">
            <I name={METHOD_LOOK[chit.method].icon} className="h-3.5 w-3.5" /> {METHOD_LOOK[chit.method].label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-2xs font-bold">
            <I name={who.icon} className="h-3.5 w-3.5" /> {who.text}
          </span>
          {chit.status === "closed" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-2xs font-bold">
              <Icons.Archive className="h-3.5 w-3.5" /> Closed
            </span>
          )}
        </div>
        <h1 className="ux-screen-title mt-2 text-2xl font-extrabold sm:text-3xl">{chit.name}</h1>
        <p className="mt-1 text-sm text-white/85">
          {lakhs(chit.value_minor / 100)} · {chit.members_count} members · <Amount minor={chit.monthly_minor} /> a month
        </p>
        <div className="mt-4"><MonthBar now={chit.month_now} total={chit.members_count} onBrand /></div>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-[14px] bg-white/15 p-2.5">
              <dt className="flex items-center gap-1 text-2xs text-white/80"><I name={s.icon} className="h-3.5 w-3.5" /> {s.label}</dt>
              <dd className="mt-0.5 text-base font-extrabold">{s.node}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
