"""
Saved layout — how a person has arranged their own app.

Three decisions that shape everything else:

1. **Fractions, not pixels.** A pane dragged to 380px on a 1920 monitor is
   meaningless on a 1280 laptop. Storing 0.38 of the available row survives any
   screen. Sidebar width is the one exception: it holds a pixel value because a
   navigation rail's usable width is absolute, not proportional — but it is
   clamped hard on read.

2. **Per breakpoint.** Desktop, tablet and phone are genuinely different
   layouts, not one layout scaled. Someone who widens a detail pane on a
   monitor has said nothing about what they want on a phone.

3. **Nothing here can break the app.** Every value is clamped when it is read,
   not only when written — so a row saved by an older version, or hand-edited,
   or carried over from a bigger screen, still renders something usable.
"""

from datetime import datetime, timezone
from typing import Optional

BREAKPOINTS = ["mobile", "tablet", "desktop"]

# Hard limits, applied on read. The upper bound matters as much as the lower:
# a sidebar dragged to 900px on an ultrawide would swallow a laptop screen.
SIDEBAR_MIN = 64      # icon-only rail
SIDEBAR_MAX = 420
SIDEBAR_DEFAULT = 248

PANE_MIN = 0.2        # a split pane may never fall below a fifth of the row
PANE_MAX = 0.8

CHART_MIN = 140
CHART_MAX = 640

# A widget dragged by its corner. Taller than a chart is allowed — a list of
# recent users is genuinely more useful long — but not unbounded, or one card
# can push everything else off the screen entirely.
WIDGET_MIN_H = 120
WIDGET_MAX_H = 1200


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


class LayoutModel:
    """One document per user. Small enough to fetch with the session."""

    collection_name = "user_layouts"

    @staticmethod
    def empty(user_id: str) -> dict:
        now = datetime.now(timezone.utc)
        return {
            "user_id": user_id,
            # nav: per app ("member" | "staff") -> ordering, hidden, pinned
            "nav": {},
            # sidebar width in px, per breakpoint
            "sidebar": {},
            # panes: "<screen>:<pane id>" -> fraction, per breakpoint
            "panes": {},
            # charts: "<screen>:<chart id>" -> height in px
            "charts": {},
            # columns: "<screen>:<table>" -> {column: width px}
            "columns": {},
            # widgets: "<screen>" -> [{id, span, hidden}] in display order
            "widgets": {},
            "created_at": now,
            "updated_at": now,
        }

    @staticmethod
    def to_response(doc: Optional[dict]) -> dict:
        d = doc or {}

        sidebar = {}
        for bp, value in (d.get("sidebar") or {}).items():
            if bp in BREAKPOINTS:
                try:
                    sidebar[bp] = int(clamp(float(value), SIDEBAR_MIN, SIDEBAR_MAX))
                except (TypeError, ValueError):
                    continue

        panes: dict[str, dict[str, float]] = {}
        for key, per_bp in (d.get("panes") or {}).items():
            if not isinstance(per_bp, dict):
                continue
            cleaned = {}
            for bp, value in per_bp.items():
                if bp not in BREAKPOINTS:
                    continue
                try:
                    cleaned[bp] = round(clamp(float(value), PANE_MIN, PANE_MAX), 4)
                except (TypeError, ValueError):
                    continue
            if cleaned:
                panes[key] = cleaned

        charts = {}
        for key, value in (d.get("charts") or {}).items():
            try:
                charts[key] = int(clamp(float(value), CHART_MIN, CHART_MAX))
            except (TypeError, ValueError):
                continue

        columns: dict[str, dict[str, int]] = {}
        for table, cols in (d.get("columns") or {}).items():
            if not isinstance(cols, dict):
                continue
            cleaned_cols = {}
            for col, width in cols.items():
                try:
                    cleaned_cols[col] = int(clamp(float(width), 60, 640))
                except (TypeError, ValueError):
                    continue
            if cleaned_cols:
                columns[table] = cleaned_cols

        widgets: dict[str, list] = {}
        for screen, items in (d.get("widgets") or {}).items():
            if not isinstance(items, list):
                continue
            cleaned_items = []
            for item in items:
                if not isinstance(item, dict) or not item.get("id"):
                    continue
                entry = {
                    "id": str(item["id"])[:64],
                    "span": int(clamp(int(item.get("span", 1) or 1), 1, 4)),
                    "hidden": bool(item.get("hidden", False)),
                }
                # Height is optional: a widget the user has never dragged
                # vertically has no opinion, and must fall through to whatever
                # the screen thinks it should be rather than to a stored guess.
                raw_height = item.get("height")
                if raw_height is not None:
                    try:
                        entry["height"] = int(clamp(float(raw_height), WIDGET_MIN_H, WIDGET_MAX_H))
                    except (TypeError, ValueError):
                        pass
                cleaned_items.append(entry)
            if cleaned_items:
                widgets[screen] = cleaned_items

        nav: dict[str, dict] = {}
        for app, cfg in (d.get("nav") or {}).items():
            if not isinstance(cfg, dict):
                continue
            nav[app] = {
                "order": [str(x)[:80] for x in (cfg.get("order") or []) if x][:80],
                "hidden": [str(x)[:80] for x in (cfg.get("hidden") or []) if x][:80],
                "pinned": [str(x)[:80] for x in (cfg.get("pinned") or []) if x][:20],
                "collapsed": bool(cfg.get("collapsed", False)),
                # The member app's five phone tabs, chosen by her.
                "tabs": [str(x)[:80] for x in (cfg.get("tabs") or []) if x][:5],
            }

        return {
            "nav": nav,
            "sidebar": sidebar,
            "panes": panes,
            "charts": charts,
            "columns": columns,
            "widgets": widgets,
        }
