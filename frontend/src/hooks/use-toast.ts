import { toast } from "sonner"

interface ToastOptions {
  description?: string
  duration?: number
}

export function useToast() {
  const success = (title: string, options?: ToastOptions) => {
    toast.success(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    })
  }

  const error = (title: string, options?: ToastOptions) => {
    toast.error(title, {
      description: options?.description,
      duration: options?.duration ?? 5000,
    })
  }

  const warning = (title: string, options?: ToastOptions) => {
    toast.warning(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    })
  }

  const info = (title: string, options?: ToastOptions) => {
    toast.info(title, {
      description: options?.description,
      duration: options?.duration ?? 4000,
    })
  }

  return {
    success,
    error,
    warning,
    info,
    // 导出原始 toast 函数以备自定义需求
    toast,
  }
}
