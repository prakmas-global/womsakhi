import { memo } from "react";

/** Brand-tinted spinner ring. Use inside buttons, cards or overlays. */
function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-2 border-brand-200 border-t-brand-600 ${className}`}
    />
  );
}

export default memo(Spinner);
