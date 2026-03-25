# 移除密码登录功能 实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 移除无用的密码登录功能，保留 LDAP 登录，删除账户改为邮箱验证码验证

**Architecture:** 删除密码登录端点、修改密码端点，重设计删除账户流程使用邮箱验证码验证

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic

---

## Task 1: 删除 UserPasswordUpdate Schema

**Files:**
- Modify: `backend/schemas/user.py:38-40`
- Modify: `backend/schemas/__init__.py:20,46`

**Step 1: 删除 UserPasswordUpdate 类**

在 `backend/schemas/user.py` 中删除：

```python
class UserPasswordUpdate(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
```

**Step 2: 移除 Schema 导出**

在 `backend/schemas/__init__.py` 中删除：
- 第 20 行: `UserPasswordUpdate,`
- 第 46 行: `"UserPasswordUpdate",`

**Step 3: 验证导入正常**

Run: `python -c "from backend.schemas import *; print('OK')"`
Expected: OK

**Step 4: Commit**

```bash
git add backend/schemas/user.py backend/schemas/__init__.py
git commit -m "refactor: remove UserPasswordUpdate schema"
```

---

## Task 2: 删除修改密码端点

**Files:**
- Modify: `backend/api/v1/users.py:5,11,53-62`

**Step 1: 移除导入**

在 `backend/api/v1/users.py` 中删除：
- 第 5 行: `from backend.core.security.password import verify_password`
- 第 11 行: `UserPasswordUpdate` 从导入中移除

**Step 2: 删除修改密码端点**

删除 `PUT /me/password` 端点代码（约 L53-62）：

```python
@router.put("/me/password", response_model=UserResponse)
async def change_password(
    payload: UserPasswordUpdate,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid password")
    service = UserService(UserRepository(session))
    updated = await service.change_password(current_user, payload.new_password)
    return updated
```

**Step 3: 验证语法正确**

Run: `python -m py_compile backend/api/v1/users.py`
Expected: 无输出

**Step 4: Commit**

```bash
git add backend/api/v1/users.py
git commit -m "refactor: remove PUT /me/password endpoint"
```

---

## Task 3: 删除 UserService.change_password 方法

**Files:**
- Modify: `backend/services/user.py:1,15-17`

**Step 1: 移除导入**

在 `backend/services/user.py` 中删除第 1 行：
```python
from backend.core.security.password import get_password_hash, verify_password
```

**Step 2: 删除 change_password 方法**

删除 L15-17：
```python
async def change_password(self, user: User, new_password: str) -> User:
    hashed = get_password_hash(new_password)
    return await self.user_repo.update(user, hashed_password=hashed)
```

**Step 3: 验证语法正确**

Run: `python -m py_compile backend/services/user.py`
Expected: 无输出

**Step 4: Commit**

```bash
git add backend/services/user.py
git commit -m "refactor: remove UserService.change_password method"
```

---

## Task 4: 删除 AuthService.login 方法

**Files:**
- Modify: `backend/services/auth.py:8,77-83`

**Step 1: 移除导入**

在 `backend/services/auth.py` 中删除第 8 行：
```python
from backend.core.security.password import verify_password
```

**Step 2: 删除 login 方法**

删除 L77-83：
```python
async def login(self, email: str, password: str) -> TokenPair:
    user = await self.user_repo.get_by_email(email)
    if not user or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid credentials")
    return self.issue_token(user)
```

**Step 3: 验证语法正确**

Run: `python -m py_compile backend/services/auth.py`
Expected: 无输出

**Step 4: Commit**

```bash
git add backend/services/auth.py
git commit -m "refactor: remove AuthService.login method (password login)"
```

---

## Task 5: 新增删除账户请求 Schema

**Files:**
- Modify: `backend/schemas/user.py`
- Modify: `backend/schemas/__init__.py`

**Step 1: 添加 UserDeleteConfirm Schema**

在 `backend/schemas/user.py` 的 `UserDelete` 类之后添加：

```python
class UserDeleteConfirm(BaseModel):
    code: str = Field(min_length=6, max_length=6)
```

**Step 2: 导出新 Schema**

在 `backend/schemas/__init__.py` 中：
- 添加 `UserDeleteConfirm,` 到导入列表
- 添加 `"UserDeleteConfirm",` 到 `__all__` 列表

**Step 3: 验证导入正常**

Run: `python -c "from backend.schemas import UserDeleteConfirm; print('OK')"`
Expected: OK

**Step 4: Commit**

```bash
git add backend/schemas/user.py backend/schemas/__init__.py
git commit -m "feat: add UserDeleteConfirm schema for email verification"
```

