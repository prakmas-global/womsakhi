"""Original, labelled reading samples; insert-only and without notifications."""
from hashlib import sha256
from bson import ObjectId
from app.models.program import ProgramModel
from app.models.enrollment import EnrollmentModel

BATCH = 'reading-room-demo-v1'
TITLE = '[DEMO] Small Steps, Strong Beginnings'
ARTICLE = '''# An hour that belongs to you

[DEMO] An original sample article for trying the WomSakhi reader. The people and situations are fictional. Turn a page, leave the course and return to see your saved reading place.

A notebook can begin with a very small question: what would I like to learn for myself? It might be taking a clear photograph, finishing a story, repairing a favourite kurta, or writing down an idea that has stayed in your mind for months. Your interests deserve a place on the page, even when the rest of the page is full of things to do for other people.

Meena used to wait for a completely free afternoon. Between preparing meals, helping her father and collecting her daughter from school, that afternoon rarely arrived. One day she put a notebook beside her sewing box and wrote, “Today I will practise one neat seam.” The task was small enough to begin and clear enough to finish. The next day she tried another.

# A small beginning is still a beginning

The useful part was the agreement Meena made with herself. She did not need to prove that the whole idea would succeed before spending a little time on it. She could practise, notice what was difficult and ask for help. Some days she managed twenty minutes. On others she rested. A missed day did not erase what she had already learned.

Write down one thing you want to explore. Then choose a step that fits the day you actually have. “Learn photography” may feel too large; “take one photograph near the window” gives you somewhere to start. “Make a collection” can become “sketch one design.” Small steps can reveal whether you enjoy the work before you commit more time or money to it.

# Make room for support

An interest does not have to be carried alone. A friend might review a photograph. A neighbour might explain a stitch. Someone at home might take over a routine task while you practise. Asking for a little shared time is a practical way of making room for your plans. You are allowed to say what would help.

Before closing this article, think of one sentence you could put in your notebook today. It can be as simple as “I would like to try.” You do not need to have the ending ready. A beginning is enough for this page.

Reader exercise: turn to another page, wait for “Place saved to your account,” and reopen the article. Your page should return automatically. Reading does not mark the lesson complete; use the completion button when you are ready.'''

CHAPTERS = [
('The blue notebook', [
'Anitha found the blue notebook while looking for a spare school label. Most of its pages were empty. On the first page, her daughter had drawn a house with an enormous yellow door. Anitha smiled, turned the page and wrote her own name. For once, this notebook would not be a list of shopping or errands. It would hold an idea she had been keeping to herself.',
'She enjoyed turning leftover cloth into small bags: bags for hair clips, bags for thread, and one uneven bag her sister insisted on using for her phone. She had never called this a skill. That evening she wrote, “I can make something useful from what is already here.” She left a space below it. She did not know what would come next.',
'Her first decision was modest: finish one sample before making any promises. There would be time later to decide whether the idea belonged in a shop, at a school fair, or simply among things she loved doing. She put the notebook beside her sewing box so that her idea would be easy to find again.']),
('One useful sample', [
'The next morning Anitha chose strong cotton and drew a rectangle on an old envelope. She wanted a bag that could hold pencils without their points catching in a seam. Halfway through, she noticed the opening was too narrow. She unpicked it. The notebook gained its first practical note: leave more room than the drawing suggests.',
'When the sample was finished, she asked her daughter to use it for a week. A loose thread appeared on Tuesday. On Thursday, the little loop proved useful for hanging it from a hook. By Saturday the bag was dusty and much more informative than a photograph of a perfect, unused product would have been.',
'Anitha wrote down what worked and what needed changing. She did not make ten more bags immediately. She made one better bag. Trying a sample had given her something more useful than a promise of success: a clearer question for the next attempt.']),
('A photograph in the window', [
'Her sister asked for a picture. Anitha first photographed the bag on a busy kitchen table. A steel plate reflected the light and the tablecloth competed with the fabric. The bag looked smaller and darker than it was. She tried again near a window, with a plain sheet behind it and the camera held steady.',
'She took three photographs: the whole bag, the inside and a close view of the stitching. She placed a familiar pencil beside it to make its size easier to understand. She avoided hiding the opening with decorative flowers. If somebody asked about the bag, the pictures should answer their ordinary questions.',
'She kept the pictures together and named them clearly. Her notebook gained another line: show what a person needs to know. Making the photograph useful felt less intimidating than trying to make it look like an advertisement.']),
('A conversation before a promise', [
'A neighbour saw the pictures and asked about bags for a reading group. Anitha felt excited and wanted to say yes immediately. Instead she opened her notebook. How many bags? Which size? Would the group want names on them? When were they needed? Would the neighbour choose the cloth, or should Anitha show available options?',
'They agreed to look at one sample before deciding on a batch. Anitha explained that she was still learning how long the work would take. The neighbour was glad to know what was possible before telling the group. A careful conversation made room for both enthusiasm and uncertainty.',
'Afterwards, Anitha put the agreed details in a message and asked whether she had understood correctly. It was easier to correct a sentence that evening than to discover a different expectation after every bag had been stitched.']),
('The time on the kitchen clock', [
'For several days Anitha noted when she could comfortably work. Some mornings a family appointment took priority. On other days she preferred to finish household tasks first. She did not turn her notebook into a timetable demanding the same day from her every day. She wanted a routine that could live alongside the rest of her life.',
'She counted the tasks around the stitching: finding matching thread, cutting cloth, checking seams and putting away finished bags. She left room for something to go wrong. A needle might need changing. A sample might need another attempt. A realistic promise included that ordinary uncertainty.',
'At home she asked for help with one routine task on afternoons she planned to sew. Not every afternoon worked as planned. Still, her family could understand a clear request more easily than a quiet wish that somebody would notice she needed time.']),
('A note beside each order', [
'The reading group approved the sample. Anitha recorded the agreed quantity, fabric and date. She kept the conversation beside these notes. Remembering a friendly conversation and keeping a clear record were different things, and both could matter.',
'She separated what had been requested from what had been finished. A tick beside a bag meant she had checked its stitching; it did not mean it had been delivered or paid for. Keeping those steps separate helped her explain the state of the work without guessing.',
'Before making new arrangements she checked what was already on the page. There was no prize for accepting more than she could comfortably finish. She wanted the people receiving the bags, and the person making them, to understand the same small project.']),
('The first useful feedback', [
'When the bags were delivered, one reader asked about a longer loop. Another liked the plain cotton because a name could be written on it clearly. Anitha listened without treating every suggestion as a demand. Different people wanted different things. She could choose which changes suited the bag she wanted to make.',
'She asked herself something that did not appear in the feedback: had she enjoyed the work? Some parts had been satisfying. Cutting many identical pieces had been tiring. She wrote both things down. Her experience belonged in the record alongside the quantity and the comments from the group.',
'Instead of ordering a large stack of materials, she chose one change to try in the next sample. A small piece of real experience could shape the next decision. She could move at a pace that left room to learn.']),
('The next blank page', [
'A month later Anitha turned back to the house with the yellow door. The door still seemed much larger than the house. She liked it that way. Below her first note were sketches, questions and corrected measurements. The pages did not look like a perfect plan. They looked like somebody had begun.',
'Her sister asked what she would make next. Anitha wanted to test a different size, improve the loop and photograph the inside more clearly. She also wanted an afternoon with no sewing at all. Both kinds of plans could fit in the notebook.',
'On the next blank page she wrote, “What would I like to try now?” The story ended without a promise about earnings or a suddenly effortless life. It ended with a woman making room for her own ideas, one useful page at a time.']),
]
BOOK = '[DEMO] An original short fictional book. No real orders, earnings or customer promises are represented.\n\n' + '\n\n'.join('# Chapter '+str(i+1)+' — '+title+'\n\n'+'\n\n'.join(paragraphs) for i,(title,paragraphs) in enumerate(CHAPTERS))


