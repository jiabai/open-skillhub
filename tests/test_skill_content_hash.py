import hashlib

from backend.core.utils.skill_hash import compute_skill_content_hash


def test_compute_skill_content_hash_is_deterministic_and_ignores_only_system_noise(tmp_path):
    (tmp_path / "nested").mkdir()
    (tmp_path / "__MACOSX").mkdir()

    (tmp_path / "b.txt").write_bytes(b"second")
    (tmp_path / "a.txt").write_bytes(b"first")
    (tmp_path / ".env.example").write_bytes(b"dotfile participates")
    (tmp_path / "nested" / "c.txt").write_bytes(b"third")
    (tmp_path / ".DS_Store").write_bytes(b"ignored mac noise")
    (tmp_path / "Thumbs.db").write_bytes(b"ignored windows noise")
    (tmp_path / "__MACOSX" / "metadata").write_bytes(b"ignored zip noise")

    expected = hashlib.sha256()
    for relative, content in [
        (".env.example", b"dotfile participates"),
        ("a.txt", b"first"),
        ("b.txt", b"second"),
        ("nested/c.txt", b"third"),
    ]:
        expected.update(f"{relative}\0".encode("utf-8"))
        expected.update(content)
        expected.update(b"\0")

    assert compute_skill_content_hash(tmp_path) == expected.hexdigest()
