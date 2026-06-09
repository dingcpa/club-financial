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

  // 批次產生帳款（Phase 2）
  async function batchGenerate(payload) {
    const res = await apiFetch(`${API_URL}/batch-generate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '批次產生失敗')
    return await res.json()
  }

  // 單筆新增帳款
  async function createReceivable(payload) {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '新增失敗')
    const saved = await res.json()
    receivables.value = [...receivables.value, saved]
    return saved
  }

  // 編輯帳款
  async function updateReceivable(id, payload) {
    const res = await apiFetch(`${API_URL}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '更新失敗')
    const updated = await res.json()
    receivables.value = receivables.value.map(r => r.id === id ? updated : r)
    return updated
  }

  // 刪除帳款
  async function deleteReceivable(id) {
    const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '刪除失敗')
    receivables.value = receivables.value.filter(r => r.id !== id)
  }

  // 單筆收款 / 沖帳（Phase 3，支援部分收款）
  async function collectReceivable(id, payload) {
    const res = await apiFetch(`${API_URL}/${id}/collect`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '收款失敗')
    const result = await res.json()
    receivables.value = receivables.value.map(r => r.id === id ? result.receivable : r)
    return result
  }

  return {
    receivables,
    recLoading,
    fetchReceivables,
    fetchOutstanding,
    settleBatch,
    waiveReceivable,
    reopenReceivable,
    batchGenerate,
    createReceivable,
    updateReceivable,
    deleteReceivable,
    collectReceivable,
  }
}
