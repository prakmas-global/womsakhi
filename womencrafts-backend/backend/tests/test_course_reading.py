"""Reading formats, durable private bookmarks and unchanged completion/payment gates."""
from app.core.reading import content_revision
from tests.test_teach_courses import api, _member, _post  # noqa: F401


async def test_reading_bookmark_private_resumes_and_survives_reorder(api):
    client,db,made=api
    _,teacher=await _member(db,made,'Reader teacher')
    _,learner=await _member(db,made,'Reader learner')
    _,other=await _member(db,made,'Other learner')
    course=await _post(client,made,teacher,lessons=[{'title':'Article','content_type':'article','body':'An introductory article.'},
        {'title':'Book','content_type':'book','body':'A long paragraph. '*1000}])
    pid=course['id']
    assert course['lessons'][1]['id']
    await client.post(f'/me/programs/{pid}/enroll',headers=learner)
    await client.post(f'/me/programs/{pid}/enroll',headers=other)
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    book=detail['curriculum'][1]
    response=await client.put(f'/me/programs/{pid}/lessons/2/reading',headers=learner,json={'offset':1800,'revision':book['revision']})
    assert response.status_code==200,response.text
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    assert detail['resume_lesson']==2 and detail['curriculum'][1]['reading_offset']==1800
    assert detail['progress']==0 and not detail['curriculum'][1]['done']
    other_detail=(await client.get(f'/me/programs/{pid}/detail',headers=other)).json()
    assert other_detail['resume_lesson']==0 and 'reading_offset' not in other_detail['curriculum'][1]
    full=(await client.get(f'/teach/courses/{pid}',headers=teacher)).json()
    full['lessons'].reverse()
    edited=await client.put(f'/teach/courses/{pid}',headers=teacher,json={**full,'price_rupees':0,'publish':True})
    assert edited.status_code==200,edited.text
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    assert detail['resume_lesson']==1 and detail['curriculum'][0]['reading_offset']==1800
    full['lessons'][0]['body']='The teacher rewrote this book.'
    assert (await client.put(f'/teach/courses/{pid}',headers=teacher,json={**full,'price_rupees':0,'publish':True})).status_code==200
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    assert detail['resume_lesson']==0 and 'reading_offset' not in detail['curriculum'][0]
    assert (await client.put(f'/me/programs/{pid}/lessons/1/reading',headers=learner,json={'offset':1,'revision':book['revision']})).status_code==409


async def test_reading_access_and_bounds(api):
    client,db,made=api
    _,teacher=await _member(db,made,'Reader teacher')
    _,learner=await _member(db,made,'Reader learner')
    course=await _post(client,made,teacher,price_rupees=99,upi_id='teacher@okaxis',lessons=[{'title':'Paid book','content_type':'book','body':'Private book text'}])
    pid=course['id'];payload={'offset':3,'revision':content_revision({'body':'Private book text'})}
    assert (await client.put(f'/me/programs/{pid}/lessons/1/reading',headers=learner,json=payload)).status_code==403
    await client.post(f'/me/programs/{pid}/enroll',headers=learner)
    detail=(await client.get(f'/me/programs/{pid}/detail',headers=learner)).json()
    assert 'body' not in detail['curriculum'][0] and 'revision' not in detail['curriculum'][0]
    assert (await client.put(f'/me/programs/{pid}/lessons/1/reading',headers=learner,json=payload)).status_code==403
    free=await _post(client,made,teacher,lessons=[{'title':'Article','content_type':'article','body':'Short article'}])
    pid=free['id'];await client.post(f'/me/programs/{pid}/enroll',headers=learner)
    payload['revision']=content_revision({'body':'Short article'})
    for offset in [-1,99999]:
        assert (await client.put(f'/me/programs/{pid}/lessons/1/reading',headers=learner,json={**payload,'offset':offset})).status_code==422
    assert (await client.put(f'/me/programs/{pid}/lessons/9/reading',headers=learner,json=payload)).status_code==404
