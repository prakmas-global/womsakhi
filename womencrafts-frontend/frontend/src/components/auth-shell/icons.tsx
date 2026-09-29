import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleAlert,
  Copy,
  FileCheck2,
  Headphones,
  KeyRound,
  LockKeyhole,
  Mail,
  MessageSquareText,
  ShieldCheck,
  Smartphone,
  UserRound,
  type LucideIcon,
} from "lucide-react";

/** One premium icon family for every authentication surface. */
const ICONS = {
  mail: Mail,
  shield: ShieldCheck,
  check: Check,
  lock: LockKeyhole,
  arrow: ArrowRight,
  external: ArrowUpRight,
  back: ArrowLeft,
  msg: MessageSquareText,
  user: UserRound,
  key: KeyRound,
  phone: Smartphone,
  copy: Copy,
  alert: CircleAlert,
  file: FileCheck2,
  support: Headphones,
} satisfies Record<string, LucideIcon>;

export type AuthIconName = keyof typeof ICONS;

export function AuthIcon({ name, className }: { name: AuthIconName; className?: string }) {
  const Icon = ICONS[name];
  return (
    <Icon
      className={`wsa-ic${className ? ` ${className}` : ""}`}
      aria-hidden="true"
      focusable="false"
      strokeWidth={1.9}
    />
  );
}
