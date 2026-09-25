"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, MinusCircle, ShieldCheck, UserCog } from "lucide-react";
import Link from "next/link";
import { Alert, Badge, Card, Spinner } from "@/design-system";
import { useAuth } from "@/context/AuthContext";
import { apiMyRoles, MODULE_LABEL, type MyRoles } from "@/lib/staff-api";
import { memberError } from "@/lib/member-api";

/**
 * Your role.
 *
 * This screen used to offer "Switch to Role" buttons that changed a piece of
 * local state and toasted "Switched to Admin", while the account stayed
 * exactly what it was. An account here holds ONE role and only a Super Admin
 * can change it, from Staff — so there is nothing to switch, and the screen
 * says so.
 *
 * What it can honestly show is the role you hold, what it lets you open, and
 * the same for every other staff role — read from the roles collection, so
 * the matrix is what the server enforces rather than a drawing of it.
 */

export default function SwitchRolePage() {
  const { isSuperAdmin } = useAuth();
  const [data, setData] = useState<MyRoles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    apiMyRoles()
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(memberError(e)); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const roles = data ? [...data.roles].sort((a, b) => Number(b.is_mine) - Number(a.is_mine) || a.name.localeCompare(b.name)) : [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-tint text-brand-ink">
            <ShieldCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Your role</h1>
            <p className="mt-1 text-sm text-ink-subtle">
              The role this account holds, what it lets you open, and how that compares with the other staff roles.
            </p>
          </div>
        </div>
        {isSuperAdmin && (
          <Link href="/dashboard/staff" className="btn btn-secondary">
            <UserCog className="h-4 w-4" /> Change someone&apos;s role
          </Link>
        )}
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center py-16"><Spinner /></div>
      ) : data && (
        <>
          <Alert variant="info" className="mb-6">{data.note}</Alert>

          <Card>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div>
                <h2 className="mb-3 font-display text-base font-semibold text-ink">Current role</h2>
                <div className="rounded-2xl border border-violet-100 bg-linear-to-br from-violet-50 to-white p-6 text-center dark:from-[var(--surface-hover)] dark:to-[var(--surface-inset)]">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-linear-to-br from-violet-500 to-violet-600 text-white shadow-sm shadow-violet-200">
                    <ShieldCheck className="h-8 w-8" />
                  </span>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="font-display text-lg font-bold text-ink">{data.current.name}</span>
                    <Badge tone="violet">Yours</Badge>
                  </div>
                  {data.current.desc && (
                    <p className="mx-auto mt-2 max-w-[15rem] text-sm text-ink-subtle">{data.current.desc}</p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="mb-3 font-display text-base font-semibold text-ink">
                  What you can open <span className="text-ink-subtle">({data.current.modules.length} of {data.all_modules.length} sections)</span>
                </h2>
                <div className="flex flex-wrap gap-2">
                  {data.all_modules.map((m) => {
                    const on = data.current.modules.includes(m);
                    return (
                      <span
                        key={m}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                          on ? "bg-status-ok-bg text-status-ok-ink" : "bg-surface-inset text-ink-subtle line-through"
                        }`}
                      >
                        {on ? <CheckCircle2 className="h-3.5 w-3.5" /> : <MinusCircle className="h-3.5 w-3.5" />}
                        {MODULE_LABEL[m] ?? m}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-ink-subtle">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  This is your actual access — your role&apos;s starting point plus anything a Super Admin granted or withheld for you.
                  Inside a section, what you may change is set per action on the Roles &amp; Permissions screen.
                </p>
              </div>
            </div>
          </Card>

          <Card className="mt-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-base font-semibold text-ink">What each role can open</h2>
                <p className="mt-1 text-sm text-ink-subtle">
                  Read from the roles the server enforces. A role marked inactive cannot be given to anyone.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-medium text-ink-muted">
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-status-ok-ink" /> Can open</span>
                <span className="flex items-center gap-1.5"><MinusCircle className="h-4 w-4 text-ink-faint" /> Cannot</span>
              </div>
            </div>

            {roles.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-subtle">No staff roles are defined yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left">
                  <thead>
                    <tr className="border-b border-line">
                      <th scope="col" className="px-3 py-3 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">Section</th>
                      {roles.map((r) => (
                        <th scope="col" key={r.name} className="px-3 py-3 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-xs font-semibold ${r.is_mine ? "text-violet-ink" : "text-ink-muted"}`}>{r.name}</span>
                            {r.is_mine
                              ? <Badge tone="violet">Yours</Badge>
                              : r.status !== "Active" && <Badge tone="slate">Inactive</Badge>}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.all_modules.map((m) => (
                      <tr key={m} className="text-sm hover:bg-surface-hover/60">
                        <td className="px-3 py-2.5 font-medium text-ink-muted">{MODULE_LABEL[m] ?? m}</td>
                        {roles.map((r) => (
                          <td key={r.name} className="px-3 py-2.5 text-center">
                            {r.modules.includes(m)
                              ? <CheckCircle2 className="mx-auto h-5 w-5 text-status-ok-ink" aria-label={`${r.name} can open ${MODULE_LABEL[m] ?? m}`} />
                              : <MinusCircle className="mx-auto h-5 w-5 text-ink-faint" aria-label={`${r.name} cannot open ${MODULE_LABEL[m] ?? m}`} />}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
