"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  Loader2,
  Lock,
  MessageCircle,
  Pencil,
  Plus,
  ShieldAlert,
  Users,
  UsersRound,
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
  Switch,
  Textarea,
} from "@/design-system";
import {
  apiAdminCircles,
  apiArchiveCircle,
  apiCreateCircle,
  apiUpdateCircle,
  type AdminCircle,
  type CircleInput,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

const EMPTY: CircleInput = {
  name: "",
  topic: "",
  desc: "",
  guidelines: "",
  is_private: false,
  status: "active",
};

export default function AdminCirclesPage() {
  const [circles, setCircles] = useState<AdminCircle[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CircleInput>(EMPTY);

  const load = useCallback(async () => {
    try {
      setCircles(await apiAdminCircles({ q }));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [load, q]);

  const stats = useMemo(
    () => [
      { label: "Circles", value: circles.length },
      {
        label: "Active",
        value: circles.filter((c) => c.status === "active").length,
        tone: "text-status-ok-ink",
      },
      {
        label: "Memberships",
        value: circles.reduce((n, c) => n + c.member_count, 0),
        tone: "text-brand-ink",
      },
      {
        label: "Posts",
        value: circles.reduce((n, c) => n + c.post_count, 0),
        tone: "text-violet-ink",
      },
    ],
    [circles],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setFormOpen(true);
  }

  function openEdit(c: AdminCircle) {
    setEditing(c.id);
    setForm({
      name: c.name, topic: c.topic, desc: c.desc,
      guidelines: c.guidelines, is_private: c.is_private, status: c.status,
    });
    setFormOpen(true);
  }

  async function save() {
    setWorking(true);
    setError("");
    try {
      if (editing) await apiUpdateCircle(editing, form);
      else await apiCreateCircle(form);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  async function archive(id: string) {
    setWorking(true);
    try {
      await apiArchiveCircle(id);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  const set = (k: keyof CircleInput) => (v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <AdminPage
      title="Circles"
      subtitle="The rooms of the platform. A circle with a clear subject and one good guideline runs itself."
      error={error}
      stats={stats}
      action={
        <div className="flex gap-2">
          <Link href="/dashboard/circles/moderation" className="btn btn-outline">
            <ShieldAlert className="h-4 w-4" /> Moderation
          </Link>
          <button onClick={openCreate} className="btn btn-primary">
            <Plus className="h-4 w-4" /> New circle
          </button>
        </div>
      }
    >
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search circles…"
        className="mb-4 max-w-xs"
      />

      {loading ? (
        <AdminLoading />
      ) : circles.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="No circles yet"
          description="Create the first one — members join and start talking within a day."
        />
      ) : (
        <div className="grid gap-3 [&>*]:min-w-0 xl:grid-cols-2">
          {circles.map((c) => (
            <Card key={c.id} className={c.status !== "active" ? "opacity-70" : ""}>
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-brand-500 font-display font-bold text-white">
                  {c.name.charAt(0)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-display font-bold text-ink">{c.name}</h2>
                      <p className="text-xs text-ink-subtle">{c.topic}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {c.is_private && (
                        <span
                          title="Private"
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-inset text-ink-subtle"
                        >
                          <Lock className="h-3 w-3" />
                        </span>
                      )}
                      <Badge tone={c.status === "active" ? "emerald" : "slate"}>{c.status}</Badge>
                    </div>
                  </div>

                  <p className="mt-1.5 line-clamp-2 text-sm text-ink-muted">{c.desc}</p>

                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 dark:border-white/10">
                    <span className="flex items-center gap-1 px-1 text-xs text-ink-subtle">
                      <Users className="h-3.5 w-3.5" />
                      {c.member_count}
                    </span>
                    <Link
                      href={`/dashboard/circles/moderation?circle=${c.id}`}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-ink transition hover:bg-brand-tint"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {c.post_count} posts
                    </Link>
                    <button
                      onClick={() => openEdit(c)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-subtle transition hover:bg-surface-hover"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {c.status === "active" && (
                      <button
                        onClick={() => archive(c.id)}
                        disabled={working}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-status-danger-ink transition hover:bg-status-danger-bg"
                      >
                        <Archive className="h-3.5 w-3.5" /> Archive
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit circle" : "New circle"}
        icon={UsersRound}
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={save}
              disabled={working || !form.name.trim()}
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              {editing ? "Save changes" : "Create circle"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
            placeholder="Tailoring & Stitching Sisters"
          />
          <Input
            label="Topic"
            value={form.topic}
            onChange={(e) => set("topic")(e.target.value)}
            placeholder="Craft"
          />
          <Textarea
            label="What is this circle for?"
            value={form.desc}
            onChange={(e) => set("desc")(e.target.value)}
          />
          <Input
            label="One guideline"
            value={form.guidelines}
            onChange={(e) => set("guidelines")(e.target.value)}
            placeholder="Share what you know. Nobody here is a beginner for asking."
          />
          <Switch
            label="Private circle"
            description="Only members who join can read what's inside."
            checked={form.is_private}
            onChange={(v) => set("is_private")(v)}
          />
          <Select
            label="Status"
            value={form.status}
            onChange={(e) => set("status")(e.target.value)}
            options={["active", "archived"]}
          />
        </div>
      </Modal>
    </AdminPage>
  );
}
