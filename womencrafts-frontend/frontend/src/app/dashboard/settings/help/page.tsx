"use client";

import { useState } from "react";
import { LifeBuoy, Rocket, Users, CalendarDays, GraduationCap, CreditCard, Puzzle, UserPlus, BellRing, BookOpen, FileText, CalendarCheck, ShieldCheck, ChevronRight, Headset, PlayCircle, Search, X } from "lucide-react";
import { Card, Modal, NoResults} from "@/design-system";
import Link from "next/link";
import { ResizableColumns } from "@/layout-engine";

const CATEGORIES = [
  { icon: Rocket, title: "Getting Started", articles: 12, desc: "Set up your account and learn the basics.", tone: "brand" },
  { icon: Users, title: "Managing Users", articles: 18, desc: "Add, edit, and organize your platform members.", tone: "violet" },
  { icon: CalendarDays, title: "Appointments", articles: 15, desc: "Schedule, reschedule, and track bookings.", tone: "amber" },
  { icon: GraduationCap, title: "Programs & Services", articles: 20, desc: "Create and manage programs and offerings.", tone: "emerald" },
  { icon: CreditCard, title: "Billing & Payments", articles: 9, desc: "Invoices, payouts, and payment settings.", tone: "sky" },
  { icon: Puzzle, title: "Integrations", articles: 14, desc: "Connect calendars, tools, and other apps.", tone: "rose" },
];

const POPULAR = [
  { icon: UserPlus, title: "How to add a new user", category: "Managing Users", tone: "violet" },
  { icon: BellRing, title: "Setting up appointment reminders", category: "Appointments", tone: "amber" },
  { icon: BookOpen, title: "Creating your first program", category: "Programs & Services", tone: "emerald" },
  { icon: FileText, title: "Managing billing and invoices", category: "Billing & Payments", tone: "sky" },
  { icon: CalendarCheck, title: "Connecting Google Calendar", category: "Integrations", tone: "rose" },
  { icon: ShieldCheck, title: "Understanding user roles", category: "Getting Started", tone: "brand" },
];

const TUTORIALS = [
  { title: "Platform walkthrough", length: "4:12" },
  { title: "Managing your first booking", length: "6:38" },
  { title: "Setting up integrations", length: "5:05" },
];

const TONE_BG: Record<string, string> = {
  brand: "bg-brand-tint text-brand-ink",
  violet: "bg-violet-tint text-violet-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
};

type Category = (typeof CATEGORIES)[number];
type Article = (typeof POPULAR)[number];
type Tutorial = (typeof TUTORIALS)[number];

