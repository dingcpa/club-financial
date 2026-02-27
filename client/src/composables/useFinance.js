import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/finance'

export function useFinance() {
  const records = ref([])
  const loading = ref(true)

  async function fetchRecords() {
    loading.value = true
    try {
      const res = await apiFetch(`${API_URL}?t=${Date.now()}`)
      records.value = await res.json()
    } catch (e) {
      console.error('Error fetching records:', e)
    } finally {
      loading.value = false
    }
  }

  async function addRecord(newRecord) {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(newRecord)
    })
    const saved = await res.json()
    records.value = [...records.value, saved]
    return saved
  }

  async function addRecordsBatch(newRecords) {
    const res = await apiFetch(`${API_URL}/batch`, {
      method: 'POST',
      body: JSON.stringify(newRecords)
    })
    const saved = await res.json()
    records.value = [...records.value, ...saved]
    return saved
  }

  async function updateRecord(id, updatedRecord) {
    const res = await apiFetch(`${API_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updatedRecord)
    })
    const updated = await res.json()
    records.value = records.value.map(r => r.id === id ? updated : r)
    return updated
  }

  async function deleteRecord(id) {
    await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' })
    records.value = records.value.filter(r => r.id !== id)
  }

  return { records, loading, fetchRecords, addRecord, addRecordsBatch, updateRecord, deleteRecord }
}
