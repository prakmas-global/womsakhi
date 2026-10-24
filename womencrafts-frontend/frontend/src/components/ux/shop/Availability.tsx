"use client";

import { useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Sheet } from "@/components/ux/kit";
import { toast } from "@/components/ux/mobile/Toast";
import { apiErrorMessage } from "@/lib/api";
import { apiSetAvailability, type StoreSettings } from "@/lib/shop-api";

/**
 * Open or closed — the one switch that turns her shop off while she is away.
 *
 * Opening is one tap. Closing asks two things, both by tapping: why (optional,
 * buyers see it) and when she is back. A back-on day re-opens the shop by
 * itself on that morning (app/core/store.py), so a week away cannot turn into
 * a month closed because she forgot the switch.
 */

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const plusDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

export const prettyDay = (day: string) =>
  day ? new Date(`${day}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) : "";

const BACK = [
  { id: "1", label: "Tomorrow", day: () => plusDays(1) },
  { id: "3", label: "In 3 days", day: () => plusDays(3) },
  { id: "7", label: "In a week", day: () => plusDays(7) },
  { id: "14", label: "In 2 weeks", day: () => plusDays(14) },
  { id: "pick", label: "Pick a day", day: () => "" },
  { id: "me", label: "When I open it", day: () => "" },
];

/** The open/closed line and switch. `onChange` gets the store as the server now has it. */
export function AvailabilitySwitch({ store, onChange, compact = false }: {
  store: StoreSettings;
  onChange: (s: StoreSettings) => void;
  compact?: boolean;
}) {
  const [closing, setClosing] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = async () => {
    setBusy(true);
    try {
      onChange(await apiSetAvailability({ open: true }));
      toast("Your shop is open — buyers can order again", { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e), { tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const tone = store.open
    ? { bg: "var(--ux-tint-green)", ink: "var(--ux-green-ink)", dot: "#1f9d55" }
    : { bg: "var(--ux-tint-amber)", ink: "var(--ux-amber-ink)", dot: "#d97706" };

  return (
    <>
      <div className={`flex items-center gap-3 rounded-[14px] ${compact ? "p-2.5" : "p-3.5"}`}
           style={{ background: tone.bg }} data-availability={store.open ? "open" : "closed"}>
        <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: "var(--ux-surface)", color: tone.ink }}>
          {store.open ? <Icons.Store className="h-[18px] w-[18px]" /> : <Icons.Moon className="h-[18px] w-[18px]" />}
          <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full" style={{ background: tone.dot, border: "2px solid var(--ux-surface)" }} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xsm font-extrabold" style={{ color: tone.ink }}>
            {store.open ? "Open — taking orders" : "Closed for now"}
          </span>
          <span className="block truncate text-xs" style={{ color: "var(--ux-ink-2)" }}>
            {store.open
              ? "Turn this off when you are away. Buyers cannot order until you are back."
              : [store.away_reason, store.back_on ? `Opens by itself on ${prettyDay(store.back_on)}` : "Stays closed until you open it"]
                  .filter(Boolean).join(" · ")}
          </span>
        </span>
        <button type="button" role="switch" aria-checked={store.open} disabled={busy}
                aria-label={store.open ? "Close my shop for now" : "Open my shop"}
                onClick={() => (store.open ? setClosing(true) : void open())}
                className="ux-press flex h-[30px] w-[52px] shrink-0 items-center rounded-full p-[3px] transition-colors disabled:opacity-60"
                style={{ background: store.open ? "var(--ux-fill, var(--ux-brand))" : "var(--ux-line-strong)" }}>
          <span className="h-[24px] w-[24px] rounded-full transition-transform"
                style={{ background: "var(--ux-surface)", transform: store.open ? "translateX(22px)" : "translateX(0)",
                         boxShadow: "0 1px 3px rgba(0,0,0,.2)" }} />
        </button>
      </div>
      {closing && (
        <CloseSheet store={store} onClose={() => setClosing(false)}
                    onDone={(s) => { onChange(s); setClosing(false); }} />
      )}
    </>
  );
}

function CloseSheet({ store, onClose, onDone }: {
  store: StoreSettings;
  onClose: () => void;
  onDone: (s: StoreSettings) => void;
}) {
  const [reason, setReason] = useState("");
  const [back, setBack] = useState("7");
  const [picked, setPicked] = useState(plusDays(7));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const day = back === "pick" ? picked : BACK.find((b) => b.id === back)!.day();

  const save = async () => {
    setBusy(true); setError("");
    try {
      const s = await apiSetAvailability({ open: false, back_on: day, away_reason: reason });
      toast(day ? `Shop closed — opens again ${prettyDay(day)}` : "Shop closed until you open it", { tone: "success" });
      onDone(s);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const chip = (on: boolean) => ({
    background: on ? "var(--ux-brand)" : "var(--ux-surface-2)",
    color: on ? "var(--ux-ink-on-brand)" : "var(--ux-ink-2)",
  });

  return (
    <Sheet open onClose={onClose} icon="Moon" title="Close your shop for now?"
           description={`Buyers will see “${store.display_name} is not taking orders right now”. Orders you already have stay as they are.`}
           footer={<Btn full icon="Moon" loading={busy} onClick={save}>{day ? `Close until ${prettyDay(day)}` : "Close my shop"}</Btn>}>
      <p className="mb-2 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>Why? <span className="font-normal" style={{ color: "var(--ux-muted)" }}>(buyers see this — you can skip it)</span></p>
      <div className="flex flex-wrap gap-2">
        {store.away_reasons.map((r) => (
          <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(reason === r ? "" : r)}
                  className="ux-press min-h-[40px] rounded-full px-3.5 text-xsm font-semibold" style={chip(reason === r)}>
            {r}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-xs font-bold" style={{ color: "var(--ux-ink-2)" }}>When are you back?</p>
      <div className="grid grid-cols-2 gap-2">
        {BACK.map((b) => (
          <button key={b.id} type="button" aria-pressed={back === b.id} onClick={() => setBack(b.id)}
                  className="ux-press min-h-[44px] rounded-[12px] px-3 text-start text-xsm font-semibold" style={chip(back === b.id)}>
            {b.label}
            {b.day() && <span className="block text-2xs font-normal opacity-80">{prettyDay(b.day())}</span>}
          </button>
        ))}
      </div>
      {back === "pick" && (
        <input type="date" value={picked} min={plusDays(1)} max={plusDays(180)} onChange={(e) => setPicked(e.target.value)}
               aria-label="The day you are back"
               className="mt-3 min-h-[46px] w-full rounded-[12px] border px-3 text-xsm"
               style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
      )}
      <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed" style={{ color: "var(--ux-muted)" }}>
        <Icons.Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {day ? "Your shop opens again by itself on that morning. You can open it sooner with the same switch."
             : "Your shop stays closed until you turn the switch back on."}
      </p>
      {error && <p role="alert" className="mt-2 text-xs font-semibold" style={{ color: "var(--ux-danger-ink)" }}>{error}</p>}
    </Sheet>
  );
}
