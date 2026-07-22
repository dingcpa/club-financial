import { ref } from 'vue'
import { apiFetch } from './apiFetch'

// 活動（原專案類別：三社聯誼、爐邊會、肺癌篩檢…；收支單據的橫切維度）
export function useProjects() {
  const projects = ref([])

  const fetchProjects = async () => {
    const res = await apiFetch(`/api/projects?t=${Date.now()}`)
    if (res.ok) projects.value = await res.json()
  }

  const addProject = async (payload) => {
    const res = await apiFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '新增活動失敗')
    await fetchProjects()
    return data
  }

  const updateProject = async (id, payload) => {
    const res = await apiFetch(`/api/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '更新活動失敗')
    await fetchProjects()
    return data
  }

  const deleteProject = async (id) => {
    const res = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || '刪除活動失敗')
    await fetchProjects()
    return data
  }

  return { projects, fetchProjects, addProject, updateProject, deleteProject }
}
