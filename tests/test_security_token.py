from backend.core.security.token import generate_api_token, hash_token, verify_token_hash


def test_generate_api_token_format():
    token = generate_api_token()
    assert token.startswith("ask_live_")
    assert len(token) == 73


def test_hash_and_verify_token():
    token = generate_api_token()
    token_hash = hash_token(token)
    assert verify_token_hash(token, token_hash) is True
    assert verify_token_hash("ask_live_" + "0" * 64, token_hash) is False
