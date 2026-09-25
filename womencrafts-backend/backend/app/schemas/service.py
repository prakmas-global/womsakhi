from typing import Literal, Optional

from pydantic import BaseModel, field_validator

ServiceStatus = Literal["Active", "Inactive"]
# Any type the admin has created; the route checks it exists in service_types.
ServiceTypeName = str
Duration = Literal["30 min", "45 min", "60 min", "90 min", "120 min"]


# --- Services -----------------------------------------------------------------
class ServiceResponse(BaseModel):
    id: str
    name: str
    type: str
    tone: str
    icon: str
    slot: int = 1
    duration: str
    price: str
    status: str
    bookings: int  # live: appointments naming this service
    description: str


class ServiceListResponse(BaseModel):
    items: list[ServiceResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ServiceCreate(BaseModel):
    name: str
    type: ServiceTypeName = "Fashion"
    duration: Duration = "60 min"
    price: str = ""
    status: ServiceStatus = "Active"
    description: str = ""

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Service name cannot be empty")
        return v


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ServiceTypeName] = None
    duration: Optional[Duration] = None
    price: Optional[str] = None
    status: Optional[ServiceStatus] = None
    description: Optional[str] = None


class ServiceStatusUpdate(BaseModel):
    # Optional so the endpoint can pure-toggle Active<->Inactive when omitted.
    status: Optional[ServiceStatus] = None


# --- Service types ------------------------------------------------------------
class ServiceTypeResponse(BaseModel):
    id: str
    name: str
    desc: str
    services: int
    status: str
    pop: int   # share of all bookings, 0-100, computed
    color: str
    icon: str
    slot: int = 1


class ServiceTypeListResponse(BaseModel):
    items: list[ServiceTypeResponse]
    total: int
    page: int
    page_size: int
    pages: int


class ServiceTypeCreate(BaseModel):
    name: str
    desc: str = ""
    status: ServiceStatus = "Active"

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Type name cannot be empty")
        return v



class ServiceTypeUpdate(BaseModel):
    name: Optional[str] = None
    desc: Optional[str] = None
    status: Optional[ServiceStatus] = None


# --- Stats (stat cards + overview donut + popular list) -----------------------
class ServiceStatCard(BaseModel):
    key: str
    label: str
    value: str
    icon: str
    tone: str
    delta: Optional[str] = None  # only when there is real history to compare


class ServiceOverviewSlice(BaseModel):
    name: str
    value: int
    color: str


class ServicePopularItem(BaseModel):
    icon: str
    name: str
    bookings: str
    tone: str


class ServiceStatsResponse(BaseModel):
    stats: list[ServiceStatCard]
    overview: list[ServiceOverviewSlice]
    overview_total: str
    overview_label: str
    popular: list[ServicePopularItem]