async def seed_reading_demo(db, users):
    oid=ObjectId(sha256(BATCH.encode()).hexdigest()[:24])
    document=ProgramModel.create_document(name=TITLE,
        desc='[DEMO] Try an original article and an eight-chapter story. Turn pages, adjust the text size and return to your saved reading place. Free practice content.',
        category='Personal Development',mode='Online',duration='Read at your own pace',status='Active',note='[DEMO] Reading practice')
    document.update(owner_kind='staff',teacher_name='[DEMO] WomSakhi reading room',price_minor=0,
        cover='/ux/art/scene-woman-writing-notes.webp',demo_batch=BATCH,demo_data=True,
        curriculum=[{'id':'demo-reading-article-v1','title':'[DEMO] An hour that belongs to you','content_type':'article','body':ARTICLE,'detail':'Make room for your own interests.','duration':'5 min','preview':True,'video_url':''},
                    {'id':'demo-reading-book-v1','title':'[DEMO] The Blue Notebook','content_type':'book','body':BOOK,'detail':'Eight short chapters about Anitha and a small beginning at home.','duration':'20 min','preview':True,'video_url':''}])
    result=await db.programs.update_one({'_id':oid},{'$setOnInsert':document},upsert=True)
    enrollments=0
    for user in users:
        uid=str(user['_id'])
        entry=EnrollmentModel.create_document(user_id=uid,member_id=str(user.get('member_id') or ''),program_id=str(oid),program_name=TITLE)
        entry.update(demo_batch=BATCH,demo_data=True)
        written=await db.enrollments.update_one({'user_id':uid,'program_id':str(oid)},{'$setOnInsert':entry},upsert=True)
        enrollments+=bool(written.upserted_id)
    enrolled=await db.enrollments.count_documents({'program_id':str(oid),'status':{'$in':EnrollmentModel.LEARNING}})
    await db.programs.update_one({'_id':oid,'demo_batch':BATCH},{'$set':{'enrolled':enrolled}})
    return {'batch':BATCH,'course_id':str(oid),'title':TITLE,'members':len(users),
            'inserted':{'courses':int(bool(result.upserted_id)),'enrollments':enrollments},
            'course_url':f'http://localhost:3100/app/programs/{oid}',
            'article_url':f'http://localhost:3100/app/programs/{oid}/lesson/1',
            'book_url':f'http://localhost:3100/app/programs/{oid}/lesson/2',
            'note':'Original free examples. Existing reading positions and completion records are preserved. No notifications or payments created.'}
