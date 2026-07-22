import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/payables'

async function toJson(res) {
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '操作失敗')
  return data
}

export function usePayables() {
  const payables = ref([])
  const payLoading = ref(true)

  async function fetchPayables() {
    payLoading.value = true
    try {
      const res = await apiFetch(`${API_URL}?t=${Date.now()}`)
      payables.value = await res.json()
    } catch (e) {
      console.error('Error fetching payables:', e)
    } finally {
      payLoading.value = false
    }
  }

  const createPayable = (payload) =>
    apiFetch(API_URL, { method: 'POST', body: JSON.stringify(payload) }).then(toJson)
  const updatePayable = (id, payload) =>
    apiFetch(`${API_URL}/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).then(toJson)
  const deletePayable = (id) =>
    apiFetch(`${API_URL}/${id}`, { method: 'DELETE' }).then(toJson)
  const payPayable = (id, payload) =>
    apiFetch(`${API_URL}/${id}/pay`, { method: 'POST', body: JSON.stringify(payload) }).then(toJson)
  const settlePayablesBatch = (payload) =>
    apiFetch(`${API_URL}/settle-batch`, { method: 'POST', body: JSON.stringify(payload) }).then(toJson)
  const waivePayable = (id, waivedReason) =>
    apiFetch(`${API_URL}/${id}/waive`, { method: 'PUT', body: JSON.stringify({ waivedReason }) }).then(toJson)
  const reopenPayable = (id) =>
    apiFetch(`${API_URL}/${id}/reopen`, { method: 'PUT' }).then(toJson)

  return {
    payables, payLoading, fetchPayables,
    createPayable, updatePayable, deletePayable,
    payPayable, settlePayablesBatch, waivePayable, reopenPayable,
  }
}
