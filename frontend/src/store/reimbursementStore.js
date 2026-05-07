import { create } from 'zustand'
import api from '../api/index'

const useReimbursementStore = create((set) => ({
  reimbursements: [],
  current:        null,
  loading:        false,
  error:          null,

  fetchReimbursements: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get('/reimbursements')
      set({ reimbursements: data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch reimbursements', loading: false })
    }
  },

  fetchReimbursement: async (id) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get(`/reimbursements/${id}`)
      set({ current: data, loading: false })
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch reimbursement', loading: false })
    }
  },

  createReimbursement: async (payload) => {
    const { data } = await api.post('/reimbursements', payload)
    set((s) => ({ reimbursements: [data, ...s.reimbursements] }))
    return data
  },

  headApprove: async (id) => {
    const { data } = await api.patch(`/reimbursements/${id}/head-approve`)
    set((s) => ({
      reimbursements: s.reimbursements.map((r) => r._id === id ? data : r),
      current:        s.current?._id === id ? data : s.current,
    }))
  },

  financeApprove: async (id) => {
    const { data } = await api.patch(`/reimbursements/${id}/finance-approve`)
    set((s) => ({
      reimbursements: s.reimbursements.map((r) => r._id === id ? data : r),
      current:        s.current?._id === id ? data : s.current,
    }))
  },

  rejectReimbursement: async (id, reason) => {
    const { data } = await api.patch(`/reimbursements/${id}/reject`, { reason })
    set((s) => ({
      reimbursements: s.reimbursements.map((r) => r._id === id ? data : r),
      current:        s.current?._id === id ? data : s.current,
    }))
  },

  markPaid: async (id) => {
    const { data } = await api.patch(`/reimbursements/${id}/pay`)
    set((s) => ({
      reimbursements: s.reimbursements.map((r) => r._id === id ? data : r),
      current:        s.current?._id === id ? data : s.current,
    }))
  },
}))

export default useReimbursementStore
