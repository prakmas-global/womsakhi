"""Unified notebook: planned bills become one actual expense, with PIN and ownership protection."""
import asyncio
import uuid
from datetime import datetime, timedelta, timezone

import httpx
import pytest

from app.core import cache, sessions
from app.core.config import settings
from app.db import mongodb


@pytest.fixture
async def workspace(local_mongo, monkeypatch):
    name = f"womsakhi_money_test_{uuid.uuid4().hex}"
    monkeypatch.setattr(settings, "DB_NAME", name)
    monkeypatch.setattr(settings, "REDIS_URL", "")
    mongodb._client, mongodb._db = local_mongo, None
    cache.clear()
    from main import app
    db = mongodb.get_database()
    headers = []
    for label in ["Money Owner", "Another Member"]:
        doc = {"full_name": label, "email": f"{uuid.uuid4().hex}@example.com", "role": "Member", "is_active": True, "verification_status": "active", "token_version": 0, "email_verified_at": datetime.now(timezone.utc)}
        doc["_id"] = (await db["users"].insert_one(doc)).inserted_id
        headers.append({"Authorization": f"Bearer {(await sessions.start(None, doc))['access_token']}"})
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test/api/v1") as client:
            yield client, db, *headers
    finally:
        await local_mongo.drop_database(name)
        mongodb._client, mongodb._db = None, None
        cache.clear()


async def add_plan(client, headers, **changes):
    response = await client.post("/me/money/commitments", headers=headers, json={"what": "School fee", "minor": 125050, **changes})
    assert response.status_code == 201, response.text
    return response.json()


async def test_payment_is_one_actual_expense_even_with_concurrent_retries(workspace):
    client, db, owner, _ = workspace
    plan = await add_plan(client, owner)
    assert await db["khata_entries"].count_documents({}) == 0
    path = f"/me/money/commitments/{plan['id']}/payment"
    responses = await asyncio.gather(*(client.post(path, headers=owner, json={"on": "2026-01-15"}) for _ in range(10)))
    assert all(response.status_code == 200 for response in responses), [r.text for r in responses]
    assert len({r.json()["id"] for r in responses}) == 1
    assert await db["khata_entries"].count_documents({}) == 1
    # Case changes in an ObjectId URL must not produce another expense.
    upper = await client.post(f"/me/money/commitments/{plan['id'].upper()}/payment", headers=owner, json={})
    assert upper.status_code == 200 and upper.json()["id"] == responses[0].json()["id"]
    month = (await client.get("/me/khata/entries", params={"month": "2026-01"}, headers=owner)).json()
    assert month["out_minor"] == 125050 and month["left_minor"] == -125050
    assert month["items"][0]["source"] == "bill"
    plans = (await client.get("/me/money/commitments", headers=owner)).json()
    assert plans[0]["paid"] and plans[0]["recorded_minor"] == 125050
    assert (await client.get("/me/money", headers=owner)).json()["commitments"] == []


async def test_undo_reopens_bill_and_preserves_other_entries(workspace):
    client, db, owner, _ = workspace
    existing = await client.post("/me/khata/entries", headers=owner, json={"kind": "in", "amount_minor": 200000, "category": "sales"})
    assert existing.status_code == 201
    plan = await add_plan(client, owner)
    path = f"/me/money/commitments/{plan['id']}/payment"
    assert (await client.post(path, headers=owner, json={})).status_code == 200
    assert (await client.patch(f"/me/money/commitments/{plan['id']}", headers=owner, json={"minor": 1})).status_code == 409
    assert (await client.delete(f"/me/money/commitments/{plan['id']}", headers=owner)).status_code == 409
    for _ in range(2):
        assert (await client.delete(path, headers=owner)).status_code == 200
    assert await db["khata_entries"].count_documents({}) == 1
    assert not (await client.get("/me/money/commitments", headers=owner)).json()[0]["paid"]
    assert (await client.post(path, headers=owner, json={})).status_code == 200
    assert await db["khata_entries"].count_documents({}) == 2


