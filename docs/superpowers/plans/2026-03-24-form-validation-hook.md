# 表单验证 Hook 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建统一的表单验证 Hook，移除分散在各页面的验证逻辑。

**Architecture:** 单个 `useField` Hook 管理字段状态，配合预定义验证规则。通过 blur 触发验证，提交时手动调用 validate()。

**Tech Stack:** React Hooks, TypeScript, Vitest

---

## File Structure

```
frontend/src/hooks/use-form-validation.ts      # 新建 - Hook + 规则
frontend/src/__tests__/use-form-validation.test.ts  # 新建 - Hook 测试
frontend/src/app/login/page.tsx                # 修改 - 使用 Hook
frontend/src/app/register/page.tsx             # 修改 - 使用 Hook
frontend/src/app/skills/new/page.tsx           # 修改 - 使用 Hook
frontend/src/app/tokens/page.tsx               # 修改 - 使用 Hook
```

---

### Task 1: 创建 useField Hook

**Files:**
- Create: `frontend/src/hooks/use-form-validation.ts`
- Create: `frontend/src/__tests__/use-form-validation.test.ts`

- [ ] **Step 1: Write failing tests for useField**

```ts
// frontend/src/__tests__/use-form-validation.test.ts
import { describe, expect, it } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useField } from "@/hooks/use-form-validation"

describe("useField", () => {
  const emailRules = [
    { validate: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), message: "请输入有效的邮箱地址" },
  ]

  it("returns initial value with no error", () => {
    const { result } = renderHook(() => useField("test@example.com", emailRules))
    expect(result.current.value).toBe("test@example.com")
    expect(result.current.error).toBeNull()
    expect(result.current.isValid).toBe(true)
  })

  it("shows error after blur when validation fails", () => {
    const { result } = renderHook(() => useField("invalid", emailRules))
    expect(result.current.error).toBeNull()

    act(() => {
      result.current.handleBlur()
    })

    expect(result.current.error).toBe("请输入有效的邮箱地址")
    expect(result.current.isValid).toBe(false)
  })

  it("clears error when value becomes valid", () => {
    const { result } = renderHook(() => useField("invalid", emailRules))

    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.error).toBe("请输入有效的邮箱地址")

    act(() => {
      result.current.setValue("valid@example.com")
    })
    expect(result.current.error).toBeNull()
    expect(result.current.isValid).toBe(true)
  })

  it("validate() triggers validation without blur", () => {
    const { result } = renderHook(() => useField("invalid", emailRules))
    expect(result.current.error).toBeNull()

    act(() => {
      result.current.validate()
    })

    expect(result.current.error).toBe("请输入有效的邮箱地址")
  })

  it("reset() clears value, error, and touched state", () => {
    const { result } = renderHook(() => useField("invalid", emailRules))

    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.error).toBe("请输入有效的邮箱地址")

    act(() => {
      result.current.reset()
    })

    expect(result.current.value).toBe("invalid") // 重置到初始值
    expect(result.current.error).toBeNull()
    // 再次 blur 后才显示错误（touched 已重置）
    act(() => {
      result.current.setValue("still-invalid")
    })
    expect(result.current.error).toBeNull()
  })

  it("validates multiple rules in order", () => {
    const multiRules = [
      { validate: (v: string) => v.length >= 3, message: "至少3字符" },
      { validate: (v: string) => v.length <= 10, message: "最多10字符" },
    ]
    const { result } = renderHook(() => useField("ab", multiRules))

    act(() => {
      result.current.handleBlur()
    })
    expect(result.current.error).toBe("至少3字符")

    act(() => {
      result.current.setValue("abcdefghijk")
    })
    expect(result.current.error).toBe("最多10字符")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd frontend && npm test -- src/__tests__/use-form-validation.test.ts`
Expected: FAIL - Cannot find module '@/hooks/use-form-validation'

- [ ] **Step 3: Implement useField Hook**

