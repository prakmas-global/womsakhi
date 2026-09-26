from app.core.two_factor import (
    code_at,
    decrypt_secret,
    encrypt_secret,
    new_recovery_codes,
    new_secret,
    provisioning_uri,
    recovery_digest,
    verify_code,
)


def test_totp_matches_rfc_6238_sha1_vector():
    # RFC secret "12345678901234567890" at 59 seconds; RFC uses eight digits,
    # whose final six are the value WomSakhi asks for.
    secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    assert code_at(secret, 59) == "287082"
    assert verify_code(secret, "287 082", 59)


def test_totp_accepts_clock_skew_but_rejects_wrong_code():
    secret = new_secret()
    code = code_at(secret, 1_000_000)
    assert verify_code(secret, code, 1_000_030)
    assert not verify_code(secret, "000000", 1_000_000)


def test_authenticator_secret_is_encrypted_at_rest():
    secret = new_secret()
    encrypted = encrypt_secret(secret)
    assert secret not in encrypted
    assert decrypt_secret(encrypted) == secret
    assert decrypt_secret("not-a-token") == ""


def test_recovery_codes_are_unique_and_stored_as_digests():
    codes = new_recovery_codes()
    assert len(codes) == len(set(codes)) == 8
    assert all(code not in recovery_digest(code) for code in codes)


def test_provisioning_uri_contains_issuer_account_and_secret():
    uri = provisioning_uri("ABC234", "admin@example.com")
    assert uri.startswith("otpauth://totp/WomSakhi%3Aadmin%40example.com")
    assert "secret=ABC234" in uri and "issuer=WomSakhi" in uri
