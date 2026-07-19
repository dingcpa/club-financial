<template>
  <v-card variant="outlined" class="pa-2 pa-sm-3 mb-3" rounded="lg">
    <div class="d-flex justify-space-between align-center mb-1">
      <span class="text-caption font-weight-bold">
        <v-icon size="14">mdi-paperclip</v-icon>
        佐證附件（收據 / 發票 / 匯款水單，最多 3 張，自動壓縮）
      </span>
      <v-btn
        size="x-small" variant="tonal" color="primary" prepend-icon="mdi-plus"
        :disabled="existing.length + pending.length >= 3"
        @click="fileInput?.click()"
      >加照片</v-btn>
      <input ref="fileInput" type="file" accept="image/*" multiple style="display:none" @change="handleFiles" />
    </div>

    <div v-if="!existing.length && !pending.length" class="text-caption text-medium-emphasis">尚無附件</div>

    <div class="d-flex flex-wrap ga-2">
      <!-- 既有附件 -->
      <v-chip
        v-for="a in existing" :key="'e' + a.id"
        size="small" variant="tonal" color="primary"
        prepend-icon="mdi-image" closable
        @click="viewAttachment(a)"
        @click:close="handleDeleteExisting(a)"
      >{{ a.filename }}</v-chip>
      <!-- 待上傳（存檔時一併上傳） -->
      <v-chip
        v-for="(p, i) in pending" :key="'p' + i"
        size="small" variant="tonal" color="warning"
        prepend-icon="mdi-image-plus" closable
        @click="viewer = { show: true, src: p.data, title: p.filename }"
        @click:close="pending.splice(i, 1)"
      >{{ p.filename }}（待存檔）</v-chip>
    </div>

    <!-- 檢視 dialog -->
    <v-dialog v-model="viewer.show" max-width="720">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-3">
          <span class="text-body-2">{{ viewer.title }}</span>
          <v-btn icon variant="text" size="small" @click="viewer.show = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text class="text-center pa-2">
          <v-progress-circular v-if="!viewer.src" indeterminate color="primary" class="ma-8" />
          <img v-else :src="viewer.src" style="max-width:100%;max-height:75vh" />
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'
import { compressImage } from '../composables/useAttachments.js'

const props = defineProps({
  refType: { type: String, required: true },
  refId: { type: [Number, String], default: null },
})
const pending = defineModel({ type: Array, default: () => [] })

const attachmentsMeta = inject('attachmentsMeta')
const getAttachmentData = inject('getAttachmentData')
const deleteAttachment = inject('deleteAttachment')

const fileInput = ref(null)
const viewer = ref({ show: false, src: '', title: '' })

const existing = computed(() =>
  props.refId
    ? (attachmentsMeta?.value || []).filter(a => a.refType === props.refType && String(a.refId) === String(props.refId))
    : []
)

async function handleFiles(ev) {
  const files = [...(ev.target.files || [])]
  ev.target.value = ''
  for (const file of files) {
    if (existing.value.length + pending.value.length >= 3) break
    if (!file.type.startsWith('image/')) {
      Swal.fire({ icon: 'warning', title: '僅支援圖片檔', text: file.name, confirmButtonColor: '#4f46e5' })
      continue
    }
    try {
      const data = await compressImage(file)
      pending.value.push({
        filename: file.name.replace(/\.[^.]+$/, '') + '.jpg',
        mimeType: 'image/jpeg',
        size: Math.round(data.length * 3 / 4),
        data,
      })
    } catch (e) {
      Swal.fire({ icon: 'error', title: '處理圖片失敗', text: e.message, confirmButtonColor: '#ef4444' })
    }
  }
}

async function viewAttachment(a) {
  viewer.value = { show: true, src: '', title: a.filename }
  try {
    const full = await getAttachmentData(a.id)
    viewer.value.src = full.data
  } catch (e) {
    viewer.value.show = false
    Swal.fire({ icon: 'error', title: '讀取附件失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

async function handleDeleteExisting(a) {
  const result = await Swal.fire({
    title: '刪除附件？', text: a.filename, icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '刪除', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    try { await deleteAttachment(a.id) } catch (e) {
      Swal.fire({ icon: 'error', title: '刪除失敗', text: e.message, confirmButtonColor: '#ef4444' })
    }
  }
}
</script>