```ts
// frontend/src/hooks/use-form-validation.ts
import { useState, useMemo, useCallback } from "react"

export interface ValidationRule<T> {
  validate: (value: T) => boolean
  message: string
}

export interface FieldState<T> {
  value: T
  setValue: (value: T) => void
  error: string | null
  isValid: boolean
  handleBlur: () => void
  validate: () => void
  reset: () => void
}

export function useField<T>(
  initialValue: T,
  rules: ValidationRule<T>[]
): FieldState<T> {
  const [value, setValue] = useState<T>(initialValue)
  const [touched, setTouched] = useState(false)

  const error = useMemo(() => {
    if (!touched) return null
    for (const rule of rules) {
      if (!rule.validate(value)) {
        return rule.message
      }
    }
    return null
  }, [value, touched, rules])

  const isValid = error === null

  const handleBlur = useCallback(() => {
    setTouched(true)
  }, [])

  const validate = useCallback(() => {
    setTouched(true)
  }, [])

  const reset = useCallback(() => {
    setValue(initialValue)
    setTouched(false)
  }, [initialValue])

  return {
    value,
    setValue,
    error,
    isValid,
    handleBlur,
    validate,
    reset,
  }
}

// 预定义验证规则配置
export const validationRules = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "请输入有效的邮箱地址",
  },
  verificationCode: {
    pattern: /^\d{6}$/,
    message: "验证码为 6 位数字",
  },
  username: {
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_]+$/,
    messages: {
      minLength: "用户名至少 3 个字符",
      maxLength: "用户名最多 50 个字符",
      pattern: "用户名只能包含字母、数字和下划线",
    },
  },
  skillName: {
    minLength: 1,
    maxLength: 100,
    messages: {
      minLength: "名称不能为空",
      maxLength: "名称最长 100 字符",
    },
  },
  skillDescription: {
    maxLength: 500,
    message: "描述最长 500 字符",
  },
  tokenName: {
    minLength: 1,
    maxLength: 100,
    messages: {
      minLength: "Token 名称不能为空",
      maxLength: "Token 名称最长 100 字符",
    },
  },
}

// 辅助函数 - 用于创建验证规则数组
export function createEmailRules(): ValidationRule<string>[] {
  return [
    { validate: (v) => validationRules.email.pattern.test(v), message: validationRules.email.message },
  ]
}

export function createVerificationCodeRules(): ValidationRule<string>[] {
  return [
    { validate: (v) => validationRules.verificationCode.pattern.test(v), message: validationRules.verificationCode.message },
  ]
}

export function createUsernameRules(): ValidationRule<string>[] {
  const { minLength, maxLength, pattern, messages } = validationRules.username
  return [
    { validate: (v) => v.length >= minLength, message: messages.minLength },
    { validate: (v) => v.length <= maxLength, message: messages.maxLength },
    { validate: (v) => pattern.test(v), message: messages.pattern },
  ]
}

export function createSkillNameRules(): ValidationRule<string>[] {
  const { minLength, maxLength, messages } = validationRules.skillName
  return [
    { validate: (v) => v.length >= minLength, message: messages.minLength },
    { validate: (v) => v.length <= maxLength, message: messages.maxLength },
  ]
}

export function createSkillDescriptionRules(): ValidationRule<string>[] {
  return [
    { validate: (v) => !v || v.length <= validationRules.skillDescription.maxLength, message: validationRules.skillDescription.message },
  ]
}

export function createTokenNameRules(): ValidationRule<string>[] {
  const { minLength, maxLength, messages } = validationRules.tokenName
  return [
    { validate: (v) => v.length >= minLength, message: messages.minLength },
    { validate: (v) => v.length <= maxLength, message: messages.maxLength },
  ]
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd frontend && npm test -- src/__tests__/use-form-validation.test.ts`
Expected: PASS - all tests pass

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/use-form-validation.ts frontend/src/__tests__/use-form-validation.test.ts
git commit -m "feat(hooks): add useField validation hook with predefined rules"
```

---

### Task 2: 更新 login/page.tsx

**Files:**
- Modify: `frontend/src/app/login/page.tsx`

- [ ] **Step 1: Add imports and useField hooks**

Add import after line 8 (after api import):

```tsx
import { useField, createEmailRules, createVerificationCodeRules } from "@/hooks/use-form-validation"
```

Replace lines 18-19 (email and code useState) with useField:

```tsx
const emailField = useField("", createEmailRules())
const codeField = useField("", createVerificationCodeRules())
```

> Note: Keep `useState` import - still needed for `codeMessage`, `resendSeconds`, `isSending`, `isLoading`, `error`, `success`.

- [ ] **Step 2: Update handleSendCode to use emailField**

Replace `email` with `emailField.value` in handleSendCode (around line 34):

```tsx
// Line 34: replace !email with !emailField.value
if (!emailField.value || isSending || resendSeconds > 0) {
  return
}
// Line 41: replace email with emailField.value
const response = await api.sendVerificationCode({ email: emailField.value, purpose: "login" })
```

- [ ] **Step 3: Update handleSubmit to use fields and validate**

Replace lines 62-77 with:

```tsx
const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  emailField.validate()
  codeField.validate()
  if (!emailField.isValid || !codeField.isValid) return

  setIsLoading(true)
  setError(null)
  setSuccess(null)
  try {
    const tokenPair = await api.login({ email: emailField.value, code: codeField.value })
    storeTokens(tokenPair)
    router.replace("/dashboard")
    setSuccess("登录成功，已保存凭证。")
  } catch (err) {
    setError(getErrorMessage(err))
  } finally {
    setIsLoading(false)
  }
}
```

- [ ] **Step 4: Update Input components**

Replace the email Input (around lines 127-134):

```tsx
<Input
  id="email"
  type="text"
  placeholder="you@company.com"
  value={emailField.value}
  onChange={(event) => emailField.setValue(event.target.value)}
  onBlur={emailField.handleBlur}
