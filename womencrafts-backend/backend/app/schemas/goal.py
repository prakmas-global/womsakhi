"""Request and response shapes for goals."""

from pydantic import BaseModel, Field

from app.models.goal import GoalModel


class GoalResponse(BaseModel):
    id: str
    label: str
    kind: str
    target: int
    current: int
    pct: int
    reached: bool
    unit: str
    by: str
    icon: str
    status: str
    manual: bool
    set_on: str


class GoalCreate(BaseModel):
    label: str = Field(..., min_length=3, max_length=120)
    kind: str = Field(GoalModel.KIND_MONEY, description=" | ".join(GoalModel.KINDS))
    #: Money goals are in MINOR units, like every other amount in this codebase.
    target: int = Field(..., gt=0)
    #: Required, not optional. A goal without a date is a wish, and the whole
    #: value of writing one down is being able to tell whether you reached it.
    by: str = Field(..., min_length=2, max_length=60)
    unit: str = Field("", max_length=20)
    icon: str = Field("", max_length=40)


class GoalProgress(BaseModel):
    """Only for goals she moves herself."""

    current: int = Field(..., ge=0)
