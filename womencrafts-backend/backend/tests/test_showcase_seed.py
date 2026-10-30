"""The showcase is additive, idempotent and respects real identity/payment boundaries."""
from bson import ObjectId
import pytest

from test_money_workspace import workspace  # noqa: F401 - isolated database fixture
from app.core.seed_showcase import BATCH, plan_showcase


async def test_showcase_adds_connected_examples_without_rewriting_existing_data(workspace):
    client, db, owner, other = workspace
    original_users = await db.users.find({}).to_list(20)
    real_note = {'_id': ObjectId(), 'user_id': str(original_users[0]['_id']), 'text': 'A real existing note', 'pinned': False}
    await db.khata_notes.insert_one(real_note)
    await db.users.insert_one({'full_name': 'Pending member', 'role': 'Member', 'is_active': True, 'verification_status': 'pending_documents'})
    await db.users.insert_one({'full_name': 'Staff', 'role': 'Super Admin', 'is_active': True, 'verification_status': 'active'})
    before_users = await db.users.find({}).to_list(20)
    plan = await plan_showcase()
    assert len(plan.users) == 2
    report = await plan.apply()
    assert sum(row['inserted'] for row in report.values()) > 100
    again = await (await plan_showcase()).apply()
    assert sum(row['inserted'] for row in again.values()) == 0
    assert await db.users.find({}).to_list(20) == before_users
    assert await db.khata_notes.find_one({'_id': real_note['_id']}) == real_note
    for collection in ('wallet_transactions','orders','payout_accounts','safety_alerts','outbox','notification_intents','delivery_attempts'):
        assert await db[collection].count_documents({}) == 0
    for collection in plan.docs:
        assert await db[collection].count_documents({'demo_batch': BATCH}) > 0
    for path in ['/payments/activity','/me/khata/entries','/me/khata/notes','/me/khata/chits','/me/money/commitments','/me/books','/me/goals','/mentoring/requests','/mentoring/me','/me/school','/me/vault','/rentals/bookings/mine','/shop/listings','/teach/courses','/community/circles','/me/conversations','/me/home','/work/profile','/shop/summary','/shop/orders','/shop/reviews','/rentals','/growth/applications','/growth/mentors/requests/mine','/feed','/digital','/assess','/doctors/consultations/mine','/me/checklists/doctor','/engines/reminders','/sakhi/conversations']:
        response = await client.get(path, headers=owner)
        assert response.status_code == 200, f'{path}: {response.status_code} {response.text[:300]}'
    payments = (await client.get('/payments/activity', headers=owner)).json()['items']
    assert {row['status'] for row in payments} >= {'awaiting','claimed','paid','declined'}
    assert {row['direction'] for row in payments} == {'sent','received'}


async def test_showcase_refuses_production(workspace, monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, 'ENVIRONMENT', 'production')
    with pytest.raises(RuntimeError, match='development-only'):
        await plan_showcase()
