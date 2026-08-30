import type { ElementType } from "react";
import {
  CalendarClock,
  MessageSquare,
  UserPlus,
  CreditCard,
  AlertTriangle,
  MessageSquareHeart,
  GraduationCap,
  Server,
} from "lucide-react";

export type NotifType =
  | "appointment"
  | "message"
  | "user"
  | "payment"
  | "alert"
  | "feedback"
  | "program"
  | "system";

export const NOTIF_META: Record<
  NotifType,
  { icon: ElementType; tone: string; label: string }
> = {
  appointment: { icon: CalendarClock, tone: "violet", label: "Appointment" },
  message: { icon: MessageSquare, tone: "sky", label: "Message" },
  user: { icon: UserPlus, tone: "emerald", label: "User" },
  payment: { icon: CreditCard, tone: "amber", label: "Payment" },
  alert: { icon: AlertTriangle, tone: "rose", label: "Alert" },
  feedback: { icon: MessageSquareHeart, tone: "brand", label: "Feedback" },
  program: { icon: GraduationCap, tone: "blue", label: "Program" },
  system: { icon: Server, tone: "slate", label: "System" },
};

/** Soft icon-chip classes per tone (theme-safe — dark overrides handled in globals). */
export const TONE_CHIP: Record<string, string> = {
  violet: "bg-violet-tint text-violet-ink",
  sky: "bg-status-info-bg text-status-info-ink",
  emerald: "bg-status-ok-bg text-status-ok-ink",
  amber: "bg-status-warn-bg text-status-warn-ink",
  rose: "bg-status-danger-bg text-status-danger-ink",
  brand: "bg-brand-tint text-brand-ink",
  blue: "bg-status-info-bg text-status-info-ink",
  slate: "bg-surface-inset text-ink-subtle",
};

export type NotifGroup = "Today" | "Yesterday" | "Earlier";

export type Notif = {
  id: string;
  type: NotifType;
  title: string;
  desc: string;
  time: string;
  group: NotifGroup;
  unread: boolean;
};

/**
 * The rows used to live here, hardcoded.
 *
 * They were removed once the bell and the notifications page both read the
 * live API: a fabricated notification is worse than none, because it teaches
 * staff that the bell is decorative and the real alert gets ignored too.
 *
 * What stays is presentation only — how a type is drawn, not what exists.
 * The backend owns the data; this file owns the icon and the colour.
 */
