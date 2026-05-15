import { create } from 'zustand'

type ModalName = 'dayDetail' | 'race' | 'stats' | 'import' | null

type UiStore = {
  isLoading: boolean
  loadingMessage: string | null
  toast: string | null
  activeModal: ModalName
  modalData: unknown

  setLoading: (loading: boolean, message?: string | null) => void
  showToast: (message: string, durationMs?: number) => void
  hideToast: () => void
  openModal: (modal: NonNullable<ModalName>, data?: unknown) => void
  closeModal: () => void
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export const useUiStore = create<UiStore>((set) => ({
  isLoading: false,
  loadingMessage: null,
  toast: null,
  activeModal: null,
  modalData: null,

  setLoading: (isLoading, loadingMessage = null) =>
    set({ isLoading, loadingMessage }),

  showToast: (message, durationMs = 3000) => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: message })
    toastTimer = setTimeout(() => set({ toast: null }), durationMs)
  },

  hideToast: () => {
    if (toastTimer) clearTimeout(toastTimer)
    set({ toast: null })
  },

  openModal: (activeModal, modalData = null) =>
    set({ activeModal, modalData }),

  closeModal: () =>
    set({ activeModal: null, modalData: null }),
}))
