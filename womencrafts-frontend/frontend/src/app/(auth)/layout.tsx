/**
 * A thin wrapper: each auth screen picks its own photo, so the shell
 * (`@/components/auth-shell`) is rendered by the page, not here. The splash
 * plays on every visit, so nothing needs to run before first paint.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
