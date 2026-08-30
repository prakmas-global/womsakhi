"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Eye, EyeOff, Heart, MessageCircle, Pin, ShieldCheck } from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Avatar, Badge, Card, EmptyState, Tabs } from "@/design-system";
import {
  apiAdminPosts,
  apiHidePost,
  apiPinPost,
  type AdminPost,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * Post moderation.
 *
 * Hiding, never deleting. A post that caused a report has to outlive the report
 * — otherwise the evidence disappears with the problem, and there's nothing
 * left to review a decision against.
 */
function ModerationInner() {
  const params = useSearchParams();
  const circleId = params.get("circle") ?? "";

  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [tab, setTab] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setPosts(await apiAdminPosts({ circle_id: circleId, hidden: tab === "hidden" }));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [circleId, tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Showing", value: posts.length },
      {
        label: "Hidden",
        value: posts.filter((p) => p.hidden).length,
        tone: "text-status-danger-ink",
      },
      {
        label: "Pinned",
        value: posts.filter((p) => p.pinned).length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Replies",
        value: posts.reduce((n, p) => n + p.reply_count, 0),
        tone: "text-brand-ink",
      },
    ],
    [posts],
  );

  async function hide(id: string) {
    setPosts((all) => all.map((p) => (p.id === id ? { ...p, hidden: !p.hidden } : p)));
    try {
      await apiHidePost(id);
    } catch (err) {
      setError(memberError(err));
      await load();
    }
  }

  async function pin(id: string) {
    setPosts((all) => all.map((p) => (p.id === id ? { ...p, pinned: !p.pinned } : p)));
    try {
      await apiPinPost(id);
    } catch (err) {
      setError(memberError(err));
      await load();
    }
  }

  return (
    <AdminPage
      title="Moderation"
      subtitle="Hiding removes a post from every member's view. It is never deleted — the record survives the decision."
      error={error}
      stats={stats}
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "Recent posts" },
          { value: "hidden", label: "Hidden" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title={tab === "hidden" ? "Nothing hidden" : "No posts yet"}
          description={
            tab === "hidden"
              ? "Nothing has needed removing. That's a good sign."
              : "Posts from every circle land here as members write them."
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {posts.map((p) => (
            <Card key={p.id} className={p.hidden ? "border-status-danger-border bg-status-danger-bg/40" : ""}>
              <div className="flex items-start gap-3">
                <Avatar name={p.author_name} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{p.author_name}</p>
                    <Badge tone="slate">{p.circle_name}</Badge>
                    {p.pinned && <Badge tone="amber">Pinned</Badge>}
                    {p.hidden && <Badge tone="rose">Hidden</Badge>}
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                    {p.body}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 dark:border-white/10">
                <span className="flex items-center gap-1 px-1 text-xs text-ink-subtle">
                  <Heart className="h-3.5 w-3.5" />
                  {p.likes}
                </span>
                <span className="flex items-center gap-1 px-1 text-xs text-ink-subtle">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {p.reply_count}
                </span>
                <span className="px-1 text-xs text-ink-subtle">{p.when}</span>

                <div className="ms-auto flex gap-1">
                  <button
                    onClick={() => pin(p.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      p.pinned
                        ? "text-status-warn-ink hover:bg-status-warn-bg"
                        : "text-ink-subtle hover:bg-surface-hover"
                    }`}
                  >
                    <Pin className="h-3.5 w-3.5" /> {p.pinned ? "Unpin" : "Pin"}
                  </button>
                  <button
                    onClick={() => hide(p.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                      p.hidden
                        ? "text-status-ok-ink hover:bg-status-ok-bg"
                        : "text-status-danger-ink hover:bg-status-danger-bg"
                    }`}
                  >
                    {p.hidden ? (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Restore
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Hide
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </AdminPage>
  );
}

export default function ModerationPage() {
  return (
    <Suspense fallback={<AdminLoading />}>
      <ModerationInner />
    </Suspense>
  );
}