export default function HelpCenterPage() {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [openTutorial, setOpenTutorial] = useState<Tutorial | null>(null);

  const q = query.trim().toLowerCase();

  const matchesQuery = (...fields: string[]) =>
    q === "" || fields.some((f) => f.toLowerCase().includes(q));

  const filteredCategories = CATEGORIES.filter((c) => matchesQuery(c.title, c.desc));

  const filteredPopular = POPULAR.filter(
    (p) => matchesQuery(p.title, p.category) && (!activeCategory || p.category === activeCategory)
  );

  const clearFilters = () => {
    setQuery("");
    setActiveCategory(null);
  };

  return (
    <div>
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
          <LifeBuoy className="h-6 w-6" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Help Center</h1>
          <p className="mt-1 text-sm text-ink-subtle">Find answers to common questions and guides.</p>
        </div>
      </div>

      {/* hero search */}
      <Card className="bg-linear-to-br from-violet-50 to-brand-50">
        <div className="mx-auto flex max-w-2xl flex-col items-center py-8 text-center">
          <h2 className="font-display text-2xl font-bold tracking-tight text-ink">How can we help you?</h2>
          <p className="mt-2 text-sm text-ink-subtle">Search our knowledge base or browse categories below.</p>
          <div className="relative mt-5 w-full">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-subtle" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for help articles, guides, FAQs..."
              className="w-full rounded-lg border border-line-strong bg-surface py-2 pl-9 pr-9 text-sm text-ink-muted placeholder-ink-subtle outline-none focus:border-violet-300 focus:ring-4 focus:ring-violet-50"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-hover hover:text-ink-muted"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* active filter chip */}
      {activeCategory && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-ink-subtle">Filtering by</span>
          <button
            onClick={() => setActiveCategory(null)}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-tint px-3 py-1 text-xs font-semibold text-brand-ink hover:bg-brand-100"
          >
            {activeCategory}
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* categories */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredCategories.map((c) => {
          const active = activeCategory === c.title;
          return (
            <button
              key={c.title}
              type="button"
              onClick={() => setActiveCategory(active ? null : c.title)}
              className="w-full text-left"
            >
              <Card className={`transition hover:shadow-md ${active ? "ring-2 ring-brand-500/40" : ""}`}>
                <div className="flex items-start gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE_BG[c.tone]}`}>
                    <c.icon className="h-5.5 w-5.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-base font-semibold text-ink">{c.title}</h3>
                      <span className="text-xs font-medium text-ink-subtle">{c.articles} articles</span>
                    </div>
                    <p className="mt-1 text-sm text-ink-subtle">{c.desc}</p>
                  </div>
                </div>
              </Card>
            </button>
          );
        })}
        {filteredCategories.length === 0 && (
          <p className="col-span-full py-4 text-center text-sm text-ink-subtle">
            No categories match “{query}”.
          </p>
        )}
      </div>

      {/* popular + support */}
      <ResizableColumns id="settings-help" defaultSize={0.74} className="mt-6 gap-6">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-ink">Popular Articles</h2>
            <button onClick={clearFilters} className="text-xs font-semibold text-brand-ink transition hover:underline">
              View All
            </button>
          </div>
          <ul className="divide-y divide-line">
            {filteredPopular.map((p) => (
              <li key={p.title}>
                <button
                  onClick={() => setOpenArticle(p)}
                  className="flex w-full items-center gap-3 rounded-xl p-2.5 text-left hover:bg-surface-hover"
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${TONE_BG[p.tone]}`}>
                    <p.icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{p.title}</p>
                    <p className="text-xs text-ink-subtle">{p.category}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-faint" />
                </button>
              </li>
            ))}
          </ul>
          {filteredPopular.length === 0 && (
            <NoResults icon={BookOpen} thing="articles" filtered compact />
          )}
        </Card>

        <div className="space-y-6">
          <Card className="bg-violet-tint">
            <div className="flex flex-col items-center py-2 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-tint text-violet-ink">
                <Headset className="h-6 w-6" />
              </span>
              <h2 className="mt-3 font-display text-base font-semibold text-ink">Still need help?</h2>
              <p className="mt-1 text-sm text-ink-subtle">Our support team is here for you.</p>
              <Link href="/dashboard/settings/support" className="btn btn-secondary btn-block mt-4">
                Contact Support
              </Link>
            </div>
          </Card>

          <Card>
            <h2 className="mb-3 font-display text-base font-semibold text-ink">Video Tutorials</h2>
            <ul className="space-y-2">
              {TUTORIALS.map((t) => (
                <li key={t.title}>
                  <button
                    onClick={() => setOpenTutorial(t)}
                    className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-surface-hover"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand-ink">
                      <PlayCircle className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{t.title}</p>
                      <p className="text-xs text-ink-subtle">{t.length}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </ResizableColumns>

      {/* article preview modal */}
      <Modal
        open={!!openArticle}
        onClose={() => setOpenArticle(null)}
        title={openArticle?.title ?? ""}
        description={openArticle ? openArticle.category : undefined}
        icon={openArticle?.icon ?? BookOpen}
        iconTone={(openArticle?.tone as "brand" | "violet" | "emerald" | "amber" | "sky" | "rose") ?? "brand"}
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setOpenArticle(null)}>
              Close
            </button>
            <Link href="/dashboard/settings/support" className="btn btn-primary">
              Contact Support
            </Link>
          </>
        }
      >
        <div className="space-y-3 text-sm text-ink-muted">
          <p>
            This article walks you through everything you need to know about{" "}
            <span className="font-semibold text-ink">{openArticle?.title.toLowerCase()}</span>.
          </p>
          <p>
            Follow the step-by-step instructions below to complete the task. If you run into any issues,
            our support team is always ready to help.
          </p>
          <ul className="list-inside list-disc space-y-1 text-ink-subtle">
            <li>Open the relevant section from your dashboard.</li>
            <li>Review the available options and choose the one that fits your needs.</li>
            <li>Save your changes and confirm the result.</li>
          </ul>
        </div>
      </Modal>

      {/* tutorial preview modal */}
      <Modal
        open={!!openTutorial}
        onClose={() => setOpenTutorial(null)}
        title={openTutorial?.title ?? ""}
        description={openTutorial ? `Video • ${openTutorial.length}` : undefined}
        icon={PlayCircle}
        iconTone="brand"
        footer={
          <button className="btn btn-primary" onClick={() => setOpenTutorial(null)}>
            Done
          </button>
        }
      >
        <div className="space-y-3 text-sm text-ink-muted">
          <div className="flex aspect-video w-full items-center justify-center rounded-2xl bg-surface-inset text-ink-subtle dark:bg-white/5">
            <PlayCircle className="h-12 w-12" />
          </div>
          <p>
            Watch this {openTutorial?.length} tutorial to learn more about{" "}
            <span className="font-semibold text-ink">{openTutorial?.title.toLowerCase()}</span>.
          </p>
        </div>
      </Modal>
    </div>
  );
}
