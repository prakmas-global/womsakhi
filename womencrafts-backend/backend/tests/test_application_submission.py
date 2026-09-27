from app.models.verification import VerificationStatus
from app.routes.verification import application_is_ready, document_signature_matches


def test_application_queues_only_after_contact_and_both_documents_are_ready():
    assert not application_is_ready(VerificationStatus.PENDING_EMAIL, False, 2)
    assert not application_is_ready(VerificationStatus.PENDING_DOCUMENTS, True, 1)
    assert application_is_ready(VerificationStatus.PENDING_DOCUMENTS, True, 2)


def test_application_cannot_be_resubmitted_after_it_reaches_admin():
    assert not application_is_ready(VerificationStatus.IN_REVIEW, True, 2)
    assert not application_is_ready(VerificationStatus.ACTIVE, True, 2)


def test_identity_upload_signature_must_match_the_claimed_media_type():
    assert document_signature_matches("image/jpeg", b"\xff\xd8\xffrest")
    assert document_signature_matches("image/png", b"\x89PNG\r\n\x1a\nrest")
    assert document_signature_matches("image/webp", b"RIFF1234WEBPrest")
    assert document_signature_matches("application/pdf", b"%PDF-1.7")
    assert document_signature_matches("image/heic", b"\x00\x00\x00\x18ftypheic")
    assert not document_signature_matches("image/png", b"<script>alert(1)")
    assert not document_signature_matches("image/jpeg", b"%PDF-1.7")