/>
```

Add error display after the email Input div (before the code div):

```tsx
{emailField.error && <p className="text-sm text-destructive">{emailField.error}</p>}
```

Replace the code Input (around lines 139-148):

```tsx
<Input
  id="code"
  inputMode="numeric"
  placeholder="6 位验证码"
  value={codeField.value}
  onChange={(event) => codeField.setValue(event.target.value)}
  onBlur={codeField.handleBlur}
  maxLength={6}
/>
```

Add error display after the code Input div:

```tsx
{codeField.error && <p className="text-sm text-destructive">{codeField.error}</p>}
```

- [ ] **Step 5: Update button disabled condition**

Replace line 154:

```tsx
disabled={!email || isSending || resendSeconds > 0}
// with
disabled={!emailField.value || isSending || resendSeconds > 0}
```

- [ ] **Step 6: Verify and commit**

Run: `cd frontend && npm test`
Expected: PASS

```bash
git add frontend/src/app/login/page.tsx
git commit -m "refactor(login): use useField hook for form validation"
```

---

### Task 3: 更新 register/page.tsx

**Files:**
- Modify: `frontend/src/app/register/page.tsx`

- [ ] **Step 1: Add imports and useField hooks**

Add import after line 8 (after api import):

```tsx
import { useField, createEmailRules, createVerificationCodeRules, createUsernameRules } from "@/hooks/use-form-validation"
```

Replace lines 25-27 (username, email, code useState) with useField:

```tsx
const usernameField = useField("", createUsernameRules())
const emailField = useField("", createEmailRules())
const codeField = useField("", createVerificationCodeRules())
```

> Note: Keep `useState` import - still needed for `codeMessage`, `resendSeconds`, `isSending`, `isLoading`, `error`, `success`, `redirectTimer`.

- [ ] **Step 2: Update handleSendCode**

Replace `email` with `emailField.value`:

```tsx
// Line 43: replace !email with !emailField.value
if (!emailField.value || isSending || resendSeconds > 0) {
  return
}
// Line 50: replace email with emailField.value
const response = await api.sendVerificationCode({ email: emailField.value, purpose: "register" })
```

- [ ] **Step 3: Update handleSubmit**

Replace lines 61-77 with:

```tsx
const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  usernameField.validate()
  emailField.validate()
  codeField.validate()
  if (!usernameField.isValid || !emailField.isValid || !codeField.isValid) return

  setIsLoading(true)
  setError(null)
  setSuccess(null)
  try {
    await api.register({ username: usernameField.value, email: emailField.value, code: codeField.value })
    setSuccess("注册成功，请登录。")
    usernameField.reset()
    emailField.reset()
    codeField.reset()
  } catch (err) {
    setError(getErrorMessage(err))
  } finally {
    setIsLoading(false)
  }
}
```

- [ ] **Step 4: Update Input components**

Replace username Input (around lines 122-129):

```tsx
<Input
  id="username"
  placeholder="你的显示名称"
  value={usernameField.value}
  onChange={(event) => usernameField.setValue(event.target.value)}
  onBlur={usernameField.handleBlur}
  disabled={isLoading}
/>
```

Add error after username div:

```tsx
{usernameField.error && <p className="text-sm text-destructive">{usernameField.error}</p>}
```

Replace email Input (around lines 133-141):

```tsx
<Input
  id="email"
  type="text"
  placeholder="you@company.com"
  value={emailField.value}
  onChange={(event) => emailField.setValue(event.target.value)}
  onBlur={emailField.handleBlur}
  disabled={isLoading || isSending}
/>
```

Add error after email div:

```tsx
{emailField.error && <p className="text-sm text-destructive">{emailField.error}</p>}
```

Replace code Input (around lines 146-156):

```tsx
<Input
  id="code"
  inputMode="numeric"
  placeholder="6 位验证码"
  value={codeField.value}
  onChange={(event) => codeField.setValue(event.target.value)}
  onBlur={codeField.handleBlur}
  disabled={isLoading}
  maxLength={6}
