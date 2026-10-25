"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, ArchiveRestore, Archive, Eye, FolderInput, Layers, MoreHorizontal, Pencil,
  Plus, Search, Star, StarOff, Tags, Users,
} from "lucide-react";

import {
  Badge, Card, EmptyState, ErrorState, Input, Menu, MenuItem, Modal, NoResults, Select, SkeletonTable,
  StatCard, Switch, useConfirm, useToast,
} from "@/design-system";
import { memberError } from "@/lib/member-api";
import {
  apiAdminAddWorkCategory, apiAdminAddWorkSkill, apiAdminEditWorkCategory, apiAdminEditWorkSkill,
  apiAdminWorkTaxonomy, type AdminWorkCategory, type AdminWorkSkill,
} from "@/lib/work-api";

/**
 * Work categories & skills — the master list behind "My work profile" and
 * "Find people" (backend: routes/work_talent.py, /admin/work).
 *
 * Nothing is ever deleted. A member's profile stores skill keys, so a skill
 * that disappeared would silently drop out of her profile; retiring keeps the
 * key, stops offering it, and keeps her hidden from search for it.
 */

type Dialog =
  | { kind: "add-category" }
  | { kind: "rename-category"; cat: AdminWorkCategory }
  | { kind: "add-skill" }
  | { kind: "rename-skill"; skill: AdminWorkSkill }
  | { kind: "move-skill"; skill: AdminWorkSkill }
  | null;

