"""
Teach — a verified member's own courses.

A member who knows something (tailoring, a recipe business, spoken English,
saving money) writes it as a course: a title, a few lines on who it is for,
and lessons — each a short text and, if she has one, a video link. She makes it
FREE, or sets a PRICE and the UPI id learners should pay. It goes live in Learn
the moment she publishes it; staff can still hide it from the dashboard.

Money on a paid course goes from the learner to the teacher DIRECTLY, by UPI.
WomSakhi never holds it (routes/market.py explains why). So a learner who joins
a paid course is `pending` until the teacher confirms she received the payment
— here, under her course's learners — and only then do the lessons open. A
confirmed payment is written into the teacher's income book (`book_entries`,
via "course"), which is what Earn shows and what her proof of income counts.
"""

import re
from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator, model_validator

from app.core import cache
from app.core import masters
from app.core.media import MediaRefOptional, media_url
from app.core.rbac import require_active_member
from app.core.serializers import to_object_id
from app.db.mongodb import get_database
from app.models.books import BookEntryModel
from app.models.conversation import MemberNotificationModel, notify
from app.models.enrollment import EnrollmentModel
from app.models.program import ProgramModel

router = APIRouter(prefix="/teach", tags=["Member"])

UPI_ID = re.compile(r"^[A-Za-z0-9._-]{2,256}@[A-Za-z][A-Za-z0-9]{1,63}$")
MAX_PRICE_RUPEES = 50_000
MIN_PRICE_RUPEES = 10
MAX_PREVIEWS = 2


def _programs():
    return get_database()[ProgramModel.collection_name]


def _enrollments():
    return get_database()[EnrollmentModel.collection_name]


# ── what she sends ──────────────────────────────────────────────────────────


