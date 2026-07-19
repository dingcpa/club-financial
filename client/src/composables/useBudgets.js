import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/budgets'

export function useBudgets() {
  const budgets = ref([])

  async function fetchBudgets() {
    try {
      const res = await apiFetch(API_URL)
      budgets.value = await res.json()
    } catch (e) {
      console.error('Error fetching budgets:', e)
    }
  }

  // 依年度整批覆寫（admin）
  async function saveBudgets(fy, rows) {
    const res = await apiFetch(`${API_URL}/${fy}`, { method: 'PUT', body: JSON.stringify(rows) })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '儲存失敗')
    await fetchBudgets()
  }

  return { budgets, fetchBudgets, saveBudgets }
}