/>
```

Add error after code div:

```tsx
{codeField.error && <p className="text-sm text-destructive">{codeField.error}</p>}
```

- [ ] **Step 5: Update button disabled condition**

Replace line 162:

```tsx
disabled={!email || isSending || resendSeconds > 0}
// with
disabled={!emailField.value || isSending || resendSeconds > 0}
```

- [ ] **Step 6: Verify and commit**

Run: `cd frontend && npm test`
Expected: PASS

```bash
git add frontend/src/app/register/page.tsx
git commit -m "refactor(register): use useField hook for form validation"
```

---

### Task 4: 更新 skills/new/page.tsx

**Files:**
- Modify: `frontend/src/app/skills/new/page.tsx`

- [ ] **Step 1: Add imports and useField hooks**

Add import after line 7 (after api import):

```tsx
import { useField, createSkillNameRules, createSkillDescriptionRules } from "@/hooks/use-form-validation"
```

Replace lines 20-21 (name and description useState) with useField:

```tsx
const nameField = useField("", createSkillNameRules())
const descriptionField = useField("", createSkillDescriptionRules())
```

> Note: Keep `useState` import - still needed for `visible`, `skillUuid`, `uploading`, `files`, `message`.

- [ ] **Step 2: Update handleCreate**

Replace lines 28-38 with:

```tsx
const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  nameField.validate()
  if (!nameField.isValid) return

  setMessage(null)
  const skill = await api.createSkill({
    name: nameField.value,
    description: descriptionField.value,
    visible: featureFlags.enableSkillVisibility ? visible : "private"
  })
  setSkillUuid(skill.id)
  setMessage("Skill 已创建，可以开始上传文件。")
}
```

- [ ] **Step 3: Update Input and Textarea components**

Replace name Input (around lines 94-100):

```tsx
<Input
  id="name"
  placeholder="例如：pdf"
  value={nameField.value}
  onChange={(event) => nameField.setValue(event.target.value)}
  onBlur={nameField.handleBlur}
/>
```

Add error after name div:

```tsx
{nameField.error && <p className="text-sm text-destructive">{nameField.error}</p>}
```

Replace description Textarea (around lines 104-109):

```tsx
<Textarea
  id="description"
  placeholder="简要说明 Skill 的用途"
  value={descriptionField.value}
  onChange={(event) => descriptionField.setValue(event.target.value)}
  onBlur={descriptionField.handleBlur}
/>
```

Add error after description div:

```tsx
{descriptionField.error && <p className="text-sm text-destructive">{descriptionField.error}</p>}
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && npm test`
Expected: PASS

```bash
git add frontend/src/app/skills/new/page.tsx
git commit -m "refactor(skills): use useField hook for skill form validation"
```

---

### Task 5: 更新 tokens/page.tsx

**Files:**
- Modify: `frontend/src/app/tokens/page.tsx`

- [ ] **Step 1: Add imports and useField hook**

Add import after line 6 (after api import):

```tsx
import { useField, createTokenNameRules } from "@/hooks/use-form-validation"
```

Replace line 22 (name useState) with useField:

```tsx
const nameField = useField("", createTokenNameRules())
```

> Note: Keep `useState` import - still needed for `tokens`, `status`, `error`, `days`, `newToken`, `creating`.

- [ ] **Step 2: Update handleCreate**

Replace lines 44-62 with:

```tsx
const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault()
  nameField.validate()
  if (!nameField.isValid) return

  setCreating(true)
  try {
    const expiresAt = days ? new Date(Date.now() + Number(days) * 24 * 60 * 60 * 1000).toISOString() : null
    const token = await api.createToken({ name: nameField.value, expires_at: expiresAt || undefined })
    setNewToken(token.token || null)
    nameField.reset()
    setDays("30")
    await loadTokens()
    success("Token 创建成功", { description: "请保存好您的 Token，它只会显示一次" })
  } catch (err) {
    const message = err instanceof Error ? err.message : "创建失败"
    setError(message)
    showError("创建失败", { description: message })
  } finally {
    setCreating(false)
  }
}
```

- [ ] **Step 3: Update Input component**

Replace name Input (around lines 101-107):

```tsx
<Input
  id="name"
  placeholder="例如：prod-client"
  value={nameField.value}
  onChange={(event) => nameField.setValue(event.target.value)}
  onBlur={nameField.handleBlur}
/>
```

Add error after name div:

```tsx
{nameField.error && <p className="text-sm text-destructive">{nameField.error}</p>}
```

- [ ] **Step 4: Verify and commit**

Run: `cd frontend && npm test`
Expected: PASS

```bash
git add frontend/src/app/tokens/page.tsx
git commit -m "refactor(tokens): use useField hook for token name validation"
```

---

### Task 6: 最终验证

- [ ] **Step 1: Run all tests**

Run: `cd frontend && npm test`
Expected: PASS - all tests pass

- [ ] **Step 2: Update documentation**

Remove or update the outdated section in `docs/frontend-design/03-business-exception.md` to note that `use-form-validation.ts` now exists.

- [ ] **Step 3: Final commit**

```bash
git add docs/frontend-design/03-business-exception.md
git commit -m "docs: update business-exception doc to reflect implemented validation hook"
```