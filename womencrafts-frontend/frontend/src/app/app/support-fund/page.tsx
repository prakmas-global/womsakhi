"use client";

import { useState } from "react";
import * as Icons from "@/components/ux/icons";

import {
  Btn, Card, Chip, EmptyState, IconTile, Pill,
  SectionHead, SourceNote, Tabs, plural
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useSchemes } from "@/components/ux/entitlements";
import { SCHEME_ART, SCHEME_CATEGORIES } from "@/components/ux/schemes/data";
import { AlsoHere } from "@/components/ux/AlsoHere";

/**
 * Schemes & Benefits — public money she may already be entitled to.
 *
 * The hard part of a government scheme is not applying, it is learning it
 * exists and whether it applies to you. So this screen leads with whether SHE
 * looks eligible and WHY, in a sentence about her own situation, rather than
 * printing the rules and leaving her to work it out.
 */
export default function SchemesPage() {
  const { data: SCHEMES, source } = useSchemes();
  // "You may qualify" was a third tab here and it filtered nothing: `eligible`
  // is `true` for every scheme by design — see `toScheme` in entitlements.ts,
  // which deliberately refuses to guess who qualifies, because guessing sends a
  // woman to a counter to be turned away. So the tab showed the identical list
  // to "All schemes" while its label told her these were ones she qualified
  // for, which is a claim nobody had made. Two tabs, both true.
  const [tab, setTab] = useState("All schemes");
  const [cats, setCats] = useState<string[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  // No `useMemo`. It had one, with `[tab, cats]` and no `SCHEMES` — so the
  // list was computed once from the mock fallback and never recomputed when
  // the real schemes landed, while the count in the header above read the
  // server. The compiler memoizes this component; the memo bought nothing.
  const pool = tab === "Applied" ? SCHEMES.filter((s) => s.applied) : SCHEMES;
  const shown = cats.length ? pool.filter((s) => cats.includes(s.category)) : pool;

  const eligible = SCHEMES.filter((s) => s.eligible).length;

  return (
    <HomeShell
      active="/app/support-fund"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="What you will be asked for" sub="Have these ready and most applications take minutes" />
            <ul className="ux-stagger space-y-2.5">
              {[
                ["Aadhaar", true], ["PAN card", true], ["Bank passbook", true],
                ["Udyam registration", false], ["Proof of trade", false],
              ].map(([doc, have]) => (
                <li key={doc as string} className="flex items-center gap-2.5 text-[0.8125rem]">
                  <Icons.Check
                    className="h-[15px] w-[15px] shrink-0"
                    style={{ color: have ? "var(--ux-green-ink)" : "var(--ux-faint)" }}
                    strokeWidth={2.6}
                  />
                  <span className="flex-1" style={{ color: have ? "var(--ux-ink-2)" : "var(--ux-muted)" }}>{doc}</span>
                  {!have && <span className="text-[0.6875rem]" style={{ color: "var(--ux-orange-ink)" }}>missing</span>}
                </li>
              ))}
            </ul>
            <div className="mt-3.5">
              <Btn href="/app/documents" variant="soft" size="sm" full iconEnd="ArrowRight">Add what is missing</Btn>
            </div>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Nobody should charge you" icon="ShieldAlert" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Every scheme here is free to apply for. If an agent asks for a fee to “get it approved”,
              that is not how any of these work. Tell us and we will look into it.
            </p>
            <div className="mt-3.5">
              <Btn href="/app/safety" variant="outline" size="sm" full icon="Flag">Report an agent</Btn>
            </div>
          </Card>

          <div className="ux-clay ux-onscroll-soft relative overflow-hidden p-[20px]"
               style={{ background: "linear-gradient(140deg, var(--ux-tint-green), var(--ux-tint-lilac))" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img loading="lazy" decoding="async" src={SCHEME_ART.hero} alt=""
                 className="ux-float pointer-events-none absolute -bottom-3 -end-4 h-[100px] w-[100px] object-contain" />
            <h3 className="relative w-[60%] text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
              Not sure which?
            </h3>
            <p className="relative mt-2 w-[60%] text-[0.75rem] leading-relaxed" style={{ color: "var(--ux-muted)" }}>
              Tell Sakhi what you need the money for and she will narrow it down.
            </p>
            <div className="relative mt-3 w-[60%]">
              <Btn href="/app/sakhi" variant="soft" size="sm" iconEnd="ArrowRight">Ask Sakhi</Btn>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-[20px] flex items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Money you are owed</h1>
          <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
            {eligible} of {SCHEMES.length} look like they apply to you. All of them are free to apply for.
          </p>

      <SourceNote source={source} what="schemes" />
        </div>
        <Tabs items={["All schemes", "Applied"]} active={tab} onChange={setTab} />
      </div>

      <div className="mb-[16px] flex flex-wrap gap-2">
        {SCHEME_CATEGORIES.map((c) => (
          <Chip key={c} selected={cats.includes(c)}
                onClick={() => setCats(cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c])}>
            {plural(c, 2)}
          </Chip>
        ))}
      </div>

      {shown.length ? (
        <div className="ux-deck ux-stagger space-y-[12px]">
          {shown.map((s, i) => {
            const expanded = open === s.id;
            return (
              <Card key={s.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={s.icon} tint={s.tint} ink={s.ink} size={50} radius={13} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 text-[1rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {s.name}
                      </h3>
                      <Pill tone={s.category === "Loan" ? "green" : s.category === "Savings" ? "brand" : "blue"} size="sm">
                        {s.category}
                      </Pill>
                      {s.applied && <Pill tone="blue" size="sm">Applied</Pill>}
                    </div>
                    <p className="mt-0.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{s.body}</p>
                    <p className="mt-2 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{s.gives}</p>
                    <p className="mt-2 text-[1rem] font-bold" style={{ color: "var(--ux-ink)" }}>{s.amount}</p>
                  </div>
                </div>

                {/* Eligibility, in a sentence about her — not a rulebook. */}
                <div className="mt-3.5 flex items-start gap-2.5 rounded-[12px] p-3"
                     style={{ background: s.eligible ? "var(--ux-tint-green)" : "var(--ux-surface-2)" }}>
                  <Icons.Info className="mt-[1px] h-[15px] w-[15px] shrink-0"
                              style={{ color: s.eligible ? "var(--ux-green-ink)" : "var(--ux-muted)" }} />
                  <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
                    <strong style={{ color: s.eligible ? "var(--ux-green-ink)" : "var(--ux-muted)" }}>
                      {s.eligible ? "Looks like you qualify. " : "Probably not for you. "}
                    </strong>
                    {s.reason}
                  </p>
                </div>

                {expanded && (
                  <div className="ux-slide-up mt-3.5 border-t pt-3.5" style={{ borderColor: "var(--ux-line)" }}>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--ux-faint)" }}>
                      Who it is for
                    </p>
                    <p className="mt-1.5 text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>{s.who}</p>
                    <p className="mt-3.5 text-[0.6875rem] font-semibold uppercase tracking-[0.07em]" style={{ color: "var(--ux-faint)" }}>
                      What you will need
                    </p>
                    <ul className="mt-1.5 flex flex-wrap gap-1.5">
                      {s.needs.map((n) => (
                        <li key={n} className="ux-sq rounded-[8px] border px-2 py-[3px] text-[0.6875rem]"
                            style={{ borderColor: "var(--ux-line-strong)", color: "var(--ux-muted)" }}>{n}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-3.5 flex items-center justify-between gap-4 border-t pt-3.5"
                     style={{ borderColor: "var(--ux-line)" }}>
                  <span className="flex items-center gap-1.5 text-[0.75rem]" style={{ color: "var(--ux-faint)" }}>
                    <Icons.CalendarClock className="h-[14px] w-[14px]" /> {s.deadline}
                  </span>
                  <span className="flex items-center gap-2">
                    <Btn variant="outline" size="sm"
                         iconEnd={expanded ? "ChevronUp" : "ChevronDown"}
                         onClick={() => setOpen(expanded ? null : s.id)}>
                      {expanded ? "Less" : "The details"}
                    </Btn>
                    {s.applied
                      ? <Btn href={`/app/support-fund/${s.id}`} variant="soft" size="sm" icon="Clock">Track it</Btn>
                      : <Btn href={`/app/support-fund/${s.id}`} variant="primary" size="sm" iconEnd="ArrowRight">How to apply</Btn>}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            icon="Landmark"
            title={tab === "Applied" ? "You have not applied for anything yet" : "Nothing of that kind"}
            body="New schemes are added as governments announce them."
            action={<Btn onClick={() => { setTab("All schemes"); setCats([]); }} variant="soft">See all schemes</Btn>}
          />
        </Card>
      )}

      <AlsoHere
        items={[
          { href: "/app/cover", label: "Insurance & pension", note: "From ₹20 a year. Cover you are entitled to and may not know about.", icon: "ShieldCheck" },
        ]}
      />
    </HomeShell>
  );
}
