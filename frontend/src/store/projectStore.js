import { create } from 'zustand'
import api from '../api/index'

const useProjectStore = create((set) => ({
  projects: [],
  current:  null,
  loading:  false,
  error:    null,

  fetchProjects: async (params = {}) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/projects', { params })
      set({ projects: data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch projects', loading: false })
    }
  },

  fetchProject: async (id) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/projects/${id}`)
      set({ current: data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch project', loading: false })
    }
  },

  convertLead: async (leadId, payload) => {
    const { data } = await api.post(`/leads/${leadId}/convert`, payload)
    return data
  },

  updateStatus: async (id, status) => {
    const { data } = await api.patch(`/projects/${id}/status`, { status })
    set((s) => ({
      projects: s.projects.map((p) => p._id === id ? { ...p, status: data.status } : p),
      current:  s.current?._id === id ? { ...s.current, status: data.status } : s.current,
    }))
  },

  addProgress: async (id, note) => {
    const { data } = await api.post(`/projects/${id}/progress`, { note })
    set((s) => ({
      current: s.current?._id === id
        ? { ...s.current, progressUpdates: [...(s.current.progressUpdates || []), data] }
        : s.current,
    }))
    return data
  },

  logExpense: async (id, payload) => {
    const { data } = await api.post(`/projects/${id}/expenses`, payload)
    set((s) => ({
      current: s.current?._id === id
        ? { ...s.current, expenses: [...(s.current.expenses || []), data] }
        : s.current,
    }))
    return data
  },

  completeProject: async (id) => {
    const { data } = await api.patch(`/projects/${id}/complete`)
    set((s) => ({
      projects: s.projects.map((p) => p._id === id ? data.project : p),
      current:  s.current?._id === id ? data.project : s.current,
    }))
    return data
  },
}))

export default useProjectStore
