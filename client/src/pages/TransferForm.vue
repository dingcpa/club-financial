<template>
  <v-card class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-3 pa-sm-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-swap-horizontal</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">{{ editingRecord ? '編輯內部轉帳單' : '新增內部轉帳單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4">
      <v-alert v-if="!editingRecord" color="primary" variant="tonal" density="compact" icon="mdi-information" class="mb-3">
        <span class="text-caption">用於<strong>資產科目間移轉</strong>：經手人把代收現金存入銀行、歸還代墊款等。不影響收支餘絀。</span>
      </v-alert>

      <v-form @submit.prevent="handleSubmit">
        <v-text-field v-model="formData.date" label="轉帳日期" type="date" density="compact" variant="outlined" required class="mb-3" />

        <v-row dense align="center" class="mb-3">
          <v-col cols="12" sm="5">
            <v-select v-model="formData.fromAccount" label="轉出（帳戶/經手人）" :items="fundOptions" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="12" sm="2" class="text-center">
            <v-icon class="d-none d-sm-inline-flex">mdi-arrow-right</v-icon>
            <v-icon class="d-inline-flex d-sm-none">mdi-arrow-down</v-icon>
          </v-col>
          <v-col cols="12" sm="5">
            <v-select v-model="formData.toAccount" label="轉入（帳戶/經手人）" :items="fundOptions" density="compact" variant="outlined" required />
          </v-col>
        </v-row>

        <v-text-field
          v-model="formData.amount"
          label="轉帳金額 (NT$)"
          type="number"
          density="compact"
          variant="outlined"
          required
          class="mb-2"
        />

        <v-textarea
          v-model="formData.remark"
          label="備註說明"
          placeholder="例如：代收社費存入一銀、歸還社長代墊款..."
          rows="3"
          density="compact"
          variant="outlined"
          class="mb-3"
        />

        <AttachmentPanel v-model="pendingAttachments" ref-type="finance" :ref-id="editingRecord?.id || null" />

        <div class="d-flex flex-wrap ga-2">
          <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" class="flex-grow-1">
            {{ editingRecord ? '更新轉帳' : '儲存轉帳' }}
          </v-btn>
          <v-btn v-if="editingRecord" color="blue-grey" variant="flat" prepend-icon="mdi-delete" @click="handleDelete">刪除</v-btn>
          <v-btn v-if="editingRecord" variant="tonal" @click="handleCancelEdit">取消</v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'
import Swal from 'sweetalert2'
import { buildFundAccountOptions, normalizeFundValue, fundAccountLabel, BANK_NAME, handlerFundValue } from '../accounting/coa.js'
import AttachmentPanel from '../components/AttachmentPanel.vue'

const members = inject('members')
const accounts = inject('accounts')
const editingRecord = inject('editingRecord')
const addRecord = inject('addRecord')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')

const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))

function makeDefaultForm() {
  return {
    date: new Date().toISOString().split('T')[0],
    fromAccount: handlerFundValue('陳淑華'),
    toAccount: BANK_NAME,
    amount: '',
    remark: '',
  }
}

const formData = ref(makeDefaultForm())
const pendingAttachments = ref([])

watch(editingRecord, (ed) => {
  if (ed) {
    formData.value = {
      date: ed.date,
      fromAccount: normalizeFundValue(ed.fromAccount),
      toAccount: normalizeFundValue(ed.toAccount),
      amount: ed.amount,
      remark: ed.remark || '',
    }
  }
}, { immediate: true })

async function handleSubmit() {
  if (!formData.value.amount || parseFloat(formData.value.amount) <= 0) {
    Swal.fire({ icon: 'warning', title: '請輸入有效金額', confirmButtonColor: '#4f46e5' })
    return
  }
  if (formData.value.fromAccount === formData.value.toAccount) {
    Swal.fire({ icon: 'warning', title: '轉出與轉入不能相同', confirmButtonColor: '#4f46e5' })
    return
  }
  const payload = {
    ...formData.value,
    item: `內部轉帳: ${fundAccountLabel(formData.value.fromAccount)} ➡ ${fundAccountLabel(formData.value.toAccount)}`,
    type: 'transfer',
    amount: parseFloat(formData.value.amount),
    attachments: pendingAttachments.value,
  }
  if (editingRecord.value) {
    await updateRecord(editingRecord.value.id, payload)
  } else {
    await addRecord(payload)
    formData.value = makeDefaultForm()
  }
  pendingAttachments.value = []
}

async function handleDelete() {
  if (editingRecord.value) await deleteRecord(editingRecord.value.id)
}
</script>
