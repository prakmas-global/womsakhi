import { AuthShell } from "@/components/auth-shell";
import "@/components/auth-cards";

/**
 * Verify runs outside the shell, so it needs its own loading state — the same
 * AuthShell page the screen itself draws, with a quiet spinner in the card.
 *
 * Without this file it inherited `/app/loading.tsx` — the whole app, sidebar
 * and all — and painted a product she cannot reach yet.
 */
export default function Loading() {
  return (
    <AuthShell photo="upload" caption={{
      title: "Your application",
      text: "Every account is checked by a real person, usually within a day. You can learn while you wait.",
    }}>
      <div className="ac">
        <div role="status" className="ac-wait">
          <span className="ac-spin" aria-hidden style={{ border: "3px solid #f8e3eb", borderTopColor: "#9b1d50", borderRadius: "50%" }} />
          <p>Loading…</p>
        </div>
      </div>
    </AuthShell>
  );
}
