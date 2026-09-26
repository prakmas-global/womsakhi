"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

import { Modal, Select, Textarea } from "@/design-system";

/**
 * One dialog for every moderation decision that needs a written reason.
 *
 * Hiding a post, muting a member, declining a story — each of these reaches
 * the woman it concerns as a notification and lands in the audit trail as a
 * sentence. The reason is that sentence. This dialog exists so that no action
 * of that kind can be taken with an empty one, and so that the three screens
 * ask for it the same way.
 */
export default function ReasonModal({
  open,
  title,
  description,
  label = "Reason",
  placeholder = "Written for her, not for the file — she will read it.",
  confirmLabel = "Confirm",
  danger = false,
  required = true,
  withDays = false,
  busy = false,
  icon,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description?: string;
  label?: string;
  placeholder?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** When false, an empty reason is allowed (restoring, publishing). */
  required?: boolean;
  /** Adds a "for how long" picker — used by mute. */
  withDays?: boolean;
  busy?: boolean;
  icon?: React.ElementType;
  onClose: () => void;
  onConfirm: (reason: string, days: number) => void | Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("7");

  // A fresh dialog each time it opens — a reason written for one post must
  // not be sitting there, pre-filled, for the next. Done as a state
  // adjustment during render (React's documented pattern for "reset when a
  // prop changes") rather than in an effect, so there is no frame in which
  // the old text is visible.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setReason("");
      setDays("7");
    }
  }

  const disabled = busy || (required && !reason.trim());

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      iconTone={danger ? "rose" : "brand"}
      size="md"
      footer={
        <>
          <button className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
            onClick={() => void onConfirm(reason.trim(), Number(days))}
            disabled={disabled}
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {withDays && (
          <Select
            label="For how long"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            options={[
              { value: "1", label: "1 day" },
              { value: "3", label: "3 days" },
              { value: "7", label: "7 days" },
              { value: "14", label: "2 weeks" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
          />
        )}
        <Textarea
          label={label}
          required={required}
          rows={4}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={placeholder}
          hint={required ? "Required. It is sent to her and kept on the audit trail." : "Optional. Kept on the audit trail."}
        />
      </div>
    </Modal>
  );
}
