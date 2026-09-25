"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Briefcase, LayoutGrid, Leaf, Clock, Star, Calendar, ChevronDown, SlidersHorizontal, Plus, MoreHorizontal, Scissors, Sparkles, Flower2, Camera, Monitor, HeartPulse, Tag, FileBarChart, Eye, Pencil, Power, Trash2 } from "lucide-react";
import { Badge, Card, Input, Menu, MenuItem, Modal, ProgressBar, Select, StatCard, Textarea, NoResults, SkeletonRows, useToast, useConfirm } from "@/design-system";
import DonutChart from "@/components/charts/DonutChart";
import Link from "next/link";
import { TONE_BG } from "@/lib/tones";
import { apiListServices, apiListServiceTypes, apiServiceStats, apiCreateService, apiUpdateService, apiSetServiceStatus, apiDeleteService, apiCreateServiceType, apiUpdateServiceType, apiDeleteServiceType, type ApiService, type ApiServiceType, type ServiceStats, type ServiceStatCard, type ServiceOverviewSlice, type ServicePopularItem } from "@/lib/services-api";
import { memberError } from "@/lib/member-api";
import { ResizableColumns } from "@/layout-engine";

type Tone = "brand" | "violet" | "amber" | "emerald" | "rose" | "sky";

type Service = {
  _id: string; // mongo id — used for update/status/delete calls
  icon: React.ElementType;
  slot: number;
  name: string;
  type: string;
  tone: Tone;
  duration: string;
  price: string;
  status: string;
  bookings: number;
  rating: string;
  description: string;
};

type ServiceType = {
  _id: string; // mongo id — used for update/delete calls
  icon: React.ElementType;
  name: string;
  desc: string;
  services: number;
  status: string;
  pop: number;
  color: string;
  slot: number;
};

// Icons are stored by NAME on the backend; map them back to lucide components.
const ICON_MAP: Record<string, React.ElementType> = {
  Scissors,
  Sparkles,
  Flower2,
  Camera,
  Monitor,
  HeartPulse,
  Briefcase,
  LayoutGrid,
  Leaf,
  Clock,
  Star,
  Tag,
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
    rating: s.rating,
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
    color: t.color,
    slot: t.slot ?? 1,
  };
}

// Fallbacks keep the first paint identical while the live /services/stats loads.
const FALLBACK_STATS: ServiceStatCard[] = [
  { key: "total", label: "Total Services", value: "156", icon: "Briefcase", tone: "brand", delta: "12.5%" },
  { key: "active", label: "Active Services", value: "132", icon: "LayoutGrid", tone: "violet", delta: "9.8%" },
  { key: "types", label: "Service Types", value: "12", icon: "Leaf", tone: "emerald", delta: "8.3%" },
  { key: "bookings", label: "Total Bookings", value: "3,842", icon: "Clock", tone: "amber", delta: "14.6%" },
  { key: "rating", label: "Avg. Rating", value: "4.8 / 5", icon: "Star", tone: "brand", delta: "0.3" },
];

const FALLBACK_OVERVIEW: ServiceOverviewSlice[] = [
  { name: "Fashion", value: 28, color: "var(--color-brand-600)" },
  { name: "Beauty", value: 26, color: "var(--color-violet-500)" },
  { name: "Photography", value: 18, color: "var(--status-warn-solid)" },
  { name: "Digital", value: 16, color: "var(--status-info-solid)" },
  { name: "Wellness", value: 12, color: "var(--status-ok-solid)" },
];

const FALLBACK_POPULAR: ServicePopularItem[] = [
  { icon: "Scissors", name: "Tailoring & Stitching", bookings: "842 bookings", tone: "brand" },
  { icon: "Sparkles", name: "Beauty & Makeup", bookings: "721 bookings", tone: "violet" },
  { icon: "Flower2", name: "Mehndi Design", bookings: "612 bookings", tone: "rose" },
  { icon: "Camera", name: "Photography", bookings: "487 bookings", tone: "amber" },
  { icon: "HeartPulse", name: "Yoga & Wellness", bookings: "356 bookings", tone: "emerald" },
];

const QUICK = [
  { icon: Briefcase, label: "Add New Service", tone: "brand" },
  { icon: LayoutGrid, label: "Add New Type", tone: "violet" },
  { icon: Tag, label: "Manage Pricing", tone: "amber" },
  { icon: FileBarChart, label: "Service Reports", tone: "emerald" },
];

