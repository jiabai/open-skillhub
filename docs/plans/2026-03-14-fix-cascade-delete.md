# 数据模型级联删除修复实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修复数据模型中级联删除的问题，确保删除 Skill 时 SkillVersion 记录被正确清理，并添加数据库层的外键级联约束。

**Architecture:** 在 ORM 层添加 Skill→SkillVersion 的级联关系，同时创建数据库迁移脚本为外键添加 `ondelete="CASCADE"` 约束，确保数据一致性。

**Tech Stack:** SQLAlchemy 2.0, Alembic, Pytest

---

## Task 1: 添加 Skill→SkillVersion ORM 级联关系

**Files:**
- Modify: `skillhub/models/skill.py`
- Modify: `skillhub/models/skill_version.py`
- Test: `tests/test_skill_service.py`

**Step 1: 修改 Skill 模型添加 versions 关系**

在 `skillhub/models/skill.py` 中添加与 SkillVersion 的关系：

```python
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uix_user_skill_name"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    enterprise_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    skill_dir: Mapped[str] = mapped_column(String(500))
    current_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="skills")
    versions = relationship(
        "SkillVersion",
        back_populates="skill",
        cascade="all, delete-orphan",
        order_by="SkillVersion.created_at.desc()",
    )
```

**Step 2: 修改 SkillVersion 模型添加 back_populates**

在 `skillhub/models/skill_version.py` 中添加 `back_populates`：

```python
from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SkillVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skill_versions"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uix_skill_versions"),)

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), index=True)
    version: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(String(500), default="")
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    dependency_spec: Mapped[dict] = mapped_column(JSON, default=dict)
    dependency_spec_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    skill = relationship("Skill", back_populates="versions")
```

**Step 3: 编写测试验证级联删除**

在 `tests/test_skill_service.py` 中添加测试：

```python
import pytest
from skillhub.repositories.user import UserRepository
from skillhub.repositories.skill import SkillRepository
from skillhub.repositories.skill_version import SkillVersionRepository
from skillhub.services.skill import SkillService
from skillhub.models.skill_version import SkillVersion


@pytest.mark.asyncio
async def test_delete_skill_cascades_to_versions(async_session, tmp_path, monkeypatch):
    monkeypatch.setenv("SKILL_STORAGE_PATH", str(tmp_path))
    user_repo = UserRepository(async_session)
    skill_repo = SkillRepository(async_session)
    version_repo = SkillVersionRepository(async_session)
    skill_service = SkillService(skill_repo)

    user = await user_repo.create(email="cascade@example.com", username="usercascade", password="pass1234")
    skill = await skill_service.create_skill(user, name="skill_with_version", description="desc")

    version = await version_repo.create_version(
        skill_id=skill.id,
        version="1.0.0",
        description="first version",
        dependencies=[],
        dependency_spec={},
        dependency_spec_version=None,
        metadata={},
    )

    all_versions_before = await version_repo.list_by_skill(skill.id)
    assert len(all_versions_before) == 1

    await skill_service.delete_skill(user, skill.id)

    all_versions_after = await version_repo.list_by_skill(skill.id)
    assert len(all_versions_after) == 0
```

**Step 4: 运行测试验证**

Run: `pytest tests/test_skill_service.py::test_delete_skill_cascades_to_versions -v`
Expected: PASS

**Step 5: Commit**

```bash
git add skillhub/models/skill.py skillhub/models/skill_version.py tests/test_skill_service.py
git commit -m "fix: add cascade delete relationship from Skill to SkillVersion"
```

---

## Task 2: 添加数据库层外键级联删除迁移

**Files:**
- Create: `skillhub/db/migrations/versions/j5k6l7m8n9o0_add_cascade_delete.py`

**Step 1: 创建迁移脚本**

创建新迁移文件 `skillhub/db/migrations/versions/j5k6l7m8n9o0_add_cascade_delete.py`：

