"""
Entitlements — what a given account is allowed to use.

Built now because retrofitting a permission seam through finished features is
painful, and because keeping the *option* to charge costs almost nothing today.

The important decision encoded here: **everything personal is free.**

This platform has a support fund precisely because its members cannot afford
programme fees. Charging those same women to reorder their own menu or choose
their own colours would sit badly against that. Some of it isn't decoration at
all — contrast and text size are accessibility, and putting accessibility
behind a paywall is both wrong and, in several jurisdictions, a legal exposure.

So the money, if it ever comes, comes from ORGANISATIONS: another NGO licensing
this platform and wanting their own brand, their own logo, and layout templates
pushed to their whole team. That is a real thing a buyer pays for.

Moving any feature to a paid tier later is a one-line change to FEATURES below.
"""

from enum import Enum


class Scope(str, Enum):
    """Who gets a feature. Ordered: each tier includes the ones before it."""

    FREE = "free"
    PRO = "pro"
    ORG = "org"


ORDER = [Scope.FREE, Scope.PRO, Scope.ORG]


class Feature(str, Enum):
    # --- personal: free, and intended to stay that way -----------------------
    THEME_PRESETS = "theme.presets"
    THEME_CUSTOM = "theme.custom"
    TEXT_SIZE = "a11y.text_size"
    HIGH_CONTRAST = "a11y.contrast"
    LAYOUT_NAV = "layout.nav"            # reorder / hide / pin nav items
    LAYOUT_RESIZE = "layout.resize"      # sidebar, split panes, charts, columns
    LAYOUT_WIDGETS = "layout.widgets"    # dashboard widget grid

    # --- organisation: the things a licensee actually pays for ---------------
    ORG_BRANDING = "org.branding"        # own logo and wordmark
    ORG_DEFAULT_THEME = "org.default_theme"   # a platform-wide starting palette
    ORG_LAYOUT_TEMPLATES = "org.layout_templates"  # push a layout to a whole role
    ORG_CUSTOM_DOMAIN = "org.custom_domain"


FEATURES: dict[Feature, Scope] = {
    # Personal customisation — free for everyone, deliberately.
    Feature.THEME_PRESETS: Scope.FREE,
    Feature.THEME_CUSTOM: Scope.FREE,
    Feature.TEXT_SIZE: Scope.FREE,
    Feature.HIGH_CONTRAST: Scope.FREE,
    Feature.LAYOUT_NAV: Scope.FREE,
    Feature.LAYOUT_RESIZE: Scope.FREE,
    Feature.LAYOUT_WIDGETS: Scope.FREE,
    # Organisation-level — where a licence fee would apply.
    Feature.ORG_BRANDING: Scope.ORG,
    Feature.ORG_DEFAULT_THEME: Scope.ORG,
    Feature.ORG_LAYOUT_TEMPLATES: Scope.ORG,
    Feature.ORG_CUSTOM_DOMAIN: Scope.ORG,
}


def scope_of(user: dict) -> Scope:
    """
    The tier this account sits in.

    Read from the account so it can be raised per-customer without a deploy.
    Anything unrecognised falls back to FREE rather than silently granting more
    than intended.
    """
    raw = (user or {}).get("entitlement") or Scope.FREE.value
    try:
        return Scope(raw)
    except ValueError:
        return Scope.FREE


def allows(user: dict, feature: Feature) -> bool:
    required = FEATURES.get(feature, Scope.ORG)
    return ORDER.index(scope_of(user)) >= ORDER.index(required)


def enabled_features(user: dict) -> dict[str, bool]:
    """The whole map, so a client can render without asking per feature."""
    return {f.value: allows(user, f) for f in Feature}
