"""
Programmes — the shapes the ADMIN screen reads.

Everything the member app reads (`schemas/program.py`, `schemas/catalog.py`,
`schemas/wallet.ProgramDetail`) is untouched. These are supersets: every field
the old admin screen consumed is still here under the same name, and the new
fields are all derived live from the `enrollments` collection rather than from
the stored `enrolled` counter.
"""

from typing import Literal, Optional

from pydantic import BaseModel, field_validator


class ProgramModule(BaseModel):
    """One module, in the shape the member app already renders
    (`me._curriculum_for` reads `title`, `detail`, `duration`)."""
    title: str = ""
    detail: str = ""
    duration: str = ""


class ProgramModuleInput(ProgramModule):
    @field_validator("title")
    @classmethod
    def title_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Every module needs a title")
        return v[:160]

    @field_validator("detail", "duration")
    @classmethod
    def trim(cls, v: str) -> str:
        return (v or "").strip()


class ModulesUpdate(BaseModel):
    modules: list[ProgramModuleInput] = []

    @field_validator("modules")
    @classmethod
    def not_too_many(cls, v: list[ProgramModuleInput]) -> list[ProgramModuleInput]:
        if len(v) > 60:
            raise ValueError("A programme can have at most 60 modules")
        return v


class AdminProgramRow(BaseModel):
    id: str
    name: str
    desc: str
    category: str
    cat_tone: str
    mode: str
    duration: str
    dates: str
    days: str
    #: Live: enrolments on this programme that are not withdrawn.
    enrolled: int
    cap: int
    #: Live fill: enrolled / cap, 0 when there is no cap.
    pct: int
    status: str
    note: str
    bar: str
    curriculum: list[ProgramModule] = []
    #: The stored counter the member catalogue still reads for "seats left".
    #: Shown next to the live count so a mismatch is visible, not hidden.
    seat_counter: int = 0
    active_enrolled: int = 0
    completed: int = 0
    withdrawn: int = 0
    #: completed / (active + completed), as a percentage.
    completion_rate: int = 0
    #: Mean `progress` over active + completed enrolments.
    avg_progress: int = 0
    module_count: int = 0
    #: Whether the member catalogue lists it right now (its status is one the
    #: catalogue opens).
    visible_to_members: bool = False
    created_at: str = ""
    updated_at: str = ""


class AdminProgramList(BaseModel):
    items: list[AdminProgramRow]
    total: int
    page: int
    page_size: int
    pages: int


class AdminProgramStats(BaseModel):
    total_programs: int
    active_programs: int
    upcoming_programs: int
    total_enrollments: int
    completion_rate: int
    completed_programs: int = 0
    draft_programs: int = 0
    archived_programs: int = 0
    visible_programs: int = 0
    #: Distinct members with a non-withdrawn enrolment.
    learners: int = 0
    active_enrollments: int = 0
    completed_enrollments: int = 0
    withdrawn_enrollments: int = 0
    avg_progress: int = 0


class OverviewPoint(BaseModel):
    label: str
    value: int


class AdminProgramOverview(BaseModel):
    range: str
    #: Enrolments created per bucket, oldest first.
    series: list[OverviewPoint]
    new_programs: int
    enrollments: str
    completions: str
    #: "day" | "week" | "month" — what one point on the series counts.
    bucket: str = "week"
    since: str = ""
    until: str = ""


class AdminCategory(BaseModel):
    name: str
    #: Share of all live enrolments, as a percentage.
    value: int
    color: str
    count: int = 0
    programs: int = 0


class EnrolmentRow(BaseModel):
    id: str
    user_id: str
    member_id: str = ""
    name: str
    email: str = ""
    status: str
    progress: int = 0
    sessions_attended: int = 0
    enrolled_at: str = ""
    joined: str = ""
    completed_at: str = ""
    last_activity_at: str = ""


class EnrolmentList(BaseModel):
    program_id: str
    program_name: str
    items: list[EnrolmentRow]
    total: int
    active: int
    completed: int
    withdrawn: int
    completion_rate: int
    avg_progress: int


class EnrolmentStatusUpdate(BaseModel):
    status: Literal["active", "completed", "withdrawn"]
    reason: Optional[str] = None


# --- Create / update ----------------------------------------------------------
# The member-side `schemas/program.py` pins `category` to five literals, but
# the catalogue seeded since then carries "Business", "Career", "Food",
# "Tailoring" and more. Editing any of those through a five-literal schema
# fails validation on a field the admin never touched, so the admin side takes
# any non-empty category and lets the model derive its tone and bar colour.

from app.schemas.program import Mode, ProgramStatus  # noqa: E402


def _clean_category(v: str) -> str:
    v = (v or "").strip()
    if not v:
        raise ValueError("Pick a category")
    return v[:60]


class AdminProgramCreate(BaseModel):
    name: str
    desc: str = ""
    category: str = "Digital Literacy"
    mode: Mode = "Online"
    duration: str = ""
    cap: int = 0
    startDate: str = ""
    days: str = ""
    status: ProgramStatus = "Draft"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Program name cannot be empty")
        return v[:160]

    @field_validator("category")
    @classmethod
    def category_not_empty(cls, v: str) -> str:
        return _clean_category(v)

    @field_validator("cap")
    @classmethod
    def cap_not_negative(cls, v: int) -> int:
        return max(0, v)


class AdminProgramUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    category: Optional[str] = None
    mode: Optional[Mode] = None
    duration: Optional[str] = None
    cap: Optional[int] = None
    startDate: Optional[str] = None
    days: Optional[str] = None
    status: Optional[ProgramStatus] = None

    @field_validator("category")
    @classmethod
    def category_not_empty(cls, v: Optional[str]) -> Optional[str]:
        return None if v is None else _clean_category(v)

    @field_validator("cap")
    @classmethod
    def cap_not_negative(cls, v: Optional[int]) -> Optional[int]:
        return None if v is None else max(0, v)
