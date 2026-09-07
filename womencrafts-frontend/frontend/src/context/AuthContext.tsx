"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiSignIn, apiSignOut, apiSignUp, apiGetSession, AuthPayload, apiErrorMessage } from "@/lib/api";

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
  const [user, setUser] = useState<User | null>(initialUser);

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
      const payload = await apiSignUp(full_name, email, password, extra);
      persistAuth(payload);
      router.push(homeFor(payload.user));
    },
    [router]
  );

  const signIn = useCallback(
    async (email: string, password: string) => {
      const payload = await apiSignIn(email, password);
      persistAuth(payload);
      router.push(homeFor(payload.user));
    },
    [router]
  );

  const signOut = useCallback(async () => {
    // Only the server can clear an httpOnly cookie — that is the point of it.
    try {
      await apiSignOut();
    } catch {
      /* sign out locally regardless */
    }
    setUser(null);
    router.push("/signin");
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
