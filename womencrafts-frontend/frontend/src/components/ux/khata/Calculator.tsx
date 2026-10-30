"use client";

import { useEffect, useState } from "react";

import * as Icons from "@/components/ux/icons";
import { Btn, v } from "@/components/ux/kit";
import { Sheet } from "@/components/ux/kit/sheet";
import { OPS, evaluate, showExpr, showRupees } from "./calc";

/**
 * A calculator inside her khata (arithmetic: ./calc.ts).
 *
 * Big keys she taps, like the one on her phone — but its answer goes straight
 * where she needs it: into the amount she is writing down, or into a new
 * money in / money out line. The last few sums stay on screen while it is
 * open; nothing is kept after, because a shared phone should not remember
 * someone's sums.
 */

const ROWS: string[][] = [
  ["C", "⌫", "%", "÷"],
  ["7", "8", "9", "×"],
  ["4", "5", "6", "−"],
  ["1", "2", "3", "+"],
  ["00", "0", ".", "="],
];

export function CalculatorSheet({ start = "", onClose, onUse, useLabel = "Use this amount", onAdd }: {
  /** What to start from — the amount already in the box. */
  start?: string;
  onClose: () => void;
  /** Put the answer back where it came from. */
  onUse?: (rupees: number) => void;
  useLabel?: string;
  /** From the khata header: write the answer down as money in or out. */
  onAdd?: (kind: "in" | "out", rupees: number) => void;
}) {
  const [expr, setExpr] = useState(start.replace(/,/g, ""));
  const [history, setHistory] = useState<{ expr: string; value: number }[]>([]);
  const value = evaluate(expr);
  const answer = value !== null && value > 0 ? value : null;

  const press = (key: string) => {
    const last = expr.slice(-1);
    const lastIsOp = (OPS as string[]).includes(last);
    if (key === "C") return setExpr("");
    if (key === "⌫") return setExpr(expr.slice(0, -1));
    if (key === "=") {
      if (value === null) return;
      setHistory((h) => [{ expr, value }, ...h].slice(0, 5));
      return setExpr(String(value));
    }
    if ((OPS as string[]).includes(key)) {
      // Swap a trailing operator rather than stacking two; a leading minus is allowed.
      if (!expr) return key === "−" ? setExpr("−") : undefined;
      return setExpr(lastIsOp ? expr.slice(0, -1) + key : expr + key);
    }
    if (key === "%") return !expr || lastIsOp || last === "%" ? undefined : setExpr(expr + "%");
    if (last === "%") return; // a number cannot follow a percent
    const current = expr.split(/[+−×÷]/).pop() ?? "";
    if (key === "." && current.includes(".")) return;
    if (/\.\d{2}$/.test(current)) return; // money has two decimals
    if (current.replace(".", "").length >= 12) return;
    setExpr(expr + (key === "." && !current ? "0." : key));
  };

  // A keyboard works too, on a laptop.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, string> = { "*": "×", "x": "×", "/": "÷", "-": "−", "+": "+", Enter: "=", "=": "=",
                                            Backspace: "⌫", Escape: "C", "%": "%", ".": "." };
      const key = /^\d$/.test(e.key) ? e.key : map[e.key];
      if (!key || (e.key === "Escape" && !expr)) return;
      e.preventDefault();
      press(key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <Sheet open onClose={onClose} title="Calculator" icon="Calculator" width={420}
           footer={answer !== null && (onUse || onAdd) ? (
             <div className="flex flex-wrap gap-2 [&>*]:flex-1">
               {onUse && <Btn variant="primary" icon="Check" onClick={() => onUse(answer)}>{useLabel}</Btn>}
               {onAdd && <>
                 <Btn variant="soft" icon="ArrowDownLeft" onClick={() => onAdd("in", answer)}>Money in</Btn>
                 <Btn variant="primary" icon="ArrowUpRight" onClick={() => onAdd("out", answer)}>Money out</Btn>
               </>}
             </div>
           ) : undefined}>
      <div className="flex flex-col gap-3">
        {/* The sum she is typing, and its answer as she types it. */}
        <div className="rounded-[18px] p-4 text-end" style={{ background: v("--ux-surface-2") }} aria-live="polite">
          <p className="min-h-[22px] break-all text-sm font-semibold" style={{ color: v("--ux-muted") }}>{showExpr(expr) || " "}</p>
          <p className="mt-1 break-all text-[34px] font-extrabold leading-tight tabular-nums" style={{ color: v("--ux-ink") }}>
            ₹{value !== null ? showRupees(value) : expr ? "…" : "0"}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-2.5" role="group" aria-label="Calculator keys">
          {ROWS.flat().map((key) => {
            const op = (OPS as string[]).includes(key) || key === "%";
            const eq = key === "=";
            const clear = key === "C" || key === "⌫";
            return (
              <button key={key} type="button" onClick={() => press(key)}
                      aria-label={{ "⌫": "Delete", C: "Clear", "÷": "Divide", "×": "Times", "−": "Minus", "+": "Plus", "%": "Percent", "=": "Equals" }[key] ?? key}
                      className="ux-press grid h-[62px] place-items-center rounded-[16px] text-2xl font-bold"
                      style={{
                        background: eq ? "var(--ux-pic-ground)" : op ? v("--ux-brand-tint") : clear ? v("--ux-surface-2") : v("--ux-surface"),
                        color: eq ? "#fff" : op ? v("--ux-brand") : v("--ux-ink"),
                        border: eq ? "none" : `1px solid ${v("--ux-line")}`,
                      }}>
                {key === "⌫" ? <Icons.Delete className="h-6 w-6" /> : key}
              </button>
            );
          })}
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-1.5 text-2xs font-bold uppercase tracking-[0.08em]" style={{ color: v("--ux-faint") }}>Just now</p>
            <ul className="space-y-1">
              {history.map((h, i) => (
                <li key={i}>
                  <button type="button" onClick={() => setExpr(String(h.value))}
                          className="ux-press flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2 text-start text-xs"
                          style={{ background: v("--ux-surface-2"), color: v("--ux-ink-2") }}>
                    <span className="truncate">{showExpr(h.expr)}</span>
                    <b className="tabular-nums" style={{ color: v("--ux-ink") }}>= ₹{showRupees(h.value)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
