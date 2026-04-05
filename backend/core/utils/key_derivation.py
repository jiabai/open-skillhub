from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


_HKDF_SALT = b"open-skillhub:key-derivation:v1"


def derive_aes256_key(secret: str, purpose: str) -> bytes:
    return HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_HKDF_SALT,
        info=purpose.encode("utf-8"),
    ).derive(secret.encode("utf-8"))
