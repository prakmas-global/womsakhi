/**
 * The approved illustrations (womsakhi-images-assets), exported as WebP at
 * 480 and 960 px wide into public/ux/onboarding. `pos` is the crop that keeps
 * the faces in frame when the picture is cut to a wide tile, a banner or a
 * circle; `alt` says what the picture shows, for the screens where it carries
 * meaning (a decorative use passes `decorative`).
 */
const ART = {
  learn: { h: 640, pos: "42% 24%", alt: "A young woman smiling as she learns on her laptop" },
  earn: { h: 640, pos: "52% 26%", alt: "Two women stitching fabric together at a worktable" },
  job: { h: 1200, pos: "50% 11%", alt: "Three women at work: a cook, an office worker and an engineer" },
  sell: { h: 720, pos: "44% 20%", alt: "A woman photographing her handmade products to sell" },
  shop: { h: 640, pos: "60% 30%", alt: "A woman shopping online among clothes and gifts" },
  meet: { h: 720, pos: "40% 44%", alt: "A group of women laughing together around a laptop" },
  calm: { h: 640, pos: "50% 24%", alt: "A woman sitting calmly, eyes closed, in a sunny room" },
  wait: { h: 541, pos: "40% 26%", alt: "A woman with open arms looking at a sunrise" },
  sakhi: { h: 720, pos: "38% 30%", alt: "Sakhi, the WomSakhi guide" },
  privacy: { h: 720, pos: "48% 30%", alt: "A woman relaxing with her phone, a lock and a shield beside her" },
  setup: { h: 1200, pos: "50% 36%", alt: "Three women holding a glowing lotus together" },
  home: { h: 640, pos: "45% 30%", alt: "Women of every age together on a hillside at sunrise" },
  circle: { h: 720, pos: "50% 44%", alt: "Women talking together around a table" },
} as const;

export type ArtName = keyof typeof ART;

const W = 960;

export function artPos(name: ArtName): string {
  return ART[name].pos;
}

/**
 * One illustration, responsive: the 480 or 960 file by the width it is drawn
 * at (`sizes`), cropped with `object-fit: cover` at the approved position.
 */
export function Art({
  name, sizes, className, decorative = false, lazy = false, pos,
}: {
  name: ArtName;
  sizes: string;
  className?: string;
  decorative?: boolean;
  /** Off-screen pictures only (the desktop backdrop). The flow's own pictures are its content. */
  lazy?: boolean;
  /** Override the crop for one use. */
  pos?: string;
}) {
  const a = ART[name];
  return (
    // eslint-disable-next-line @next/next/no-img-element -- pre-sized WebP pair with srcset; next/image would re-encode them
    <img
      className={className ? `wso-art ${className}` : "wso-art"}
      src={`/ux/onboarding/${name}-480.webp`}
      srcSet={`/ux/onboarding/${name}-480.webp 480w, /ux/onboarding/${name}-960.webp 960w`}
      sizes={sizes}
      width={W}
      height={a.h}
      alt={decorative ? "" : a.alt}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      draggable={false}
      style={{ objectPosition: pos ?? a.pos }}
    />
  );
}
