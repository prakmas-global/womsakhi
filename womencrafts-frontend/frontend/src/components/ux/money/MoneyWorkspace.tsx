"use client";

import { useId } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { I, v } from "@/components/ux/kit";
import { KhataGate } from "@/components/ux/khata/KhataGate";
import { KhataControls } from "@/components/ux/khata/KhataControls";
import { MoneyTab } from "@/components/ux/khata/MoneyTab";
import { NotesTab } from "@/components/ux/khata/NotesTab";
import { BillsPlans } from "./BillsPlans";

const TABS = [{ id: "money", label: "Money in & out", icon: "ArrowLeftRight" }, { id: "plans", label: "Bills & plans", icon: "CalendarDays" }, { id: "notes", label: "Notes", icon: "NotebookPen" }] as const;
export type MoneyView = (typeof TABS)[number]["id"];

export function MoneyWorkspace({ tab }: { tab: MoneyView }) {
  return <HomeShell active="/app/money">
    <header className="mb-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider" style={{ color: v("--ux-brand") }}><I name="NotebookPen" className="h-4 w-4" /> Your personal money notebook</p>
      <h1 className="mt-2 text-2xl font-extrabold" style={{ color: v("--ux-ink") }}>My Money</h1>
      <p className="mt-1 max-w-[65ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>Record what you receive and spend. Keep upcoming bills separate until you pay them.</p>
    </header>
    <KhataGate><MoneyContent tab={tab} /></KhataGate>
  </HomeShell>;
}

function MoneyContent({ tab }: { tab: MoneyView }) {
  const router = useRouter();
  const prefix = useId();
  const go = (id: MoneyView) => router.push(`/app/money?tab=${id}`, { scroll: false });
  return <div data-money-workspace>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2 text-xs font-semibold" style={{ color: v("--ux-ink-2") }}>
        <Link href="/app/khata/chits" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3" style={{ borderColor: v("--ux-line") }}><I name="Coins" className="h-4 w-4" /> My chits</Link>
        <Link href="/app/payments" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3" style={{ borderColor: v("--ux-line") }}><I name="Receipt" className="h-4 w-4" /> My Payments</Link>
        <Link href="/app/books" className="inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3" style={{ borderColor: v("--ux-line") }}><I name="Users" className="h-4 w-4" /> Customer dues</Link>
      </div><KhataControls />
    </div>
    <div role="tablist" aria-label="My Money sections" className="mb-4 grid grid-cols-3 gap-2">
      {TABS.map((item, index) => <button key={item.id} type="button" role="tab" id={`${prefix}-${item.id}`} aria-controls={`${prefix}-panel`} aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1}
        onClick={() => go(item.id)} onKeyDown={(event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
          if (next < 0) return;
          event.preventDefault(); document.getElementById(`${prefix}-${TABS[next].id}`)?.focus(); go(TABS[next].id);
        }} className="ux-press flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-2 py-2 text-xs font-bold sm:flex-row sm:gap-2 sm:text-sm"
        style={{ background: v(tab === item.id ? "--ux-brand-tint" : "--ux-surface"), color: v(tab === item.id ? "--ux-brand" : "--ux-ink-2"), borderColor: v(tab === item.id ? "--ux-brand" : "--ux-line") }}><I name={item.icon} className="h-4 w-4" />{item.label}</button>)}
    </div>
    <div role="tabpanel" id={`${prefix}-panel`} aria-labelledby={`${prefix}-${tab}`}>
      {tab === "money" && <MoneyTab />}
      {tab === "plans" && <BillsPlans />}
      {tab === "notes" && <NotesTab />}
    </div>
  </div>;
}
