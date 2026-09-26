from pydantic import BaseModel, field_validator


class DocumentResponse(BaseModel):
    id: str
    user_id: str
    member_id: str
    doc_type: str
    doc_type_label: str
    original_name: str
    content_type: str
    size: int
    status: str
    review_note: str
    reviewed_by_name: str
    submitted: str
    created_at: str
    reviewed_at: str


class VerificationStatusResponse(BaseModel):
    status: str
    label: str
    email: str
    rejection_reason: str
    can_use_app: bool
    review_request_count: int = 0
    review_requested_at: str = ""
    next_review_request_at: str = ""
    documents: list[DocumentResponse]


class ReviewRequestResponse(BaseModel):
    message: str
    request_number: int
    next_request_at: str


class VerificationQueueItem(BaseModel):
    user_id: str
    member_id: str
    full_name: str
    email: str
    phone: str
    status: str
    applied: str
    documents: list[DocumentResponse]


class VerificationQueueResponse(BaseModel):
    items: list[VerificationQueueItem]
    total: int


class RejectRequest(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_required(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            # She is told why. "Rejected, no reason given" is not acceptable.
            raise ValueError("A reason is required — the applicant is told what it says")
        return v


class MessageResponse(BaseModel):
    message: str


class SupportThreadMessage(BaseModel):
    id: str
    sender: str
    sender_name: str
    body: str
    sent_at: str
    sent_label: str


class SupportThread(BaseModel):
    user_id: str
    full_name: str
    email: str
    avatar: str
    unread: int
    last_message: str
    last_at: str
    messages: list[SupportThreadMessage]


class StaffReplyRequest(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def not_empty(cls, v: str) -> str:
        v = (v or "").strip()
        if not v:
            raise ValueError("Write a reply first")
        return v[:2000]
