"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, Pill, SectionHead, v } from "@/components/ux/kit";
import { CARRIES as RAW_CARRIES, MOVE_REASONS as RAW_MOVE_REASONS } from "@/components/ux/together/data";
import { useT } from "@/i18n";
import { ListGroup } from "@/components/ux/mobile/ListRow";
import { GroupLabel, PhoneRow, PhoneTitle, phonePrimary } from "@/components/ux/PhoneParts";
import { useTranslated } from "@/i18n/data";

/**
 * If you move.
 *
 * ── The moment women lose everything at once ────────────────────────────────
 * Women move — for marriage, for work, for a husband's job, because something
 * ended. And when she moves she loses her customers, her savings group, her
 * standing, and everyone who would vouch for her, all on the same day. She
 * starts again from zero somewhere she knows nobody.
 *
 * No platform prepares for this. It is one of the clearest gaps in the whole
 * review, and it is also how the product crosses cities and borders without
 * marketing: she is the seed in the new place.
 *
 * ── One design decision worth defending ─────────────────────────────────────
 * "Somewhere safer" is one of the reasons offered, stated plainly and without
 * asking why. A woman leaving a dangerous house should not have to explain
 * herself to a form — and nothing in what she carries names where she has gone.
 */
export default function MovePage() {
  const CARRIES = useTranslated(RAW_CARRIES);
  const MOVE_REASONS = useTranslated(RAW_MOVE_REASONS);
  const tr = useT();
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const prepare = useCallback(() => {
    setPrepared(true);
    setNote("Ready. Everything below travels with you — nothing says where you have gone.");
  }, []);

  return (
    <HomeShell active="/app/together">
      <div className="flex flex-col gap-5">
        {/* The top bar carries the way back on a phone; this one is the desktop's. */}
        <div className="hidden lg:flex">
          <Back to="/app/together" label={tr("togetherMove.backToTogether")} />
        </div>

        <PhoneTitle title={tr("togetherMove.ifYouMove")} sub={tr("togetherMove.whatYouBuiltComesWithYou")}
                    note={tr("togetherMove.mostWomenMoveAtLeastOnce")} />
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("togetherMove.ifYouMove")}</p>
          <h1 className="mt-2 text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em]"
              style={{ color: v("--ux-ink") }}>{tr("togetherMove.whatYouBuiltComesWithYou")}</h1>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Most women move at least once, and usually lose their customers, their circle and
            everyone who would vouch for them on the same day. It does not have to work like that.
          </p>
        </header>

        <div>
          <GroupLabel sub={tr("togetherMove.itChangesWhatWePrepareAnd")}>{tr("togetherMove.whatIsTakingYou")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("togetherMove.whatIsTakingYou")} sub={tr("togetherMove.itChangesWhatWePrepareAnd")}
                         icon="MapPin" />
          </div>
          {/* One of four, so on a phone it is a list with a checkmark. */}
          <ListGroup className="lg:hidden">
            {MOVE_REASONS.map((r) => (
              <PhoneRow key={r.id} icon={r.icon} tint="--ux-surface-2" ink="--ux-brand"
                        title={r.label} meta={r.note} selected={reason === r.id}
                        onClick={() => { setReason(r.id); setPrepared(false); }} />
            ))}
          </ListGroup>
          <div className="hidden gap-3 sm:grid-cols-2 lg:grid">
            {MOVE_REASONS.map((r) => (
              <button key={r.id} type="button" onClick={() => { setReason(r.id); setPrepared(false); }}
                      aria-pressed={reason === r.id}
                      className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left"
                      style={{
                        borderColor: v(reason === r.id ? "--ux-brand" : "--ux-line"),
                        background: v(reason === r.id ? "--ux-brand-tint" : "--ux-surface"),
                      }}>
                <IconTile icon={r.icon} tint="--ux-surface-2" ink="--ux-brand" size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{r.label}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{r.note}</p>
                </div>
                {reason === r.id && (
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full"
                        style={{ background: v("--ux-brand"), color: v("--ux-on-brand-btn-ink") }}>
                    <I name="Check" className="h-[12px] w-[12px]" sw={3} />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {reason === "m4" && (
          <Card pad={16} style={{ background: v("--ux-tint-violet"), borderColor: "transparent" }}>
            <div className="flex items-start gap-3">
              <I name="Shield" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-violet") }} />
              <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                We will not ask you anything more. Nothing you carry will say where you have gone,
                nobody in your old circle is told, and your new circle sees only that you were
                vouched for.
              </p>
            </div>
          </Card>
        )}

        {note && (
          <Card pad={16} style={{ background: v("--ux-tint-green"), borderColor: "transparent" }}>
            <p className="flex items-center gap-2 text-xsm font-semibold" style={{ color: v("--ux-green-ink") }}>
              <I name="CheckCircle2" className="h-[16px] w-[16px]" />{note}
            </p>
          </Card>
        )}

        <div>
          <GroupLabel sub={tr("togetherMove.yoursAndPortableNotOursTo")} count={CARRIES.length}>{tr("togetherMove.whatTravelsWithYou")}</GroupLabel>
          <div className="hidden lg:block">
            <SectionHead title={tr("togetherMove.whatTravelsWithYou")} sub={tr("togetherMove.yoursAndPortableNotOursTo")}
                         icon="Briefcase" chip={String(CARRIES.length)} />
          </div>
          <ListGroup className="lg:hidden">
            {CARRIES.map((c) => (
              <PhoneRow key={c.id} icon={c.icon}
                        tint={c.automatic ? "--ux-tint-green" : "--ux-tint-amber"}
                        ink={c.automatic ? "--ux-green-ink" : "--ux-amber-ink"}
                        title={
                          <span className="flex flex-wrap items-center gap-2">
                            {c.label}
                            {!c.automatic && <Pill tone="orange" size="sm">{tr("togetherMove.youAskForThisOne")}</Pill>}
                          </span>
                        }
                        meta={c.detail}
                        trailing={c.automatic
                          ? <I name="Check" className="mt-1 h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.8} />
                          : undefined} />
            ))}
          </ListGroup>
          <div className="hidden flex-col gap-2.5 lg:flex">
            {CARRIES.map((c) => (
              <Card key={c.id} pad={16}>
                <div className="flex items-center gap-3.5">
                  <IconTile icon={c.icon}
                            tint={c.automatic ? "--ux-tint-green" : "--ux-tint-amber"}
                            ink={c.automatic ? "--ux-green-ink" : "--ux-amber-ink"} size={38} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{c.label}</p>
                      {!c.automatic && <Pill tone="orange" size="sm">{tr("togetherMove.youAskForThisOne")}</Pill>}
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: v("--ux-muted") }}>{c.detail}</p>
                  </div>
                  {c.automatic && (
                    <I name="Check" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-green-ink") }} sw={2.8} />
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>

        <Card pad={20} style={{ background: v("--ux-tint-pink"), borderColor: "transparent" }}>
          <div className="flex flex-wrap items-start gap-4">
            <IconTile icon="Handshake" tint="--ux-surface" ink="--ux-pink-ink" size={46} radius={13} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold" style={{ color: v("--ux-ink") }}>{tr("togetherMove.anIntroductionAtTheOtherEnd")}</p>
              <p className="mt-1.5 max-w-[52ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                The hardest part is not the paperwork. It is being nobody in a new place. Your
                circle can vouch for you to a circle where you are going — that is worth more than
                any document here.
              </p>
            </div>
            <Btn disabled={!reason || prepared} onClick={prepare} className={phonePrimary}>
              {prepared ? "Ready" : "Get me ready"}
            </Btn>
          </div>
        </Card>

        {prepared && (
          <Card pad={16}>
            <SectionHead title={tr("togetherMove.whenYouArrive")} icon="MapPin" />
            <ol className="flex flex-col gap-2.5">
              {[
                "Your statement of earnings works anywhere — show it to a landlord on day one.",
                "Your papers list what has to be redone in the new state, and what does not.",
                "Three circles near your new address have been asked whether they have room.",
                "Your pot record travels, so you do not start at the back of the queue.",
              ].map((s, i) => (
                <li key={s} className="flex items-start gap-2.5 text-xsm leading-relaxed"
                    style={{ color: v("--ux-ink-2") }}>
                  <span className="grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>
    </HomeShell>
  );
}
