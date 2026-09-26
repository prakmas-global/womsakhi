"""Guard the startup index catalogue against silent Python dict overwrites."""

import ast
from pathlib import Path


def test_index_catalogue_has_no_duplicate_collection_keys() -> None:
    source_path = Path(__file__).parents[1] / "app" / "db" / "indexes.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    assignment = next(
        node
        for node in tree.body
        if isinstance(node, ast.AnnAssign)
        and isinstance(node.target, ast.Name)
        and node.target.id == "INDEXES"
    )
    assert isinstance(assignment.value, ast.Dict)

    keys = [
        key.value
        for key in assignment.value.keys
        if isinstance(key, ast.Constant) and isinstance(key.value, str)
    ]
    duplicates = sorted({key for key in keys if keys.count(key) > 1})
    assert duplicates == [], f"duplicate INDEXES keys silently overwrite entries: {duplicates}"
