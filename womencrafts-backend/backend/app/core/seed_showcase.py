"""Additive development showcase. Existing identities and records are never rewritten.

Every inserted document has demo_batch/demo_key. No external deliveries, live SOS,
wallet credits, gateway orders, credentials or fabricated operational successes.
"""
from __future__ import annotations

import asyncio
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from hashlib import sha256

from bson import ObjectId
from pymongo import UpdateOne

from app.core.config import settings
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.calendar import CalendarEventModel
from app.models.certificate import CertificateModel
from app.models.community import CircleModel, CircleMemberModel, PostModel, PostReplyModel, StoryModel
from app.models.content import ContentItemModel
from app.models.enrollment import BookingModel, EnrollmentModel
from app.models.exchange import SwapModel, ExchangeModel
from app.models.goal import GoalModel
from app.models.appointment import AppointmentModel
from app.models.message import SupportThreadModel
from app.models.conversation import MemberMessageModel
from app.models.sakhi import ConversationModel, SakhiMessageModel
from app.models.reminders import ReminderModel
from app.models.skills import AttemptModel
from app.models.groupbuy import GroupBuyJoinerModel
from app.models.staff import SupportTicketModel
from app.models.wallet import SupportRequestModel
from app.models.growth import EventModel, EventRegistrationModel, MentorModel, MentorshipRequestModel, OpportunityModel, ApplicationModel
from app.models.member_conversation import MemberConversationModel
from app.models.reference import MyReferenceModel
from app.models.shop import ListingModel, ShopOrderModel, ReviewModel, ShopOperationModel
from app.models.vault import PocketModel, VaultMoveModel

BATCH = 'module_showcase_v1'
NOTE = '[DEMO] Practice data only. No real order, payment, appointment or medical record.'
STATES = ('awaiting', 'claimed', 'paid', 'declined')


