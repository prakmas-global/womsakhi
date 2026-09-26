"""
Staff side of money: payment orders, refunds, withdrawals, the ledger, payout accounts and referrals.

Every endpoint is behind the "money" module guard (main.py) and names its
action (money.view / .edit / ...); every write is audited.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/admin/money", tags=["Money & Payouts (staff)"])
