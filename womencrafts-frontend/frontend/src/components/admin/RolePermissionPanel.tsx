"use client";

import { useCallback, useEffect, useState } from "react";
import { Circle, CircleCheck, ChevronRight, Loader2 } from "lucide-react";

import {
  apiRolePermissions,
  apiSaveRolePermissions,
  type PermissionGroup,
  type RolePermissions,
} from "@/lib/permissions-api";
import { memberError } from "@/lib/member-api";
import { useToast } from "@/design-system";

/**
 * A role's granular permissions: expandable per module, one toggle per action.
 *
 * This lives in a component because the platform has TWO roles screens
 * (Users → User Roles, and Settings → Roles & Permissions). They previously
 * carried separate hand-written copies of this panel, which is exactly how one
 * ended up real and the other stayed a fixed array with chevrons that expanded
 * nothing. One implementation, used twice, can't drift.
 */
export default function RolePermissionPanel({
  roleId,
  canEdit,
  onSaved,
}: {
  roleId: string;
  /** Only a Super Admin may change permissions; everyone else sees them read-only. */
  canEdit: boolean;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [data, setData] = useState<RolePermissions | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const grantedKeys = (d: RolePermissions) =>
    new Set(d.groups.flatMap((g) => g.actions.filter((a) => a.granted).map((a) => a.key)));

  const load = useCallback(async () => {
    if (!roleId) return;
    setLoading(true);
    try {
      const fresh = await apiRolePermissions(roleId);
      setData(fresh);
      setDraft(grantedKeys(fresh));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [roleId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = !canEdit || !!data?.is_super_admin;
  const dirty =
    !!data &&
    (draft.size !== grantedKeys(data).size ||
      [...draft].some((k) => !grantedKeys(data).has(k)));

  /** Mirrors the server's rule: any action implies view, and losing view loses the module. */
  function toggleAction(key: string) {
    const [module, action] = key.split(".");
    setDraft((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (action === "view") {
          [...next].filter((k) => k.startsWith(`${module}.`)).forEach((k) => next.delete(k));
        }
      } else {
        next.add(key);
        next.add(`${module}.view`);
      }
      return next;
    });
  }

  function toggleModule(group: PermissionGroup) {
    const keys = group.actions.map((a) => a.key);
    const allOn = keys.every((k) => draft.has(k));
    setDraft((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError("");
    try {
      const fresh = await apiSaveRolePermissions(data.role_id, [...draft]);
      setData(fresh);
      setDraft(grantedKeys(fresh));
      toast.success("Permissions saved");
      onSaved?.();
    } catch (err) {
      setError(memberError(err));
    } finally {
      setSaving(false);
    }
  }

  const everyKey = (data?.groups ?? []).flatMap((g) => g.actions.map((a) => a.key));
  const allGranted = everyKey.length > 0 && everyKey.every((k) => draft.has(k));

  return (
    <div>
      <div className="mt-5 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink">
          Permissions ({draft.size} / {data?.total ?? 0})
        </h3>
        {!locked && (
          <button
            className="text-xs font-semibold text-brand-ink hover:underline"
            onClick={() => {
              setDraft(new Set(allGranted ? [] : everyKey));
            }}
          >
            {allGranted ? "Clear all" : "Grant all"}
          </button>
        )}
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{error}</p>
      )}

      {data?.is_super_admin && (
        <p className="mt-2 rounded-lg bg-violet-tint px-3 py-2 text-xs text-violet-ink">
          Super Admin always holds every permission. It is the way back in when another role is
          misconfigured, so it cannot be reduced.
        </p>
      )}

      {loading ? (
        <div className="mt-3 space-y-1.5">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg bg-surface-inset dark:bg-white/5" />
          ))}
        </div>
      ) : (
        <ul className="mt-3 space-y-1">
          {(data?.groups ?? []).map((g) => {
            const on = g.actions.filter((a) => draft.has(a.key)).length;
            const expanded = open[g.module] ?? false;
            return (
              <li key={g.module}>
                <div className="flex items-center gap-2 rounded-lg px-1 py-2 text-sm hover:bg-surface-hover dark:hover:bg-white/5">
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [g.module]: !expanded }))}
                    aria-expanded={expanded}
                    aria-label={`${expanded ? "Collapse" : "Expand"} ${g.label}`}
                    className="flex min-w-0 flex-1 items-center gap-2 text-start"
                  >
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${
                        expanded ? "rotate-90" : ""
                      }`}
                    />
                    <span className="truncate text-ink-muted">{g.label}</span>
                  </button>

                  <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-ink-subtle">
                    {on === g.total ? (
                      <CircleCheck className="h-4 w-4 text-status-ok-ink" />
                    ) : (
                      <Circle className="h-4 w-4 text-ink-faint" />
                    )}
                    {on} / {g.total}
                  </span>

                  <button
                    type="button"
                    aria-label={`Toggle every permission in ${g.label}`}
                    disabled={locked}
                    onClick={() => toggleModule(g)}
                    className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${
                      on > 0 ? "bg-brand-600" : "bg-line-strong dark:bg-white/15"
                    }`}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-surface shadow transition-transform ${
                        on > 0 ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </div>

                {expanded && (
                  <ul className="mb-1 ms-6 space-y-0.5 border-s border-line ps-3 dark:border-white/10">
                    {g.actions.map((a) => {
                      const granted = draft.has(a.key);
                      return (
                        <li
                          key={a.key}
                          className="flex items-center gap-2 rounded-lg px-1 py-1.5 text-xsm"
                        >
                          <span className={granted ? "text-ink-muted" : "text-ink-subtle"}>
                            {a.label}
                          </span>
                          <code className="truncate text-2xs text-ink-faint">{a.key}</code>
                          <button
                            type="button"
                            aria-label={`${granted ? "Revoke" : "Grant"} ${a.label} in ${g.label}`}
                            disabled={locked}
                            onClick={() => toggleAction(a.key)}
                            className={`ms-auto flex h-4 w-8 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-60 ${
                              granted ? "bg-status-ok-solid" : "bg-line-strong dark:bg-white/15"
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full bg-surface shadow transition-transform ${
                                granted ? "translate-x-4" : ""
                              }`}
                            />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!locked && data && (
        <button
          className="btn btn-primary btn-block mt-3"
          onClick={save}
          disabled={saving || !dirty}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving…
            </>
          ) : dirty ? (
            "Save permissions"
          ) : (
            "No changes"
          )}
        </button>
      )}
    </div>
  );
}
