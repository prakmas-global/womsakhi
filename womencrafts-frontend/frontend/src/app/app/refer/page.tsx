"use client";

import { useState } from "react";

import {
  Btn, Card, EmptyState, IconTile, Pill, SectionHead, SourceNote, copy, plural,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { useReferrals } from "@/components/ux/live";
import { ACCOUNT_ART, rupees } from "@/components/ux/account/data";

/**
 * Refer — bringing another woman in.
 *
 * The reward is stated with its condition attached, every single time. "Earn
 * ₹250" with the condition in small print further down is how a referral scheme
 * turns into a grievance: she tells a friend, the friend joins, nothing
 * arrives, and she has spent her own credibility.
 */
export default function ReferPage() {
  const { data: ref, source } = useReferrals();
  const REFER = ref.refer;
  const REFERRALS = ref.people;
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  /**
   * Put it on the clipboard, then say so.
   *
   * This set a label and nothing else. She tapped "Copy link", read "Copied",
   * pasted into WhatsApp and sent whatever had been on her clipboard before —
   * which is how a referral, and the money attached to it, goes to nobody.
   * The kit has a `copy()` that actually writes; this screen defined its own
   * that did not.
   */
  const copyIt = async (what: "code" | "link", text: string) => {
    const said = await copy(text);
    if (said !== "Copied") return;
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1800);
  };

  const earning = REFERRALS.filter((r) => r.state === "Earning").length;

  return (
    <HomeShell
      active="/app/settings"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title="How it works" icon="Info" />
            <ol className="space-y-3">
              {[
                "Share your code with a woman you know.",
                "She joins and gets verified — that part is free and always will be.",
                `She finishes her first course. Only then does ${rupees(REFER.reward_minor)} reach your wallet.`,
                "There is no limit, and no reward for you if she never starts.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-[0.8125rem] leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title="Please do not" icon="ShieldAlert" />
            <p className="text-[0.8125rem] leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Share it with women who would actually use WomSakhi. Posting it to strangers gets accounts
              closed — hers and yours — and helps nobody.
            </p>
          </Card>
        </div>
      }
    >
      <h1 className="text-[1.5rem] font-bold" style={{ color: "var(--ux-ink)" }}>Refer a friend</h1>
      <p className="mb-[20px] mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-muted)" }}>
        You have brought {REFERRALS.length} {plural("woman", REFERRALS.length)} in so far.
      </p>

      <SourceNote source={source} what="referrals" />

      <div className="ux-sq ux-onscroll relative overflow-hidden rounded-[20px] p-[24px]"
           style={{ background: "linear-gradient(100deg, var(--ux-brand-900) 0%, var(--ux-brand-700) 55%, var(--ux-brand-600) 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -end-12 -top-16 h-[220px] w-[220px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 68%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={ACCOUNT_ART.refer} alt=""
             className="ux-float pointer-events-none absolute -bottom-2 end-6 h-[124px] w-auto object-contain" />
        <div className="relative max-w-[62%]">
          {/* The condition travels with the number, always. */}
          <p className="text-[0.8125rem]" style={{ color: "rgba(255,255,255,0.86)" }}>
            {rupees(REFER.reward_minor)} for each woman you bring — {REFER.condition}.
          </p>
          <p className="mt-2 text-[1.75rem] font-bold leading-none text-white">{REFER.code}</p>

          {/* Announced, not just shown. The label swap on the button is silent
              to a screen reader — she presses Copy and hears nothing at all. */}
          <p role="status" className="sr-only">
            {copied === "code" ? "Referral code copied" : copied === "link" ? "Referral link copied" : ""}
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Btn variant="soft" size="sm" icon={copied === "code" ? "Check" : "Copy"} onClick={() => void copyIt("code", REFER.code)}>
              {copied === "code" ? "Copied" : "Copy code"}
            </Btn>
            <Btn variant="on-brand" size="sm" icon={copied === "link" ? "Check" : "Link"} onClick={() => void copyIt("link", `https://${REFER.link}`)}>
              {copied === "link" ? "Copied" : "Copy link"}
            </Btn>
            <Btn href={`https://wa.me/?text=${encodeURIComponent(`Join me on WomSakhi — use my code ${REFER.code}. https://${REFER.link}`)}`}
                 variant="on-brand" size="sm" icon="MessageCircle">
              Send on WhatsApp
            </Btn>
          </div>

          <p className="mt-3 truncate text-[0.75rem]" style={{ color: "rgba(255,255,255,0.7)" }}>{REFER.link}</p>
        </div>
      </div>

      <div className="ux-deck mt-[16px] grid grid-cols-2 gap-[16px]">
        {[
          [rupees(REFER.earned_minor), "Earned so far", "BadgeIndianRupee", "--ux-tint-green", "--ux-green"],
          [`${earning}`, `Now earning${earning === 1 ? "" : ""}`, "TrendingUp", "--ux-tint-violet", "--ux-violet"],
        ].map(([v, label, icon, tint, ink], i) => (
          <Card key={label} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
            <div className="flex items-center gap-3.5">
              <IconTile icon={icon} tint={tint} ink={ink} size={44} radius={12} />
              <div className="min-w-0">
                <p className="text-[1.25rem] font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }}>{v}</p>
                <p className="mt-1.5 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-[24px]">
        <SectionHead title="Women you brought in" sub="And where each of them has got to" />
        {REFERRALS.length ? (
          <div className="ux-deck ux-stagger space-y-[12px]">
            {REFERRALS.map((r, i) => (
              <Card key={r.id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
                <div className="flex items-center gap-3.5">
                  <span className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-full"
                        style={{ background: "var(--ux-brand-tint)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img loading="lazy" decoding="async" src={r.avatar} alt="" className="ux-art h-full w-full object-cover" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="min-w-0 flex-1 truncate text-[0.875rem] font-semibold" style={{ color: "var(--ux-ink)" }}>
                        {r.name}
                      </h3>
                      <Pill tone={r.state === "Earning" ? "green" : "neutral"} size="sm">{r.state}</Pill>
                    </div>
                    <p className="mt-1 text-[0.75rem]" style={{ color: "var(--ux-muted)" }}>Joined {r.joined}</p>
                    <p className="mt-1.5 text-[0.8125rem]" style={{ color: "var(--ux-ink-2)" }}>{r.note}</p>
                  </div>
                  <div className="shrink-0 text-end">
                    {r.reward_minor > 0 ? (
                      <>
                        <p className="text-[1rem] font-bold tabular-nums" style={{ color: "var(--ux-green-ink)" }}>
                          +{rupees(r.reward_minor)}
                        </p>
                        <p className="mt-0.5 text-[0.6875rem]" style={{ color: "var(--ux-faint)" }}>paid to you</p>
                      </>
                    ) : (
                      /* Never imply a reward that has not been earned. */
                      <p className="text-[0.75rem] leading-snug" style={{ color: "var(--ux-faint)" }}>
                        Nothing yet —<br />she has not finished a course
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState icon="Users" title="Nobody yet"
                        body="Share your code with one woman who would use this." />
          </Card>
        )}
      </div>
    </HomeShell>
  );
}
