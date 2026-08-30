"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";

import { apiUnreadCounts } from "@/lib/member-api";

/**
 * Messages + notifications, with unread badges.
 *
 * These two live in the header rather than the tab bar: five tabs is the most a
 * phone can carry comfortably, and both of these are things that happen *to*
 * her rather than places she goes.
 */
export default function MemberHeaderActions({ className = "" }: { className?: string }) {
  const [counts, setCounts] = useState({ notifications: 0, messages: 0 });

  const load = useCallback(async () => {
    try {
      setCounts(await apiUnreadCounts());
    } catch {
      /* a badge is never worth an error message */
    }
  }, []);

  useEffect(() => {
    void load();
    // Cheap poll; replaced by a live channel when realtime lands.
    const id = setInterval(() => void load(), 60000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <HeaderLink
        href="/app/messages"
        label="Messages"
        count={counts.messages}
        icon={MessageCircle}
      />
      <HeaderLink
        href="/app/notifications"
        label="Notifications"
        count={counts.notifications}
        icon={Bell}
      />
    </div>
  );
}

function HeaderLink({
  href,
  label,
  count,
  icon: Icon,
}: {
  href: string;
  label: string;
  count: number;
  icon: React.ElementType;
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      className="relative flex h-10 w-10 items-center justify-center rounded-xl text-ink-subtle transition hover:bg-surface-hover hover:text-ink-muted"
    >
      <Icon className="h-[1.15rem] w-[1.15rem]" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-3xs font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
