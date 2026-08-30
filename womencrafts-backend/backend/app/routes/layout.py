"""
Saved layout — how a person has arranged her own app.

Everything here is **per user, taken from the token**. There is no endpoint for
setting someone else's layout: unlike colours, which staff can set on a support
call, a rearranged workspace is not something anyone can usefully choose on
another person's behalf.

## Why so many small PATCH endpoints instead of one PUT

A single "save the whole layout" endpoint loses work.

Layout changes arrive constantly and from several places at once — she drags the
sidebar on one screen while a second tab still holds the layout as it was ten
minutes ago. Whichever tab saves last would overwrite the other's changes with
stale data, and the change that vanished would be one she made deliberately.

So each endpoint writes exactly the keys it owns, using dotted `$set` paths.
Two tabs editing different things both win. Two tabs editing the *same* pane is
last-write-wins, which is correct — that genuinely is one preference.

## Everything is clamped on the way out

`LayoutModel.to_response()` clamps every value on read, not just on write, so a
row saved by an older build or edited by hand can still only ever produce a
usable app. See `app/models/layout.py`.
"""

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

from app.core.deps import get_current_user
from app.core.entitlements import Feature, enabled_features
from app.core.rbac import require_feature
from app.db.mongodb import get_database
from app.models.layout import (
    BREAKPOINTS,
    CHART_MAX,
    CHART_MIN,
    LayoutModel,
    PANE_MAX,
    PANE_MIN,
    SIDEBAR_MAX,
    SIDEBAR_MIN,
    WIDGET_MAX_H,
    WIDGET_MIN_H,
)

router = APIRouter(prefix="/layout", tags=["Layout"])


def _layouts():
    return get_database()[LayoutModel.collection_name]


async def _read(user_id: str) -> dict:
    return LayoutModel.to_response(await _layouts().find_one({"user_id": user_id}))


async def _write(user_id: str, changes: dict) -> dict:
    """
    Upsert the given dotted paths and return the whole layout.

    `$setOnInsert` seeds the timestamps only when the document is created, so a
    routine sidebar drag doesn't rewrite `created_at`.
    """
    now = datetime.now(timezone.utc)
    await _layouts().update_one(
        {"user_id": user_id},
        {
            "$set": {**changes, "updated_at": now},
            "$setOnInsert": {"user_id": user_id, "created_at": now},
        },
        upsert=True,
    )
    return await _read(user_id)


# --------------------------------------------------------------------------- #
# Request bodies
# --------------------------------------------------------------------------- #

def _trim(values: list[str], limit: int) -> list[str]:
    """
    Cut an over-long list down rather than refusing the save.

    Same reasoning as clamping a width: an over-length list is a client that
    got ahead of itself, and failing the whole request would throw away the
    other changes in it. It is also what `to_response()` does on read — write
    and read must agree, or a value can be accepted and then silently altered.
    """
    return [str(v)[:80] for v in values if v][:limit]


class NavConfig(BaseModel):
    """How one app's navigation is arranged. `app` is "member" or "staff"."""

    order: list[str] = Field(default_factory=list)
    hidden: list[str] = Field(default_factory=list)
    pinned: list[str] = Field(default_factory=list)
    collapsed: bool = False
    # The member app's five phone tabs, chosen by her.
    tabs: list[str] = Field(default_factory=list)

    @field_validator("order", "hidden")
    @classmethod
    def cap_long_lists(cls, v: list[str]) -> list[str]:
        return _trim(v, 80)

    @field_validator("pinned")
    @classmethod
    def cap_pinned(cls, v: list[str]) -> list[str]:
        return _trim(v, 20)

    @field_validator("tabs")
    @classmethod
    def cap_tabs(cls, v: list[str]) -> list[str]:
        # The phone bar holds five. A sixth has nowhere to render.
        return _trim(v, 5)


