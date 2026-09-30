"use client";

import { useCallback, useState, useSyncExternalStore } from "react";

import {
  Btn, Card, EmptyState, IconTile, SectionHead, SourceNote, copy, plural,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ACCOUNT_ART as RAW_ACCOUNT_ART } from "@/components/ux/account/data";
import { useT } from "@/i18n";
import { GroupLabel } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";
import { apiReferrals, type ApiReferrals } from "@/lib/me-api";
import { useResource } from "@/lib/use-resource";

/** `plural` would say "womans". */
const women = (n: number) => (n === 1 ? "woman" : "women");

const EMPTY: ApiReferrals = { code: "", link: "", invited: 0, joined: 0, credit_per_join_label: "", message: "" };

/** Can this browser open the phone's share sheet? Read on the client only. */
const noop = () => () => {};
const canShareNow = () => typeof navigator !== "undefined" && typeof navigator.share === "function";
const canShareOnServer = () => false;

/**
 * Refer — bringing another woman in.
 *
 * Everything on this screen comes from `/me/referrals`: her code, her link and
 * how many women have joined with it (`users.referred_by`, written once by
 * `signup/complete`). The reward is not agreed yet, so no amount is shown —
 * the server sends `credit_per_join_label` empty until it is, and a figure
 * shown before then would be a promise nobody has made.
 */