```python
from typing import Any, cast

from alembic import op as _op

op = cast(Any, _op)

revision = "j5k6l7m8n9o0"
down_revision = "i7j8k9l0m1n2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("fk_skills_user_id", "skills", type_="foreignkey")
    op.create_foreign_key(
        "fk_skills_user_id",
        "skills",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("fk_api_tokens_user_id", "api_tokens", type_="foreignkey")
    op.create_foreign_key(
        "fk_api_tokens_user_id",
        "api_tokens",
        "users",
        ["user_id"],
        ["id"],
        ondelete="CASCADE",
    )

    op.drop_constraint("fk_skill_versions_skill_id", "skill_versions", type_="foreignkey")
    op.create_foreign_key(
        "fk_skill_versions_skill_id",
        "skill_versions",
        "skills",
        ["skill_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    op.drop_constraint("fk_skill_versions_skill_id", "skill_versions", type_="foreignkey")
    op.create_foreign_key(
        "fk_skill_versions_skill_id",
        "skill_versions",
        "skills",
        ["skill_id"],
        ["id"],
    )

    op.drop_constraint("fk_api_tokens_user_id", "api_tokens", type_="foreignkey")
    op.create_foreign_key(
        "fk_api_tokens_user_id",
        "api_tokens",
        "users",
        ["user_id"],
        ["id"],
    )

    op.drop_constraint("fk_skills_user_id", "skills", type_="foreignkey")
    op.create_foreign_key(
        "fk_skills_user_id",
        "skills",
        "users",
        ["user_id"],
        ["id"],
    )
```

**Step 2: 验证迁移脚本语法**

Run: `python -c "from skillhub.db.migrations.versions.j5k6l7m8n9o0_add_cascade_delete import upgrade, downgrade; print('OK')"`
Expected: OK

**Step 3: Commit**

```bash
git add skillhub/db/migrations/versions/j5k6l7m8n9o0_add_cascade_delete.py
git commit -m "feat(db): add CASCADE delete to foreign key constraints"
```

---

## Task 3: 更新规范文档

**Files:**
- Modify: `docs/project-spec.md`

**Step 1: 更新 User 模型章节**

将 User 模型部分更新为使用 Mixin 模式：

```python
from sqlalchemy import String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    enterprise_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    role: Mapped[str] = mapped_column(String(50), default="member")
    status: Mapped[str] = mapped_column(String(32), default="active")

    skills = relationship("Skill", back_populates="user", cascade="all, delete-orphan")
    tokens = relationship("APIToken", back_populates="user", cascade="all, delete-orphan")
```

**Step 2: 更新 Skill 模型章节**

添加 versions 关系：

```python
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Skill(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skills"
    __table_args__ = (UniqueConstraint("user_id", "name", name="uix_user_skill_name"),)

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(String(500), default="")
    tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    visibility: Mapped[str] = mapped_column(String(20), default="private")
    enterprise_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    team_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    skill_dir: Mapped[str] = mapped_column(String(500))
    current_version: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    cache_revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="skills")
    versions = relationship(
        "SkillVersion",
        back_populates="skill",
        cascade="all, delete-orphan",
        order_by="SkillVersion.created_at.desc()",
    )
```

**Step 3: 更新 SkillVersion 模型章节**

添加 back_populates：

```python
from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class SkillVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "skill_versions"
    __table_args__ = (UniqueConstraint("skill_id", "version", name="uix_skill_versions"),)

    skill_id: Mapped[str] = mapped_column(String(36), ForeignKey("skills.id"), index=True)
    version: Mapped[str] = mapped_column(String(50))
    description: Mapped[str] = mapped_column(String(500), default="")
    dependencies: Mapped[list[str]] = mapped_column(JSON, default=list)
    dependency_spec: Mapped[dict] = mapped_column(JSON, default=dict)
    dependency_spec_version: Mapped[str | None] = mapped_column(String(20), nullable=True)
    metadata_json: Mapped[dict] = mapped_column("metadata", JSON, default=dict)

    skill = relationship("Skill", back_populates="versions")
```

**Step 4: 更新 APIToken 模型章节**

使用 Mixin 模式：

```python
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from skillhub.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class APIToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "api_tokens"

    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    token_hash: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="tokens")
```

**Step 5: 更新一致性说明**

更新章节开头的一致性说明，移除"未开启数据库级联删除"的描述：

```markdown
## 3. 数据模型

> **一致性说明**: 本章代码片段展示推荐实现，包括 ORM 层的 `cascade="all, delete-orphan"` 和数据库层的 `ondelete="CASCADE"` 约束。实际实现通过 Mixin 模式（`UUIDPrimaryKeyMixin`, `TimestampMixin`）减少重复代码。
```

**Step 6: Commit**

```bash
git add docs/project-spec.md
git commit -m "docs: update data model spec to reflect actual Mixin pattern and cascade relations"
```

---

## Task 4: 运行完整测试验证

**Step 1: 运行所有相关测试**

Run: `pytest tests/test_skill_service.py tests/test_user_service.py -v`
Expected: All PASS

**Step 2: 运行模型导入测试**

Run: `python -c "from skillhub.models import User, Skill, SkillVersion, APIToken; print('Models imported successfully')"`
Expected: Models imported successfully

**Step 3: 最终提交（如有遗漏）**

```bash
git status
git add -A
git commit -m "fix: complete cascade delete implementation for data models"
```
