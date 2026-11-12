"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, Card, v } from "@/components/ux/kit";
import { formatMoney } from "@/components/ux/kit/money";
import { apiErrorMessage } from "@/lib/api";
import {
  apiKhataForgotPin, apiKhataHideAmounts, apiKhataSettings, apiKhataUnlock, isLocked, khataKey, setKhataKey,
  type KhataSettings,
} from "@/lib/khata-api";

/**
 * The door to My Khata (backend: routes/khata.py).
 *
 * With no PIN it simply opens. With one, it shows a keypad — four big digits,
 * no keyboard — and only renders what is inside once the server has handed
 * back a key. Anything inside that gets a 423 calls `relock()` and the keypad
 * comes back: the key lasts 30 minutes, and a phone left on a table should not
 * stay open longer than that.
 *
 * `useKhata().hide` is her "hide amounts" switch; `<Amount>` honours it.
 */

interface Ctx {
  settings: KhataSettings;
  hide: boolean;
  setHide: (hide: boolean) => void;
  relock: () => void;
  /** Call from any catch: true when it was the lock, already handled. */
  locked: (e: unknown) => boolean;
  refreshSettings: () => void;
}

const KhataCtx = createContext<Ctx | null>(null);

export function useKhata(): Ctx {
  const c = useContext(KhataCtx);
  if (!c) throw new Error("useKhata outside <KhataGate>");
  return c;
}

/** An amount, or dots when she has hidden amounts. */
export function Amount({ minor, sign, className, style }: {
  minor: number; sign?: "in" | "out"; className?: string; style?: React.CSSProperties;
}) {
  const { hide } = useKhata();
  const prefix = sign === "in" ? "+ " : sign === "out" ? "− " : "";
  return (
    <span className={`tabular-nums ${className ?? ""}`} style={style} aria-label={hide ? "Amount hidden" : undefined}>
      {hide ? "₹ ••••" : `${prefix}${formatMoney(minor, minor % 100 !== 0)}`}
    </span>
  );
}

export function KhataGate({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<KhataSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await apiKhataSettings();
      setSettings(s);
      setOpen(!s.pin_set || !!khataKey());
    } catch (e) {
      setError(apiErrorMessage(e, "Your money notebook did not open. Check your connection and try again."));
    }
  }, []);
  // A tick later, so the first paint is the skeleton rather than a render
  // that immediately sets state.
  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(t);
  }, [load]);

  const relock = useCallback(() => { setKhataKey(""); setOpen(false); }, []);
  const locked = useCallback((e: unknown) => { if (isLocked(e)) { relock(); return true; } return false; }, [relock]);
  const setHide = useCallback((hide: boolean) => {
    setSettings((s) => (s ? { ...s, hide_amounts: hide } : s));
    apiKhataHideAmounts(hide).catch((e) => locked(e));
  }, [locked]);

  if (error) {
    return <Card><p className="text-sm" style={{ color: v("--ux-muted") }}>{error}</p>
      <div className="mt-3"><Btn size="sm" variant="outline" onClick={() => { setError(""); void load(); }}>Try again</Btn></div></Card>;
  }
  if (!settings) return <div className="ux-skeleton h-[320px] rounded-[20px]" />;
  if (!open) return <PinPad onOpen={() => setOpen(true)} onReset={() => void load()} />;

  return (
    <KhataCtx.Provider value={{ settings, hide: settings.hide_amounts, setHide, relock, locked, refreshSettings: () => void load() }}>
      {children}
    </KhataCtx.Provider>
  );
}

/** Four digits, by tapping. Wrong ones shake the dots; five wrong lock it for 10 minutes (server). */
export function PinPad({ onOpen, onReset, title = "Enter your money PIN", submit }: {
  onOpen: () => void;
  onReset?: () => void;
  title?: string;
  /** Instead of unlocking: use the four digits for something else (setting a new PIN). */
  submit?: (pin: string) => Promise<void>;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const go = async (p: string) => {
    setBusy(true); setError("");
    try {
      if (submit) await submit(p);
      else setKhataKey((await apiKhataUnlock(p)).key);
      onOpen();
    } catch (e) {
      setError(apiErrorMessage(e, "That did not work. Try again."));
      setPin("");
    } finally { setBusy(false); }
  };
  const press = (d: string) => {
    if (busy || pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    if (next.length === 4) void go(next);
  };
  const forgot = async () => {
    try { await apiKhataForgotPin(); setKhataKey(""); onReset?.(); }
    catch (e) { setError(apiErrorMessage(e, "Sign out and sign in again, then reset your PIN within 15 minutes.")); }
  };

  return (
    <Card className="mx-auto max-w-[380px] text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
        <Icons.Lock className="h-7 w-7" />
      </span>
      <h2 className="mt-3 text-lg font-bold" style={{ color: v("--ux-ink") }}>{title}</h2>
      <div className={`mt-4 flex justify-center gap-3 ${error ? "ux-shake" : ""}`} aria-label={`${pin.length} of 4 digits`}>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-4 w-4 rounded-full transition-colors"
                style={{ background: i < pin.length ? v("--ux-brand") : v("--ux-line-strong") }} />
        ))}
      </div>
      {error && <p role="alert" className="mt-3 text-xs" style={{ color: v("--ux-danger-ink") }}>{error}</p>}
      <div className="mx-auto mt-5 grid max-w-[260px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((d, i) => d === "" ? <span key={i} /> : (
          <button key={i} type="button" disabled={busy}
                  aria-label={d === "⌫" ? "Delete" : d}
                  onClick={() => (d === "⌫" ? setPin(pin.slice(0, -1)) : press(d))}
                  className="ux-press grid h-16 place-items-center rounded-full text-2xl font-bold"
                  style={{ background: v("--ux-surface-2"), color: v("--ux-ink") }}>
            {d === "⌫" ? <Icons.Delete className="h-6 w-6" /> : d}
          </button>
        ))}
      </div>
      {!submit && onReset && (
        <button type="button" onClick={() => void forgot()} className="mt-4 text-xs font-semibold underline" style={{ color: v("--ux-brand") }}>
          Forgot PIN?
        </button>
      )}
    </Card>
  );
}
