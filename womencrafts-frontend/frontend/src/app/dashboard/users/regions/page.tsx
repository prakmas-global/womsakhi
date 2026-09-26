"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, MapPin, MoreHorizontal, Pencil, Plus, Search, ShieldCheck, Users } from "lucide-react";

import { Badge, Card, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Textarea, useConfirm, useToast } from "@/design-system";
import { memberError } from "@/lib/member-api";
import { apiArchiveRegion, apiCreateRegion, apiRegions, apiUpdateRegion, type AdminRegion } from "@/lib/regions-admin-api";

type Form = { name: string; description: string; status: "Active" | "Inactive" };
const EMPTY: Form = { name: "", description: "", status: "Active" };

export default function RegionsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<AdminRegion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [state, setState] = useState<"All" | "Active" | "Inactive">("All");
  const [editing, setEditing] = useState<AdminRegion | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await apiRegions()); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const shown = useMemo(() => rows.filter((row) => {
    if (state !== "All" && row.status !== state) return false;
    const q = query.trim().toLowerCase();
    return !q || `${row.name} ${row.description}`.toLowerCase().includes(q);
  }), [query, rows, state]);

  const openNew = () => { setForm(EMPTY); setEditing("new"); };
  const openEdit = (row: AdminRegion) => {
    setForm({ name: row.name, description: row.description, status: row.status }); setEditing(row);
  };
  const save = async () => {
    if (!form.name.trim()) { toast.error("Give the region a name"); return; }
    setBusy(true);
    try {
      if (editing === "new") await apiCreateRegion({ ...form, name: form.name.trim(), description: form.description.trim() });
      else if (editing) await apiUpdateRegion(editing.id, { ...form, name: form.name.trim(), description: form.description.trim() });
      toast.success(editing === "new" ? "Region created" : "Region updated");
      setEditing(null); await load();
    } catch (e) { toast.error("Could not save the region", { description: memberError(e) }); }
    finally { setBusy(false); }
  };
  const archive = async (row: AdminRegion) => {
    const ok = await confirm({
      title: `Archive ${row.name}?`,
      description: `${row.member_count} member and ${row.admin_count} administrator assignment${row.admin_count === 1 ? "" : "s"} are kept. The region leaves active choices until restored.`,
      confirmLabel: "Archive region", danger: true,
    });
    if (!ok) return;
    try { await apiArchiveRegion(row.id); toast.success(`${row.name} archived`); await load(); }
    catch (e) { toast.error("Could not archive the region", { description: memberError(e) }); }
  };

  const active = rows.filter((r) => r.status === "Active");
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><MapPin className="h-6 w-6" /></span>
          <div><h1 className="font-display text-2xl font-bold text-ink">Regions</h1><p className="mt-1 text-sm text-ink-subtle">The places used for member records and administrator responsibility.</p></div>
        </div>
        <button className="btn btn-primary" onClick={openNew}><Plus className="h-4 w-4" /> Add region</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Active regions" value={String(active.length)} icon={MapPin} tone="brand" deltaNote="Available for assignment" />
        <StatCard label="Members located" value={active.reduce((n, r) => n + r.member_count, 0).toLocaleString()} icon={Users} tone="emerald" deltaNote="Across active regions" />
        <StatCard label="Scoped admins" value={active.reduce((n, r) => n + r.admin_count, 0).toLocaleString()} icon={ShieldCheck} tone="violet" deltaNote="Region assignments" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" /><input aria-label="Search regions" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search regions…" className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300" /></label>
          <Select aria-label="Region status" value={state} onChange={(e) => setState(e.target.value as typeof state)} options={["All", "Active", "Inactive"]} />
        </div>
        {loading ? <div className="flex justify-center py-14"><Spinner /></div>
          : error ? <div className="py-12 text-center"><p className="text-sm font-semibold text-status-danger-ink">Could not load regions</p><p className="mt-1 text-xs text-ink-subtle">{error}</p><button className="btn btn-sm btn-outline mt-3" onClick={() => void load()}>Try again</button></div>
          : shown.length === 0 ? <div className="py-14 text-center"><MapPin className="mx-auto h-7 w-7 text-ink-subtle" /><p className="mt-2 text-sm font-semibold text-ink">No regions match</p></div>
          : <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr className="border-b border-line text-2xs uppercase tracking-wide text-ink-subtle"><th className="px-3 py-2.5">Region</th><th className="px-3 py-2.5">Members</th><th className="px-3 py-2.5">Admins</th><th className="px-3 py-2.5">State</th><th className="px-3 py-2.5" /></tr></thead><tbody>{shown.map((row) => <tr key={row.id} className="border-b border-line last:border-0"><td className="px-3 py-3"><p className="text-sm font-semibold text-ink">{row.name}</p><p className="max-w-lg text-xs text-ink-subtle">{row.description || "No description yet"}</p></td><td className="px-3 py-3 text-sm text-ink-muted">{row.member_count}</td><td className="px-3 py-3 text-sm text-ink-muted">{row.admin_count}</td><td className="px-3 py-3"><Badge tone={row.status === "Active" ? "emerald" : "slate"}>{row.status}</Badge></td><td className="px-3 py-3 text-right"><Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}><MenuItem icon={Pencil} onClick={() => openEdit(row)}>Edit</MenuItem>{row.status === "Active" && <MenuItem icon={Archive} danger onClick={() => void archive(row)}>Archive</MenuItem>}</Menu></td></tr>)}</tbody></table></div>}
      </Card>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Add a region" : "Edit region"}>
        <div className="space-y-4">
          <Input label="Region name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jaipur, Rajasthan" />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Who this region covers or how the team organises it" />
          <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Form["status"] })} options={["Active", "Inactive"]} />
          {editing !== "new" && editing && form.name !== editing.name && <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Renaming also updates member locations and staff assignments so existing relationships do not break.</p>}
          <div className="flex justify-end gap-2"><button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save region"}</button></div>
        </div>
      </Modal>
    </div>
  );
}