class SidebarWidth(BaseModel):
    breakpoint: str
    width: int

    @field_validator("breakpoint")
    @classmethod
    def known_breakpoint(cls, v: str) -> str:
        if v not in BREAKPOINTS:
            raise ValueError(f"breakpoint must be one of {BREAKPOINTS}")
        return v

    @field_validator("width")
    @classmethod
    def in_range(cls, v: int) -> int:
        # Clamp rather than reject. A width slightly out of bounds is a drag
        # that went a few pixels too far, not an error worth failing a save for.
        return max(SIDEBAR_MIN, min(SIDEBAR_MAX, v))


class PaneSize(BaseModel):
    """`key` is "<screen>:<pane id>", e.g. "members:list"."""

    key: str = Field(max_length=120)
    breakpoint: str
    fraction: float

    @field_validator("breakpoint")
    @classmethod
    def known_breakpoint(cls, v: str) -> str:
        if v not in BREAKPOINTS:
            raise ValueError(f"breakpoint must be one of {BREAKPOINTS}")
        return v

    @field_validator("fraction")
    @classmethod
    def in_range(cls, v: float) -> float:
        return round(max(PANE_MIN, min(PANE_MAX, v)), 4)


class ChartHeight(BaseModel):
    key: str = Field(max_length=120)
    height: int

    @field_validator("height")
    @classmethod
    def in_range(cls, v: int) -> int:
        return max(CHART_MIN, min(CHART_MAX, v))


class ColumnWidths(BaseModel):
    """`key` is "<screen>:<table>"; widths are column name -> pixels."""

    key: str = Field(max_length=120)
    widths: dict[str, int]

    @field_validator("widths")
    @classmethod
    def in_range(cls, v: dict[str, int]) -> dict[str, int]:
        return {k[:80]: max(60, min(640, int(w))) for k, w in list(v.items())[:40]}


class Widget(BaseModel):
    id: str = Field(max_length=64)
    span: int = 1
    hidden: bool = False
    # None means "never dragged vertically" — the screen's own default applies.
    height: Optional[int] = None

    @field_validator("span")
    @classmethod
    def span_in_range(cls, v: int) -> int:
        # The widget grid is four columns wide at desktop. Span 5 is meaningless.
        return max(1, min(4, v))

    @field_validator("height")
    @classmethod
    def height_in_range(cls, v: Optional[int]) -> Optional[int]:
        if v is None:
            return None
        return max(WIDGET_MIN_H, min(WIDGET_MAX_H, v))


class WidgetLayout(BaseModel):
    """`screen` identifies the dashboard; `widgets` is the full display order."""

    screen: str = Field(max_length=120)
    widgets: list[Widget] = Field(default_factory=list)

    @field_validator("widgets")
    @classmethod
    def cap(cls, v: list[Widget]) -> list[Widget]:
        return v[:40]


# --------------------------------------------------------------------------- #
# Read
# --------------------------------------------------------------------------- #

@router.get("/me", summary="My saved layout")
async def my_layout(me: dict = Depends(get_current_user)):
    """
    Fetched once with the session and handed to the layout engine.

    It has to arrive before first paint, or the app visibly rearranges itself a
    moment after load — which reads as a bug even though the end state is right.
    """
    return await _read(str(me["_id"]))


@router.get("/me/features", summary="What my plan includes")
async def my_features(me: dict = Depends(get_current_user)):
    """
    The whole entitlement map in one call, so no screen needs a round trip to
    decide what to render and there's no per-feature request waterfall.

    Today every personal feature is true for everyone.
    """
    return enabled_features(me)


# --------------------------------------------------------------------------- #
# Write — one endpoint per thing that can change
# --------------------------------------------------------------------------- #

@router.put("/me/nav/{app}", summary="Reorder, hide or pin my navigation")
async def set_nav(
    app: str,
    body: NavConfig,
    me: dict = Depends(require_feature(Feature.LAYOUT_NAV)),
):
    """
    `app` is "member" or "staff" — the two navigations are independent, because
    someone may be both a member and staff and wants different things of each.

    Nav is written whole rather than per-item: reordering *is* an operation on
    the entire list, so there is no partial update to preserve.
    """
    key = app if app in ("member", "staff") else "member"
    return await _write(str(me["_id"]), {f"nav.{key}": body.model_dump()})


