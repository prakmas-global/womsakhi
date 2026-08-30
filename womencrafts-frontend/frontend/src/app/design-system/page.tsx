"use client";

import { useState } from "react";
import {
  Bell,
  Check,
  Download,
  Mail,
  Plus,
  Search,
  Trash2,
  User,
  Users,
} from "lucide-react";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  Checkbox,
  DataTable,
  EmptyState,
  ErrorState,
  IconButton,
  ImageUpload,
  Input,
  Menu,
  MenuItem,
  Modal,
  Pagination,
  ProgressBar,
  SearchInput,
  Select,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  Spinner,
  StatCard,
  Switch,
  Tabs,
  Textarea,
  ThemeToggle,
  Thumb,
  Tooltip,
  TOKEN_GROUPS,
  createColumns,
  useAppForm,
  type Tone, useToast } from "@/design-system";

import {
  ColorSwatch,
  Demo,
  FontSwatch,
  RadiusSwatch,
  Section,
  ShadowSwatch,
} from "./parts";

/* ------------------------------------------------------------------ */
/* Demo data                                                           */
/* ------------------------------------------------------------------ */

type DemoRow = { id: string; name: string; role: string; status: string; engagement: number };

const DEMO_ROWS: DemoRow[] = [
  { id: "1", name: "Priya Sharma", role: "Member", status: "Active", engagement: 82 },
  { id: "2", name: "Aisha Khan", role: "Instructor", status: "Active", engagement: 74 },
  { id: "3", name: "Neha Patel", role: "Member", status: "Pending", engagement: 55 },
  { id: "4", name: "Sneha Joshi", role: "Supervisor", status: "Active", engagement: 91 },
  { id: "5", name: "Pooja Verma", role: "Instructor", status: "Inactive", engagement: 38 },
];

const STATUS_TONE: Record<string, Tone> = {
  Active: "emerald",
  Pending: "amber",
  Inactive: "rose",
};

const col = createColumns<DemoRow>();
const DEMO_COLUMNS = col.columns([
  col.accessor("name", {
    header: "Member",
    cell: ({ getValue }) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={getValue()} size="sm" />
        <span className="font-medium text-ink">{getValue()}</span>
      </span>
    ),
  }),
  col.accessor("role", { header: "Role" }),
  col.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <Badge tone={STATUS_TONE[getValue()] ?? "slate"}>{getValue()}</Badge>,
  }),
  col.accessor("engagement", {
    header: "Engagement",
    cell: ({ getValue }) => (
      <span className="flex items-center gap-2">
        <ProgressBar value={getValue()} className="w-24" />
        <span className="text-xs text-ink-subtle">{getValue()}%</span>
      </span>
    ),
  }),
]);

const NAV = [
  { id: "foundations", label: "Foundations" },
  { id: "colour", label: "Colour" },
  { id: "elevation", label: "Elevation & radius" },
  { id: "typography", label: "Typography" },
  { id: "buttons", label: "Buttons" },
  { id: "forms", label: "Form controls" },
  { id: "tanstack-form", label: "Forms (TanStack)" },
  { id: "data-display", label: "Data display" },
  { id: "datatable", label: "DataTable (TanStack)" },
  { id: "feedback", label: "Feedback & states" },
  { id: "overlays", label: "Overlays" },
];

