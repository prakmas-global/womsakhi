"use client";

import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HomeShell } from "@/components/ux/home/HomeShell";
import { Btn, Card, EmptyState, I, IconTile, ScreenSkeleton, SectionHead, v } from "@/components/ux/kit";
import { formatRupees } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { PAPERS as RAW_PAPERS, STATUS_LABEL as RAW_STATUS_LABEL, STATUS_TONE as RAW_STATUS_TONE, fromScheme, type HaqStatus, type Paper } from "@/components/ux/haq/data";
import { ClaimSteps, Countdown } from "@/components/ux/haq/parts";
import { toast } from "@/components/ux/mobile/Toast";
import { useResource } from "@/lib/use-resource";
import { apiErrorMessage } from "@/lib/api";
import { apiCreateReminder } from "@/lib/engines-api";
import { apiHaq, apiPapers, apiSetHaq, type PaperStates } from "@/lib/life-api";
import { apiScheme, type HaqStatesWithProfile, type Scheme } from "@/lib/haq-api";
import { useT } from "@/i18n";
import { useTranslated } from "@/i18n/data";
import { artFor } from "@/components/ux/media/art";

/**
 * One benefit, and the exact next thing to do about it.
 *
 * Everything on this screen is real now:
 *  - the scheme comes from the server catalogue (staff-managed), not a constant;
 *  - "Where does it stand for you" writes her status (PUT /me/haq/{key}), and
 *    the default is "Not checked yet", never "you qualify";
 *  - "Do it on the phone" opens the official site and the helpline the
 *    catalogue holds, and "Where to go" shows its office and steps;
 *  - "Remind me" makes a real reminder (POST /engines/reminders);
 *  - the "women who will go with you" were fixture names — gone. In their place
 *    a real count of women here claiming it, shown only from five upwards so it
 *    can never point at one person, and a way to ask her own circle.
 */

const STATUS_PICKS: { status: HaqStatus; label: string }[] = [
  { status: "unknown", label: "Not checked yet" },
  { status: "can-claim", label: "I qualify, not applied" },
  { status: "waiting", label: "Applied, waiting" },
  { status: "receiving", label: "I get it" },
  { status: "at-risk", label: "I get it, but a date is coming" },
  { status: "stopped", label: "It stopped" },
];

const STOP_REASONS = [
  "e-KYC was not finished", "The yearly life certificate was not given", "Bank account not linked to Aadhaar",
  "Name removed from the list", "No reason given",
];
const DATE_ACTIONS = ["Finish e-KYC", "Give the life certificate", "Re-verify the family list", "Renew the card"];
const DATE_WHEN = [{ days: 7, label: "Within a week" }, { days: 30, label: "Within a month" }];

function isoInDays(days: number, hour = 10) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

