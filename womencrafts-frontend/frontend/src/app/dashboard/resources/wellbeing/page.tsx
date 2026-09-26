"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2, Clock, FileEdit, HeartHandshake, MoreHorizontal, Plus, Search,
  SlidersHorizontal, Sparkles, Trash2, Undo2,
} from "lucide-react";
import {
  Badge, Card, Checkbox, ErrorState, Input, Menu, MenuItem, Modal, Pagination, Select,
  Spinner, StatCard, Tabs, Textarea, useConfirm, useToast,
} from "@/design-system";
import {
  CARD_KINDS, MOODS, STYLES,
  apiActivities, apiCreateActivity, apiCreateCard, apiDeleteWellbeing, apiResourcesSummary,
  apiReviewWellbeing, apiSupportCards, apiUnreviewWellbeing, apiUpdateActivity, apiUpdateCard,
  type ActivityInput, type ActivityPage, type ActivityRow, type CardInput, type CardPage,
  type CardRow, type ResourcesSummary, type WellbeingKind,
} from "@/lib/resources-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * The cards the mood engine hands out after a check-in, and the small
 * activities it offers as a reset.
 *
 * ── Reviewed is a record, not a default ─────────────────────────────────────
 * The engine only ever picks a card with `reviewed: true`. A card written here
 * starts unreviewed and is invisible to members until someone holding
 * `resources.approve` marks it read. Changing the words of a reviewed card
 * sends it back to waiting, because the review described the old words.
 *
 * ── Delete is for what was never shown ──────────────────────────────────────
 * A reviewed card may already have been shown to someone; it can have its
 * review withdrawn, but not vanish. Only an unreviewed card can be deleted.
 */

const PAGE_SIZE = 15;

type ReviewFilter = "" | "reviewed" | "unreviewed";

const REVIEW_OPTIONS: { value: ReviewFilter; label: string }[] = [
  { value: "", label: "All" },
  { value: "reviewed", label: "Reviewed — can be shown" },
  { value: "unreviewed", label: "Awaiting review" },
];

interface CardForm {
  title: string;
  body: string;
  kind: string;
  moods: string[];
  styles: string[];
  minutes: string;
}

interface ActivityForm {
  text: string;
  minutes: string;
  icon: string;
}

const emptyCard = (): CardForm => ({ title: "", body: "", kind: "word", moods: [], styles: [], minutes: "0" });
const cardFrom = (c: CardRow): CardForm => ({
  title: c.title, body: c.body, kind: c.kind, moods: [...c.moods], styles: [...c.styles], minutes: String(c.minutes),
});
const emptyActivity = (): ActivityForm => ({ text: "", minutes: "5", icon: "" });
const activityFrom = (a: ActivityRow): ActivityForm => ({ text: a.text, minutes: String(a.minutes), icon: a.icon });

function cardInput(f: CardForm): { ok: true; body: CardInput } | { ok: false; error: string } {
  if (!f.title.trim()) return { ok: false, error: "A title is needed" };
  if (!f.body.trim()) return { ok: false, error: "The card needs some words" };
  if (f.moods.length === 0) return { ok: false, error: "Pick at least one mood the card answers" };
  if (f.styles.length === 0) return { ok: false, error: "Pick at least one style the card suits" };
  const minutes = Number.parseInt(f.minutes, 10);
  if (Number.isNaN(minutes) || minutes < 0 || minutes > 60) return { ok: false, error: "Minutes must be between 0 and 60" };
  return { ok: true, body: { title: f.title.trim(), body: f.body.trim(), kind: f.kind, moods: f.moods, styles: f.styles, minutes } };
}

function activityInput(f: ActivityForm): { ok: true; body: ActivityInput } | { ok: false; error: string } {
  if (!f.text.trim()) return { ok: false, error: "Say what to do" };
  const minutes = Number.parseInt(f.minutes, 10);
  if (Number.isNaN(minutes) || minutes < 1 || minutes > 15) {
    return { ok: false, error: "An activity is finishable in 1 to 15 minutes — that is the engine's rule" };
  }
  return { ok: true, body: { text: f.text.trim(), minutes, icon: f.icon.trim() } };
}

