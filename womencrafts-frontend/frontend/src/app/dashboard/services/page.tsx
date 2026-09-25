"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Briefcase, LayoutGrid, Leaf, Clock, Power, Plus, MoreHorizontal, Scissors, Sparkles, Flower2,
  Camera, Monitor, HeartPulse, Tag, FileBarChart, Eye, Pencil, Trash2, Download, SlidersHorizontal,
  Search, CalendarCheck,
} from "lucide-react";

import {
  Badge, Card, Input, Menu, MenuItem, Modal, ProgressBar, Select, StatCard, Textarea, NoResults,
  SkeletonRows, useToast, useConfirm,
} from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import { TONE_BG } from "@/lib/tones";
import {
  apiListServices, apiListServiceTypes, apiServiceStats, apiServiceBookings, apiCreateService,
  apiUpdateService, apiSetServiceStatus, apiDeleteService, apiCreateServiceType, apiUpdateServiceType,
  apiDeleteServiceType, type ApiService, type ApiServiceType, type ServiceStats, type ServiceStatCard, type ServiceBooking,
} from "@/lib/services-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

/**
 * Services & Types — what the platform offers, run by the people who run it.
 *
 * ── What is real on this screen ──────────────────────────────────────────────
 * Every number comes from the API. A service's bookings are the appointments
 * that name it, counted live; a type's share is its slice of those bookings.
 * Nothing here shows a rating, because nothing on the platform rates a
 * service yet — the old "4.9 ★" beside every row was a seeded string.
 *
 * There is no date-range menu: appointments carry no timestamp, so "This
 * Month" could not have filtered anything. It comes back when there is a
 * date to filter on.
 *
 * ── What an admin can do ────────────────────────────────────────────────────
 * Add, edit, activate/deactivate and delete services; add, rename and delete
 * types (a rename carries its services along; a delete is refused while
 * services still use the type); open a service to see who actually booked
 * it; export the filtered list. Every write is checked against her
 * permissions on the server and recorded in the activity log.
 */

type Tone = "brand" | "violet" | "amber" | "emerald" | "rose" | "sky";

type Service = {
  _id: string;
  icon: React.ElementType;
  slot: number;
  name: string;
  type: string;
  tone: Tone;
  duration: string;
  price: string;
  status: string;
  bookings: number;
  description: string;
};

type ServiceType = {
  _id: string;
  icon: React.ElementType;
  name: string;
  desc: string;
  services: number;
  status: string;
  pop: number;
  slot: number;
};

// Icons are stored by NAME on the backend; map them back to lucide components.
const ICON_MAP: Record<string, React.ElementType> = {
  Scissors, Sparkles, Flower2, Camera, Monitor, HeartPulse, Briefcase, LayoutGrid, Leaf, Clock, Tag, Power,
};

function toService(s: ApiService): Service {
  return {
    _id: s.id,
    icon: ICON_MAP[s.icon] ?? Briefcase,
    name: s.name,
    type: s.type,
    tone: (s.tone as Tone) || "brand",
    slot: s.slot ?? 1,
    duration: s.duration,
    price: s.price,
    status: s.status,
    bookings: s.bookings,
    description: s.description,
  };
}

function toType(t: ApiServiceType): ServiceType {
  return {
    _id: t.id,
    icon: ICON_MAP[t.name] ?? ICON_MAP[t.icon] ?? LayoutGrid,
    name: t.name,
    desc: t.desc,
    services: t.services,
    status: t.status,
    pop: t.pop,
    slot: t.slot ?? 1,
  };
}

/** Labels for the five cards while the live values load. Presentation only. */
const CARD_SHELL = [
  { key: "total", label: "Total Services", icon: "Briefcase", tone: "brand" },
  { key: "active", label: "Active Services", icon: "LayoutGrid", tone: "violet" },
  { key: "inactive", label: "Inactive Services", icon: "Power", tone: "amber" },
  { key: "types", label: "Service Types", icon: "Leaf", tone: "emerald" },
  { key: "bookings", label: "Total Bookings", icon: "Clock", tone: "sky" },
];