export default function HaqDetail({ params }: { params: Promise<{ id: string }> }) {
  const STATUS_LABEL = useTranslated(RAW_STATUS_LABEL);
  const STATUS_TONE = useTranslated(RAW_STATUS_TONE);
  const PAPER_TYPES = useTranslated(RAW_PAPERS);
  const tr = useT();
  const { id } = use(params);
  const router = useRouter();

  const scheme = useResource<Scheme | null>(useCallback((sig: AbortSignal) => apiScheme(id, sig), [id]), null);
  const haqState = useResource<HaqStatesWithProfile>(
    useCallback((sig: AbortSignal) => apiHaq(sig) as Promise<HaqStatesWithProfile>, []),
    { states: {}, default: "unknown", tracked: 0 },
  );
  const paperState = useResource<PaperStates>(
    useCallback((sig: AbortSignal) => apiPapers(sig), []),
    { states: {}, default: "missing", held: 0 },
  );

  const h = useMemo(
    () => (scheme.data ? fromScheme(scheme.data, haqState.data.states[scheme.data.key], haqState.data.profile?.tags ?? []) : null),
    [scheme.data, haqState.data],
  );
  const PAPERS = useMemo(() => PAPER_TYPES.map((x) => {
    const mine = paperState.data.states[x.id];
    return { ...x, state: mine?.state ?? "missing", expires: mine?.expires || undefined };
  }), [PAPER_TYPES, paperState.data.states]);
  const needed: Paper[] = useMemo(
    () => (h?.needs ?? []).map((n) => PAPERS.find((p) => p.id === n)).filter(Boolean) as Paper[],
    [h, PAPERS],
  );
  const extraNeeds = useMemo(
    () => (h?.needsText ?? []).filter((t) => !needed.some((p) => t.toLowerCase().includes(p.name.toLowerCase().split(" ")[0]))),
    [h, needed],
  );
  const blocking = useMemo(() => needed.filter((p) => p.state !== "held"), [needed]);

  const [reminding, setReminding] = useState(false);
  /** Which follow-up is open: why it stopped, or what has to happen. */
  const [follow, setFollow] = useState<"" | "stopped" | "at-risk">("");
  const [saving, setSaving] = useState(false);

  const setStatus = useCallback(async (status: HaqStatus, extra: { action?: string; stopped_because?: string; due_on?: string } = {}) => {
    if (!h) return;
    setSaving(true);
    try {
      await apiSetHaq(h.key, { status, ...extra });
      haqState.refetch();
      toast("Saved", { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally { setSaving(false); }
  }, [h, haqState]);

  const remind = useCallback(async (label: string) => {
    if (!h) return;
    const days = label === "Tomorrow" ? 1 : label === "In 3 days" ? 3 : label === "In a week" ? 7
      : Math.max(1, (h.dueDays ?? 4) - 3);
    try {
      await apiCreateReminder({
        title_key: `${h.name}: ${h.action || "check where it stands"}`,
        schedule_type: "once", category: "haq", at: isoInDays(days),
        payload: { href: `/app/haq/${h.key}` },
      });
      setReminding(false);
      toast(`We will remind you ${label.toLowerCase()}`, { tone: "success" });
    } catch (e) {
      toast(apiErrorMessage(e, "The reminder did not save. Try again."), { tone: "error" });
    }
  }, [h]);

  if (scheme.source === "loading" && !scheme.data) {
    return <HomeShell active="/app/haq"><ScreenSkeleton shape="list" /></HomeShell>;
  }
  if (!h) {
    return (
      <HomeShell active="/app/haq">
        <Card>
          <EmptyState icon="SearchX" title={tr("haq.thatIsNotOneOfYours")}
                      body="It may have been removed from the list, or it is for another state."
                      action={<Btn size="sm" href="/app/haq">{tr("haq.backToHaq")}</Btn>} />
        </Card>
      </HomeShell>
    );
  }

  const tone = STATUS_TONE[h.status];
  // Where she is: papers → (someone with her) → office → waiting → arriving.
  const step = h.status === "receiving" || h.status === "at-risk" ? 4
    : h.status === "waiting" ? 3
    : blocking.length > 0 ? 0 : 1;
  const reminderChoices = ["Tomorrow", "In 3 days", "In a week",
    ...(typeof h.dueDays === "number" && h.dueDays > 4 ? ["3 days before it is due"] : [])];

  return (
    <HomeShell active="/app/haq">
      <div className="flex flex-col gap-5">
        <Link href="/app/haq" className="ux-press inline-flex w-fit items-center gap-1.5 text-xsm font-semibold"
              style={{ color: v("--ux-muted") }}>
          <I name="ArrowLeft" className="h-[15px] w-[15px]" />{tr("haq.allOfYourHaq")}
        </Link>

        {/* Header */}
        <Card pad={0} style={{ overflow: "hidden" }}>
          {/* A wide picture of what this scheme is about, so the page says it
              before she reads a word. */}
          <div className="relative aspect-[21/8] w-full overflow-hidden" style={{ background: v("--ux-surface-2") }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={artFor([h.name, h.gives, h.body], "scheme", null, h.id)} alt="" className="h-full w-full object-cover" />
            <span aria-hidden className="absolute inset-0"
                  style={{ background: "linear-gradient(180deg, rgba(16,6,24,0) 45%, rgba(16,6,24,.55))" }} />
            <span className="absolute start-4 top-4 rounded-full px-2.5 py-1 text-2xs font-bold uppercase tracking-[0.07em]"
                  style={{ background: "rgba(255,255,255,.92)", color: v(tone.ink) }}>{STATUS_LABEL[h.status]}</span>
          </div>
          <div className="flex flex-wrap items-start gap-4 p-5">
            <IconTile icon={h.icon} tint={h.tint} ink={h.ink} size={52} radius={14} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[clamp(1.25rem,2.6vw,1.625rem)] font-extrabold leading-tight tracking-[-0.03em]"
                    style={{ color: v("--ux-ink") }}>{h.name}</h1>
                <span className="rounded-full px-2.5 py-[3px] text-2xs font-bold uppercase tracking-[0.07em]"
                      style={{ background: v("--ux-surface"), color: v(tone.ink) }}>{STATUS_LABEL[h.status]}</span>
              </div>
              <p className="mt-1 text-xsm font-semibold" style={{ color: v("--ux-ink-2") }}>
                {h.body}{h.state !== "all" ? ` · ${h.state}` : " · All of India"}
              </p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{h.gives}</p>
              {scheme.data?.who && (
                <p className="mt-1.5 text-xs" style={{ color: v("--ux-ink-2") }}><b>Who it is for:</b> {scheme.data.who}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: v("--ux-ink") }}>
                {h.amountMinor > 0 ? formatRupees(h.amountMinor) : h.amountLabel}
              </p>
              <p className="mt-1 text-2xs" style={{ color: v("--ux-ink-2") }}>{h.cadence}</p>
            </div>
          </div>
          <div className="px-5 py-4"><ClaimSteps step={step} /></div>
        </Card>

        {/* Where it stands — hers to say, one tap. */}
        <Card>
          <SectionHead title="Where does it stand for you?" sub="Only you see this. It decides what we remind you about." icon="ListChecks" />
          <div className="flex flex-wrap gap-2">
            {STATUS_PICKS.map((p) => {
              const on = h.status === p.status;
              return (
                <button key={p.status} type="button" aria-pressed={on} disabled={saving}
                        onClick={() => {
                          if (p.status === "stopped" || p.status === "at-risk") setFollow(p.status);
                          else { setFollow(""); void setStatus(p.status); }
                        }}
                        className="ux-press ux-sq min-h-[40px] rounded-full border px-3.5 text-xsm font-semibold"
                        style={{ borderColor: v(on ? "--ux-brand" : "--ux-line"), background: v(on ? "--ux-brand-tint" : "--ux-surface"),
                                 color: v(on ? "--ux-brand" : "--ux-ink-2") }}>
                  {p.label}
                </button>
              );
            })}
          </div>
          {follow === "stopped" && (
            <div className="mt-3">
              <p className="text-xs font-semibold" style={{ color: v("--ux-ink") }}>Why did it stop?</p>
              <Picks options={STOP_REASONS} value={h.stoppedBecause ?? ""} label="Why it stopped"
                     onPick={(r) => { setFollow(""); void setStatus("stopped", { stopped_because: r }); }} />
            </div>
          )}
          {follow === "at-risk" && (
            <div className="mt-3">
              <p className="text-xs font-semibold" style={{ color: v("--ux-ink") }}>What has to happen, and by when?</p>
              {DATE_WHEN.map((w) => (
                <div key={w.days} className="mt-2">
                  <p className="text-2xs" style={{ color: v("--ux-muted") }}>{w.label}</p>
                  <Picks options={DATE_ACTIONS} value="" label={w.label}
                         onPick={(a) => { setFollow(""); void setStatus("at-risk", { action: a, due_on: isoInDays(w.days).slice(0, 10) }); }} />
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* The one thing to do */}
        {(h.action || h.stoppedBecause) && (
          <Card style={{ borderColor: v(h.status === "stopped" ? "--ux-danger-solid" : "--ux-amber") }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-2xs font-extrabold uppercase tracking-[0.14em]" style={{ color: v(tone.ink) }}>
                  {h.status === "stopped" ? tr("haq.whyItStopped") : tr("haq.whatHasToHappen")}
                </p>
                <p className="mt-1.5 text-base font-bold" style={{ color: v("--ux-ink") }}>{h.action ?? "Get it started again"}</p>
                {h.stoppedBecause && (
                  <p className="mt-1.5 max-w-[54ch] text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{h.stoppedBecause}</p>
                )}
              </div>
              {typeof h.dueDays === "number" && <Countdown days={h.dueDays} />}
            </div>
          </Card>
        )}

        {/* How to do it — real links, real numbers, real steps. */}
        <Card>
          <SectionHead title={h.online ? "Do it on the phone" : "Where to go"} icon={h.online ? "Smartphone" : "MapPin"} />
          {h.where && <p className="text-xsm" style={{ color: v("--ux-ink-2") }}><b>Where:</b> {h.where}</p>}
          {h.steps.length > 0 && (
            <ol className="mt-3 space-y-2">
              {h.steps.map((st, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xsm" style={{ color: v("--ux-ink-2") }}>
                  <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full text-2xs font-bold"
                        style={{ background: v("--ux-brand-tint"), color: v("--ux-brand") }}>{i + 1}</span>
                  {st}
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {h.link && <Btn href={h.link} icon="ExternalLink" variant={h.online ? "primary" : "outline"}>Open the official site</Btn>}
            {h.helpline && <Btn href={`tel:${h.helpline.replace(/[^\d+]/g, "")}`} icon="Phone" variant="outline">Call {h.helpline}</Btn>}
            <Btn variant="outline" icon="Bell" onClick={() => setReminding((x) => !x)}>{tr("haq.remindMe")}</Btn>
          </div>
          {reminding && (
            <div className="mt-3">
              <p className="text-xs font-semibold" style={{ color: v("--ux-ink") }}>When should we remind you?</p>
              <Picks options={reminderChoices} value="" onPick={(x) => void remind(x)} label="When" />
            </div>
          )}
          {!h.link && !h.helpline && !h.steps.length && (
            <p className="mt-2 text-xs" style={{ color: v("--ux-muted") }}>
              Our team has not added the steps for this one yet. Ask at your nearest CSC or block office.
            </p>
          )}
        </Card>

        {!h.openNow && h.openNote && (
          <Card pad={16} style={{ background: v("--ux-surface-2"), borderColor: "transparent" }}>
            <div className="flex items-start gap-3">
              <I name="Info" className="mt-[2px] h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
              <div>
                <p className="text-xsm font-bold" style={{ color: v("--ux-ink") }}>{tr("haq.notBeingDecidedRightNow")}</p>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>{h.openNote}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Papers */}
        {(needed.length > 0 || extraNeeds.length > 0) && (
          <div>
            <SectionHead title={tr("haq.whatItNeeds")}
                         sub={blocking.length ? `${blocking.length} still to sort out` : needed.length ? "Everything you track is in place" : undefined}
                         icon="FileText" action={tr("haq.allYourPapers")} onAction={() => router.push("/app/haq/papers")} />
            <div className="flex flex-col gap-2.5">
              {needed.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-[12px] border p-3"
                     style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full"
                        style={{ background: v(p.state === "held" ? "--ux-tint-green" : "--ux-danger-tint"),
                                 color: v(p.state === "held" ? "--ux-green-ink" : "--ux-danger-solid") }}>
                    <I name={p.state === "held" ? "Check" : "X"} className="h-[15px] w-[15px]" sw={3} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xsm font-semibold" style={{ color: v("--ux-ink") }}>{p.name}</p>
                    <p className="text-xs" style={{ color: v("--ux-muted") }}>{p.state === "held" ? "You have it" : `Get it from: ${p.from}`}</p>
                  </div>
                  {p.state !== "held" && <Btn size="sm" variant="outline" href="/app/haq/papers">{tr("haq.sortIt")}</Btn>}
                </div>
              ))}
              {extraNeeds.map((t) => (
                <div key={t} className="flex items-center gap-3 rounded-[12px] border p-3"
                     style={{ borderColor: v("--ux-line"), background: v("--ux-surface") }}>
                  <I name="FileText" className="h-[16px] w-[16px] shrink-0" style={{ color: v("--ux-muted") }} />
                  <p className="text-xsm" style={{ color: v("--ux-ink") }}>{t}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Going together — real, not invented names. */}
        {!h.online && (
          <Card pad={16} style={{ background: v("--ux-brand-tint"), borderColor: "transparent" }}>
            <p className="text-sm font-bold" style={{ color: v("--ux-ink") }}>{tr("haq.doNotGoAlone")}</p>
            <p className="mt-1 text-xsm leading-relaxed" style={{ color: v("--ux-ink-2") }}>
              {tr("haq.fillingTheFormTogetherHelps")}<b>{tr("haq.goingWithSomeoneHelpsAlmostTwice")}</b>.
              {scheme.data?.claiming ? ` ${scheme.data.claiming} women on WomSakhi are getting or claiming this.` : ""}
            </p>
            <div className="mt-3"><Btn size="sm" variant="outline" icon="Users" href="/app/circles">Ask a woman from my circle</Btn></div>
          </Card>
        )}
        {h.online && scheme.data?.claiming ? (
          <p className="text-xs" style={{ color: v("--ux-muted") }}>{scheme.data.claiming} women on WomSakhi are getting or claiming this.</p>
        ) : null}
      </div>
    </HomeShell>
  );
}