function when(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ReviewBadge({ row }: { row: { reviewed: boolean; reviewed_by: string; reviewed_at: string } }) {
  return row.reviewed ? (
    <span title={row.reviewed_by ? `Reviewed by ${row.reviewed_by}${row.reviewed_at ? ` on ${when(row.reviewed_at)}` : ""}` : undefined}>
      <Badge tone="emerald">Reviewed</Badge>
    </span>
  ) : (
    <Badge tone="amber">Awaiting review</Badge>
  );
}

export default function WellbeingCardsPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [kind, setKind] = useState<WellbeingKind>("cards");
  const [summary, setSummary] = useState<ResourcesSummary | null>(null);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [reviewF, setReviewF] = useState<ReviewFilter>("");
  const [mood, setMood] = useState("");
  const [page, setPage] = useState(1);

  const [cards, setCards] = useState<CardPage | null>(null);
  const [activities, setActivities] = useState<ActivityPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cardEdit, setCardEdit] = useState<{ id: string | null; reviewed: boolean; form: CardForm } | null>(null);
  const [activityEdit, setActivityEdit] = useState<{ id: string | null; reviewed: boolean; form: ActivityForm } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => { setQ(qInput.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [qInput]);

  const loadSummary = useCallback(async () => {
    try {
      setSummary(await apiResourcesSummary());
    } catch (e) {
      toast.error("Could not load the counts", { description: memberError(e) });
    }
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (kind === "cards") {
        setCards(await apiSupportCards({ q, reviewed: reviewF, mood, page, page_size: PAGE_SIZE }));
      } else {
        setActivities(await apiActivities({ q, reviewed: reviewF, page, page_size: PAGE_SIZE }));
      }
    } catch (e) {
      setError(memberError(e));
    } finally {
      setLoading(false);
    }
  }, [kind, q, reviewF, mood, page]);

  // The effect body itself sets no state: the work happens inside an async
  // function it starts, which is what `react-hooks/set-state-in-effect` asks.
  useEffect(() => { void (async () => { await load(); })(); }, [load]);
  useEffect(() => { void (async () => { await loadSummary(); })(); }, [loadSummary]);

  const refreshAll = useCallback(async () => {
    await Promise.all([load(), loadSummary()]);
  }, [load, loadSummary]);

  const noun = kind === "cards" ? "card" : "activity";

  const review = useCallback(async (id: string, title: string) => {
    try {
      await apiReviewWellbeing(kind, id);
      toast.success("Marked reviewed", { description: `"${title}" can now be shown to members.` });
      await refreshAll();
    } catch (e) {
      toast.error(`Could not mark that ${noun} reviewed`, { description: memberError(e) });
    }
  }, [kind, noun, refreshAll, toast]);

  const unreview = useCallback(async (id: string, title: string) => {
    const ok = await confirm({
      title: `Withdraw the review of "${title}"?`,
      description: `It stops being shown to members immediately, and stays here until someone reviews it again.`,
      confirmLabel: "Withdraw review",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiUnreviewWellbeing(kind, id);
      toast.success("Review withdrawn", { description: `"${title}" is no longer shown.` });
      await refreshAll();
    } catch (e) {
      toast.error("Could not withdraw that review", { description: memberError(e) });
    }
  }, [confirm, kind, refreshAll, toast]);

  const remove = useCallback(async (id: string, title: string) => {
    const ok = await confirm({
      title: `Delete "${title}"?`,
      description: `It was never reviewed, so no member has seen it. This cannot be undone.`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteWellbeing(kind, id);
      toast.success(`The ${noun} was deleted`);
      await refreshAll();
    } catch (e) {
      toast.error(`Could not delete that ${noun}`, { description: memberError(e) });
    }
  }, [confirm, kind, noun, refreshAll, toast]);

  const saveCard = useCallback(async () => {
    if (!cardEdit) return;
    const parsed = cardInput(cardEdit.form);
    if (!parsed.ok) { setFormError(parsed.error); return; }
    setBusy(true);
    setFormError(null);
    try {
      if (cardEdit.id) {
        const saved = await apiUpdateCard(cardEdit.id, parsed.body);
        toast.success("Card saved", {
          description: cardEdit.reviewed && !saved.reviewed
            ? "The words changed, so it is back to awaiting review."
            : saved.reviewed ? "It is reviewed and can be shown." : "It stays unreviewed until someone signs it off.",
        });
      } else {
        await apiCreateCard(parsed.body);
        toast.success("Card written", { description: "It is awaiting review before it can be shown." });
      }
      setCardEdit(null);
      await refreshAll();
    } catch (e) {
      setFormError(memberError(e));
    } finally {
      setBusy(false);
    }
  }, [cardEdit, refreshAll, toast]);

  const saveActivity = useCallback(async () => {
    if (!activityEdit) return;
    const parsed = activityInput(activityEdit.form);
    if (!parsed.ok) { setFormError(parsed.error); return; }
    setBusy(true);
    setFormError(null);
    try {
      if (activityEdit.id) {
        const saved = await apiUpdateActivity(activityEdit.id, parsed.body);
        toast.success("Activity saved", {
          description: activityEdit.reviewed && !saved.reviewed
            ? "The words changed, so it is back to awaiting review."
            : saved.reviewed ? "It is reviewed and can be shown." : "It stays unreviewed until someone signs it off.",
        });
      } else {
        await apiCreateActivity(parsed.body);
        toast.success("Activity added", { description: "It is awaiting review before it can be shown." });
      }
      setActivityEdit(null);
      await refreshAll();
    } catch (e) {
      setFormError(memberError(e));
    } finally {
      setBusy(false);
    }
  }, [activityEdit, refreshAll, toast]);

  const openCreate = useCallback(() => {
    setFormError(null);
    if (kind === "cards") setCardEdit({ id: null, reviewed: false, form: emptyCard() });
    else setActivityEdit({ id: null, reviewed: false, form: emptyActivity() });
  }, [kind]);

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const meta = kind === "cards" ? cards?.meta : activities?.meta;
  const hasData = kind === "cards" ? !!cards : !!activities;
  const count = kind === "cards" ? (cards?.items.length ?? 0) : (activities?.items.length ?? 0);
  const from = meta && meta.total > 0 ? (meta.page - 1) * meta.page_size + 1 : 0;
  const to = meta ? Math.min(meta.page * meta.page_size, meta.total) : 0;
  const filtered = Boolean(q || reviewF || (kind === "cards" && mood));

  const tabs = [
    summary ? { value: "cards", label: "Support cards", count: summary.cards.total } : { value: "cards", label: "Support cards" },
    summary ? { value: "activities", label: "Reset activities", count: summary.activities.total } : { value: "activities", label: "Reset activities" },
  ];

  return (
    <div className="wc-page-enter">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <HeartHandshake className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Wellbeing cards</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              The one card a member sees after a mood check-in, and the small things she can do to reset.
              Nothing is shown until a person has read it and said so.
            </p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="h-4 w-4" /> {kind === "cards" ? "Write a card" : "Add an activity"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cards ready" value={summary ? String(summary.cards.reviewed) : "—"}
                  icon={CheckCircle2} tone="emerald" deltaNote="Reviewed — the engine can pick these" />
        <StatCard label="Cards waiting" value={summary ? String(summary.cards.unreviewed) : "—"}
                  icon={Clock} tone={summary && summary.cards.unreviewed > 0 ? "amber" : "slate"}
                  deltaNote={summary && summary.cards.unreviewed > 0 ? "Not shown until reviewed" : "Nothing waiting"} />
        <StatCard label="Activities ready" value={summary ? String(summary.activities.reviewed) : "—"}
                  icon={Sparkles} tone="brand" deltaNote="Reviewed — offered as a reset" />
        <StatCard label="Activities waiting" value={summary ? String(summary.activities.unreviewed) : "—"}
                  icon={Clock} tone={summary && summary.activities.unreviewed > 0 ? "amber" : "slate"}
                  deltaNote={summary && summary.activities.unreviewed > 0 ? "Not shown until reviewed" : "Nothing waiting"} />
      </div>

      <Card className="mt-6">
        <Tabs tabs={tabs} value={kind} onChange={(v) => { setKind(v as WellbeingKind); setPage(1); setMood(""); }} className="mb-4" />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder={kind === "cards" ? "Search title or words…" : "Search the activity…"}
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu
            trigger={
              <span className="btn btn-sm btn-outline">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {REVIEW_OPTIONS.find((o) => o.value === reviewF)?.label}
              </span>
            }
          >
            {REVIEW_OPTIONS.map((o) => (
              <MenuItem key={o.value || "all"} onClick={() => { setReviewF(o.value); setPage(1); }}>{o.label}</MenuItem>
            ))}
          </Menu>
          {kind === "cards" && (
            <Menu trigger={<span className="btn btn-sm btn-outline">{mood ? `Mood: ${mood}` : "Any mood"}</span>}>
              <MenuItem onClick={() => { setMood(""); setPage(1); }}>Any mood</MenuItem>
              {MOODS.filter((m) => m !== "good").map((m) => (
                <MenuItem key={m} onClick={() => { setMood(m); setPage(1); }}>{m}</MenuItem>
              ))}
            </Menu>
          )}
        </div>

        {loading && !hasData ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : error ? (
          <ErrorState title={`Could not load the ${kind === "cards" ? "cards" : "activities"}`} description={error} onRetry={() => void load()} />
        ) : count === 0 ? (
          <div className="px-6 py-14 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-tint text-brand-ink">
              <HeartHandshake className="h-6 w-6" />
            </span>
            <p className="mt-3 text-sm font-semibold text-ink">
              {filtered ? "Nothing matches that" : kind === "cards" ? "No support cards yet" : "No reset activities yet"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-ink-subtle">
              {filtered
                ? "Try a different search, or clear a filter."
                : kind === "cards"
                  ? "Write one. It is not shown to anyone until it has been reviewed."
                  : "Add one — something finishable in under fifteen minutes with nothing to buy."}
            </p>
          </div>
        ) : kind === "cards" ? (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Card</th>
                  <th className="px-3 py-2.5">Answers</th>
                  <th className="px-3 py-2.5">Style</th>
                  <th className="px-3 py-2.5">Kind</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {(cards?.items ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="max-w-md px-3 py-3">
                      <p className="truncate text-sm font-semibold text-ink">{c.title}</p>
                      <p className="truncate text-xs text-ink-subtle">{c.body}</p>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.moods.map((m) => <Badge key={m} tone="violet">{m}</Badge>)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{c.styles.join(", ") || "—"}</td>
                    <td className="px-3 py-3 text-sm text-ink-muted">
                      {c.kind === "do" ? `To do${c.minutes ? ` · ${c.minutes} min` : ""}` : "To read"}
                    </td>
                    <td className="px-3 py-3"><ReviewBadge row={c} /></td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={FileEdit} onClick={() => { setFormError(null); setCardEdit({ id: c.id, reviewed: c.reviewed, form: cardFrom(c) }); }}>Edit</MenuItem>
                        {c.reviewed ? (
                          <MenuItem icon={Undo2} onClick={() => void unreview(c.id, c.title)}>Withdraw review</MenuItem>
                        ) : (
                          <>
                            <MenuItem icon={CheckCircle2} onClick={() => void review(c.id, c.title)}>Mark reviewed</MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => void remove(c.id, c.title)}>Delete</MenuItem>
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Activity</th>
                  <th className="px-3 py-2.5">Takes</th>
                  <th className="px-3 py-2.5">Icon</th>
                  <th className="px-3 py-2.5">State</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {(activities?.items ?? []).map((a) => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-surface-2">
                    <td className="max-w-lg px-3 py-3">
                      <p className="text-sm font-semibold text-ink">{a.text}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-ink-muted">{a.minutes} min</td>
                    <td className="px-3 py-3 text-sm text-ink-subtle">{a.icon || "—"}</td>
                    <td className="px-3 py-3"><ReviewBadge row={a} /></td>
                    <td className="px-3 py-3 text-right">
                      <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={FileEdit} onClick={() => { setFormError(null); setActivityEdit({ id: a.id, reviewed: a.reviewed, form: activityFrom(a) }); }}>Edit</MenuItem>
                        {a.reviewed ? (
                          <MenuItem icon={Undo2} onClick={() => void unreview(a.id, a.text)}>Withdraw review</MenuItem>
                        ) : (
                          <>
                            <MenuItem icon={CheckCircle2} onClick={() => void review(a.id, a.text)}>Mark reviewed</MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => void remove(a.id, a.text)}>Delete</MenuItem>
                          </>
                        )}
                      </Menu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.pages > 1 && (
          <Pagination
            className="mt-4"
            page={meta.page}
            pageCount={meta.pages}
            onPageChange={setPage}
            showing={`Showing ${from}–${to} of ${meta.total}`}
          />
        )}
      </Card>

      {/* ── card form ─────────────────────────────────────────────────── */}
      <Modal
        open={!!cardEdit}
        onClose={() => setCardEdit(null)}
        title={cardEdit?.id ? "Edit the card" : "Write a support card"}
        description={cardEdit?.id && cardEdit.reviewed
          ? "This card is reviewed. Changing its words sends it back to awaiting review; changing only moods, style or minutes does not."
          : "One reply to one check-in. It is not shown until someone has reviewed it."}
        size="lg"
      >
        {cardEdit && (
          <div className="space-y-4">
            <Input
              label="Title"
              required
              value={cardEdit.form.title}
              onChange={(e) => setCardEdit({ ...cardEdit, form: { ...cardEdit.form, title: e.target.value } })}
              placeholder="You have done enough today"
            />
            <Textarea
              label="The words"
              required
              rows={3}
              value={cardEdit.form.body}
              onChange={(e) => setCardEdit({ ...cardEdit, form: { ...cardEdit.form, body: e.target.value } })}
              placeholder="Whatever is left will still be there tomorrow."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-muted">Answers when she says she feels</p>
                <div className="grid grid-cols-2 gap-2">
                  {MOODS.filter((m) => m !== "good").map((m) => (
                    <Checkbox
                      key={m}
                      label={m}
                      checked={cardEdit.form.moods.includes(m)}
                      onChange={() => setCardEdit({ ...cardEdit, form: { ...cardEdit.form, moods: toggle(cardEdit.form.moods, m) } })}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-2xs text-ink-subtle">A woman who says she is fine gets no card.</p>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold text-ink-muted">Suits a style of</p>
                <div className="grid grid-cols-2 gap-2">
                  {STYLES.filter((s) => s !== "none" && s !== "quiet").map((s) => (
                    <Checkbox
                      key={s}
                      label={s}
                      checked={cardEdit.form.styles.includes(s)}
                      onChange={() => setCardEdit({ ...cardEdit, form: { ...cardEdit.form, styles: toggle(cardEdit.form.styles, s) } })}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-2xs text-ink-subtle">Quiet and none never receive a card.</p>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select
                label="Kind"
                value={cardEdit.form.kind}
                options={CARD_KINDS}
                onChange={(e) => setCardEdit({ ...cardEdit, form: { ...cardEdit.form, kind: e.target.value } })}
              />
              <Input
                label="Minutes it takes"
                type="number"
                min={0}
                max={60}
                hint="0 for something to read"
                value={cardEdit.form.minutes}
                onChange={(e) => setCardEdit({ ...cardEdit, form: { ...cardEdit.form, minutes: e.target.value } })}
              />
            </div>
            {formError && (
              <p className="rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{formError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setCardEdit(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void saveCard()}>
                {busy ? "Saving…" : cardEdit.id ? "Save changes" : "Write it (awaiting review)"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── activity form ─────────────────────────────────────────────── */}
      <Modal
        open={!!activityEdit}
        onClose={() => setActivityEdit(null)}
        title={activityEdit?.id ? "Edit the activity" : "Add a reset activity"}
        description={activityEdit?.id && activityEdit.reviewed
          ? "This activity is reviewed. Changing its words sends it back to awaiting review."
          : "Something to do, finishable in under fifteen minutes with nothing to buy and nobody to ask."}
      >
        {activityEdit && (
          <div className="space-y-4">
            <Textarea
              label="What to do"
              required
              rows={2}
              value={activityEdit.form.text}
              onChange={(e) => setActivityEdit({ ...activityEdit, form: { ...activityEdit.form, text: e.target.value } })}
              placeholder="Step outside for ten minutes"
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Minutes"
                type="number"
                min={1}
                max={15}
                required
                value={activityEdit.form.minutes}
                onChange={(e) => setActivityEdit({ ...activityEdit, form: { ...activityEdit.form, minutes: e.target.value } })}
              />
              <Input
                label="Icon"
                hint="A Lucide icon name — Sun, Wind, Droplet, Music"
                value={activityEdit.form.icon}
                onChange={(e) => setActivityEdit({ ...activityEdit, form: { ...activityEdit.form, icon: e.target.value } })}
              />
            </div>
            {formError && (
              <p className="rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{formError}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-outline" onClick={() => setActivityEdit(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={busy} onClick={() => void saveActivity()}>
                {busy ? "Saving…" : activityEdit.id ? "Save changes" : "Add it (awaiting review)"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
