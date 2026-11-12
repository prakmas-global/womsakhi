"""Real Mongo/API checks for local bulk requests and the shared work workflow."""
from datetime import datetime, timedelta, timezone

from bson import ObjectId

from app.models.growth import OpportunityModel
from app.core.onboarding import PROFILES
from tests.test_work_talent import api, _member  # noqa: F401


def order(**over):
    delivery = (datetime.now(timezone.utc) + timedelta(days=20)).date().isoformat()
    return {"title": "Test job bulk blouses", "category": "tailoring_fashion",
            "skill_keys": ["blouse_stitching"], "kind": "Craft order", "mode": "Remote",
            "city": " Hyderabad ", "area": " Kukatpally ", "pay": "₹180 / piece", "openings": 3,
            "order_details": {"quantity": 100, "unit": "pieces", "delivery_date": delivery,
                              "materials": "Buyer provides cloth", "payment_terms": "UPI within 7 days of accepted delivery"}, **over}


async def test_post_local_order_reload_apply_manage_and_edit(api):
    client, db, made = api
    buyer, hb = await _member(db, made, "Test buyer")
    maker, hm = await _member(db, made, "Test maker")
    created = await client.post("/work/jobs", headers=hb, json=order())
    assert created.status_code == 201, created.text
    row = created.json(); oid = row["id"]
    assert row["location"] == "Kukatpally, Hyderabad"
    assert row["city"] == "Hyderabad" and row["area"] == "Kukatpally"
    assert row["order_details"]["quantity"] == 100 and row["openings"] == 3
    nearby = (await client.get("/growth/opportunities", headers=hm, params={"kind":"Craft order","city":"hyderabad","area":"kukatpally"})).json()
    assert any(r["id"] == oid and r["order_details"] == row["order_details"] for r in nearby)
    assert not any(r["id"] == oid for r in (await client.get("/growth/opportunities", headers=hm, params={"city":"Bengaluru"})).json())
    assert (await client.post(f"/growth/opportunities/{oid}/apply", headers=hb, json={})).status_code == 400
    applied = await client.post(f"/growth/opportunities/{oid}/apply", headers=hm, json={"note":"I can make 30 pieces"})
    assert applied.status_code == 201, applied.text
    applicants = (await client.get(f"/work/jobs/{oid}/applicants", headers=hb)).json()
    assert any(a["user_id"] == str(maker["_id"]) for a in applicants)
    assert (await client.get(f"/work/jobs/{oid}/applicants", headers=hm)).status_code == 404
    details = {**row["order_details"], "quantity":120}
    edited = await client.put(f"/work/jobs/{oid}", headers=hb, json=order(order_details=details))
    assert edited.status_code == 200 and edited.json()["order_details"]["quantity"] == 120
    assert (await client.put(f"/work/jobs/{oid}", headers=hm, json=order())).status_code == 404
    mine = (await client.get("/work/jobs/mine", headers=hb)).json()
    assert any(r["id"] == oid and r["order_details"]["quantity"] == 120 for r in mine)


async def test_bulk_details_required_but_normal_jobs_still_work(api):
    client, db, made = api
    _, h = await _member(db, made, "Test buyer validation")
    for payload in [order(city=" "), order(order_details=None),
                    order(order_details={**order()["order_details"],"quantity":0}),
                    order(order_details={**order()["order_details"],"delivery_date":"2026-02-30"}),
                    order(order_details={**order()["order_details"],"delivery_date":"2020-01-01"}),
                    order(order_details={**order()["order_details"],"payment_terms":"   "}),
                    order(deadline="2099-12-31")]:
        response = await client.post("/work/jobs", headers=h, json=payload)
        assert response.status_code == 422, response.text
    normal = await client.post("/work/jobs", headers=h, json=order(kind="Job", city="", area="", order_details=None))
    assert normal.status_code == 201 and normal.json()["order_details"] is None


async def test_location_is_filtered_on_server_with_legacy_support(api):
    client, db, made = api
    _, h = await _member(db, made, "Test location search")
    docs=[]
    for location,city,area in [("Kukatpally, Hyderabad","",""),
                               ("Hyderabad","Bengaluru","Indiranagar"),
                               ("Elsewhere","Hyderabad","Gachibowli"),
                               ("New Hyderabadabad","",""),
                               ("Unknown","","")]:
        d=OpportunityModel.create_document(title="Test job places",kind="Craft order",location=location)
        d.update(city=city,area=area);d["_id"]=ObjectId();docs.append(d)
    await db.opportunities.insert_many(docs)
    ids={str(d["_id"]) for d in docs}
    rows=(await client.get("/growth/opportunities",headers=h,params={"kind":"Craft order","city":" Hyderabad "})).json()
    assert {r["id"] for r in rows}&ids == {str(docs[0]["_id"]),str(docs[2]["_id"])}
    rows=(await client.get("/growth/opportunities",headers=h,params={"city":"Hyderabad","area":"Kukatpally"})).json()
    assert {r["id"] for r in rows}&ids == {str(docs[0]["_id"])}
    assert (await client.get("/growth/opportunities",headers=h,params={"area":"Kukatpally"})).status_code==422
    assert not (await client.get("/growth/opportunities",headers=h,params={"city":".*"})).json()


async def test_order_matching_notifications_stay_in_same_town(api):
    client, db, made = api
    buyer,h=await _member(db,made,"Test buyer notifications")
    recipients=[]
    for name,city,consent in [("Local","hyderabad",True),("Far","Bengaluru",True),("Opted out","Hyderabad",False)]:
        user,_=await _member(db,made,"Test "+name)
        uid=str(user["_id"]);recipients.append(uid)
        await db.work_profiles.insert_one({"user_id":uid,"city":city,"skills":[{"key":"blouse_stitching","visible":True}]})
        await db[PROFILES].insert_one({"user_id":uid,"consents":{"job_updates":{"granted":consent}}})
    response=await client.post("/work/jobs",headers=h,json=order())
    assert response.status_code==201,response.text
    notified={r["user_id"] async for r in db.member_notifications.find({"user_id":{"$in":recipients}})}
    assert notified=={recipients[0]}
