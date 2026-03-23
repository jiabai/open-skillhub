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