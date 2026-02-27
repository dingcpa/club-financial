<template>
  <v-card max-width="600" class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-swap-horizontal</v-icon>
        <span class="text-h6 font-weight-bold">{{ editingRecord ? '編輯調撥單' : '填寫調撥單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-text-field v-model="formData.date" label="調撥日期" type="date" density="compact" variant="outlined" required class="mb-3" />

        <v-row align="center" class="mb-3">
          <v-col cols="5">
            <v-select v-model="formData.fromAccount" label="轉出帳戶" :items="ACCOUNTS" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="2" class="text-center">
            <v-icon>mdi-arrow-right</v-icon>
          </v-col>
          <v-col cols="5">
            <v-select v-model="formData.toAccount" label="轉入帳戶" :items="ACCOUNTS" density="compact" variant="outlined" required />
          </v-col>
        </v-row>

        <v-text-field
          v-model="formData.amount"
          label="調撥金額 (NT$)"
          type="number"
          density="compact"
          variant="outlined"
          required
          class="mb-2"
        />

        <v-textarea
          v-model="formData.remark"
          label="備註說明"
          placeholder="例如：提款支應、帳戶互轉..."
          rows="3"
          density="compact"
          variant="outlined"
          class="mb-4"
        />

        <div class="d-flex ga-3">
          <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" class="flex-grow-1">
            {{ editingRecord ? '更新調撥' : '儲存調撥' }}
          </v-btn>
          <v-btn v-if="editingRecord" color="blue-grey" variant="flat" prepend-icon="mdi-delete" @click="handleDelete">刪除</v-btn>
          <v-btn v-if="editingRecord" variant="tonal" @click="handleCancelEdit">取消</v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, watch, inject } from 'vue'

const editingRecord = inject('editingRecord')
const addRecord = inject('addRecord')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')

const ACCOUNTS = ['淑華代收付', '一銀帳戶', '社長代收付']

function makeDefaultForm() {
  return {
    date: new Date().toISOString().split('T')[0],
    fromAccount: '淑華代收付',
    toAccount: '一銀帳戶',
    amount: '',
    remark: '',
  }
}

const formData = ref(makeDefaultForm())

watch(editingRecord, (ed) => {
  if (ed) {
    formData.value = {
      date: ed.date,
      fromAccount: ed.fromAccount || '淑華代收付',
      toAccount: ed.toAccount || '一銀帳戶',
      amount: ed.amount,
      remark: ed.remark || '',
    }
  }
}, { immediate: true })

async function handleSubmit() {
  if (!formData.value.amount || parseFloat(formData.value.amount) <= 0) {
    alert('請輸入有效金額')
    return
  }
  if (formData.value.fromAccount === formData.value.toAccount) {
    alert('轉出帳戶與轉入帳戶不能相同')
    return
  }
  const payload = {
    ...formData.value,
    item: `資金調撥: ${formData.value.fromAccount} ➡ ${formData.value.toAccount}`,
    type: 'transfer',
    amount: parseFloat(formData.value.amount),
  }
  if (editingRecord.value) {
    await updateRecord(editingRecord.value.id, payload)
  } else {
    await addRecord(payload)
    formData.value = makeDefaultForm()
  }
}

async function handleDelete() {
  if (editingRecord.value) await deleteRecord(editingRecord.value.id)
}
</script>
