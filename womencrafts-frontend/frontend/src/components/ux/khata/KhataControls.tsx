"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, v } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { toast } from "@/components/ux/mobile/Toast";
import { apiKhataRemovePin, apiKhataSetPin, setKhataKey } from "@/lib/khata-api";
import { CalculatorSheet } from "./Calculator";
import { PinPad, useKhata } from "./KhataGate";

/**
 * The two privacy controls at the top of My Khata: an eye that hides every
 * amount (a shared phone is read over her shoulder), and the PIN.
 *
 * Changing a PIN asks for the old one first and only then the new one — two
 * keypads in a row, never a form with two boxes she has to tell apart.
 */
export function KhataControls() {
  const { hide, setHide, settings, refreshSettings } = useKhata();
  const [sheet, setSheet] = useState(false);
  const [calc, setCalc] = useState(false);
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => setCalc(true)} aria-label="Calculator" title="Calculator"
              className="ux-press inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold"
              style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink-2") }}>
        <Icons.Calculator className="h-4 w-4" />
        <span className="max-xl:hidden">Calculator</span>
      </button>
      {/* Its answer becomes a line in her book: the Money tab opens the
          quick-add sheet with the amount already in it. */}
      {calc && <CalculatorSheet onClose={() => setCalc(false)}
                                onAdd={(kind, rupees) => { setCalc(false); router.push(`/app/money?tab=money&add=${kind}&amount=${rupees}`, { scroll: false }); }} />}
      <button type="button" onClick={() => setHide(!hide)} aria-pressed={hide}
              aria-label={hide ? "Show amounts" : "Hide amounts"} title={hide ? "Show amounts" : "Hide amounts"}
              className="ux-press inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold"
              style={{ borderColor: v("--ux-line"), background: v("--ux-surface"), color: v("--ux-ink-2") }}>
        {hide ? <Icons.EyeOff className="h-4 w-4" /> : <Icons.Eye className="h-4 w-4" />}
        <span className="max-sm:hidden">{hide ? "Amounts hidden" : "Hide amounts"}</span>
      </button>
      <button type="button" onClick={() => setSheet(true)}
              aria-label={settings.pin_set ? "PIN is on" : "Set a PIN"}
              className="ux-press inline-flex h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-bold"
              style={{ borderColor: settings.pin_set ? v("--ux-brand") : v("--ux-line"),
                       background: settings.pin_set ? v("--ux-brand-tint") : v("--ux-surface"),
                       color: settings.pin_set ? v("--ux-brand") : v("--ux-ink-2") }}>
        {settings.pin_set ? <Icons.Lock className="h-4 w-4" /> : <Icons.Unlock className="h-4 w-4" />}
        <span className="max-sm:hidden">{settings.pin_set ? "PIN on" : "Set a PIN"}</span>
      </button>
      {sheet && <PinSheet pinSet={settings.pin_set} onClose={() => setSheet(false)} onChanged={refreshSettings} />}
    </div>
  );
}

type Step = "menu" | "set" | "current" | "new" | "remove";

function PinSheet({ pinSet, onClose, onChanged }: { pinSet: boolean; onClose: () => void; onChanged: () => void }) {
  const [step, setStep] = useState<Step>(pinSet ? "menu" : "set");
  const [current, setCurrent] = useState("");
  const done = (msg: string) => { toast(msg, { tone: "success" }); onChanged(); onClose(); };

  return (
    <Sheet open onClose={onClose} title="Your money notebook PIN" icon="KeyRound"
           description="Four numbers only you know. Your money notebook asks for them when you open it.">
      {step === "menu" && (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-[14px] p-3 text-xsm font-semibold" style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>
            <Icons.ShieldCheck className="h-5 w-5 shrink-0" /> Your PIN is on. Your money notebook stays shut until it is entered.
          </p>
          <Btn icon="KeyRound" full onClick={() => setStep("current")}>Change my PIN</Btn>
          <Btn variant="outline" icon="Unlock" full onClick={() => setStep("remove")}>Remove my PIN</Btn>
        </div>
      )}
      {step === "set" && (
        <PinPad title="Choose a 4-number PIN" onOpen={() => done("PIN set — your money notebook is locked")}
                submit={async (p) => { setKhataKey((await apiKhataSetPin(p)).key); }} />
      )}
      {step === "current" && (
        // Kept here and sent with the new one: the server checks both at once.
        <PinPad title="Enter your current PIN" onOpen={() => setStep("new")} submit={async (p) => { setCurrent(p); }} />
      )}
      {step === "new" && (
        <PinPad title="Now choose a new PIN" onOpen={() => done("PIN changed")}
                submit={async (p) => {
                  try {
                    setKhataKey((await apiKhataSetPin(p, current)).key);
                  } catch (e) {
                    // A wrong current PIN only shows up now — go back for it.
                    setStep("current");
                    throw e;
                  }
                }} />
      )}
      {step === "remove" && (
        <PinPad title="Enter your PIN to remove it" onOpen={() => done("PIN removed")}
                submit={async (p) => { await apiKhataRemovePin(p); setKhataKey(""); }} />
      )}
    </Sheet>
  );
}
