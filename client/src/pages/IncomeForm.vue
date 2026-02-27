<template>
  <v-card max-width="600" class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="success">mdi-plus-circle</v-icon>
        <span class="text-h6 font-weight-bold">{{ editingRecord ? '編輯收入單' : '填寫收入單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text>
      <v-form @submit.prevent="handleSubmit">
        <v-row>
          <v-col cols="6">
            <v-text-field v-model="formData.date" label="收費日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="6">
            <v-select v-model="formData.account" label="收款人" :items="ACCOUNTS" density="compact" variant="outlined" required />
          </v-col>
        </v-row>

        <!-- 社友選擇 -->
        <v-autocomplete
          v-model="formData.member"
          label="社友姓名（必填）"
          :items="memberOptions"
          item-title="label"
          item-value="name"
          density="compact"
          variant="outlined"
          clearable
          prepend-inner-icon="mdi-account"
          class="mb-2"
        />

        <!-- 批次待沖帳區塊 -->
        <v-card v-if="!editingRecord && outstandingDues.length > 0" variant="tonal" color="primary" class="mb-4 pa-3" rounded="lg">
          <div class="text-subtitle-2 font-weight-bold text-primary mb-3 d-flex align-center ga-1">
            <v-icon size="18">mdi-content-save</v-icon> 待沖帳項目（截至今日）
          </div>

          <v-row>
            <v-col :cols="prevOverpayment > 0 ? 6 : 12">
              <v-text-field
                v-model="receivedAmount"
                label="收款金額 (NT$)"
                type="number"
                min="0"
                density="compact"
                variant="outlined"
                required
              />
            </v-col>
            <v-col v-if="prevOverpayment > 0" cols="6">
              <v-card color="success" variant="tonal" class="pa-2 h-100 d-flex flex-column justify-center">
                <div class="text-caption text-medium-emphasis">前期溢收款餘額</div>
                <div class="text-body-1 font-weight-bold text-success">NT$ {{ prevOverpayment.toLocaleString() }}</div>
              </v-card>
            </v-col>
          </v-row>

          <v-card v-if="received > 0 || prevOverpayment > 0" variant="flat" color="primary" class="d-flex justify-space-between align-center pa-2 mb-2" rounded>
            <span class="text-caption">
              可用沖帳合計
              <span v-if="prevOverpayment > 0" class="text-caption">（含前期溢收款 {{ prevOverpayment.toLocaleString() }}）</span>
            </span>
            <span class="font-weight-bold text-primary">NT$ {{ totalAvailable.toLocaleString() }}</span>
          </v-card>

          <div class="d-flex flex-column ga-2">
            <v-card
              v-for="u in outstandingDues"
              :key="u.category"
              variant="outlined"
              :color="selectedDues.includes(u.category) ? 'primary' : undefined"
              class="pa-2"
              rounded
              style="cursor:pointer"
              @click="toggleDueSelection(u.category)"
            >
              <div class="d-flex justify-space-between align-center">
                <div class="d-flex align-center ga-2">
                  <v-checkbox-btn
                    :model-value="selectedDues.includes(u.category)"
                    color="primary"
                    density="compact"
                    @click.stop="toggleDueSelection(u.category)"
                  />
                  <div>
                    <div class="text-body-2 font-weight-medium">{{ u.category }}</div>
                    <div v-if="u.dueDate" class="text-caption text-medium-emphasis">應收日：{{ u.dueDate }}</div>
                  </div>
                </div>
                <div class="d-flex align-center ga-1">
                  <v-icon v-if="settlement && settlement.settled.some(s => s.category === u.category)" size="16" color="success">mdi-check-circle</v-icon>
                  <v-icon v-if="settlement && settlement.skipped.some(s => s.category === u.category)" size="16" color="warning">mdi-alert-circle</v-icon>
                  <span class="font-weight-bold" :class="getAmtClass(u.category)">NT$ {{ u.standardAmount.toLocaleString() }}</span>
                </div>
              </div>
            </v-card>
          </div>

          <!-- 沖帳預覽 -->
          <div v-if="settlement" class="mt-3 pt-3" style="border-top:1px dashed #cbd5e1">
            <div v-if="settlement.settled.length > 0" class="d-flex justify-space-between mb-1">
              <span class="text-success text-body-2">✅ 可沖清 {{ settlement.settled.length }} 項</span>
              <span class="font-weight-bold text-success">NT$ {{ settlement.settled.reduce((s, i) => s + i.standardAmount, 0).toLocaleString() }}</span>
            </div>
            <div v-if="settlement.skipped.length > 0" class="d-flex justify-space-between mb-1">
              <span class="text-warning text-body-2">⚠️ 金額不足，跳過 {{ settlement.skipped.length }} 項</span>
              <span class="font-weight-bold text-warning">NT$ {{ settlement.skipped.reduce((s, i) => s + i.standardAmount, 0).toLocaleString() }}</span>
            </div>
            <div v-if="settlement.surplus > 0" class="d-flex justify-space-between">
              <span class="text-primary text-body-2">💰 沖完後溢收款</span>
              <span class="font-weight-bold text-primary">NT$ {{ settlement.surplus.toLocaleString() }}</span>
            </div>
          </div>
        </v-card>

        <!-- 單筆模式 -->
        <template v-if="selectedDues.length === 0 || editingRecord">
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
          <v-card variant="tonal" color="success" class="pa-3 mb-3" rounded="lg">
            <v-checkbox
              v-model="formData.isPrepaid"
              label="此筆為「跨月份平攤」收入（預收性質）"
              color="success"
              density="compact"
              hide-details
            />
            <div v-if="formData.isPrepaid" class="mt-3">
              <v-row align="center">
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
        </template>

        <v-textarea
          v-model="formData.remark"
          label="備註"
          rows="3"
          density="compact"
          variant="outlined"
          class="mb-4"
        />

        <div class="d-flex ga-3">
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

const records = inject('records')
const members = inject('members')
const duesSettings = inject('duesSettings')
const editingRecord = inject('editingRecord')
const addRecord = inject('addRecord')
const addRecordsBatchAndGoToDues = inject('addRecordsBatchAndGoToDues')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')

const ACCOUNTS = ['淑華代收付', '一銀帳戶', '社長代收付']
const currentMonth = new Date().toISOString().substring(0, 7)

const OTHER_ITEMS = ['授證紅箱', '交接紅箱', '例會歡喜紅箱', '其他紅箱', '其他收入-利息收入', '其他收入-其他']

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
  const defaultItem = allPresetItems.value[0] || ''
  const auto = getAutoPeriod(defaultItem)
  return {
    date: initialDate,
    item: defaultItem,
    customItem: '',
    member: '',
    account: '淑華代收付',
    amount: '',
    remark: '',
    isPrepaid: !!auto,
    startPeriod: auto ? `${initialYear}-${auto.start}` : currentMonth,
    endPeriod: auto ? `${initialYear}-${auto.end}` : currentMonth,
  }
}

const formData = ref(makeDefaultForm())
const isCustom = ref(false)
const selectedItem = ref(formData.value.item)

const outstandingDues = ref([])
const selectedDues = ref([])
const receivedAmount = ref('')
const prevOverpayment = ref(0)

const received = computed(() => parseFloat(receivedAmount.value) || 0)
const totalAvailable = computed(() => received.value + prevOverpayment.value)

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

// 監聽社友+日期 → 計算待沖帳
watch([() => formData.value.member, () => formData.value.date], () => {
  if (!formData.value.member || editingRecord.value) {
    outstandingDues.value = []
    prevOverpayment.value = 0
    return
  }
  const selYear = formData.value.date.split('-')[0]
  const memberPayments = (records.value || []).filter(r =>
    r.type === 'income' && r.member === formData.value.member && r.date.startsWith(selYear)
  )
  const unpaid = (duesSettings.value || []).filter(setting => {
    const isDue = !setting.dueDate || setting.dueDate <= formData.value.date
    if (!isDue) return false
    return !memberPayments.some(p => p.item === setting.category)
  })
  outstandingDues.value = unpaid
  selectedDues.value = unpaid.map(u => u.category)

  const overpayments = (records.value || []).filter(r =>
    r.type === 'income' && r.member === formData.value.member && r.item === '溢收款'
  )
  const bal = overpayments.reduce((s, r) => s + (r.amount || 0), 0)
  prevOverpayment.value = bal > 0 ? bal : 0
})

// 監聽日期/項目 → 更新平攤區間（新增模式）
watch([() => formData.value.date, () => formData.value.item], () => {
  if (editingRecord.value) return
  const year = formData.value.date.split('-')[0]
  const auto = getAutoPeriod(formData.value.item)
  if (auto) {
    formData.value.isPrepaid = true
    formData.value.startPeriod = `${year}-${auto.start}`
    formData.value.endPeriod = `${year}-${auto.end}`
  }
})

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

function toggleDueSelection(cat) {
  const idx = selectedDues.value.indexOf(cat)
  if (idx >= 0) selectedDues.value.splice(idx, 1)
  else selectedDues.value.push(cat)
}

const settlement = computed(() => {
  if (editingRecord.value || selectedDues.value.length === 0) return null
  return computeSettlement()
})

function computeSettlement() {
  const rec = received.value
  const total = rec + prevOverpayment.value
  let remaining = total
  const settled = [], skipped = []
  const items = outstandingDues.value.filter(u => selectedDues.value.includes(u.category))
  for (const item of items) {
    if (remaining >= item.standardAmount) { settled.push(item); remaining -= item.standardAmount }
    else skipped.push(item)
  }
  return { settled, skipped, surplus: remaining }
}

function getAmtClass(cat) {
  if (!settlement.value) return 'text-primary'
  if (settlement.value.settled.some(s => s.category === cat)) return 'text-success'
  if (settlement.value.skipped.some(s => s.category === cat)) return 'text-warning'
  return 'text-primary'
}

async function handleSubmit() {
  if (!formData.value.member) {
    alert('請選擇社友姓名（非社友請選「其他」）')
    return
  }

  // 批次模式
  if (!editingRecord.value && selectedDues.value.length > 0) {
    const rec = received.value
    if (rec <= 0 && prevOverpayment.value <= 0) { alert('請輸入收款金額'); return }
    const { settled, surplus } = computeSettlement()
    if (settled.length === 0 && surplus === 0) { alert('收款金額不足以沖抵任何一筆應收項目，請確認金額是否正確。'); return }

    const selYear = formData.value.date.split('-')[0]
    const settledRecords = settled.map(u => {
      const auto = getAutoPeriod(u.category)
      return {
        type: 'income', date: formData.value.date, item: u.category,
        member: formData.value.member, account: formData.value.account,
        amount: u.standardAmount, remark: formData.value.remark,
        startPeriod: auto ? `${selYear}-${auto.start}` : null,
        endPeriod: auto ? `${selYear}-${auto.end}` : null,
      }
    })
    const extraRecords = []
    if (prevOverpayment.value > 0) {
      extraRecords.push({ type: 'income', date: formData.value.date, item: '溢收款', member: formData.value.member, account: formData.value.account, amount: -prevOverpayment.value, remark: '前期溢收款結清（沖抵本次收款計算）', startPeriod: null, endPeriod: null })
    }
    if (surplus > 0) {
      extraRecords.push({ type: 'income', date: formData.value.date, item: '溢收款', member: formData.value.member, account: formData.value.account, amount: surplus, remark: `溢收款（收款 ${rec.toLocaleString()}，超出已沖項目總額）`, startPeriod: null, endPeriod: null })
    }
    await addRecordsBatchAndGoToDues([...settledRecords, ...extraRecords])
    resetForm()
    return
  }

  // 單筆模式
  const finalItem = isCustom.value ? formData.value.customItem : formData.value.item
  if (!finalItem || !formData.value.amount) return
  const payload = {
    ...formData.value,
    item: finalItem,
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
  outstandingDues.value = []
  selectedDues.value = []
  receivedAmount.value = ''
  prevOverpayment.value = 0
}
</script>
