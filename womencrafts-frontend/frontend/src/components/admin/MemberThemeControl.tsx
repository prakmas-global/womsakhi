"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Palette, RotateCcw } from "lucide-react";

import { DEFAULT_THEME, PRESETS, generateScale, type ThemeChoice } from "@/theme-engine";
import { apiMemberTheme, apiSetMemberTheme } from "@/lib/theme-api";
import { memberError } from "@/lib/member-api";
import { useToast } from "@/design-system";

/**
 * Set a member's colours for her.
 *
 * For support calls — someone who can't find the picker, or can't read the
 * screen well enough to use it. Deliberately presets only: choosing a custom
 * colour on someone else's behalf is a decision to make with her, not for her.
 *
 * She is always notified when this happens. Silently changing how a person's
 * app looks is the kind of thing that makes people distrust software.
 */
export default function MemberThemeControl({
  memberId,
  memberName,
}: {
  memberId: string;
  memberName: string;
}) {
  const toast = useToast();
  const [theme, setTheme] = useState<ThemeChoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTheme(await apiMemberTheme(memberId));
      setError("");
    } catch (err) {
      setError(memberError(err));
    } finally {
      setLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply(next: ThemeChoice) {
    setSaving(next.id);
    setError("");
    try {
      setTheme(await apiSetMemberTheme(memberId, next));
      toast.success(`Applied — ${memberName.split(" ")[0]} has been told her colours changed`);
    } catch (err) {
      setError(memberError(err));
    } finally {
      setSaving("");
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
          <Palette className="h-4 w-4 text-ink-subtle" /> Her colours
        </h3>
        {theme &&
          (theme.primary !== DEFAULT_THEME.primary ||
            theme.secondary !== DEFAULT_THEME.secondary) && (
            <button
              onClick={() => apply(DEFAULT_THEME)}
              disabled={!!saving}
              className="flex items-center gap-1 text-xs font-semibold text-ink-subtle transition hover:text-ink-muted"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
      </div>

      {error && (
        <p className="mb-2 rounded-lg bg-status-danger-bg px-3 py-2 text-xs text-status-danger-ink">{error}</p>
      )}

      {loading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-surface-inset dark:bg-white/5" />
          ))}
        </div>
      ) : (
        <ul className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => {
            const active =
              theme?.primary === preset.primary && theme?.secondary === preset.secondary;
            const a = generateScale(preset.primary);
            const b = generateScale(preset.secondary);
            return (
              <li key={preset.id}>
                <button
                  onClick={() => apply(preset)}
                  disabled={!!saving}
                  title={preset.name}
                  aria-label={`Set ${memberName}'s colours to ${preset.name}`}
                  aria-pressed={active}
                  className={`w-full rounded-xl border p-1.5 transition disabled:opacity-60 ${
                    active
                      ? "border-transparent ring-2 ring-brand-500"
                      : "border-line-strong hover:border-line-strong dark:border-white/10"
                  }`}
                >
                  <span className="flex gap-1">
                    {[a[600], a[400], b[600]].map((c, i) => (
                      <span
                        key={i}
                        className="h-5 flex-1 rounded"
                        style={{ background: c }}
                        aria-hidden
                      />
                    ))}
                  </span>
                  <span className="mt-1 flex items-center justify-center gap-1 text-2xs font-semibold text-ink-muted">
                    {saving === preset.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : active ? (
                      <Check className="h-3 w-3 text-brand-ink" />
                    ) : null}
                    {preset.name}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-2 text-2xs leading-relaxed text-ink-subtle">
        Only use this if she&apos;s asked. She can change it herself any time under Appearance, and
        she gets a message whenever you change it here.
      </p>
    </div>
  );
}
