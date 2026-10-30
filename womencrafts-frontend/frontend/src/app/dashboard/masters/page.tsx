"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronRight, Database, ExternalLink, FolderTree, GraduationCap, Globe, HeartPulse, LifeBuoy, ListTree, Lock,
  Search, ShieldCheck, Store, Users, Briefcase,
} from "lucide-react";

import { Badge, Card, EmptyState, ErrorState, NoResults, SkeletonTable, StatCard } from "@/design-system";
import { memberError } from "@/lib/member-api";
import { apiAdminMasters, type MasterListSummary } from "@/lib/masters-admin-api";
import { placesOf } from "@/components/admin/master-icons";

/**
 * Masters — every pick-list staff control, in one place (backend:
 * app/core/masters.py, routes/masters.py).
 *
 * Each card is one list: what it is for, how many items it has, and where its
 * values are stored. The two older masters with rules of their own (shop
 * categories, work categories and skills) keep their own screens and are
 * linked here so staff find everything from one page.
 *
 * The hub only shows lists the signed-in staff member can view; a list she
 * can view but not change opens read-only.
 */

const SECTIONS: { key: string; icon: React.ElementType }[] = [
  { key: "Learn", icon: GraduationCap },
  { key: "Work", icon: Briefcase },
  { key: "Earn", icon: Store },
  { key: "Community", icon: Users },
  { key: "Help & safety", icon: ShieldCheck },
  { key: "Health", icon: HeartPulse },
  { key: "Support", icon: LifeBuoy },
  { key: "Everywhere", icon: Globe },
];

/** The older masters with their own screens, shown as links. */
const LINKED = [
  { key: "shop-categories", section: "Earn", name: "Shop categories", href: "/dashboard/market/categories",
    description: "Categories and sub-categories shops sell under. A shop has one category; its listings must fit it." },
  { key: "work-skills", section: "Work", name: "Work categories & skills", href: "/dashboard/work-skills",
    description: "Trades and the skills under them. Members pick skills for their work profile; jobs are filed by them." },
];

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function MastersHub() {
  const [lists, setLists] = useState<MasterListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try { setLists(await apiAdminMasters()); setError(""); }
    catch (e) { setError(memberError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    const hit = (s: string) => !q || s.toLowerCase().includes(q);
    return SECTIONS.map((sec) => ({
      ...sec,
      lists: lists.filter((l) => l.section === sec.key && (hit(l.name) || hit(l.description) || hit(placesOf(l.used_in)))),
      linked: LINKED.filter((l) => l.section === sec.key && (hit(l.name) || hit(l.description))),
    })).filter((g) => g.lists.length || g.linked.length);
  }, [lists, q]);

  const items = lists.reduce((n, l) => n + l.items, 0);
  const active = lists.reduce((n, l) => n + l.active_items, 0);
  const editable = lists.filter((l) => l.can_edit).length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand-ink"><ListTree className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-ink">Masters</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-subtle">
              The lists members and staff pick from, across every module. Add, rename, reorder or disable items;
              a rename carries into every record that uses it, and an item can only be deleted when nothing uses it.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Lists" value={String(lists.length + LINKED.length)} icon={Database} tone="brand" deltaNote={`${LINKED.length} with their own screen`} />
        <StatCard label="Items" value={items.toLocaleString()} icon={ListTree} tone="violet" deltaNote="In the lists below" />
        <StatCard label="Active" value={active.toLocaleString()} icon={FolderTree} tone="emerald" deltaNote={`${(items - active).toLocaleString()} disabled`} />
        <StatCard label="You can edit" value={String(editable)} icon={Lock} tone="sky" deltaNote={editable === lists.length ? "All of them" : "The rest are read-only"} />
      </div>

      <Card className="mt-6">
        <label className="relative mb-5 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
          <input aria-label="Search lists" value={query} onChange={(e) => setQuery(e.target.value)}
                 placeholder="Search lists — e.g. languages, events, report…"
                 className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-violet-300" />
        </label>

        {loading ? <SkeletonTable rows={6} cols={3} />
          : error ? <ErrorState title="Could not load the lists" description={error} onRetry={() => void load()} />
          : lists.length === 0 && !q ? (
            <EmptyState icon={ListTree} title="No lists you can open"
                        description="Each list belongs to a module. Ask a Super Admin for access to the module whose lists you manage." />
          )
          : groups.length === 0 ? <NoResults icon={ListTree} filtered thing="lists" onClear={() => setQuery("")} />
          : (
            <div className="space-y-7">
              {groups.map((g) => (
                <section key={g.key} aria-labelledby={`sec-${g.key}`}>
                  <h2 id={`sec-${g.key}`} className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-subtle">
                    <g.icon className="h-4 w-4" /> {g.key}
                  </h2>
                  <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {g.lists.map((l) => (
                      <li key={l.key} className="min-w-0">
                        <Link href={`/dashboard/masters/${l.key}`}
                              className="group flex h-full flex-col gap-2 rounded-xl border border-line bg-surface p-4 transition hover:border-violet-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-ink">{l.name}</span>
                            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5" />
                          </span>
                          <span className="line-clamp-2 text-xs text-ink-muted">{l.description}</span>
                          <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                            <Badge tone="violet">{plural(l.items, "item")}</Badge>
                            {l.items !== l.active_items && <Badge tone="slate">{l.items - l.active_items} disabled</Badge>}
                            {l.levels === 2 && <Badge tone="sky">Two levels</Badge>}
                            {!l.can_edit && <Badge tone="amber">Read-only</Badge>}
                          </span>
                          {l.used_in.length > 0 && (
                            <span className="text-[11px] text-ink-subtle">Used in {placesOf(l.used_in)}</span>
                          )}
                        </Link>
                      </li>
                    ))}
                    {g.linked.map((l) => (
                      <li key={l.key} className="min-w-0">
                        <Link href={l.href}
                              className="group flex h-full flex-col gap-2 rounded-xl border border-dashed border-line-strong bg-surface p-4 transition hover:border-violet-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-500">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-sm font-bold text-ink">{l.name}</span>
                            <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-ink-subtle" />
                          </span>
                          <span className="line-clamp-2 text-xs text-ink-muted">{l.description}</span>
                          <span className="mt-auto pt-1"><Badge tone="brand">Own screen</Badge></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
      </Card>
    </div>
  );
}
