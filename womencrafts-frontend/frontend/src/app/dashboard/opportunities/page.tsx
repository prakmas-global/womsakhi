"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  Building2,
  CalendarClock,
  Check,
  IndianRupee,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Send,
  Users,
  X,
} from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Modal,
  SearchInput,
  Select,
  Textarea,
} from "@/design-system";
import {
  apiAdminOpportunities,
  apiCloseOpportunity,
  apiCreateOpportunity,
  apiUpdateOpportunity,
  type AdminOpportunity,
  type OpportunityInput,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

const KINDS = ["Job", "Internship", "Freelance", "Craft order", "Training"];

const EMPTY: OpportunityInput = {
  title: "",
  org: "",
  kind: "Job",
  desc: "",
  location: "",
  mode: "On-site",
  pay: "",
  skills: [],
  openings: 1,
  deadline: "",
  experience: "",
  contact_note: "",
  status: "open",
};

export default function AdminOpportunitiesPage() {
  const [items, setItems] = useState<AdminOpportunity[]>([]);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<OpportunityInput>(EMPTY);
  const [skillsText, setSkillsText] = useState("");

  const load = useCallback(async () => {
    try {
      setItems(await apiAdminOpportunities({ q, kind }));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [q, kind]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const stats = useMemo(
    () => [
      { label: "Listings", value: items.length },
      {
        label: "Open",
        value: items.filter((o) => o.status === "open").length,
        tone: "text-status-ok-ink",
      },
      {
        label: "Applications",
        value: items.reduce((n, o) => n + o.applicant_count, 0),
        tone: "text-brand-ink",
      },
      {
        label: "Positions offered",
        value: items.reduce((n, o) => n + o.openings, 0),
        tone: "text-violet-ink",
      },
    ],
    [items],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setSkillsText("");
    setFormOpen(true);
  }

  function openEdit(o: AdminOpportunity) {
    setEditing(o.id);
    setForm({
      title: o.title, org: o.org, kind: o.kind, desc: o.desc, location: o.location,
      mode: o.mode, pay: o.pay, skills: o.skills, openings: o.openings,
      deadline: o.deadline, experience: o.experience, contact_note: o.contact_note,
      status: o.status,
    });
    setSkillsText(o.skills.join(", "));
    setFormOpen(true);
  }

  async function save() {
    setWorking(true);
    setError("");
    const body: OpportunityInput = {
      ...form,
      skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing) await apiUpdateOpportunity(editing, body);
      else await apiCreateOpportunity(body);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  async function close(id: string) {
    setWorking(true);
    try {
      await apiCloseOpportunity(id);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  const set = (k: keyof OpportunityInput) => (v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <AdminPage
      title="Opportunities"
      subtitle="Jobs, orders and freelance work. Only list an employer once someone here has actually checked them."
      error={error}
      stats={stats}
      action={
        <div className="flex gap-2">
          <Link href="/dashboard/applications" className="btn btn-outline">
            <Send className="h-4 w-4" /> Applications
          </Link>
          <button onClick={openCreate} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Post work
          </button>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search…" className="max-w-xs" />
        <button
          onClick={() => setKind("")}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
            !kind ? "bg-brand-600 text-white" : "wc-inset text-ink-muted"
          }`}
        >
          All
        </button>
        {KINDS.map((k) => (
          <button
            key={k}
            onClick={() => setKind(kind === k ? "" : k)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              kind === k ? "bg-brand-600 text-white" : "wc-inset text-ink-muted"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Nothing listed yet"
          description="This is the screen that turns a finished programme into an income."
          action={
            <button onClick={openCreate} className="btn btn-primary btn-sm">
              <Plus className="h-3.5 w-3.5" /> Post work
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((o) => (
            <Card key={o.id} className={o.status !== "open" ? "opacity-70" : ""}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="brand">{o.kind}</Badge>
                <Badge tone={o.status === "open" ? "emerald" : "slate"}>{o.status}</Badge>
              </div>

              <h2 className="mt-2 font-display font-bold leading-snug text-ink">{o.title}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
                <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-subtle" />
                {o.org}
              </p>

              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                <span className="flex items-center gap-1 font-semibold text-status-ok-ink">
                  <IndianRupee className="h-3.5 w-3.5" />
                  {o.pay}
                </span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {o.location} · {o.mode}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  by {o.deadline_label}
                </span>
              </p>

              <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 dark:border-white/10">
                <Link
                  href={`/dashboard/applications?opportunity=${o.id}`}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-brand-tint"
                >
                  <Users className="h-3.5 w-3.5" />
                  {o.applicant_count} applied · {o.openings}{" "}
                  {o.openings === 1 ? "opening" : "openings"}
                </Link>
                <button
                  onClick={() => openEdit(o)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-subtle transition hover:bg-surface-hover"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                {o.status === "open" && (
                  <button
                    onClick={() => close(o.id)}
                    disabled={working}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-status-danger-ink transition hover:bg-status-danger-bg"
                  >
                    <X className="h-3.5 w-3.5" /> Close
                  </button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit listing" : "Post work"}
        description="Put a real number in the pay field. A listing without one wastes the time of the person who can least afford it."
        icon={Briefcase}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={working || !form.title.trim()}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Post it"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Title" value={form.title} onChange={(e) => set("title")(e.target.value)} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Employer / organisation"
              value={form.org}
              onChange={(e) => set("org")(e.target.value)}
            />
            <Select
              label="Type"
              value={form.kind}
              onChange={(e) => set("kind")(e.target.value)}
              options={KINDS}
            />
            <Input
              label="Pay"
              value={form.pay}
              onChange={(e) => set("pay")(e.target.value)}
              placeholder="₹12,000 – ₹18,000 / month"
            />
            <Select
              label="Mode"
              value={form.mode}
              onChange={(e) => set("mode")(e.target.value)}
              options={["On-site", "Remote", "Hybrid"]}
            />
            <Input
              label="Location"
              value={form.location}
              onChange={(e) => set("location")(e.target.value)}
            />
            <Input
              label="Openings"
              type="number"
              value={String(form.openings)}
              onChange={(e) => set("openings")(Number(e.target.value) || 1)}
            />
            <Input
              label="Apply by"
              type="date"
              value={form.deadline}
              onChange={(e) => set("deadline")(e.target.value)}
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => set("status")(e.target.value)}
              options={["open", "closed"]}
            />
          </div>
          <Textarea
            label="What is the work?"
            value={form.desc}
            onChange={(e) => set("desc")(e.target.value)}
          />
          <Input
            label="Skills (comma separated)"
            value={skillsText}
            onChange={(e) => setSkillsText(e.target.value)}
            placeholder="Tailoring, Blouse stitching"
          />
          <Input
            label="What they need"
            value={form.experience}
            onChange={(e) => set("experience")(e.target.value)}
            placeholder="Can stitch a lined blouse"
          />
          <Textarea
            label="Note shown to members"
            value={form.contact_note}
            onChange={(e) => set("contact_note")(e.target.value)}
            placeholder="We've checked this employer. Applying is free and always will be."
          />
        </div>
      </Modal>
    </AdminPage>
  );
}
