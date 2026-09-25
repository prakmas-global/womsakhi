"""
Response schemas for the Dashboard (the admin home).

Preformatted display strings (e.g. "₹24,568", "1,248") are returned as strings
so the UI can paint them verbatim. Every number here is measured from a
collection at request time; nothing is a stored figure.
"""

from pydantic import BaseModel


# --- KPI stat cards -----------------------------------------------------------

class StatCard(BaseModel):
    key: str
    label: str
    value: str          # preformatted, e.g. "1,248" or "₹24,568"
    delta: str          # "+12" — how many were added in the window; "" when none
    delta_dir: str      # "up" | "down"
    delta_note: str = ""  # what the delta counts, e.g. "new in the last 30 days"
    tone: str           # violet | emerald | amber | sky
    icon: str           # lucide icon name
    href: str


# --- What is waiting for a person --------------------------------------------

class AttentionItem(BaseModel):
    key: str
    label: str
    value: int
    note: str           # what the number counts, in one line
    tone: str           # amber | rose | sky | emerald
    icon: str           # lucide icon name
    href: str           # the screen where she deals with it


# --- Appointments overview (area trend + status tiles) ------------------------

class TrendPoint(BaseModel):
    label: str
    value: int


class ApptTile(BaseModel):
    label: str
    value: str
    tone: str           # tailwind "text-* bg-*" pair the UI splits
    href: str


class AppointmentTrend(BaseModel):
    range: str
    series: list[TrendPoint]
    tiles: list[ApptTile]


# --- Users by role (donut + legend) -------------------------------------------

class RoleSlice(BaseModel):
    name: str
    value: int
    color: str


class RoleLegendItem(BaseModel):
    name: str
    value: str          # preformatted "N (pct%)", e.g. "1,198 (96.0%)"
    color: str


class UsersByRole(BaseModel):
    segments: list[RoleSlice]
    legend: list[RoleLegendItem]
    center_value: str
    center_label: str


# --- Recent lists -------------------------------------------------------------

class RecentUser(BaseModel):
    name: str
    email: str
    date: str
    status: str         # the member's real directory status


class RecentAppointment(BaseModel):
    title: str
    who: str
    date: str
    time: str
    status: str


class RecentActivity(BaseModel):
    """One `activity_log` row, as written by app.core.audit.record."""
    id: str
    user_name: str
    action: str         # dotted verb, e.g. "staff.invite"
    category: str
    target: str
    detail: str
    when: str           # "Sep 26, 2026 · 10:14 AM"
    created_at: str     # ISO


# --- System overview (measured, not stored) -----------------------------------

class SystemOverviewResponse(BaseModel):
    database_ok: bool
    database_latency_ms: int
    status_label: str           # "Database reachable · 12 ms" | "Database unreachable"
    storage_bytes: int
    storage_label: str          # "24.6 MB of data in 61 collections"
    collections: int
    staff_signed_in_24h: int    # staff accounts with a sign-in in the last 24 hours
    last_backup_at: str         # ISO, or "" when there has never been one
    last_backup_label: str      # "Sep 26, 2026 02:30 AM", or ""
    last_backup_type: str       # "Full backup" | "Custom backup" | ""


# --- Combined bundle (hydrates the whole screen in one call) -------------------

class DashboardOverview(BaseModel):
    generated_at: str
    stats: list[StatCard]
    attention: list[AttentionItem]
    appointment_trend: AppointmentTrend
    users_by_role: UsersByRole
    recent_users: list[RecentUser]
    recent_appointments: list[RecentAppointment]
    recent_activity: list[RecentActivity]
    system_overview: SystemOverviewResponse
