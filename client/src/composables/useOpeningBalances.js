import { ref } from 'vue'
import { apiFetch } from './apiFetch'

// 期初餘額（基準日各科目/人員期初數，累積餘絀由引擎軋差）
export function useOpeningBalances() {
  const openingBalances = ref([])

  const fetchOpeningBalances = async () => {
    const res = await apiFetch(`/api/opening-balances?t=${Date.now()}`)
    if (res.ok) openingBalances.value = await res.json()
  }

  // 以基準日為單位整批覆寫
  const saveOpeningBalances = async (baseDate, rows) => {
    const res = await apiFetch('/api/opening-balances', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ baseDate, rows }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '儲存期初餘額失敗')
    await fetchOpeningBalances()
    return data
  }

  return { openingBalances, fetchOpeningBalances, saveOpeningBalances }
}
