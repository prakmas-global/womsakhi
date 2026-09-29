import type { CSSProperties, ReactNode } from "react";

/**
 * A brand-colour block standing in for an image.
 *
 * The owner is generating WomSakhi's own imagery. Until each picture exists,
 * every place that would show a photo or illustration shows this instead — the
 * same size and shape, in brand colours — so nothing ships with stock or
 * placeholder photography and swapping the real image in later is a one-line
 * change at the call site.
 *
 * `slot` names the picture that belongs here (e.g. "AUTH-01 sign-in hero"). It
 * is written to `data-image-slot` so every slot can be listed from the DOM, and
 * it is the name to use when handing over the finished image.
 */
export function BrandPlaceholder({
  slot,
  className = "",
  style,
  tone = "gradient",
  children,
  rounded = true,
}: {
  slot: string;
  className?: string;
  style?: CSSProperties;
  tone?: "gradient" | "soft" | "night";
  children?: ReactNode;
  rounded?: boolean;
}) {
  const background =
    tone === "soft"
      ? "linear-gradient(135deg, #fbe7f1 0%, #efe3f8 100%)"
      : tone === "night"
        ? "linear-gradient(145deg, #2d1a63 0%, #5b2a86 55%, #a3226f 100%)"
        : "linear-gradient(135deg, #d21f7c 0%, #a3267f 45%, #7440a6 100%)";
  return (
    <div
      role="img"
      aria-label=""
      aria-hidden
      data-image-slot={slot}
      className={className}
      style={{
        position: "relative",
        overflow: "hidden",
        background,
        borderRadius: rounded ? undefined : 0,
        ...style,
      }}
    >
      {/* Soft light so a large block reads as intentional, not missing. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(60% 50% at 18% 12%, rgba(255,255,255,.28), transparent 70%), radial-gradient(50% 45% at 85% 90%, rgba(255,255,255,.14), transparent 70%)",
        }}
      />
      {children}
    </div>
  );
}
