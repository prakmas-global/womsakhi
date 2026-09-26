"""
Staff side of learning: assessments, digital-literacy steps and certificates.

Every endpoint is behind the "learning" module guard (main.py) and names its
action (learning.view / .edit / ...); every write is audited.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/admin/learning", tags=["Learning & Certificates (staff)"])
