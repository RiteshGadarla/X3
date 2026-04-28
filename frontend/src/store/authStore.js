/**
 * Auth store using Zustand.
 * Persists JWT token + user profile in localStorage.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import client from '../api/client'

const useAuthStore = create(
  persist(
    (set, get) => ({
      token: null,
      user: null,      // { id, email, full_name, role }
      isAuthenticated: false,

      login: async (email, password) => {
        const { data } = await client.post('/auth/login', { email, password })
        localStorage.setItem('csagent_token', data.access_token)
        set({
          token: data.access_token,
          user: {
            id: data.user_id,
            full_name: data.full_name,
            role: data.role,
          },
          isAuthenticated: true,
        })
        return data
      },

      logout: () => {
        localStorage.removeItem('csagent_token')
        set({ token: null, user: null, isAuthenticated: false })
      },

      getInitials: () => {
        const name = get().user?.full_name || ''
        return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
      },
    }),
    {
      name: 'csagent-auth',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
)

export default useAuthStore
