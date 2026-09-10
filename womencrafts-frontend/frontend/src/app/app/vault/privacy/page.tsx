"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, SectionHead, v } from "@/components/ux/kit";
import { GUARDS, type Guard } from "@/components/ux/vault/data";
import { useT } from "@/i18n";

/**
 * Who can see your money.
 *
 * Treated as product, not as a settings page nobody opens — and every default
 * is the private one. GSMA names safety and security as a top barrier to
 * women's further use of mobile internet, and the handset is very often not
 * hers: in Pakistan only 48% of women who use mobile internet on someone
 * else's phone use it daily, against 94% of those who own theirs.
 *
 * The framing matters too. Other products treat this as *hiding*, which is
 * furtive and makes her the one doing something wrong. This screen treats it
 * as *choosing what to show* — the same mechanism, told in a way she can
 * repeat out loud to the person holding the phone.
 */
export default function PrivacyPage() {
  const tr = useT();
  const router = useRouter();
  const [guards, setGuards] = useState<Guard[]>(GUARDS);
  const [note, setNote] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setGuards((rows) => {
      const next = rows.map((g) => (g.id === id ? { ...g, on: !g.on } : g));
      const g = next.find((x) => x.id === id);
      setNote(g?.on ? `On — ${g.label.toLowerCase()}.` : `Off. ${g?.label} is no longer protecting you.`);
      return next;
    });
  }, []);

  return (
    <HomeShell active="/app/vault">
      <div className="flex flex-col gap-5">
        <Back to="/app/vault" label={tr("vaultPrivacy.backToYourLocker")} />

        <header>
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("vaultPrivacy.whoCanSee")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("vaultPrivacy.youDecideWhatShows")}</h1>
          <p className="mt-1.5 max-w-[54ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Phones get shared. That is normal, and it should not cost you your privacy.
            All of this is on already — turn any of it off if you would rather.
          </p>
        </header>

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <SectionHead title={tr("vaultPrivacy.onThisPhone")} icon="ShieldCheck" />
          <div className="flex flex-col gap-2.5">
            {guards.map((g) => (
              <Card key={g.id} pad={16}>
                <div className="flex items-start gap-3.5">
                  <IconTile icon={g.icon}
                            tint={g.on ? "--ux-tint-violet" : "--ux-surface-2"}
                            ink={g.on ? "--ux-violet" : "--ux-muted"} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{g.label}</p>
                    <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-muted") }}>{g.note}</p>
                  </div>
                  <button
                    type="button" role="switch" aria-checked={g.on}
                    aria-label={`${g.on ? tr("vaultPrivacy.turnOff")
              : tr("vaultPrivacy.turnOn")}: ${g.label}`}
                    onClick={() => toggle(g.id)}
                    className="ux-press relative h-[28px] w-[50px] shrink-0 rounded-full transition-colors"
                    style={{ background: v(g.on ? "--ux-brand" : "--ux-line-strong") }}>
                    <span className="absolute top-[3px] h-[22px] w-[22px] rounded-full"
                          style={{ left: g.on ? 25 : 3, background: v("--ux-surface"),
                                   transition: "left var(--ux-t) var(--ux-ease-out)" }} />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={20} style={{ background: v("--ux-tint-pink"), borderColor: "transparent" }}>
          <div className="flex items-start gap-3.5">
            <IconTile icon="Users" tint="--ux-surface" ink="--ux-pink-ink" size={42} />
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("vaultPrivacy.whatYourCircleCanSee")}</p>
              <p className="mt-1.5 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                Only whether you have paid into the pot this round. Never your balance, never your
                pockets, never what you earned. Your circle vouches for you — it does not audit you.
              </p>
              <Btn size="sm" variant="outline" className="mt-3" href="/app/circles">{tr("vaultPrivacy.seeYourCircle")}</Btn>
            </div>
          </div>
        </Card>
      </div>
    </HomeShell>
  );
}
