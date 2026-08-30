"""
Analytics, computed from records that actually exist.

**What this module used to do, and why it changed.** Every number came from one
seeded snapshot document: 48,592 visitors and 182,340 page views, for a platform
with 46 members. The date-range selector was documented as "display only" — it
was sent to the server and thrown away, so every range showed the same figures.

That is the failure [[Empty is not the same as broken]] is about. A screen that
is confidently, quietly wrong is worse than one that says it has nothing: nobody
reports it, and decisions get made on it.

So: every figure below is counted from `members`, `bookings` and `enrollments`,
inside the window the selector asks for, and every delta is a real comparison
against the immediately preceding window of the same length.

**Four panels changed meaning, on purpose.** Device share, traffic sources, top
pages and referrers are web-analytics; WomSakhi records no page views, has no
tracker, and cannot answer them. Rather than keep inventing them, they now show
things the database does know and the staff actually need — who the members are,
which services get booked, and where members came from. Same shapes, same
charts, real answers.

The response schemas are unchanged, so the screen keeps working.
"""

from collections import Counter
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Iterable

from fastapi import APIRouter, Depends, Query

from app.core.deps import get_current_user
from app.db.mongodb import get_database
from app.schemas.analytics import (
    DeviceResponse,
    EngagementPointResponse,
    OverviewResponse,
    RealtimeResponse,
    ReferrerResponse,
    SourceResponse,
    SummaryResponse,
    TopPageResponse,
    TrafficPointResponse,
)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# --- windows ------------------------------------------------------------------
# (days, bucket). The bucket keeps the number of points on a chart readable:
# 30 daily points is a line, 90 is a smear.
RANGES: dict[str, tuple[int, str]] = {
    "Last 7 Days": (7, "day"),
    "Last 30 Days": (30, "day"),
    "Last 90 Days": (90, "week"),
    "This Year": (365, "month"),
}
PERIODS: dict[str, tuple[int, str]] = {
    "This Week": (7, "day"),
    "This Month": (30, "day"),
    "This Quarter": (90, "week"),
    "This Year": (365, "month"),
}

# Series colours. These live in the data because the charts read a `color` per
# slice — the same convention the seeded datasets used. UI chrome still takes
# its colour from tokens ([[ADR-013]]); this is a categorical scale, not chrome.
PALETTE = ["#e6117e", "#7440a6", "#3b82f6", "#22c55e", "#f59e0b", "#14b8a6", "#ef4444"]


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value) -> datetime | None:
    """Mongo hands back naive datetimes (BSON has no timezone), while every
    boundary computed here is timezone-aware. Comparing the two raises, so
    everything read from the database goes through this first."""
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _window(days: int) -> tuple[datetime, datetime, datetime]:
    """This window, and the equally-long one before it (for the delta)."""
    end = _now()
    start = end - timedelta(days=days)
    previous_start = start - timedelta(days=days)
    return previous_start, start, end


