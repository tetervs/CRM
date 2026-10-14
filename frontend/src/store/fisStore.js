import { create } from 'zustand'
import api from '../api/index'

const useFisStore = create((set, get) => ({
  config: null,
  people: [],

  // Config + people feed every dropdown; fetched once per session unless forced.
  loadRefs: async (force = false) => {
    if (!force && get().config) return
    const [c, p] = await Promise.all([api.get('/fis/config'), api.get('/fis/people')])
    set({ config: c.data, people: p.data })
  },

  saveConfig: async (payload) => {
    const { data } = await api.put('/fis/config', payload)
    set({ config: data })
  },
}))

export default useFisStore