class Showcase:
    def __init__(self, db, users, now=None):
        self.db, self.users = db, users
        self.now = now or datetime.now(timezone.utc)
        self.docs = defaultdict(list)
        self.examples = []

    def add(self, collection, key, doc):
        key = f'{BATCH}:{key}'
        oid = ObjectId(sha256(key.encode()).hexdigest()[:24])
        row = {**doc, '_id': oid, 'demo': True, 'demo_batch': BATCH, 'demo_key': key}
        row.setdefault('created_at', self.now)
        row.setdefault('updated_at', self.now)
        self.docs[collection].append(row)
        return str(oid)

    def later(self, days):
        return self.now + timedelta(days=days)

    async def build(self):
        if len(self.users) < 2:
            raise ValueError('At least two existing active Member accounts are needed.')
        services = await self.db.services.find({}).to_list(20)
        assessments = await self.db.assessments.find({}).to_list(20)
        steps = await self.db.digital_steps.find({}).to_list(20)
        references = await self.db.reference.find({}).to_list(20)
        buys = await self.db.group_buys.find({}).to_list(20)
        doctors = await self.db.doctors.find({}).to_list(20)
        skills = await self.db.work_skills.find({'active': {'$ne': False}}).to_list(10)
        existing_profiles = {p['user_id'] for p in await self.db.work_profiles.find({}, {'user_id': 1}).to_list(1000)}
        existing_mentors = {m.get('owner_id'): m for m in await self.db.mentors.find({'owner_id': {'$exists': True}}).to_list(1000)}
        for i, user in enumerate(self.users):
            peer = self.users[(i+1) % len(self.users)]
            uid, pid = str(user['_id']), str(peer['_id'])
            name, peer_name = user.get('full_name') or 'Member', peer.get('full_name') or 'Member'
            mid = str(user.get('member_id') or '')
            base = uid
            # Learning and direct UPI: each account has all four states as payer and provider.
            for j, state in enumerate(STATES):
                course_name = f'[DEMO] {name}: home-business lesson — {state}'
                course = self.add('programs', f'{base}:course:{state}', {
                    'name': course_name, 'desc': NOTE+' Learn product photography and pricing at home.', 'category': 'Handicrafts',
                    'owner_id': uid, 'owner_kind': 'member', 'teacher_name': name, 'price_minor': (j+1)*10000,
                    'fee': f'₹{(j+1)*100}', 'upi_id': 'DEMO-NOT-PAYABLE', 'status': 'Ongoing', 'cap': 20,
                    'enrolled': 1, 'mode': 'Online', 'duration': '2 short lessons', 'cover': '/ux/art/course-sewing-machine.webp',
                    'curriculum': [{'title': '[DEMO] Prepare your work', 'body': 'Practice lesson: write down the materials and time needed.', 'detail': 'A small step from home.'},
                                   {'title': '[DEMO] Set a simple price', 'body': 'Practice lesson: compare materials, time and delivery costs.', 'detail': 'An example, not a live sale.'}],
                })
                pay = {'status': state, 'amount_minor': (j+1)*10000}
                if state != 'awaiting':
                    pay.update(reference=f'DEMO-{i}-{j}-NOT-A-BANK-UTR', claimed_at=self.later(-2))
                if state == 'paid':
                    pay.update(confirmed_at=self.later(-1), confirmed_by=uid)
                if state == 'declined':
                    pay.update(note='[DEMO] Recipient could not locate this practice reference.', declined_at=self.later(-1))
                enrollment = EnrollmentModel.create_document(pid, str(peer.get('member_id') or ''), course, course_name,
                    'active' if state == 'paid' else 'withdrawn' if state == 'declined' else 'pending')
                enrollment.update(payment=pay, progress=50 if state == 'paid' else 0, completed_lessons=[1] if state == 'paid' else [])
                self.add('enrollments', f'{base}:enrollment:{state}', enrollment)
                if state == 'paid':
                    self.add('book_entries', f'{base}:course-income', BookEntryModel.create_document(user_id=uid, who=f'[DEMO] {peer_name}', what=course_name, minor=pay['amount_minor'], via='course'))
            free_title = f'[DEMO] {name}: finished learning journey'
            free_course = self.add('programs', f'{base}:free-course', {'name': free_title, 'desc': NOTE, 'owner_kind': 'member', 'owner_id': uid, 'teacher_name': name, 'status': 'Ongoing', 'price_minor': 0, 'fee': 'Free', 'category': 'Business', 'mode': 'Online', 'curriculum': [{'title': 'Practice', 'body': NOTE}], 'cover': '/ux/art/course-holding-certificate.webp'})
            finished = EnrollmentModel.create_document(pid, '', free_course, free_title, 'completed')
            finished.update(progress=100, sessions_attended=1, completed_lessons=[1], completed_at=self.later(-3))
            self.add('enrollments', f'{base}:finished', finished)
            cert = CertificateModel.create_document(pid, '', f'[DEMO] {peer_name}', free_course, free_title, hours='1')
            cert['code'] = f'DEMO-{uid[-6:].upper()}-COURSE'
            self.add('certificates', f'{base}:certificate', cert)
            mentor = existing_mentors.get(uid)
            if mentor:
                mentor_id = str(mentor['_id'])
            else:
                mentor_doc = MentorModel.create_document(f'[DEMO] {name}', headline='[DEMO] Working from home and pricing your work', bio=NOTE, expertise=['Business'], languages=['English'], status='active')
                mentor_doc.update(owner_id=uid, owner_kind='member', price_minor=25000, upi_id='DEMO-NOT-PAYABLE', session_mode='Video call', session_minutes=30)
                mentor_id = self.add('mentors', f'{base}:mentor', mentor_doc)
            for state in STATES:
                request = MentorshipRequestModel.create_document(pid, '', mentor_id, f'[DEMO] {name}', goal=f'[DEMO] Practise setting a price — {state}', preferred_time='Weekday afternoon')
                pay = {'status': state, 'amount_minor': 25000}
                if state != 'awaiting': pay.update(reference=f'DEMO-MENTOR-{i}-{state}', claimed_at=self.later(-2))
                if state == 'paid': pay.update(confirmed_at=self.later(-1), confirmed_by=uid)
                if state == 'declined': pay.update(note='[DEMO] Practice reference not received.')
                request.update(owner_id=uid, price_minor=25000, status='accepted', scheduled_for='[DEMO] Next weekday, 2 pm', meeting='[DEMO] No live meeting is booked', payment=pay)
                self.add('mentorship_requests', f'{base}:session:{state}', request)
                if state == 'paid':
                    self.add('book_entries', f'{base}:mentor-income', BookEntryModel.create_document(user_id=uid, who=f'[DEMO] {peer_name}', what='[DEMO] Mentoring practice session', minor=25000, via='mentoring'))
            self.examples.append({'name': name, 'user_id': uid, 'payments': '/app/payments', 'course': f'/app/teach/{ObjectId(sha256(f"{BATCH}:{base}:course:claimed".encode()).hexdigest()[:24])}?tab=learners'})
            self.add('appointments',f'{base}:staff-appointment',AppointmentModel.create_document(f'[DEMO] {name}','[DEMO] Home-business guidance',day=self.later(5).strftime('%a'),date=self.later(5).strftime('%b %d'),time='02:00 PM',notes=NOTE))
            self.add('member_threads',f'{base}:team-thread',SupportThreadModel.create_document(user_id=uid))
            message=MemberMessageModel.create_document(uid,mid,'[DEMO] Could you explain the difference between submitting a payment reference and confirming receipt?',sender_name=name)
            message.update(read_by_member=True,read_by_team=True)
            self.add('member_messages',f'{base}:team-message',message)
            # Home, work and hiring.
            if uid not in existing_profiles:
                self.add('work_profiles', f'{base}:work-profile', {'user_id': uid, 'skills': [{'key': s.get('key', ''), 'level': '1-2', 'visible': True} for s in skills[:2]], 'work_types': ['From home'], 'days': ['Weekdays'], 'area': '[DEMO] Home workspace', 'city': '[DEMO]', 'saved': True, 'blocked': []})
            for j, stage in enumerate(('applied','shortlisted','offered','closed')):
                job = OpportunityModel.create_document(f'[DEMO] {name}: craft packing from home ({stage})', org='[DEMO] Practice home business', kind='Freelance', desc=NOTE, location='Work from home', mode='Remote', pay='[DEMO] ₹500 per sample batch', deadline=self.later(20).date().isoformat(), owner_kind='member', owner_id=uid, skill_keys=[s.get('key','') for s in skills[:2] if s.get('key')], skills=[s.get('name') or s.get('label') or 'Demo skill' for s in skills[:2]], category=(skills[0].get('category_key') or skills[0].get('category') or '') if skills else '')
                jid = self.add('opportunities', f'{base}:job:{stage}', job)
                app = ApplicationModel.create_document(pid, '', jid, job['title'], org=job['org'], note=NOTE)
                app['status'] = stage
                self.add('applications', f'{base}:application:{stage}', app)
                if j == 0: self.add('saved', f'{base}:saved-job', {'user_id': uid, 'kind': 'job', 'ref_id': jid})
            self.add('portfolio_items', f'{base}:portfolio', {'user_id': uid, 'title': '[DEMO] Handmade sample collection', 'photo': '/ux/art/course-handmade-market-stall.webp', 'made_for': '[DEMO] Practice customer', 'year': self.now.year, 'visible': True})
            for j, kind in enumerate(('count','skill')):
                self.add('goals', f'{base}:goal:{kind}', GoalModel.create_document(user_id=uid, member_id=mid, label=f'[DEMO] {"Complete five practice orders" if kind == "count" else "Learn one craft skill"}', kind=kind, target=5 if kind=='count' else 1, by='This month', current=j))
            if services:
                for j, state in enumerate(('upcoming','completed','cancelled')):
                    service = services[j % len(services)]
                    booking = BookingModel.create_document(uid, mid, str(service['_id']), '[DEMO] '+service.get('name','Practice session'), self.later(5 if state=='upcoming' else -5).date().isoformat(), '02:00 PM', note=NOTE, duration='30 min')
                    booking['status'] = state
                    self.add('bookings', f'{base}:booking:{state}', booking)
            # Selling and receiving orders.
            for j, (title, state) in enumerate((('Handmade tote bag','live'),('Made-to-order blouse','live'),('Festive gift hamper','draft'))):
                listing = ListingModel.create_document(user_id=uid, member_id=mid, kind='product', title=f'[DEMO] {name}: {title}', desc=NOTE, price_minor=(j+1)*25000, stock=10, category='Handicrafts', photo='/ux/art/course-handmade-market-stall.webp', photos=['/ux/art/course-handmade-market-stall.webp','/ux/art/course-photographing-handmade-product.webp'], status=state)
                lid = self.add('shop_listings', f'{base}:listing:{j}', listing)
                for stage in ('New','Making','Ready','Done'):
                    order = ShopOrderModel.create_document(seller_id=uid, buyer_id=pid, buyer_name=f'[DEMO] {peer_name}', listing_id=lid, title=listing['title'], quantity=1, total_minor=listing['price_minor'], note=NOTE, state=stage)
                    oid = self.add('shop_orders', f'{base}:order:{j}:{stage}', order)
                    if stage=='Done': self.add('shop_reviews', f'{base}:review:{j}', ReviewModel.create_document(seller_id=uid, buyer_name=f'[DEMO] {peer_name}', order_id=oid, stars=5, text='[DEMO] A clear example of a completed order and review.', what=listing['title']))
                self.add('shop_operations', f'{base}:operation:{j}', ShopOperationModel.create_document(user_id=uid, kind=('slot','subscription','preorder')[j], title=f'[DEMO] {title} follow-up', contact=f'[DEMO] {peer_name}', amount_minor=listing['price_minor'], status=('scheduled','waiting','draft')[j], due_on=self.later(4).isoformat(), note=NOTE))
            item = self.add('rental_items', f'{base}:rental-item', {'owner_id': uid, 'title': '[DEMO] Sewing machine for practice', 'about': NOTE, 'category': 'Tools', 'photos': ['/ux/art/course-sewing-machine.webp'], 'condition': 'good', 'price_day_minor': 10000, 'price_week_minor': 60000, 'deposit_minor': 50000, 'min_days': 1, 'max_days': 14, 'handover': 'pickup', 'area': '[DEMO]', 'city': '[DEMO]', 'rules': ['Demo item; not available for actual collection'], 'status': 'live', 'times_rented': 0})
            self.add('rental_bookings', f'{base}:rental-request', {'item_id': item, 'owner_id': uid, 'renter_id': pid, 'item_title': '[DEMO] Sewing machine for practice', 'start': self.later(7).date().isoformat(), 'end': self.later(9).date().isoformat(), 'days': 3, 'rent_minor': 30000, 'deposit_minor': 50000, 'note': NOTE, 'status': 'requested', 'history': []})
            # Personal money is record keeping, not wallet funding.
            for j, (kind, amount, category) in enumerate((('in',250000,'sales'),('out',40000,'food'),('out',15000,'phone'))):
                self.add('khata_entries', f'{base}:entry:{j}', {'user_id': uid, 'kind': kind, 'amount_minor': amount, 'category': category, 'note': f'[DEMO] {("Tailoring income","Groceries","Phone recharge")[j]}', 'on': self.now.astimezone(timezone(timedelta(hours=5,minutes=30))).date().isoformat(), 'source': 'me'})
            self.add('khata_notes', f'{base}:note', {'user_id':uid,'text':'[DEMO] Remember the material cost before quoting a customer.','colour':'yellow','pinned':True,'amount_minor':50000,'remind_on':self.later(3).date().isoformat()})
            for j, state in enumerate(('owed','promised','paid')):
                self.add('book_entries', f'{base}:book:{state}', BookEntryModel.create_document(user_id=uid, who=f'[DEMO] {peer_name}', what=f'[DEMO] Craft order — {state}', minor=(j+1)*50000, state=state, due=self.later(7)))
                self.add('money_commitments', f'{base}:bill:{j}', {'user_id':uid,'what':f'[DEMO] {("Electricity bill","School materials","Phone plan")[j]}','minor':(j+1)*10000,'due':self.later(5+j),'weight':'should-pay','paid':False,'icon':'CalendarDays','tint':'--ux-surface-2','ink':'--ux-muted','if_missed':''})
            pocket = self.add('vault_pockets', f'{base}:pocket', PocketModel.create_document(user_id=uid,name='[DEMO] Material budget',note=NOTE,goal_minor=100000))
            self.add('vault_moves', f'{base}:pocket-move', VaultMoveModel.create_document(user_id=uid,pocket_id=pocket,what='[DEMO] Earmarked on paper; no money moved',minor=10000))
            self.add('khata_chits', f'{base}:chit', {'owner_id':uid,'name':'[DEMO] Monthly practice circle','value_minor':300000,'members_count':3,'monthly_minor':100000,'start_month':self.now.strftime('%Y-%m'),'method':'fixed','commission_pct':0,'my_role':'organiser','status':'running','members':[{'id':f'demo-{j}','name':f'[DEMO] {u.get("full_name") or "Member"}','phone':'','user_id':str(u['_id']),'order':j} for j,u in enumerate(self.users[:3])],'months':{}})
            # Community, learning exchange and messages. No delivery jobs are enqueued.
            circle = self.add('circles', f'{base}:circle', CircleModel.create_document(f'[DEMO] {name}: home business group', topic='Business', desc=NOTE, created_by=uid))
            for member in (uid,pid): self.add('circle_members', f'{base}:circle-member:{member}', CircleMemberModel.create_document(member,circle))
            post = self.add('circle_posts', f'{base}:circle-post', PostModel.create_document(circle,uid,name,'','[DEMO] How do you plan the time and material cost for a home order?'))
            self.add('post_replies', f'{base}:circle-reply', PostReplyModel.create_document(post,pid,peer_name,'','[DEMO] I start with a short material list and a realistic delivery date.'))
            self.add('stories', f'{base}:story', StoryModel.create_document(uid,name,'','[DEMO] My first practice order','[DEMO] A sample journey: learn a skill, make a sample and agree on a clear price.',cover='/ux/art/scene-woman-packing-orders.webp'))
            event = self.add('events', f'{base}:event', EventModel.create_document('[DEMO] Planning your first home business',desc=NOTE,date_iso=self.later(8).date().isoformat(),time='02:00 PM',duration='30 min',host=f'[DEMO] {name}',seats=20,language='English'))
            self.add('event_registrations', f'{base}:event-registration', EventRegistrationModel.create_document(uid,mid,event,'[DEMO] Planning your first home business'))
            swap = self.add('skill_swaps', f'{base}:swap', SwapModel.create_document(user_id=uid,member_id=mid,who=name,skill='[DEMO] Simple craft photography',detail=NOTE,wants='[DEMO] Basic bookkeeping',online=True))
            self.add('skill_exchanges', f'{base}:exchange', ExchangeModel.create_document(swap_id=swap,asker_id=pid,owner_id=uid,opening=NOTE))
            self.add('member_conversations', f'{base}:conversation', MemberConversationModel.create_document(member_id=uid,kind='buyer',name=f'[DEMO] {peer_name}',subtitle=NOTE,with_user_id=pid,messages=[{'id':f'demo-{i}','text':'[DEMO] Could you explain your sample order process?','body':'[DEMO] Could you explain your sample order process?','from':'them','at':self.now.isoformat(),'read':True}]))
            self.add('member_notifications', f'{base}:notification', {'user_id':uid,'title':'[DEMO] Explore your sample journeys','body':NOTE,'type':'account','href':'/app/payments','read':True,'unread':False})
            chat=self.add('sakhi_conversations',f'{base}:sakhi-chat',ConversationModel.create_document(user_id=uid,title='[DEMO] Plan a home-business day'))
            self.add('sakhi_messages',f'{base}:sakhi-prompt',SakhiMessageModel.create_document(conversation_id=chat,user_id=uid,kind='user',role='user',content='[DEMO] Help me split a practice day between learning a skill and preparing a sample.',text='[DEMO] Help me plan my practice day.'))
            reminder=ReminderModel.create_document(user_id=uid,title_key='rem.preset.deadline',schedule_type='once',tz='Asia/Kolkata',at=self.later(5),payload={'title':'[DEMO] Review the sample order', 'note':NOTE})
            reminder['state']='paused'
            self.add('reminder_definitions',f'{base}:paused-reminder',reminder)
            # Family and wellbeing examples, without fictional diagnoses or active emergencies.
            child = self.add('member_children', f'{base}:child', {'user_id':uid,'name':'[DEMO] Sample child','cls':'Class 5','school':'[DEMO] Practice school','fee_minor':100000,'saved_minor':25000})
            self.add('school_tasks', f'{base}:school-task', {'user_id':uid,'child_id':child,'what':'[DEMO] Plan school materials','detail':NOTE,'kind':'date','due':self.later(6),'cost_minor':10000,'done':False})
            self.add('my_checklists', f'{base}:checklist', {'user_id':uid,'key':'doctor','kind':'doctor','items':['[DEMO] Write down questions','[DEMO] List documents to carry'],'done':[]})
            self.add('health_entries', f'{base}:wellbeing', {'user_id':uid,'kind':'workout','date':self.now.date().isoformat(),'data':{'activity':'Walking','minutes':20,'steps':2000,'intensity':'Easy','note':NOTE}})
            self.add('safety_reports', f'{base}:safety-report', {'user_id':uid,'category':'Other','details':NOTE+' This is a resolved practice report, not an emergency.','about':'[DEMO] Reporting walkthrough','anonymous':False,'status':'resolved','evidence':''})
            self.add('support_tickets', f'{base}:ticket', SupportTicketModel.create_document(uid,name,'demo@example.invalid','[DEMO] Understanding my payment status',NOTE,reference=f'DEMO-{uid[-6:]}'))
            self.add('feed_posts', f'{base}:feed-post', {'author_id':uid,'text':'[DEMO] I am learning how a home-business journey fits together: sample, order, delivery and payment confirmation.','photos':['/ux/art/scene-woman-packing-orders.webp'],'audience':'everyone','likes':[],'like_count':0,'comment_count':0,'reported_by':[],'deleted':False})
            if assessments:
                self.add('assessment_attempts', f'{base}:attempt', AttemptModel.create_document(user_id=uid,member_id=mid,assessment_id=str(assessments[0]['_id']),score=40,passed=False,answers=[0]))
            if buys:
                self.add('group_buy_joiners', f'{base}:group-buy', GroupBuyJoinerModel.create_document(user_id=uid,member_id=mid,buy_id=str(buys[0]['_id']),quantity=1))
            if doctors:
                doctor=doctors[i % len(doctors)]
                self.add('doctor_consultations', f'{base}:consultation', {'user_id':uid,'member_name':name,'doctor_id':str(doctor['_id']),'doctor_name':'[DEMO] Consultation history','speciality':doctor.get('speciality',''),'doctor_photo':'','fee_minor':0,'clinic':'[DEMO] No appointment was booked','city':'[DEMO]','start':self.later(-10),'mode':'Video','reason':NOTE,'symptoms':[],'status':'cancelled','shared':[]})
            support=SupportRequestModel.create_document(user_id=uid,member_id=mid,member_name=name,what_for='[DEMO] Course fee enquiry',reason=NOTE,amount_needed_minor=50000)
            support.update(status='declined',staff_note='[DEMO] Example decision only. No grant or wallet credit was issued.')
            self.add('support_requests', f'{base}:support-enquiry',support)
            if steps: self.add('digital_progress', f'{base}:digital', {'user_id':uid,'step_id':str(steps[0]['_id']),'done_at':self.later(-2)})
            if references:
                ref=references[i % len(references)]
                self.add('reference_mine', f'{base}:reference', MyReferenceModel.create_document(user_id=uid,ref_id=str(ref['_id']),topic=ref.get('topic','scheme'),state='interested',note=NOTE))
            self.add('feedback', f'{base}:feedback', {'seq':900000+i,'text':'[DEMO] The payment stages make the course journey clear.','user_name':name,'user_email':'demo@example.invalid','type':'Suggestion','program':'[DEMO] Showcase','rating':4,'sentiment':'Positive','status':'Open','date':self.now})
        # Staff catalogue/calendar/library examples without spoofing operational state.
        for i, status in enumerate(('Published','Draft','Scheduled')):
            self.add('content_items', f'content:{status}', ContentItemModel.create_document(f'[DEMO] Running a small business from home — {status}',slug=f'demo-home-business-{status.lower()}',type='Blog Post',status=status,author='[DEMO] WomSakhi',description=NOTE,body='[DEMO] Start with a skill you already know. Prepare one sample, write down costs, agree on a price and track each order.',cover='/ux/art/course-handmade-market-stall.webp'))
            self.add('calendar_events', f'calendar:{i}', CalendarEventModel.create_document(900000+i,f'[DEMO] Home business session {i+1}','Business',self.later(i+3),time='02:00 PM',notes=NOTE))
        return self

    async def apply(self):
        if settings.is_production:
            raise RuntimeError('Showcase data is development-only.')
        report={}
        gate=asyncio.Semaphore(6)
        async def write(collection, docs):
            async with gate:
                collisions=await self.db[collection].count_documents({'_id':{'$in':[d['_id'] for d in docs]},'demo_batch':{'$ne':BATCH}})
                if collisions: raise RuntimeError(f'Unowned showcase ID collision in {collection}')
                result=await self.db[collection].bulk_write([UpdateOne({'_id':d['_id']},{'$setOnInsert':d},upsert=True) for d in docs],ordered=True)
                report[collection]={'planned':len(docs),'inserted':result.upserted_count,'retained':len(docs)-result.upserted_count}
        await asyncio.gather(*(write(c,docs) for c,docs in self.docs.items()))
        return report


async def plan_showcase():
    if settings.is_production: raise RuntimeError('Showcase data is development-only.')
    db=get_database()
    users=await db.users.find({'role':'Member','is_active':True,'verification_status':'active'}).sort('full_name',1).to_list(100)
    return await Showcase(db,users).build()
