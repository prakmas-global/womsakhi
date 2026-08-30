import { memo } from "react";
import Link from "next/link";
import { ArrowUp, ArrowDown } from "lucide-react";

import type { Tone } from "./Badge";

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "violet",
  delta,
  deltaDir = "up",
  deltaNote = "vs last month",
  valueClassName = "text-2xl",
  href,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone?: Tone;
  delta?: string;
  deltaDir?: "up" | "down";
  deltaNote?: string;
  valueClassName?: string;
  href?: string;
}) {
  const tones: Record<Tone, string> = {
    violet: "bg-violet-tint text-violet-ink",
    brand: "bg-brand-100 text-brand-ink",
    emerald: "bg-status-ok-bg text-status-ok-ink",
    amber: "bg-status-warn-bg text-status-warn-ink",
    sky: "bg-status-info-bg text-status-info-ink",
    rose: "bg-status-danger-bg text-status-danger-ink",
    fuchsia: "bg-violet-tint text-violet-ink",
    blue: "bg-status-info-bg text-status-info-ink",
    slate: "bg-surface-inset text-ink-subtle",
  };
  const body = (
    <>
      <div className="flex items-center gap-4">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
        >
          <Icon className="h-6 w-6" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xsm font-medium text-ink-subtle">{label}</p>
          <p className={`truncate font-display font-bold text-ink ${valueClassName}`} title={value}>
            {value}
          </p>
        </div>
      </div>
      {delta && (
        <p className="mt-3 flex items-center gap-1 text-xs">
          {deltaDir === "up" ? (
            <ArrowUp className="h-3.5 w-3.5 text-status-ok-ink" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-status-danger-ink" />
          )}
          <span
            className={`font-semibold ${deltaDir === "up" ? "text-status-ok-ink" : "text-status-danger-ink"}`}
          >
            {delta}
          </span>
          <span className="text-ink-subtle">{deltaNote}</span>
        </p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="wc-card block p-5 transition-transform duration-200 hover:-translate-y-1"
      >
        {body}
      </Link>
    );
  }

  return <div className="wc-card p-5">{body}</div>;
}

export default memo(StatCard);
