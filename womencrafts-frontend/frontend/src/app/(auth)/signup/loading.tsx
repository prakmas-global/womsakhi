import { AuthShell } from "@/components/auth-shell";

/** Shown while this route's code is on its way: the same shell, so the real
 *  screen replaces it without a jump. */
export default function Loading() {
  return (
    <AuthShell photo="join" splash={false}>
      <p className="wsa-muted" role="status" style={{ padding: "2rem 0" }}>Loading…</p>
    </AuthShell>
  );
}
