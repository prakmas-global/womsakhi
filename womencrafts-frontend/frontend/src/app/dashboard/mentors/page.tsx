"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  HeartHandshake,
  Inbox,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Star,
  UserMinus,
} from "lucide-react";

import AdminPage, { AdminLoading } from "@/components/admin/AdminPage";
import {
  Avatar,
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
  apiAdminMentors,
  apiCreateMentor,
  apiRetireMentor,
  apiUpdateMentor,
  type AdminMentor,
  type MentorInput,
} from "@/lib/admin-modules-api";
import { memberError } from "@/lib/member-api";

const EMPTY: MentorInput = {
  name: "",
  headline: "",
  bio: "",
  photo: "",
  expertise: [],
  languages: [],
  experience_years: 0,
  location: "",
  availability: "",
  status: "active",
};

export default function AdminMentorsPage() {
  const [mentors, setMentors] = useState<AdminMentor[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<MentorInput>(EMPTY);
  // Kept as text while typing — splitting on every keystroke makes commas
  // impossible to type.
  const [expertiseText, setExpertiseText] = useState("");
  const [languagesText, setLanguagesText] = useState("");

  const load = useCallback(async () => {
    try {
      setMentors(await apiAdminMentors({ q }));
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
      { label: "Mentors", value: mentors.length },
      {
        label: "Active",
        value: mentors.filter((m) => m.status === "active").length,
        tone: "text-status-ok-ink",
      },
      {
        label: "Sessions given",
        value: mentors.reduce((n, m) => n + m.sessions_done, 0),
        tone: "text-brand-ink",
      },
      {
        label: "Waiting requests",
        value: mentors.reduce((n, m) => n + m.open_requests, 0),
        tone: "text-status-warn-ink",
      },
    ],
    [mentors],
  );

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setExpertiseText("");
    setLanguagesText("");
    setFormOpen(true);
  }

  function openEdit(m: AdminMentor) {
    setEditing(m.id);
    setForm({
      name: m.name, headline: m.headline, bio: m.bio, photo: m.photo,
      expertise: m.expertise, languages: m.languages,
      experience_years: m.experience_years, location: m.location,
      availability: m.availability, status: m.status,
    });
    setExpertiseText(m.expertise.join(", "));
    setLanguagesText(m.languages.join(", "));
    setFormOpen(true);
  }

  const asList = (text: string) =>
    text.split(",").map((s) => s.trim()).filter(Boolean);

  async function save() {
    setWorking(true);
    setError("");
    const body: MentorInput = {
      ...form,
      expertise: asList(expertiseText),
      languages: asList(languagesText),
    };
    try {
      if (editing) await apiUpdateMentor(editing, body);
      else await apiCreateMentor(body);
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  async function retire(id: string) {
    setWorking(true);
    try {
      await apiRetireMentor(id);
      await load();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setWorking(false);
    }
  }

  const set = (k: keyof MentorInput) => (v: string | number) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <AdminPage
      title="Mentors"
      subtitle="Women who have agreed to guide members. Most are volunteers who never sign in — this is their whole record."
      error={error}
      stats={stats}
      action={
        <div className="flex gap-2">
          <Link href="/dashboard/mentors/requests" className="btn btn-outline">
            <Inbox className="h-4 w-4" /> Requests
          </Link>
          <button onClick={openCreate} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Add mentor
          </button>
        </div>
      }
    >
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Search by name or expertise…"
        className="mb-4 max-w-xs"
      />

      {loading ? (
        <AdminLoading />
      ) : mentors.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title="No mentors yet"
          description="Add the first one and she appears in the member directory straight away."
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {mentors.map((m) => (
            <Card key={m.id} className={m.status !== "active" ? "opacity-70" : ""}>
              <div className="flex items-start gap-3.5">
                <Avatar name={m.name} src={m.photo} size="lg" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-display font-bold text-ink">{m.name}</h2>
                      <p className="mt-0.5 text-sm leading-snug text-ink-muted">{m.headline}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge tone={m.status === "active" ? "emerald" : "slate"}>{m.status}</Badge>
                      {m.open_requests > 0 && (
                        <Badge tone="amber">{m.open_requests} waiting</Badge>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-subtle">
                    <span className="flex items-center gap-1 font-semibold text-status-warn-ink">
                      <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                      {m.rating.toFixed(1)} ({m.rating_count})
                    </span>
                    <span>{m.sessions_done} sessions</span>
                    {m.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {m.location}
                      </span>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.expertise.slice(0, 4).map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-brand-tint px-2.5 py-0.5 text-2xs font-medium text-brand-ink"
                      >
                        {e}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 dark:border-white/10">
                    <button
                      onClick={() => openEdit(m)}
                      className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-subtle transition hover:bg-surface-hover"
                    >
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    {m.status === "active" && (
                      <button
                        onClick={() => retire(m.id)}
                        disabled={working}
                        className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-status-danger-ink transition hover:bg-status-danger-bg"
                      >
                        <UserMinus className="h-3.5 w-3.5" /> Retire
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
        title={editing ? "Edit mentor" : "Add a mentor"}
        description="The headline is what she has done, not a job title — that's what members actually read."
        icon={HeartHandshake}
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
              {editing ? "Save changes" : "Add mentor"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
          />
          <Input
            label="Headline"
            value={form.headline}
            onChange={(e) => set("headline")(e.target.value)}
            placeholder="Runs a 12-woman tailoring unit in Hyderabad"
          />
          <Textarea
            label="In her own words"
            value={form.bio}
            onChange={(e) => set("bio")(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Expertise (comma separated)"
              value={expertiseText}
              onChange={(e) => setExpertiseText(e.target.value)}
              placeholder="Tailoring, Pricing, Small business"
            />
            <Input
              label="Languages (comma separated)"
              value={languagesText}
              onChange={(e) => setLanguagesText(e.target.value)}
              placeholder="Telugu, Hindi, English"
            />
            <Input
              label="Years of experience"
              type="number"
              value={String(form.experience_years)}
              onChange={(e) => set("experience_years")(Number(e.target.value) || 0)}
            />
            <Input
              label="Based in"
              value={form.location}
              onChange={(e) => set("location")(e.target.value)}
            />
            <Input
              label="Usually free"
              value={form.availability}
              onChange={(e) => set("availability")(e.target.value)}
              placeholder="Weekday evenings"
            />
            <Select
              label="Status"
              value={form.status}
              onChange={(e) => set("status")(e.target.value)}
              options={["active", "retired"]}
            />
          </div>
        </div>
      </Modal>
    </AdminPage>
  );
}
