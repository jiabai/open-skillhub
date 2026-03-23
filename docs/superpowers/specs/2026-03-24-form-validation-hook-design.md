# 表单验证 Hook 设计

## 背景

文档 `docs/frontend-design/03-business-exception.md:268-387` 描述了 `use-form-validation.ts` 模块，但代码从未实现。各页面分散实现验证逻辑，存在冗余和不一致。

## 目标

- 创建统一的表单验证 Hook
- 移除各页面的分散验证逻辑
- 保证验证规则和错误提示一致

## 设计

### 模块位置

```
frontend/src/lib/use-form-validation.ts
```

### API

```ts
// 验证规则定义
interface ValidationRule<T> {
  validate: (value: T) => boolean
  message: string
}

// 字段状态
interface FieldState<T> {
  value: T
  setValue: (value: T) => void
  error: string | null
  isValid: boolean
  handleBlur: () => void
}

// Hook
export function useField<T>(
  initialValue: T,
  rules: ValidationRule<T>[]
): FieldState<T>

// 预定义规则
export const validationRules = {
  email: { pattern, message },
  verificationCode: { pattern, message },
  username: { minLength, maxLength, pattern, message },
  skillName: { minLength, maxLength, message },
  skillDescription: { maxLength, message },
  tokenName: { minLength, maxLength, message },
}

// 辅助函数
export function validateEmail(email: string): boolean
export function validateVerificationCode(code: string): boolean
export function validateUsername(username: string): string | null
export function validateSkillName(name: string): string | null
export function validateTokenName(name: string): string | null
```

### 验证规则

| 字段 | 规则 | 错误提示 |
|------|------|---------|
| email | `^[^\s@]+@[^\s@]+\.[^\s@]+$` | 请输入有效的邮箱地址 |
| verificationCode | `^\d{6}$` | 验证码为 6 位数字 |
| username | 3-50 字符，仅 `[a-zA-Z0-9_]` | 用户名至少 3 个字符 / 最多 50 个字符 / 只能包含字母、数字和下划线 |
| skillName | 1-100 字符 | 名称不能为空 / 名称最长 100 字符 |
| skillDescription | 可选，最长 500 字符 | 描述最长 500 字符 |
| tokenName | 1-100 字符 | Token 名称不能为空 / Token 名称最长 100 字符 |

### 验证时机

Blur 验证 —— 用户离开输入框时触发验证，即时显示错误。

### 页面改动

#### login/page.tsx

- email 字段：使用 `useField`，移除 `type="email"` `required`
- code 字段：使用 `useField`，移除 `pattern="[0-9]{6}"` `maxLength` `required`
- 提交时检查 `isValid`

#### register/page.tsx

- username 字段：使用 `useField`，移除 `required`
- email 字段：同 login
- code 字段：同 login
- 提交时检查所有 `isValid`

#### skills/new/page.tsx

- name 字段：使用 `useField`，移除 `required`
- description 字段：使用 `useField`，添加 500 字符限制
- 提交时检查 `isValid`

#### tokens/page.tsx

- name 字段：使用 `useField`，移除 `required`
- 提交时检查 `isValid`

### 错误显示

每个输入框下方显示错误：

```tsx
{error ? <p className="text-sm text-destructive">{error}</p> : null}
```

### 表单提交验证

提交时检查所有字段 `isValid`，若无效则阻止提交：

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault()
  if (!emailField.isValid || !codeField.isValid) {
    return
  }
  // 提交逻辑
}
```

## 不做的事

- 不引入第三方表单库（react-hook-form, zod 等）
- 不实现 `useForm` 管理整个表单状态（当前页面简单，手动检查足够）
- 不改变后端验证逻辑