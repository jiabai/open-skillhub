import bcrypt
from passlib.context import CryptContext

if getattr(bcrypt, "__about__", None) is None:
    class _About:
        __version__ = getattr(bcrypt, "__version__", "unknown")

    setattr(bcrypt, "__about__", _About())

_original_hashpw = bcrypt.hashpw


def _safe_hashpw(password: bytes, salt: bytes) -> bytes:
    if len(password) > 72:
        password = password[:72]
    return _original_hashpw(password, salt)


bcrypt.hashpw = _safe_hashpw

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return _pwd_context.verify(plain_password, hashed_password)
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    return _pwd_context.hash(password)
