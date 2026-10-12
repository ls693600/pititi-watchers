import { useCallback, useRef, useState } from 'react'

export interface ToastState {
  id: number
  msg: string
  undo?: () => void
  label?: string
}

export type Flash = (msg: string, undo?: () => void, label?: string) => void

/** The short message at the bottom. With an action (Undo, Open) it gets a button and stays a little longer. */
export function useToast(): { toast: ToastState | null; flash: Flash; dismiss: () => void } {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const flash = useCallback<Flash>((msg, undo, label = 'Undo') => {
    clearTimeout(timer.current)
    setToast({ id: Date.now(), msg, undo, label })
    timer.current = setTimeout(() => setToast(null), undo || msg.length > 60 ? 6000 : 3500)
  }, [])
  const dismiss = useCallback(() => {
    clearTimeout(timer.current)
    setToast(null)
  }, [])
  return { toast, flash, dismiss }
}
