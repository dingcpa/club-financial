import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/receivables'

export function useReceivables() {
  const receivables = ref([])
  const recLoading = ref(false)

  async function fetchReceivables(params = {}) {
    recLoading.value = true
    try {
      const query = new URLSearchParams(params).toString()
      const res = await apiFetch(`${API_URL}?${query}`)
      receivables.value = await res.json()
    } finally {
      recLoading.value = false
    }
  }

  async function fetchOutstanding(memberName) {
    const res = await apiFetch(`${API_URL}/outstanding/${encodeURIComponent(memberName)}`)
    return await res.json()
  }

  async function settleBatch(payload) {
    const res = await apiFetch(`${API_URL}/settle-batch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return await res.json()
  }

  async function waiveReceivable(id, waivedReason) {
    const res = await apiFetch(`${API_URL}/${id}/waive`, {
      method: 'PUT',
      body: JSON.stringify({ waivedReason }),
    })
    if (res.ok) {
      const updated = await res.json()
      receivables.value = receivables.value.map(r => r.id === id ? updated : r)
      return updated
    }
  }

  async function reopenReceivable(id) {
    const res = await apiFetch(`${API_URL}/${id}/reopen`, {
      method: 'PUT',
    })
    if (res.ok) {
      const updated = await res.json()
      receivables.value = receivables.value.map(r => r.id === id ? updated : r)
      return updated
    }
  }

  return {
    receivables,
    recLoading,
    fetchReceivables,
    fetchOutstanding,
    settleBatch,
    waiveReceivable,
    reopenReceivable,
  }
}