async def test_ownership_and_linked_entry_edit_protection(workspace):
    client, _, owner, other = workspace
    plan = await add_plan(client, owner)
    path = f"/me/money/commitments/{plan['id']}/payment"
    assert (await client.get("/me/money/commitments", headers=other)).json() == []
    assert (await client.post(path, headers=other, json={})).status_code == 404
    assert (await client.delete(path, headers=other)).status_code == 404
    entry = (await client.post(path, headers=owner, json={})).json()
    assert (await client.patch(f"/me/khata/entries/{entry['id']}", headers=owner, json={"amount_minor": 1})).status_code == 400
    assert (await client.delete(f"/me/khata/entries/{entry['id']}", headers=owner)).status_code == 400


async def test_existing_completed_plan_does_not_invent_an_expense(workspace):
    client, db, owner, _ = workspace
    plan = await add_plan(client, owner)
    path = f"/me/money/commitments/{plan['id']}"
    assert (await client.patch(path, headers=owner, json={"paid": True})).status_code == 200
    saved = (await client.get("/me/money/commitments", headers=owner)).json()[0]
    assert saved["legacy_paid"] and saved["payment_entry_id"] == ""
    assert (await client.post(path + "/payment", headers=owner, json={})).status_code == 409
    assert await db["khata_entries"].count_documents({}) == 0
    assert (await client.patch(path, headers=owner, json={"paid": False})).status_code == 200
    assert (await client.post(path + "/payment", headers=owner, json={})).status_code == 200


async def test_pin_protects_plans_and_recording(workspace):
    client, _, owner, _ = workspace
    plan = await add_plan(client, owner)
    pin = await client.put("/me/khata/pin", headers=owner, json={"pin": "4826"})
    assert pin.status_code == 200, pin.text
    for method, path, body in [("GET", "/me/money", None), ("GET", "/me/money/commitments", None), ("POST", f"/me/money/commitments/{plan['id']}/payment", {}), ("DELETE", f"/me/money/commitments/{plan['id']}/payment", None)]:
        response = await client.request(method, path, headers=owner, **({"json": body} if body is not None else {}))
        assert response.status_code == 423, response.text
    unlocked = {**owner, "X-Khata-Key": pin.json()["key"]}
    assert (await client.get("/me/money/commitments", headers=unlocked)).status_code == 200


async def test_dates_validation_and_clear_optional_due(workspace):
    client, db, owner, _ = workspace
    plan = await add_plan(client, owner, due="2026-11-01T00:00:00+05:30")
    path = f"/me/money/commitments/{plan['id']}"
    cleared = await client.patch(path, headers=owner, json={"due": None})
    assert cleared.json()["due"] == ""
    future = (datetime.now(timezone.utc) + timedelta(days=2)).date().isoformat()
    assert (await client.post(path + "/payment", headers=owner, json={"on": future})).status_code == 422
    assert await db["khata_entries"].count_documents({}) == 0
    assert (await client.post("/me/money/commitments", headers=owner, json={"what": "  ", "minor": 100})).status_code == 422
    assert (await client.patch(path, headers=owner, json={"what": " "})).status_code == 422


async def test_platform_credits_and_personal_notebook_stay_separate(workspace):
    client, db, owner, stranger = workspace
    from app.models.wallet import WalletTxnModel
    uid = str((await db['users'].find_one({'full_name': 'Money Owner'}))['_id'])
    for kind, amount, source in [('credit', 125055, 'refund'), ('credit', 50000, 'referral'), ('debit', 10000, 'spend')]:
        await db['wallet_transactions'].insert_one(WalletTxnModel.create_document(uid, '', kind, amount, source, f'Test {source}'))
    before = (await client.get('/wallet', headers=owner)).json()
    assert before['balance_minor'] == 165055
    assert len(before['transactions']) == 3
    assert (await client.get('/wallet', headers=stranger)).json()['balance_minor'] == 0
    assert (await client.get('/me/khata/entries', headers=owner)).json()['items'] == []
    await client.post('/me/khata/entries', headers=owner, json={'kind': 'in', 'amount_minor': 200000, 'category': 'sales'})
    plan = await add_plan(client, owner)
    assert (await client.post(f"/me/money/commitments/{plan['id']}/payment", headers=owner, json={})).status_code == 200
    assert (await client.get('/wallet', headers=owner)).json() == before
    denied = await client.post('/me/payout/withdraw', headers=owner, json={'amount_minor': 10000})
    assert denied.status_code == 501
    assert (await client.get('/wallet', headers=owner)).json() == before
    assert await db['wallet_transactions'].count_documents({}) == 3