export default function ReferPage() {
  const ACCOUNT_ART = useTranslated(RAW_ACCOUNT_ART);
  const tr = useT();
  const { data: r, source } = useResource(useCallback((s: AbortSignal) => apiReferrals(s), []), EMPTY);
  const canShare = useSyncExternalStore(noop, canShareNow, canShareOnServer);
  const [copied, setCopied] = useState<"code" | "link" | "failed" | null>(null);
  const shownLink = r.link.replace(/^https?:\/\//, "");
  const shareText = r.message || `Join me on WomSakhi — use my code ${r.code}.`;
  const reward = r.credit_per_join_label;

  /**
   * Put it on the clipboard, then say so — or say that it failed. A "Copied"
   * that did not copy sends her friend whatever was on the clipboard before.
   */
  const copyIt = async (what: "code" | "link", text: string) => {
    const said = await copy(text);
    setCopied(said === "Copied" ? what : "failed");
    window.setTimeout(() => setCopied(null), 2200);
  };

  /** The phone's own share sheet where there is one; copying the link where not. */
  const share = async () => {
    if (canShare) {
      try {
        await navigator.share({ title: "WomSakhi", text: shareText, url: r.link });
        return;
      } catch (e) {
        // She closed the sheet: nothing to do. Anything else: copy instead.
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    await copyIt("link", r.link);
  };

  return (
    <HomeShell
      active="/app/settings"
      rail={
        <div className="space-y-[16px]">
          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("refer.howItWorks")} icon="Info" />
            <ol className="space-y-3">
              {[
                "Share your code or link with a woman you know.",
                "She joins with it and gets verified — that part is free and always will be.",
                reward
                  ? `${reward}.`
                  : "Referral rewards are not live yet. We will tell you before they start.",
                "Each woman who joins with your link is counted here.",
              ].map((t, i) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>{i + 1}</span>
                  <span className="text-xsm leading-snug" style={{ color: "var(--ux-ink-2)" }}>{t}</span>
                </li>
              ))}
            </ol>
          </Card>

          <Card className="ux-onscroll-soft">
            <SectionHead title={tr("refer.pleaseDoNot")} icon="ShieldAlert" />
            <p className="text-xsm leading-relaxed" style={{ color: "var(--ux-ink-2)" }}>
              Share it with women who would actually use WomSakhi. Posting it to strangers gets accounts
              closed — hers and yours — and helps nobody.
            </p>
          </Card>
        </div>
      }
    >
      <h1 className="ux-screen-title text-2xl font-bold" style={{ color: "var(--ux-ink)" }}>{tr("refer.referAFriend")}</h1>
      <p className="mb-6 mt-1.5 text-xsm lg:mb-[20px]" style={{ color: "var(--ux-muted)" }}>
        {source === "loading" ? "\u00a0" : <>You have brought {r.invited} {women(r.invited)} in so far.</>}
      </p>

      <SourceNote source={source} what="referrals" />

      <div className="ux-sq ux-onscroll relative overflow-hidden rounded-[20px] p-[24px] max-lg:rounded-[16px] max-lg:p-4"
           style={{ background: "linear-gradient(100deg, var(--ux-brand-900) 0%, var(--ux-brand-700) 55%, var(--ux-brand-600) 100%)" }}>
        <span aria-hidden className="pointer-events-none absolute -end-12 -top-16 h-[220px] w-[220px] rounded-full"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.16), transparent 68%)" }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={ACCOUNT_ART.refer} alt=""
             className="ux-float pointer-events-none absolute -bottom-2 end-6 h-[124px] w-auto object-contain max-sm:hidden" />
        <div className="relative max-w-[62%] max-sm:max-w-full">
          <p className="text-xsm" style={{ color: "color-mix(in srgb, var(--ux-on-brand) 86%, transparent)" }}>
            {tr("refer.yourCode")}
          </p>
          <p className="mt-2 text-2xlm font-bold leading-none" style={{ color: "var(--ux-on-brand)" }} data-testid="refer-code">
            {r.code || "\u2014"}
          </p>

          {/* Announced, not just shown. The label swap on the button is silent
              to a screen reader — she presses Copy and hears nothing at all. */}
          <p role="status" className="sr-only">
            {copied === "code" ? "Referral code copied" : copied === "link" ? "Referral link copied"
              : copied === "failed" ? "Could not copy. Press and hold the link to copy it." : ""}
          </p>

          <div className="mt-4 flex flex-wrap gap-2.5">
            <Btn variant="soft" size="sm" icon="Share2" onClick={share} disabled={!r.code}>
              {tr("refer.share")}
            </Btn>
            <Btn variant="on-brand" size="sm" icon={copied === "code" ? "Check" : "Copy"} disabled={!r.code}
                 onClick={() => copyIt("code", r.code)}>
              {copied === "code" ? "Copied" : "Copy code"}
            </Btn>
            <Btn variant="on-brand" size="sm" icon={copied === "link" ? "Check" : "Link2"} disabled={!r.link}
                 onClick={() => copyIt("link", r.link)}>
              {copied === "link" ? "Copied" : "Copy link"}
            </Btn>
            {r.link && (
              <Btn href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${r.link}`)}`}
                   variant="on-brand" size="sm" icon="MessageCircle">{tr("refer.sendOnWhatsapp")}</Btn>
            )}
          </div>

          {copied === "failed" ? (
            <p className="mt-3 text-xs font-semibold" style={{ color: "var(--ux-on-brand)" }}>
              Could not copy. Press and hold the link below to copy it.
            </p>
          ) : null}
          <p className="mt-3 select-all break-all text-xs" style={{ color: "color-mix(in srgb, var(--ux-on-brand) 70%, transparent)" }}>{shownLink}</p>
        </div>
      </div>

      <div className="ux-deck mt-[16px] grid grid-cols-2 gap-[16px]">
        {[
          [`${r.invited}`, tr("refer.signedUp"), "UserPlus", "--ux-tint-violet", "--ux-violet", "refer-invited"],
          [`${r.joined}`, tr("refer.nowMembers"), "UserCheck", "--ux-tint-green", "--ux-green", "refer-joined"],
        ].map(([v, label, icon, tint, ink, id], i) => (
          <Card key={id} className="ux-i ux-onscroll" style={{ ["--i" as string]: i }}>
            <div className="flex items-center gap-3.5">
              <IconTile icon={icon} tint={tint} ink={ink} size={44} radius={12} />
              <div className="min-w-0">
                <p className="text-xl font-bold leading-none tabular-nums" style={{ color: "var(--ux-ink)" }} data-testid={id}>
                  {source === "loading" ? "\u2013" : v}
                </p>
                <p className="mt-1.5 text-xs" style={{ color: "var(--ux-muted)" }}>{label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-[24px]">
        <GroupLabel sub={tr("refer.andWhereEachOfThemHas")}>{tr("refer.womenYouBroughtIn")}</GroupLabel>
        <div className="hidden lg:block">
          <SectionHead title={tr("refer.womenYouBroughtIn")} sub={tr("refer.andWhereEachOfThemHas")} />
        </div>
        {r.invited > 0 ? (
          /* The server counts the women she brought in; it does not name them to her. */
          <Card>
            <p className="text-sm" style={{ color: "var(--ux-ink-2)" }}>
              {r.invited} {women(r.invited)} signed up with your code
              {r.joined ? `, and ${r.joined} ${r.joined === 1 ? "is" : "are"} now verified ${plural("member", r.joined)}` : ""}.
              Their names are not listed here.
            </p>
          </Card>
        ) : (
          <Card>
            <EmptyState icon="Users" title={tr("refer.nobodyYet")}
                        body={tr("refer.shareYourCodeWithOneWoman")} />
          </Card>
        )}
      </div>
    </HomeShell>
  );
}
