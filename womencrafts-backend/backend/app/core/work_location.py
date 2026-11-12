"""Town/area matching, without claiming a GPS distance we do not store."""
import re


def clean_place(value: str) -> str:
    return " ".join((value or "").split())


def place_query(field: str, value: str, *, legacy: bool = True) -> dict:
    value = clean_place(value)
    exact = {"$regex": "^" + re.escape(value) + "$", "$options": "i"}
    if not legacy:
        return {field: exact}
    # Old staff listings store only a display location. Match whole place
    # names there; never override an explicitly different structured town.
    return {"$or": [{field: exact}, {"$and": [
        {"$or": [{field: ""}, {field: None}]},
        {"location": {"$regex": r"(?<!\w)" + re.escape(value) + r"(?!\w)", "$options": "i"}},
    ]}]}
