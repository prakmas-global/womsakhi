"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronRight, Loader2, Minus, Plus, RotateCcw, ShieldCheck } from "lucide-react";

import { Modal, useToast } from "@/design-system";
import { apiClient } from "@/lib/api";
import { memberError } from "@/lib/member-api";
import { apiSetStaffAccess, type StaffAccount } from "@/lib/staff-accounts-api";

/**
 * What one person can do, as distinct from what her role can do.
 *
 * ── Why per-person at all ───────────────────────────────────────────────────
 * Two people doing the same job often need different access: one Supervisor
 * also handles safety reports, another must never see them. Without this the
 * only way to express that is a new role per exception, until there are
 * fifteen roles and nobody can say what any of them mean.
 *
 * ── Three states, not a checkbox ────────────────────────────────────────────
 * A checkbox can only say yes or no, which loses the most useful fact: whether
 * an answer came from her role or was decided for her. So each action is one
 * of three:
 *
 *   inherited — whatever her role says. Changes if the role changes.
 *   granted   — given to her specifically, on top of her role.
 *   withheld  — taken from her specifically, whatever her role says.
 *
 * Withholding wins over granting on the server, and the panel refuses to send
 * both for the same action.
 *
 * A Super Admin has no panel: the role bypasses every check by design, so
 * toggles here would be decorative.
 */

type Cell = "inherited" | "granted" | "withheld";

interface CatalogueModule {
  module: string;
  label: string;
  actions: string[];
}

const ACTION_LABEL: Record<string, string> = {
  view: "View", create: "Create", edit: "Edit",
  delete: "Delete", export: "Export", approve: "Approve",
};

/** What each state looks like. Colour carries the meaning, never alone. */
const CELL_STYLE: Record<Cell, string> = {
  inherited: "border-line-strong bg-surface text-ink-subtle",
  granted: "border-emerald-300 bg-emerald-50 text-emerald-800",
  withheld: "border-rose-300 bg-rose-50 text-rose-800",
};

export default function StaffAccessPanel({
  staff, onClose, onSaved,
}: {
  staff: StaffAccount;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [modules, setModules] = useState<CatalogueModule[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [extra, setExtra] = useState<Set<string>>(new Set(staff.extra_permissions));
  const [denied, setDenied] = useState<Set<string>>(new Set(staff.denied_permissions));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<{ modules: CatalogueModule[] }>("/roles/catalogue/all")
      .then((r) => setModules(r.data.modules))
      .catch(() => setModules([]));
  }, []);

  /** Her role's own grant, worked back out of what she holds now. */
  const fromRole = useMemo(() => {
    const held = new Set(staff.permissions);
    const base = new Set<string>();
    for (const p of held) if (!extra.has(p)) base.add(p);
    for (const p of staff.denied_permissions) base.add(p);
    return base;
    // Computed once from the account as loaded; local edits must not change
    // what her ROLE says, only what is layered on top of it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff.permissions, staff.denied_permissions]);

  const stateOf = useCallback((key: string): Cell => {
    if (denied.has(key)) return "withheld";
    if (extra.has(key)) return "granted";
    return "inherited";
  }, [denied, extra]);

  /** Cycles inherited → granted → withheld → inherited. */
  const cycle = useCallback((key: string) => {
    const now = stateOf(key);
    const e = new Set(extra), d = new Set(denied);
    e.delete(key); d.delete(key);
    if (now === "inherited") e.add(key);
    else if (now === "granted") d.add(key);
    setExtra(e); setDenied(d);
  }, [denied, extra, stateOf]);

  const reset = useCallback(() => { setExtra(new Set()); setDenied(new Set()); }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await apiSetStaffAccess(staff.id, {
        extra_permissions: [...extra],
        denied_permissions: [...denied],
      });
      toast.success(`${staff.full_name}'s access updated`);
      onSaved();
    } catch (e) {
      toast.error("Could not save that", { description: memberError(e) });
    } finally {
      setSaving(false);
    }
  }, [denied, extra, onSaved, staff.full_name, staff.id, toast]);

  const changes = extra.size + denied.size;
  const isSuper = staff.role === "Super Admin";

  return (
    <Modal open onClose={onClose} title={`What ${staff.full_name} can do`} size="lg">
      {isSuper ? (
        <div className="flex items-start gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
          <div className="text-sm">
            <p className="font-semibold text-violet-900">She is a Super Admin</p>
            <p className="mt-0.5 text-violet-800">
              A Super Admin can do everything, by design — it is the way back in when a permission
              set is misconfigured. Nothing can be withheld from her. To narrow her access, give her
              a different role first.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-ink-muted">
            She is a <b className="text-ink">{staff.role}</b>. Tap an action to change it for her
            alone — once to <b className="text-emerald-700">grant</b> it, again to{" "}
            <b className="text-rose-700">withhold</b> it, again to go back to what her role says.
          </div>

          {modules === null ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-ink-subtle" />
            </div>
          ) : (
            <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
              {modules.map((m) => {
                const expanded = open === m.module;
                const adjusted = m.actions.filter((a) => stateOf(`${m.module}.${a}`) !== "inherited").length;
                const held = m.actions.filter((a) => {
                  const k = `${m.module}.${a}`;
                  return stateOf(k) === "granted" || (stateOf(k) === "inherited" && fromRole.has(k));
                }).length;
                return (
                  <div key={m.module} className="rounded-xl border border-line">
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : m.module)}
                      className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
                    >
                      <ChevronRight
                        className={`h-4 w-4 shrink-0 text-ink-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
                      />
                      <span className="flex-1 text-sm font-semibold text-ink">{m.label}</span>
                      {adjusted > 0 && (
                        <span className="rounded-full bg-brand-tint px-2 py-0.5 text-2xs font-bold text-brand-ink">
                          {adjusted} changed
                        </span>
                      )}
                      <span className="text-xs tabular-nums text-ink-subtle">
                        {held} of {m.actions.length}
                      </span>
                    </button>
                    {expanded && (
                      <div className="flex flex-wrap gap-2 border-t border-line px-3.5 py-3">
                        {m.actions.map((a) => {
                          const key = `${m.module}.${a}`;
                          const st = stateOf(key);
                          const inherited = fromRole.has(key);
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => cycle(key)}
                              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${CELL_STYLE[st]}`}
                              title={
                                st === "granted" ? "Granted to her specifically"
                                : st === "withheld" ? "Withheld from her specifically"
                                : inherited ? `Her role allows this` : `Her role does not allow this`
                              }
                            >
                              {st === "granted" && <Plus className="h-3 w-3" />}
                              {st === "withheld" && <Minus className="h-3 w-3" />}
                              {ACTION_LABEL[a] ?? a}
                              {st === "inherited" && (
                                <span className="font-normal opacity-70">
                                  {inherited ? "· yes" : "· no"}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
            <button
              className="btn btn-sm btn-ghost"
              onClick={reset}
              disabled={changes === 0}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Back to her role
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-subtle">
                {changes === 0 ? "Nothing changed for her" : `${changes} changed for her`}
              </span>
              <button className="btn btn-outline" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
