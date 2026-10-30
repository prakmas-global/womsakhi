"use client";

import { PlaceMark } from "@/components/ux/nav/Place";
import { useCallback, useState } from "react";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Back, Btn, Card, I, IconTile, SectionHead, ScreenSkeleton, v } from "@/components/ux/kit";
import { MOVE_REASONS as RAW_MOVE_REASONS } from "@/components/ux/together/data";
import { toast } from "@/components/ux/mobile/Toast";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { PhoneTitle } from "@/components/ux/PhoneParts";
import { useResource } from "@/lib/use-resource";
import { apiChecklist, apiSaveChecklist, type Checklist } from "@/lib/my-records-api";

/**
 * If you move.
 *
 * Women move — for marriage, for work, because something ended — and lose
 * their customers, their savings group and everyone who would vouch for them
 * on the same day.
 *
 * ── What was here ───────────────────────────────────────────────────────────
 * A list of things that "travel with you automatically" and a "Get me ready"
 * button that set a flag in the browser and said "three circles near your new
 * address have been asked whether they have room". None of it happened.
 *
 * ── What it is now ──────────────────────────────────────────────────────────
 * A checklist of things she can actually do before she goes, each one a link
 * to the real screen that does it, ticked on the server so it is still there
 * next week (`/me/checklists/move`). Her reason is never saved and never
 * asked about — choosing one only changes which steps come first.
 */

type Step = { id: string; title: string; why: string; href: string; icon: string; cta: string };

const STEPS: Step[] = [
  { id: "proof", title: "Download your proof of earnings", why: "A landlord or a new bank in the new town will ask. It works anywhere.", href: "/app/books/proof", icon: "Receipt", cta: "Get my statement" },
  { id: "certs", title: "Keep your certificates and verified skills", why: "Anyone can check them at a link — new customers and employers too.", href: "/app/certificates", icon: "Award", cta: "My certificates" },
  { id: "papers", title: "Check your papers", why: "See which documents you have, and what needs redoing in a new state.", href: "/app/haq/papers", icon: "FileText", cta: "My papers" },
  { id: "circle", title: "Settle your circle money", why: "Pay or collect this round before you go, so nobody is left waiting.", href: "/app/circles", icon: "Users", cta: "My circles" },
  { id: "shop", title: "Tell your customers", why: "Pause your shop or change where you deliver, so no order goes unanswered.", href: "/app/documents", icon: "Store", cta: "My shop" },
  { id: "town", title: "Change your town on your work profile", why: "Work near your new home will start finding you.", href: "/app/work/profile", icon: "MapPin", cta: "My work profile" },
  { id: "address", title: "Update your address", why: "So deliveries and documents reach the right door.", href: "/app/settings/account", icon: "Home", cta: "My details" },
  { id: "newcircle", title: "Find a circle in the new place", why: "Being nobody in a new town is the hardest part. Join one in your first week.", href: "/app/circles", icon: "HeartHandshake", cta: "Find circles" },
];

/** Which steps come first for each reason. Nothing about the reason is stored. */
const FIRST: Record<string, string[]> = {
  m1: ["newcircle", "proof", "papers"],
  m2: ["town", "proof", "shop"],
  m3: ["circle", "shop", "papers"],
  m4: ["papers", "proof", "circle"],
};

