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
frontend/src/hooks/use-form-validation.ts
```

> 与现有 `use-toast.ts` 保持一致。

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
  handleBlur: () => void  // 触发验证
  validate: () => void    // 手动触发验证（提交时调用）
  reset: () => void       // 重置字段状态
}

// Hook
export function useField<T>(
  initialValue: T,
  rules: ValidationRule<T>[]
): FieldState<T>

// 内部状态：touched 不暴露，仅在内部用于控制首次 blur 前不显示错误

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

### 多规则字段处理

`username` 需要多个验证规则，按顺序检查：

```ts
const usernameRules: ValidationRule<string>[] = [
  { validate: (v) => v.length >= 3, message: "用户名至少 3 个字符" },
  { validate: (v) => v.length <= 50, message: "用户名最多 50 个字符" },
  { validate: (v) => /^[a-zA-Z0-9_]+$/.test(v), message: "用户名只能包含字母、数字和下划线" },
]
```

### 可选字段处理

`skillDescription` 可选但有限制，空值跳过验证：

```ts
const descriptionRules: ValidationRule<string>[] = [
  { validate: (v) => !v || v.length <= 500, message: "描述最长 500 字符" },
]
```

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

### 完整使用示例

```tsx
import { useField, validationRules } from "@/hooks/use-form-validation"

function LoginPage() {
  const emailField = useField("", [
    { validate: (v) => validationRules.email.pattern.test(v), message: validationRules.email.message },
  ])
  const codeField = useField("", [
    { validate: (v) => validationRules.verificationCode.pattern.test(v), message: validationRules.verificationCode.message },
  ])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    emailField.validate()
    codeField.validate()
    if (!emailField.isValid || !codeField.isValid) return
    // 提交逻辑
  }

  return (
    <form onSubmit={handleSubmit}>
      <Input
        value={emailField.value}
        onChange={(e) => emailField.setValue(e.target.value)}
        onBlur={emailField.handleBlur}
      />
      {emailField.error && <p className="text-sm text-destructive">{emailField.error}</p>}

      <Input
        value={codeField.value}
        onChange={(e) => codeField.setValue(e.target.value)}
        onBlur={codeField.handleBlur}
      />
      {codeField.error && <p className="text-sm text-destructive">{codeField.error}</p>}

      <Button type="submit">登录</Button>
    </form>
  )
}
```

### 表单提交验证

提交时先触发所有字段验证，再检查是否有效：

```tsx
const handleSubmit = async (event: React.FormEvent) => {
  event.preventDefault()
  // 触发所有字段验证
  emailField.validate()
  codeField.validate()
  // 检查有效性
  if (!emailField.isValid || !codeField.isValid) {
    return
  }
  // 提交逻辑
}
```

> 注意：`validate()` 和 `handleBlur()` 效果相同，都会触发验证。`validate()` 语义更清晰，`handleBlur()` 用于绑定到 `onBlur` 事件。

## 不做的事

- 不引入第三方表单库（react-hook-form, zod 等）
- 不实现 `useForm` 管理整个表单状态（当前页面简单，手动检查足够）
- 不改变后端验证逻辑

## HTML5 验证属性策略

**完全移除** HTML5 验证属性（`required`, `type="email"`, `pattern` 等）。

理由：
- 项目是客户端 SPA，JS 未加载则整个应用不可用
- 两套验证并存会造成冗余和混淆
- 统一的 JS 验证便于维护和扩展
- 移除后由 `useField` 完全接管验证逻辑