import { ref } from 'vue'
import { apiFetch } from './apiFetch.js'

const API_URL = '/api/attachments'

export function useAttachments() {
  const attachmentsMeta = ref([]) // 全部附件 metadata（無 data），供 📎 標記與清單

  async function fetchAttachmentsMeta() {
    try {
      const res = await apiFetch(API_URL)
      attachmentsMeta.value = await res.json()
    } catch (e) {
      console.error('Error fetching attachments meta:', e)
    }
  }

  async function getAttachmentData(id) {
    const res = await apiFetch(`${API_URL}/${id}`)
    if (!res.ok) throw new Error('讀取附件失敗')
    return await res.json()
  }

  async function deleteAttachment(id) {
    const res = await apiFetch(`${API_URL}/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '刪除失敗')
    attachmentsMeta.value = attachmentsMeta.value.filter(a => a.id !== id)
  }

  return { attachmentsMeta, fetchAttachmentsMeta, getAttachmentData, deleteAttachment }
}

// 圖片壓縮：長邊縮至 maxDim、JPEG 輸出（回傳 dataURL）
export function compressImage(file, maxDim = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('讀取檔案失敗'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('不支援的圖片格式'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * scale)
        canvas.height = Math.round(img.height * scale)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
