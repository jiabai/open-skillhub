from backend.core.security.password import get_password_hash, verify_password


def test_password_hash_and_verify():
    password = "StrongPass123!"
    hashed = get_password_hash(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("wrong", hashed) is False
