/**
 * WomSakhi Design System
 * ─────────────────────────
 * The single import surface for the whole UI. Screens should import from
 * `@/design-system` and nothing else — no direct component paths, no raw
 * colours. If something is missing here, add it here.
 *
 * Live documentation: /design-system
 *
 *   import { Button, Card, DataTable, useAppForm } from "@/design-system";
 */

/* ---- Layout & surfaces ---- */
export { default as Card, CardHeader } from "./primitives/Card";
export { default as Modal } from "./primitives/Modal";
export { default as Menu, MenuItem } from "./primitives/Menu";

/* ---- Actions ---- */
export { default as Button, ButtonLink, IconButton } from "./primitives/Button";
export type { ButtonVariant, ButtonSize } from "./primitives/Button";

/* ---- Form controls ---- */
export {
  default as Input,
  Textarea,
  FieldLabel,
  labelClass,
  controlClass,
  hintClass,
  errorClass,
} from "./primitives/Input";
export { default as Select } from "./primitives/Select";
export { default as Switch } from "./primitives/Switch";
export { default as ImageUpload } from "./primitives/ImageUpload";
export { Checkbox, SearchInput, SelectButton } from "./primitives/Navigation";

/* ---- Feedback: transient confirmations and questions ---- */
export { default as ToastProvider, useToast } from "./feedback/ToastProvider";
export type { ToastTone, ToastOptions } from "./feedback/ToastProvider";
export { default as ConfirmProvider, useConfirm } from "./feedback/ConfirmProvider";
export type { ConfirmOptions } from "./feedback/ConfirmProvider";

/* ---- Data display ---- */
export { default as Badge, TONE_CLASSES, TONE_DOTS } from "./primitives/Badge";
export type { Tone } from "./primitives/Badge";
export { default as Avatar, placeholderPhoto } from "./primitives/Avatar";
export { default as Thumb } from "./primitives/Thumb";
export { default as StatCard } from "./primitives/StatCard";
export { Tabs, Pagination, Tooltip, ProgressBar } from "./primitives/Navigation";
export { default as DataTable, createColumns, dataTableFeatures } from "./data/DataTable";
export type { DataTableFeatures } from "./data/DataTable";

/* ---- Feedback & state ---- */
export {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  EmptyState,
  NoResults,
  SkeletonRows,
  ErrorState,
  Alert,
} from "./primitives/Feedback";
export { default as Spinner } from "./primitives/Spinner";
export { default as ComingSoon } from "./primitives/ComingSoon";

/* ---- Theming ---- */
export { default as ThemeToggle } from "./primitives/ThemeToggle";
export { default as ThemeSelect } from "./primitives/ThemeSelect";
export { default as RouteProgress } from "./primitives/RouteProgress";

/* ---- Forms (TanStack Form, bound to the controls above) ---- */
export { useAppForm, withForm, useFieldContext, useFormContext } from "./form/form";

/* ---- Tokens (names + docs metadata; live values come from CSS) ---- */
export { TOKEN_GROUPS, readToken } from "./tokens";
export type { TokenGroup, TokenSpec } from "./tokens";
