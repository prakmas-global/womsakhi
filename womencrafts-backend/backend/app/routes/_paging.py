"""
One page of rows and the total that goes under it, in a single query.

Every list screen in this API was built the same way, and the way is wrong:

    total = await coll.count_documents(query)
    cursor = coll.find(query).sort(...).skip(...).limit(page_size)

That is the same filter sent to the database twice, and — because `count`
must come back before `find` is even sent — it is two *round trips*. Against
the Atlas cluster this API talks to, a round trip costs about 22ms whatever it
fetches. The queries themselves run in roughly zero: these collections hold
hundreds of documents, not millions. So the second trip was the entire cost of
counting, and it bought a number the first query could have returned alongside
the rows.

`$facet` runs both branches over one `$match` and returns them in one document.
Thirteen list endpoints, thirteen round trips saved, no behaviour changed.

**Why this lives in `app/routes/` and not in `app/core/serializers.py`, next to
`page_meta`, where it obviously belongs.** Because it does not belong to this
change. `app/core/` is owned by someone else working in this repo at the same
time, and a helper landing in a file two people are editing is a merge conflict
that costs more than the import line saves. Move it when the two of you are not
both mid-flight.

**When NOT to use this.** `$facet` assembles its whole result as one BSON
document, and BSON documents cap at 16MB. Every caller here pages at 100 rows
or fewer, which is nowhere near it. A caller that wants thousands of rows in a
page wants a plain cursor, not this.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, Union

#: What Motor's `.sort()` accepts, in any of its three shapes.
SortSpec = Union[str, Mapping[str, int], Sequence[tuple[str, int]]]


def sort_doc(spec: SortSpec, direction: int = 1) -> dict[str, int]:
    """
    Normalise a `.sort()` argument into the `$sort` stage's document form.

    `find().sort()` takes `("name", -1)` or `[("a", 1), ("b", -1)]`; `$sort`
    only takes `{"a": 1, "b": -1}`. Python dicts keep insertion order, so a
    multi-key sort survives the translation with its precedence intact — which
    is the whole reason a plain `dict(spec)` is not good enough to write
    without saying so.
    """
    if isinstance(spec, str):
        return {spec: direction}
    if isinstance(spec, Mapping):
        return dict(spec)
    return {field: int(order) for field, order in spec}


async def paged(
    collection,
    query: dict,
    *,
    sort: SortSpec,
    direction: int = 1,
    page: int,
    page_size: int,
    projection: Optional[dict] = None,
) -> tuple[int, list[dict]]:
    """
    → `(total matching the filter, the rows on this page)`, in one round trip.

    A drop-in for `count_documents` + `find().sort().skip().limit()`. The count
    is of everything matching `query`, not of the page — same as before, and
    the reason the footer can say "showing 1–10 of 240".

    `total` comes back as 0 when nothing matches, because `$count` emits no
    document at all rather than a zero, and a `KeyError` on an empty list
    screen is a worse bug than the one this replaces.
    """
    items: list[dict[str, Any]] = [
        {"$sort": sort_doc(sort, direction)},
        {"$skip": max(0, (page - 1) * page_size)},
        {"$limit": page_size},
    ]
    if projection:
        items.append({"$project": projection})

    rows = await collection.aggregate([
        {"$match": query},
        {"$facet": {"total": [{"$count": "n"}], "items": items}},
    ]).to_list(1)

    facet = rows[0] if rows else {}
    counted = facet.get("total") or []
    return (int(counted[0]["n"]) if counted else 0), list(facet.get("items") or [])