class LessonIn(BaseModel):
    title: str = Field(min_length=2, max_length=100)
    detail: str = Field("", max_length=300)
    duration: str = Field("", max_length=30)
    body: str = Field("", max_length=8000)
    video_url: str = Field("", max_length=300)
    #: A free preview: anyone can watch this lesson before joining — her
    #: teaser. At most MAX_PREVIEWS per course.
    preview: bool = False

    @field_validator("title", "detail", "duration", "body", "video_url")
    @classmethod
    def _strip(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("video_url")
    @classmethod
    def _link(cls, v: str) -> str:
        if v and not v.lower().startswith("https://"):
            raise ValueError("Use a video link that starts with https://")
        return v


class CourseIn(BaseModel):
    name: str = Field(min_length=4, max_length=100)
    desc: str = Field(min_length=20, max_length=1500)
    category: str
    duration: str = Field("", max_length=40)
    #: Whole rupees. 0 is a free course.
    price_rupees: int = 0
    upi_id: str = Field("", max_length=300)
    lessons: list[LessonIn] = Field(min_length=1, max_length=40)
    #: The course's thumbnail: her upload or a library picture ("" = her
    #: category's picture, which is what every course showed before covers).
    cover: MediaRefOptional = Field(default=None, max_length=500)
    #: Live in Learn now, or kept as a draft only she can see.
    publish: bool = False

    @field_validator("name", "desc", "duration", "upi_id")
    @classmethod
    def _strip(cls, v: str) -> str:
        return (v or "").strip()

    @field_validator("category")
    @classmethod
    def _category(cls, v: str) -> str:
        # Checked against the course categories master in the route
        # (app/core/masters.py): a validator cannot read the database.
        return (v or "").strip()

    @model_validator(mode="after")
    def _price(self):
        if sum(1 for l in self.lessons if l.preview) > MAX_PREVIEWS:
            raise ValueError(f"Choose at most {MAX_PREVIEWS} lessons as free previews")
        if self.price_rupees < 0 or self.price_rupees > MAX_PRICE_RUPEES:
            raise ValueError(f"Set a price between ₹{MIN_PRICE_RUPEES} and ₹{MAX_PRICE_RUPEES:,}, or make it free")
        if 0 < self.price_rupees < MIN_PRICE_RUPEES:
            raise ValueError(f"A paid course costs at least ₹{MIN_PRICE_RUPEES}")
        if self.price_rupees and not UPI_ID.match(self.upi_id):
            raise ValueError("Add the UPI ID learners should pay, like name@okaxis")
        return self


# ── what she sees ───────────────────────────────────────────────────────────


class CourseStats(BaseModel):
    learners: int = 0
    learning: int = 0
    completed: int = 0
    #: Asked to join a paid course and not yet confirmed (paid or not).
    pending: int = 0
    #: Of those, the ones who say they have paid — her next thing to do.
    to_confirm: int = 0
    earned_minor: int = 0


class CourseRow(BaseModel):
    id: str
    name: str
    category: str
    status: str
    live: bool
    price_minor: int
    lesson_count: int
    updated_at: str
    stats: CourseStats
    cover: str = ""


class CourseFull(CourseRow):
    desc: str
    duration: str
    upi_id: str
    lessons: list[dict]


class LearnerRow(BaseModel):
    enrollment_id: str
    name: str
    status: str
    progress: int
    joined: str
    payment_status: str = ""
    amount_minor: int = 0
    reference: str = ""
    claimed_at: str = ""


class TeachSummary(BaseModel):
    courses: int
    live: int
    learners: int
    to_confirm: int
    earned_minor: int
    month_minor: int


def _iso(v) -> str:
    return v.isoformat() if isinstance(v, datetime) else ""


def _live(doc: dict) -> bool:
    from app.routes.catalog import OPEN_PROGRAM_STATUSES

    return doc.get("status") in OPEN_PROGRAM_STATUSES


async def _stats_for(program_ids: list[str]) -> dict[str, CourseStats]:
    """Every course's numbers in one pass over its enrolments."""
    out = {pid: CourseStats() for pid in program_ids}
    if not program_ids:
        return out
    rows = await _enrollments().find(
        {"program_id": {"$in": program_ids}},
        {"program_id": 1, "status": 1, "payment": 1},
    ).to_list(None)
    for r in rows:
        st = out.get(r.get("program_id"))
        if st is None:
            continue
        state = r.get("status")
        pay = r.get("payment") or {}
        if state in EnrollmentModel.LEARNING:
            st.learners += 1
            if state == EnrollmentModel.STATUS_COMPLETED:
                st.completed += 1
            else:
                st.learning += 1
        elif state == EnrollmentModel.STATUS_PENDING:
            st.pending += 1
            if pay.get("status") == EnrollmentModel.PAY_CLAIMED:
                st.to_confirm += 1
        if pay.get("status") == EnrollmentModel.PAY_PAID:
            st.earned_minor += int(pay.get("amount_minor") or 0)
    return out


def _row(doc: dict, stats: CourseStats) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc.get("name", ""),
        "category": doc.get("category", ""),
        "status": doc.get("status", "Draft"),
        "live": _live(doc),
        "price_minor": int(doc.get("price_minor") or 0),
        "lesson_count": len(doc.get("curriculum") or []),
        "updated_at": _iso(doc.get("updated_at")),
        "stats": stats,
        "cover": media_url(doc.get("cover") or ""),
    }


def _full(doc: dict, stats: CourseStats) -> CourseFull:
    return CourseFull(
        **_row(doc, stats),
        desc=doc.get("desc", ""),
        duration=doc.get("duration", ""),
        upi_id=doc.get("upi_id", ""),
        lessons=[
            {**{k: (m or {}).get(k, "") for k in ("title", "detail", "duration", "body", "video_url")},
             "preview": bool((m or {}).get("preview"))}
            for m in (doc.get("curriculum") or [])
        ],
    )


async def _mine(course_id: str, me: dict) -> dict:
    doc = await _programs().find_one({"_id": to_object_id(course_id), "owner_id": str(me["_id"])})
    if not doc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That course isn't one of yours")
    return doc


