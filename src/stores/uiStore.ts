import { create } from 'zustand'

type ModalName = 'dayDetail' | 'race' | 'stats' | 'import' | null

export type ToastAction = {
  label: string
  onPress: () => void
}

type UiStore = {
  isLoading: boolean
  loadingMessage: string | null
  toast: string | null
  toastAction: ToastAction | null
  activeModal: ModalName
  modalData: unknown
  loginSheetOpen: boolean

  setLoading: (loading: boolean, message?: string | null) => void
  showToast: (message: string, durationMs?: number, action?: ToastAction) => void
  hideToast: () => void
  openModal: (modal: NonNullable<ModalName>, data?: unknown) => void
  closeModal: () => void
  openLoginSheet: () => void
  closeLoginSheet: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUiStore = create<UiStore>((set) => ({
  isLoading: false,
  loadingMessage: null,
  toast: null,
  toastAction: null,
  activeModal: null,
  modalData: null,
  loginSheetOpen: false,

  setLoading: (isLoading, loadingMessage = null) =>
    set({ isLoading, loadingMessage }),

  showToast: (message, durationMs = 3000, action) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: message, toastAction: action ?? null })
    toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), durationMs)
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: null, toastAction: null })
  },

  openModal: (activeModal, modalData = null) =>
    set({ activeModal, modalData }),

  closeModal: () =>
    set({ activeModal: null, modalData: null }),

  openLoginSheet:  () => set({ loginSheetOpen: true }),
  closeLoginSheet: () => set({ loginSheetOpen: false }),
}))
