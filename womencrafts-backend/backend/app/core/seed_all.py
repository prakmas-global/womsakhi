"""
Run every module's seeder at startup.

Each seeder is non-destructive (it only fills its collection if empty), and each
is wrapped so one failing seeder never blocks the others or startup.
"""

from app.core.seed import seed_if_empty  # members, roles, segments

from app.routes.appointments import seed as seed_appointments
from app.routes.programs import seed as seed_programs
from app.routes.calendar import seed as seed_calendar
from app.routes.services import seed as seed_services
from app.routes.messages import seed as seed_messages
from app.routes.reports import seed as seed_reports
from app.routes.content import seed as seed_content
from app.routes.feedback import seed as seed_feedback
from app.routes.ai import seed as seed_ai
from app.routes.notifications import seed as seed_notifications
from app.routes.dashboard import seed as seed_dashboard
from app.routes.billing import seed as seed_billing
from app.routes.settings_security import seed as seed_settings_security
from app.routes.settings_platform import seed as seed_settings_platform
from app.routes.community import seed as seed_community
from app.routes.growth import seed as seed_growth
from app.routes.exchange import seed as seed_exchange
from app.routes.group_buy import seed as seed_group_buy
from app.routes.shop import seed as seed_shop
from app.routes.reference import seed as seed_reference
from app.routes.skills import seed as seed_skills
from app.routes.cycle import seed as seed_cycle

_SEEDERS = [
    ("users (members/roles/segments)", seed_if_empty),
    ("appointments", seed_appointments),
    ("programs", seed_programs),
    ("calendar", seed_calendar),
    # analytics no longer seeds: it counts members, bookings and enrollments
    # directly, so there is nothing to pre-fill. See routes/analytics.py.
    ("services", seed_services),
    ("messages", seed_messages),
    ("reports", seed_reports),
    ("content", seed_content),
    ("feedback", seed_feedback),
    ("ai", seed_ai),
    ("notifications", seed_notifications),
    ("dashboard", seed_dashboard),
    ("billing", seed_billing),
    ("sessions/logs", seed_settings_security),
    ("integrations/permissions", seed_settings_platform),
    # member-facing modules
    ("circles/stories", seed_community),
    ("events/mentors/opportunities", seed_growth),
    ("schemes/cover/wellbeing", seed_reference),
    ("group buys", seed_group_buy),
    ("her shop", seed_shop),
    ("skill exchange", seed_exchange),
    ("assessments/digital", seed_skills),
    ("health mentors", seed_cycle),
]


async def seed_all() -> None:
    for name, fn in _SEEDERS:
        try:
            await fn()
        except Exception as exc:  # noqa: BLE001 - one bad seeder must not block the rest
            print(f"⚠️  Seed '{name}' skipped: {exc}")

    # NOTE: the deep seed (`app/core/seed_depth.py`) is deliberately NOT run
    # here. It performs several hundred upserts against Atlas — fine for a
    # script, far too slow for a boot step: wiring it in held startup open long
    # enough that the server never began listening.
    #
    # The seeders above are cheap because each only fills an empty collection.
    # Run the deep one by hand when the data needs refreshing:
    #
    #     python3 scripts/seed_depth.py
    #
    # RBAC backfill (idempotent): ensure roles have module lists + admin is Super Admin.
    try:
        from app.core.rbac import ensure_rbac

        await ensure_rbac()
    except Exception as exc:  # noqa: BLE001
        print(f"⚠️  RBAC backfill skipped: {exc}")
