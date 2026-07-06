import { ref } from 'vue'
import { apiFetch } from './apiFetch'

// 會計科目表（chart of accounts）
export function useAccounts() {
  const accounts = ref([])
  const acctLoading = ref(false)

  const fetchAccounts = async () => {
    acctLoading.value = true
    try {
      const res = await apiFetch(`/api/accounts?t=${Date.now()}`)
      if (res.ok) accounts.value = await res.json()
    } finally {
      acctLoading.value = false
    }
  }

  const addAccount = async (payload) => {
    const res = await apiFetch('/api/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '新增科目失敗')
    await fetchAccounts()
    return data
  }

  const updateAccount = async (code, payload) => {
    const res = await apiFetch(`/api/accounts/${encodeURIComponent(code)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '更新科目失敗')
    await fetchAccounts()
    return data
  }

  const deleteAccount = async (code) => {
    const res = await apiFetch(`/api/accounts/${encodeURIComponent(code)}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '刪除科目失敗')
    await fetchAccounts()
    return data
  }

  return { accounts, acctLoading, fetchAccounts, addAccount, updateAccount, deleteAccount }
}
