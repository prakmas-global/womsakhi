"""
Staff side of the reference catalogue (schemes, cover, health, rights, family, travel, guidance) and the wellbeing cards.

Every endpoint is behind the "resources" module guard (main.py) and names its
action (resources.view / .edit / ...); every write is audited.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/admin/resources", tags=["Resources catalogue (staff)"])