export default function MovePage() {
  const MOVE_REASONS = useTranslated(RAW_MOVE_REASONS);
  const tr = useT();
  const [reason, setReason] = useState<string | null>(null);
  const list = useResource(useCallback((s: AbortSignal) => apiChecklist("move", s), []), null as Checklist | null);
  const [done, setDone] = useState<string[] | null>(null);
  const ticked = done ?? list.data?.done ?? [];
  const [busy, setBusy] = useState("");

  const toggle = async (id: string) => {
    const next = ticked.includes(id) ? ticked.filter((x) => x !== id) : [...ticked, id];
    setDone(next); setBusy(id);
    try { await apiSaveChecklist("move", { done: next }); }
    catch { setDone(ticked); toast("That did not save. Try again.", { tone: "error" }); }
    finally { setBusy(""); }
  };

  const order = reason ? FIRST[reason] ?? [] : [];
  const steps = [...STEPS].sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const count = STEPS.filter((s) => ticked.includes(s.id)).length;

  return (
    <HomeShell active="/app/together">
      <div className="flex flex-col gap-5">
        <div className="hidden lg:flex"><Back to="/app/together" label={tr("togetherMove.backToTogether")} /></div>

        <PhoneTitle title={tr("togetherMove.ifYouMove")} sub="Keep what you built"
                    note="Most women move at least once, and lose their customers, their circle and everyone who would vouch for them on the same day. These steps keep it with you." />
        <header className="hidden lg:block">
          <p className="text-2xs font-extrabold uppercase tracking-[0.2em]" style={{ color: v("--ux-brand") }}>{tr("togetherMove.ifYouMove")}</p>
          <div className="mt-2 flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="text-[clamp(1.5rem,3.2vw,2.125rem)] font-extrabold leading-[1.1] tracking-[-0.035em] min-w-0"
                style={{ color: v("--ux-ink") }}>Keep what you built</h1>
          </div>
          <p className="mt-1.5 max-w-[56ch] text-sm leading-relaxed" style={{ color: v("--ux-muted") }}>
            Most women move at least once, and lose their customers, their circle and everyone who would vouch for
            them on the same day. These eight steps keep it with you — tick them off as you go.
          </p>
        </header>

        <div>
          <SectionHead title={tr("togetherMove.whatIsTakingYou")} sub="Only changes which steps come first. Nothing about it is saved." icon="MapPin" />
          <div className="grid gap-3 sm:grid-cols-2">
            {MOVE_REASONS.map((r) => (
              <button key={r.id} type="button" onClick={() => setReason(reason === r.id ? null : r.id)} aria-pressed={reason === r.id}
                      className="ux-press ux-sq flex items-start gap-3.5 rounded-[var(--ux-r-card)] border p-4 text-left"
                      style={{ borderColor: v(reason === r.id ? "--ux-brand" : "--ux-line"),
                               background: v(reason === r.id ? "--ux-brand-tint" : "--ux-surface") }}>
                <IconTile icon={r.icon} tint="--ux-surface-2" ink="--ux-brand" size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{r.label}</p>
                  <p className="mt-1 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>
                    {r.id === "m4" ? "We will not ask why." : r.note}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {reason === "m4" && (
          <Card pad={16} style={{ background: v("--ux-tint-violet"), borderColor: "transparent" }}>
            <div className="flex items-start gap-3">
              <I name="Shield" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-violet") }} />
              <p className="text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
                We do not ask why and we do not save this choice. Nobody in your circles is told you are moving unless you tell them.
                If you are not safe now, the Safety screen has numbers you can call at any hour.
              </p>
            </div>
            <div className="mt-3"><Btn size="sm" variant="outline" href="/app/safety" icon="Shield">Open Safety</Btn></div>
          </Card>
        )}

        <div>
          <SectionHead title="Before you go" sub={`${count} of ${STEPS.length} done`} icon="ListChecks" />
          {list.source === "loading" && !list.data ? <ScreenSkeleton shape="list" /> : (
            <div className="flex flex-col gap-2.5">
              {steps.map((s) => {
                const on = ticked.includes(s.id);
                return (
                  <Card key={s.id} pad={16}>
                    <div className="flex items-start gap-3.5">
                      <button type="button" role="checkbox" aria-checked={on} aria-label={`Done: ${s.title}`}
                              disabled={busy === s.id} onClick={() => void toggle(s.id)}
                              className="ux-press mt-0.5 grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] border-2"
                              style={{ borderColor: v(on ? "--ux-green-ink" : "--ux-line-strong"), background: v(on ? "--ux-green-ink" : "--ux-surface") }}>
                        {on && <I name="Check" className="h-[14px] w-[14px]" style={{ color: "#fff" }} sw={3} />}
                      </button>
                      <IconTile icon={s.icon} tint={on ? "--ux-tint-green" : "--ux-surface-2"} ink={on ? "--ux-green-ink" : "--ux-brand"} size={38} />
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold ${on ? "line-through" : ""}`} style={{ color: v(on ? "--ux-muted" : "--ux-ink") }}>{s.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed" style={{ color: v("--ux-muted") }}>{s.why}</p>
                      </div>
                      <Btn size="sm" variant="ghost" href={s.href} iconEnd="ArrowRight" className="max-sm:hidden">{s.cta}</Btn>
                    </div>
                    <div className="mt-2 sm:hidden"><Btn size="sm" variant="outline" full href={s.href} iconEnd="ArrowRight">{s.cta}</Btn></div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </HomeShell>
  );
}
