import { create } from 'zustand'
import api from '../api/index'

const persist = (user, token) => {
  localStorage.setItem('crm_token', token)
  localStorage.setItem('crm_user', JSON.stringify(user))
}

const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,

  login: async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password })
    persist(data.user, data.token)
    set({ user: data.user, token: data.token, isAuthenticated: true })
  },

  register: async (formData) => {
    const { data } = await api.post('/auth/register', formData)
    return data
  },

  logout: () => {
    localStorage.removeItem('crm_token')
    localStorage.removeItem('crm_user')
    set({ user: null, token: null, isAuthenticated: false })
  },

  loadFromStorage: () => {
    const token = localStorage.getItem('crm_token')
    const raw = localStorage.getItem('crm_user')
    if (token && raw) {
      try {
        const user = JSON.parse(raw)
        set({ token, user, isAuthenticated: true })
      } catch {
        localStorage.removeItem('crm_token')
        localStorage.removeItem('crm_user')
      }
    }
  },

  // Called after login to sync server user (Section 11)
  fetchMe: async () => {
    try {
      const { data } = await api.get('/auth/me')
      localStorage.setItem('crm_user', JSON.stringify(data))
      set({ user: data })
    } catch {
      // token invalid — interceptor handles logout
    }
  },
}))

export default useAuthStore
