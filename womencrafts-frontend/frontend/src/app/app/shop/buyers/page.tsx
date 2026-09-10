"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, SectionHead, Stat, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { BUYERS, quietScore, type Buyer } from "@/components/ux/shopplus/data";
import { useT } from "@/i18n";

/**
 * Who comes back.
 *
 * ── The finding this screen exists for ──────────────────────────────────────
 * A nationwide randomised evaluation of rural e-commerce found "little evidence
 * for income gains to rural producers"; J-PAL's review of fifteen trials found
 * limited benefit to small firms *on the platform*, because information
 * barriers and a crowded market made it impossible to stand out. What did work
 * was matching a producer to one specific committed buyer — Egyptian rug makers
 * gained 16–26% profits that way.
 *
 * So this is not a customer list. It is a screen about **turning the people who
 * already come back into people who have agreed to keep coming back.**
 *
 * ── And why there are no stars ──────────────────────────────────────────────
 * Most micro-sellers have almost no ratings, and displayed ratings are biased
 * upward by a well-documented reputational externality. Nosko & Tadelis'
 * alternative is to score on what buyers *don't* do — silence, repeat purchase,
 * absence of complaint. That is what "steady" means here, and it is available
 * from the very first order.
 */

const KIND: Record<Buyer["kind"], { label: string; icon: string; tint: string; ink: string }> = {
  woman: { label: "A woman near you", icon: "User", tint: "--ux-tint-pink", ink: "--ux-pink-ink" },
  shop: { label: "A shop", icon: "Store", tint: "--ux-tint-blue", ink: "--ux-blue-ink" },
  institution: { label: "An institution", icon: "Building2", tint: "--ux-tint-violet", ink: "--ux-violet" },
};

export default function BuyersPage() {
  const tr = useT();
  const router = useRouter();
  const [rows, setRows] = useState<Buyer[]>(BUYERS);
  const [note, setNote] = useState<string | null>(null);

  const sorted = useMemo(() => [...rows].sort((a, b) => quietScore(b) - quietScore(a)), [rows]);
  const steady = useMemo(() => sorted.filter((b) => b.repeat), [sorted]);
  const once = useMemo(() => sorted.filter((b) => !b.repeat), [sorted]);
  const committed = useMemo(() => rows.filter((b) => b.committed).length, [rows]);
  const spent = useMemo(() => rows.reduce((n, b) => n + b.spentMinor, 0), [rows]);
  const askable = useMemo(() => steady.filter((b) => !b.committed), [steady]);

  const commit = useCallback((id: string) => {
    setRows((r) => r.map((b) => (b.id === id ? { ...b, committed: true } : b)));
    const b = rows.find((x) => x.id === id);
    setNote(`Asked ${b?.name} for a standing order. One buyer who commits is worth more than a hundred who look.`);
  }, [rows]);

  const card = (b: Buyer) => {
    const k = KIND[b.kind];
    return (
      <Card key={b.id} pad={16}>
        <div className="flex flex-wrap items-start gap-3.5">
          <IconTile icon={k.icon} tint={k.tint} ink={k.ink} size={42} radius={12} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{b.name}</p>
              {b.committed && <Pill tone="green" size="sm">{tr("shopBuyers.standingOrder")}</Pill>}
              {b.repeat && !b.committed && <Pill tone="blue" size="sm">{tr("shopBuyers.comesBack")}</Pill>}
            </div>
            <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>
              {k.label} · last bought {b.lastOn}
            </p>
            <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{b.note}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-lg font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
              {formatRupees(b.spentMinor)}
            </p>
            <p className="mt-0.5 text-2xs" style={{ color: v("--ux-muted") }}>
              over {b.bought} {b.bought === 1 ? "order" : "orders"}
            </p>
          </div>
        </div>

        {/* The quiet signals — what she did NOT do. */}
        <div className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5 border-t pt-3" style={{ borderColor: v("--ux-line") }}>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: v(b.repeat ? "--ux-green-ink" : "--ux-muted") }}>
            <I name={b.repeat ? "Check" : "Minus"} className="h-[13px] w-[13px]" sw={2.6} />
            {b.repeat ? tr("shopBuyers.cameBack")
              : tr("shopBuyers.boughtOnce2")}
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold"
                style={{ color: v(b.complaints === 0 ? "--ux-green-ink" : "--ux-danger-solid") }}>
            <I name={b.complaints === 0 ? "Check" : "X"} className="h-[13px] w-[13px]" sw={2.6} />
            {b.complaints === 0 ? "Never complained" : `${b.complaints} complaints`}
          </span>
        </div>

        {b.repeat && !b.committed && (
          <Btn size="sm" full className="mt-3.5" onClick={() => commit(b.id)}>{tr("shopBuyers.askHerForAStandingOrder")}</Btn>
        )}
      </Card>
    );
  };

  return (
    <HomeShell active="/app/shop">
      <div className="flex flex-col gap-5">
        <Back to="/app/shop" label={tr("shopBuyers.backToYourShops")} />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("shopBuyers.yourBuyers")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("shopBuyers.oneSteadyBuyerBeatsAHundred")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Being seen by strangers changes very little. Someone who has agreed to keep buying
            changes what you can plan for.
          </p>
        </header>

        <Card>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat value={String(committed)} label={tr("shopBuyers.haveCommittedToKeepBuying")}
                  icon="Handshake" tint="--ux-tint-green" ink="--ux-green-ink" />
            <Stat value={String(steady.length)} label={tr("shopBuyers.comeBackWithoutBeingAsked")}
                  icon="Repeat" tint="--ux-tint-blue" ink="--ux-blue-ink" />
            <Stat value={formatRupees(spent)} label={tr("shopBuyers.theyHaveSpentWithYou")}
                  icon="Wallet" tint="--ux-tint-violet" ink="--ux-violet" />
          </div>
          {askable.length > 0 && (
            <div className="mt-4 border-t pt-3.5" style={{ borderColor: v("--ux-line") }}>
              <p className="text-xsm" style={{ color: v("--ux-ink-2") }}>
                <b>{askable.length}</b> {askable.length === 1 ? tr("shopBuyers.buyerAlreadyComesBack")
              : tr("shopBuyers.buyersAlreadyComeBack")} and
                {askable.length === 1 ? " has" : " have"} never complained. None of them has been asked for a standing order.
              </p>
            </div>
          )}
        </Card>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title={tr("shopBuyers.theyKeepComingBack")}
                       sub={tr("shopBuyers.rankedByRepeatBuyingAndQuiet")} icon="Handshake"
                       chip={String(steady.length)} />
          <div className="flex flex-col gap-3">{steady.map(card)}</div>
        </div>

        {once.length > 0 && (
          <div>
            <SectionHead title={tr("shopBuyers.boughtOnce")} sub={tr("shopBuyers.worthOneMessageBeforeTheSeason")} icon="User"
                         chip={String(once.length)} />
            <div className="flex flex-col gap-3">{once.map(card)}</div>
          </div>
        )}

        <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3">
            <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
            <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              There are no stars here on purpose. Most sellers have too few ratings for stars to mean
              anything, and the ones that exist are almost all five. Coming back, and not complaining,
              are harder to fake and available from the very first order.
            </p>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
