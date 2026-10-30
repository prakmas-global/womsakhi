"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clapperboard, Eye, EyeOff, Pencil, PlayCircle, Plus, Search, Trash2 } from "lucide-react";

import {
  Badge, Card, EmptyState, ErrorState, Input, Modal, NoResults, Select, SkeletonTable, StatCard, Switch, Textarea,
  useConfirm, useToast,
} from "@/design-system";
import { memberError } from "@/lib/member-api";
import { useMaster } from "@/lib/masters-api";
import {
  VIDEO_CATEGORIES, VIDEO_LEVELS, apiAdminAddHealthVideo, apiAdminDeleteHealthVideo, apiAdminEditHealthVideo,
  apiAdminHealthVideos, fmtDuration, type HealthVideo, type HealthVideoInput, type VideoCategory,
} from "@/lib/health-videos-api";

/**
 * Health videos — the library members see in Health & Wellness → Videos
 * (backend: routes/health_videos.py, Content permission).
 *
 * A video is a YouTube link (played through the privacy-enhanced player) or
 * an https link to an .mp4/.webm file. Hiding one keeps it here and takes it
 * out of the member library; members' favourites of it simply stop showing.
 */

type Form = { title: string; category: VideoCategory; url: string; minutes: string; seconds: string; level: string;
              description: string; source: string; active: boolean; order: string };
const EMPTY: Form = { title: "", category: "Workout", url: "", minutes: "10", seconds: "0", level: "All levels",
                      description: "", source: "", active: true, order: "100" };

