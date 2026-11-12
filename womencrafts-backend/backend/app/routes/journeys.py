"""Three practical journeys, derived from member-owned records rather than local tick boxes."""
import asyncio

from bson import ObjectId
from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.rbac import require_active_member
from app.db.mongodb import get_database
from app.models.enrollment import EnrollmentModel
from app.models.growth import ApplicationModel
from app.models.shop import ListingModel
from app.models.program import ProgramModel

router = APIRouter(prefix="/me/journeys", tags=["Member · Journeys"])


class Step(BaseModel):
    id: str
    title: str
    detail: str
    href: str
    done: bool = False


class Journey(BaseModel):
    id: str
    title: str
    note: str
    steps: list[Step]
    action: str
    href: str


def build_journeys(user, enrollments, work_profile, listing_count, application_count):
    enrolled = bool(enrollments)
    studied = any(e.get("completed_lessons") or e.get("progress", 0) > 0 or e.get("status") == "completed" for e in enrollments)
    finished = any(e.get("status") == "completed" for e in enrollments)
    recent = next((e for e in enrollments if e.get("status") == "active" and ObjectId.is_valid(str(e.get("program_id", "")))), None)
    course = f"/app/programs/{recent['program_id']}" if recent else "/app/programs"
    store = user.get("store") or {}
    ready_shop = bool(store.get("category_key"))
    profile_ready = bool(work_profile and work_profile.get("skills"))
    learn = Journey(id="learn", title="Learn a skill", note="Choose a free course or continue one you have already started.", steps=[
        Step(id="choose", title="Choose a course", detail="See the lessons and price before you join.", href="/app/programs?price=free", done=enrolled),
        Step(id="practise", title="Try your first lesson", detail="Learn at your own pace. Your progress is saved.", href=course, done=studied),
        Step(id="finish", title="Finish your course", detail="Return to your lessons and check your certificate when eligible.", href=course, done=finished),
    ], action="Explore another skill" if finished else "Continue my course" if recent else "Find a free course", href="/app/programs?price=free" if finished or not recent else course)
    sell = Journey(id="sell", title="Sell something", note="Start with one product or service. You decide how much work to take on.", steps=[
        Step(id="shop", title="Set up your shop", detail="Choose what you sell, add a name and a cover photo.", href="/app/documents/store#category", done=ready_shop),
        Step(id="listing", title="Add one product or service", detail="Add photos, a clear description and your price.", href="/app/documents/new", done=listing_count > 0),
        Step(id="share", title="Share your shop link", detail="Send it to someone who might like your work. No account is needed to look.", href="/app/collect"),
    ], action="Set up my shop" if not ready_shop else "Add my first listing" if not listing_count else "Share my shop", href="/app/documents/store#category" if not ready_shop else "/app/documents/new" if not listing_count else "/app/collect")
    work = Journey(id="work", title="Work from home", note="You can browse first. Check the pay, skills and time before you apply.", steps=[
        Step(id="profile", title="Add your skills", detail="Save what you can do and choose who can find you.", href="/app/work/profile", done=profile_ready),
        Step(id="apply", title="Find work and apply", detail="The work board opens with From home selected.", href="/app/opportunities?where=Remote&view=all", done=application_count > 0),
        Step(id="replies", title="Check your applications", detail="See replies and decide what to do next.", href="/app/applications"),
    ], action="Browse work from home", href="/app/opportunities?where=Remote&view=all")
    # A profile is useful but never a barrier to seeing what work exists.
    if application_count:
        work.action, work.href = "Check my applications", "/app/applications"
    return [learn, sell, work]


@router.get("", response_model=list[Journey])
async def my_journeys(me: dict = Depends(require_active_member)):
    db = get_database()
    uid = str(me["_id"])
    user, enrollments, profile, listings, applications = await asyncio.gather(
        db["users"].find_one({"_id": me["_id"]}, {"store": 1}),
        db[EnrollmentModel.collection_name].find({"user_id": uid, "status": {"$in": ["active", "completed"]}}).sort("last_activity_at", -1).to_list(500),
        db["work_profiles"].find_one({"user_id": uid}, {"skills": 1}),
        db[ListingModel.collection_name].count_documents({"user_id": uid, "status": "live", "hidden": {"$ne": True}}, limit=1),
        db[ApplicationModel.collection_name].count_documents({"user_id": uid}, limit=1),
    )
    # An orphaned enrolment must not send her into a missing course.
    ids = [ObjectId(e["program_id"]) for e in enrollments if ObjectId.is_valid(str(e.get("program_id", "")))]
    existing = await db[ProgramModel.collection_name].find({"_id": {"$in": ids}}, {"_id": 1}).to_list(500) if ids else []
    live_ids = {str(p["_id"]) for p in existing}
    usable = [e for e in enrollments if e.get("status") == "completed" or str(e.get("program_id")) in live_ids]
    return build_journeys(user or me, usable, profile, listings, applications)
