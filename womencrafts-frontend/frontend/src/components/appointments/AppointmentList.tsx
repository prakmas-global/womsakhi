"use client";

import { MoreHorizontal, Eye, CalendarClock } from "lucide-react";
import { Avatar, Badge, Menu, MenuItem, type Tone } from "@/design-system";
import type { Appt, ApptStatus } from "@/types/appointment";
const STATUS_TONE: Record<ApptStatus, Tone> = {
  Upcoming: "violet",
  Completed: "emerald",
  Cancelled: "rose",
  Rescheduled: "brand",
};

export default function AppointmentList({
  appointments,
  onOpen,
}: {
  appointments: Appt[];
  onOpen: (a: Appt) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-215 border-collapse text-left">
        <thead>
          <tr className="border-b border-line text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
            <th scope="col" className="px-2 py-3">Client</th>
            <th scope="col" className="px-2 py-3">Service</th>
            <th scope="col" className="whitespace-nowrap px-2 py-3">Date</th>
            <th scope="col" className="whitespace-nowrap px-2 py-3">Time</th>
            <th scope="col" className="px-2 py-3">Status</th>
            <th scope="col" className="px-2 py-3">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {appointments.map((a) => (
            <tr
              key={a.id}
              onClick={() => onOpen(a)}
              className="cursor-pointer text-sm hover:bg-surface-hover/60 dark:hover:bg-white/5"
            >
              <td className="px-2 py-3">
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.name} size="sm" />
                  <span className="font-bold text-ink">{a.name}</span>
                </div>
              </td>
              <td className="px-2 py-3 text-ink-subtle">{a.service}</td>
              <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{a.date}</td>
              <td className="whitespace-nowrap px-2 py-3 text-ink-subtle">{a.time}</td>
              <td className="px-2 py-3">
                <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
              </td>
              <td className="px-2 py-3">
                <div onClick={(e) => e.stopPropagation()}>
                  <Menu
                    trigger={
                      <span className="flex text-ink-subtle hover:text-ink-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </span>
                    }
                  >
                    <MenuItem icon={Eye} onClick={() => onOpen(a)}>
                      View details
                    </MenuItem>
                    <MenuItem icon={CalendarClock} onClick={() => onOpen(a)}>
                      Open
                    </MenuItem>
                  </Menu>
                </div>
              </td>
            </tr>
          ))}
          {appointments.length === 0 && (
            <tr className="text-sm">
              <td colSpan={6} className="px-2 py-10 text-center text-ink-subtle">
                No appointments
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
