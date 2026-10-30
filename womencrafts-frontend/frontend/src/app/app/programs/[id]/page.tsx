"use client";

import { JourneyTrail } from "@/components/ux/home/JourneyTrail";

import { PlaceMark } from "@/components/ux/nav/Place";
import { use, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { apiSave, apiSaved, apiUnsave, type SavedItem } from "@/lib/entitlements-api";
import {
  apiCatalogProgram, apiClaimCertificate, apiClaimPaid, apiEnroll, apiLeaveProgram, apiProgramDetail,
  type ApiLesson,
} from "@/lib/growth-api";
import { rupees } from "@/lib/teach-api";
import { useResource } from "@/lib/use-resource";
import { useAction } from "@/lib/use-action";
import * as Icons from "@/components/ux/icons";
import {
  Back, ActionBtn, Btn, Card, copy, EmptyState, IconTile, Progress, RailSkeleton, ScreenSkeleton, SectionHead,
} from "@/components/ux/kit";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { Tag } from "@/components/ux/learning/native";
import { courseArt } from "@/components/ux/learning/data";
import { CourseQA } from "@/components/ux/learning/CourseQA";
import { useT } from "@/i18n";

/**
 * One course — whoever teaches it.
 *
 * The one button on this screen is always the next real step for HER:
 *
 *   not joined, free   → "Start learning — free" (joins and opens lesson 1)
 *   not joined, paid   → "Join · ₹499", then the teacher's UPI to pay
 *   asked to join      → pay, then "I've paid"; then "waiting for her to confirm"
 *   learning           → "Continue lesson N", naming the lesson
 *   finished           → "Get your certificate"
 *   her own course     → "Manage my course"
 *
 * A paid course is paid to the teacher directly by UPI — WomSakhi never holds
 * the money — so the lessons open when the teacher confirms she received it.
 */
export default function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const router = useRouter();
  const { id } = use(params);

  // Her place in the course (and the lessons, once they are hers). 403s for a
  // member still being verified; then the catalogue row below stands in.
  const { data: detail, source, refetch } = useResource(
    useCallback((sig: AbortSignal) => apiProgramDetail(id, sig).catch(() => null), [id]),
    null,
  );
  const { data: row, source: rowSource, refetch: refetchRow } = useResource(
    useCallback((sig: AbortSignal) => apiCatalogProgram(id, sig).catch(() => null), [id]),
    null,
  );
  const reload = () => { refetch(); refetchRow(); };

  const { data: savedItems, refetch: refetchSaved } = useResource(
    useCallback((sig: AbortSignal) => apiSaved(sig), []),
    [] as SavedItem[],
  );
  const [pendingSave, setPendingSave] = useState<boolean | null>(null);
  const saved = pendingSave ?? savedItems.some((it) => it.kind === "program" && it.ref_id === id);
  const bookmark = useAction(
    async () => { if (saved) await apiUnsave("program", id); else await apiSave("program", id); },
    {
      onDone: () => { setPendingSave(null); refetchSaved(); },
      optimistic: () => setPendingSave(!saved),
      rollback: () => setPendingSave(null),
      fallbackError: "Could not save it just now.",
    },
  );

  const lessons: ApiLesson[] = useMemo(
    () => detail?.curriculum ?? (row?.curriculum ?? []).map((l) => ({ ...l, done: false })),
    [detail, row],
  );
  const price = detail?.price_minor ?? row?.price_minor ?? 0;
  const isOwner = detail?.is_owner ?? row?.is_mine ?? false;
  const state = detail?.status ?? row?.my_status ?? "";
  const canLearn = detail?.can_learn ?? false;
  const pay = detail?.payment_status ?? "";
  const teacher = detail?.teacher_name ?? row?.teacher_name ?? "WomSakhi team";
  const byMember = (detail?.owner_kind ?? row?.owner_kind) === "member";
  const done = lessons.filter((l) => l.done).length;
  const nextIndex = lessons.findIndex((l) => !l.done);
  const next = nextIndex >= 0 ? nextIndex + 1 : 1;
  const pct = Math.round(detail?.progress ?? 0);
  // The first lesson the teacher opened as a free preview (1-based; 0 = none).
  const firstPreview = lessons.findIndex((l) => l.preview) + 1;

  const [reference, setReference] = useState("");
  const join = useAction(() => apiEnroll(id), {
    onDone: () => {
      if (price > 0) reload();
      else router.push(`/app/programs/${id}/lesson/1`);
    },
    fallbackError: "Could not join just now. Try again in a moment.",
  });
  const paid = useAction(() => apiClaimPaid(id, reference.trim()), {
    onDone: reload,
    fallbackError: "That did not reach your teacher. Try again in a moment.",
  });
  const cancel = useAction(() => apiLeaveProgram(id), { onDone: reload, fallbackError: "Could not cancel just now." });
  const certificate = useAction(() => apiClaimCertificate(id), {
    onDone: () => router.push("/app/certificates"),
    fallbackError: "Your certificate did not come through. Try again in a moment.",
  });

  if (!detail && !row && (source === "loading" || rowSource === "loading")) {
    return (
      <HomeShell skeleton="detail" rail={<RailSkeleton />}>
        <ScreenSkeleton shape="detail" />
      </HomeShell>
    );
  }
  if (!detail && !row) {
    return (
      <HomeShell>
        <Card>
          <EmptyState
            icon="SearchX"
            title={tr("programs.thatCourseIsNotHere")}
            body={tr("programs.itMayHaveBeenRetiredOr")}
            action={<Btn href="/app/programs" variant="primary" iconEnd="ArrowRight">{tr("programs.allCourses")}</Btn>}
          />
        </Card>
      </HomeShell>
    );
  }

  const name = detail?.name ?? row?.name ?? "";
  const category = detail?.category ?? row?.category ?? "";
  const desc = detail?.desc ?? row?.desc ?? "";
  // "5 lessons" is what a member course stores when she gave no length — the
  // lesson count already says that, so it is not repeated as a duration.
  const rawDuration = detail?.duration ?? row?.duration ?? "";
  const duration = /^\d+\s+lessons?$/i.test(rawDuration.trim()) ? "" : rawDuration;
  const learners = row?.enrolled ?? 0;
  const error = join.error || paid.error || cancel.error || certificate.error;

  /** The one thing to do next, for her, on this course. */
  const action = (() => {
    if (isOwner) {
      return (
        <div className="space-y-2">
          <Btn href={`/app/teach/${id}`} variant="primary" full iconEnd="ArrowRight">Manage my course</Btn>
          <Btn href={`/app/programs/${id}/lesson/1`} variant="outline" full icon="Eye">Preview the lessons</Btn>
        </div>
      );
    }
    if (state === "completed") {
      return detail?.certificate_code ? (
        <Btn href="/app/certificates" variant="primary" full icon="Award">See your certificate</Btn>
      ) : (
        <Btn variant="primary" full icon="Award" loading={certificate.busy} onClick={() => void certificate.run()}>
          Get your certificate
        </Btn>
      );
    }
    if (canLearn) {
      return (
        <Btn href={`/app/programs/${id}/lesson/${next}`} variant="primary" full iconEnd="ArrowRight">
          {done > 0 ? `Continue lesson ${next}` : "Start the first lesson"}
        </Btn>
      );
    }
    if (state === "pending") return null; // the payment panel below takes over
    return (
      <div className="space-y-2">
        <Btn variant="primary" full iconEnd="ArrowRight" loading={join.busy} onClick={() => void join.run()}>
          {price > 0 ? `Join · ${rupees(price)}` : "Start learning — free"}
        </Btn>
        {firstPreview > 0 && (
          <Btn href={`/app/programs/${id}/lesson/${firstPreview}`} variant="outline" full icon="PlayCircle">
            Watch a free preview
          </Btn>
        )}
      </div>
    );
  })();

  return (
    <HomeShell
      rail={
        <div className="space-y-[16px]">
          <Card>
            <SectionHead title={canLearn && !isOwner ? tr("programs.whereYouAre") : tr("programs.whatYouGet")} />
            {canLearn && !isOwner ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xsm" style={{ color: "var(--ux-muted)" }}>{done} of {lessons.length} lessons</span>
                  <span className="text-lg font-bold tabular-nums" style={{ color: "var(--ux-ink)" }}>{pct}%</span>
                </div>
                <div className="mt-2.5"><Progress pct={pct} track="--ux-track" /></div>
              </>
            ) : (
              <ul className="space-y-2.5">
                {([
                  [`${lessons.length} lessons`, "PlayCircle"],
                  [duration || "At your own pace", "Clock"],
                  [price > 0 ? `${rupees(price)}, paid to ${teacher}` : "Free", price > 0 ? "IndianRupee" : "Gift"],
                  ["A certificate when you finish", "Award"],
                ] as const).map(([t, ic]) => (
                  <li key={t} className="flex items-center gap-2.5 text-xsm" style={{ color: "var(--ux-ink-2)" }}>
                    <IconTile icon={ic} tint="--ux-tint-lilac" ink="--ux-brand" size={30} radius={9} />
                    {t}
                  </li>
                ))}
              </ul>
            )}
            {action && <div className="mt-4">{action}</div>}
            {error && <p role="alert" className="mt-2.5 text-xs" style={{ color: "var(--ux-danger-ink)" }}>{error}</p>}
            <div className="mt-2.5 flex gap-2">
              <Btn variant="outline" size="sm" icon={saved ? "BookmarkCheck" : "Bookmark"} onClick={() => void bookmark.run()}>
                {saved ? "Saved" : "Save"}
              </Btn>
              <ActionBtn variant="outline" size="sm" icon="Share2" doneIcon="Copy" done={tr("programs.linkCopied")}
                         act={() => copy(`${window.location.origin}/c/${id}`, "Link copied — send it to a friend", "Copy it by hand from the address bar")}>
                Share
              </ActionBtn>
            </div>
          </Card>

          <Card>
            <SectionHead title={tr("programs.whoTeachesIt")} />
            <div className="flex items-center gap-3">
              <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full text-sm font-bold"
                    style={{ background: byMember ? "var(--ux-tint-orange)" : "var(--ux-brand-tint)", color: byMember ? "var(--ux-orange-ink)" : "var(--ux-brand)" }}>
                {byMember ? teacher.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() : <Icons.Sparkles className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" style={{ color: "var(--ux-ink)" }}>{teacher}</p>
                <p className="mt-0.5 truncate text-xs" style={{ color: "var(--ux-muted)" }}>
                  {byMember ? "A verified WomSakhi member" : "Made by the WomSakhi team"}
                </p>
              </div>
            </div>
          </Card>
        </div>
      }
    >
      <JourneyTrail goal="learn" />
      <Back to="/app/programs" label={tr("programs.allCourses2")} className="mb-4" />

      <Card className="mb-[16px] overflow-hidden" pad={0}>
        <div className="relative h-[190px] overflow-hidden" style={{ background: "var(--ux-tint-violet)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img loading="lazy" decoding="async" src={courseArt(category, detail?.cover || row?.cover)} alt="" className="h-full w-full object-cover" />
          <span aria-hidden className="absolute inset-0" style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.55), transparent 60%)" }} />
          <span className="absolute start-4 top-4 flex gap-2">
            <Tag tone={price > 0 ? "orange" : "green"} size="sm">{price > 0 ? rupees(price) : "Free"}</Tag>
            {byMember && <Tag tone="pink" size="sm">By a member</Tag>}
            {isOwner && <Tag tone="brand" size="sm">Your course</Tag>}
          </span>
        </div>
        <div className="p-[20px]">
          <p className="text-xs font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ux-faint)" }}>{category}</p>
          <div className="mt-1 flex min-w-0 items-center gap-3">
            <PlaceMark size={44} />
            <h1 className="ux-screen-title text-2xl font-bold leading-tight min-w-0" style={{ color: "var(--ux-ink)" }}>{name}</h1>
          </div>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xsm" style={{ color: "var(--ux-muted)" }}>
            <span className="inline-flex items-center gap-1.5"><Icons.PlayCircle className="h-4 w-4" /> {lessons.length} lessons</span>
            {duration && <span className="inline-flex items-center gap-1.5"><Icons.Clock className="h-4 w-4" /> {duration}</span>}
            <span className="inline-flex items-center gap-1.5"><Icons.UserRound className="h-4 w-4" /> {teacher}</span>
            {learners > 0 && <span className="inline-flex items-center gap-1.5"><Icons.Users className="h-4 w-4" /> {learners} learning</span>}
          </p>
          {desc && <p className="mt-3.5 text-smd leading-relaxed lg:text-sm" style={{ color: "var(--ux-ink-2)" }}>{desc}</p>}
        </div>
      </Card>

      {/* ── Paying the teacher ────────────────────────────────────────────── */}
      {state === "pending" && !isOwner && (
        <Card className="mb-[16px]">
          {pay === "claimed" ? (
            <div className="flex items-start gap-3">
              <IconTile icon="Hourglass" tint="--ux-tint-orange" ink="--ux-orange-ink" size={40} radius={12} />
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>Waiting for {teacher} to confirm</h2>
                <p className="mt-1 text-xsm leading-relaxed" style={{ color: "var(--ux-muted)" }}>
                  You told her you paid {rupees(price)}. The lessons open the moment she confirms it —
                  we will let you know.
                </p>
                <div className="mt-3">
                  <Btn variant="ghost" size="sm" loading={cancel.busy} onClick={() => void cancel.run()}>Cancel my request</Btn>
                </div>
              </div>
            </div>
          ) : (
            <>
              <SectionHead title={`Pay ${teacher} ${rupees(price)} to start`}
                           sub="You pay her directly by UPI. WomSakhi never holds your money." />
              <div className="rounded-[14px] border p-4" style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface-2)" }}>
                <p className="text-xs" style={{ color: "var(--ux-muted)" }}>Her UPI ID</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold tracking-wide" style={{ color: "var(--ux-ink)" }}>{detail?.upi_id}</span>
                  <ActionBtn variant="outline" size="sm" icon="Copy" doneIcon="Check" done="Copied"
                             act={() => copy(detail?.upi_id ?? "", "UPI ID copied", "Copy it by hand")}>
                    Copy
                  </ActionBtn>
                </div>
                <div className="mt-3">
                  <Btn
                    href={`upi://pay?pa=${encodeURIComponent(detail?.upi_id ?? "")}&pn=${encodeURIComponent(teacher)}&am=${price / 100}&cu=INR&tn=${encodeURIComponent(`WomSakhi course: ${name}`.slice(0, 50))}`}
                    variant="soft" icon="Smartphone"
                  >
                    Pay {rupees(price)} with a UPI app
                  </Btn>
                </div>
              </div>
              <label className="mt-4 block text-xsm font-semibold" style={{ color: "var(--ux-ink)" }} htmlFor="pay-ref">
                UPI transaction reference <span style={{ color: "var(--ux-muted)", fontWeight: 400 }}>(required)</span>
              </label>
              <input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                maxLength={40}
                placeholder="Transaction reference from your UPI app"
                required
                className="ux-sq mt-1.5 min-h-[46px] w-full rounded-[12px] border px-4 text-xsm outline-none"
                style={{ borderColor: "var(--ux-line-strong)", background: "var(--ux-surface)", color: "var(--ux-ink)" }}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                <Btn variant="primary" icon="CheckCircle2" loading={paid.busy} disabled={!reference.trim()} onClick={() => void paid.run()}>Submit payment reference</Btn>
                <Btn variant="ghost" loading={cancel.busy} onClick={() => void cancel.run()}>Cancel</Btn>
              </div>
              {pay === "declined" && (
                <p className="mt-3 text-xs" style={{ color: "var(--ux-danger-ink)" }}>
                  {teacher} could not find your last payment. Check the UPI ID and try again.
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {/* ── What is in it ─────────────────────────────────────────────────── */}
      {lessons.length > 0 && (
        <Card>
          <SectionHead title={tr("programs.whatIsInIt")}
                       sub={canLearn ? `${lessons.length} lessons · ${done} done` : `${lessons.length} lessons · open when you join`} />
          <ul className="ux-sq overflow-hidden rounded-[12px] border" style={{ borderColor: "var(--ux-line)" }}>
            {lessons.map((l, i) => {
              const current = canLearn && !isOwner && i === nextIndex;
              const inner = (
                <>
                  <span className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-full"
                        style={{ background: l.done ? "var(--ux-green-ink)" : current ? "var(--ux-brand-600)" : "var(--ux-track)" }}>
                    {l.done
                      ? <Icons.Check className="h-[12px] w-[12px] text-white" strokeWidth={3} />
                      : canLearn
                        ? <span className="text-2xs font-bold" style={{ color: current ? "var(--ux-on-brand)" : "var(--ux-muted)" }}>{i + 1}</span>
                        : l.preview
                          ? <Icons.Play className="h-[11px] w-[11px]" style={{ color: "var(--ux-green-ink)" }} fill="currentColor" />
                          : <Icons.Lock className="h-[12px] w-[12px]" style={{ color: "var(--ux-muted)" }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xsm"
                          style={{ color: current ? "var(--ux-brand)" : "var(--ux-ink-2)", fontWeight: current ? 600 : 500 }}>
                      {l.title}
                    </span>
                    {l.detail && <span className="mt-0.5 block truncate text-xs" style={{ color: "var(--ux-muted)" }}>{l.detail}</span>}
                  </span>
                  {current && <Tag tone="brand" size="sm">{tr("programs.youAreHere")}</Tag>}
                  {l.preview && !canLearn && <Tag tone="green" size="sm">Free preview</Tag>}
                  {l.duration && <span className="shrink-0 text-[13px] lg:text-2xs" style={{ color: "var(--ux-faint)" }}>{l.duration}</span>}
                </>
              );
              return (
                <li key={`${l.title}-${i}`} style={{ borderTop: i ? "1px solid var(--ux-line)" : "none" }}>
                  {canLearn || l.preview ? (
                    <Link href={`/app/programs/${id}/lesson/${i + 1}`}
                          className="ux-hov flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--ux-surface-2)]"
                          style={{ background: current ? "var(--ux-brand-tint)" : "transparent" }}>
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 px-4 py-3">{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* ── Questions and answers: for the people in the course ─────────── */}
      {canLearn ? (
        <CourseQA programId={id} lessonCount={lessons.length} />
      ) : (
        <Card className="mt-[16px]">
          <p className="flex items-center gap-2 text-xsm" style={{ color: "var(--ux-muted)" }}>
            <Icons.MessageSquare className="h-4 w-4 shrink-0" />
            Join the course to ask questions — the teacher and other learners answer.
          </p>
        </Card>
      )}
    </HomeShell>
  );
}