@router.put("/me/sidebar", summary="Set my sidebar width")
async def set_sidebar(
    body: SidebarWidth,
    me: dict = Depends(require_feature(Feature.LAYOUT_RESIZE)),
):
    return await _write(str(me["_id"]), {f"sidebar.{body.breakpoint}": body.width})


@router.put("/me/pane", summary="Set a split pane's size")
async def set_pane(
    body: PaneSize,
    me: dict = Depends(require_feature(Feature.LAYOUT_RESIZE)),
):
    """
    Stored as a fraction of the row, per breakpoint — a pane dragged to 380px on
    a 1920 monitor is a fifth of the row there and the whole screen on a phone.
    She said "about a fifth", not "380 pixels".
    """
    return await _write(
        str(me["_id"]), {f"panes.{body.key}.{body.breakpoint}": body.fraction}
    )


@router.put("/me/chart", summary="Set a chart's height")
async def set_chart(
    body: ChartHeight,
    me: dict = Depends(require_feature(Feature.LAYOUT_RESIZE)),
):
    return await _write(str(me["_id"]), {f"charts.{body.key}": body.height})


@router.put("/me/columns", summary="Set a table's column widths")
async def set_columns(
    body: ColumnWidths,
    me: dict = Depends(require_feature(Feature.LAYOUT_RESIZE)),
):
    return await _write(str(me["_id"]), {f"columns.{body.key}": body.widths})


@router.put("/me/widgets", summary="Rearrange a dashboard's widgets")
async def set_widgets(
    body: WidgetLayout,
    me: dict = Depends(require_feature(Feature.LAYOUT_WIDGETS)),
):
    return await _write(
        str(me["_id"]),
        {f"widgets.{body.screen}": [w.model_dump() for w in body.widgets]},
    )


# --------------------------------------------------------------------------- #
# Reset
# --------------------------------------------------------------------------- #

@router.delete("/me", summary="Reset my whole layout")
async def reset_all(me: dict = Depends(get_current_user)):
    """
    Everything back to default.

    Deliberately guarded by nothing but sign-in. Whatever her plan is, and
    however she got into a mess, she can always get out of it — the way back is
    never the thing that's locked. See "Cannot trap yourself".
    """
    await _layouts().delete_one({"user_id": str(me["_id"])})
    return await _read(str(me["_id"]))


@router.delete("/me/screen/{screen}", summary="Reset one screen's layout")
async def reset_screen(screen: str, me: dict = Depends(get_current_user)):
    """
    Drops panes, charts, columns and widgets belonging to this screen and leaves
    navigation and sidebar alone — those are app-wide, not part of the screen
    she is trying to put back.
    """
    user_id = str(me["_id"])
    doc = await _layouts().find_one({"user_id": user_id})
    if not doc:
        return await _read(user_id)

    prefix = f"{screen}:"
    unset: dict[str, str] = {}
    for group in ("panes", "charts", "columns"):
        for key in (doc.get(group) or {}):
            if key.startswith(prefix):
                # Mongo dotted paths use '.' as a separator, so a key containing
                # one would address the wrong field. Screen and pane ids are
                # colon-joined for exactly this reason; anything else is skipped.
                if "." in key:
                    continue
                unset[f"{group}.{key}"] = ""
    if screen in (doc.get("widgets") or {}) and "." not in screen:
        unset[f"widgets.{screen}"] = ""

    if unset:
        await _layouts().update_one({"user_id": user_id}, {"$unset": unset})
    return await _read(user_id)


@router.delete("/me/nav/{app}", summary="Reset one app's navigation")
async def reset_nav(app: str, me: dict = Depends(get_current_user)):
    key = app if app in ("member", "staff") else "member"
    await _layouts().update_one(
        {"user_id": str(me["_id"])}, {"$unset": {f"nav.{key}": ""}}
    )
    return await _read(str(me["_id"]))