def _fields(body: CourseIn, me: dict) -> dict:
    lessons = [l.model_dump() for l in body.lessons]
    return {
        "name": body.name,
        "desc": body.desc,
        "category": body.category,
        "cat_tone": ProgramModel.tone_for(body.category),
        "bar": ProgramModel.bar_for(body.category),
        "duration": body.duration or f"{len(lessons)} lesson{'s' if len(lessons) != 1 else ''}",
        "mode": "Online",
        "dates": "Start any time",
        "days": "At your own pace",
        "price_minor": body.price_rupees * 100,
        "upi_id": body.upi_id if body.price_rupees else "",
        "curriculum": lessons,
        "cover": body.cover or "",
        "teacher_name": me.get("full_name") or "A WomSakhi member",
        "updated_at": datetime.now(timezone.utc),
    }


# ── her courses ─────────────────────────────────────────────────────────────


@router.get("/summary", response_model=TeachSummary, summary="My teaching, in numbers (for Earn)")
async def summary(me: dict = Depends(require_active_member)):
    docs = await _programs().find({"owner_id": str(me["_id"])}, {"status": 1}).to_list(200)
    ids = [str(d["_id"]) for d in docs]
    stats = await _stats_for(ids)
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    month = await _enrollments().aggregate([
        {"$match": {"program_id": {"$in": ids}, "payment.status": EnrollmentModel.PAY_PAID,
                    "payment.confirmed_at": {"$gte": month_start}}},
        {"$group": {"_id": None, "minor": {"$sum": "$payment.amount_minor"}}},
    ]).to_list(1) if ids else []
    return TeachSummary(
        courses=len(docs),
        live=sum(1 for d in docs if _live(d)),
        learners=sum(s.learners for s in stats.values()),
        to_confirm=sum(s.to_confirm for s in stats.values()),
        earned_minor=sum(s.earned_minor for s in stats.values()),
        month_minor=int((month[0] if month else {}).get("minor") or 0),
    )


@router.get("/courses", response_model=list[CourseRow], summary="Courses I teach")
async def my_courses(me: dict = Depends(require_active_member)):
    docs = await _programs().find({"owner_id": str(me["_id"])}).sort("updated_at", -1).to_list(200)
    stats = await _stats_for([str(d["_id"]) for d in docs])
    return [CourseRow(**_row(d, stats[str(d["_id"])])) for d in docs]


@router.post("/courses", response_model=CourseFull, status_code=status.HTTP_201_CREATED, summary="Teach a new course")
async def create_course(body: CourseIn, me: dict = Depends(require_active_member)):
    body.category = await masters.check("course_categories", body.category, level="child", field="category")
    doc = ProgramModel.create_document(
        name=body.name, desc=body.desc, category=body.category, mode="Online",
        cap=0, status="Active" if body.publish else "Draft",
    )
    doc.update(_fields(body, me))
    doc.update(owner_kind=ProgramModel.OWNER_MEMBER, owner_id=str(me["_id"]),
               note="Live" if body.publish else "Draft")
    doc["_id"] = (await _programs().insert_one(doc)).inserted_id
    cache.forget_prefix("catalog:")
    return _full(doc, CourseStats())


@router.get("/courses/{course_id}", response_model=CourseFull, summary="One of my courses")
async def get_course(course_id: str, me: dict = Depends(require_active_member)):
    doc = await _mine(course_id, me)
    stats = await _stats_for([course_id])
    return _full(doc, stats[course_id])


