"""Generate the source inventory referenced by docs/MODULES_AND_FEATURES.md.

Uses source files only: does not import the application, read environment files,
connect to the database or start services. Run from any working directory.
"""
from __future__ import annotations

import ast
import re
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAGES = ROOT / "womencrafts-frontend/frontend/src/app"
BACKEND = ROOT / "womencrafts-backend/backend"
OUTPUT = ROOT / "docs/MODULE_TECHNICAL_INVENTORY.md"
HTTP_METHODS = {"get", "post", "put", "patch", "delete", "head", "options"}


def link(path: Path) -> str:
    return f"[{path.relative_to(ROOT)}](<../{path.relative_to(ROOT).as_posix()}>)"


def page_route(path: Path) -> str:
    parts = path.relative_to(PAGES).parts[:-1]
    return "/" + "/".join(p for p in parts if not p.startswith("("))


def category(route: str) -> str:
    if route == "/app" or route.startswith("/app/"):
        return "Member"
    if route == "/dashboard" or route.startswith("/dashboard/"):
        return "Staff"
    return "Authentication, public and other"


def routers(path: Path) -> dict[str, dict]:
    tree = ast.parse(path.read_text())
    found: dict[str, dict] = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or not isinstance(node.value, ast.Call):
            continue
        if not isinstance(node.value.func, ast.Name) or node.value.func.id != "APIRouter":
            continue
        kwargs = {k.arg: k.value for k in node.value.keywords}
        for target in node.targets:
            if isinstance(target, ast.Name):
                prefix = ast.literal_eval(kwargs["prefix"]) if "prefix" in kwargs else ""
                found[target.id] = {"prefix": prefix, "operations": 0}
    for node in ast.walk(tree):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for deco in node.decorator_list:
            if not isinstance(deco, ast.Call) or not isinstance(deco.func, ast.Attribute):
                continue
            owner = deco.func.value
            if isinstance(owner, ast.Name) and owner.id in found and deco.func.attr in HTTP_METHODS:
                found[owner.id]["operations"] += 1
    return found


def generate() -> str:
    pages = sorted(PAGES.rglob("page.tsx"), key=lambda p: (page_route(p), str(p)))
    counts = Counter(category(page_route(p)) for p in pages)
    main = BACKEND / "main.py"
    tree = ast.parse(main.read_text())
    imports: dict[str, tuple[Path, str]] = {}
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("app.routes."):
            source = BACKEND / (node.module.replace(".", "/") + ".py")
            for alias in node.names:
                imports[alias.asname or alias.name] = (source, alias.name)
    registered = []
    cache: dict[Path, dict] = {}
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
            continue
        if node.func.attr != "include_router" or not node.args or not isinstance(node.args[0], ast.Name):
            continue
        name = node.args[0].id
        if name not in imports:
            raise ValueError(f"Unresolved router registration: {name}")
        source, symbol = imports[name]
        if source not in cache:
            cache[source] = routers(source)
        info = cache[source][symbol]
        kwargs = {k.arg: k.value for k in node.keywords}
        prefix = ast.literal_eval(kwargs["prefix"]) if "prefix" in kwargs else ""
        deps = kwargs.get("dependencies")
        module = ""
        if isinstance(deps, ast.Call) and isinstance(deps.func, ast.Name) and deps.func.id == "_mod":
            module = ast.literal_eval(deps.args[0])
        registered.append((prefix + info["prefix"], name, source, info["operations"], module))
    lines = [
        "# WomSakhi technical module inventory", "",
        "Generated from the working-tree source by `python3 scripts/generate_module_inventory.py`.",
        f"Snapshot generated: **{date.today().isoformat()}**. No application or database imports are executed.", "",
        "Start with the [module and feature guide](MODULES_AND_FEATURES.md) for product behaviour and user journeys.", "",
        "## Counting rules", "",
        "- A page is one `page.tsx` file under the frontend App Router, including redirects and dynamic detail pages.",
        "- `[id]`, `[handle]` and similar segments are parameters, not literal IDs.",
        "- Route groups such as `(auth)` do not appear in the browser URL.",
        "- Tabs, dialogs, loading/error files and API route handlers are not additional pages in this count.",
        "- A backend operation is one HTTP-method decorator on a registered router, including hidden-schema operations.",
        "- Router prefixes below include `/api/v1`; a prefix alone need not have a directly callable GET endpoint.",
        "- The registration-level permission column is not a complete access policy. Endpoint dependencies and internal guards also apply.", "",
        "## Summary", "", "| Area | Page files |", "| --- | ---: |",
    ]
    lines += [f"| {group} | {counts[group]} |" for group in ["Member", "Staff", "Authentication, public and other"]]
    lines += [f"| Total | {len(pages)} |", "", f"Registered router objects: **{len(registered)}**. HTTP operations on those routers: **{sum(row[3] for row in registered)}**.", ""]
    for group in ["Member", "Staff", "Authentication, public and other"]:
        lines += [f"## {group} pages", "", "| Browser route | Source | Notes |", "| --- | --- | --- |"]
        for p in pages:
            route = page_route(p)
            if category(route) != group:
                continue
            notes = []
            if "[" in route:
                notes.append("Parameterized route")
            if re.search(r"\b(?:permanentRedirect|redirect)\s*\(", p.read_text()):
                notes.append("Contains a redirect")
            lines.append(f"| `{route}` | {link(p)} | {'; '.join(notes)} |")
        lines.append("")
    lines += ["## Registered backend router families", "", "Source: [main.py](../womencrafts-backend/backend/main.py). Inspect endpoint dependencies and schemas before using an operation.", "", "| API prefix | Registered router | Operations | Registration module gate | Source |", "| --- | --- | ---: | --- | --- |"]
    for prefix, name, source, operations, module in sorted(registered):
        lines.append(f"| `{prefix or '/'}` | `{name}` | {operations} | {f'`{module}`' if module else 'Endpoint-specific; inspect source'} | {link(source)} |")
    lines += ["", "## Developer reference", "", "- Interactive local API docs: `http://localhost:8020/docs`; schema: `http://localhost:8020/openapi.json`.", "- Frontend member navigation: [nav-tree.ts](../womencrafts-frontend/frontend/src/components/ux/nav-tree.ts).", "- Frontend staff navigation: [Sidebar.tsx](../womencrafts-frontend/frontend/src/components/layout/Sidebar.tsx).", "- Frontend permission catalogue: [modules.ts](../womencrafts-frontend/frontend/src/lib/modules.ts).", "- Backend validation contracts: `womencrafts-backend/backend/app/schemas/`.", "- For source changes, regenerate this inventory and update the prose guide when behaviour changes.", ""]
    return "\n".join(lines)


if __name__ == "__main__":
    OUTPUT.write_text(generate())
    print(f"Generated {OUTPUT.relative_to(ROOT)}")
