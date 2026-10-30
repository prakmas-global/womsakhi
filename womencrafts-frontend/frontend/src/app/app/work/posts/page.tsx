"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import * as Icons from "@/components/ux/icons";

import { Btn, Card, EmptyState, NoteBtn, Pill, ScreenSkeleton } from "@/components/ux/kit";
import { Picks } from "@/components/ux/kit/form";
import { HomeShell } from "@/components/ux/home/HomeShell";
import { ScreenHead } from "@/components/ux/learning/native";
import { Fact, MediaCard, MediaGrid } from "@/components/ux/media/MediaCard";
import { jobPicture, useWorkTaxonomy } from "@/components/ux/work/pictures";
import { toast } from "@/components/ux/mobile/Toast";
import { useConfirm } from "@/design-system/feedback/ConfirmProvider";
import { apiErrorMessage } from "@/lib/api";
import { useResource } from "@/lib/use-resource";
import {
  WORK_PRAISE, apiJobApplicants, apiMessageApplicant, apiMoveApplicant, apiMyJobPosts, apiSetJobOpen,
  type Applicant, type MyJobPost,
} from "@/lib/work-api";

/**
 * My job posts — what she posted, who applied, and what she decided.
 *
 * Each applicant arrives with the skills the job needs that she has, her
 * level and any WomSakhi-verified mark (backend: routes/work_talent.py), so
 * choosing is reading, not interviewing blind. Moving someone on tells her;
 * saying no needs a reason, picked from a short kind list. Phone numbers are
 * not here: a message opens a WomSakhi chat and she shares hers if she wants.
 */

const STATUS: Record<string, { label: string; tone: "brand" | "green" | "orange" | "blue" | "neutral" }> = {
  applied: { label: "New", tone: "blue" },
  shortlisted: { label: "Shortlisted", tone: "brand" },
  interview: { label: "Talking", tone: "orange" },
  offered: { label: "Offered", tone: "green" },
  closed: { label: "Not this time", tone: "neutral" },
  completed: { label: "Work done", tone: "green" },
};
const NEXT: { status: "shortlisted" | "interview" | "offered"; label: string; icon: string }[] = [
  { status: "shortlisted", label: "Shortlist", icon: "Star" },
  { status: "interview", label: "Talk to her", icon: "MessageCircle" },
  { status: "offered", label: "Offer the work", icon: "CheckCircle2" },
];
const REASONS = ["We found someone", "The work is filled", "Too far away", "Need more experience"];
const PHRASES = ["Can you come for a trial?", "When can you start?", "Can you share samples of your work?", "Please come on Monday at 10"];

const noSubscribe = () => () => {};

