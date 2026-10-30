"""Customer receivables remain distinct from the personal notebook and UPI confirmations."""
from datetime import datetime, timedelta, timezone
from test_money_workspace import workspace  # noqa: F401


async def test_receipt_updates_one_customer_record_and_does_not_duplicate_personal_income(workspace):
    client, db, owner, other = workspace
    on = (datetime.now(timezone.utc)-timedelta(days=35)).isoformat()
    due = (datetime.now(timezone.utc)-timedelta(days=2)).isoformat()
    response = await client.post('/me/books',headers=owner,json={'who':' Demo customer ','what':'Stitching','minor':125050,'state':'owed','on':on,'due':due})
    assert response.status_code == 201
    row = response.json(); assert row['who']=='Demo customer'
    assert (await client.get('/me/books',headers=owner)).json()['late_count']==1
    assert (await client.patch(f"/me/books/{row['id']}",headers=other,json={'state':'paid'})).status_code==404
    for _ in range(2):
        result=await client.patch(f"/me/books/{row['id']}",headers=owner,json={'state':'paid'})
        assert result.status_code==200
    result=result.json(); assert result['due']=='' and result['state']=='paid'
    assert datetime.fromisoformat(result['on']).date()==datetime.now(timezone.utc).date()
    book=(await client.get('/me/books',headers=owner)).json()
    assert book['paid_minor']==125050 and book['owed_minor']==0 and book['late_count']==0
    assert len(book['entries'])==1
    assert await db.khata_entries.count_documents({})==0
    assert await db.wallet_transactions.count_documents({})==0
    assert await db.orders.count_documents({})==0


async def test_customer_dates_and_input_validation(workspace):
    client, db, owner, _=workspace
    for body in [{'who':'  ','minor':10000},{'who':'Customer','minor':0},{'who':'Customer','minor':10000,'state':'paid','on':(datetime.now(timezone.utc)+timedelta(days=3)).isoformat()}]:
        assert (await client.post('/me/books',headers=owner,json=body)).status_code==422
    row=(await client.post('/me/books',headers=owner,json={'who':'Customer','minor':10000,'state':'owed','due':datetime.now(timezone.utc).isoformat()})).json()
    cleared=await client.patch(f"/me/books/{row['id']}",headers=owner,json={'due':None})
    assert cleared.status_code==200 and cleared.json()['due']==''
    assert (await client.patch(f"/me/books/{row['id']}",headers=owner,json={'who':' '})).status_code==422
