"""
The cycle engine — every number the tracker shows, derived from what she told us.

Nothing here touches the database. It is handed her profile and her logged
days and returns the state of her cycle; the route stores answers and nothing
else. That split is deliberate, and it is the rule in `Derive, never store what
you can compute`: a stored "next period: 26 Nov" is right the day it is written
and wrong the day she logs a late start. A derived one cannot drift.

── What she stores ─────────────────────────────────────────────────────────
One answer a day, at most: *was she on her period*, plus how she felt. Periods
are the runs of "yes" days. Everything else — cycle length, the next date, the
fertile window, which phase she is in, whether this period is running long —
is arithmetic on those runs.

── The rules, and where they come from ─────────────────────────────────────
* **A missed day does not end a period.** She will not open the app every day.
  A run of "yes" tolerates one unanswered day inside it; an explicit "no" ends
  it. Without the tolerance, forgetting Tuesday would split one period in two
  and halve every average it feeds.
* **Ovulation is 14 days before the next period**, not 14 days after the last
  one. The luteal phase is the stable half of the cycle; the follicular half is
  what varies. That is why a 35-day cycle ovulates on day 21, not day 14.
* **The fertile window is the five days before ovulation and the day itself**
  (Wilcox et al., NEJM 1995 — the six-day window). It is shown as a guide to
  her body, and the screen says it is **not** contraception.
* **Periods usually last 2 to 7 days** (NHS). "Running long" is judged against
  HER usual length first, and never later than day 8: more than seven days of
  bleeding is the point every clinical source says to see a doctor.
* **21 to 35 days is a typical adult cycle** (ACOG). Outside it, or varying by
  more than about a week, is worth mentioning to a doctor — so the insight
  says so, gently, once there are enough cycles to say anything.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from statistics import mean, pstdev
from typing import Iterable

# Defaults when she has not told us and we have not measured yet.
DEFAULT_CYCLE = 28
DEFAULT_PERIOD = 5

# Cycle lengths outside this band are not averaged in. A "cycle" of 9 days is
# two logs of one period with a gap; one of 120 days is a year she stopped
# using the app. Both are real data about her usage, not about her body.
MIN_CYCLE, MAX_CYCLE = 15, 90

# How many recent cycles an average looks at. Six is long enough to smooth one
# odd month, short enough that a real change (after a baby, near menopause)
# shows up within a season instead of being averaged away for two years.
WINDOW = 6

# A period is still "on" if the last yes was this many days ago and she has not
# said no since — so one missed check-in does not end it.
GRACE_DAYS = 2

# Clinical line: bleeding for more than seven days should be seen by a doctor.
DOCTOR_AFTER_DAY = 7
# The owner's rule: past five days, check in with her about it.
LONG_AFTER_DAY = 5

POSITIVE_MOODS = {"happy", "calm"}
POSITIVE_FEELINGS = {"energetic", "calm", "confident"}

PHASES = ("menstrual", "follicular", "ovulation", "luteal")
PHASE_LABEL = {
    "menstrual": "Menstrual phase",
    "follicular": "Follicular phase",
    "ovulation": "Ovulation",
    "luteal": "Luteal phase",
}


@dataclass
class Day:
    """One logged day. `period` is None when she has not answered the question."""

    on: date
    period: bool | None = None
    mood: str | None = None
    feelings: list[str] = field(default_factory=list)
    symptoms: list[str] = field(default_factory=list)
    note: str = ""


@dataclass
class Run:
    """One period: first and last day she said yes."""

    start: date
    end: date

    @property
    def length(self) -> int:
        return (self.end - self.start).days + 1


def runs(days: Iterable[Day]) -> list[Run]:
    """
    Group her "yes" days into periods, oldest first.

    A new period starts when the gap since the previous yes is longer than the
    grace allows, or when she said "no" on any day in between.
    """
    ordered = sorted((d for d in days if d.period is not None), key=lambda d: d.on)
    out: list[Run] = []
    broken = True          # a "no" since the last yes
    for d in ordered:
        if d.period is False:
            broken = True
            continue
        if out and not broken and (d.on - out[-1].end).days <= GRACE_DAYS:
            out[-1].end = d.on
        else:
            out.append(Run(d.on, d.on))
        broken = False
    return out


def _said_no_after(days: Iterable[Day], after: date) -> bool:
    return any(d.period is False and d.on > after for d in days)


@dataclass
class State:
    today: date
    has_history: bool
    on_period: bool
    period_day: int | None            # 1-based, while on her period
    avg_cycle: int
    avg_period: int
    measured_cycles: int
    cycle_lengths: list[int]
    period_lengths: list[int]
    last_start: date | None
    cycle_day: int | None             # 1-based day of the current cycle
    phase: str | None
    next_start: date | None
    days_until: int | None            # negative when late
    ovulation: date | None
    fertile_start: date | None
    fertile_end: date | None
    long_level: str | None            # None | "long" | "doctor"
    long_threshold: int
    runs: list[Run]


def _averages(rs: list[Run], typical_cycle: int, typical_period: int, *, open_last: bool):
    starts = [r.start for r in rs]
    gaps = [(b - a).days for a, b in zip(starts, starts[1:])]
    lengths = [g for g in gaps if MIN_CYCLE <= g <= MAX_CYCLE][-WINDOW:]
    # The period still running has not finished, so its length so far is not a
    # period length — counting it would drag the average down every morning.
    done = rs[:-1] if open_last else rs
    plens = [r.length for r in done if 1 <= r.length <= 15][-WINDOW:]
    avg_cycle = round(mean(lengths)) if lengths else typical_cycle
    avg_period = round(mean(plens)) if plens else typical_period
    return avg_cycle, avg_period, lengths, plens


def ovulation_day(cycle_len: int, period_len: int) -> int:
    """
    The cycle day (1-based) ovulation falls on: fourteen days before the next
    period, so day 14 of a 28-day cycle and day 21 of a 35-day one — and never
    inside or right against the period itself, whatever a short cycle implies.
    """
    return max(cycle_len - 14, period_len + 2)


def ovulation_for(start: date, cycle_len: int, period_len: int) -> date:
    return start + timedelta(days=ovulation_day(cycle_len, period_len) - 1)


def phase_for(cycle_day: int, *, cycle_len: int, period_len: int, on_period: bool) -> str:
    """
    Four phases, by cycle day. After her period ends she is follicular, even
    on a day her average says she "should" still be bleeding — she said no.
    """
    if on_period:
        return "menstrual"
    ov = ovulation_day(cycle_len, period_len)
    if cycle_day < ov - 1:
        return "follicular"
    if cycle_day <= ov + 1:
        return "ovulation"
    return "luteal"


def compute(
    days: list[Day],
    today: date,
    *,
    typical_cycle: int = DEFAULT_CYCLE,
    typical_period: int = DEFAULT_PERIOD,
    declared_last_start: date | None = None,
) -> State:
    rs = runs(days)

    # What she told us at setup counts as a period until she logs a real one —
    # otherwise the first month of the tracker is a blank calendar.
    if declared_last_start and (not rs or declared_last_start < rs[0].start - timedelta(days=MIN_CYCLE - 1)):
        end = declared_last_start + timedelta(days=max(typical_period, 1) - 1)
        # She told us about a period that is over, so it ends before today.
        end = max(min(end, today - timedelta(days=1)), declared_last_start)
        rs = [Run(declared_last_start, end)] + rs

    last = rs[-1] if rs else None
    on_period = bool(
        last
        and (today - last.end).days <= GRACE_DAYS
        and last.end <= today
        and not _said_no_after(days, last.end)
        # The declared start only ever describes a past period.
        and not (declared_last_start and last.start == declared_last_start and not any(
            d.period for d in days if d.on >= last.start))
    )
    avg_cycle, avg_period, lengths, plens = _averages(
        rs, typical_cycle, typical_period, open_last=on_period,
    )

    period_day = (today - last.start).days + 1 if on_period and last else None
    cycle_day = (today - last.start).days + 1 if last else None

    next_start = ovulation = f_start = f_end = None
    days_until = None
    phase = None
    if last:
        next_start = last.start + timedelta(days=avg_cycle)
        days_until = (next_start - today).days
        ovulation = ovulation_for(last.start, avg_cycle, avg_period)
        f_start, f_end = ovulation - timedelta(days=5), ovulation
        phase = phase_for(
            cycle_day or 1, cycle_len=avg_cycle, period_len=avg_period, on_period=on_period,
        )
        if not on_period and days_until is not None and days_until < 0:
            # Late: she is past the cycle she was expected to finish. Luteal is
            # the honest phase name until she logs a start.
            phase = "luteal"

    # Is this period running long? Judged against her usual, clamped to the
    # owner's day-5 rule and the clinical day-7 line.
    threshold = min(max(LONG_AFTER_DAY, avg_period if plens else LONG_AFTER_DAY), DOCTOR_AFTER_DAY)
    long_level = None
    if on_period and period_day:
        if period_day > DOCTOR_AFTER_DAY:
            long_level = "doctor"
        elif period_day > threshold:
            long_level = "long"

    return State(
        today=today,
        has_history=bool(rs),
        on_period=on_period,
        period_day=period_day,
        avg_cycle=avg_cycle,
        avg_period=avg_period,
        measured_cycles=len(lengths),
        cycle_lengths=lengths,
        period_lengths=plens,
        last_start=last.start if last else None,
        cycle_day=cycle_day,
        phase=phase,
        next_start=next_start,
        days_until=days_until,
        ovulation=ovulation,
        fertile_start=f_start,
        fertile_end=f_end,
        long_level=long_level,
        long_threshold=threshold,
        runs=rs,
    )


# ── The calendar ───────────────────────────────────────────────────────────

def marks_for_month(s: State, year: int, month: int) -> dict[date, list[str]]:
    """
    What each day of a month is: a logged period, a predicted one, the fertile
    window, ovulation. A day can carry more than one mark (ovulation is always
    inside the fertile window), and the screen draws the strongest.
    """
    first = date(year, month, 1)
    nxt = date(year + (month == 12), month % 12 + 1, 1)
    out: dict[date, list[str]] = {}

    def add(d: date, mark: str) -> None:
        if first <= d < nxt:
            out.setdefault(d, [])
            if mark not in out[d]:
                out[d].append(mark)

    for r in s.runs:
        d = r.start
        while d <= r.end:
            add(d, "period")
            d += timedelta(days=1)

    if not s.last_start:
        return out

    # The current cycle's window, then up to four predicted cycles ahead —
    # enough to cover any month she can page to from the tracker.
    cycles: list[date] = [s.last_start]
    start = s.next_start
    while start and start < nxt + timedelta(days=s.avg_cycle) and len(cycles) < 6:
        cycles.append(start)
        start = start + timedelta(days=s.avg_cycle)

    for i, cstart in enumerate(cycles):
        if i > 0:
            # A predicted period. Today and earlier are never "predicted" — they
            # happened or they did not, and she is the one who knows.
            for k in range(s.avg_period):
                d = cstart + timedelta(days=k)
                if d > s.today and "period" not in out.get(d, []):
                    add(d, "predicted")
        ov = ovulation_for(cstart, s.avg_cycle, s.avg_period)
        for k in range(5, -1, -1):
            d = ov - timedelta(days=k)
            if "period" not in out.get(d, []):
                add(d, "fertile")
        if "period" not in out.get(ov, []):
            add(ov, "ovulation")
    return out


# ── What the numbers say ───────────────────────────────────────────────────

def insights(s: State, days: list[Day]) -> list[dict]:
    """
    Plain sentences, each one true of HER data and only shown when there is
    enough of it to be true. An insight made up from two data points is worse
    than none: she will plan around it.
    """
    out: list[dict] = []
    fmt = lambda d: f"{d.strftime('%b')} {d.day}"  # noqa: E731

    if s.next_start is not None and s.days_until is not None:
        if s.on_period:
            out.append({"icon": "CalendarDays", "tone": "pink",
                        "text": "You are on day",
                        "strong": f"{s.period_day} of your period"})
        elif s.days_until > 1:
            out.append({"icon": "CalendarDays", "tone": "pink",
                        "text": "Your next period is likely in",
                        "strong": f"{s.days_until} days ({fmt(s.next_start)})"})
        elif s.days_until in (0, 1):
            out.append({"icon": "CalendarDays", "tone": "pink",
                        "text": "Your period may start",
                        "strong": "today" if s.days_until == 0 else "tomorrow"})
        else:
            late = -s.days_until
            out.append({"icon": "CalendarClock", "tone": "orange",
                        "text": f"Your period is {late} day{'s' if late != 1 else ''} later than expected.",
                        "strong": "Stress, travel or illness can shift it."})

    if s.measured_cycles >= 2:
        spread = max(1, round(pstdev(s.cycle_lengths)))
        low, high = min(s.cycle_lengths), max(s.cycle_lengths)
        if high - low > 7:
            out.append({"icon": "Activity", "tone": "orange",
                        "text": f"Your cycle length varies by {high - low} days.",
                        "strong": "Worth mentioning to a doctor."})
        elif s.avg_cycle > 35 or s.avg_cycle < 21:
            out.append({"icon": "Activity", "tone": "orange",
                        "text": f"Your cycles average {s.avg_cycle} days.",
                        "strong": "Outside 21–35 days is worth a check-up."})
        else:
            out.append({"icon": "CalendarCheck", "tone": "green",
                        "text": "Your cycle seems regular",
                        "strong": f"({s.avg_cycle} ± {spread} days)"})
    elif s.has_history:
        need = 2 - s.measured_cycles
        out.append({"icon": "CalendarCheck", "tone": "violet",
                    "text": "Log a few more periods to see your pattern.",
                    "strong": f"{need} more to go" if need > 0 else ""})

    recent = [d for d in days if (s.today - d.on).days <= 90]
    counts: dict[str, int] = {}
    for d in recent:
        for sym in d.symptoms:
            if sym != "none":
                counts[sym] = counts.get(sym, 0) + 1
    if counts and sum(counts.values()) >= 3:
        top = max(counts, key=lambda k: counts[k])
        out.append({"icon": "Sparkles", "tone": "violet",
                    "text": "Your most common symptom is",
                    "strong": top.replace("-", " ")})

    by_phase = mood_by_phase(s, days)
    best = [(p, pos / n) for p, (pos, n) in by_phase.items() if n >= 2]
    if best and len(best) >= 2:
        phase, share = max(best, key=lambda x: x[1])
        if share >= 0.5:
            out.append({"icon": "Sun", "tone": "amber",
                        "text": "You feel more energetic during your",
                        "strong": PHASE_LABEL[phase].replace(" phase", "").lower() + " phase"})
    return out


def phase_on(s: State, d: date) -> str | None:
    """Which phase a past day fell in, measured from the period before it."""
    before = [r for r in s.runs if r.start <= d]
    if not before:
        return None
    r = before[-1]
    if d <= r.end:
        return "menstrual"
    return phase_for((d - r.start).days + 1, cycle_len=s.avg_cycle,
                     period_len=s.avg_period, on_period=False)


def mood_by_phase(s: State, days: list[Day]) -> dict[str, tuple[int, int]]:
    out: dict[str, tuple[int, int]] = {}
    for d in days:
        if not d.mood and not d.feelings:
            continue
        p = phase_on(s, d.on)
        if not p:
            continue
        good = (d.mood in POSITIVE_MOODS) or bool(POSITIVE_FEELINGS & set(d.feelings))
        pos, n = out.get(p, (0, 0))
        out[p] = (pos + int(good), n + 1)
    return out


def history(s: State, months: int = 6) -> list[dict]:
    """One point per period start in the window: the length of the cycle it began."""
    starts = [r.start for r in s.runs]
    out = []
    for i, st in enumerate(starts):
        if (s.today - st).days > months * 31:
            continue
        length = (starts[i + 1] - st).days if i + 1 < len(starts) else None
        period_len = s.runs[i].length
        out.append({
            "start": st.isoformat(),
            "label": st.strftime("%b"),
            "cycle_days": length if (length and MIN_CYCLE <= length <= MAX_CYCLE) else None,
            "period_days": period_len,
        })
    return out
