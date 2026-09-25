"""
Every admin endpoint is guarded, and every guard names a real permission.

── The two layers ─────────────────────────────────────────────────────────
Access is checked twice, and both halves have to be present.

**Module**, at registration: `main.py` wraps 20 routers in
`dependencies=_mod("users")`, so a role without that module cannot reach any
endpoint in the file. This was already here and works.

**Action**, per endpoint: `require_permission("users.delete")`. This was the
missing half — most endpoints had only `get_current_user`, so any staff
account with the module could do everything in it, and a Support Agent who
could open People could also delete from it.

Guards were added across the route files, and the way that decays is the same
way it happened the first time: somebody adds an endpoint in a hurry and nobody
notices it has no dependency on it. So the rule is asserted here, and a new
unguarded admin endpoint fails the build.

── What counts as guarded ─────────────────────────────────────────────────
Any of `require_permission`, `require_super_admin`, `require_staff`,
`require_active_member` or `require_member`, in the decorator or the function
signature — both are used in this codebase and both work.

── What is deliberately exempt ────────────────────────────────────────────
`EXEMPT` below is the allow-list, and every entry is there for a stated
reason. Adding to it is a decision someone has to write down, which is the
point: a list of exceptions nobody can explain is not a policy.
"""

import pathlib
import re

import pytest

from app.core.permissions import CATALOGUE, all_permissions

ROUTES = pathlib.Path(__file__).resolve().parents[1] / "app" / "routes"

GUARDS = (
    "require_permission",
    "require_super_admin",
    "require_staff",
    "require_active_member",
    "require_member",
    # `require_feature` is org.py's licensing gate; its inner dependency is
    # `require_super_admin`, so an endpoint behind it is already the most
    # restricted thing in the product.
    "require_feature",
)

MAIN = pathlib.Path(__file__).resolve().parents[1] / "main.py"


def _module_gated() -> set[str]:
    """
    Router stems that `main.py` registers behind `module_guard`.

    Their endpoints are already unreachable for a role without the module, so
    a read inside one is adequately guarded even with no per-endpoint
    dependency. A WRITE still needs its own action check, which is what the
    test below insists on.
    """
    src = MAIN.read_text()
    gated = set()
    for m in re.finditer(r'app\.include_router\((\w+)_router,[^)]*dependencies=_mod\(', src):
        gated.add(m.group(1))
    return gated

#: Endpoints that must stay reachable without a role check, and why.
EXEMPT = {
    # Signed out by definition — this is how you get a session at all.
    "auth.signup", "auth.signin", "auth.refresh", "auth.session",
    "auth.get_me", "auth.signout", "auth.signout_everywhere",
    "auth.forgot_password", "auth.reset_password",
    # She has no account to sign in with yet; the token is the credential.
    "staff.accept_invite",
    # Called by the payment provider, not by a person. Guarded by signature
    # verification rather than by a role.
    "payments.webhook",
    # Deliberately public: a woman in danger must reach these without an
    # account, and without being counted.
    "safety.helplines",
    # Her own account and her own device settings. Both apps use these, and
    # the object they act on is always the caller herself.
    "users.get_me", "users.update_profile", "users.change_password",
    "verification.my_status", "verification.resend_email",
    "verification.confirm_email", "verification.upload_document",
    "theme.my_theme", "theme.set_my_theme", "theme.onboarding_state",
    "theme.finish_step", "theme.finish_onboarding",
    "uploads.upload_file", "uploads.list_uploads", "uploads.upload_stats",
    "uploads.delete_upload",
    "roles.my_permissions", "roles.permission_catalogue",
}

#: Prefixes whose whole file is member-facing. These sit behind the member
#: gate in their own way and are not part of the admin surface.
MEMBER_FILES = {"engines", "layout", "notifications", "me", "me_export", "public"}

DECORATOR = re.compile(
    r'@router\.(get|post|put|patch|delete)\((.*?)\n(?:async )?def (\w+)\((.*?)\):',
    re.S,
)
PERMISSION = re.compile(r'require_permission\(\s*"([^"]+)"')


def _endpoints():
    """Every route handler, with the text that could carry its guard."""
    for path in sorted(ROUTES.glob("*.py")):
        if path.stem in MEMBER_FILES:
            continue
        src = path.read_text()
        for m in DECORATOR.finditer(src):
            yield f"{path.stem}.{m.group(3)}", m.group(2) + m.group(4), m.group(1)


def test_every_admin_endpoint_has_a_guard():
    gated = _module_gated()
    unguarded = []
    for name, blob, method in _endpoints():
        if name in EXEMPT or any(g in blob for g in GUARDS):
            continue
        stem = name.split(".", 1)[0]
        # A read inside a module-gated router is covered by that gate. A write
        # is not: the module decides what she can open, not what she can do.
        if stem in gated and method == "get":
            continue
        unguarded.append(name)
    assert not unguarded, (
        "These endpoints check only that somebody is signed in:\n  "
        + "\n  ".join(unguarded)
        + "\n\nGive each one a `require_permission(\"module.action\")`, or add it to "
          "EXEMPT with the reason."
    )


def test_every_named_permission_exists():
    """
    A guard naming a permission the catalogue does not define is worse than no
    guard: it refuses everyone including the people who should get through,
    and it reads as protection while protecting nothing.
    """
    known = set(all_permissions())
    bad = []
    for path in sorted(ROUTES.glob("*.py")):
        for m in PERMISSION.finditer(path.read_text()):
            if m.group(1) not in known:
                bad.append(f"{path.stem}: {m.group(1)}")
    assert not bad, "Guards naming permissions that do not exist:\n  " + "\n  ".join(bad)


@pytest.mark.parametrize("module", sorted(CATALOGUE))
def test_view_is_offered_wherever_anything_else_is(module):
    """
    Nobody should be able to edit something they cannot see. The catalogue is
    what the UI renders, so the rule is enforced at its source rather than
    left to whoever builds the toggles.
    """
    _, actions = CATALOGUE[module]
    if actions and actions != ["view"]:
        assert "view" in actions, f"{module} offers {actions} but not view"
