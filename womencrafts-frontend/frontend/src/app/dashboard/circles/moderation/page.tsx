"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CornerDownRight,
  Eye,
  EyeOff,
  Heart,
  MessageCircle,
  MicOff,
  MoreHorizontal,
  Pin,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";

import {
  Alert,
  Avatar,
  Badge,
  Card,
  Menu,
  MenuItem,
  Select,
  Spinner,
  StatCard,
  Tabs,
  useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import {
  apiAdminCircles,
  apiCommunityPermissions,
  apiHideItem,
  apiModerationQueue,
  apiMuteMember,
  apiPinPost,
  apiRemoveItem,
  apiRestoreItem,
  apiUnmuteMember,
  apiWarnMember,
  shortDate,
  type AdminCircle,
  type CommunityAction,
  type ModerationState,
  type QueueItem,
  type QueueSummary,
} from "@/lib/community-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Moderation.
 *
 * ── Hiding, never deleting ──────────────────────────────────────────────────
 * A post that caused a complaint has to outlive the complaint — otherwise the
 * evidence disappears with the problem and there is nothing to review the
 * decision against. So there are three states, all reversible from this
 * screen: visible, hidden (out of members' view, expected back) and removed
 * (out of the circle's counters too, still on disk with its reason).
 *
 * Member reports enter the central safety queue. This view retains the full
 * circle writing stream so moderators can inspect context and take action.
 */

const EMPTY_SUMMARY: QueueSummary = {
  posts: 0, replies: 0, hidden: 0, removed: 0, muted_members: 0, reports_supported: false,
};

const STATE_TONE: Record<ModerationState, "emerald" | "amber" | "rose"> = {
  visible: "emerald",
  hidden: "amber",
  removed: "rose",
};

type Dialog =
  | { kind: "hide" | "remove" | "restore" | "warn" | "mute"; item: QueueItem }
  | null;

function ModerationInner() {
  const params = useSearchParams();
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [circleId, setCircleId] = useState(params.get("circle") ?? "");
  const [tab, setTab] = useState<"all" | ModerationState>("all");
  const [kind, setKind] = useState<"all" | "post" | "reply">("all");
  const [items, setItems] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary>(EMPTY_SUMMARY);
  const [circles, setCircles] = useState<AdminCircle[]>([]);
  const [perms, setPerms] = useState<Set<CommunityAction>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);

  const can = useCallback((a: CommunityAction) => perms.has(a), [perms]);

  const fetchQueue = useCallback(
    () => apiModerationQueue({ circle_id: circleId, state: tab, kind }),
    [circleId, kind, tab],
  );

  useEffect(() => {
    let alive = true;
    fetchQueue()
      .then((page) => {
        if (!alive) return;
        setItems(page.items);
        setSummary(page.summary);
      })
      .catch((e) => { if (alive) toast.error("Could not load the queue", { description: memberError(e) }); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [fetchQueue, toast]);

  /** After an action: the same page again, without the loading skeleton. */
  const load = useCallback(async () => {
    try {
      const page = await fetchQueue();
      setItems(page.items);
      setSummary(page.summary);
    } catch (e) {
      toast.error("Could not refresh the queue", { description: memberError(e) });
    }
  }, [fetchQueue, toast]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [p, c] = await Promise.all([
        apiCommunityPermissions(isSuperAdmin).catch(() => new Set<CommunityAction>()),
        apiAdminCircles().catch(() => null),
      ]);
      if (!alive) return;
      setPerms(p);
      if (c) setCircles(c.circles);
    })();
    return () => { alive = false; };
  }, [isSuperAdmin]);

  const circleName = useMemo(
    () => circles.find((c) => c.id === circleId)?.name ?? "",
    [circleId, circles],
  );

  /* ── actions ───────────────────────────────────────────────────────────── */

  const pin = useCallback(async (item: QueueItem) => {
    try {
      const res = await apiPinPost(item.id);
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error("Could not change the pin", { description: memberError(e) });
    }
  }, [load, toast]);

  const unmute = useCallback(async (item: QueueItem) => {
    try {
      const res = await apiUnmuteMember(item.circle_id, item.user_id);
      toast.success(res.message);
      await load();
    } catch (e) {
      toast.error("Could not lift that mute", { description: memberError(e) });
    }
  }, [load, toast]);

  const confirmDialog = useCallback(async (reason: string, days: number) => {
    if (!dialog) return;
    const { kind: action, item } = dialog;
    setBusy(true);
    try {
      let res: { message: string };
      if (action === "hide") res = await apiHideItem(item, reason);
      else if (action === "remove") res = await apiRemoveItem(item, reason);
      else if (action === "restore") res = await apiRestoreItem(item, reason);
      else if (action === "warn") res = await apiWarnMember(item.circle_id, item.user_id, reason);
      else res = await apiMuteMember(item.circle_id, item.user_id, { reason, days });
      toast.success(res.message);
      setDialog(null);
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [dialog, load, toast]);

  const toggleExpanded = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const kindLabel = kind === "all" ? "Posts and replies" : kind === "post" ? "Posts only" : "Replies only";
  const canEdit = can("edit");
  const canDelete = can("delete");

  return (
    <div className="wc-page-enter">
      {/* ── header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ShieldAlert className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Moderation</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              Hiding takes a post out of every member&apos;s view. Nothing is ever deleted — the record survives the decision.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/safety/reports" className="btn btn-primary">Safety reports</Link>
          <Link href="/dashboard/circles" className="btn btn-outline">
            <ArrowLeft className="h-4 w-4" /> Circles
          </Link>
        </div>
      </div>

      {!summary.reports_supported && !loading && (
        <Alert variant="info" title="Members can't report posts yet" className="mb-6">
          There is no report button in the member app, so nothing here is &ldquo;reported&rdquo;. This is the
          newest writing across every circle, oldest at the bottom. Read it — an empty hidden list means
          nobody has hidden anything, not that nothing needed it.
        </Alert>
      )}

      {/* ── stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Posts" value={String(summary.posts)} icon={MessageCircle} tone="brand"
                  deltaNote={`${summary.replies} repl${summary.replies === 1 ? "y" : "ies"} under them`} />
        <StatCard label="Hidden" value={String(summary.hidden)} icon={EyeOff}
                  tone={summary.hidden > 0 ? "amber" : "slate"}
                  deltaNote={summary.hidden > 0 ? "Out of view, expected back" : "Nothing hidden"} />
        <StatCard label="Removed" value={String(summary.removed)} icon={Trash2}
                  tone={summary.removed > 0 ? "rose" : "slate"}
                  deltaNote={summary.removed > 0 ? "Kept on record, off the circle" : "Nothing removed"} />
        <StatCard label="Muted right now" value={String(summary.muted_members)} icon={MicOff}
                  tone={summary.muted_members > 0 ? "amber" : "slate"}
                  deltaNote={summary.muted_members > 0 ? "Can read, can't post" : "Nobody is muted"} />
      </div>

      {/* ── queue ───────────────────────────────────────────────────────── */}
      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={tab}
          onChange={(v) => { setLoading(true); setTab(v as "all" | ModerationState); }}
          tabs={[
            { value: "all", label: "Newest" },
            { value: "hidden", label: "Hidden", count: summary.hidden },
            { value: "removed", label: "Removed", count: summary.removed },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Select
            className="w-64"
            value={circleId}
            onChange={(e) => setCircleId(e.target.value)}
            options={[
              { value: "", label: "Every circle" },
              ...circles.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" /> {kindLabel}
              </span>
            }
          >
            <MenuItem onClick={() => setKind("all")}>Posts and replies</MenuItem>
            <MenuItem onClick={() => setKind("post")}>Posts only</MenuItem>
            <MenuItem onClick={() => setKind("reply")}>Replies only</MenuItem>
          </Menu>
          {circleName && (
            <span className="text-xs text-ink-subtle">
              Showing <b className="text-ink">{circleName}</b>
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {tab === "hidden" ? "Nothing is hidden" : tab === "removed" ? "Nothing has been removed" : circleId ? "Nothing written here yet" : "No posts yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {tab === "all"
                ? "Posts and replies appear here as members write them."
                : "Anything you hide or remove from the Newest tab lands here, with its reason, and can be restored."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {items.map((item) => {
              const open = expanded.has(item.id);
              const long = item.body.length > 320 || item.body.split("\n").length > 5;
              const muted = !!item.author_muted_until;
              const hasAuthor = !!item.user_id;
              return (
                <li key={`${item.kind}-${item.id}`} className={`py-3.5 ${item.hidden ? "opacity-80" : ""}`}>
                  <div className="flex items-start gap-3">
                    <Avatar name={item.author_name} src={item.author_avatar || undefined} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-semibold text-ink">{item.author_name}</p>
                        {!hasAuthor && <span className="text-2xs text-ink-subtle">(seeded, no account)</span>}
                        <Badge tone="slate">{item.circle_name}</Badge>
                        {item.kind === "reply" && <Badge tone="sky">Reply</Badge>}
                        {item.pinned && <Badge tone="amber">Pinned</Badge>}
                        {item.state !== "visible" && (
                          <Badge tone={STATE_TONE[item.state]}>{item.state === "hidden" ? "Hidden" : "Removed"}</Badge>
                        )}
                        {muted && <Badge tone="amber">Muted until {shortDate(item.author_muted_until)}</Badge>}
                        <span className="text-xs text-ink-subtle">· {item.when}</span>
                      </div>

                      {item.kind === "reply" && item.parent_snippet && (
                        <p className="mt-1 flex items-start gap-1 text-xs text-ink-subtle">
                          <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" />
                          <span className="truncate">replying to “{item.parent_snippet}”</span>
                        </p>
                      )}

                      <p className={`mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-muted ${open || !long ? "" : "line-clamp-5"}`}>
                        {item.body}
                      </p>
                      {long && (
                        <button onClick={() => toggleExpanded(item.id)} className="mt-1 text-xs font-semibold text-brand-ink hover:underline">
                          {open ? "Show less" : "Read the whole thing"}
                        </button>
                      )}

                      {item.state !== "visible" && (item.reason || item.moderated_by) && (
                        <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                          <b className="text-ink">{item.state === "hidden" ? "Hidden" : "Removed"}</b>
                          {item.moderated_by && ` by ${item.moderated_by}`}
                          {item.moderated_at && ` on ${shortDate(item.moderated_at)}`}
                          {item.reason && ` — ${item.reason}`}
                        </p>
                      )}

                      <div className="mt-2 flex items-center gap-3 text-xs text-ink-subtle">
                        {item.kind === "post" && (
                          <>
                            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> {item.likes}</span>
                            <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> {item.reply_count}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {(canEdit || canDelete) && (
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        {item.state === "visible" && canEdit && (
                          <MenuItem icon={EyeOff} onClick={() => setDialog({ kind: "hide", item })}>Hide</MenuItem>
                        )}
                        {item.state !== "visible" && canEdit && (
                          <MenuItem icon={Eye} onClick={() => setDialog({ kind: "restore", item })}>Restore</MenuItem>
                        )}
                        {item.state !== "removed" && canDelete && (
                          <MenuItem icon={Trash2} danger onClick={() => setDialog({ kind: "remove", item })}>Remove from the circle</MenuItem>
                        )}
                        {item.kind === "post" && item.state === "visible" && canEdit && (
                          <MenuItem icon={Pin} onClick={() => void pin(item)}>{item.pinned ? "Unpin" : "Pin to the top"}</MenuItem>
                        )}
                        {hasAuthor && canEdit && (
                          <>
                            <MenuItem icon={ShieldAlert} onClick={() => setDialog({ kind: "warn", item })}>Warn {item.author_name}</MenuItem>
                            {muted
                              ? <MenuItem icon={MicOff} onClick={() => void unmute(item)}>Lift her mute</MenuItem>
                              : <MenuItem icon={MicOff} danger onClick={() => setDialog({ kind: "mute", item })}>Mute her in {item.circle_name}</MenuItem>}
                          </>
                        )}
                      </Menu>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── reasons ─────────────────────────────────────────────────────── */}
      <ReasonModal
        open={dialog?.kind === "hide"}
        title={dialog ? `Hide this ${dialog.item.kind}` : ""}
        description="It leaves every member's view but stays on record. She is told, with this reason. You can restore it from the Hidden tab."
        label="Why it is being hidden"
        confirmLabel="Hide it"
        busy={busy}
        icon={EyeOff}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "remove"}
        title={dialog ? `Remove this ${dialog.item.kind} from the circle` : ""}
        description="It comes off the circle's counts as well as out of view. It is not deleted — it stays on record with this reason, and can be restored."
        label="Why it is being removed"
        confirmLabel="Remove it"
        danger
        busy={busy}
        icon={Trash2}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "restore"}
        title={dialog ? `Restore this ${dialog.item.kind}` : ""}
        description="It goes back into members' view. She is told it is back."
        label="A note for the record"
        confirmLabel="Restore it"
        required={false}
        busy={busy}
        icon={Eye}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "warn"}
        title={dialog ? `Warn ${dialog.item.author_name}` : ""}
        description={dialog ? `She receives this as a message from the ${dialog.item.circle_name} moderators, and it is kept on her record.` : undefined}
        label="What to tell her"
        confirmLabel="Send the warning"
        busy={busy}
        icon={ShieldAlert}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "mute"}
        title={dialog ? `Mute ${dialog.item.author_name}` : ""}
        description={dialog ? `She can still read ${dialog.item.circle_name}, but cannot post or reply in it until the date you choose. She is told why.` : undefined}
        label="Why"
        confirmLabel="Mute her"
        danger
        withDays
        busy={busy}
        icon={MicOff}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
    </div>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-16"><Spinner /></div>}>
      <ModerationInner />
    </Suspense>
  );
}
