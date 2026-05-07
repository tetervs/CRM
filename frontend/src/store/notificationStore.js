import { create } from 'zustand'
import api from '../api/index'

let pollInterval = null

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount:   0,
  loading:       false,

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get('/notifications')
      set({
        notifications: data,
        unreadCount:   data.filter((n) => !n.isRead).length,
        loading:       false,
      })
    } catch {
      set({ loading: false })
    }
  },

  fetchUnreadCount: async () => {
    try {
      const { data } = await api.get('/notifications?unreadOnly=true')
      set({ unreadCount: data.length })
    } catch {}
  },

  markRead: async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`)
      set((s) => ({
        notifications: s.notifications.map((n) => n._id === id ? { ...n, isRead: true } : n),
        unreadCount:   Math.max(0, s.unreadCount - 1),
      }))
    } catch {}
  },

  markAllRead: async () => {
    try {
      await api.patch('/notifications/read-all')
      set((s) => ({
        notifications: s.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount:   0,
      }))
    } catch {}
  },

  startPolling: () => {
    if (pollInterval) return
    get().fetchUnreadCount()
    pollInterval = setInterval(() => {
      get().fetchUnreadCount()
    }, 15000)
  },

  stopPolling: () => {
    if (pollInterval) {
      clearInterval(pollInterval)
      pollInterval = null
    }
    set({ notifications: [], unreadCount: 0 })
  },
}))

export default useNotificationStore
