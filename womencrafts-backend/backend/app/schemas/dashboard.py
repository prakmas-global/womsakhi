"""
Response schemas for the Dashboard (aggregate) screen.

Preformatted display strings (e.g. "$24,568", "1,248", "2 (0.2%)") are returned
as strings so the UI can paint them verbatim, matching dashboard/page.tsx.
"""

from pydantic import BaseModel


# --- KPI stat cards -----------------------------------------------------------

class StatCard(BaseModel):
    key: str
    label: str
    value: str          # preformatted, e.g. "1,248" or "$24,568"
    delta: str          # e.g. "12.5%"
    delta_dir: str      # "up" | "down"
    tone: str           # violet | emerald | amber | sky
    icon: str           # lucide icon name
    href: str


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
    status: str


class RecentAppointment(BaseModel):
    title: str
    who: str
    date: str
    time: str
    status: str


# --- System overview (owned singleton) ----------------------------------------

class SystemOverviewResponse(BaseModel):
    storage_percent: float
    storage_percent_label: str
    storage_used_gb: float
    storage_total_gb: float
    storage_label: str
    active_sessions: int
    system_status: str
    status_label: str
    last_backup_at: str
    last_backup_label: str
    last_backup_type: str


# --- Combined bundle (hydrates the whole screen in one call) -------------------

class DashboardOverview(BaseModel):
    stats: list[StatCard]
    appointment_trend: AppointmentTrend
    users_by_role: UsersByRole
    recent_users: list[RecentUser]
    recent_appointments: list[RecentAppointment]
    system_overview: SystemOverviewResponse