export default function DesignSystemPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [tab, setTab] = useState("Overview");
  const [page, setPage] = useState(3);
  const [checked, setChecked] = useState(true);
  const [toggled, setToggled] = useState(true);
  const [search, setSearch] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [selectValue, setSelectValue] = useState("Member");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // A real, working TanStack Form — not a mock-up.
  const demoForm = useAppForm({
    defaultValues: { full_name: "", email: "", role: "Member", notify: true },
    validators: {
      onSubmit: ({ value }: { value: { full_name: string; email: string } }) => {
        const fields: Record<string, string> = {};
        if (!value.full_name.trim()) fields.full_name = "Name is required";
        if (!value.email.includes("@")) fields.email = "Enter a valid email address";
        return Object.keys(fields).length ? { fields } : undefined;
      },
    },
    onSubmit: async ({ value }: { value: unknown }) => {
      // The last window.alert in the app. It blocked the main thread, could
      // not be themed, and appeared in the browser's language rather than the
      // one the reader chose — on the page that demonstrates the design system.
      toast.success("Form submitted", { description: JSON.stringify(value) });
    },
  });

  return (
    <div className="min-h-screen">
      {/* header */}
      <header className="wc-shell-top sticky top-0 z-40 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tracking-tight text-brand-gradient">
              WomSakhi Design System
            </p>
            <p className="truncate text-xs text-ink-subtle">
              One source of truth for every colour, component and interaction
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={() => (window.location.href = "/dashboard")}>
              Back to app
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-8 px-6 py-8">
        {/* side nav */}
        <nav className="sticky top-24 hidden h-fit w-48 shrink-0 lg:block">
          <ul className="space-y-1">
            {NAV.map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  className="block rounded-lg px-3 py-1.5 text-sm font-medium text-ink-subtle transition hover:bg-brand-tint hover:text-brand-ink"
                >
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 space-y-14">
          {/* ---------------- foundations ---------------- */}
          <Section
            id="foundations"
            title="How this works"
            description="Every screen imports from @/design-system and nothing else. Colours, spacing, elevation and radii come from CSS tokens defined once in design-system/tokens.css — change a value there and it changes everywhere, in both themes."
          >
            <Alert variant="info" title="Values on this page are read live from the browser">
              Nothing here is a hardcoded copy of the palette. Each swatch resolves its CSS custom
              property from the running document, so this page can never drift out of sync with the
              stylesheet. Toggle the theme above and every value updates.
            </Alert>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card soft>
                <p className="font-display text-sm font-bold text-ink">Tokens</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  <code className="font-mono">design-system/tokens.css</code> — colour, elevation,
                  radius, typography. The only file with raw hex values.
                </p>
              </Card>
              <Card soft>
                <p className="font-display text-sm font-bold text-ink">Primitives</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  <code className="font-mono">design-system/primitives</code> — every component,
                  styled purely from tokens.
                </p>
              </Card>
              <Card soft>
                <p className="font-display text-sm font-bold text-ink">Logic</p>
                <p className="mt-1 text-xs text-ink-subtle">
                  TanStack Table, Form and Query supply table, form and server state under the
                  design-system surface.
                </p>
              </Card>
            </div>
          </Section>

          {/* ---------------- colour ---------------- */}
          <Section
            id="colour"
            title="Colour"
            description="Brand magenta leads, royal purple supports, deep indigo carries text. Surfaces are warm bone on a pink-lavender canvas."
          >
            {TOKEN_GROUPS.filter((g) => g.render === "color").map((group) => (
              <Demo key={group.id} title={group.title} note={group.description}>
                <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.tokens.map((t) => (
                    <ColorSwatch key={t.name} name={t.name} usage={t.usage} />
                  ))}
                </div>
              </Demo>
            ))}
          </Section>

          {/* ---------------- elevation & radius ---------------- */}
          <Section
            id="elevation"
            title="Elevation & radius"
            description="Depth is neumorphic: a mauve-tinted shade plus a white highlight. Radius tokens are namespaced --wc-* so they never collide with Tailwind's own rounded-* scale."
          >
            {TOKEN_GROUPS.filter((g) => g.render === "shadow" || g.render === "radius").map((group) => (
              <Demo key={group.id} title={group.title} note={group.description}>
                <div className="grid w-full gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.tokens.map((t) =>
                    group.render === "shadow" ? (
                      <ShadowSwatch key={t.name} name={t.name} usage={t.usage} />
                    ) : (
                      <RadiusSwatch key={t.name} name={t.name} usage={t.usage} />
                    )
                  )}
                </div>
              </Demo>
            ))}
          </Section>

          {/* ---------------- typography ---------------- */}
          <Section
            id="typography"
            title="Typography"
            description="Poppins for display, Inter for everything else."
          >
            <Demo title="Families">
              <div className="w-full space-y-6">
                {TOKEN_GROUPS.find((g) => g.id === "typography")?.tokens.map((t) => (
                  <FontSwatch key={t.name} name={t.name} usage={t.usage} />
                ))}
              </div>
            </Demo>
            <Demo title="Scale" note="Headings use font-display; body copy uses font-sans.">
              <div className="w-full space-y-3">
                <p className="font-display text-3xl font-bold text-ink">Display / 3xl bold</p>
                <p className="font-display text-2xl font-bold text-ink">Page title / 2xl bold</p>
                <p className="font-display text-base font-bold text-ink">Card heading / base bold</p>
                <p className="text-sm text-ink-muted">Body / sm — the default for most content.</p>
                <p className="text-xs text-ink-subtle">Meta / xs — timestamps, hints, captions.</p>
              </div>
            </Demo>
          </Section>

          {/* ---------------- buttons ---------------- */}
          <Section
            id="buttons"
            title="Buttons"
            description="One primary action per screen. Outline for utility actions, danger only for destructive ones."
          >
            <Demo
              title="Variants"
              code={`<Button>Save changes</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="outline">Cancel</Button>
<Button variant="danger" icon={Trash2}>Delete</Button>
<Button variant="ghost">Learn more</Button>`}
            >
              <Button icon={Check}>Save changes</Button>
              <Button variant="secondary" icon={Plus}>
                Secondary
              </Button>
              <Button variant="outline">Cancel</Button>
              <Button variant="danger" icon={Trash2}>
                Delete
              </Button>
              <Button variant="ghost">Learn more</Button>
            </Demo>

            <Demo title="Sizes, loading and icon-only" code={`<Button loading>Saving…</Button>
<IconButton icon={Download} label="Export" />`}>
              <Button size="sm">Small</Button>
              <Button>Medium</Button>
              <Button loading>Saving…</Button>
              <Button disabled>Disabled</Button>
              <IconButton icon={Download} label="Export" />
              <IconButton icon={Trash2} label="Delete" variant="danger" />
            </Demo>
          </Section>

          {/* ---------------- form controls ---------------- */}
          <Section
            id="forms"
            title="Form controls"
            description="All controls share one inset surface, one label style and one error treatment."
          >
            <Demo title="Text, select and textarea">
              <div className="grid w-full gap-4 sm:grid-cols-2">
                <Input label="Full name" icon={User} required placeholder="Enter full name" />
                <Input
                  label="Email"
                  icon={Mail}
                  type="email"
                  placeholder="name@example.com"
                  hint="We'll never share this."
                />
                <Select
                  label="Role"
                  options={["Member", "Instructor", "Supervisor", "Admin"]}
                  value={selectValue}
                  onChange={(e) => setSelectValue(e.target.value)}
                />
                <Input label="With an error" defaultValue="not-an-email" error="Enter a valid email address" />
                <Textarea
                  label="Description"
                  className="sm:col-span-2"
                  placeholder="Short description…"
                />
              </div>
            </Demo>

            <Demo title="Search, checkbox and switch">
              <div className="w-full space-y-4">
                <SearchInput value={search} onChange={setSearch} placeholder="Search members…" />
                <div className="flex flex-wrap items-center gap-6">
                  <Checkbox checked={checked} onChange={setChecked} label="Checked" />
                  <Checkbox checked={false} onChange={() => {}} label="Unchecked" />
                  <Checkbox checked={false} indeterminate onChange={() => {}} label="Indeterminate" />
                </div>
                <Switch
                  label="Send welcome email"
                  description="Email the user account setup instructions."
                  checked={toggled}
                  onChange={setToggled}
                />
              </div>
            </Demo>

            <Demo title="Image upload" note="Drag and drop, live progress, replace and remove. Posts to /api/v1/uploads.">
              <div className="w-full space-y-6">
                <ImageUpload
                  variant="avatar"
                  kind="avatar"
                  name="Priya Sharma"
                  label="Profile photo"
                  value={avatarUrl}
                  onChange={setAvatarUrl}
                />
                <ImageUpload variant="cover" kind="cover" label="Cover image" value={null} onChange={() => {}} />
              </div>
            </Demo>
          </Section>

          {/* ---------------- TanStack Form ---------------- */}
          <Section
            id="tanstack-form"
            title="Forms — TanStack Form"
            description="TanStack Form is headless: it owns values, validation and submission state, and renders nothing. The design system binds it to the controls above once, so a screen never wires an input by hand."
          >
            <Demo
              title="A working form"
              note="Submit with an empty name or a bad email to see validation. This is live, not a screenshot."
              code={`const form = useAppForm({
  defaultValues: { full_name: "", email: "", role: "Member", notify: true },
  validators: {
    onSubmit: ({ value }) => {
      const fields = {};
      if (!value.full_name.trim()) fields.full_name = "Name is required";
      if (!value.email.includes("@")) fields.email = "Enter a valid email address";
      return Object.keys(fields).length ? { fields } : undefined;
    },
  },
  onSubmit: async ({ value }) => { await apiCreateMember(value); },
});

<form onSubmit={(e) => { e.preventDefault(); form.handleSubmit(); }}>
  <form.AppField name="full_name">
    {(field) => <field.Text label="Full name" icon={User} required />}
  </form.AppField>
  <form.AppField name="email">
    {(field) => <field.Text label="Email" icon={Mail} type="email" required />}
  </form.AppField>
  <form.AppForm><form.SubmitButton>Add member</form.SubmitButton></form.AppForm>
</form>`}
            >
              <form
                className="w-full space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  demoForm.handleSubmit();
                }}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <demoForm.AppField name="full_name">
                    {(field) => <field.Text label="Full name" icon={User} required placeholder="Enter full name" />}
                  </demoForm.AppField>
                  <demoForm.AppField name="email">
                    {(field) => (
                      <field.Text label="Email" icon={Mail} type="email" required placeholder="name@example.com" />
                    )}
                  </demoForm.AppField>
                  <demoForm.AppField name="role">
                    {(field) => (
                      <field.Select label="Role" options={["Member", "Instructor", "Supervisor"]} />
                    )}
                  </demoForm.AppField>
                  <demoForm.AppField name="notify">
                    {(field) => (
                      <div className="flex items-end pb-0.5">
                        <field.Switch label="Send welcome email" />
                      </div>
                    )}
                  </demoForm.AppField>
                </div>
                <demoForm.AppForm>
                  <demoForm.SubmitButton icon={Plus}>Add member</demoForm.SubmitButton>
                </demoForm.AppForm>
              </form>
            </Demo>
          </Section>

          {/* ---------------- data display ---------------- */}
          <Section id="data-display" title="Data display">
            <Demo title="Badges" note="Tones are the semantic colour set — never pick a raw colour for a status chip.">
              {(["brand", "violet", "emerald", "amber", "sky", "rose", "blue", "fuchsia", "slate"] as Tone[]).map(
                (t) => (
                  <Badge key={t} tone={t}>
                    {t}
                  </Badge>
                )
              )}
            </Demo>

            <Demo title="Status dots" note="Use for inline status next to a label.">
              <Badge tone="emerald" dot>
                Published
              </Badge>
              <Badge tone="amber" dot>
                Scheduled
              </Badge>
              <Badge tone="rose" dot>
                Cancelled
              </Badge>
            </Demo>

            <Demo title="Stat cards">
              <div className="grid w-full gap-4 sm:grid-cols-3">
                <StatCard label="Total Users" value="8" icon={Users} tone="violet" delta="12.5%" />
                <StatCard label="Appointments" value="18" icon={Bell} tone="emerald" delta="8.3%" />
                <StatCard label="Inactive" value="1" icon={User} tone="rose" delta="3.1%" deltaDir="down" />
              </div>
            </Demo>

            <Demo title="Avatars and thumbnails">
              <Avatar name="Priya Sharma" size="xs" />
              <Avatar name="Aisha Khan" size="sm" />
              <Avatar name="Neha Patel" size="md" />
              <Avatar name="Sneha Joshi" size="lg" ring />
              <Thumb seed="handmade-bags" className="h-11 w-11 rounded-lg" />
              <Thumb seed="workshop" className="h-16 w-16 rounded-xl" />
            </Demo>

            <Demo title="Progress, tabs and pagination">
              <div className="w-full space-y-6">
                <div className="space-y-2">
                  <ProgressBar value={72} />
                  <ProgressBar value={38} color="var(--color-violet-600)" />
                </div>
                <Tabs
                  tabs={[
                    { value: "Overview", label: "Overview" },
                    { value: "Activity", label: "Activity", count: 12 },
                    { value: "Programs", label: "Programs", count: 3 },
                  ]}
                  value={tab}
                  onChange={setTab}
                />
                <Pagination
                  page={page}
                  pageCount={12}
                  onPageChange={setPage}
                  showing={`Showing page ${page} of 12`}
                />
              </div>
            </Demo>
          </Section>

          {/* ---------------- DataTable ---------------- */}
          <Section
            id="datatable"
            title="DataTable — TanStack Table"
            description="Every list screen renders through this one component, so sorting, filtering, paging, selection and empty states behave identically across the app. Click a column header to sort; type to filter."
          >
            <Demo
              title="Sortable, filterable, selectable"
              code={`const col = createColumns<Member>();
const columns = col.columns([
  col.accessor("name", { header: "Member" }),
  col.accessor("role", { header: "Role" }),
  col.accessor("status", {
    header: "Status",
    cell: ({ getValue }) => <Badge tone={STATUS_TONE[getValue()]}>{getValue()}</Badge>,
  }),
]);

<DataTable
  data={members}
  columns={columns}
  globalFilter={search}
  selectable
  getRowId={(r) => r.id}
  itemLabel="members"
/>`}
            >
              <div className="w-full">
                <DataTable
                  data={DEMO_ROWS}
                  columns={DEMO_COLUMNS}
                  globalFilter={tableSearch}
                  selectable
                  getRowId={(r) => r.id}
                  pageSize={4}
                  itemLabel="members"
                  toolbar={
                    <div className="mb-4">
                      <SearchInput
                        value={tableSearch}
                        onChange={setTableSearch}
                        placeholder="Filter members…"
                        className="max-w-xs"
                      />
                    </div>
                  }
                />
              </div>
            </Demo>

            <Demo title="Loading and empty states" note="The same component covers both — no per-page handling.">
              <div className="w-full space-y-8">
                <DataTable data={[]} columns={DEMO_COLUMNS} loading />
                <DataTable
                  data={[]}
                  columns={DEMO_COLUMNS}
                  emptyTitle="No members yet"
                  emptyDescription="Add your first member to get started."
                  emptyAction={<Button icon={Plus}>Add member</Button>}
                />
              </div>
            </Demo>
          </Section>

          {/* ---------------- feedback ---------------- */}
          <Section
            id="feedback"
            title="Feedback & states"
            description="Every screen needs four states: loading, empty, error and content. The system provides all four so none gets skipped."
          >
            <Demo title="Alerts">
              <div className="w-full space-y-3">
                <Alert variant="info" title="Heads up">
                  Uploaded images are capped at 5 MB.
                </Alert>
                <Alert variant="success" title="Saved">
                  Your changes have been published.
                </Alert>
                <Alert variant="warning" title="Check your filters">
                  No results match the current selection.
                </Alert>
                <Alert variant="danger" title="Couldn't save">
                  The server rejected the request. Try again.
                </Alert>
              </div>
            </Demo>

            <Demo title="Skeletons" note="Shaped like the content they replace, so nothing jumps when data lands.">
              <div className="grid w-full gap-6 sm:grid-cols-2">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <SkeletonText lines={3} />
                </div>
                <SkeletonCard />
              </div>
            </Demo>

            <Demo title="Empty and error states">
              <div className="grid w-full gap-4 lg:grid-cols-2">
                <Card padded={false}>
                  <EmptyState
                    icon={Search}
                    title="No results found"
                    description="Try a different search term or clear your filters."
                    action={<Button variant="outline" size="sm">Clear filters</Button>}
                  />
                </Card>
                <Card padded={false}>
                  <ErrorState onRetry={() => {}} />
                </Card>
              </div>
            </Demo>

            <Demo title="Spinner">
              <Spinner />
              <Spinner className="h-8 w-8" />
              <Button loading>Processing</Button>
            </Demo>
          </Section>

          {/* ---------------- overlays ---------------- */}
          <Section
            id="overlays"
            title="Overlays"
            description="Modals lock scroll and close on Esc or backdrop click. Menus close on outside click and on selection."
          >
            <Demo title="Modal and menu">
              <Button onClick={() => setModalOpen(true)}>Open modal</Button>
              <Menu trigger={<Button variant="outline">Row actions</Button>}>
                <MenuItem icon={User}>View details</MenuItem>
                <MenuItem icon={Mail}>Send message</MenuItem>
                <MenuItem icon={Trash2} danger>
                  Delete
                </MenuItem>
              </Menu>
              <Tooltip label="Exports the current view as CSV">
                <IconButton icon={Download} label="Export" />
              </Tooltip>
            </Demo>
          </Section>

          <footer className="border-t border-line pt-6 text-xs text-ink-subtle">
            Add a component here whenever you add one to{" "}
            <code className="font-mono">design-system/primitives</code> — a component that isn&apos;t
            documented is a component the next person will re-invent.
          </footer>
        </main>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add New User"
        description="Create a new platform user account."
        icon={Plus}
        iconTone="brand"
        footer={
          <>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button icon={Plus} onClick={() => setModalOpen(false)}>
              Add User
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <Input label="Full name" icon={User} required className="col-span-2" placeholder="Enter full name" />
          <Input label="Email" icon={Mail} type="email" className="col-span-2" placeholder="name@example.com" />
          <Select label="Role" options={["Member", "Instructor"]} value="Member" onChange={() => {}} />
          <Select label="Status" options={["Active", "Inactive"]} value="Active" onChange={() => {}} />
        </div>
      </Modal>
    </div>
  );
}
