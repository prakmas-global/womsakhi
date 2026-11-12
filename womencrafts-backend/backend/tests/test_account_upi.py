"""One recipient UPI across modules, with account isolation and stable payment claims."""
from bson import ObjectId
from tests.test_teach_courses import api, _member, _post, _mentor_body  # noqa: F401


async def test_account_upi_propagates_and_preserves_submitted_payments(api):
    client,db,made=api
    owner,h=await _member(db,made,'Global UPI teacher')
    _,payer=await _member(db,made,'Global UPI learner')
    other,other_h=await _member(db,made,'Other UPI account')
    course=await _post(client,made,h,price_rupees=299,upi_id='first@okaxis')
    pid=course['id']
    assert (await client.get('/me/payout/upi',headers=h)).json()['upi_id']=='first@okaxis'
    mentor=await client.put('/mentoring/me',headers=h,json=_mentor_body(price_rupees=200,upi_id='stale@oksbi'))
    assert mentor.status_code==200,mentor.text
    mid=mentor.json()['id']
    try:
        assert mentor.json()['upi_id']=='first@okaxis'
        changed=await client.put('/me/payout/upi',headers=h,json={'upi_id':'second@oksbi'})
        assert changed.status_code==200 and changed.json()['configured']
        assert (await client.get(f'/teach/courses/{pid}',headers=h)).json()['upi_id']=='second@oksbi'
        assert (await client.get('/mentoring/me',headers=h)).json()['upi_id']=='second@oksbi'
        await client.post(f'/me/programs/{pid}/enroll',headers=payer)
        detail=(await client.get(f'/me/programs/{pid}/detail',headers=payer)).json()
        assert detail['upi_id']=='second@oksbi' and not detail['can_learn']
        claimed=await client.post(f'/me/programs/{pid}/paid',headers=payer,json={'reference':'TEST-UPI-REFERENCE'})
        assert claimed.status_code==200
        await client.post(f'/growth/mentors/{mid}/request',headers=payer,json={'goal':'Help me plan my first product'})
        rid=(await client.get('/mentoring/requests',headers=h)).json()[0]['id']
        assert (await client.post(f'/mentoring/requests/{rid}/accept',headers=h,json={'scheduled_for':'Sat 11am','meeting':'https://meet.google.com/test'})).status_code==200
        legacy_user,_=await _member(db,made,'Legacy claimed payment learner')
        legacy_id=(await db.enrollments.insert_one({'user_id':str(legacy_user['_id']),'program_id':pid,'status':'pending','payment':{'status':'claimed','reference':'LEGACY-REFERENCE'}})).inserted_id
        await client.put('/me/payout/upi',headers=h,json={'upi_id':'third@okaxis'})
        assert (await db.enrollments.find_one({'_id':legacy_id}))['payment']['upi_id']=='first@okaxis'
        assert (await client.get(f'/me/programs/{pid}/detail',headers=payer)).json()['upi_id']=='second@oksbi'
        requests=(await client.get('/growth/mentors/requests/mine',headers=payer)).json()
        assert requests[0]['upi_id']=='third@okaxis'
        assert (await client.post(f'/growth/mentors/requests/{rid}/paid',headers=payer,json={'reference':'TEST-MENTOR-REFERENCE'})).status_code==200
        await client.put('/me/payout/upi',headers=h,json={'upi_id':'fourth@okaxis'})
        assert (await client.get('/growth/mentors/requests/mine',headers=payer)).json()[0]['upi_id']=='third@okaxis'
        await client.post(f'/me/programs/{pid}/enroll',headers=other_h)
        assert (await client.get(f'/me/programs/{pid}/detail',headers=other_h)).json()['upi_id']=='fourth@okaxis'
        eid=(await client.get(f'/teach/courses/{pid}/learners',headers=h)).json()
        eid=next(x['enrollment_id'] for x in eid if x['payment_status']=='claimed')
        assert (await client.post(f'/teach/learners/{eid}/confirm',headers=h)).status_code==200
        record=await db.enrollments.find_one({'_id':ObjectId(eid)})
        before=record['payment'].copy()
        await client.put('/me/payout/upi',headers=h,json={'upi_id':'final@okaxis'})
        assert (await db.enrollments.find_one({'_id':ObjectId(eid)}))['payment']==before
        assert (await client.get(f'/me/programs/{pid}/detail',headers=payer)).json()['can_learn']
        assert (await client.get('/me/payout/upi',headers=other_h)).json()['upi_id']==''
        await client.put('/me/payout/upi',headers=other_h,json={'upi_id':'other@okaxis','user_id':str(owner['_id'])})
        assert (await client.get('/me/payout/upi',headers=h)).json()['upi_id']=='final@okaxis'
        # Stale module forms cannot silently change the account default back.
        full=(await client.get(f'/teach/courses/{pid}',headers=h)).json()
        edited=await client.put(f'/teach/courses/{pid}',headers=h,json={**full,'price_rupees':299,'upi_id':'stale@oksbi','publish':True})
        assert edited.status_code==200 and edited.json()['upi_id']=='final@okaxis'
    finally:
        await db.mentors.delete_one({'_id':ObjectId(mid)})
        await db.mentorship_requests.delete_many({'mentor_id':mid})


async def test_upi_validation_legacy_choices_and_compatibility(api):
    client,db,made=api
    owner,h=await _member(db,made,'UPI settings owner')
    before=(await client.get('/me/payout/upi',headers=h)).json()
    assert not before['configured'] and before['upi_id']==''
    for value in ['not-an-id','x@y','name@bank space','name@@bank','a'*81+'@bank','   ']:
        assert (await client.put('/me/payout/upi',headers=h,json={'upi_id':value})).status_code==422
    no_upi=await client.post('/teach/courses',headers=h,json={'name':'Paid reading course','desc':'A complete short course for our learners.','category':'Handicrafts','price_rupees':199,'lessons':[{'title':'First lesson'}]})
    assert no_upi.status_code==422
    assert (await client.put('/me/payout/upi',headers=h,json={'upi_id':'  shared@okaxis  '})).json()['upi_id']=='shared@okaxis'
    course=await _post(client,made,h,price_rupees=199)
    assert course['upi_id']=='shared@okaxis'
    # An old client's explicit Add UPI action also updates the global setting.
    legacy=await client.post('/me/payout/accounts',headers=h,json={'kind':'UPI','upi_id':'legacy@oksbi'})
    assert legacy.status_code==201,legacy.text
    try:
        assert (await client.get('/me/payout/upi',headers=h)).json()['upi_id']=='legacy@oksbi'
        await db.users.update_one({'_id':owner['_id']},{'$unset':{'payment_upi_id':'','payment_upi_updated_at':''}})
        choices=(await client.get('/me/payout/upi',headers=h)).json()
        assert not choices['configured'] and {'shared@okaxis','legacy@oksbi'}<=set(choices['existing_upi_ids'])
        # Reading an old account never chooses between different destinations.
        assert 'payment_upi_id' not in await db.users.find_one({'_id':owner['_id']})
        await db.users.update_one({'_id':owner['_id']},{'$set':{'payment_upi_id':''}})
        migrated=await _post(client,made,h,price_rupees=199,upi_id='migrated@okaxis')
        assert migrated['upi_id']=='migrated@okaxis'
    finally:
        await db.payout_accounts.delete_many({'user_id':str(owner['_id'])})