export default function HealthVideosAdmin() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<HealthVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("");
  const [editing, setEditing] = useState<HealthVideo | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  // Shelves are the `health_video_categories` master (Settings → Masters). A
  // video keeps a shelf that has since been disabled, so it stays in its form.
  const shelves = useMaster("health_video_categories", [...VIDEO_CATEGORIES]);
  const shelfOptions = form.category && !shelves.labels.includes(form.category) ? [form.category, ...shelves.labels] : shelves.labels;
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await apiAdminHealthVideos()); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const t = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(t); }, [load]);

  const shown = useMemo(() => rows.filter((v) => (!cat || v.category === cat)
    && (!query.trim() || `${v.title} ${v.source} ${v.description}`.toLowerCase().includes(query.trim().toLowerCase()))), [rows, cat, query]);

  const open = (v: HealthVideo | "new") => {
    setEditing(v);
    setForm(v === "new" ? EMPTY : {
      title: v.title, category: v.category, url: v.url, minutes: String(Math.floor(v.duration_sec / 60)),
      seconds: String(v.duration_sec % 60), level: v.level, description: v.description, source: v.source,
      active: v.active, order: String(v.order),
    });
  };

  const submit = async () => {
    const body: HealthVideoInput = {
      title: form.title.trim(), category: form.category, url: form.url.trim(),
      duration_sec: (Number(form.minutes) || 0) * 60 + (Number(form.seconds) || 0), level: form.level,
      description: form.description.trim(), source: form.source.trim(), active: form.active, order: Number(form.order) || 0,
    };
    if (body.title.length < 2 || !body.url || body.duration_sec < 10) {
      toast.error("Fill in the title, link and length", { description: "The length must be at least 10 seconds." });
      return;
    }
    setBusy(true);
    try {
      if (editing === "new") await apiAdminAddHealthVideo(body);
      else if (editing) await apiAdminEditHealthVideo(editing.id, body);
      toast.success(editing === "new" ? "Video added" : "Video saved");
      setEditing(null);
      await load();
    } catch (e) {
      toast.error("Could not save the video", { description: memberError(e) });
    } finally { setBusy(false); }
  };

  const toggle = async (v: HealthVideo) => {
    try { await apiAdminEditHealthVideo(v.id, { active: !v.active }); toast.success(v.active ? "Hidden from members" : "Shown to members"); await load(); }
    catch (e) { toast.error("Could not change it", { description: memberError(e) }); }
  };

  const remove = async (v: HealthVideo) => {
    const ok = await confirm({ title: `Delete “${v.title}”?`, description: "It leaves the member library for good. Hide it instead to keep it here.", confirmLabel: "Delete video", danger: true });
    if (!ok) return;
    try { await apiAdminDeleteHealthVideo(v.id); toast.success("Video deleted"); await load(); }
    catch (e) { toast.error("Could not delete it", { description: memberError(e) }); }
  };

  const live = rows.filter((v) => v.active);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><Clapperboard className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Health videos</h1>
            <p className="mt-1 text-sm text-ink-subtle">What members see in Health &amp; Wellness → Videos: workout, yoga, meditation, pregnancy, nutrition and sleep.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => open("new")}><Plus className="h-4 w-4" /> Add video</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Videos" value={String(rows.length)} icon={Clapperboard} tone="brand" deltaNote="In the library" />
        <StatCard label="Shown to members" value={String(live.length)} icon={Eye} tone="emerald" deltaNote="Active" />
        <StatCard label="Hidden" value={String(rows.length - live.length)} icon={EyeOff} tone="amber" deltaNote="Kept, not shown" />
        <StatCard label="Categories used" value={String(new Set(live.map((v) => v.category)).size)} icon={PlayCircle} tone="violet" deltaNote={`of ${shelves.labels.length}`} />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input aria-label="Search videos" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search videos…"
                   className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300" />
          </label>
          <div className="min-w-48">
            <Select label="Category" value={cat} onChange={(e) => setCat(e.target.value)}
                    options={[{ value: "", label: "All categories" }, ...shelves.labels.map((c) => ({ value: c, label: c }))]} />
          </div>
        </div>

        {loading ? <SkeletonTable rows={5} cols={5} />
          : error ? <ErrorState title="Could not load the videos" description={error} onRetry={() => void load()} />
          : rows.length === 0 ? <EmptyState icon={Clapperboard} title="No videos yet" description="Add the first one: paste a YouTube link, pick a category and its length." action={<button className="btn btn-primary" onClick={() => open("new")}><Plus className="h-4 w-4" /> Add video</button>} />
          : shown.length === 0 ? <NoResults icon={Clapperboard} filtered thing="videos" onClear={() => { setQuery(""); setCat(""); }} />
          : (
            <ul className="divide-y divide-line" data-admin-videos>
              {shown.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center gap-4 py-3">
                  <span className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {v.thumbnail && <img src={v.thumbnail} alt="" className="h-full w-full object-cover" />}
                    <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[11px] font-bold text-white">{fmtDuration(v.duration_sec)}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{v.title}</p>
                    <p className="text-xs text-ink-subtle">{[v.category, v.level, v.source, v.youtube_id ? "YouTube" : "Video file"].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Badge tone={v.active ? "emerald" : "amber"}>{v.active ? "Shown" : "Hidden"}</Badge>
                  <div className="flex gap-1">
                    <button className="btn btn-outline btn-sm" onClick={() => open(v)} aria-label={`Edit ${v.title}`}><Pencil className="h-4 w-4" /> Edit</button>
                    <button className="btn btn-outline btn-sm" onClick={() => void toggle(v)}>{v.active ? <><EyeOff className="h-4 w-4" /> Hide</> : <><Eye className="h-4 w-4" /> Show</>}</button>
                    <button className="btn btn-outline btn-sm" onClick={() => void remove(v)} aria-label={`Delete ${v.title}`}><Trash2 className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a health video" : "Edit video"}
             footer={<>
               <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
               <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Saving…" : "Save video"}</button>
             </>}>
        <div className="space-y-4">
          <Input label="Title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Morning yoga for beginners" />
          <Input label="Link" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })}
                 hint="A YouTube link, or an https link to an .mp4 or .webm file." placeholder="https://www.youtube.com/watch?v=…" />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as VideoCategory })}
                    options={shelfOptions.map((c) => ({ value: c, label: c }))} />
            <Select label="Level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}
                    options={VIDEO_LEVELS.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input label="Minutes" inputMode="numeric" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value.replace(/\D/g, "") })} />
            <Input label="Seconds" inputMode="numeric" value={form.seconds} onChange={(e) => setForm({ ...form, seconds: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
            <Input label="Order" inputMode="numeric" value={form.order} onChange={(e) => setForm({ ...form, order: e.target.value.replace(/\D/g, "") })} hint="Lower shows first" />
          </div>
          <Input label="Made by (optional)" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Channel or teacher" />
          <Textarea label="Description (optional)" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Switch label="Show to members" checked={form.active} onChange={(v) => setForm({ ...form, active: v })} />
        </div>
      </Modal>
    </div>
  );
}
