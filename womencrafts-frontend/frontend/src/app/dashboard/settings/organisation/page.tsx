"use client";

import { useCallback, useEffect, useState } from "react";
import { Building2, CheckCircle2, Clock, Globe, Layers, Palette, Trash2, XCircle } from "lucide-react";

import PageHeader from "@/components/layout/PageHeader";
import { Alert, Badge, Button, Card, Input, Select, Skeleton, type Tone } from "@/design-system";
import { ResizableColumns } from "@/layout-engine";
import { useLayoutEngine } from "@/layout-engine";
import { PRESETS } from "@/theme-engine";
import {
  apiApplyOrgTemplate,
  apiCreateOrgTemplate,
  apiDeleteOrgTemplate,
  apiOrgSettings,
  apiOrgTemplates,
  apiSetBranding,
  apiSetDefaultTheme,
  apiSetDomain,
  apiVerifyDomain,
  type OrgLayoutTemplate,
  type OrgSettings,
} from "@/lib/org-api";

/**
 * The `org.*` tier, in one screen.
 *
 * Four features that a licence buys: the organisation's own marks, the palette
 * new accounts start from, layout templates pushed to a role, and a custom
 * domain.
 *
 * **The lock is not here.** Every write is refused server-side unless the caller
 * is a Super Admin *and* the installation holds the entitlement. This screen
 * reads the same flags only to explain why a control is disabled — a disabled
 * button is a courtesy, not a security boundary.
 */

const DOMAIN_TONE: Record<OrgSettings["domain_status"], { tone: Tone; label: string }> = {
  unset: { tone: "slate", label: "Not set" },
  pending: { tone: "amber", label: "Awaiting DNS" },
  verified: { tone: "emerald", label: "Verified" },
  failed: { tone: "rose", label: "Not found" },
};

