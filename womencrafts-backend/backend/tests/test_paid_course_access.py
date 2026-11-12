"""Paid lesson bodies never open before the course owner's confirmation."""
from bson import ObjectId
from tests.test_teach_courses import api, _member, _post  # noqa: F401


async def test_all_paid_formats_stay_locked_even_with_legacy_preview_flags(api):
    client, db, made = api
    _, teacher = await _member(db, made, 'Paid access teacher')
    _, learner = await _member(db, made, 'Paid access learner')
    _, outsider = await _member(db, made, 'Unrelated member')
    lessons = [
        {'title':'Video lesson','body':'Private lesson words','video_url':'https://youtu.be/private123','preview':False},
        {'title':'Private article','content_type':'article','body':'Private article words','preview':True},
        {'title':'Private book','content_type':'book','body':'Private book words','preview':True},
    ]
    course = await _post(client,made,teacher,price_rupees=299,upi_id='teacher@okaxis',lessons=lessons)
    pid = course['id']
    assert all(not l['preview'] for l in course['lessons'])
    # Existing paid documents may still contain the old preview flags. Reads
    # must enforce the rule without needing to rewrite teachers' courses.
    await db.programs.update_one({'_id':ObjectId(pid)},{'$set':{'curriculum.0.preview':True,'curriculum.1.preview':True,'curriculum.2.preview':True}})

    async def locked():
        response=await client.get(f'/me/programs/{pid}/detail',headers=learner)
        assert response.status_code==200
        detail=response.json()
        assert not detail['can_learn'] and not detail['resume_lesson']
        for lesson in detail['curriculum']:
            assert not lesson['preview']
            assert not {'body','video_url','revision','reading_offset'} & lesson.keys()
        for path in ['/catalog/programs',f'/catalog/programs/{pid}']:
            r=await client.get(path,headers=learner)
            row=next(x for x in r.json() if x['id']==pid) if isinstance(r.json(),list) else r.json()
            assert all(not l['preview'] and 'body' not in l for l in row['curriculum'])
        assert (await client.patch(f'/me/programs/{pid}/progress',headers=learner,json={'progress':100})).status_code in {403,404}
        assert (await client.get(f'/courses/{pid}/qa',headers=learner)).status_code==403
        assert (await client.post(f'/me/programs/{pid}/lessons/1/complete',headers=learner)).status_code==403
        assert (await client.put(f'/me/programs/{pid}/lessons/3/reading',headers=learner,json={'offset':0,'revision':'a'*64})).status_code==403
        return detail

    await locked()
    joined=await client.post(f'/me/programs/{pid}/enroll',headers=learner)
    assert joined.status_code==201 and joined.json()['status']=='pending'
    assert (await locked())['payment_status']=='awaiting'
    claimed=await client.post(f'/me/programs/{pid}/paid',headers=learner,json={'reference':'TEST-UTR123'})
    assert claimed.status_code==200
    assert (await locked())['payment_status']=='claimed'
    await db.enrollments.update_one({'program_id':pid},{'$set':{'status':'completed'}})
    await locked()
    assert (await client.post(f'/me/programs/{pid}/certificate',headers=learner)).status_code==403
    await db.enrollments.update_one({'program_id':pid},{'$set':{'status':'pending'}})
    rows=(await client.get(f'/teach/courses/{pid}/learners',headers=teacher)).json()
    eid=rows[0]['enrollment_id']
    for unauthorized in [learner,outsider]:
        assert (await client.post(f'/teach/learners/{eid}/confirm',headers=unauthorized)).status_code==404
    confirmed=await client.post(f'/teach/learners/{eid}/confirm',headers=teacher)
    assert confirmed.status_code==200
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    assert detail['can_learn'] and detail['payment_status']=='paid'
    assert [l['body'] for l in detail['curriculum']]==[l['body'] for l in lessons]
    assert detail['curriculum'][0]['video_url']=='https://youtu.be/private123'
    assert (await client.get(f'/me/programs/{pid}/detail',headers=outsider)).json()['can_learn'] is False
    # Owners can inspect their own writing without enrolling or paying themselves.
    own=(await client.get(f'/me/programs/{pid}/detail',headers=teacher)).json()
    assert own['is_owner'] and own['can_learn'] and own['curriculum'][2]['body']=='Private book words'


async def test_declined_payment_does_not_open_reading_content(api):
    client,db,made=api
    _,teacher=await _member(db,made,'Decline teacher')
    _,learner=await _member(db,made,'Decline learner')
    course=await _post(client,made,teacher,price_rupees=99,upi_id='teacher@okaxis',lessons=[{'title':'Paid article','content_type':'article','body':'Locked article','preview':True}])
    pid=course['id']
    await client.post(f'/me/programs/{pid}/enroll',headers=learner)
    await client.post(f'/me/programs/{pid}/paid',headers=learner,json={'reference':'TEST-UTR456'})
    rows=(await client.get(f'/teach/courses/{pid}/learners',headers=teacher)).json()
    response=await client.post(f"/teach/learners/{rows[0]['enrollment_id']}/decline",headers=teacher,json={'note':'Practice payment not received'})
    assert response.status_code==200
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    assert detail['payment_status']=='declined' and not detail['can_learn']
    assert 'body' not in detail['curriculum'][0] and not detail['curriculum'][0]['preview']
