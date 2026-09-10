"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { apiSignIn, apiSignOut, apiSignUp, apiGetSession, AuthPayload, apiErrorMessage } from "@/lib/api";
import { useToast } from "@/design-system/feedback/ToastProvider";
import { WaitScreen } from "@/components/ux/WaitScreen";
import { useT } from "@/i18n";

type User = AuthPayload["user"];

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signUp: (
    full_name: string,
    email: string,
    password: string,
    extra?: { phone?: string; locale?: string }
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateUser: (updated: User) => void;
  /** RBAC — can the signed-in user open this module? */
  canAccess: (moduleKey: string) => boolean;
  isSuperAdmin: boolean;
  /** True for member accounts — they live in /app, not /dashboard. */
  isMember: boolean;
  /** Where this account belongs after sign-in. */
  homePath: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  children,
  initialUser = null,
  sessionResolved = false,
}: {
  children: ReactNode;
  /** Who the server already established is signed in, if it could. */
  initialUser?: User | null;
  /**
   * Whether `initialUser` is an answer or an absence.
   *
   * `null` means two different things — signed out, and the server could not
   * ask — and only one of them should stop the client asking. See
   * `serverSession` in `lib/server-api`.
   */
  sessionResolved?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const tr = useT();
  const [user, setUser] = useState<User | null>(initialUser);

  /**
   * The hand-off, while it is happening.
   *
   * Signing in and signing out both take several seconds on the connections
   * this app is used on, and until now both of them showed nothing at all and
   * then a bare spinner on an empty page. `handoff` is what the WaitScreen at
   * the bottom of this provider reads.
   *
   * `torn` means the app behind the curtain has already been dismantled —
   * `setUser(null)` has run, the member shell has fallen back to its own
   * gate — so there is nothing left worth looking at and the curtain must be
   * up NOW rather than after the usual 400ms grace.
   */
  const [handoff, setHandoff] = useState<null | { kind: "in" | "out"; torn: boolean }>(null);
  // A latch, because the arrival effect below both raises a toast and clears
  // the state that triggered it. In development React runs effects twice on the
  // same commit, and without this she is told twice that she has signed out.
  const said = useRef(false);

  /**
   * The curtain comes down when she has actually arrived, not when the router
   * was asked to move.
   *
   * `router.replace()` returns immediately; the destination still has to be
   * fetched, and on a slow connection that is the longest part of the whole
   * operation. Dropping the curtain on the call rather than on the arrival put
   * her back on the blank page for exactly the seconds this exists to cover.
   */
  const inApp = pathname.startsWith("/app") || pathname.startsWith("/dashboard");
  const arrived = !!handoff && (handoff.kind === "out" ? !inApp : inApp);

  useEffect(() => {
    if (!handoff || !arrived) return;

    /**
     * The confirmation is raised HERE, on arrival, rather than beside
     * `router.replace()`.
     *
     * A toast lives six seconds. Raised before the navigation, on a connection
     * where the navigation itself takes four, it would have two seconds left by
     * the time she could see it — and on a really bad one it would have expired
     * before the screen it belongs to had painted. Announcing an outcome on the
     * screen that outcome landed on is the only version that is reliably read.
     */
    if (handoff.kind === "out" && !said.current) {
      said.current = true;
      toast.success(tr("wait.signedOut"), { description: tr("wait.signedOutLine") });
    }
    // Cleared on the next tick, not in this body: the curtain is already down
    // because `open` below is derived from `arrived`, so there is nothing to
    // race, and a synchronous setState here would cascade a second render of
    // every screen in the app.
    const t = setTimeout(() => setHandoff(null), 0);
    return () => clearTimeout(t);
  }, [handoff, arrived, toast, tr]);

  // The server answered this before the HTML was sent, so there is nothing to
  // wait for and no spinner to show. This is the round trip that used to run
  // before every member screen was allowed to mount — see the member layout.
  const [loading, setLoading] = useState(!sessionResolved);

  // Rehydrate from the session cookie. There is no token in JS to read, so we
  // simply ask the API who we are — if the cookie is missing or expired this
  // 401s and we stay signed out.
  //
  // Skipped entirely when the server already answered with the same cookie on
  // the same request: asking again would get the same answer a round trip
  // later. It still runs when the server could not reach the API, so an API
  // blip degrades to the old behaviour rather than to a false sign-out.
  useEffect(() => {
    if (sessionResolved) return;
    apiGetSession()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, [sessionResolved]);

  // The API already set the httpOnly session cookie on this response; nothing
  // to store client-side.
  const persistAuth = (payload: AuthPayload) => {
    setUser(payload.user);
  };

  // Members and staff share one login but land in different apps.
  const homeFor = (u: User) => (u.audience === "member" ? "/app" : "/dashboard");

  const signUp = useCallback(
    async (
      full_name: string,
      email: string,
      password: string,
      extra: { phone?: string; locale?: string } = {}
    ) => {
      setHandoff({ kind: "in", torn: false });
      try {
        const payload = await apiSignUp(full_name, email, password, extra);
        persistAuth(payload);
        setHandoff({ kind: "in", torn: true });
        router.push(homeFor(payload.user));
      } catch (e) {
        // The form says what went wrong, in the field it went wrong in. A
        // curtain over that message would hide the only thing worth reading.
        setHandoff(null);
        throw e;
      }
    },
    [router]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      setHandoff({ kind: "in", torn: false });
      try {
        const payload = await apiSignIn(email, password);
        persistAuth(payload);
        setHandoff({ kind: "in", torn: true });
        router.push(homeFor(payload.user));
      } catch (e) {
        setHandoff(null);   // see signUp
        throw e;
      }
    },
    [router]
  );

  /**
   * Signing out, said out loud.
   *
   * Three things happen here that did not before, and each covers a stretch
   * where she previously had no idea whether anything was working:
   *
   *   1. The curtain goes up before the request leaves, so the press is
   *      answered instantly and the app keeps talking while the server is
   *      asked to drop the session.
   *   2. `torn: true` is set at the moment `setUser(null)` dismantles the
   *      member shell — which is what used to expose the bare spinner — so
   *      the curtain is already covering that page rather than racing it.
   *   3. It confirms itself. "You are signed out" is raised by the arrival
   *      effect above, once the sign-in screen is actually on screen — the
   *      toast list lives at the root and survives the route change. Before
   *      this the one operation that takes the whole app away was also the
   *      one operation that never said it had worked.
   */
  const signOut = useCallback(async () => {
    setHandoff({ kind: "out", torn: false });
    // Only the server can clear an httpOnly cookie — that is the point of it.
    try {
      await apiSignOut();
    } catch {
      /* Leaving locally is still the right outcome, and there is nothing for
         her to do about a failed sign-out request: the session on the server
         expires on its own. Telling her "sign-out failed" while signing her
         out would be both alarming and untrue. */
    }
    said.current = false;
    setHandoff({ kind: "out", torn: true });
    setUser(null);
    router.replace("/signin");
  }, [router]);

  const updateUser = useCallback((updated: User) => {
    setUser(updated);
  }, []);

  const canAccess = useCallback(
    (moduleKey: string) => !!user?.modules?.includes(moduleKey),
    [user],
  );
  const isSuperAdmin = user?.role === "Super Admin";
  const isMember = user?.audience === "member";
  const homePath = isMember ? "/app" : "/dashboard";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signOut,
        updateUser,
        canAccess,
        isSuperAdmin,
        isMember,
        homePath,
      }}
    >
      {children}

      {/*
        Rendered here rather than by each caller, because there are four of
        them — the settings screen, the shell menu, the verification screen and
        the sign-in form — and a hand-off that only some of them show is worse
        than none: the same action would feel broken in one place and fine in
        another.
      */}
      <WaitScreen
        open={!!handoff && !arrived}
        now={!!handoff?.torn}
        title={handoff?.kind === "in" ? tr("wait.signingIn") : tr("wait.signingOut")}
        line={handoff?.kind === "in" ? tr("wait.signingInLine") : tr("wait.signingOutLine")}
        slowLine={tr("wait.slow")}
        stuckLabel={tr("wait.stuck")}
        /* A full page load, not `router.push`. This button only exists once
           fifteen seconds have gone by, and by then the thing most likely to
           be wedged is the client router itself. */
        onStuck={() => window.location.assign("/signin")}
      />
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

/** Extract a user-friendly error message from an axios error */
export function getAuthError(err: unknown): string {
  // Reads this API's real error envelope. It used to look only at
  // `data.detail`, which this backend never sends — so every sign-in and
  // sign-up failure showed the fallback instead of the reason.
  return apiErrorMessage(err, "An unexpected error occurred.");
}
