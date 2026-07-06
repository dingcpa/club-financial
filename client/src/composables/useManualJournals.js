import { ref } from 'vue'
import { apiFetch } from './apiFetch'

// 手工傳票（調整分錄：兌換利益、期末調整等）
export function useManualJournals() {
  const manualJournals = ref([])

  const fetchManualJournals = async () => {
    const res = await apiFetch(`/api/manual-journals?t=${Date.now()}`)
    if (res.ok) manualJournals.value = await res.json()
  }

  const addManualJournal = async (payload) => {
    const res = await apiFetch('/api/manual-journals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '新增傳票失敗')
    await fetchManualJournals()
    return data
  }

  const updateManualJournal = async (id, payload) => {
    const res = await apiFetch(`/api/manual-journals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '更新傳票失敗')
    await fetchManualJournals()
    return data
  }

  const deleteManualJournal = async (id) => {
    const res = await apiFetch(`/api/manual-journals/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '刪除傳票失敗')
    await fetchManualJournals()
    return data
  }

  return { manualJournals, fetchManualJournals, addManualJournal, updateManualJournal, deleteManualJournal }
}
