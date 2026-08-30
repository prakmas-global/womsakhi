import type { ReactNode } from "react";

/**
 * The standard raised panel. Everything on a page sits in one of these.
 * `soft` is the lighter, smaller-radius variant for tiles nested inside a Card.
 */
export default function Card({
  children,
  className = "",
  padded = true,
  soft = false,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  soft?: boolean;
  as?: React.ElementType;
}) {
  return (
    <Tag className={`${soft ? "wc-soft" : "wc-card"} ${padded ? "p-5" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

/** Card header with a title, optional description and a right-hand action slot. */
export function CardHeader({
  title,
  description,
  action,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-4 flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h3 className="font-display text-base font-bold tracking-tight text-ink">{title}</h3>
        {description && <p className="mt-0.5 text-sm text-ink-subtle">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
