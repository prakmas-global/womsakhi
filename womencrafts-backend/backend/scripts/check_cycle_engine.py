"""
The cycle engine, checked against the cases that break trackers.

Runs in well under a second with no database:

    ./venv/bin/python scripts/check_cycle_engine.py

Every case here is a way a real woman's log goes wrong — a forgotten
check-in, a period that runs long, a late one, a setup answer and no history.
If one of these fails, the screen will tell her something false about her body.
"""

import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.cycle import Day, compute, insights, marks_for_month, runs  # noqa: E402

T = date(2026, 9, 19)
failures = 0


def check(name: str, got, want) -> None:
    global failures
    ok = got == want
    failures += not ok
    print(f"{'ok  ' if ok else 'FAIL'} {name}: got {got!r}" + ("" if ok else f", want {want!r}"))


def period(start: date, n: int, *, then_no: bool = True) -> list[Day]:
    out = [Day(start + timedelta(days=i), True) for i in range(n)]
    if then_no:
        out.append(Day(start + timedelta(days=n), False))
    return out


# 1. Three regular 28-day cycles, now on day 18.
last = T - timedelta(days=17)
days = (period(last - timedelta(days=56), 5) + period(last - timedelta(days=28), 5)
        + period(last, 5))
s = compute(days, T)
check("regular: cycle day", s.cycle_day, 18)
check("regular: avg cycle", s.avg_cycle, 28)
check("regular: avg period", s.avg_period, 5)
check("regular: not on period", s.on_period, False)
check("regular: next in 11 days (day 29 = next day 1)", s.days_until, 11)
check("regular: ovulation is day 14", (s.ovulation - last).days + 1, 14)
check("regular: fertile window days 9-14",
      ((s.fertile_start - last).days + 1, (s.fertile_end - last).days + 1), (9, 14))
check("regular: phase", s.phase, "luteal")
check("regular: insight says regular", any("regular" in i["text"] for i in insights(s, days)), True)

# 2. A forgotten check-in does not split the period.
d2 = [Day(T - timedelta(days=3), True), Day(T - timedelta(days=1), True)]
check("gap of one day: one run", len(runs(d2)), 1)
s2 = compute(d2, T)
check("gap of one day: still on, day 4", (s2.on_period, s2.period_day), (True, 4))

# 3. An explicit "no" ends it.
d3 = [Day(T - timedelta(days=3), True), Day(T - timedelta(days=2), False), Day(T - timedelta(days=1), True)]
check("no in between: two runs", len(runs(d3)), 2)

# 4. Running long: day 6 is "long", day 8 is "doctor".
d4 = [Day(T - timedelta(days=i), True) for i in range(6)]
check("day 6 of period", compute(d4, T).period_day, 6)
check("day 6 → long", compute(d4, T).long_level, "long")
d4b = [Day(T - timedelta(days=i), True) for i in range(8)]
check("day 8 → doctor", compute(d4b, T).long_level, "doctor")
d4c = [Day(T - timedelta(days=i), True) for i in range(5)]
check("day 5 → nothing yet", compute(d4c, T).long_level, None)

# 5. Her usual is 7 days — day 6 is her normal, not an alert.
long_usual = (period(T - timedelta(days=61), 7) + period(T - timedelta(days=33), 7)
              + [Day(T - timedelta(days=i), True) for i in range(6)])
s5 = compute(long_usual, T)
check("usual 7 days: day 6 not flagged", s5.long_level, None)

# 6. Late: last start 33 days ago on a 28-day cycle.
d6 = period(T - timedelta(days=61), 5) + period(T - timedelta(days=33), 5)
s6 = compute(d6, T)
check("late: days_until", s6.days_until, -5)
check("late: insight", any("later than expected" in i["text"] for i in insights(s6, d6)), True)

# 7. Setup only: she said no today, last one started 10 days ago.
d7 = [Day(T, False)]
s7 = compute(d7, T, declared_last_start=T - timedelta(days=10))
check("setup: not on period", s7.on_period, False)
check("setup: cycle day 11", s7.cycle_day, 11)
check("setup: next in 18", s7.days_until, 18)
m7 = marks_for_month(s7, 2026, 9)
check("setup: declared period drawn",
      m7.get(T - timedelta(days=10)), ["period"])
check("setup: today not marked period", "period" in m7.get(T, []), False)

# 8. Setup + she is on her period today → her log wins.
d8 = [Day(T, True)]
s8 = compute(d8, T, declared_last_start=T - timedelta(days=30))
check("setup then yes: day 1", (s8.on_period, s8.period_day), (True, 1))

# 9. Irregular: 24, 35, 29 → varies by 11.
starts = [T - timedelta(days=x) for x in (100, 76, 41, 12)]
d9 = sum((period(st, 5) for st in starts), [])
s9 = compute(d9, T)
check("irregular flagged", any("varies" in i["text"] for i in insights(s9, d9)), True)

# 10. Predictions never mark the past.
m10 = marks_for_month(s, 2026, 9)
check("no predicted day in the past",
      [d for d, ms in m10.items() if "predicted" in ms and d <= T], [])

# 11. Nothing logged at all.
s11 = compute([], T)
check("empty: no history", (s11.has_history, s11.next_start), (False, None))

print(f"\n{failures} failure(s)")
sys.exit(1 if failures else 0)
