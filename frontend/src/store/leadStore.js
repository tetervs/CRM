import { create } from 'zustand'
import api from '../api/index'

const useLeadStore = create((set) => ({
  leads: [],
  loading: false,
  error: null,

  fetchLeads: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/leads')
      set({ leads: data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch leads', loading: false })
    }
  },

  createLead: async (data) => {
    const { data: res } = await api.post('/leads', data)
    set((s) => ({ leads: [res, ...s.leads] }))
    return res
  },

  updateLead: async (id, data) => {
    const { data: res } = await api.put(`/leads/${id}`, data)
    set((s) => ({ leads: s.leads.map((l) => (l._id === id ? res : l)) }))
  },

  deleteLead: async (id) => {
    await api.delete(`/leads/${id}`)
    set((s) => ({ leads: s.leads.filter((l) => l._id !== id) }))
  },

  updateLeadStatus: async (id, status) => {
    const { data: res } = await api.patch(`/leads/${id}/status`, { status })
    set((s) => ({ leads: s.leads.map((l) => (l._id === id ? res : l)) }))
  },
}))

export default useLeadStore
