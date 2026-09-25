"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Check,
  Clock,
  Heart,
  RotateCcw,
  Sparkles,
  Star,
  StarOff,
  X,
} from "lucide-react";

import {
  Avatar,
  Badge,
  Card,
  Modal,
  Spinner,
  StatCard,
  Tabs,
  useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import {
  apiAdminStories,
  apiCommunityPermissions,
  apiDecideStory,
  shortDate,
  type AdminStory,
  type CommunityAction,
  type StorySummary,
} from "@/lib/community-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Success story review.
 *
 * Nothing here is auto-published. A wall of unverified testimonials reads as
 * advertising, and members can tell the difference instantly — the review is
 * what makes the screen worth having.
 *
 * Every decision carries a reason. Declining without one leaves a woman
 * wondering what she did wrong; publishing without one leaves the next
 * reviewer wondering what the last one saw. The reason goes to her (when she
 * is declined) and to the audit trail (always).
 *
 * What is shown of her is what the story wall shows: the name she chose to
 * publish under. Not her email — that is the Members module's business.
 */

const EMPTY_SUMMARY: StorySummary = { total: 0, pending: 0, published: 0, declined: 0, featured: 0 };

type Decision = "publish" | "decline" | "feature" | "unfeature" | "reopen";

const DECISION_COPY: Record<Decision, {
  title: string; description: string; label: string; confirm: string; required: boolean; danger: boolean;
}> = {
  publish: {
    title: "Publish this story",
    description: "It goes in front of every member and she is told straight away.",
    label: "A note for the record",
    confirm: "Publish",
    required: false,
    danger: false,
  },
  decline: {
    title: "Decline this story",
    description: "She is messaged with this reason — nobody is left waiting and wondering. It stays on the record here.",
    label: "Why, in words she will read",
    confirm: "Decline",
    required: true,
    danger: true,
  },
  feature: {
    title: "Feature this story",
    description: "It becomes the first thing members see on the stories wall. She is told.",
    label: "Why this one",
    confirm: "Feature it",
    required: false,
    danger: false,
  },
  unfeature: {
    title: "Take it off the front",
    description: "It stays published, just no longer first.",
    label: "A note for the record",
    confirm: "Unfeature",
    required: false,
    danger: false,
  },
  reopen: {
    title: "Reopen for review",
    description: "It goes back to Waiting so it can be looked at again.",
    label: "A note for the record",
    confirm: "Reopen",
    required: false,
    danger: false,
  },
};

const STATUS_TONE: Record<string, "emerald" | "amber" | "slate"> = {
  published: "emerald",
  pending: "amber",
  declined: "slate",
};

const STATUS_LABEL: Record<string, string> = {
  published: "Published",
  pending: "Waiting",
  declined: "Declined",
};

export default function AdminStoriesPage() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [stories, setStories] = useState<AdminStory[]>([]);
  const [summary, setSummary] = useState<StorySummary>(EMPTY_SUMMARY);
  const [perms, setPerms] = useState<Set<CommunityAction>>(new Set());
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState<AdminStory | null>(null);
  const [deciding, setDeciding] = useState<{ story: AdminStory; decision: Decision } | null>(null);

  const canApprove = perms.has("approve");

  const fetchStories = useCallback(
    () => apiAdminStories({ status: tab === "all" ? "" : tab }),
    [tab],
  );

  useEffect(() => {
    let alive = true;
    fetchStories()
      .then((page) => {
        if (!alive) return;
        setStories(page.stories);
        setSummary(page.summary);
      })
      .catch((e) => { if (alive) toast.error("Could not load the stories", { description: memberError(e) }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchStories, toast]);

  /** After a decision: the same tab again, without the loading skeleton. */
  const load = useCallback(async () => {
    try {
      const page = await fetchStories();
      setStories(page.stories);
      setSummary(page.summary);
    } catch (e) {
      toast.error("Could not refresh the stories", { description: memberError(e) });
    }
  }, [fetchStories, toast]);

  useEffect(() => {
    let alive = true;
    apiCommunityPermissions(isSuperAdmin)
      .then((p) => { if (alive) setPerms(p); })
      .catch(() => { /* buttons stay hidden; the server would refuse anyway */ });
    return () => { alive = false; };
  }, [isSuperAdmin]);

  const decide = useCallback(async (reason: string) => {
    if (!deciding) return;
    const { story, decision } = deciding;
    const body =
      decision === "publish" ? { status: "published", reason }
      : decision === "decline" ? { status: "declined", reason }
      : decision === "feature" ? { status: "published", featured: true, reason }
      : decision === "unfeature" ? { status: "published", featured: false, reason }
      : { status: "pending", reason };
    setBusy(true);
    try {
      await apiDecideStory(story.id, body);
      toast.success(
        decision === "publish" ? `“${story.title}” is live`
        : decision === "decline" ? "Declined — she has been told"
        : decision === "feature" ? "It's on the front"
        : decision === "unfeature" ? "Taken off the front"
        : "Back in the waiting list",
      );
      setDeciding(null);
      setReading(null);
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [deciding, load, toast]);

  const copy = deciding ? DECISION_COPY[deciding.decision] : null;

  return (
    <div className="wc-page-enter">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Sparkles className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Success stories</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Members write these themselves. Read every one before it goes up — and never change her words.
            </p>
          </div>
        </div>
      </div>

      {/* ── stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Waiting" value={String(summary.pending)} icon={Clock}
                  tone={summary.pending > 0 ? "amber" : "slate"}
                  deltaNote={summary.pending > 0 ? "Each one is a woman waiting to hear" : "Nobody is waiting"} />
        <StatCard label="Published" value={String(summary.published)} icon={Check} tone="emerald"
                  deltaNote="On the stories wall" />
        <StatCard label="Featured" value={String(summary.featured)} icon={Star} tone="brand"
                  deltaNote="Shown first" />
        <StatCard label="Declined" value={String(summary.declined)} icon={X} tone="slate"
                  deltaNote={`${summary.total} submitted in all`} />
      </div>

      {/* ── list ────────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={tab}
          onChange={(v) => { setLoading(true); setTab(v); }}
          tabs={[
            { value: "pending", label: "Waiting", count: summary.pending },
            { value: "published", label: "Published", count: summary.published },
            { value: "declined", label: "Declined", count: summary.declined },
            { value: "all", label: "All" },
          ]}
        />

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : stories.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <Sparkles className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {tab === "pending" ? "Nothing waiting" : tab === "published" ? "Nothing published yet" : tab === "declined" ? "Nothing declined" : "No stories yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {tab === "pending"
                ? "Stories members submit from the app land here for review."
                : "Decisions made from the Waiting tab show up here."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {stories.map((s) => (
              <Card key={s.id}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={s.author_name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">{s.author_name}</p>
                      <p className="truncate text-xs text-ink-subtle">
                        Submitted {shortDate(s.submitted_at) || s.when}
                        {s.program && ` · ${s.program}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {s.featured && <Badge tone="brand">Featured</Badge>}
                    <Badge tone={STATUS_TONE[s.status] ?? "slate"}>{STATUS_LABEL[s.status] ?? s.status}</Badge>
                  </div>
                </div>

                <button onClick={() => setReading(s)} className="mt-3 block w-full text-left">
                  <h2 className="font-display font-bold leading-snug text-ink">{s.title}</h2>
                  <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-ink-muted">{s.body}</p>
                </button>

                {s.decided_by && (
                  <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                    <b className="text-ink">{STATUS_LABEL[s.status] ?? s.status}</b> by {s.decided_by}
                    {s.decided_at && ` on ${shortDate(s.decided_at)}`}
                    {s.reason && ` — ${s.reason}`}
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                  <span className="flex items-center gap-2 text-xs text-ink-subtle">
                    {s.status === "published" && (
                      <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {s.likes}</span>
                    )}
                  </span>
                  <button onClick={() => setReading(s)} className="text-xs font-semibold text-brand-ink transition hover:underline">
                    Read it
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* ── reading ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!reading}
        onClose={() => setReading(null)}
        title={reading?.title ?? ""}
        description={reading ? `${reading.author_name}${reading.program ? ` · ${reading.program}` : ""} · submitted ${shortDate(reading.submitted_at) || reading.when}` : ""}
        icon={Sparkles}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setReading(null)}>Close</button>
            {reading && canApprove && reading.status === "pending" && (
              <>
                <button className="btn btn-outline" onClick={() => setDeciding({ story: reading, decision: "decline" })}>
                  <X className="h-4 w-4" /> Decline
                </button>
                <button className="btn btn-primary" onClick={() => setDeciding({ story: reading, decision: "publish" })}>
                  <Check className="h-4 w-4" /> Publish
                </button>
              </>
            )}
            {reading && canApprove && reading.status === "published" && (
              <>
                <button className="btn btn-outline" onClick={() => setDeciding({ story: reading, decision: "decline" })}>
                  <X className="h-4 w-4" /> Take it down
                </button>
                <button className="btn btn-secondary" onClick={() => setDeciding({ story: reading, decision: reading.featured ? "unfeature" : "feature" })}>
                  {reading.featured ? <StarOff className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                  {reading.featured ? "Remove from featured" : "Feature it"}
                </button>
              </>
            )}
            {reading && canApprove && reading.status === "declined" && (
              <>
                <button className="btn btn-outline" onClick={() => setDeciding({ story: reading, decision: "reopen" })}>
                  <RotateCcw className="h-4 w-4" /> Reopen for review
                </button>
                <button className="btn btn-primary" onClick={() => setDeciding({ story: reading, decision: "publish" })}>
                  <Check className="h-4 w-4" /> Publish after all
                </button>
              </>
            )}
          </>
        }
      >
        <article className="whitespace-pre-line text-smd leading-[1.75] text-ink-muted">{reading?.body}</article>
        {reading?.decided_by && (
          <p className="mt-4 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
            <b className="text-ink">{STATUS_LABEL[reading.status] ?? reading.status}</b> by {reading.decided_by}
            {reading.decided_at && ` on ${shortDate(reading.decided_at)}`}
            {reading.reason && ` — ${reading.reason}`}
          </p>
        )}
        {reading?.status === "pending" && (
          <p className="mt-4 rounded-xl bg-status-info-bg px-3.5 py-3 text-sm text-status-info-ink">
            Publishing tells her straight away and puts this in front of every member. Declining also messages
            her, with your reason — nobody is left waiting.
          </p>
        )}
      </Modal>

      {copy && (
        <ReasonModal
          open={!!deciding}
          title={copy.title}
          description={copy.description}
          label={copy.label}
          confirmLabel={copy.confirm}
          required={copy.required}
          danger={copy.danger}
          busy={busy}
          icon={deciding?.decision === "decline" ? X : deciding?.decision === "publish" ? Check : Star}
          onClose={() => setDeciding(null)}
          onConfirm={(reason) => decide(reason)}
        />
      )}
    </div>
  );
}
