import "../ux/tokens.css";

/**
 * Carries the `--ux-*` tokens onto this route, and nothing else.
 *
 * `/verify-email` is deliberately outside `(auth)` — she may open the link on
 * another device, or signed out — so none of the three layouts that import the
 * token sheet sit above it. Without this the page still rendered, but every
 * `var(--ux-*)` resolved to nothing: a washed-out card and a primary button
 * with white text on no background at all.
 *
 * A plain passthrough, so the page keeps full control of its own frame.
 */
export default function VerifyEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