const DURATIONS = ["30 min", "45 min", "60 min", "90 min", "120 min"];

type ServiceForm = { name: string; type: string; duration: string; price: string; status: string; description: string };
type TypeForm = { name: string; desc: string; status: string };

const EMPTY_SERVICE_FORM: ServiceForm = { name: "", type: "", duration: "60 min", price: "", status: "Active", description: "" };
const EMPTY_TYPE_FORM: TypeForm = { name: "", desc: "", status: "Active" };

const csvCell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export default function ServicesPage() {
  const toast = useToast();
  const confirm = useConfirm();

  // ---- data ----
  const [services, setServices] = useState<Service[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // ---- filters ----
  const [statusFilter, setStatusFilter] = useState<"All Services" | "Active" | "Inactive">("All Services");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeStat, setActiveStat] = useState<string | null>(null);

  // ---- modals ----
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeForm, setTypeForm] = useState<TypeForm>(EMPTY_TYPE_FORM);
  const [editTypeId, setEditTypeId] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [bookings, setBookings] = useState<{ items: ServiceBooking[]; total: number } | null>(null);

  const servicesRef = useRef<HTMLDivElement>(null);
  const typesRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const [svc, typ, s] = await Promise.all([
        apiListServices({ page_size: 100 }),
        apiListServiceTypes({ page_size: 100 }),
        apiServiceStats(),
      ]);
      setServices(svc.items.map(toService));
      setTypes(typ.items.map(toType));
      setStats(s);
      setLoadError("");
    } catch (err) {
      setLoadError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const detailService = useMemo(() => services.find((s) => s._id === detailId) ?? null, [services, detailId]);

  // The appointments behind the number, loaded when a service is opened.
  useEffect(() => {
    if (!detailId) { setBookings(null); return; }
    let live = true;
    apiServiceBookings(detailId)
      .then((b) => { if (live) setBookings(b); })
      .catch(() => { if (live) setBookings({ items: [], total: 0 }); });
    return () => { live = false; };
  }, [detailId]);

  const typeNames = useMemo(() => types.filter((t) => t.status === "Active").map((t) => t.name), [types]);
  const availableTypes = useMemo(() => Array.from(new Set(services.map((s) => s.type))), [services]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((s) => {
      const statusOk = statusFilter === "All Services" || s.status.toLowerCase() === statusFilter.toLowerCase();
      const typeOk = !typeFilter || s.type.toLowerCase() === typeFilter.toLowerCase();
      const qOk = !q || s.name.toLowerCase().includes(q) || s.type.toLowerCase().includes(q);
      return statusOk && typeOk && qOk;
    });
  }, [services, statusFilter, typeFilter, query]);

  // ---- services ----
  const openAddService = () => {
    setEditServiceId(null);
    setServiceForm({ ...EMPTY_SERVICE_FORM, type: typeNames[0] ?? "" });
    setServiceModalOpen(true);
  };

  const openEditService = (s: Service) => {
    setEditServiceId(s._id);
    setServiceForm({ name: s.name, type: s.type, duration: s.duration, price: s.price, status: s.status, description: s.description });
    setServiceModalOpen(true);
  };

  const submitService = async () => {
    if (!serviceForm.name.trim() || !serviceForm.type) return;
    setSaving(true);
    const body = { ...serviceForm, name: serviceForm.name.trim() };
    try {
      if (editServiceId) {
        await apiUpdateService(editServiceId, body);
        toast.success(`${body.name} updated`);
      } else {
        await apiCreateService(body);
        toast.success(`${body.name} added`, { description: `Listed under ${body.type}.` });
      }
      setServiceModalOpen(false);
      await refresh();
    } catch (err) {
      toast.error("Could not save the service", { description: memberError(err) });
    } finally {
      setSaving(false);
    }
  };

  const toggleServiceStatus = async (s: Service) => {
    try {
      const next = await apiSetServiceStatus(s._id);
      toast.success(`${s.name} is now ${next.status.toLowerCase()}`);
      await refresh();
    } catch (err) {
      toast.error("Could not change the service status", { description: memberError(err) });
    }
  };

  const deleteService = async (s: Service) => {
    const ok = await confirm({
      title: `Delete ${s.name}?`,
      description: s.bookings > 0
        ? `It has ${s.bookings} booking${s.bookings === 1 ? "" : "s"} on record. Those appointments keep their history; nobody will be able to book it again.`
        : "Nobody will be able to book it. This cannot be undone.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteService(s._id);
      if (detailId === s._id) setDetailId(null);
      toast.success(`${s.name} deleted`);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the service", { description: memberError(err) });
    }
  };

  // ---- types ----
  const openAddType = () => {
    setEditTypeId(null);
    setTypeForm(EMPTY_TYPE_FORM);
    setTypeModalOpen(true);
  };

  const openEditType = (t: ServiceType) => {
    setEditTypeId(t._id);
    setTypeForm({ name: t.name, desc: t.desc, status: t.status });
    setTypeModalOpen(true);
  };

  const submitType = async () => {
    if (!typeForm.name.trim()) return;
    setSaving(true);
    const body = { ...typeForm, name: typeForm.name.trim() };
    try {
      if (editTypeId) {
        await apiUpdateServiceType(editTypeId, body);
        toast.success(`${body.name} updated`);
      } else {
        await apiCreateServiceType(body);
        toast.success(`${body.name} added`);
      }
      setTypeModalOpen(false);
      await refresh();
    } catch (err) {
      toast.error("Could not save the service type", { description: memberError(err) });
    } finally {
      setSaving(false);
    }
  };

  const deleteType = async (t: ServiceType) => {
    if (t.services > 0) {
      toast.error(`${t.name} is still in use`, {
        description: `${t.services} service${t.services === 1 ? "" : "s"} sit under it. Move or delete them first.`,
      });
      return;
    }
    const ok = await confirm({
      title: `Delete the ${t.name} type?`,
      description: "No services use it, so nothing else changes.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await apiDeleteServiceType(t._id);
      toast.success(`${t.name} deleted`);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the service type", { description: memberError(err) });
    }
  };

  // ---- export ----
  const exportCsv = () => {
    if (filteredServices.length === 0) {
      toast.error("Nothing to export", { description: "No services match the current filters." });
      return;
    }
    const lines = [
      ["Service", "Type", "Duration", "Price", "Status", "Bookings", "Description"].join(","),
      ...filteredServices.map((s) =>
        [s.name, s.type, s.duration, s.price, s.status, s.bookings, s.description].map(csvCell).join(","),
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "services.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredServices.length} service${filteredServices.length === 1 ? "" : "s"}`);
  };

  // ---- stat card clicks ----
  const onStatClick = (key: string) => {
    setActiveStat(key);
    if (key === "total") { setStatusFilter("All Services"); setTypeFilter(null); }
    else if (key === "active") setStatusFilter("Active");
    else if (key === "inactive") setStatusFilter("Inactive");
    else if (key === "types") typesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (key === "bookings") servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openPopular = (name: string) => {
    const match = services.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (match) setDetailId(match._id);
    else servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const seg = (v: "All Services" | "Active" | "Inactive") =>
    statusFilter === v
      ? "rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white"
      : "px-3 py-1.5 text-ink-subtle transition hover:text-ink-muted";

  const cards: ServiceStatCard[] = stats?.stats ?? CARD_SHELL.map((c) => ({ ...c, value: "…" }));
  const overview = stats?.overview ?? [];
  const popular = stats?.popular ?? [];
  const cell = "whitespace-nowrap px-2 py-3";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Services &amp; Types</h1>
            <p className="mt-1 text-sm text-ink-subtle">Everything members can book, and the categories it sits in.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-sm btn-outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button className="btn btn-sm btn-primary" onClick={openAddService}>
            <Plus className="h-4 w-4" /> Add New Service
          </button>
        </div>
      </div>

      {loadError && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-status-danger-edge bg-status-danger-bg px-4 py-3 text-sm text-status-danger-ink">
          <span>Could not load services: {loadError}</span>
          <button className="btn btn-sm btn-outline" onClick={() => { setLoading(true); void refresh(); }}>Try again</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => onStatClick(c.key)}
            className={`w-full text-left transition-transform duration-200 hover:-translate-y-1 ${activeStat === c.key ? "-translate-y-1" : ""}`}
          >
            <StatCard label={c.label} value={c.value} icon={ICON_MAP[c.icon] ?? Briefcase} tone={c.tone as Tone} delta={c.delta} />
          </button>
        ))}
      </div>

      <ResizableColumns id="services" defaultSize={0.74} className="mt-6 gap-6">
        <div className="space-y-6">
          {/* all services */}
          <div ref={servicesRef}>
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-base font-semibold text-ink">All Services</h2>
                <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-subtle" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search services"
                      aria-label="Search services"
                      className="h-8 w-44 rounded-lg border border-line-strong bg-surface pl-8 pr-2 text-xs text-ink placeholder:text-ink-subtle focus:outline-none focus:ring-2 focus:ring-brand-300"
                    />
                  </div>
                  <div className="flex rounded-lg border border-line-strong p-0.5 text-xs">
                    <button className={seg("All Services")} onClick={() => setStatusFilter("All Services")}>All</button>
                    <button className={seg("Active")} onClick={() => setStatusFilter("Active")}>Active</button>
                    <button className={seg("Inactive")} onClick={() => setStatusFilter("Inactive")}>Inactive</button>
                  </div>
                  <Menu
                    align="right"
                    trigger={
                      <button className="btn btn-sm btn-outline">
                        <SlidersHorizontal className="h-3.5 w-3.5" /> {typeFilter ?? "All Types"}
                      </button>
                    }
                  >
                    <MenuItem icon={SlidersHorizontal} onClick={() => setTypeFilter(null)}>All Types</MenuItem>
                    {availableTypes.map((t) => (
                      <MenuItem key={t} icon={Tag} onClick={() => setTypeFilter(t)}>{t}</MenuItem>
                    ))}
                  </Menu>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className={cell}>Service Name</th>
                      <th scope="col" className={cell}>Type</th>
                      <th scope="col" className={cell}>Duration</th>
                      <th scope="col" className={cell}>Price</th>
                      <th scope="col" className={cell}>Status</th>
                      <th scope="col" className={cell}>Bookings</th>
                      <th scope="col" className={cell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {filteredServices.map((s) => (
                      <tr key={s._id} className="cursor-pointer text-sm hover:bg-surface-hover/60" onClick={() => setDetailId(s._id)}>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-9 w-9 items-center justify-center rounded-lg"
                              style={{ background: `var(--cat-${s.slot}-soft)`, color: `var(--cat-${s.slot}-ink)` }}
                            >
                              <s.icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="font-semibold text-ink">{s.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3">
                          <span
                            className="inline-block rounded-full px-2.5 py-1 text-2xs font-semibold"
                            style={{ background: `var(--cat-${s.slot}-soft)`, color: `var(--cat-${s.slot}-ink)` }}
                          >
                            {s.type}
                          </span>
                        </td>
                        <td className={`${cell} text-ink-subtle`}>{s.duration}</td>
                        <td className={`${cell} font-semibold text-ink-muted`}>{s.price}</td>
                        <td className="px-2 py-3"><Badge tone={s.status === "Active" ? "emerald" : "rose"}>{s.status}</Badge></td>
                        <td className="px-2 py-3 tabular-nums text-ink-muted">
                          {s.bookings > 0 ? s.bookings : <span className="text-ink-subtle">None yet</span>}
                        </td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <Menu
                            align="right"
                            trigger={
                              <button aria-label={`More actions for ${s.name}`} className="text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></button>
                            }
                          >
                            <MenuItem icon={Eye} onClick={() => setDetailId(s._id)}>View details</MenuItem>
                            <MenuItem icon={Pencil} onClick={() => openEditService(s)}>Edit</MenuItem>
                            <MenuItem icon={Power} onClick={() => void toggleServiceStatus(s)}>
                              {s.status === "Active" ? "Deactivate" : "Activate"}
                            </MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => void deleteService(s)}>Delete</MenuItem>
                          </Menu>
                        </td>
                      </tr>
                    ))}
                    {loading && services.length === 0 && <SkeletonRows rows={6} cols={7} />}
                    {!loading && filteredServices.length === 0 && (
                      <tr className="text-sm">
                        <td colSpan={7} className="px-2 py-2">
                          <NoResults icon={Briefcase} thing="services" filtered={services.length > 0} compact />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
                <p className="text-ink-subtle">Showing {filteredServices.length} of {services.length} services</p>
              </div>
            </Card>
          </div>

          {/* types */}
          <div ref={typesRef}>
            <Card>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink">Service Types / Categories</h2>
                  <p className="text-xs text-ink-subtle">Rename a type and its services move with it. A type in use cannot be deleted.</p>
                </div>
                <button className="btn btn-primary" onClick={openAddType}>
                  <Plus className="h-4 w-4" /> Add New Type
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                      <th scope="col" className={cell}>Type Name</th>
                      <th scope="col" className={cell}>Description</th>
                      <th scope="col" className={cell}>Services</th>
                      <th scope="col" className={cell}>Status</th>
                      <th scope="col" className={cell}>Share of bookings</th>
                      <th scope="col" className={cell}>Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {types.map((t) => (
                      <tr key={t._id} className="cursor-pointer text-sm hover:bg-surface-hover/60" onClick={() => openEditType(t)}>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `var(--cat-${t.slot}-soft)`, color: `var(--cat-${t.slot}-ink)` }}>
                              <t.icon className="h-4.5 w-4.5" />
                            </span>
                            <span className="font-semibold text-ink">{t.name}</span>
                          </div>
                        </td>
                        <td className="max-w-[220px] px-2 py-3 text-xs text-ink-subtle">{t.desc || <span className="italic">No description</span>}</td>
                        <td className="px-2 py-3 tabular-nums font-medium text-ink-muted">{t.services}</td>
                        <td className="px-2 py-3"><Badge tone={t.status === "Active" ? "emerald" : "rose"}>{t.status}</Badge></td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-2">
                            <ProgressBar value={t.pop} color={`var(--cat-${t.slot})`} className="w-24" />
                            <span className="text-xs tabular-nums text-ink-subtle">{t.pop}%</span>
                          </div>
                        </td>
                        <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                          <Menu
                            align="right"
                            trigger={
                              <button aria-label={`More actions for ${t.name}`} className="text-ink-subtle hover:text-ink-muted"><MoreHorizontal className="h-4 w-4" /></button>
                            }
                          >
                            <MenuItem icon={Pencil} onClick={() => openEditType(t)}>Edit</MenuItem>
                            <MenuItem icon={Tag} onClick={() => { setTypeFilter(t.name); servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
                              Show its services
                            </MenuItem>
                            <MenuItem icon={Trash2} danger onClick={() => void deleteType(t)}>Delete</MenuItem>
                          </Menu>
                        </td>
                      </tr>
                    ))}
                    {loading && types.length === 0 && <SkeletonRows rows={4} cols={6} />}
                    {!loading && types.length === 0 && (
                      <tr className="text-sm">
                        <td colSpan={6} className="px-2 py-2">
                          <NoResults icon={LayoutGrid} thing="service types" compact />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-sm">
                <p className="text-ink-subtle">Showing {types.length} {types.length === 1 ? "type" : "types"}</p>
              </div>
            </Card>
          </div>
        </div>

        {/* side */}
        <div className="space-y-6">
          <Card>
            <div className="mb-2">
              <h2 className="font-display text-base font-semibold text-ink">Bookings by Type</h2>
              <p className="text-xs text-ink-subtle">Every appointment, by the type of service it booked.</p>
            </div>
            {overview.length > 0 ? (
              <>
                <div className="flex flex-col items-center">
                  <DonutChart data={overview} centerValue={stats?.overview_total ?? "0"} centerLabel={stats?.overview_label ?? "Total Bookings"} size={150} />
                </div>
                <ul className="mt-4 space-y-2">
                  {overview.map((o) => (
                    <li key={o.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-muted">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} /> {o.name}
                      </span>
                      <span className="font-medium tabular-nums text-ink-subtle">{o.value}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-subtle">
                  <CalendarCheck className="h-5 w-5" />
                </span>
                <p className="text-sm font-medium text-ink">{stats ? "No bookings yet" : "Loading…"}</p>
                {stats && <p className="text-xs text-ink-subtle">The chart fills as appointments name a service.</p>}
              </div>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Most Booked</h2>
              <button
                className="text-xs font-semibold text-brand-ink transition hover:underline"
                onClick={() => servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                View All
              </button>
            </div>
            {popular.length > 0 ? (
              <ul className="space-y-2">
                {popular.map((p) => {
                  const Icon = ICON_MAP[p.icon] ?? Briefcase;
                  return (
                    <li key={p.name}>
                      <button
                        type="button"
                        onClick={() => openPopular(p.name)}
                        className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-hover"
                      >
                        <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[p.tone] ?? TONE_BG.brand}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-ink">{p.name}</p>
                          <p className="text-xs text-ink-subtle">{p.bookings}</p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="py-3 text-center text-xs text-ink-subtle">
                {stats ? "Nothing has been booked yet." : "Loading…"}
              </p>
            )}
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: Briefcase, label: "Add New Service", tone: "brand", onClick: openAddService },
                { icon: LayoutGrid, label: "Add New Type", tone: "violet", onClick: openAddType },
                { icon: Download, label: "Export CSV", tone: "amber", onClick: exportCsv },
              ].map((q) => (
                <button
                  key={q.label}
                  onClick={q.onClick}
                  className="flex flex-col items-center gap-2 rounded-xl border border-line py-4 text-xs font-medium text-ink-muted hover:bg-surface-hover"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[q.tone]}`}><q.icon className="h-4.5 w-4.5" /></span>
                  {q.label}
                </button>
              ))}
              <Link
                href="/dashboard/reports"
                className="flex flex-col items-center gap-2 rounded-xl border border-line py-4 text-xs font-medium text-ink-muted hover:bg-surface-hover"
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG.emerald}`}><FileBarChart className="h-4.5 w-4.5" /></span>
                Service Reports
              </Link>
            </div>
          </Card>
        </div>
      </ResizableColumns>

      {/* Add / Edit Service */}
      <Modal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        title={editServiceId ? "Edit Service" : "Add New Service"}
        description={editServiceId ? "Update the details of this service." : "Create a new service members can book."}
        icon={Briefcase}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setServiceModalOpen(false)}>Cancel</button>
            <button
              className="btn btn-primary"
              disabled={saving || !serviceForm.name.trim() || !serviceForm.type}
              onClick={() => void submitService()}
            >
              {saving ? "Saving…" : editServiceId ? "Save Changes" : "Add Service"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Service Name"
            required
            placeholder="e.g. Tailoring & Stitching"
            value={serviceForm.name}
            onChange={(e) => setServiceForm((f) => ({ ...f, name: e.target.value }))}
            className="col-span-2"
          />
          {typeNames.length > 0 || serviceForm.type ? (
            <Select
              label="Type"
              options={Array.from(new Set([...typeNames, serviceForm.type].filter(Boolean)))}
              value={serviceForm.type}
              onChange={(e) => setServiceForm((f) => ({ ...f, type: e.target.value }))}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-xs text-ink-subtle">
              No active service types yet. <button type="button" className="font-semibold text-brand-ink" onClick={() => { setServiceModalOpen(false); openAddType(); }}>Add one first</button>.
            </div>
          )}
          <Select
            label="Duration"
            options={DURATIONS}
            value={serviceForm.duration}
            onChange={(e) => setServiceForm((f) => ({ ...f, duration: e.target.value }))}
          />
          <Input
            label="Price"
            placeholder="e.g. ₹499"
            value={serviceForm.price}
            onChange={(e) => setServiceForm((f) => ({ ...f, price: e.target.value }))}
          />
          <Select
            label="Status"
            options={["Active", "Inactive"]}
            value={serviceForm.status}
            onChange={(e) => setServiceForm((f) => ({ ...f, status: e.target.value }))}
          />
          <Textarea
            label="Description"
            placeholder="What she gets, and what to bring."
            value={serviceForm.description}
            onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
            className="col-span-2"
          />
        </div>
      </Modal>

      {/* Add / Edit Type */}
      <Modal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        title={editTypeId ? "Edit Type" : "Add New Type"}
        description={editTypeId ? "Renaming moves every service under it to the new name." : "Create a new category for services."}
        icon={LayoutGrid}
        iconTone="violet"
        size="md"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setTypeModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" disabled={saving || !typeForm.name.trim()} onClick={() => void submitType()}>
              {saving ? "Saving…" : editTypeId ? "Save Changes" : "Add Type"}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Type Name"
            required
            placeholder="e.g. Fashion"
            value={typeForm.name}
            onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
            className="col-span-2"
          />
          <Textarea
            label="Description"
            placeholder="What kinds of services belong here."
            value={typeForm.desc}
            onChange={(e) => setTypeForm((f) => ({ ...f, desc: e.target.value }))}
            className="col-span-2"
          />
          <Select
            label="Status"
            options={["Active", "Inactive"]}
            value={typeForm.status}
            onChange={(e) => setTypeForm((f) => ({ ...f, status: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Service detail */}
      <Modal
        open={!!detailService}
        onClose={() => setDetailId(null)}
        title={detailService?.name ?? "Service"}
        description={detailService ? `${detailService.type} · ${detailService.duration} · ${detailService.price}` : undefined}
        icon={detailService?.icon ?? Briefcase}
        iconTone={detailService?.tone ?? "brand"}
        size="lg"
        footer={
          detailService && (
            <>
              <button className="btn btn-outline text-status-danger-ink" onClick={() => void deleteService(detailService)}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
              <button className="btn btn-outline" onClick={() => void toggleServiceStatus(detailService)}>
                <Power className="h-4 w-4" /> {detailService.status === "Active" ? "Deactivate" : "Activate"}
              </button>
              <button className="btn btn-primary" onClick={() => { setDetailId(null); openEditService(detailService); }}>
                <Pencil className="h-4 w-4" /> Edit
              </button>
            </>
          )
        }
      >
        {detailService && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Type</p>
                <Badge tone={detailService.tone}>{detailService.type}</Badge>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Status</p>
                <Badge tone={detailService.status === "Active" ? "emerald" : "rose"}>{detailService.status}</Badge>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Duration</p>
                <p className="font-medium text-ink-muted">{detailService.duration}</p>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Price</p>
                <p className="font-semibold text-ink-muted">{detailService.price}</p>
              </div>
            </div>
            {detailService.description ? (
              <p className="leading-relaxed text-ink-muted">{detailService.description}</p>
            ) : (
              <p className="text-xs italic text-ink-subtle">No description yet — members see only the name.</p>
            )}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Bookings</p>
                {bookings && bookings.total > 0 && (
                  <span className="text-xs tabular-nums text-ink-subtle">
                    {bookings.total} total{bookings.total > bookings.items.length ? `, latest ${bookings.items.length}` : ""}
                  </span>
                )}
              </div>
              {bookings === null ? (
                <p className="text-xs text-ink-subtle">Loading…</p>
              ) : bookings.items.length === 0 ? (
                <p className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs text-ink-subtle">
                  Nobody has booked this service yet.
                </p>
              ) : (
                <ul className="divide-y divide-line rounded-lg border border-line">
                  {bookings.items.map((b) => (
                    <li key={b.id} className="flex items-center justify-between gap-3 px-3 py-2">
                      <span className="truncate font-medium text-ink">{b.name || "Member"}</span>
                      <span className="shrink-0 text-xs text-ink-subtle">{[b.date, b.time].filter(Boolean).join(" · ")}</span>
                      <Badge tone={b.status === "Completed" ? "emerald" : b.status === "Cancelled" ? "rose" : "sky"}>{b.status || "Booked"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