---

## Task 6: 重设计删除账户端点

**Files:**
- Modify: `backend/api/v1/users.py:65-78`
- Modify: `backend/services/user.py:19-27`

**Step 1: 新增删除账户请求端点**

在 `backend/api/v1/users.py` 中，在 `DELETE /me` 之前添加：

```python
@router.post("/me/delete-request", status_code=status.HTTP_204_NO_CONTENT)
async def request_delete_account(
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    verification_service = get_verification_service(session)
    await verification_service.send_code(current_user.email, "delete_account")
    return None
```

**Step 2: 修改删除账户端点**

将 `DELETE /me` 端点改为：

```python
@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_me(
    payload: UserDeleteConfirm,
    current_user=Depends(get_current_active_user),
    session=Depends(get_async_session),
):
    verification_service = get_verification_service(session)
    try:
        await verification_service.verify_code(current_user.email, "delete_account", payload.code)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    service = UserService(UserRepository(session))
    await service.delete_user(current_user)
    return None
```

**Step 3: 添加必要的导入**

在 `backend/api/v1/users.py` 顶部添加：
```python
from backend.api.deps import get_verification_service
from backend.schemas.user import UserDeleteConfirm
```

移除不再需要的导入：
```python
from backend.schemas.user import UserDelete
```

**Step 4: 修改 UserService.delete_user 方法**

在 `backend/services/user.py` 中，将 `delete_user` 方法改为：

```python
async def delete_user(self, user: User) -> bool:
    skill_repo = SkillRepository(self.user_repo.session)
    skills = await skill_repo.list_by_user(user.id)
    for skill in skills:
        delete_skill_dir(user.id, skill.name)
    await self.user_repo.delete(user)
    return True
```

**Step 5: 验证语法正确**

Run: `python -m py_compile backend/api/v1/users.py backend/services/user.py`
Expected: 无输出

**Step 6: Commit**

```bash
git add backend/api/v1/users.py backend/services/user.py
git commit -m "refactor: redesign DELETE /me with email verification"
```

---

## Task 7: 修改 OAuth2PasswordBearer 配置

**Files:**
- Modify: `backend/core/middleware/auth.py:9`

**Step 1: 修改 tokenUrl**

将：
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")
```

改为：
```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/email/login")
```

**Step 2: 验证语法正确**

Run: `python -m py_compile backend/core/middleware/auth.py`
Expected: 无输出

**Step 3: Commit**

```bash
git add backend/core/middleware/auth.py
git commit -m "fix: update OAuth2PasswordBearer tokenUrl to email login endpoint"
```

---

## Task 8: 清理不再使用的 Schema

**Files:**
- Modify: `backend/schemas/user.py`
- Modify: `backend/schemas/__init__.py`

**Step 1: 检查 UserDelete 是否仍被使用**

Run: `grep -r "UserDelete" backend/ --include="*.py"`
Expected: 仅在 schemas/ 中出现

**Step 2: 删除 UserDelete Schema**

在 `backend/schemas/user.py` 中删除：
```python
class UserDelete(BaseModel):
    password: str
```

**Step 3: 移除导出**

在 `backend/schemas/__init__.py` 中移除 `UserDelete` 相关导出

**Step 4: 验证导入正常**

Run: `python -c "from backend.schemas import *; print('OK')"`
Expected: OK

**Step 5: Commit**

```bash
git add backend/schemas/user.py backend/schemas/__init__.py
git commit -m "refactor: remove unused UserDelete schema"
```

---

## Task 9: 运行测试验证

**Step 1: 运行单元测试**

Run: `pytest tests/ -v --tb=short`
Expected: 所有测试通过

**Step 2: 运行类型检查（如有）**

Run: `mypy backend/` 或 `pyright backend/`
Expected: 无错误

**Step 3: 最终 Commit**

```bash
git add -A
git commit -m "refactor: complete password login removal"
```

---

## 执行顺序总结

| Task | 描述 | 依赖 |
|------|------|------|
| 1 | 删除 UserPasswordUpdate Schema | 无 |
| 2 | 删除修改密码端点 | Task 1 |
| 3 | 删除 UserService.change_password | Task 2 |
| 4 | 删除 AuthService.login | 无 |
| 5 | 新增 UserDeleteConfirm Schema | 无 |
| 6 | 重设计删除账户端点 | Task 5 |
| 7 | 修改 OAuth2PasswordBearer | 无 |
| 8 | 清理 UserDelete Schema | Task 6 |
| 9 | 运行测试验证 | Task 1-8 |
