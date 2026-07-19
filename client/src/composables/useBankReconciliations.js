import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/bank-reconciliations'

export function useBankReconciliations() {
  const bankReconciliations = ref([])

  async function fetchBankReconciliations() {
    try {
      const res = await apiFetch(API_URL)
      bankReconciliations.value = await res.json()
    } catch (e) {
      console.error('Error fetching bank reconciliations:', e)
    }
  }

  async function addBankReconciliation(payload) {
    const res = await apiFetch(API_URL, { method: 'POST', body: JSON.stringify(payload) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '儲存失敗')
    await fetchBankReconciliations()
  }

  async function deleteBankReconciliation(id) {
    const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '刪除失敗')
    bankReconciliations.value = bankReconciliations.value.filter(r => r.id !== id)
  }

  return { bankReconciliations, fetchBankReconciliations, addBankReconciliation, deleteBankReconciliation }
}
