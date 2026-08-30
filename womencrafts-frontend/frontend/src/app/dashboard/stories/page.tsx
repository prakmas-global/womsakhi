"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Heart, Loader2, Sparkles, Star, X } from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import { Avatar, Badge, Card, EmptyState, Modal, Tabs } from "@/design-system";
import { apiAdminStories, apiDecideStory, type AdminStory } from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

/**
 * Success story review.
 *
 * Nothing here is auto-published. A wall of unverified testimonials reads as
 * advertising, and members can tell the difference instantly — the review is
 * what makes the screen worth having.
 */
export default function AdminStoriesPage() {
  const [stories, setStories] = useState<AdminStory[]>([]);
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [reading, setReading] = useState<AdminStory | null>(null);

  const load = useCallback(async () => {
    try {
      setStories(await apiAdminStories({ status: tab === "all" ? "" : tab }));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => [
      { label: "Showing", value: stories.length },
      {
        label: "Waiting",
        value: stories.filter((s) => s.status === "pending").length,
        tone: "text-status-warn-ink",
      },
      {
        label: "Published",
        value: stories.filter((s) => s.status === "published").length,
        tone: "text-status-ok-ink",
      },
      {
        label: "Featured",
        value: stories.filter((s) => s.featured).length,
        tone: "text-brand-ink",
      },
    ],
    [stories],
  );

  async function decide(id: string, status: string, featured?: boolean) {
    setWorking(true);
    try {
      await apiDecideStory(id, { status, featured });
      setReading(null);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  return (
    <AdminPage
      title="Success stories"
      subtitle="Members write these themselves. Read every one before it goes up — and never change her words."
      error={error}
      stats={stats}
    >
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "pending", label: "Waiting" },
          { value: "published", label: "Published" },
          { value: "declined", label: "Declined" },
          { value: "all", label: "All" },
        ]}
      />

      {loading ? (
        <AdminLoading />
      ) : stories.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing waiting"
          description="Stories members submit land here for review."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {stories.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={s.author_name} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{s.author_name}</p>
                    <p className="truncate text-xs text-ink-subtle">{s.member_email || s.when}</p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {s.featured && <Badge tone="brand">Featured</Badge>}
                  <Badge
                    tone={
                      s.status === "published"
                        ? "emerald"
                        : s.status === "pending"
                          ? "amber"
                          : "slate"
                    }
                  >
                    {s.status}
                  </Badge>
                </div>
              </div>

              <button onClick={() => setReading(s)} className="mt-3 block w-full text-left">
                <h2 className="font-display font-bold leading-snug text-ink">{s.title}</h2>
                <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-ink-muted">
                  {s.body}
                </p>
              </button>

              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 dark:border-white/10">
                <span className="flex items-center gap-2 text-xs text-ink-subtle">
                  {s.program && <span>{s.program}</span>}
                  {s.status === "published" && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5" />
                      {s.likes}
                    </span>
                  )}
                </span>
                <button
                  onClick={() => setReading(s)}
                  className="text-xs font-semibold text-brand-ink transition hover:underline"
                >
                  Read it
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!reading}
        onClose={() => setReading(null)}
        title={reading?.title ?? ""}
        description={`${reading?.author_name}${reading?.program ? ` · ${reading.program}` : ""}`}
        icon={Sparkles}
        size="lg"
        footer={
          reading?.status === "pending" ? (
            <>
              <button
                className="btn btn-outline"
                onClick={() => reading && decide(reading.id, "declined")}
                disabled={working}
              >
                <X className="h-4 w-4" /> Decline
              </button>
              <button
                className="btn btn-primary"
                onClick={() => reading && decide(reading.id, "published")}
                disabled={working}
              >
                {working ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                Publish
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => setReading(null)}>
                Close
              </button>
              {reading?.status === "published" && (
                <button
                  className="btn btn-secondary"
                  onClick={() => reading && decide(reading.id, "published", !reading.featured)}
                  disabled={working}
                >
                  <Star className="h-4 w-4" />
                  {reading?.featured ? "Remove from featured" : "Feature it"}
                </button>
              )}
            </>
          )
        }
      >
        <article className="whitespace-pre-line text-smd leading-[1.75] text-ink-muted">
          {reading?.body}
        </article>
        {reading?.status === "pending" && (
          <p className="mt-4 rounded-xl bg-status-info-bg px-3.5 py-3 text-sm text-status-info-ink">
            Publishing tells her straight away and puts this in front of every member. Declining
            also messages her — nobody is left waiting.
          </p>
        )}
      </Modal>
    </AdminPage>
  );
}
