import { create } from 'zustand'

export type ToastTone = 'achievement' | 'info' | 'success' | 'error'

export interface Toast {
  id: number
  title: string
  body?: string
  tone: ToastTone
}

interface ToastState {
  toasts: Toast[]
  push: (toast: Omit<Toast, 'id'>) => number
  dismiss: (id: number) => void
}

let nextId = 1
const TOAST_MS = 3800
const MAX_VISIBLE = 3

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++
    set({ toasts: [...get().toasts, { ...toast, id }].slice(-MAX_VISIBLE) })
    globalThis.setTimeout(() => get().dismiss(id), TOAST_MS)
    return id
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

export function toast(input: Omit<Toast, 'id'>): number {
  return useToasts.getState().push(input)
}
