import MemberShell from "./MemberShell";
import { serverBoot } from "@/lib/server-api";
import "@/app/ux/tokens.css";

/**
 * The member app's server entry point.
 *
 * It exists to do one thing before the HTML is sent: fetch `/me/shell`, using
 * the session cookie the request already carried. That request used to be made
 * by the browser, and it could not even *start* until a second browser request,
 * `/auth/session`, had come back — because the provider that makes it lives
 * inside the gate that waits on the session. Two round trips in a fixed order,
 * on every one of the member app's screens, before the first one asked for
 * anything of its own.
 *
 * Both are now answered here. `MemberShell` holds every guard, unchanged; if
 * this fetch returns null — a member still in verification gets a 401 from
 * `/me/shell`, and an API that is down gets nothing — the client falls back to
 * fetching for itself exactly as before.
 */
export default async function MemberLayout({ children }: { children: React.ReactNode }) {
  // Already fetched by the root layout on this same request — `serverBoot` is
  // wrapped in React's `cache`, so this costs nothing and needs no prop
  // threaded through a layout boundary that cannot carry one.
  const { shell: initialShell } = await serverBoot();
  return <MemberShell initialShell={initialShell}>{children}</MemberShell>;
}