async def test_upi_activity_claim_is_not_confirmation_and_owner_reviews(workspace):
    client, db, teacher, learner = workspace
    from bson import ObjectId
    owner = str((await db.users.find_one({'full_name': 'Money Owner'}))['_id'])
    payer = str((await db.users.find_one({'full_name': 'Another Member'}))['_id'])
    now = datetime.now(timezone.utc)
    course = {'name': 'UPI audit course', 'owner_id': owner, 'teacher_name': 'Money Owner', 'owner_kind': 'member', 'price_minor': 125050, 'upi_id': 'teacher@example', 'created_at': now}
    pid = str((await db.programs.insert_one(course)).inserted_id)
    enrollment = {'user_id': payer, 'program_id': pid, 'program_name': course['name'], 'status': 'pending', 'payment': {'status': 'awaiting', 'amount_minor': 125050}, 'created_at': now, 'updated_at': now}
    eid = str((await db.enrollments.insert_one(enrollment)).inserted_id)
    await db.enrollments.insert_one({'user_id': str(ObjectId()), 'program_id': str(ObjectId()), 'payment': {'status': 'claimed', 'amount_minor': 9900}, 'program_name': 'Private stranger payment'})
    initial = (await client.get('/payments/activity', headers=learner)).json()['items']
    assert len(initial) == 1 and initial[0]['status'] == 'awaiting' and initial[0]['direction'] == 'sent'
    assert initial[0]['href'] == f'/app/programs/{pid}'
    invalid = await client.post(f'/me/programs/{pid}/paid', headers=learner, json={'reference': '  '})
    assert invalid.status_code == 422
    claimed = await client.post(f'/me/programs/{pid}/paid', headers=learner, json={'reference': ' UTR12345 '})
    assert claimed.status_code == 200, claimed.text
    pending = (await client.get('/payments/activity', headers=learner)).json()['items'][0]
    assert pending['status'] == 'claimed' and pending['reference'] == 'UTR12345'
    assert not pending['confirmed_at'] and pending['submitted_at']
    assert (await db.enrollments.find_one({'_id': ObjectId(eid)}))['status'] == 'pending'
    recipient = (await client.get('/payments/activity', headers=teacher)).json()['items']
    assert len(recipient) == 1 and recipient[0]['direction'] == 'received' and recipient[0]['href'] == f'/app/teach/{pid}?tab=learners'
    assert (await client.post(f'/teach/learners/{eid}/confirm', headers=learner)).status_code == 404
    result = await client.post(f'/teach/learners/{eid}/confirm', headers=teacher)
    assert result.status_code == 200, result.text
    confirmed = (await client.get('/payments/activity', headers=learner)).json()['items'][0]
    assert confirmed['status'] == 'paid' and confirmed['confirmed_at']
    assert (await db.enrollments.find_one({'_id': ObjectId(eid)}))['payment']['confirmed_by'] == owner
    assert confirmed['amount_minor'] == 125050
    assert await db.wallet_transactions.count_documents({}) == 0
    assert await db.khata_entries.count_documents({}) == 0
    assert (await client.post(f'/teach/learners/{eid}/confirm', headers=teacher)).status_code == 409
    assert await db.book_entries.count_documents({}) == 1


async def test_declined_upi_payment_keeps_recipient_decision(workspace):
    client, db, teacher, learner = workspace
    owner = str((await db.users.find_one({'full_name': 'Money Owner'}))['_id'])
    payer = str((await db.users.find_one({'full_name': 'Another Member'}))['_id'])
    now = datetime.now(timezone.utc)
    pid = str((await db.programs.insert_one({'name': 'Unconfirmed payment', 'owner_id': owner})).inserted_id)
    await db.enrollments.insert_one({'user_id': payer, 'program_id': pid, 'status': 'withdrawn', 'payment': {'status': 'declined', 'amount_minor': 25000, 'reference': 'TEST-NOT-RECEIVED', 'note': 'Reference not found in my UPI account'}, 'created_at': now})
    row = (await client.get('/payments/activity', headers=learner)).json()['items'][0]
    assert row['status'] == 'declined' and row['note'] == 'Reference not found in my UPI account'
