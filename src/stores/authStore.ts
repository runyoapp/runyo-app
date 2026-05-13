import { create } from 'zustand'
import type { TokenSet } from '@/types/auth'
import { loadStoredTokenSet, signOut as authSignOut, getAccessToken } from '@/services/auth'

type AuthStore = {
  tokenSet: TokenSet | null
  isLoading: boolean
  hydrate: () => Promise<void>
  setTokenSet: (tokenSet: TokenSet) => void
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  tokenSet: null,
  isLoading: true,

  hydrate: async () => {
    const tokenSet = await loadStoredTokenSet()
    set({ tokenSet, isLoading: false })
  },

  setTokenSet: (tokenSet) => set({ tokenSet }),

  signOut: async () => {
    await authSignOut()
    set({ tokenSet: null })
  },

  getToken: () => getAccessToken(),
}))
