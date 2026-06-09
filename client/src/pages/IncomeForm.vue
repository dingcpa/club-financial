<template>
  <v-card class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-3 pa-sm-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="success">mdi-plus-circle</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">{{ editingRecord ? '編輯收入單' : '其他收入登錄' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4">
      <v-alert v-if="!editingRecord" color="primary" variant="tonal" density="compact" icon="mdi-information" class="mb-3">
        <span class="text-caption">社費、代收等<strong>帳款型收入</strong>請至「應收帳款」頁批次產生並收款。此頁僅登錄利息、紅箱、捐款等<strong>非帳款收入</strong>。</span>
      </v-alert>

      <v-form @submit.prevent="handleSubmit">
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field v-model="formData.date" label="收費日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select v-model="formData.account" label="收款人" :items="ACCOUNTS" density="compact" variant="outlined" required />
          </v-col>
        </v-row>

        <!-- 社友選擇（選填） -->
        <v-autocomplete
          v-model="formData.member"
          label="社友姓名（選填）"
          :items="memberOptions"
          item-title="label"
          item-value="name"
          density="compact"
          variant="outlined"
          clearable
          prepend-inner-icon="mdi-account"
          class="mb-2"
        />

        <v-select
          v-model="selectedItem"
          label="項目名稱"
          :items="[...allPresetItems, 'CUSTOM']"
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
          density="compact"
          variant="outlined"
          required
          class="mb-2"
        />

        <!-- 平攤設定 -->
        <v-card variant="tonal" color="success" class="pa-2 pa-sm-3 mb-3" rounded="lg">
          <v-checkbox
            v-model="formData.isPrepaid"
            label="此筆為「跨月份平攤」收入（預收性質）"
            color="success"
            density="compact"
            hide-details
          />
          <div v-if="formData.isPrepaid" class="mt-3">
            <v-row dense align="center">
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">認列開始</label>
                <v-text-field v-model="formData.startPeriod" type="month" density="compact" variant="outlined" hide-details required @update:model-value="handleStartPeriodChange" />
              </v-col>
              <v-col cols="2" class="text-center">
                <v-icon>mdi-arrow-right</v-icon>
              </v-col>
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">認列結束</label>
                <v-text-field v-model="formData.endPeriod" type="month" density="compact" variant="outlined" hide-details required />
              </v-col>
            </v-row>
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
          class="mb-3"
        />

        <div class="d-flex flex-wrap ga-2">
          <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" class="flex-grow-1">
            {{ editingRecord ? '更新收入' : '儲存收入' }}
          </v-btn>
          <v-btn v-if="editingRecord" color="error" variant="flat" prepend-icon="mdi-delete" @click="handleDelete">刪除</v-btn>
          <v-btn v-if="editingRecord" variant="tonal" @click="handleCancelEdit">取消</v-btn>
        </div>
      </v-form>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, watch, inject } from 'vue'

const members = inject('members')
const duesSettings = inject('duesSettings')
const editingRecord = inject('editingRecord')
const addRecord = inject('addRecord')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')

const ACCOUNTS = ['淑華代收付', '一銀帳戶', '社長代收付']
const currentMonth = new Date().toISOString().substring(0, 7)

const OTHER_ITEMS = ['授證紅箱', '交接紅箱', '例會歡喜紅箱', '其他紅箱', '其他收入-利息收入', '其他收入-其他']

// 預設項目：保留社費類別以相容既有紀錄編輯，但新增請以「其他收入」為主
const allPresetItems = computed(() => [
  ...(duesSettings.value || []).map(s => s.category),
  ...OTHER_ITEMS
])

function getAutoPeriod(item) {
  if (item === '1-3月社費') return { start: '01', end: '03' }
  if (item === '4-6月社費') return { start: '04', end: '06' }
  if (item === '7-9月社費') return { start: '07', end: '09' }
  if (item === '10-12月社費') return { start: '10', end: '12' }
  if (item === '總半年費(1-6)') return { start: '01', end: '06' }
  if (item === '總半年費(7-12)') return { start: '07', end: '12' }
  return null
}

const initialDate = new Date().toISOString().split('T')[0]
const initialYear = initialDate.split('-')[0]

function makeDefaultForm() {
  const defaultItem = OTHER_ITEMS[0] || ''
  return {
    date: initialDate,
    item: defaultItem,
    customItem: '',
    member: '',
    account: '淑華代收付',
    amount: '',
    remark: '',
    isPrepaid: false,
    startPeriod: currentMonth,
    endPeriod: currentMonth,
  }
}

const formData = ref(makeDefaultForm())
const isCustom = ref(false)
const selectedItem = ref(formData.value.item)

const memberOptions = computed(() => [
  { name: '其他', label: '其他（非社友收入 / 外部入帳）' },
  ...(members.value || []).map(m => ({ name: m.name, label: `${m.name} ${m.nickname || ''} ${m.jobTitle1 ? '·' + m.jobTitle1 : ''}` }))
])

// 監聽 editingRecord 變化
watch(editingRecord, (ed) => {
  if (ed) {
    const isPreset = allPresetItems.value.includes(ed.item)
    formData.value = {
      date: ed.date,
      item: isPreset ? ed.item : 'CUSTOM',
      customItem: isPreset ? '' : ed.item,
      member: ed.member || '',
      account: ed.account || '淑華代收付',
      amount: ed.amount,
      remark: ed.remark || '',
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
    formData.value.isPrepaid = false
    return
  }
  isCustom.value = false
  formData.value.item = val
  const year = formData.value.date.split('-')[0]
  const auto = getAutoPeriod(val)
  const setting = (duesSettings.value || []).find(s => s.category === val)
  if (setting && setting.standardAmount > 0) formData.value.amount = setting.standardAmount
  if (auto) {
    formData.value.isPrepaid = true
    formData.value.startPeriod = `${year}-${auto.start}`
    formData.value.endPeriod = `${year}-${auto.end}`
  } else {
    formData.value.isPrepaid = false
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
    member: formData.value.member || '',
    type: 'income',
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
  selectedItem.value = formData.value.item
  isCustom.value = false
}
</script>
