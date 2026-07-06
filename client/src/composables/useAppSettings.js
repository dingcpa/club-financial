import { ref } from 'vue'
import { apiFetch } from './apiFetch'

// 系統參數（accounting.baseDate 基準日、dues.monthlyAmount 每月社費…）
export function useAppSettings() {
  const appSettings = ref({})

  const fetchAppSettings = async () => {
    const res = await apiFetch(`/api/settings?t=${Date.now()}`)
    if (res.ok) appSettings.value = await res.json()
  }

  const saveAppSettings = async (payload) => {
    const res = await apiFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '更新設定失敗')
    await fetchAppSettings()
    return data
  }

  return { appSettings, fetchAppSettings, saveAppSettings }
}
