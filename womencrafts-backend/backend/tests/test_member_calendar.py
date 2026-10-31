"""Member calendar ownership, date windows, demo examples and cancelled records."""
import uuid
from datetime import datetime, timezone

import httpx
import pytest

from app.core import cache, ratelimit
from app.core.config import settings
from app.core.security import create_access_token
from app.core.seed_calendar_demo import seed_calendar_demo, BATCH
from app.db import mongodb
from app.routes import week


@pytest.fixture
async def api(local_mongo, monkeypatch):
    name="calendar_test_"+uuid.uuid4().hex
    monkeypatch.setattr(settings,"DB_NAME",name)
    monkeypatch.setattr(settings,"REDIS_URL","")
    mongodb._client,mongodb._db=local_mongo,None
    cache.clear();ratelimit._hits.clear()
    from main import app
    db=mongodb.get_database();users=[];headers=[]
    for label in ["Calendar A","Calendar B"]:
        user={"full_name":label,"email":uuid.uuid4().hex+"@example.com","role":"Member","verification_status":"active","is_active":True,"token_version":0}
        user["_id"]=(await db.users.insert_one(user)).inserted_id
        users.append(user)
        headers.append({"Authorization":"Bearer "+create_access_token({"sub":str(user["_id"]),"role":"Member","tv":0})})
    try:
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),base_url="http://test/api/v1") as client:
            yield client,db,users,headers
    finally:
        await local_mongo.drop_database(name)
        cache.clear();mongodb._client,mongodb._db=None,None


@pytest.mark.asyncio
async def test_demo_data_is_idempotent_and_visible_only_through_owned_sources(api):
    client,db,users,(h,other)=api
    now=datetime(2026,10,31,6,tzinfo=timezone.utc)
    result=await seed_calendar_demo(db,users,now)
    assert result["activities_per_member"]==18 and sum(result["inserted"].values())>0
    assert not (await seed_calendar_demo(db,users,now))["inserted"]
    for collection in ["events","bookings","event_registrations","services"]:
        assert await db[collection].count_documents({"demo_batch":BATCH})>0
    assert await db.member_notifications.count_documents({})==0
    assert await db.reminder_definitions.count_documents({})==0
    response=await client.get("/me/week",params={"start":"2026-10-31"},headers=h)
    assert response.status_code==200,response.text
    data=response.json()
    assert len(data["days"])==7 and len(data["items"])==9 and data["untimed"]==1
    assert {i["category"] for i in data["items"]}=={"health","work","community","money","learning","mentoring"}
    own={str(b["_id"]) async for b in db.bookings.find({"user_id":str(users[0]["_id"])})}
    assert {i["id"] for i in data["items"] if i["kind"]=="booking"}<=own
    assert all(i["href"].startswith("/app/bookings/") for i in data["items"] if i["kind"]=="booking")
    month=(await client.get("/me/week",params={"start":"2026-10-31","view":"month"},headers=h)).json()
    assert len(month["days"])==42 and len(month["items"])==18
    other_data=(await client.get("/me/week",params={"start":"2026-10-31"},headers=other)).json()
    assert not own & {i["id"] for i in other_data["items"] if i["kind"]=="booking"}


@pytest.mark.asyncio
async def test_cancelled_bookings_events_and_registrations_leave_calendar(api):
    client,db,users,(h,_)=api
    await seed_calendar_demo(db,users,datetime(2026,10,31,tzinfo=timezone.utc))
    first=(await client.get("/me/week",params={"start":"2026-10-31"},headers=h)).json()
    booking=next(i for i in first["items"] if i["kind"]=="booking")
    event=next(i for i in first["items"] if i["kind"]=="event")
    from bson import ObjectId
    await db.bookings.update_one({"_id":ObjectId(booking["id"])},{"$set":{"status":"cancelled"}})
    await db.events.update_one({"_id":ObjectId(event["id"])},{"$set":{"status":"cancelled"}})
    after=(await client.get("/me/week",params={"start":"2026-10-31"},headers=h)).json()
    assert len(after["items"])==7 and not {booking["id"],event["id"]} & {i["id"] for i in after["items"]}


@pytest.mark.asyncio
async def test_today_uses_member_timezone_across_the_sunday_boundary(api,monkeypatch):
    client,_,_,(h,_)=api
    class Clock(datetime):
        @classmethod
        def now(cls,tz=None):return datetime(2026,10,31,20,tzinfo=timezone.utc).astimezone(tz)
    monkeypatch.setattr(week,"datetime",Clock)
    india=(await client.get("/me/week",params={"tz":"Asia/Kolkata"},headers=h)).json()
    utc=(await client.get("/me/week",params={"tz":"UTC"},headers=h)).json()
    assert india["start"]=="2026-11-01" and india["days"][0]["today"]
    assert utc["start"]=="2026-10-25" and utc["days"][-1]["today"]
    assert (await client.get("/me/week",params={"tz":"Mars/City"},headers=h)).status_code==422
    assert (await client.get("/me/week",params={"start":"wrong"},headers=h)).status_code==422


def test_bad_minutes_are_not_drawn_at_a_made_up_hour():
    assert week._hour("09:75 AM") is None
    assert week._hour("Time to be confirmed") is None
    assert week._hour("2:30 PM")==14.5
