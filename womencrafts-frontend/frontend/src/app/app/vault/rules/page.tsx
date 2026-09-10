"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { RULES, savedByRules, type Rule } from "@/components/ux/vault/data";
import { useT } from "@/i18n";

/**
 * Saving by default, not by decision.
 *
 * Every rule is a share of something that just happened rather than a date in
 * a calendar. Her income is irregular — a fixed monthly transfer fails in a
 * lean month and quietly under-saves in a good one, and then she stops trusting
 * it. "Keep ₹20 from every order" survives both.
 */
export default function RulesPage() {
  const tr = useT();
  const router = useRouter();
  const [rules, setRules] = useState<Rule[]>(RULES);
  const [note, setNote] = useState<string | null>(null);

  const saved = useMemo(() => savedByRules(rules), [rules]);
  const on = useMemo(() => rules.filter((r) => r.on).length, [rules]);

  const toggle = useCallback((id: string) => {
    setRules((rows) => {
      const next = rows.map((r) => (r.id === id ? { ...r, on: !r.on } : r));
      const r = next.find((x) => x.id === id);
      setNote(r?.on ? `On. ${r.when.toLowerCase()}, ${r.keep} goes to ${r.into}.` : "Off. Nothing will be kept back.");
      return next;
    });
  }, []);

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-5">
        <Back to="/app/vault" label={tr("vaultRules.backToYourLocker")} />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("vaultRules.savingRules")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("vaultRules.saveWithoutDecidingTo")}</h1>
          <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            A small share of each payment, kept back the moment it arrives. Nothing is taken on
            a day you earned nothing.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat value={formatRupees(saved)} label={tr("vaultRules.savedThisWaySoFar")}
                  icon="Sparkles" tint="--ux-tint-violet" ink="--ux-violet" />
            <Stat value={`${on} of ${rules.length}`} label={tr("vaultRules.rulesRunning")}
                  icon="Repeat" tint="--ux-tint-green" ink="--ux-green-ink" />
          </div>
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title={tr("vaultRules.yourRules")} icon="Repeat" chip={String(rules.length)} />
          <div className="flex flex-col gap-2.5">
            {rules.map((r) => (
              <Card key={r.id} pad={16}>
                <div className="flex flex-wrap items-start gap-3.5">
                  <IconTile icon={r.on ? "Repeat" : "Pause"}
                            tint={r.on ? "--ux-tint-green" : "--ux-surface-2"}
                            ink={r.on ? "--ux-green-ink" : "--ux-muted"} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold leading-snug" style={{ color: v("--ux-ink") }}>
                      {r.when}, keep <span style={{ color: v("--ux-brand") }}>{r.keep}</span>
                    </p>
                    <p className="mt-1 text-xsm" style={{ color: v("--ux-muted") }}>
                      Into &ldquo;{r.into}&rdquo;
                      {r.savedMinor > 0 && ` · ${formatRupees(r.savedMinor)} so far`}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={r.on}
                    aria-label={`${r.on ? tr("vaultRules.turnOff")
              : tr("vaultRules.turnOn")}: ${r.when}`}
                    onClick={() => toggle(r.id)}
                    className="ux-press relative h-[28px] w-[50px] shrink-0 rounded-full transition-colors"
                    style={{ background: v(r.on ? "--ux-brand" : "--ux-line-strong") }}
                  >
                    <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full transition-[left]"
                          style={{ left: r.on ? 25 : 3, background: v("--ux-surface"),
                                   transition: "left var(--ux-t) var(--ux-ease-out)" }} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              A rule never takes money you have not earned, and never leaves you short. If a
              payment is small, it keeps a smaller share — or nothing at all.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