type ServiceForm = {
  name: string;
  type: string;
  duration: string;
  price: string;
  status: string;
  description: string;
};

type TypeForm = {
  name: string;
  desc: string;
  status: string;
  pop: string;
};

const EMPTY_SERVICE_FORM: ServiceForm = {
  name: "",
  type: "Fashion",
  duration: "60 min",
  price: "",
  status: "Active",
  description: "",
};

const EMPTY_TYPE_FORM: TypeForm = {
  name: "",
  desc: "",
  status: "Active",
  pop: "",
};

export default function ServicesPage() {
  const toast = useToast();
  const confirm = useConfirm();
  // ---- data state ----
  const [services, setServices] = useState<Service[]>([]);
  const [types, setTypes] = useState<ServiceType[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [loading, setLoading] = useState(true);

  // ---- filters / views ----
  const [statusFilter, setStatusFilter] = useState<"All Services" | "Active" | "Inactive">("All Services");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [activeStat, setActiveStat] = useState<string | null>(null);

  // ---- header / rail labels ----
  const [dateRange, setDateRange] = useState("May 20 - May 26, 2024");
  const [overviewRange, setOverviewRange] = useState("This Month");

  // ---- pagination ----
  const [typePage, setTypePage] = useState("1");

  // ---- modals ----
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState<ServiceForm>(EMPTY_SERVICE_FORM);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [typeForm, setTypeForm] = useState<TypeForm>(EMPTY_TYPE_FORM);
  const [editTypeId, setEditTypeId] = useState<string | null>(null);

  const [detailId, setDetailId] = useState<string | null>(null);

  // ---- scroll targets ----
  const servicesRef = useRef<HTMLDivElement>(null);
  const typesRef = useRef<HTMLDivElement>(null);

  // Load services + types + stats from the backend (client-side filtering stays).
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
    } catch {
      /* keep current data; a toast could surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const detailService = useMemo(
    () => services.find((s) => s._id === detailId) ?? null,
    [services, detailId],
  );

  // Live stat cards, overview donut & popular list (with a matching fallback).
  const statCards = stats?.stats ?? FALLBACK_STATS;
  const overview = stats?.overview ?? FALLBACK_OVERVIEW;
  const overviewTotal = stats?.overview_total ?? "3,842";
  const overviewLabel = stats?.overview_label ?? "Total Bookings";
  const popular = stats?.popular ?? FALLBACK_POPULAR;

  const availableTypes = useMemo(() => Array.from(new Set(services.map((s) => s.type))), [services]);

  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      const statusOk = statusFilter === "All Services" || s.status.toLowerCase() === statusFilter.toLowerCase();
      const typeOk = !typeFilter || s.type.toLowerCase() === typeFilter.toLowerCase();
      return statusOk && typeOk;
    });
  }, [services, statusFilter, typeFilter]);

  // ---- service modal helpers ----
  const openAddService = () => {
    setEditServiceId(null);
    setServiceForm(EMPTY_SERVICE_FORM);
    setServiceModalOpen(true);
  };

  const openEditService = (s: Service) => {
    setEditServiceId(s._id);
    setServiceForm({
      name: s.name,
      type: s.type,
      duration: s.duration,
      price: s.price,
      status: s.status,
      description: s.description,
    });
    setServiceModalOpen(true);
  };

  const submitService = async () => {
    if (!serviceForm.name.trim()) return;
    const body = {
      name: serviceForm.name.trim(),
      type: serviceForm.type,
      duration: serviceForm.duration,
      price: serviceForm.price,
      status: serviceForm.status,
      description: serviceForm.description,
    };
    try {
      if (editServiceId) {
        await apiUpdateService(editServiceId, body);
      } else {
        await apiCreateService(body);
      }
      await refresh();
      setServiceModalOpen(false);
    } catch (err) {
      toast.error("Could not save the service", { description: memberError(err) });
    }
  };

  const toggleServiceStatus = async (id: string) => {
    try {
      await apiSetServiceStatus(id);
      await refresh();
    } catch (err) {
      toast.error("Could not change the service status", { description: memberError(err) });
    }
  };

  const deleteService = async (id: string) => {
    try {
      await apiDeleteService(id);
      if (detailId === id) setDetailId(null);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the service", { description: memberError(err) });
    }
  };

  // ---- type modal helpers ----
  const openAddType = () => {
    setEditTypeId(null);
    setTypeForm(EMPTY_TYPE_FORM);
    setTypeModalOpen(true);
  };

  const openEditType = (t: ServiceType) => {
    setEditTypeId(t._id);
    setTypeForm({ name: t.name, desc: t.desc, status: t.status, pop: String(t.pop) });
    setTypeModalOpen(true);
  };

  const submitType = async () => {
    if (!typeForm.name.trim()) return;
    const popNum = Math.max(0, Math.min(100, Number(typeForm.pop) || 0));
    const body = {
      name: typeForm.name.trim(),
      desc: typeForm.desc,
      status: typeForm.status,
      pop: popNum,
    };
    try {
      if (editTypeId) {
        await apiUpdateServiceType(editTypeId, body);
      } else {
        await apiCreateServiceType(body);
      }
      await refresh();
      setTypeModalOpen(false);
    } catch (err) {
      toast.error("Could not save the service type", { description: memberError(err) });
    }
  };

  const deleteType = async (id: string) => {
    if (!(await confirm({
      title: "Delete this service type?",
      description: "Services using it will need a new type.",
      confirmLabel: "Delete",
      danger: true,
    }))) return;
    try {
      await apiDeleteServiceType(id);
      await refresh();
    } catch (err) {
      toast.error("Could not delete the service type", { description: memberError(err) });
    }
  };

  // ---- stat card clicks ----
  const onStatClick = (key: string) => {
    setActiveStat(key);
    if (key === "total") {
      setStatusFilter("All Services");
      setTypeFilter(null);
    } else if (key === "active") {
      setStatusFilter("Active");
    } else if (key === "types") {
      typesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // ---- popular row -> detail if it exists ----
  const openPopular = (name: string) => {
    const match = services.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (match) setDetailId(match._id);
    else servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onQuickAction = (label: string) => {
    if (label === "Add New Service" || label === "Manage Pricing") openAddService();
    else if (label === "Add New Type") openAddType();
  };

  const seg = (v: "All Services" | "Active" | "Inactive") =>
    statusFilter === v
      ? "rounded-md bg-brand-600 px-3 py-1.5 font-semibold text-white"
      : "px-3 py-1.5 text-ink-subtle transition hover:text-ink-muted";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <Briefcase className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Services &amp; Types</h1>
            <p className="mt-1 text-sm text-ink-subtle">Manage all services offered on the platform and their categories.</p>
          </div>
        </div>
        <Menu
          align="right"
          trigger={
            <button className="btn btn-sm btn-outline">
              <Calendar className="h-4 w-4 text-ink-subtle" /> {dateRange}
              <ChevronDown className="h-4 w-4 text-ink-subtle" />
            </button>
          }
        >
          <MenuItem icon={Calendar} onClick={() => setDateRange("Today")}>Today</MenuItem>
          <MenuItem icon={Calendar} onClick={() => setDateRange("This Week")}>This Week</MenuItem>
          <MenuItem icon={Calendar} onClick={() => setDateRange("This Month")}>This Month</MenuItem>
          <MenuItem icon={Calendar} onClick={() => setDateRange("This Year")}>This Year</MenuItem>
        </Menu>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {statCards.map((c) => (
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
                <div className="flex rounded-lg border border-line-strong p-0.5 text-xs">
                  <button className={seg("All Services")} onClick={() => setStatusFilter("All Services")}>All Services</button>
                  <button className={seg("Active")} onClick={() => setStatusFilter("Active")}>Active</button>
                  <button className={seg("Inactive")} onClick={() => setStatusFilter("Inactive")}>Inactive</button>
                </div>
                <Menu
                  align="right"
                  trigger={
                    <button className="btn btn-sm btn-outline">
                      <SlidersHorizontal className="h-3.5 w-3.5" /> Filters
                    </button>
                  }
                >
                  <MenuItem icon={SlidersHorizontal} onClick={() => setTypeFilter(null)}>All Types</MenuItem>
                  {availableTypes.map((t) => (
                    <MenuItem key={t} icon={Tag} onClick={() => setTypeFilter(t)}>{t}</MenuItem>
                  ))}
                </Menu>
                <button className="btn btn-primary" onClick={openAddService}>
                  <Plus className="h-4 w-4" /> Add New Service
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Service Name</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Type</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Duration</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Price</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Bookings</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Rating</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredServices.map((s) => (
                    <tr key={s.name} className="cursor-pointer text-sm hover:bg-surface-hover/60" onClick={() => setDetailId(s._id)}>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <span
                          className="flex h-9 w-9 items-center justify-center rounded-lg"
                          style={{
                            background: `var(--cat-${s.slot}-soft)`,
                            color: `var(--cat-${s.slot}-ink)`,
                          }}
                        >
                            <s.icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="font-semibold text-ink">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className="inline-block rounded-full px-2.5 py-1 text-2xs font-semibold"
                          style={{
                            background: `var(--cat-${s.slot}-soft)`,
                            color: `var(--cat-${s.slot}-ink)`,
                          }}
                        >
                          {s.type}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{s.duration}</td>
                      <td className="whitespace-nowrap px-2 py-3 font-semibold text-ink-muted">{s.price}</td>
                      <td className="px-2 py-3"><Badge tone={s.status === "Active" ? "emerald" : "rose"}>{s.status}</Badge></td>
                      <td className="px-2 py-3 text-ink-muted">{s.bookings}</td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-1 font-medium text-ink-muted">
                          {s.rating} <Star className="h-3.5 w-3.5 fill-rating text-rating" />
                        </span>
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
                          <MenuItem icon={Power} onClick={() => toggleServiceStatus(s._id)}>
                            {s.status === "Active" ? "Deactivate" : "Activate"}
                          </MenuItem>
                          <MenuItem icon={Trash2} danger onClick={() => deleteService(s._id)}>Delete</MenuItem>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                  {loading && services.length === 0 && (
                    <SkeletonRows rows={6} cols={8} />
                  )}
                  {!loading && filteredServices.length === 0 && (
                    <tr className="text-sm">
                      <td colSpan={8} className="px-2 py-2">
                        <NoResults icon={Briefcase} thing="services" filtered compact />
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
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">Service Types / Categories</h2>
                <p className="text-xs text-ink-subtle">Organize services into categories for better management.</p>
              </div>
              <button className="btn btn-primary" onClick={openAddType}>
                <Plus className="h-4 w-4" /> Add New Type
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left">
                <thead>
                  <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Type Name</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Description</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Services</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Status</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Popularity</th>
                    <th scope="col" className="whitespace-nowrap px-2 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {types.map((t) => (
                    <tr key={t.name} className="cursor-pointer text-sm hover:bg-surface-hover/60" onClick={() => openEditType(t)}>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `var(--cat-${t.slot}-soft)`, color: `var(--cat-${t.slot}-ink)` }}>
                            <t.icon className="h-4.5 w-4.5" />
                          </span>
                          <span className="font-semibold text-ink">{t.name}</span>
                        </div>
                      </td>
                      <td className="max-w-[220px] px-2 py-3 text-xs text-ink-subtle">{t.desc}</td>
                      <td className="px-2 py-3 font-medium text-ink-muted">{t.services}</td>
                      <td className="px-2 py-3"><Badge tone={t.status === "Active" ? "emerald" : "rose"}>{t.status}</Badge></td>
                      <td className="px-2 py-3">
                        <div className="flex items-center gap-2">
                          <ProgressBar value={t.pop} color={`var(--cat-${t.slot})`} className="w-24" />
                          <span className="text-xs text-ink-subtle">{t.pop}%</span>
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
                          <MenuItem icon={Trash2} danger onClick={() => deleteType(t._id)}>Delete</MenuItem>
                        </Menu>
                      </td>
                    </tr>
                  ))}
                  {loading && types.length === 0 && (
                    <SkeletonRows rows={6} cols={6} />
                  )}
                  {!loading && types.length === 0 && (
                    <tr className="text-sm">
                      <td colSpan={6} className="px-2 py-2">
                        <NoResults icon={Briefcase} thing="service types" compact />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
              <p className="text-ink-subtle">Showing {types.length} {types.length === 1 ? "type" : "types"}</p>
              
            </div>
          </Card>
          </div>
        </div>

        {/* side */}
        <div className="space-y-6">
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Service Overview</h2>
              <Menu
                align="right"
                trigger={
                  <button className="btn btn-sm btn-outline">{overviewRange} <ChevronDown className="h-3 w-3" /></button>
                }
              >
                <MenuItem icon={Calendar} onClick={() => setOverviewRange("This Week")}>This Week</MenuItem>
                <MenuItem icon={Calendar} onClick={() => setOverviewRange("This Month")}>This Month</MenuItem>
                <MenuItem icon={Calendar} onClick={() => setOverviewRange("This Year")}>This Year</MenuItem>
              </Menu>
            </div>
            <div className="flex flex-col items-center">
              <DonutChart data={overview} centerValue={overviewTotal} centerLabel={overviewLabel} size={150} />
            </div>
            <ul className="mt-4 space-y-2">
              {overview.map((o) => (
                <li key={o.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-ink-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: o.color }} /> {o.name}
                  </span>
                  <span className="font-medium text-ink-subtle">{o.value}%</span>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-ink">Popular Services</h2>
              <button
                className="text-xs font-semibold text-brand-ink transition hover:underline"
                onClick={() => servicesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                View All
              </button>
            </div>
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
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[p.tone]}`}>
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
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {QUICK.map((q) =>
                q.label === "Service Reports" ? (
                  <Link
                    key={q.label}
                    href="/dashboard/reports"
                    className="flex flex-col items-center gap-2 rounded-xl border border-line py-4 text-xs font-medium text-ink-muted hover:bg-surface-hover"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[q.tone]}`}><q.icon className="h-4.5 w-4.5" /></span>
                    {q.label}
                  </Link>
                ) : (
                  <button
                    key={q.label}
                    onClick={() => onQuickAction(q.label)}
                    className="flex flex-col items-center gap-2 rounded-xl border border-line py-4 text-xs font-medium text-ink-muted hover:bg-surface-hover"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${TONE_BG[q.tone]}`}><q.icon className="h-4.5 w-4.5" /></span>
                    {q.label}
                  </button>
                )
              )}
            </div>
          </Card>
        </div>
      </ResizableColumns>

      {/* Add / Edit Service modal */}
      <Modal
        open={serviceModalOpen}
        onClose={() => setServiceModalOpen(false)}
        title={editServiceId ? "Edit Service" : "Add New Service"}
        description={editServiceId ? "Update the details of this service." : "Create a new service offered on the platform."}
        icon={Briefcase}
        iconTone="brand"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setServiceModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitService}>{editServiceId ? "Save Changes" : "Add Service"}</button>
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
          <Select
            label="Type"
            options={["Fashion", "Beauty", "Photography", "Digital", "Wellness"]}
            value={serviceForm.type}
            onChange={(e) => setServiceForm((f) => ({ ...f, type: e.target.value }))}
          />
          <Select
            label="Duration"
            options={["30 min", "45 min", "60 min", "90 min", "120 min"]}
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
            placeholder="Describe this service…"
            value={serviceForm.description}
            onChange={(e) => setServiceForm((f) => ({ ...f, description: e.target.value }))}
            className="col-span-2"
          />
        </div>
      </Modal>

      {/* Add / Edit Type modal */}
      <Modal
        open={typeModalOpen}
        onClose={() => setTypeModalOpen(false)}
        title={editTypeId ? "Edit Type" : "Add New Type"}
        description={editTypeId ? "Update this service category." : "Create a new service category."}
        icon={LayoutGrid}
        iconTone="violet"
        size="lg"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setTypeModalOpen(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={submitType}>{editTypeId ? "Save Changes" : "Add Type"}</button>
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
            placeholder="Describe this category…"
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
          <Input
            label="Popularity"
            type="number"
            min={0}
            max={100}
            placeholder="0 - 100"
            value={typeForm.pop}
            onChange={(e) => setTypeForm((f) => ({ ...f, pop: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Service detail modal */}
      <Modal
        open={!!detailService}
        onClose={() => setDetailId(null)}
        title={detailService?.name ?? "Service"}
        description={detailService ? `${detailService.type} service` : undefined}
        icon={detailService?.icon ?? Briefcase}
        iconTone={detailService?.tone ?? "brand"}
        footer={
          detailService && (
            <>
              <button className="btn btn-outline" onClick={() => toggleServiceStatus(detailService._id)}>
                {detailService.status === "Active" ? "Deactivate" : "Activate"}
              </button>
              <button className="btn btn-primary" onClick={() => deleteService(detailService._id)}>Delete</button>
            </>
          )
        }
      >
        {detailService && (
          <div className="grid grid-cols-2 gap-4 text-sm">
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
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Bookings</p>
              <p className="font-medium text-ink-muted">{detailService.bookings}</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-subtle">Rating</p>
              <span className="flex items-center gap-1 font-medium text-ink-muted">
                {detailService.rating} <Star className="h-3.5 w-3.5 fill-rating text-rating" />
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