export default function OrganisationPage() {
  const { features } = useLayoutEngine();
  const [org, setOrg] = useState<OrgSettings | null>(null);
  const [templates, setTemplates] = useState<OrgLayoutTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const may = (key: string) => !!features[key];

  const load = useCallback(async () => {
    try {
      setOrg(await apiOrgSettings());
      if (features["org.layout_templates"]) {
        setTemplates(await apiOrgTemplates().catch(() => []));
      }
      setError("");
    } catch {
      setError("Could not load organisation settings.");
    } finally {
      setLoading(false);
    }
  }, [features]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(work: () => Promise<OrgSettings | void>, done: string) {
    setNote("");
    setError("");
    try {
      const next = await work();
      if (next) setOrg(next);
      setNote(done);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail || "That didn't work.");
    }
  }

  if (loading) return <Skeleton className="h-96" />;
  if (!org) return <Alert variant="danger">{error || "Unavailable."}</Alert>;

  const licensed = may("org.branding") || may("org.default_theme")
    || may("org.layout_templates") || may("org.custom_domain");

  return (
    <div>
      <PageHeader
        title="Organisation"
        subtitle="Branding, the palette new accounts start from, layout templates and your own domain."
      />

      {!licensed && (
        // Said plainly and once. A feature that is simply missing, with no
        // explanation, reads as a bug — and someone goes looking for it.
        <Alert variant="info" className="mt-4">
          This installation is on the free plan. Everything personal — themes, text
          size, layout — is free and already on for everyone. The settings below
          are organisation-level and need a licence.
        </Alert>
      )}
      {note && <Alert variant="success" className="mt-4">{note}</Alert>}
      {error && <Alert variant="danger" className="mt-4">{error}</Alert>}

      <ResizableColumns id="settings-organisation" defaultSize={0.62} className="mt-6 gap-6">
        <div className="space-y-6">
          {/* org.branding */}
          <Card>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
              <Building2 className="h-4 w-4 text-brand-ink" /> Branding
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              Your name and marks, shown in place of WomSakhi&apos;s.
            </p>
            <fieldset disabled={!may("org.branding")} className="mt-4 space-y-3 disabled:opacity-60">
              <Input
                label="Organisation name"
                value={org.name}
                onChange={(e) => setOrg({ ...org, name: e.target.value })}
              />
              <Input
                label="Logo URL"
                hint="Upload an image anywhere in the app, then paste its address here."
                value={org.logo}
                onChange={(e) => setOrg({ ...org, logo: e.target.value })}
              />
              <Input
                label="Wordmark URL"
                value={org.wordmark}
                onChange={(e) => setOrg({ ...org, wordmark: e.target.value })}
              />
              <Button
                onClick={() =>
                  run(() => apiSetBranding({ name: org.name, logo: org.logo, wordmark: org.wordmark }),
                      "Branding saved.")
                }
              >
                Save branding
              </Button>
            </fieldset>
          </Card>

          {/* org.default_theme */}
          <Card>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
              <Palette className="h-4 w-4 text-brand-ink" /> Default palette
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              What a new account starts from. Anyone who has already chosen a theme keeps it.
            </p>
            <fieldset disabled={!may("org.default_theme")} className="mt-4 space-y-3 disabled:opacity-60">
              <Select
                label="Theme"
                value={org.default_theme_id}
                onChange={(e) => setOrg({ ...org, default_theme_id: e.target.value })}
                options={[
                  { value: "", label: "No default — use WomSakhi's" },
                  ...PRESETS.map((p) => ({ value: p.id, label: p.name })),
                ]}
              />
              <Select
                label="Default mode"
                value={org.default_mode}
                onChange={(e) => setOrg({ ...org, default_mode: e.target.value })}
                options={[
                  { value: "", label: "Follow the device" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ]}
              />
              <Button
                onClick={() => {
                  const preset = PRESETS.find((p) => p.id === org.default_theme_id);
                  return run(() => apiSetDefaultTheme({
                    theme_id: org.default_theme_id,
                    primary: preset?.primary ?? "",
                    secondary: preset?.secondary ?? "",
                    mode: (org.default_mode || "") as "" | "light" | "dark",
                  }), "Default palette saved.");
                }}
              >
                Save palette
              </Button>
            </fieldset>
          </Card>
        </div>

        <div className="space-y-6">
          {/* org.custom_domain */}
          <Card>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
              <Globe className="h-4 w-4 text-brand-ink" /> Custom domain
            </h2>
            <div className="mt-2">
              <Badge tone={DOMAIN_TONE[org.domain_status].tone}>
                {DOMAIN_TONE[org.domain_status].label}
              </Badge>
            </div>
            <fieldset disabled={!may("org.custom_domain")} className="mt-3 space-y-3 disabled:opacity-60">
              <Input
                label="Domain"
                placeholder="example.org"
                value={org.domain}
                onChange={(e) => setOrg({ ...org, domain: e.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => run(() => apiSetDomain(org.domain), "Domain saved.")}>
                  Save domain
                </Button>
                <Button
                  variant="outline"
                  disabled={!org.domain_token}
                  onClick={() => run(() => apiVerifyDomain(), "Checked DNS.")}
                >
                  Check DNS
                </Button>
              </div>
            </fieldset>

            {org.domain_token && (
              <div className="wc-inset mt-3 rounded-xl p-3">
                <p className="text-xs font-semibold text-ink-muted">
                  Add this as a TXT record on {org.domain || "your domain"}:
                </p>
                <code className="mt-1 block break-all text-2xs text-ink-subtle">
                  {org.domain_token}
                </code>
                <p className="mt-2 flex items-center gap-1.5 text-2xs text-ink-subtle">
                  {org.domain_status === "verified" ? (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Found. The domain is yours.</>
                  ) : org.domain_status === "failed" ? (
                    <><XCircle className="h-3.5 w-3.5" /> Not found yet — DNS can take a while.</>
                  ) : (
                    <><Clock className="h-3.5 w-3.5" /> Waiting to be checked.</>
                  )}
                </p>
              </div>
            )}
          </Card>

          {/* org.layout_templates */}
          <Card>
            <h2 className="flex items-center gap-2 font-display text-base font-semibold text-ink">
              <Layers className="h-4 w-4 text-brand-ink" /> Layout templates
            </h2>
            <p className="mt-1 text-sm text-ink-subtle">
              Save your current arrangement and give it to a role as their starting point.
            </p>
            {may("org.layout_templates") ? (
              <>
                <TemplateForm
                  onCreate={async (name, role) => {
                    await apiCreateOrgTemplate({ name, role });
                    setTemplates(await apiOrgTemplates());
                    setNote("Template saved.");
                  }}
                />
                <ul className="mt-4 space-y-2">
                  {templates.length === 0 && (
                    <li className="text-sm text-ink-subtle">No templates yet.</li>
                  )}
                  {templates.map((t) => (
                    <li key={t.id} className="wc-soft flex items-center gap-2 rounded-xl p-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{t.name}</p>
                        <p className="text-2xs text-ink-subtle">
                          {t.role}
                          {t.applied_count > 0 && ` · given to ${t.applied_count}`}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          run(async () => {
                            const r = await apiApplyOrgTemplate(t.id);
                            setTemplates(await apiOrgTemplates());
                            setNote(r.message);
                          }, "")
                        }
                      >
                        Apply
                      </Button>
                      <button
                        aria-label={`Delete ${t.name}`}
                        className="btn-outline h-8 w-8 shrink-0 p-0"
                        onClick={() =>
                          run(async () => {
                            await apiDeleteOrgTemplate(t.id);
                            setTemplates(await apiOrgTemplates());
                          }, "Template deleted.")
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-3 text-sm text-ink-subtle">Included with an organisation licence.</p>
            )}
          </Card>
        </div>
      </ResizableColumns>
    </div>
  );
}

function TemplateForm({ onCreate }: { onCreate: (name: string, role: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="mt-4 space-y-2">
      <Input label="Template name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="Give it to this role"
        placeholder="e.g. Support Agent"
        value={role}
        onChange={(e) => setRole(e.target.value)}
      />
      <Button
        disabled={!name.trim() || !role.trim() || busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onCreate(name.trim(), role.trim());
            setName("");
            setRole("");
          } finally {
            setBusy(false);
          }
        }}
      >
        Save my current layout
      </Button>
    </div>
  );
}
