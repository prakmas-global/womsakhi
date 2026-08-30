import { Hammer } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

/** Temporary placeholder for screens not yet built, so every nav link resolves. */
export default function ComingSoon({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} icon={icon} />
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface py-24 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint text-brand-ink">
          <Hammer className="h-7 w-7" />
        </span>
        <p className="mt-4 font-display text-lg font-semibold text-ink-muted">
          {title} — coming up next
        </p>
        <p className="mt-1 max-w-sm text-sm text-ink-subtle">
          This screen is being built pixel-by-pixel from your design. It&apos;ll land here shortly.
        </p>
      </div>
    </div>
  );
}