function ApplicantCard({ a, onChanged }: { a: Applicant; onChanged: () => void }) {
  const [busy, setBusy] = useState("");
  const [saying, setSaying] = useState(false);
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState("");
  // Work done: how it went, in stars and taps — it goes on her work profile.
  const [finishing, setFinishing] = useState(false);
  const [stars, setStars] = useState(0);
  const [praise, setPraise] = useState<string[]>([]);
  const st = STATUS[a.status] ?? STATUS.applied;
  const toConfirm = a.status === "offered" || (a.status === "completed" && a.done === "mine");

  const confirmDone = async () => {
    setBusy("completed");
    try {
      await apiMoveApplicant(a.application_id, "completed", extra.trim(), { rating: stars || null, praise });
      toast(`Thank you — it is on ${a.first_name}'s work profile now`, { tone: "success" });
      setFinishing(false);
      onChanged();
    } catch (e) {
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const move = async (status: "shortlisted" | "interview" | "offered" | "closed", note = "") => {
    setBusy(status);
    try {
      await apiMoveApplicant(a.application_id, status, note);
      toast(status === "closed" ? `We told ${a.first_name}, kindly` : `${a.first_name} has been told`, { tone: "success" });
      setSaying(false);
      onChanged();
    } catch (e) {
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  const at = NEXT.findIndex((x) => x.status === a.status);
  const next = a.status === "closed" ? [] : NEXT.slice(at + 1);

  return (
    <Card className="flex flex-col">
      <div className="flex items-start gap-3">
        <span className="grid h-[44px] w-[44px] shrink-0 place-items-center overflow-hidden rounded-full text-sm font-bold"
              style={{ background: "var(--ux-brand-tint)", color: "var(--ux-brand)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.avatar ? <img src={a.avatar} alt="" className="h-full w-full object-cover" /> : a.first_name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold" style={{ color: "var(--ux-ink)" }}>{a.first_name}</h3>
            <Pill tone={st.tone} size="sm">{a.status === "completed" && a.done === "mine" ? "She says it is done" : st.label}</Pill>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs" style={{ color: "var(--ux-muted)" }}>
            {(a.area || a.city) && <span className="inline-flex items-center gap-1"><Icons.MapPin className="h-3.5 w-3.5" />{[a.area, a.city].filter(Boolean).join(" · ")}</span>}
            {a.applied_on && <span>Applied {a.applied_on}</span>}
          </p>
        </div>
      </div>

      {a.skills.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {a.skills.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-2xs font-semibold"
                  style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink)" }}>
              {s.name}{s.level && <span style={{ color: "var(--ux-muted)" }}>· {s.level}</span>}
              {s.verified && <Icons.BadgeCheck className="h-3.5 w-3.5" style={{ color: "var(--ux-green-ink)" }} aria-label="Verified skill" />}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs" style={{ color: "var(--ux-muted)" }}>She has not listed the skills this job needs yet.</p>
      )}
      {a.note && (
        <p className="mt-3 rounded-[12px] px-3 py-2 text-xsm leading-relaxed" style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>
          &ldquo;{a.note}&rdquo;
        </p>
      )}

      {finishing ? (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
          <p className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>How did it go? This goes on her work profile.</p>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`}
                      onClick={() => setStars(stars === n ? 0 : n)} className="ux-press grid h-10 w-10 place-items-center rounded-full">
                <Icons.Star className="h-7 w-7" style={{ color: n <= stars ? "#f5a524" : "var(--ux-line-strong)", fill: n <= stars ? "#f5a524" : "none" }} />
              </button>
            ))}
          </div>
          <Picks options={WORK_PRAISE} value={praise} multi label="What was good"
                 onPick={(p) => setPraise((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))} />
          <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={300}
                 placeholder="A few words about her work (optional)" aria-label="A few words about her work"
                 className="ux-sq mt-2.5 min-h-[42px] w-full rounded-[12px] border px-3.5 text-xsm outline-none"
                 style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn size="sm" variant="primary" icon="BadgeCheck" loading={busy === "completed"} onClick={() => void confirmDone()}>
              Confirm work done
            </Btn>
            <Btn size="sm" variant="ghost" onClick={() => setFinishing(false)}>Cancel</Btn>
          </div>
        </div>
      ) : saying ? (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--ux-line)" }}>
          <p className="text-xsm font-semibold" style={{ color: "var(--ux-ink)" }}>Why not this time? She will see this.</p>
          <Picks options={REASONS} value={reason} label="Reason" onPick={(r) => setReason(reason === r ? "" : r)} />
          <input value={extra} onChange={(e) => setExtra(e.target.value)} maxLength={300}
                 placeholder="Add a kind word (optional)" aria-label="Add a kind word"
                 className="ux-sq mt-2.5 min-h-[42px] w-full rounded-[12px] border px-3.5 text-xsm outline-none"
                 style={{ borderColor: "var(--ux-line)", background: "var(--ux-surface)", color: "var(--ux-ink)" }} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn size="sm" variant="primary" disabled={!reason} loading={busy === "closed"}
                 onClick={() => void move("closed", [reason, extra.trim()].filter(Boolean).join(". "))}>Send</Btn>
            <Btn size="sm" variant="ghost" onClick={() => setSaying(false)}>Cancel</Btn>
          </div>
        </div>
      ) : (
        <div className="mt-auto flex flex-wrap gap-2 pt-4 [&>*]:max-sm:w-full">
          {a.conversation_id ? (
            <Btn href={`/app/messages?c=${a.conversation_id}`} variant="outline" size="sm" icon="MessageCircle">Open chat</Btn>
          ) : a.status !== "closed" && (
            <NoteBtn label="Message" variant="outline" size="sm" icon="MessageCircle"
                     title={`Message ${a.first_name}`} to={a.first_name}
                     placeholder="Say when and where, or ask a question."
                     phrases={PHRASES}
                     send={async (n) => {
                       await apiMessageApplicant(a.application_id, n.text);
                     }}
                     sent={`Your message is with ${a.first_name}`}
                     sentBody="She will see it in Messages. If she wants to, she can share her number with you there."
                     sentLink={{ href: "/app/messages", label: "Open Messages" }}
                     onSentClosed={onChanged} />
          )}
          {next[0] && a.status !== "completed" && (
            <Btn size="sm" variant="primary" icon={next[0].icon} loading={busy === next[0].status}
                 onClick={() => void move(next[0].status)}>{next[0].label}</Btn>
          )}
          {toConfirm && (
            <Btn size="sm" variant="primary" icon="BadgeCheck" onClick={() => setFinishing(true)}>
              {a.status === "completed" ? "Confirm work done" : "Mark work done"}
            </Btn>
          )}
          {a.status !== "closed" && a.status !== "offered" && a.status !== "completed" && (
            <Btn size="sm" variant="ghost" icon="X" onClick={() => setSaying(true)}>Not this time</Btn>
          )}
        </div>
      )}
    </Card>
  );
}

function Applicants({ job }: { job: MyJobPost }) {
  const list = useResource(useCallback((s: AbortSignal) => apiJobApplicants(job.id, s), [job.id]), [] as Applicant[]);
  if (list.source === "loading") return <ScreenSkeleton shape="list" />;
  if (!list.data.length) {
    return (
      <Card>
        <EmptyState icon="Users" title="Nobody has applied yet"
                    body={`Women with ${job.skills.slice(0, 2).join(" or ") || "these skills"} were told about it. Applications arrive here, and you get a notification for each one.`} />
      </Card>
    );
  }
  const order = ["applied", "shortlisted", "interview", "offered", "completed", "closed"];
  const rows = [...list.data].sort((x, y) => order.indexOf(x.status) - order.indexOf(y.status));
  return (
    <div className="grid gap-[12px] lg:grid-cols-2">
      {rows.map((a) => <ApplicantCard key={a.application_id} a={a} onChanged={list.refetch} />)}
    </div>
  );
}

export default function MyJobPostsPage() {
  const confirm = useConfirm();
  const workCats = useWorkTaxonomy();
  const posts = useResource(useCallback((s: AbortSignal) => apiMyJobPosts(s), []), [] as MyJobPost[]);
  const linked = useSyncExternalStore(noSubscribe,
    () => new URLSearchParams(window.location.search).get("job"), () => null);
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState("");

  const status = (posts.error as { response?: { status?: number } } | null)?.response?.status;
  if (posts.source === "loading") return <HomeShell><ScreenSkeleton shape="list" /></HomeShell>;
  if (status === 403) {
    return (
      <HomeShell>
        <ScreenHead title="My job posts" />
        <Card><p className="text-sm" style={{ color: "var(--ux-muted)" }}>
          Posting jobs opens once your account is verified.
        </p></Card>
      </HomeShell>
    );
  }

  const selectedId = picked ?? linked ?? posts.data.find((p) => p.status === "open")?.id ?? posts.data[0]?.id ?? null;
  const selected = posts.data.find((p) => p.id === selectedId) ?? null;
  const open = posts.data.filter((p) => p.status === "open").length;

  const setOpen = async (job: MyJobPost, next: boolean) => {
    if (!next) {
      const sure = await confirm({
        title: "Close this job post?",
        description: "Women can no longer find it or apply. People who already applied stay here.",
        confirmLabel: "Close it", cancelLabel: "Keep it open",
      });
      if (!sure) return;
    }
    setBusy(job.id);
    try {
      await apiSetJobOpen(job.id, next);
      toast(next ? "Your job post is open again" : "Job post closed", { tone: "success" });
      posts.refetch();
    } catch (e) {
      toast(apiErrorMessage(e, "That did not save. Try again."), { tone: "error" });
    } finally {
      setBusy("");
    }
  };

  return (
    <HomeShell>
      <ScreenHead title="My job posts"
                  sub={posts.data.length ? `${open} open · up to 5 at a time. Women whose skills match were told about each one.`
                    : "Post work, and the women whose skills match are told about it."}>
        <Btn href="/app/work/post" variant="primary" icon="Plus">Post a job</Btn>
      </ScreenHead>

      {posts.source === "error" && (
        <Card className="mb-[16px]">
          <div className="flex items-center gap-3">
            <p className="flex-1 text-sm" style={{ color: "var(--ux-muted)" }}>Your job posts could not be loaded.</p>
            <Btn size="sm" variant="outline" onClick={posts.refetch}>Try again</Btn>
          </div>
        </Card>
      )}

      {!posts.data.length && posts.source !== "error" ? (
        <Card>
          <EmptyState icon="Briefcase" title="You have not posted a job yet"
                      body="Need a tailor, a cook or a helper? Pick the skills — the women who have them get a notification and can apply."
                      action={<Btn href="/app/work/post" variant="primary" icon="Plus">Post a job</Btn>} />
        </Card>
      ) : (
        <>
          <MediaGrid className="mb-6">
            {posts.data.map((p) => {
              const on = p.id === selectedId;
              return (
                <MediaCard key={p.id} highlight={on}
                  image={jobPicture({ ...p, categoryName: p.category_name, skillKeys: p.skill_keys }, workCats)}
                  alt={p.title}
                  topLeft={p.status === "open" ? { text: "Open", tone: "green" } : { text: "Closed", tone: "dark" }}
                  topRight={p.pay ? { text: p.pay, tone: "dark" } : null}
                  overlay={<><Icons.Users className="h-[13px] w-[13px]" />{p.applicant_count} {p.applicant_count === 1 ? "applicant" : "applicants"}</>}
                  title={p.title}
                  subtitle={`${p.category_name || p.kind} · Posted ${p.posted}`}
                  meta={p.deadline_label ? <Fact icon="CalendarClock">Closes {p.deadline_label}</Fact> : null}
                  footer={
                    <div className="flex flex-wrap items-center gap-2">
                      <Btn size="sm" variant={on ? "primary" : "soft"} icon="Users" onClick={() => setPicked(p.id)}>
                        {on ? "Showing who applied" : "See who applied"}
                      </Btn>
                      <Btn href={`/app/work/post?id=${p.id}`} size="sm" variant="ghost" icon="Pencil">Edit</Btn>
                      <Btn size="sm" variant="ghost" icon={p.status === "open" ? "EyeOff" : "Eye"} loading={busy === p.id}
                           onClick={() => void setOpen(p, p.status !== "open")}>
                        {p.status === "open" ? "Close" : "Reopen"}
                      </Btn>
                    </div>
                  }
                >
                  {p.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {p.skills.slice(0, 4).map((sk) => (
                        <span key={sk} className="rounded-full px-2.5 py-1 text-2xs font-semibold"
                              style={{ background: "var(--ux-surface-2)", color: "var(--ux-ink-2)" }}>{sk}</span>
                      ))}
                    </div>
                  )}
                </MediaCard>
              );
            })}
          </MediaGrid>

          {selected && (
            <section>
              <h2 className="mb-3 text-base font-bold" style={{ color: "var(--ux-ink)" }}>
                Who applied: {selected.title}
              </h2>
              <Applicants key={selected.id} job={selected} />
            </section>
          )}
        </>
      )}
    </HomeShell>
  );
}
