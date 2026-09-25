"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase, BriefcaseBusiness, CalendarClock, Check, IndianRupee, Loader2, Lock, LockOpen, MapPin,
  MoreHorizontal, Pencil, Plus, Search, Send, SlidersHorizontal, Users,
} from "lucide-react";
import {
  Badge, Card, EmptyState, Input, Menu, MenuItem, Modal, Select, Spinner, StatCard, Textarea,
  useConfirm, useToast,
} from "@/design-system";
import {
  apiGrowthCloseOpportunity, apiGrowthCreateOpportunity, apiGrowthOpportunities,
  apiGrowthReopenOpportunity, apiGrowthSummary, apiGrowthUpdateOpportunity,
  type GrowthSummary, type OpportunityInput, type OpportunityRow,
} from "@/lib/growth-admin-api";
import { memberError } from "@/lib/member-api";

/**
 * Opportunities — jobs, orders and freelance work.
 *
 * "Applied" is a count of application rows that were not withdrawn, not the
 * document's counter. Closing never deletes: women have applications against
 * the listing, and those keep their history.
 */

const KINDS = ["Job", "Internship", "Freelance", "Craft order", "Training"];

const EMPTY: OpportunityInput = {
  title: "", org: "", kind: "Job", desc: "", location: "", mode: "On-site", pay: "",
  skills: [], openings: 1, deadline: "", experience: "", contact_note: "", status: "open",
};

const STATUS_LABEL: Record<string, string> = { "": "Open and closed", open: "Open", closed: "Closed" };

