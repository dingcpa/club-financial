import { ref } from 'vue'

const API_URL = 'http://localhost:5000/api/members'

export function useMembers() {
  const members = ref([])
  const memLoading = ref(true)

  async function fetchMembers() {
    memLoading.value = true
    try {
      const res = await fetch(API_URL)
      members.value = await res.json()
    } catch (e) {
      console.error('Error fetching members:', e)
    } finally {
      memLoading.value = false
    }
  }

  async function addMember(newMember) {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMember)
    })
    const saved = await res.json()
    members.value = [...members.value, saved]
    return saved
  }

  async function updateMember(id, updatedMember) {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMember)
    })
    const updated = await res.json()
    members.value = members.value.map(m => m.id === id ? updated : m)
    return updated
  }

  async function deleteMember(id) {
    await fetch(`${API_URL}/${id}`, { method: 'DELETE' })
    members.value = members.value.filter(m => m.id !== id)
  }

  return { members, memLoading, fetchMembers, addMember, updateMember, deleteMember }
}
