import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/agency-collections'

export function useAgencyCollections() {
  const agencyCollections = ref([])
  const agencyLoading = ref(false)

  async function fetchAgencyCollections() {
    agencyLoading.value = true
    try {
      const res = await apiFetch(API_URL)
      agencyCollections.value = await res.json()
    } catch (e) {
      console.error('Error fetching agency collections:', e)
    } finally {
      agencyLoading.value = false
    }
  }

  async function createCollection(data) {
    const res = await apiFetch(API_URL, {
      method: 'POST',
      body: JSON.stringify(data)
    })
    if (res.ok) {
      const saved = await res.json()
      agencyCollections.value = [saved, ...agencyCollections.value]
      return saved
    }
  }

  async function recordPayment(collectionId, memberName, amount, date) {
    const res = await apiFetch(`${API_URL}/${collectionId}/pay`, {
      method: 'POST',
      body: JSON.stringify({
        memberName,
        date: date || new Date().toISOString().split('T')[0],
        amount
      })
    })
    if (res.ok) {
      const updated = await res.json()
      agencyCollections.value = agencyCollections.value.map(c => c.id === collectionId ? updated : c)
      return updated
    }
  }

  async function removePayment(collectionId, memberName) {
    const res = await apiFetch(`${API_URL}/${collectionId}/pay/${encodeURIComponent(memberName)}`, {
      method: 'DELETE'
    })
    if (res.ok) {
      const updated = await res.json()
      agencyCollections.value = agencyCollections.value.map(c => c.id === collectionId ? updated : c)
      return updated
    }
  }

  async function closeCollection(collectionId, closedAmount, closedRemark) {
    const res = await apiFetch(`${API_URL}/${collectionId}/close`, {
      method: 'POST',
      body: JSON.stringify({ closedAmount, closedRemark: closedRemark || '' })
    })
    if (res.ok) {
      const updated = await res.json()
      agencyCollections.value = agencyCollections.value.map(c => c.id === collectionId ? updated : c)
      return updated
    }
  }

  async function deleteCollection(collectionId) {
    const res = await apiFetch(`${API_URL}/${collectionId}`, { method: 'DELETE' })
    if (res.ok) {
      agencyCollections.value = agencyCollections.value.filter(c => c.id !== collectionId)
    }
  }

  return {
    agencyCollections, agencyLoading,
    fetchAgencyCollections, createCollection,
    recordPayment, removePayment,
    closeCollection, deleteCollection
  }
}
