"use client";

import { useCallback } from "react";

import { useAuth } from "@/context/AuthContext";
import { useResource } from "@/lib/use-resource";
import { useShell } from "./ShellProvider";
import { apiUnreadCounts } from "@/lib/member-api";
import { apiProgress } from "@/lib/me-api";

import { ME as RAW_ME } from "./home/data";
import { useTranslated } from "@/i18n/data";

/**
 * The signed-in woman, from her account rather than from a fixture.
 *
 * Nine screens greeted her as "Ananya Sharma" because `ME` was a module
 * constant. The session already knows who she is — `AuthContext` holds the
 * record `/auth/session` returned — so her name and photograph cost nothing;
 * the only things worth a request are the two numbers that change while she is
 * looking at the app: her unread count and how complete her profile is.
 *
 * The mock stays as the shape and as the fallback, so a screen rendered before
 * the session resolves shows a plausible person rather than "undefined".
 */
export interface Me {
  first: string;
  name: string;
  tagline: string;
  avatar: string;
  verified: boolean;
  profilePct: number;
  unread: number;
}

export function useMe(): Me {
  const ME = useTranslated(RAW_ME);
  const { user } = useAuth();

  // Live where the session has it, the fixture where it does not — never a
  // blank, because a greeting with a hole in it is worse than a generic one.
  const name = (user?.full_name || "").trim();
  // One request for the whole shell when it is available — see ShellProvider.
  // These two calls are what it replaces; they stay as the fallback for a
  // member `/me/shell` will not serve (she is still in verification), because
  // a batching win is not worth a blank greeting for the women waiting.
  const shell = useShell();

  const { data: extra } = useResource(
    useCallback(async (s: AbortSignal) => {
      // Still on its way — return the defaults rather than firing the two
      // requests the batch is about to make unnecessary. Without this the
      // fallback raced the batch and both went out.
      if (shell.status === "loading") {
        return { unread: ME.unread, profilePct: ME.profilePct };
      }
      if (shell.status === "ready" && shell.data) {
        const u = shell.data.unread;
        return {
          unread: u ? u.notifications + u.messages : ME.unread,
          profilePct:
            Math.min(100, Math.round(shell.data.progress?.completion_rate ?? 0)) || ME.profilePct,
        };
      }
      const [unread, progress] = await Promise.all([
        apiUnreadCounts().catch(() => null),
        apiProgress(s).catch(() => null),
      ]);
      return {
        // Both, because the bell in the topbar covers both: a woman with two
        // unread messages and no notifications must not see a bell with no
        // number on it.
        unread: unread ? unread.notifications + unread.messages : ME.unread,
        // Profile completeness is a real percentage the server already
        // computes for her journey screen; recomputing it here from a
        // different set of fields would give two different answers to the
        // same question on two screens.
        // `completion_rate` is ALREADY a percentage — 100 means 100%. The
        // `* 100` turned it into 10000, and "10000% completed" was rendered in
        // the rail of every screen in the app.
        profilePct: progress ? Math.min(100, Math.round(progress.completion_rate ?? 0)) || ME.profilePct
                             : ME.profilePct,
      };
    }, [shell.status, shell.data]),
    { unread: ME.unread, profilePct: ME.profilePct },
  );

  return {
    first: name.split(" ")[0] || ME.first,
    name: name || ME.name,
    tagline: ME.tagline,
    avatar: user?.avatar || ME.avatar,
    verified: user?.verification_status === "active",
    profilePct: extra.profilePct,
    unread: extra.unread,
  };
}
