"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CornerDownRight, Eye, EyeOff, MessageSquare, MoreHorizontal, Search, SlidersHorizontal, Star, StarOff,
} from "lucide-react";

import {
  Badge, Card, Menu, MenuItem, Pagination, Spinner, StatCard, Tabs, useToast,
} from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import ReasonModal from "@/components/admin/community/ReasonModal";
import PersonCell from "@/components/admin/market/PersonCell";
import {
  EMPTY_PAGE,
  apiAdminReviews,
  apiHideReview,
  apiMarketPermissions,
  apiMarketSummary,
  apiRestoreReview,
  shortDate,
  showing,
  type AdminReview,
  type MarketAction,
  type MarketSummary,
  type Paged,
  type ReviewFilters,
} from "@/lib/market-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Reviews.
 *
 * A review is written under a buyer's name against a seller's shop. Hiding
 * one takes it off her shop page and out of her own list — kept on record
 * with the reason, restorable from the Hidden tab. Nothing is ever deleted.
 *
 * ── Not a report queue ──────────────────────────────────────────────────────
 * Members cannot flag a review. What is listed is the newest reviews on the
 * platform; reading them is the job until a report button exists.
 */

type State = "" | "visible" | "hidden";
type Dialog = { kind: "hide" | "restore"; item: AdminReview } | null;

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${n} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3.5 w-3.5 ${i < n ? "fill-status-warn-ink text-status-warn-ink" : "text-line-strong"}`} />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { isSuperAdmin } = useAuth();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [state, setState] = useState<State>("");
  const [stars, setStars] = useState(0);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paged<AdminReview> & { hidden_total: number }>({ ...EMPTY_PAGE, hidden_total: 0 });
  const [summary, setSummary] = useState<MarketSummary["reviews"] | null>(null);
  const [perms, setPerms] = useState<Set<MarketAction>>(new Set());
  const [error, setError] = useState("");
  const [loadedKey, setLoadedKey] = useState("");
  const latest = useRef("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);

  const can = useCallback((a: MarketAction) => perms.has(a), [perms]);

  const filters = useCallback(
    (): ReviewFilters => ({ q: term, state, stars, page, page_size: 15 }),
    [page, stars, state, term],
  );

  const filterKey = JSON.stringify(filters());
  const loading = loadedKey !== filterKey;

  const load = useCallback(async () => {
    const key = JSON.stringify(filters());
    latest.current = key;
    try {
      const [res, sum] = await Promise.all([apiAdminReviews(filters()), apiMarketSummary()]);
      if (latest.current !== key) return;
      setData(res);
      setSummary(sum.reviews);
      setError("");
      setLoadedKey(key);
    } catch (e) {
      if (latest.current === key) setError(memberError(e));
    }
  }, [filters]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let alive = true;
    apiMarketPermissions(isSuperAdmin)
      .then((p) => { if (alive) setPerms(p); })
      .catch(() => { if (alive) setPerms(new Set()); });
    return () => { alive = false; };
  }, [isSuperAdmin]);

  useEffect(() => {
    const t = setTimeout(() => { setTerm(q.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const confirmDialog = useCallback(async (reason: string) => {
    if (!dialog) return;
    setBusy(true);
    try {
      if (dialog.kind === "hide") await apiHideReview(dialog.item.id, reason);
      else await apiRestoreReview(dialog.item.id, reason);
      toast.success(dialog.kind === "hide" ? "Review hidden" : "Review restored",
        { description: dialog.kind === "hide" ? "It is off her shop page and kept on record." : "It is back on her shop page." });
      setDialog(null);
      await load();
    } catch (e) {
      toast.error("That didn't go through", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [dialog, load, toast]);

  const starsLabel = stars === 0 ? "Any rating" : `${stars} star${stars === 1 ? "" : "s"}`;
  const filtered = !!term || !!state || !!stars;

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Star className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Reviews</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              What buyers wrote about sellers. Hiding takes a review off her shop page; nothing is ever deleted, and the reason stays on record.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Reviews" value={summary ? String(summary.total) : "—"} icon={MessageSquare} tone="brand"
                  deltaNote="Across every shop" />
        <StatCard label="Hidden" value={summary ? String(summary.hidden) : "—"} icon={EyeOff}
                  tone={summary && summary.hidden > 0 ? "rose" : "slate"}
                  deltaNote={summary && summary.hidden > 0 ? "Off the shop pages, on record" : "Nothing hidden"} />
        <StatCard label="Visible" value={summary ? String(Math.max(0, summary.total - summary.hidden)) : "—"} icon={Eye} tone="emerald"
                  deltaNote="On shop pages now" />
      </div>

      <Card className="mt-6">
        <Tabs
          className="mb-4"
          value={state}
          onChange={(v) => { setState(v as State); setPage(1); }}
          tabs={[
            { value: "", label: "Newest" },
            { value: "visible", label: "Visible" },
            { value: "hidden", label: "Hidden", count: data.hidden_total },
          ]}
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search the text, the reviewer or the item…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-brand-300 focus:ring-4 focus:ring-brand-tint"
            />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" /> {starsLabel}</span>}>
            <MenuItem onClick={() => { setStars(0); setPage(1); }}>Any rating</MenuItem>
            {[5, 4, 3, 2, 1].map((n) => (
              <MenuItem key={n} onClick={() => { setStars(n); setPage(1); }}>{n} star{n === 1 ? "" : "s"}</MenuItem>
            ))}
          </Menu>
        </div>

        {error ? (
          <div className="px-6 py-14 text-center">
            <p className="text-sm font-semibold text-ink">Could not load the reviews</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">{error}</p>
            <button className="btn btn-outline mt-4" onClick={() => void load()}>Try again</button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : data.items.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <StarOff className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {state === "hidden" ? "Nothing is hidden" : filtered ? "Nothing matches that" : "No reviews yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {state === "hidden"
                ? "Anything you hide lands here with its reason, and can be restored."
                : filtered ? "Try a different search or rating." : "Reviews appear here as buyers write them."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {data.items.map((r) => (
              <li key={r.id} className={`py-3.5 ${r.hidden ? "opacity-80" : ""}`}>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold text-ink">{r.who || "A buyer"}</p>
                      <Stars n={r.stars} />
                      {r.what && <Badge tone="slate">{r.what}</Badge>}
                      {r.hidden && <Badge tone="rose">Hidden</Badge>}
                      <span className="text-xs text-ink-subtle">· {r.when}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-muted">
                      {r.text || <span className="text-ink-subtle">No words, just the stars.</span>}
                    </p>
                    {r.reply && (
                      <p className="mt-1.5 flex items-start gap-1 text-xs text-ink-subtle">
                        <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>She replied: “{r.reply}”</span>
                      </p>
                    )}
                    {r.hidden && (r.moderation.reason || r.moderation.by) && (
                      <p className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-ink-muted">
                        <b className="text-ink">Hidden</b>
                        {r.moderation.by && ` by ${r.moderation.by}`}
                        {r.moderation.at && ` on ${shortDate(r.moderation.at)}`}
                        {r.moderation.reason && ` — ${r.moderation.reason}`}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-2 text-xs text-ink-subtle">
                      <span>About</span>
                      <PersonCell person={r.seller} size="xs" />
                    </div>
                  </div>

                  {can("edit") && (
                    <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                      {r.hidden
                        ? <MenuItem icon={Eye} onClick={() => setDialog({ kind: "restore", item: r })}>Restore</MenuItem>
                        : <MenuItem icon={EyeOff} onClick={() => setDialog({ kind: "hide", item: r })}>Hide from her shop page</MenuItem>}
                    </Menu>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!loading && !error && data.total > 0 && (
          <Pagination page={data.page} pageCount={data.pages} onPageChange={setPage} showing={showing(data, "reviews")} />
        )}
      </Card>

      <ReasonModal
        open={dialog?.kind === "hide"}
        title={dialog ? `Hide this review by ${dialog.item.who || "a buyer"}` : ""}
        description="It leaves her shop page and her own list, and stays on record with this reason. You can restore it from the Hidden tab."
        label="Why it is being hidden"
        placeholder="For the record — the reviewer has no account to be told."
        confirmLabel="Hide it"
        busy={busy}
        icon={EyeOff}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
      <ReasonModal
        open={dialog?.kind === "restore"}
        title={dialog ? `Restore this review by ${dialog.item.who || "a buyer"}` : ""}
        description="It goes back on her shop page."
        label="A note for the record"
        placeholder="Optional."
        confirmLabel="Restore it"
        required={false}
        busy={busy}
        icon={Eye}
        onClose={() => setDialog(null)}
        onConfirm={confirmDialog}
      />
    </div>
  );
}