def _buckets(start: datetime, end: datetime, bucket: str) -> list[tuple[str, datetime, datetime]]:
    """Every bucket in the window, including the empty ones.

    Generated up front rather than derived from the data, so a day with no
    activity is a zero on the chart instead of a missing point. A line that
    skips its quiet days reads as growth that did not happen.
    """
    out: list[tuple[str, datetime, datetime]] = []
    if bucket == "day":
        step = timedelta(days=1)
        cursor = (start + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        while cursor <= end + step:
            out.append((cursor.strftime("%-d %b"), cursor - step, cursor))
            cursor += step
    elif bucket == "week":
        step = timedelta(days=7)
        cursor = start + step
        while cursor <= end + step:
            out.append((cursor.strftime("%-d %b"), cursor - step, cursor))
            cursor += step
    else:  # month
        cursor = start.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        while cursor <= end:
            if cursor.month == 12:
                nxt = cursor.replace(year=cursor.year + 1, month=1)
            else:
                nxt = cursor.replace(month=cursor.month + 1)
            out.append((cursor.strftime("%b"), cursor, nxt))
            cursor = nxt
    return out[-24:]  # never more points than a chart can show


async def _created_between(collection: str, start: datetime, end: datetime, extra: dict | None = None) -> list[dict]:
    query: dict = {"created_at": {"$gte": start, "$lt": end}}
    if extra:
        query.update(extra)
    return [d async for d in get_database()[collection].find(query)]


async def _count_between(collection: str, start: datetime, end: datetime, extra: dict | None = None) -> int:
    query: dict = {"created_at": {"$gte": start, "$lt": end}}
    if extra:
        query.update(extra)
    return await get_database()[collection].count_documents(query)


def _delta(current: int | float, previous: int | float) -> tuple[str, str]:
    """Period over period, honestly.

    No previous activity is not "+100%" — a percentage of zero means nothing.
    It reports as a flat 0% rather than an invented surge.
    """
    if not previous:
        return "0%", "up" if current else "down"
    change = (current - previous) / previous * 100
    return f"{abs(change):.1f}%", ("up" if change >= 0 else "down")


def _distinct(rows: Iterable[dict], key: str = "user_id") -> set:
    return {r.get(key) for r in rows if r.get(key)}


# --- the numbers --------------------------------------------------------------

async def _stat_cards(days: int) -> list[dict]:
    """
    Five cards, six queries, one wave.

    This used to be nine sequential awaits — and two of them were the same
    query. `_created_between("bookings", previous_start, start)` was issued
    once for the previous active-member set and again, identically, for the
    previous attendance rate; a third trip counted the rows a fourth had
    already fetched. Against Atlas in another data centre that was nine × ~50ms
    for numbers that do not depend on each other in any way.

    The previous-period COUNTS are `len()` of the previous-period ROWS. Asking
    the database to count what it has already handed us is a round trip spent
    on arithmetic we can do here.
    """
    previous_start, start, end = _window(days)

    (
        new_members,
        prev_members,
        bookings,
        enrollments,
        prev_booking_rows,
        prev_enrollment_rows,
    ) = await asyncio.gather(
        _count_between("members", start, end),
        _count_between("members", previous_start, start),
        _created_between("bookings", start, end),
        _created_between("enrollments", start, end),
        _created_between("bookings", previous_start, start),
        _created_between("enrollments", previous_start, start),
    )

    prev_bookings = len(prev_booking_rows)
    prev_enrollments = len(prev_enrollment_rows)

    active = len(_distinct(bookings) | _distinct(enrollments))
    prev_active = len(_distinct(prev_booking_rows) | _distinct(prev_enrollment_rows))

    kept = [b for b in bookings if b.get("status") != "cancelled"]
    attendance = round(len(kept) / len(bookings) * 100) if bookings else 0
    prev_attendance = (
        round(len([b for b in prev_booking_rows if b.get("status") != "cancelled"])
              / len(prev_booking_rows) * 100)
        if prev_booking_rows else 0
    )

    cards = [
        ("members", "New Members", f"{new_members:,}", "Users", "violet", new_members, prev_members),
        ("bookings", "Sessions Booked", f"{len(bookings):,}", "CalendarCheck", "emerald", len(bookings), prev_bookings),
        ("enrollments", "Programme Joins", f"{len(enrollments):,}", "GraduationCap", "amber", len(enrollments), prev_enrollments),
        ("active", "Active Members", f"{active:,}", "Activity", "sky", active, prev_active),
        ("attendance", "Sessions Kept", f"{attendance}%", "Target", "brand", attendance, prev_attendance),
    ]
    out = []
    for key, label, value, icon, tone, now_v, prev_v in cards:
        delta, direction = _delta(now_v, prev_v)
        out.append({
            "key": key, "label": label, "value": value, "icon": icon, "tone": tone,
            "delta": delta, "delta_dir": direction,
        })
    return out


async def _realtime() -> dict:
    """Members active in the last 7 days, against the 7 before.

    Not "online now": nothing in WomSakhi tracks a live session, and a number
    that cannot be measured should not be displayed as if it were.
    """
    end = _now()
    week = end - timedelta(days=7)
    fortnight = end - timedelta(days=14)

    this_week = _distinct(await _created_between("bookings", week, end)) | _distinct(
        await _created_between("enrollments", week, end))
    last_week = _distinct(await _created_between("bookings", fortnight, week)) | _distinct(
        await _created_between("enrollments", fortnight, week))

    change = len(this_week) - len(last_week)
    return {"active": len(this_week), "change": abs(change), "change_dir": "up" if change >= 0 else "down"}


async def _traffic(days: int, bucket: str) -> list[dict]:
    """New members joining, over time."""
    _, start, end = _window(days)
    rows = await _created_between("members", start, end)
    out = []
    for order, (label, b_start, b_end) in enumerate(_buckets(start, end, bucket), start=1):
        count = sum(
            1 for r in rows
            if (created := _as_utc(r.get("created_at"))) and b_start <= created < b_end
        )
        out.append({"order": order, "label": label, "value": count})
    return out


async def _engagement(days: int, bucket: str) -> list[dict]:
    """Sessions booked against the number of distinct members who booked them."""
    _, start, end = _window(days)
    bookings = await _created_between("bookings", start, end)
    out = []
    for order, (label, b_start, b_end) in enumerate(_buckets(start, end, bucket), start=1):
        in_bucket = [
            b for b in bookings
            if (created := _as_utc(b.get("created_at"))) and b_start <= created < b_end
        ]
        out.append({
            "order": order, "label": label,
            "sessions": len(in_bucket),
            "users": len(_distinct(in_bucket)),
        })
    return out


async def _by_segment() -> list[dict]:
    """Members by segment — replaces the device-share donut, which had no source."""
    counts = Counter()
    async for m in get_database()["members"].find({}, {"segment": 1}):
        counts[(m.get("segment") or "Unspecified").strip() or "Unspecified"] += 1
    total = sum(counts.values()) or 1
    return [
        {"name": name, "value": round(n / total * 100), "color": PALETTE[i % len(PALETTE)]}
        for i, (name, n) in enumerate(counts.most_common(6))
    ]


async def _by_service_type(days: int) -> list[dict]:
    """Bookings by service type — replaces the traffic-sources bars."""
    _, start, end = _window(days)
    bookings = await _created_between("bookings", start, end)
    by_id: dict[str, int] = Counter(b.get("service_id", "") for b in bookings)

    types: Counter = Counter()
    services = {str(s["_id"]): s async for s in get_database()["services"].find({}, {"type": 1})}
    for service_id, n in by_id.items():
        service = services.get(service_id)
        types[(service or {}).get("type") or "Other"] += n

    return [
        {"label": label, "value": n, "color": PALETTE[i % len(PALETTE)]}
        for i, (label, n) in enumerate(types.most_common(6))
    ]


async def _top_services(days: int) -> list[dict]:
    """Most-booked services — replaces the top-pages table.

    `bounce` carries the cancellation rate and `time` the session length, so the
    existing columns keep meaning something rather than being blanked.
    """
    _, start, end = _window(days)
    bookings = await _created_between("bookings", start, end)

    grouped: dict[str, list[dict]] = {}
    for b in bookings:
        grouped.setdefault(b.get("service_name") or "Unnamed", []).append(b)

    out = []
    for name, rows in sorted(grouped.items(), key=lambda kv: len(kv[1]), reverse=True)[:6]:
        cancelled = sum(1 for r in rows if r.get("status") == "cancelled")
        rate = round(cancelled / len(rows) * 100) if rows else 0
        out.append({
            "page": name,
            "views": f"{len(rows):,}",
            "unique": f"{len(_distinct(rows)):,}",
            "bounce": rate,
            "time": (rows[0].get("duration") or "—"),
            "tone": "emerald" if rate < 15 else "amber" if rate < 35 else "rose",
        })
    return out


async def _by_referral() -> list[dict]:
    """How members found WomSakhi — replaces the referrers table."""
    counts: Counter = Counter()
    async for m in get_database()["members"].find({}, {"referral": 1}):
        counts[(m.get("referral") or "Not recorded").strip() or "Not recorded"] += 1
    total = sum(counts.values()) or 1
    return [
        {"name": name, "visits": f"{n:,}", "pct": round(n / total * 100), "color": PALETTE[i % len(PALETTE)]}
        for i, (name, n) in enumerate(counts.most_common(6))
    ]


def _range(label: str) -> tuple[int, str]:
    return RANGES.get(label, RANGES["Last 30 Days"])


def _period(label: str) -> tuple[int, str]:
    return PERIODS.get(label, PERIODS["This Month"])


# --- endpoints ----------------------------------------------------------------

@router.get("/overview", response_model=OverviewResponse, summary="Whole-screen analytics bundle")
async def analytics_overview(
    range: str = Query("Last 30 Days", description="Date window for the stat cards and tables"),
    period: str = Query("This Month", description="Date window for the trend charts"),
    _: dict = Depends(get_current_user),
):
    r_days, _r_bucket = _range(range)
    p_days, p_bucket = _period(period)

    # Eight independent blocks for one screen. Awaited one at a time inside the
    # constructor — as they were — the whole fan-out below them serialises too:
    # the stat cards alone are six queries and realtime another four, so the
    # page cost around nineteen round trips to another data centre. None of the
    # eight reads anything another produces, so they all go at once and the
    # screen costs the slowest one instead of the sum.
    (
        stats, realtime, traffic, devices,
        sources, engagement, top_pages, referrers,
    ) = await asyncio.gather(
        _stat_cards(r_days),
        _realtime(),
        _traffic(p_days, p_bucket),
        _by_segment(),
        _by_service_type(r_days),
        _engagement(p_days, p_bucket),
        _top_services(r_days),
        _by_referral(),
    )
    return OverviewResponse(
        stats=stats,
        realtime=RealtimeResponse(**realtime),
        traffic=traffic,
        devices=devices,
        sources=sources,
        engagement=engagement,
        top_pages=top_pages,
        referrers=referrers,
    )


@router.get("/summary", response_model=SummaryResponse, summary="Stat cards + active-members block")
async def analytics_summary(
    range: str = Query("Last 30 Days", description="Date window"),
    _: dict = Depends(get_current_user),
):
    days, _bucket = _range(range)
    stats, realtime = await asyncio.gather(_stat_cards(days), _realtime())
    return SummaryResponse(stats=stats, realtime=RealtimeResponse(**realtime))


@router.get("/stats", response_model=SummaryResponse, summary="Alias for the stat cards block")
async def analytics_stats(
    range: str = Query("Last 30 Days", description="Date window"),
    _: dict = Depends(get_current_user),
):
    days, _bucket = _range(range)
    stats, realtime = await asyncio.gather(_stat_cards(days), _realtime())
    return SummaryResponse(stats=stats, realtime=RealtimeResponse(**realtime))


@router.get("/realtime", response_model=RealtimeResponse, summary="Members active in the last 7 days")
async def analytics_realtime(_: dict = Depends(get_current_user)):
    return RealtimeResponse(**await _realtime())


@router.get("/traffic", response_model=list[TrafficPointResponse], summary="New members over time")
async def analytics_traffic(
    period: str = Query("This Month", description="Date window"),
    _: dict = Depends(get_current_user),
):
    days, bucket = _period(period)
    return await _traffic(days, bucket)


@router.get("/devices", response_model=list[DeviceResponse], summary="Members by segment")
async def analytics_devices(_: dict = Depends(get_current_user)):
    return await _by_segment()


@router.get("/sources", response_model=list[SourceResponse], summary="Bookings by service type")
async def analytics_sources(
    range: str = Query("Last 30 Days", description="Date window"),
    _: dict = Depends(get_current_user),
):
    days, _bucket = _range(range)
    return await _by_service_type(days)


@router.get("/engagement", response_model=list[EngagementPointResponse], summary="Sessions vs. members booking them")
async def analytics_engagement(
    period: str = Query("This Month", description="Date window"),
    _: dict = Depends(get_current_user),
):
    days, bucket = _period(period)
    return await _engagement(days, bucket)


@router.get("/top-pages", response_model=list[TopPageResponse], summary="Most-booked services")
async def analytics_top_pages(
    range: str = Query("Last 30 Days", description="Date window"),
    _: dict = Depends(get_current_user),
):
    days, _bucket = _range(range)
    return await _top_services(days)


@router.get("/referrers", response_model=list[ReferrerResponse], summary="How members found WomSakhi")
async def analytics_referrers(_: dict = Depends(get_current_user)):
    return await _by_referral()
