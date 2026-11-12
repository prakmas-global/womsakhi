/**
 * A picture that may come from the API — an avatar, an upload, a cover.
 *
 * `next/image` refuses any host that is not in `next.config`'s image list,
 * and our media host cannot be put there (next.config.ts explains: the
 * optimiser answers 400 for it, tried and reverted). Worse than refusing, it
 * THROWS, so one member's uploaded photo took the whole You screen down with
 * "We could not load your home screen". App art under /ux/ can keep using
 * `next/image`; anything a member uploaded goes through this.
 */
export function Img({ src, alt = "", width, height, className, style }: {
  src: string; alt?: string; width?: number; height?: number; className?: string; style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} width={width} height={height} loading="lazy" decoding="async" className={className} style={style} />
  );
}
