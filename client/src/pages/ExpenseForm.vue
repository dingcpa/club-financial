<template>
  <v-card max-width="600" class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="error">mdi-minus-circle</v-icon>
        <span class="text-h6 font-weight-bold">{{ editingRecord ? '編輯支出單' : '填寫支出單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-row>
          <v-col cols="6">
            <v-text-field v-model="formData.date" label="支出日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="6">
            <v-select v-model="formData.account" label="付款人" :items="ACCOUNTS" density="compact" variant="outlined" required />
          </v-col>
        </v-row>

        <v-select
          v-model="selectedItem"
          label="項目名稱"
          :items="[...PRESET_EXPENSES, 'CUSTOM']"
          :item-title="i => i === 'CUSTOM' ? '+ 新增自定義項目...' : i"
          density="compact"
          variant="outlined"
          required
          class="mb-2"
          @update:model-value="handleItemChange"
        />

        <v-text-field
          v-if="isCustom"
          v-model="formData.customItem"
          label="自定義項目名稱"
          placeholder="例如：裝修費、活動費..."
          density="compact"
          variant="outlined"
          required
          class="mb-2"
        />

        <!-- 平攤設定 -->
        <v-card variant="outlined" class="pa-3 mb-3" rounded="lg">
          <v-checkbox
            v-model="formData.isPrepaid"
            label="此筆為「跨月份平攤」費用（預付性質）"
            color="primary"
            density="compact"
            hide-details
          />
          <div v-if="formData.isPrepaid" class="mt-3">
            <v-row align="center">
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">開始年月</label>
                <v-text-field v-model="formData.startPeriod" type="month" density="compact" variant="outlined" hide-details required @update:model-value="handleStartPeriodChange" />
              </v-col>
              <v-col cols="2" class="text-center">
                <v-icon>mdi-arrow-right</v-icon>
              </v-col>
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">結束年月</label>
                <v-text-field v-model="formData.endPeriod" type="month" density="compact" variant="outlined" hide-details required />
              </v-col>
            </v-row>
            <div class="text-caption text-medium-emphasis font-italic mt-2">
              系統將依照你選擇的年月區間，自動將總金額平均分攤至各月報表。
            </div>
          </div>
        </v-card>

        <v-text-field
          v-model="formData.amount"
          label="金額 (NT$)"
          type="number"
          density="compact"
          variant="outlined"
          required
          class="mb-2"
        />

        <v-textarea
          v-model="formData.remark"
          label="備註"
          rows="3"
          density="compact"
          variant="outlined"
          class="mb-4"
        />

        <div class="d-flex ga-3">
          <v-btn type="submit" color="error" variant="flat" prepend-icon="mdi-content-save" class="flex-grow-1">
            {{ editingRecord ? '更新支出' : '儲存支出' }}
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
const PRESET_EXPENSES = [
  '辨公室租金及水電', '人事費 -薪資/油資', '文具費', '郵電費', '健保費', '印刷費',
  '雜費及設備更新', '助秘提撥金', '例會餐費(一般/聯合)', '例會餐費(女賓夕/眷屬聯歡)',
  '資訊維修費(含地區網站)', '健遊活動', '演講車馬費', '爐邊會', '金蘭聯誼', '高球費用',
  '職業參觀', '授證之旅補助', '還社長', '研習班', '服務計畫委員會', '社員發展委員會',
  '扶輪基金委員會', '公共關係委員會', '預備費'
]
const currentMonth = new Date().toISOString().substring(0, 7)

function makeDefaultForm() {
  return {
    date: new Date().toISOString().split('T')[0],
    item: PRESET_EXPENSES[0],
    customItem: '',
    amount: '',
    remark: '',
    account: '淑華代收付',
    isPrepaid: false,
    startPeriod: currentMonth,
    endPeriod: currentMonth,
  }
}

const formData = ref(makeDefaultForm())
const isCustom = ref(false)
const selectedItem = ref(PRESET_EXPENSES[0])

watch(editingRecord, (ed) => {
  if (ed) {
    const isPreset = PRESET_EXPENSES.includes(ed.item)
    formData.value = {
      date: ed.date,
      item: isPreset ? ed.item : 'CUSTOM',
      customItem: isPreset ? '' : ed.item,
      amount: ed.amount,
      remark: ed.remark || '',
      account: ed.account || '淑華代收付',
      isPrepaid: !!(ed.startPeriod && ed.endPeriod),
      startPeriod: ed.startPeriod || currentMonth,
      endPeriod: ed.endPeriod || currentMonth,
    }
    selectedItem.value = isPreset ? ed.item : 'CUSTOM'
    isCustom.value = !isPreset
  }
}, { immediate: true })

function handleItemChange(val) {
  if (val === 'CUSTOM') {
    isCustom.value = true
    formData.value.item = 'CUSTOM'
  } else {
    isCustom.value = false
    formData.value.item = val
  }
}

function handleStartPeriodChange(val) {
  formData.value.startPeriod = val
  if (val > formData.value.endPeriod) formData.value.endPeriod = val
}

async function handleSubmit() {
  const finalItem = isCustom.value ? formData.value.customItem : formData.value.item
  if (!finalItem || !formData.value.amount) return
  const payload = {
    ...formData.value,
    item: finalItem,
    type: 'expense',
    startPeriod: formData.value.isPrepaid ? formData.value.startPeriod : null,
    endPeriod: formData.value.isPrepaid ? formData.value.endPeriod : null,
  }
  if (editingRecord.value) {
    await updateRecord(editingRecord.value.id, payload)
  } else {
    await addRecord(payload)
    resetForm()
  }
}

async function handleDelete() {
  if (editingRecord.value) await deleteRecord(editingRecord.value.id)
}

function resetForm() {
  formData.value = makeDefaultForm()
  selectedItem.value = PRESET_EXPENSES[0]
  isCustom.value = false
}
</script>
