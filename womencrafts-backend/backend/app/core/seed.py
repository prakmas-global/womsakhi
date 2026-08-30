"""
Non-destructive demo seeding.

On startup we fill any EMPTY collection with the exact records the UI shows
today, so every screen becomes dynamic without losing real data. If a
collection already has documents, we leave it untouched.
"""

from datetime import datetime, timezone

from app.db.mongodb import get_database
from app.models.member import MemberModel
from app.models.role import RoleModel
from app.models.segment import SegmentModel


def _date(label: str) -> datetime:
    """Parse a 'May 20, 2024' label into a timezone-aware datetime."""
    return datetime.strptime(label, "%b %d, %Y").replace(tzinfo=timezone.utc)


# --- Members (Users directory) ------------------------------------------------
_MEMBERS = [
    dict(full_name="Priya Sharma", role="Member", email="priya.sharma@example.com", phone="+91 98765 43210", status="Active", joined="May 20, 2024", code="WC-12564", location="Mumbai, Maharashtra", dob="12 Aug 1995", gender="Female", referral="PRiya125", engagement=85, segment="Entrepreneur", verified_on="May 21, 2024"),
    dict(full_name="Aisha Khan", role="Instructor", email="aisha.khan@example.com", phone="+91 91234 56789", status="Active", joined="May 18, 2024", code="WC-12563", location="Hyderabad, Telangana", dob="03 Mar 1990", gender="Female", referral="AISHA090", engagement=92, segment="Artisan", verified_on="May 19, 2024"),
    dict(full_name="Neha Patel", role="Member", email="neha.patel@example.com", phone="+91 99887 66554", status="Active", joined="May 16, 2024", code="WC-12562", location="Ahmedabad, Gujarat", dob="27 Nov 1998", gender="Female", referral="NEHA098", engagement=68, segment="Student", verified_on="May 17, 2024"),
    dict(full_name="Sneha Joshi", role="Supervisor", email="sneha.joshi@example.com", phone="+91 87654 32109", status="Active", joined="May 15, 2024", code="WC-12561", location="Pune, Maharashtra", dob="09 Jun 1988", gender="Female", referral="SNEHA088", engagement=78, segment="Entrepreneur", verified_on="May 16, 2024"),
    dict(full_name="Pooja Verma", role="Instructor", email="pooja.verma@example.com", phone="+91 76543 21098", status="Inactive", joined="May 10, 2024", code="WC-12560", location="Jaipur, Rajasthan", dob="18 Jan 1993", gender="Female", referral="POOJA093", engagement=41, segment="Artisan", verified_on="May 11, 2024"),
    dict(full_name="Ananya Singh", role="Member", email="ananya.singh@example.com", phone="+91 88991 23456", status="Pending", joined="May 09, 2024", code="WC-12559", location="Lucknow, Uttar Pradesh", dob="22 Sep 2000", gender="Female", referral="ANANYA00", engagement=34, segment="Job Seeker", verified_on="Awaiting review"),
    dict(full_name="Kavita Rao", role="Supervisor", email="kavita.rao@example.com", phone="+91 77665 44321", status="Active", joined="May 08, 2024", code="WC-12558", location="Bengaluru, Karnataka", dob="05 Dec 1985", gender="Female", referral="KAVITA85", engagement=88, segment="Entrepreneur", verified_on="May 09, 2024"),
    dict(full_name="Meera Iyer", role="Member", email="meera.iyer@example.com", phone="+91 66554 33221", status="Rejected", joined="May 06, 2024", code="WC-12557", location="Chennai, Tamil Nadu", dob="30 Apr 1997", gender="Female", referral="MEERA097", engagement=22, segment="Student", verified_on="Rejected May 07, 2024"),
]

# --- Roles --------------------------------------------------------------------
_ROLES = [
    dict(name="Super Admin", desc="Full access to all modules and settings", users=3, type="System", perms=126, status="Active", icon="Crown", created="Jan 15, 2024"),
    dict(name="Admin", desc="Manage platform users and content", users=12, type="System", perms=98, status="Active", icon="UserCog", created="Jan 20, 2024"),
    dict(name="Instructor", desc="Manage programs and sessions", users=45, type="Custom", perms=64, status="Active", icon="Presentation", created="Feb 03, 2024"),
    dict(name="Supervisor", desc="Oversee users and approve listings", users=36, type="Custom", perms=72, status="Active", icon="UserCheck", created="Feb 18, 2024"),
    dict(name="Member", desc="Access to personal dashboard only", users=120, type="System", perms=18, status="Active", icon="User", created="Mar 01, 2024"),
    dict(name="Support Agent", desc="Handle user queries and support", users=15, type="Custom", perms=35, status="Active", icon="Headset", created="Mar 12, 2024"),
    dict(name="Content Editor", desc="Create and manage content", users=8, type="Custom", perms=40, status="Active", icon="Pencil", created="Apr 09, 2024"),
    dict(name="Viewer", desc="View reports and analytics", users=6, type="Custom", perms=12, status="Inactive", icon="Eye", created="Apr 22, 2024"),
]

# --- Segments -----------------------------------------------------------------
_SEGMENTS = [
    dict(name="Entrepreneurs", desc="Women who own or run their own business", users="3,245", pct="25.2%", eng=82, growth="18.6%", up=True, status="Active", icon="Lightbulb"),
    dict(name="Instructors", desc="Women who teach or mentor in various skills", users="2,180", pct="17.0%", eng=74, growth="9.3%", up=True, status="Active", icon="GraduationCap"),
    dict(name="Students", desc="Women who are learning new skills", users="2,045", pct="15.9%", eng=61, growth="5.2%", up=True, status="Active", icon="BookOpen"),
    dict(name="Artisans", desc="Women skilled in traditional or modern crafts", users="1,890", pct="14.7%", eng=58, growth="2.1%", up=False, status="Active", icon="Palette"),
    dict(name="Support Seekers", desc="Women seeking support and resources", users="1,245", pct="9.7%", eng=49, growth="3.4%", up=True, status="Active", icon="HeartHandshake"),
    dict(name="Job Seekers", desc="Women looking for employment opportunities", users="890", pct="6.9%", eng=45, growth="1.8%", up=False, status="Active", icon="Briefcase"),
    dict(name="Others", desc="Other user types", users="1,350", pct="10.6%", eng=52, growth="0.6%", up=True, status="Active", icon="MessageCircle"),
]


async def seed_if_empty() -> None:
    """Seed each collection only when it is currently empty."""
    db = get_database()

    if await db[MemberModel.collection_name].count_documents({}) == 0:
        docs = [
            MemberModel.create_document(
                full_name=m["full_name"], email=m["email"], phone=m["phone"],
                role=m["role"], status=m["status"], location=m["location"],
                segment=m["segment"], gender=m["gender"], dob=m["dob"],
                referral=m["referral"], engagement=m["engagement"],
                verified_on=m["verified_on"], code=m["code"],
                created_at=_date(m["joined"]),
            )
            for m in _MEMBERS
        ]
        await db[MemberModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} members")

    if await db[RoleModel.collection_name].count_documents({}) == 0:
        from app.core.rbac import DEFAULT_ROLE_MODULES

        docs = [
            RoleModel.create_document(**r, modules=DEFAULT_ROLE_MODULES.get(r["name"], ["dashboard"]))
            for r in _ROLES
        ]
        await db[RoleModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} roles")

    if await db[SegmentModel.collection_name].count_documents({}) == 0:
        docs = [SegmentModel.create_document(**s) for s in _SEGMENTS]
        await db[SegmentModel.collection_name].insert_many(docs)
        print(f"🌱 Seeded {len(docs)} segments")
