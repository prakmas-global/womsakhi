"""
Staff side of the marketplace: listings, orders, reviews, group buys and sellers.

Every endpoint is behind the "market" module guard (main.py) and names its
action (market.view / .edit / ...); every write is audited.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/admin/market", tags=["Market & Shops (staff)"])