@router.put("/courses/{course_id}", response_model=CourseFull, summary="Save my course")
async def save_course(course_id: str, body: CourseIn, me: dict = Depends(require_active_member)):
    doc = await _mine(course_id, me)
    # A course keeps a category staff have since disabled or renamed away from,
    # as long as she doesn't change it; a new choice must be an active one.
    if body.category != doc.get("category"):
        body.category = await masters.check("course_categories", body.category, level="child", field="category")
    fields = _fields(body, me)
    # Archived by staff stays archived: she cannot re-publish what they hid.
    if doc.get("status") != "Archived":
        fields["status"] = "Active" if body.publish else "Draft"
        fields["note"] = "Live" if body.publish else "Draft"
    fresh = await _programs().find_one_and_update({"_id": doc["_id"]}, {"$set": fields}, return_document=True)
    cache.forget_prefix("catalog:")
    stats = await _stats_for([course_id])
    return _full(fresh, stats[course_id])


@router.post("/courses/{course_id}/publish", response_model=CourseFull, summary="Put my course live")
async def publish(course_id: str, me: dict = Depends(require_active_member)):
    return await _set_live(course_id, me, True)


@router.post("/courses/{course_id}/unpublish", response_model=CourseFull, summary="Take my course down")
async def unpublish(course_id: str, me: dict = Depends(require_active_member)):
    return await _set_live(course_id, me, False)


