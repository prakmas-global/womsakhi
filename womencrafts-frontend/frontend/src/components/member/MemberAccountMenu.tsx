"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  FileCheck,
  FileText,
  Gift,
  Globe,
  Palette,
  HelpCircle,
  LogOut,
  MessageSquareHeart,
  Shield,
  UserRound,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { CustomiseButton } from "@/layout-engine";
import { useT } from "@/i18n";
import { Avatar } from "@/design-system";

/**
 * The account control in the member header — same shape as the staff topbar:
 * avatar, name, a line of context, and a chevron that turns.
 *
 * This menu owns EVERYTHING account-shaped. None of it appears in the sidebar,
 * and nothing the sidebar owns appears here. One rule, so nothing is listed
 * twice: the sidebar is what the platform offers, this is your own account.
 */

const GROUPS: { items: { href: string; labelKey: string; icon: React.ElementType }[] }[] = [
  {
    items: [
      { href: "/app/profile", labelKey: "nav.profile", icon: UserRound },
      { href: "/app/settings/account", labelKey: "nav.details", icon: FileText },
      { href: "/app/documents", labelKey: "nav.documents", icon: FileCheck },
      { href: "/app/refer", labelKey: "nav.refer", icon: Gift },
    ],
  },
  {
    items: [
      { href: "/app/settings/appearance", labelKey: "nav.appearance", icon: Palette },
      { href: "/app/settings/language", labelKey: "nav.language", icon: Globe },
      { href: "/app/settings/notifications", labelKey: "nav.notifSettings", icon: Bell },
      { href: "/app/settings/security", labelKey: "nav.security", icon: Shield },
    ],
  },
  {
    items: [
      { href: "/app/feedback", labelKey: "nav.feedback", icon: MessageSquareHeart },
      { href: "/app/help", labelKey: "nav.help", icon: HelpCircle },
    ],
  },
];

export default function MemberAccountMenu() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const t = useT();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Navigating away must close it — otherwise it hangs over the new screen.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  if (!user) return null;

  const name = user.full_name || "Member";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Your account"
        aria-expanded={open}
        className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-brand-tint/60 dark:hover:bg-white/5 ${
          open ? "bg-brand-tint/60 dark:bg-white/5" : ""
        }`}
      >
        <Avatar name={name} src={user.avatar} size="sm" ring />
        {/* The name needs room; on a phone the avatar alone carries it. */}
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-semibold leading-tight text-ink">
            {name}
          </span>
          <span className="block text-2xs leading-tight text-ink-subtle">
            {t("profile.verified")}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="wc-page-enter absolute end-0 top-14 z-50 w-72 overflow-hidden rounded-2xl border border-line bg-[var(--surface)] shadow-[0_20px_50px_-16px_rgba(80,40,120,0.4)] ring-1 ring-black/5 dark:border-white/10 dark:ring-white/10">
          <div className="flex items-center gap-3 border-b border-line bg-linear-to-br from-brand-50/70 to-violet-50/50 px-4 py-4 dark:border-white/10 dark:from-white/5 dark:to-transparent">
            <Avatar name={name} src={user.avatar} size="md" ring />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-ink">{name}</p>
              <p className="truncate text-2xs font-medium text-brand-ink">
                {t("profile.verified")}
              </p>
              <p className="truncate text-2xs text-ink-subtle">{user.email}</p>
            </div>
          </div>

          <div className="px-1.5 py-1.5">
            {GROUPS.map((group, i) => (
              <div key={i}>
                {i > 0 && (
                  <div className="my-1 border-t border-line dark:border-white/10" />
                )}
                {group.items.map(({ href, labelKey, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className="group/mi flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-xsm font-semibold text-ink-muted transition hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/5"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-inset text-ink-subtle transition group-hover/mi:bg-brand-100 group-hover/mi:text-brand-ink dark:bg-white/10">
                      <Icon className="h-4 w-4" strokeWidth={2.2} />
                    </span>
                    {t(labelKey as never)}
                  </Link>
                ))}
              </div>
            ))}

            <div className="my-1 border-t border-line dark:border-white/10" />

            {/* Entering customise mode lives here on purpose: the account menu
                is not itself customisable, so the way to rearrange the app — and
                the way to put it back — can never be hidden by rearranging it. */}
            <CustomiseButton
              className="group/mi flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xsm font-semibold text-ink-muted transition hover:bg-brand-tint hover:text-brand-ink dark:hover:bg-white/5"
            />

            <div className="my-1 border-t border-line dark:border-white/10" />

            <button
              onClick={async () => {
                setOpen(false);
                await signOut();
                router.replace("/signin");
              }}
              className="group/mi flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left text-xsm font-semibold text-status-danger-ink transition hover:bg-status-danger-bg dark:hover:bg-rose-500/10"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-status-danger-bg text-status-danger-ink transition group-hover/mi:bg-status-danger-bg">
                <LogOut className="h-4 w-4" strokeWidth={2.2} />
              </span>
              {t("common.signOut")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