export default function WorkSkillsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [cats, setCats] = useState<AdminWorkCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [selected, setSelected] = useState("");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [name, setName] = useState("");
  const [popular, setPopular] = useState(false);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setCats(await apiAdminWorkTaxonomy()); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const ordered = useMemo(() => [...cats].sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name)), [cats]);
  const shownCats = useMemo(() => ordered.filter((c) => {
    if (!showRetired && !c.active) return false;
    const q = query.trim().toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || c.skills.some((s) => s.name.toLowerCase().includes(q));
  }), [ordered, query, showRetired]);

  const current = cats.find((c) => c.key === selected) ?? shownCats[0] ?? null;
  const skills = useMemo(() => {
    if (!current) return [];
    const q = query.trim().toLowerCase();
    return [...current.skills]
      .filter((s) => showRetired || s.active)
      .filter((s) => !q || current.name.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
  }, [current, query, showRetired]);

  const activeCats = cats.filter((c) => c.active);
  const activeSkills = activeCats.flatMap((c) => c.skills.filter((s) => s.active));
  const listed = cats.reduce((n, c) => n + c.skills.reduce((m, s) => m + s.members, 0), 0);
  const visible = cats.reduce((n, c) => n + c.skills.reduce((m, s) => m + s.shown, 0), 0);

  const run = async (work: () => Promise<unknown>, done: string, fail: string) => {
    setBusy(true);
    try { await work(); toast.success(done); setDialog(null); await load(); return true; }
    catch (e) { toast.error(fail, { description: memberError(e) }); return false; }
    finally { setBusy(false); }
  };

  const open = (d: Dialog) => {
    setName(d?.kind === "rename-category" ? d.cat.name : d?.kind === "rename-skill" ? d.skill.name : "");
    setPopular(false);
    setMoveTo("");
    setDialog(d);
  };

  const saveDialog = async () => {
    if (!dialog) return;
    const n = name.trim();
    if (dialog.kind === "move-skill") {
      if (!moveTo) { toast.error("Choose the category to move it to"); return; }
      await run(() => apiAdminEditWorkSkill(dialog.skill.key, { category: moveTo }),
        `${dialog.skill.name} moved`, "Could not move the skill");
      return;
    }
    if (n.length < 2) { toast.error("Give it a name of at least two letters"); return; }
    if (dialog.kind === "add-category") {
      setBusy(true);
      try {
        const made = await apiAdminAddWorkCategory(n);
        toast.success("Category added"); setDialog(null); await load(); setSelected(made.key);
      } catch (e) { toast.error("Could not add the category", { description: memberError(e) }); }
      finally { setBusy(false); }
    } else if (dialog.kind === "rename-category") {
      await run(() => apiAdminEditWorkCategory(dialog.cat.key, { name: n }), "Category renamed", "Could not rename the category");
    } else if (dialog.kind === "add-skill" && current) {
      await run(() => apiAdminAddWorkSkill(current.key, n, popular), "Skill added", "Could not add the skill");
    } else if (dialog.kind === "rename-skill") {
      await run(() => apiAdminEditWorkSkill(dialog.skill.key, { name: n }), "Skill renamed", "Could not rename the skill");
    }
  };

  const toggleCategory = async (c: AdminWorkCategory) => {
    if (c.active) {
      const ok = await confirm({
        title: `Retire ${c.name}?`,
        description: `Its ${c.skills.length} skills stop being offered. ${c.members} member listing${c.members === 1 ? "" : "s"} are kept, hidden from search, and come back if you restore it.`,
        confirmLabel: "Retire category", danger: true,
      });
      if (!ok) return;
    }
    await run(() => apiAdminEditWorkCategory(c.key, { active: !c.active }),
      c.active ? `${c.name} retired` : `${c.name} restored`, "Could not change the category");
  };

  const moveCategory = async (c: AdminWorkCategory, by: -1 | 1) => {
    const i = ordered.findIndex((x) => x.key === c.key);
    const other = ordered[i + by];
    if (!other) return;
    // Swap the two positions; equal sorts get distinct ones so the swap sticks.
    const a = other.sort === c.sort ? i + by : other.sort;
    const b = other.sort === c.sort ? i : c.sort;
    await run(async () => {
      await apiAdminEditWorkCategory(c.key, { sort: Math.max(0, a) });
      await apiAdminEditWorkCategory(other.key, { sort: Math.max(0, b) });
    }, "Order changed", "Could not change the order");
  };

  const toggleSkill = async (s: AdminWorkSkill) => {
    if (s.active) {
      const ok = await confirm({
        title: `Retire ${s.name}?`,
        description: `Members who already listed it keep it hidden from search; it is no longer offered. ${s.members} listed · ${s.shown} visible today.`,
        confirmLabel: "Retire skill", danger: true,
      });
      if (!ok) return;
    }
    await run(() => apiAdminEditWorkSkill(s.key, { active: !s.active }),
      s.active ? `${s.name} retired` : `${s.name} restored`, "Could not change the skill");
  };

  const togglePopular = (s: AdminWorkSkill) =>
    run(() => apiAdminEditWorkSkill(s.key, { popular: !s.popular }),
      s.popular ? `${s.name} is no longer popular` : `${s.name} marked popular`, "Could not change the skill");

  const dialogTitle = !dialog ? "" : {
    "add-category": "Add a category",
    "rename-category": "Rename category",
    "add-skill": `Add a skill to ${current?.name ?? ""}`,
    "rename-skill": "Rename skill",
    "move-skill": "Move to another category",
  }[dialog.kind];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><Tags className="h-6 w-6" /></span>
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">Work categories &amp; skills</h1>
            <p className="mt-1 text-sm text-ink-subtle">The one list members pick from in My work profile, and people hiring search by.</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => open({ kind: "add-category" })}><Plus className="h-4 w-4" /> Add category</button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Categories" value={String(activeCats.length)} icon={Layers} tone="brand" deltaNote="Active and offered" />
        <StatCard label="Skills" value={String(activeSkills.length)} icon={Tags} tone="violet" deltaNote="Active and offered" />
        <StatCard label="Skills listed" value={listed.toLocaleString()} icon={Users} tone="emerald" deltaNote="Across member work profiles" />
        <StatCard label="Switched on" value={visible.toLocaleString()} icon={Eye} tone="sky" deltaNote="Findable by people hiring" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input aria-label="Search categories and skills" value={query} onChange={(e) => setQuery(e.target.value)}
                   placeholder="Search categories and skills…"
                   className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300" />
          </label>
          <div className="min-w-56"><Switch label="Show retired" checked={showRetired} onChange={setShowRetired} /></div>
        </div>

        {loading ? <SkeletonTable rows={6} cols={4} />
          : error ? <ErrorState title="Could not load the skills list" description={error} onRetry={() => void load()} />
          : cats.length === 0 ? <EmptyState icon={Tags} title="No categories yet" description="Add the first category, then the skills in it." action={<button className="btn btn-primary" onClick={() => open({ kind: "add-category" })}><Plus className="h-4 w-4" /> Add category</button>} />
          : shownCats.length === 0 ? <NoResults icon={Tags} filtered thing="categories" onClear={() => { setQuery(""); setShowRetired(false); }} />
          : (
            <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
              {/* Categories */}
              <ul className="space-y-1.5" aria-label="Categories">
                {shownCats.map((c, i) => {
                  const on = current?.key === c.key;
                  const live = c.skills.filter((s) => s.active).length;
                  return (
                    <li key={c.key}
                        className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 ${on ? "border-violet-300 bg-violet-tint" : "border-line"} ${c.active ? "" : "opacity-60"}`}>
                      <button className="min-w-0 flex-1 text-left" onClick={() => setSelected(c.key)} aria-pressed={on}>
                        <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                        <p className="text-xs text-ink-subtle">{live} skill{live === 1 ? "" : "s"} · {c.members} listed</p>
                      </button>
                      {!c.active && <Badge tone="slate">Retired</Badge>}
                      <Menu trigger={<span className="btn btn-sm btn-ghost" aria-label={`Actions for ${c.name}`}><MoreHorizontal className="h-4 w-4" /></span>}>
                        <MenuItem icon={Pencil} onClick={() => open({ kind: "rename-category", cat: c })}>Rename</MenuItem>
                        {i > 0 && <MenuItem icon={ArrowUp} onClick={() => void moveCategory(c, -1)}>Move up</MenuItem>}
                        {i < shownCats.length - 1 && <MenuItem icon={ArrowDown} onClick={() => void moveCategory(c, 1)}>Move down</MenuItem>}
                        {c.active
                          ? <MenuItem icon={Archive} danger onClick={() => void toggleCategory(c)}>Retire</MenuItem>
                          : <MenuItem icon={ArchiveRestore} onClick={() => void toggleCategory(c)}>Restore</MenuItem>}
                      </Menu>
                    </li>
                  );
                })}
              </ul>

              {/* Skills in the selected category */}
              <div className="min-w-0">
                {current && (
                  <>
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h2 className="text-base font-bold text-ink">{current.name}</h2>
                        <p className="text-xs text-ink-subtle">
                          {current.active ? "Offered to members" : "Retired — not offered"} · {current.skills.length} skill{current.skills.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <button className="btn btn-outline btn-sm" onClick={() => open({ kind: "add-skill" })}><Plus className="h-4 w-4" /> Add skill</button>
                    </div>
                    {skills.length === 0 ? (
                      <EmptyState icon={Tags} title="No skills here yet" description="Add the skills women in this line of work would recognise." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead>
                            <tr className="border-b border-line text-2xs uppercase tracking-wide text-ink-subtle">
                              <th className="px-3 py-2.5">Skill</th>
                              <th className="px-3 py-2.5">Popular</th>
                              <th className="px-3 py-2.5">Members</th>
                              <th className="px-3 py-2.5">State</th>
                              <th className="px-3 py-2.5" />
                            </tr>
                          </thead>
                          <tbody>
                            {skills.map((s) => (
                              <tr key={s.key} className={`border-b border-line last:border-0 ${s.active ? "" : "opacity-60"}`}>
                                <td className="px-3 py-3">
                                  <p className="text-sm font-semibold text-ink">{s.name}</p>
                                  <p className="text-2xs text-ink-subtle">{s.key}</p>
                                </td>
                                <td className="px-3 py-3">
                                  <button className="btn btn-sm btn-ghost" disabled={busy}
                                          aria-pressed={s.popular} aria-label={s.popular ? `Unmark ${s.name} as popular` : `Mark ${s.name} as popular`}
                                          onClick={() => void togglePopular(s)}>
                                    {s.popular ? <Star className="h-4 w-4 fill-current text-amber-500" /> : <StarOff className="h-4 w-4" />}
                                  </button>
                                </td>
                                <td className="px-3 py-3 text-sm text-ink-muted">{s.members} listed · {s.shown} visible</td>
                                <td className="px-3 py-3"><Badge tone={s.active ? "emerald" : "slate"}>{s.active ? "Active" : "Retired"}</Badge></td>
                                <td className="px-3 py-3 text-right">
                                  <Menu trigger={<span className="btn btn-sm btn-ghost" aria-label={`Actions for ${s.name}`}><MoreHorizontal className="h-4 w-4" /></span>}>
                                    <MenuItem icon={Pencil} onClick={() => open({ kind: "rename-skill", skill: s })}>Rename</MenuItem>
                                    <MenuItem icon={FolderInput} onClick={() => open({ kind: "move-skill", skill: s })}>Move to another category</MenuItem>
                                    <MenuItem icon={s.popular ? StarOff : Star} onClick={() => void togglePopular(s)}>{s.popular ? "Unmark popular" : "Mark popular"}</MenuItem>
                                    {s.active
                                      ? <MenuItem icon={Archive} danger onClick={() => void toggleSkill(s)}>Retire</MenuItem>
                                      : <MenuItem icon={ArchiveRestore} onClick={() => void toggleSkill(s)}>Restore</MenuItem>}
                                  </Menu>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
      </Card>

      <Modal open={dialog !== null} onClose={() => setDialog(null)} title={dialogTitle}>
        <div className="space-y-4">
          {dialog?.kind === "move-skill" ? (
            <>
              <p className="text-sm text-ink-muted">Move <b className="text-ink">{dialog.skill.name}</b> out of {current?.name}. Members who listed it keep it.</p>
              <Select label="Category" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}
                      options={[{ value: "", label: "Choose a category" },
                        ...ordered.filter((c) => c.key !== current?.key).map((c) => ({ value: c.key, label: c.active ? c.name : `${c.name} (retired)` }))]} />
            </>
          ) : (
            <>
              <Input label={dialog?.kind === "add-category" || dialog?.kind === "rename-category" ? "Category name" : "Skill name"}
                     required value={name} onChange={(e) => setName(e.target.value)}
                     placeholder={dialog?.kind === "add-category" || dialog?.kind === "rename-category" ? "Tailoring & fashion" : "Blouse stitching"} />
              {dialog?.kind === "add-skill" && (
                <Switch label="Popular" description="Shown first, before she searches." checked={popular} onChange={setPopular} />
              )}
              {(dialog?.kind === "rename-category" || dialog?.kind === "rename-skill") && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900">The key stays the same, so every member who listed it keeps it under the new name.</p>
              )}
            </>
          )}
          <div className="flex justify-end gap-2">
            <button className="btn btn-outline" onClick={() => setDialog(null)}>Cancel</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => void saveDialog()}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