export default function AdminOpportunitiesPage() {
  const toast = useToast();
  const confirm = useConfirm();

  const [items, setItems] = useState<OpportunityRow[]>([]);
  const [summary, setSummary] = useState<GrowthSummary["opportunities"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<OpportunityRow | null>(null);
  const [form, setForm] = useState<OpportunityInput>(EMPTY);
  const [skillsText, setSkillsText] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [list, sum] = await Promise.all([
        apiGrowthOpportunities({ q, kind, status: statusFilter }),
        apiGrowthSummary(),
      ]);
      setItems(list);
      setSummary(sum.opportunities);
    } catch (e) {
      toast.error("Could not load opportunities", { description: memberError(e) });
    } finally {
      setLoading(false);
    }
  }, [kind, q, statusFilter, toast]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [refresh, q]);

  const today = new Date().toISOString().slice(0, 10);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setSkillsText(""); setFormOpen(true); };
  const openEdit = (o: OpportunityRow) => {
    setEditing(o);
    setForm({
      title: o.title, org: o.org, kind: o.kind, desc: o.desc, location: o.location, mode: o.mode,
      pay: o.pay, skills: o.skills, openings: o.openings, deadline: o.deadline,
      experience: o.experience, contact_note: o.contact_note, status: o.status,
    });
    setSkillsText(o.skills.join(", "));
    setFormOpen(true);
  };
  const set = (k: keyof OpportunityInput) => (v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = useCallback(async () => {
    if (!form.title.trim()) { toast.error("Give the listing a title"); return; }
    setBusy(true);
    const body: OpportunityInput = { ...form, skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean) };
    try {
      if (editing) {
        await apiGrowthUpdateOpportunity(editing.id, body);
        toast.success("Listing updated");
      } else {
        await apiGrowthCreateOpportunity(body);
        toast.success("Posted", { description: body.status === "open" ? "Members can apply from now." : "Saved as closed — nobody can apply yet." });
      }
      setFormOpen(false);
      await refresh();
    } catch (e) {
      toast.error("Could not save the listing", { description: memberError(e) });
    } finally {
      setBusy(false);
    }
  }, [editing, form, refresh, skillsText, toast]);

  const close = useCallback(async (o: OpportunityRow) => {
    const ok = await confirm({
      title: `Close "${o.title}"?`,
      description: o.applicant_count > 0
        ? `No more applications will be accepted. The ${o.applicant_count} already in keep their place — move them from the Applications queue.`
        : "No more applications will be accepted. You can reopen it later.",
      confirmLabel: "Close it",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiGrowthCloseOpportunity(o.id);
      toast.success("Closed", { description: "It no longer accepts applications." });
      await refresh();
    } catch (e) {
      toast.error("Could not close it", { description: memberError(e) });
    }
  }, [confirm, refresh, toast]);

  const reopen = useCallback(async (o: OpportunityRow) => {
    try {
      await apiGrowthReopenOpportunity(o.id);
      toast.success("Open again", { description: o.deadline && o.deadline < today ? "The deadline has passed — edit it or nobody can apply." : "Members can apply from now." });
      await refresh();
    } catch (e) {
      toast.error("Could not reopen it", { description: memberError(e) });
    }
  }, [refresh, toast, today]);

  const filtered = q || kind || statusFilter;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Opportunities</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              Jobs, orders and freelance work. Only list an employer once someone here has actually checked them.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/applications" className="btn btn-outline"><Send className="h-4 w-4" /> Applications</Link>
          <button className="btn btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> Post work</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open listings" value={summary ? String(summary.open) : "—"} icon={BriefcaseBusiness} tone="brand"
                  deltaNote="Accepting applications" />
        <StatCard label="Applications" value={summary ? String(summary.applications) : "—"} icon={Send} tone="violet"
                  deltaNote="Across every listing, not withdrawn" />
        <StatCard label="Positions open" value={summary ? String(summary.openings) : "—"} icon={Users} tone="emerald"
                  deltaNote="Openings on open listings" />
        <StatCard label="Closed" value={summary ? String(summary.closed) : "—"} icon={Lock} tone="slate"
                  deltaNote="Kept, with their applications" />
      </div>

      <Card className="mt-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              placeholder="Search by title, employer or skill…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
          </div>
          <Menu trigger={<span className="btn btn-sm btn-outline"><SlidersHorizontal className="h-3.5 w-3.5" />{STATUS_LABEL[statusFilter]}</span>}>
            {Object.entries(STATUS_LABEL).map(([v, label]) => (
              <MenuItem key={v || "all"} onClick={() => setStatusFilter(v)}>{label}</MenuItem>
            ))}
          </Menu>
          <button onClick={() => setKind("")}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${!kind ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-muted hover:bg-surface-hover"}`}>
            All types
          </button>
          {KINDS.map((k) => (
            <button key={k} onClick={() => setKind(kind === k ? "" : k)}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${kind === k ? "bg-brand-600 text-white" : "bg-surface-2 text-ink-muted hover:bg-surface-hover"}`}>
              {k}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title={filtered ? "Nothing matches that" : "Nothing listed yet"}
            description={filtered ? "Try a different search, or clear the filters." : "This is the screen that turns a finished programme into an income."}
            action={!filtered && <button onClick={openCreate} className="btn btn-primary btn-sm"><Plus className="h-3.5 w-3.5" /> Post work</button>}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                  <th className="px-3 py-2.5">Listing</th>
                  <th className="px-3 py-2.5">Pay</th>
                  <th className="px-3 py-2.5">Where</th>
                  <th className="px-3 py-2.5">Applied</th>
                  <th className="px-3 py-2.5">Apply by</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5 text-right">&nbsp;</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const overdue = !!o.deadline && o.deadline < today;
                  return (
                    <tr key={o.id} className={`border-b border-line last:border-0 hover:bg-surface-2 ${o.status !== "open" ? "opacity-70" : ""}`}>
                      <td className="max-w-sm px-3 py-3">
                        <p className="truncate text-sm font-semibold text-ink">{o.title}</p>
                        <p className="truncate text-xs text-ink-subtle">{o.org || "Employer not named"} · {o.kind}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1 text-sm text-ink-muted"><IndianRupee className="h-3.5 w-3.5 text-ink-subtle" />{o.pay || "Not stated"}</span>
                      </td>
                      <td className="px-3 py-3 text-sm text-ink-muted">
                        <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-ink-subtle" />{o.location || "—"}</span>
                        <p className="text-2xs text-ink-subtle">{o.mode}</p>
                      </td>
                      <td className="px-3 py-3">
                        <Link href={`/dashboard/applications?opportunity=${o.id}`} className="text-sm font-semibold text-brand-ink hover:underline">
                          {o.applicant_count}
                        </Link>
                        <p className="text-2xs text-ink-subtle">{o.openings} {o.openings === 1 ? "opening" : "openings"}</p>
                      </td>
                      <td className="px-3 py-3 text-sm">
                        <span className={`flex items-center gap-1 ${overdue && o.status === "open" ? "font-semibold text-status-warn-ink" : "text-ink-muted"}`}>
                          <CalendarClock className="h-3.5 w-3.5" />{o.deadline_label || "No deadline"}
                        </span>
                        {overdue && o.status === "open" && <p className="text-2xs text-status-warn-ink">Passed — nobody can apply</p>}
                      </td>
                      <td className="px-3 py-3"><Badge tone={o.status === "open" ? "emerald" : "slate"}>{o.status}</Badge></td>
                      <td className="px-3 py-3 text-right">
                        <Menu trigger={<span className="btn btn-sm btn-ghost"><MoreHorizontal className="h-4 w-4" /></span>}>
                          <MenuItem icon={Send} href={`/dashboard/applications?opportunity=${o.id}`}>See applications</MenuItem>
                          <MenuItem icon={Pencil} onClick={() => openEdit(o)}>Edit</MenuItem>
                          {o.status === "open"
                            ? <MenuItem icon={Lock} danger onClick={() => void close(o)}>Close to applications</MenuItem>
                            : <MenuItem icon={LockOpen} onClick={() => void reopen(o)}>Reopen</MenuItem>}
                        </Menu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit listing" : "Post work"}
        description="Put a real number in the pay field. A listing without one wastes the time of the person who can least afford it."
        icon={Briefcase}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={() => void save()} disabled={busy || !form.title.trim()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Post it"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => set("title")(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Employer / organisation" value={form.org} onChange={(e) => set("org")(e.target.value)} />
            <Select label="Type" value={form.kind} onChange={(e) => set("kind")(e.target.value)} options={KINDS} />
            <Input label="Pay" value={form.pay} onChange={(e) => set("pay")(e.target.value)} placeholder="₹12,000 – ₹18,000 / month"
                   hint="Write it with ₹ and a period (month, piece, day) — the figures are read out of this text." />
            <Select label="Mode" value={form.mode} onChange={(e) => set("mode")(e.target.value)} options={["On-site", "Remote", "Hybrid"]} />
            <Input label="Location" value={form.location} onChange={(e) => set("location")(e.target.value)} />
            <Input label="Openings" type="number" value={String(form.openings)} onChange={(e) => set("openings")(Math.max(1, Number(e.target.value) || 1))} />
            <Input label="Apply by" type="date" value={form.deadline} onChange={(e) => set("deadline")(e.target.value)} />
            <Select label="Status" value={form.status} onChange={(e) => set("status")(e.target.value)}
                    options={[{ value: "open", label: "Open — accepting applications" }, { value: "closed", label: "Closed" }]} />
          </div>
          <Textarea label="What is the work?" value={form.desc} onChange={(e) => set("desc")(e.target.value)} />
          <Input label="Skills (comma separated)" value={skillsText} onChange={(e) => setSkillsText(e.target.value)} placeholder="Tailoring, Blouse stitching" />
          <Input label="What they need" value={form.experience} onChange={(e) => set("experience")(e.target.value)} placeholder="Can stitch a lined blouse" />
          <Textarea label="Note shown to members" value={form.contact_note} onChange={(e) => set("contact_note")(e.target.value)}
                    placeholder="We've checked this employer. Applying is free and always will be." />
        </div>
      </Modal>
    </div>
  );
}