async def _set_live(course_id: str, me: dict, live: bool) -> CourseFull:
    doc = await _mine(course_id, me)
    if doc.get("status") == "Archived":
        raise HTTPException(status.HTTP_409_CONFLICT,
                            "Our team has taken this course down. Write to us through Help to talk about it.")
    if live and not doc.get("curriculum"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one lesson first.")
    fresh = await _programs().find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {"status": "Active" if live else "Draft", "note": "Live" if live else "Draft",
                  "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    cache.forget_prefix("catalog:")
    stats = await _stats_for([course_id])
    return _full(fresh, stats[course_id])


# ── her learners, and their payments ────────────────────────────────────────


@router.get("/courses/{course_id}/learners", response_model=list[LearnerRow], summary="Who is learning")
async def learners(course_id: str, me: dict = Depends(require_active_member)):
    await _mine(course_id, me)
    rows = await _enrollments().find(
        {"program_id": course_id, "status": {"$ne": EnrollmentModel.STATUS_WITHDRAWN}}
    ).sort("updated_at", -1).to_list(500)
    users = {
        str(u["_id"]): u.get("full_name") or "A member"
        for u in await get_database()["users"].find(
            {"_id": {"$in": [ObjectId(r["user_id"]) for r in rows if ObjectId.is_valid(r.get("user_id", ""))]}},
            {"full_name": 1},
        ).to_list(None)
    }
    out = []
    for r in rows:
        pay = r.get("payment") or {}
        created = r.get("created_at")
        out.append(LearnerRow(
            enrollment_id=str(r["_id"]),
            name=users.get(r.get("user_id", ""), "A member"),
            status=r.get("status", ""),
            progress=int(r.get("progress") or 0),
            joined=created.strftime("%b %d, %Y") if isinstance(created, datetime) else "",
            payment_status=pay.get("status", ""),
            amount_minor=int(pay.get("amount_minor") or 0),
            reference=pay.get("reference", ""),
            claimed_at=_iso(pay.get("claimed_at")),
        ))
    # Payments to confirm first: they are the one thing on this screen waiting on her.
    order = {EnrollmentModel.PAY_CLAIMED: 0, EnrollmentModel.PAY_AWAITING: 1}
    out.sort(key=lambda l: order.get(l.payment_status, 2) if l.status == EnrollmentModel.STATUS_PENDING else 3)
    return out


async def _pending_learner(enrollment_id: str, me: dict) -> tuple[dict, dict]:
    e = await _enrollments().find_one({"_id": to_object_id(enrollment_id)})
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "That learner isn't here any more")
    program = await _mine(e.get("program_id", ""), me)
    if e.get("status") != EnrollmentModel.STATUS_PENDING:
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment has already been handled.")
    return e, program


@router.post("/learners/{enrollment_id}/confirm", response_model=LearnerRow, summary="I received her payment")
async def confirm_payment(enrollment_id: str, me: dict = Depends(require_active_member)):
    e, program = await _pending_learner(enrollment_id, me)
    now = datetime.now(timezone.utc)
    amount = int((e.get("payment") or {}).get("amount_minor") or program.get("price_minor") or 0)
    fresh = await _enrollments().find_one_and_update(
        {"_id": e["_id"], "status": EnrollmentModel.STATUS_PENDING},
        {"$set": {"status": EnrollmentModel.STATUS_ACTIVE, "payment.status": EnrollmentModel.PAY_PAID,
                  "payment.amount_minor": amount, "payment.confirmed_at": now, "payment.confirmed_by": str(me["_id"]),
                  "last_activity_at": now, "updated_at": now}},
        return_document=True,
    )
    if not fresh:
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment has already been handled.")
    learner = await get_database()["users"].find_one({"_id": to_object_id(e["user_id"])}, {"full_name": 1})
    name = (learner or {}).get("full_name") or "A member"
    # Into her income book: Earn shows it, and her proof of income counts it.
    await get_database()[BookEntryModel.collection_name].insert_one(BookEntryModel.create_document(
        user_id=str(me["_id"]), who=name, what=f"Course: {program.get('name', '')}",
        minor=amount, state="paid", via="course", on=now,
    ))
    await notify(get_database(), e["user_id"], "You're in — your course is open",
                 f"{program.get('teacher_name') or 'Your teacher'} confirmed your payment for {program.get('name', '')}.",
                 MemberNotificationModel.TYPE_PROGRAM, f"/app/programs/{e['program_id']}")
    cache.forget_user(str(me["_id"]))
    return LearnerRow(enrollment_id=enrollment_id, name=name, status=fresh["status"], progress=int(fresh.get("progress") or 0),
                      joined=fresh["created_at"].strftime("%b %d, %Y"), payment_status=EnrollmentModel.PAY_PAID,
                      amount_minor=amount, reference=(fresh.get("payment") or {}).get("reference", ""))


class DeclineIn(BaseModel):
    note: str = Field("", max_length=200)


@router.post("/learners/{enrollment_id}/decline", response_model=LearnerRow, summary="I did not receive her payment")
async def decline_payment(enrollment_id: str, body: Optional[DeclineIn] = None, me: dict = Depends(require_active_member)):
    e, program = await _pending_learner(enrollment_id, me)
    now = datetime.now(timezone.utc)
    note = (body.note if body else "").strip()
    fresh = await _enrollments().find_one_and_update(
        {"_id": e["_id"], "status": EnrollmentModel.STATUS_PENDING},
        {"$set": {"status": EnrollmentModel.STATUS_WITHDRAWN, "payment.status": EnrollmentModel.PAY_DECLINED,
                  "payment.declined_at": now, "payment.note": note, "updated_at": now}},
        return_document=True,
    )
    if not fresh:
        raise HTTPException(status.HTTP_409_CONFLICT, "This payment has already been handled.")
    await _programs().update_one({"_id": program["_id"], "enrolled": {"$gt": 0}}, {"$inc": {"enrolled": -1}})
    cache.forget_prefix("catalog:")
    await notify(get_database(), e["user_id"], "Your teacher could not find your payment",
                 note or f"{program.get('name', '')} — check the UPI ID and try joining again, or message her.",
                 MemberNotificationModel.TYPE_PROGRAM, f"/app/programs/{e['program_id']}")
    learner = await get_database()["users"].find_one({"_id": to_object_id(e["user_id"])}, {"full_name": 1})
    return LearnerRow(enrollment_id=enrollment_id, name=(learner or {}).get("full_name") or "A member",
                      status=fresh["status"], progress=int(fresh.get("progress") or 0),
                      joined=fresh["created_at"].strftime("%b %d, %Y"), payment_status=EnrollmentModel.PAY_DECLINED,
                      amount_minor=int((fresh.get("payment") or {}).get("amount_minor") or 0))
