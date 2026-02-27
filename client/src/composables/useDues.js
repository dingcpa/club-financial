import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/dues-settings'

const DEFAULT_DUES = [
  { category: '1-3月社費', dueDate: '2026-01-01', standardAmount: 16500 },
  { category: '4-6月社費', dueDate: '2026-04-01', standardAmount: 16500 },
  { category: '7-9月社費', dueDate: '2026-07-01', standardAmount: 16500 },
  { category: '10-12月社費', dueDate: '2026-10-01', standardAmount: 16500 },
  { category: '總半年費(1-6)', dueDate: '2026-01-01', standardAmount: 600 },
  { category: '總半年費(7-12)', dueDate: '2026-07-01', standardAmount: 600 },
  { category: 'EREY費', dueDate: '2026-07-01', standardAmount: 3000 },
  { category: '春節紅箱', dueDate: '2026-02-01', standardAmount: 1000 },
  { category: '母親節紅箱', dueDate: '2026-05-01', standardAmount: 1000 },
  { category: '父親節紅箱', dueDate: '2026-08-01', standardAmount: 1000 },
  { category: '中秋節紅箱', dueDate: '2026-09-01', standardAmount: 1000 },
  { category: '入社費', dueDate: '', standardAmount: 5000 }
]

export function useDues() {
  const duesSettings = ref([...DEFAULT_DUES])

  async function fetchDuesSettings() {
    try {
      const res = await apiFetch(API_URL)
      const data = await res.json()
      duesSettings.value = data.length > 0 ? data : DEFAULT_DUES
    } catch (e) {
      console.error('Error fetching dues settings:', e)
    }
  }

  async function addDuesSetting(setting) {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(setting)
    })
    const saved = await res.json()
    duesSettings.value = [...duesSettings.value, saved]
    return saved
  }

  async function updateDuesSetting(oldCategory, setting) {
    const res = await apiFetch(`${API_URL}/${encodeURIComponent(oldCategory)}`, {
      method: 'PUT',
      body: JSON.stringify(setting)
    })
    const updated = await res.json()
    duesSettings.value = duesSettings.value.map(d =>
      d.category === oldCategory ? updated : d
    )
    return updated
  }

  async function deleteDuesSetting(category) {
    await apiFetch(`${API_URL}/${encodeURIComponent(category)}`, { method: 'DELETE' })
    duesSettings.value = duesSettings.value.filter(d => d.category !== category)
  }

  return { duesSettings, fetchDuesSettings, addDuesSetting, updateDuesSetting, deleteDuesSetting }
}
