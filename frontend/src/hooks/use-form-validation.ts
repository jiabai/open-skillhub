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