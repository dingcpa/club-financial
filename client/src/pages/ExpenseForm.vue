<template>
  <v-card class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-3 pa-sm-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="error">mdi-minus-circle</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">{{ editingRecord ? '編輯付款單' : '新增付款單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-btn v-else variant="tonal" size="small" prepend-icon="mdi-magnify" @click="setActiveTab('expense-list')">歷史單據</v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4">
      <v-form @submit.prevent="handleSubmit">
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field v-model="formData.date" label="支出日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="formData.occurredDate" label="發生日期（選填）" type="date"
              density="compact" variant="outlined" clearable
              hint="費用歸屬月份與付款日不同時填寫" persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select
              v-model="formData.account"
              label="付款帳戶 / 經手人"
              :items="fundOptions"
              density="compact" variant="outlined" required
              hint="選經手人＝由其代墊付款（其他應付款），歸墊時開調撥單"
            />
          </v-col>
        </v-row>

        <!-- 沖銷應付款（應付明細表立帳項目；勾選後由本付款單沖帳） -->
        <v-card
          v-if="!editingRecord && outstandingPayables.length"
          variant="outlined" class="pa-2 pa-sm-3 mb-3" rounded="lg"
        >
          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption font-weight-bold">沖銷應付款（{{ pickedPayables.length }} / {{ outstandingPayables.length }}）</span>
            <span v-if="pickedPayables.length" class="text-caption text-medium-emphasis">勾選合計 {{ pickedPayablesTotal.toLocaleString() }}</span>
          </div>
          <div style="max-height:180px;overflow-y:auto">
            <div v-for="p in outstandingPayables" :key="p.id" class="d-flex align-center ga-1">
              <v-checkbox-btn v-model="pickedPayables" :value="p.id" density="compact" />
              <span class="text-caption flex-grow-1">
                {{ p.sourceRef }}（{{ p.payee }}｜{{ p.dueDate || '未指定' }}）
                <v-chip v-if="p.status === 'partial'" size="x-small" color="warning" variant="tonal">已付 {{ (p.paidAmount || 0).toLocaleString() }}</v-chip>
              </span>
              <span class="text-caption font-weight-bold">{{ payableRemaining(p).toLocaleString() }}</span>
            </div>
          </div>
          <v-text-field
            v-if="pickedPayables.length"
            v-model="payAmount" label="實付金額 (NT$)" type="number"
            density="compact" variant="outlined" hide-details class="mt-2"
            hint="低於勾選合計時，依序沖抵、尾筆列部分付款"
          />
          <div v-if="pickedPayables.length" class="text-caption text-medium-emphasis mt-1">
            沖帳分錄：借 應付帳款／貸 付款帳戶（費用已於立帳時認列）。下方支出欄位可留空，或另填直接支出一併儲存。
          </div>
        </v-card>

        <v-select
          v-model="formData.accountCode"
          label="支出科目"
          :items="acctOptions"
          density="compact" variant="outlined" :required="!pickedPayables.length"
          prepend-inner-icon="mdi-book-open-variant"
          class="mb-2"
          @update:model-value="handleAccountChange"
        />

        <v-text-field
          v-model="formData.item"
          label="摘要"
          placeholder="例如：7月例會餐費、講師車馬費"
          density="compact" variant="outlined" required class="mb-2"
        />

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-autocomplete
              v-model="formData.member"
              label="社友姓名（選填，受款/歸屬對象）"
              :items="memberOptions"
              item-title="label" item-value="name"
              density="compact" variant="outlined" clearable
              prepend-inner-icon="mdi-account"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="formData.projectId"
              label="活動（選填）"
              :items="projectOptions"
              density="compact" variant="outlined" clearable
              prepend-inner-icon="mdi-folder-star-outline"
            />
          </v-col>
        </v-row>

        <!-- 平攤設定（預付性質費用 → 預付費用逐月攤銷） -->
        <v-card v-if="isExpenseAccount" variant="outlined" class="pa-2 pa-sm-3 mb-3" rounded="lg">
          <v-checkbox
            v-model="formData.isPrepaid"
            label="此筆為「跨月份平攤」費用（預付性質，逐月攤銷）"
            color="primary" density="compact" hide-details
          />
          <div v-if="formData.isPrepaid" class="mt-3">
            <v-row dense align="center">
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">開始年月</label>
                <v-text-field v-model="formData.startPeriod" type="month" density="compact" variant="outlined" hide-details required @update:model-value="handleStartPeriodChange" />
              </v-col>
              <v-col cols="2" class="text-center"><v-icon>mdi-arrow-right</v-icon></v-col>
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">結束年月</label>
                <v-text-field v-model="formData.endPeriod" type="month" density="compact" variant="outlined" hide-details required />
              </v-col>
            </v-row>
            <div class="text-caption text-medium-emphasis font-italic mt-2">
              系統將依照你選擇的年月區間，自動將總金額平均攤銷至各月報表。
            </div>
          </div>
        </v-card>

        <v-text-field
          v-model="formData.amount"
          label="金額 (NT$)" type="number"
          density="compact" variant="outlined" required class="mb-2"
        />

        <v-textarea
          v-model="formData.remark" label="備註" rows="3"
          density="compact" variant="outlined" class="mb-3"
        />

        <AttachmentPanel v-model="pendingAttachments" ref-type="finance" :ref-id="editingRecord?.id || null" />

        <div class="d-flex flex-wrap ga-2">
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
import { ref, computed, watch, inject } from 'vue'
import Swal from 'sweetalert2'
import {
  expenseAccountOptions, buildFundAccountOptions, normalizeFundValue,
  resolveRecordAccount, accountTitle, BANK_NAME,
} from '../accounting/coa.js'
import AttachmentPanel from '../components/AttachmentPanel.vue'

const members = inject('members')
const accounts = inject('accounts')
const projects = inject('projects')
const editingRecord = inject('editingRecord')
const addRecord = inject('addRecord')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')
const setActiveTab = inject('setActiveTab')
const payables = inject('payables')
const fetchPayables = inject('fetchPayables')
const settlePayablesBatch = inject('settlePayablesBatch')
const fetchRecords = inject('fetchRecords')

const currentMonth = new Date().toISOString().substring(0, 7)

const acctOptions = computed(() => expenseAccountOptions(accounts?.value))
const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))
const projectOptions = computed(() =>
  (projects?.value || []).filter(p => p.active).map(p => ({ title: p.name, value: p.id }))
)
const memberOptions = computed(() =>
  (members.value || []).map(m => ({ name: m.name, label: `${m.name} ${m.nickname || ''} ${m.jobTitle1 ? '·' + m.jobTitle1 : ''}` }))
)

// 只有「費用科目」可平攤（代收款付出不影響餘絀）
const isExpenseAccount = computed(() => (formData.value.accountCode || '').startsWith('5'))

// ── 沖銷應付款 ──
const pickedPayables = ref([])
const payAmount = ref('')

function payableRemaining(p) {
  const paid = p.status === 'partial' ? (p.paidAmount || 0) : 0
  return Math.round((p.amount - paid) * 100) / 100
}
const outstandingPayables = computed(() =>
  (payables?.value || [])
    .filter(p => p.status === 'pending' || p.status === 'partial')
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
)
const pickedPayablesTotal = computed(() => {
  const ids = new Set(pickedPayables.value)
  return Math.round(outstandingPayables.value
    .filter(p => ids.has(p.id))
    .reduce((s, p) => s + payableRemaining(p), 0) * 100) / 100
})
watch(pickedPayablesTotal, (v) => { payAmount.value = v ? String(v) : '' })

function makeDefaultForm() {
  return {
    date: new Date().toISOString().split('T')[0],
    occurredDate: null,
    accountCode: null,
    item: '',
    member: '',
    projectId: null,
    account: BANK_NAME,
    amount: '',
    remark: '',
    isPrepaid: false,
    startPeriod: currentMonth,
    endPeriod: currentMonth,
  }
}

const formData = ref(makeDefaultForm())
const pendingAttachments = ref([])

watch(editingRecord, (ed) => {
  if (ed) {
    formData.value = {
      date: ed.date,
      occurredDate: ed.occurredDate || null,
      accountCode: ed.accountCode || resolveRecordAccount(ed) || null,
      item: ed.item,
      member: ed.member || '',
      projectId: ed.projectId || null,
      account: normalizeFundValue(ed.account),
      amount: ed.amount,
      remark: ed.remark || '',
      isPrepaid: !!(ed.startPeriod && ed.endPeriod),
      startPeriod: ed.startPeriod || currentMonth,
      endPeriod: ed.endPeriod || currentMonth,
    }
  }
}, { immediate: true })

function handleAccountChange(code) {
  const name = accountTitle(accounts?.value, code).replace(/^\d+\s*/, '')
  const prevIsAuto = !formData.value.item ||
    (accounts?.value || []).some(a => a.name === formData.value.item)
  if (prevIsAuto) formData.value.item = name
  if (!isExpenseAccount.value) formData.value.isPrepaid = false
}

function handleStartPeriodChange(val) {
  formData.value.startPeriod = val
  if (val > formData.value.endPeriod) formData.value.endPeriod = val
}

async function handleSubmit() {
  const hasDirect = !!(formData.value.accountCode && formData.value.item && parseFloat(formData.value.amount))
  // 新增模式：可只沖應付款、只直接支出、或兩者並存
  if (!editingRecord.value && !hasDirect && pickedPayables.value.length) {
    if ((parseFloat(payAmount.value) || 0) <= 0) {
      Swal.fire({ icon: 'warning', title: '請輸入實付金額', confirmButtonColor: '#4f46e5' })
      return
    }
    await settlePicked()
    return
  }
  if (!formData.value.accountCode) {
    Swal.fire({ icon: 'warning', title: '請選擇支出科目，或勾選要沖銷的應付款', confirmButtonColor: '#4f46e5' })
    return
  }
  if (!formData.value.item || !formData.value.amount) return
  const usePrepaid = isExpenseAccount.value && formData.value.isPrepaid
  const payload = {
    type: 'expense',
    date: formData.value.date,
    occurredDate: formData.value.occurredDate || null,
    item: formData.value.item,
    member: formData.value.member || '',
    account: formData.value.account,
    accountCode: formData.value.accountCode,
    projectId: formData.value.projectId || null,
    amount: formData.value.amount,
    remark: formData.value.remark,
    startPeriod: usePrepaid ? formData.value.startPeriod : null,
    endPeriod: usePrepaid ? formData.value.endPeriod : null,
    attachments: pendingAttachments.value,
  }
  if (editingRecord.value) {
    await updateRecord(editingRecord.value.id, payload)
  } else {
    if (pickedPayables.value.length) await settlePicked({ silent: true })
    await addRecord(payload)
    formData.value = makeDefaultForm()
  }
  pendingAttachments.value = []
}

async function settlePicked({ silent = false } = {}) {
  try {
    const ids = new Set(pickedPayables.value)
    const payableIds = outstandingPayables.value.filter(p => ids.has(p.id)).map(p => p.id)
    const result = await settlePayablesBatch({
      date: formData.value.date,
      account: formData.value.account,
      payableIds,
      paidAmount: parseFloat(payAmount.value) || 0,
      remark: formData.value.remark || '',
    })
    await Promise.all([fetchRecords(), fetchPayables()])
    pickedPayables.value = []
    payAmount.value = ''
    if (!silent) {
      const parts = [`沖銷應付款 <b>${result.settled.length}</b> 筆`]
      if (result.partialSettled?.length) parts.push(`部分付款 <b>${result.partialSettled.length}</b> 筆`)
      if (result.surplus > 0) parts.push(`實付超出 NT$ <b>${result.surplus.toLocaleString()}</b> 未分配`)
      Swal.fire({ icon: 'success', title: '付款單已儲存', html: parts.join('，'), confirmButtonColor: '#4f46e5' })
      formData.value = makeDefaultForm()
    }
  } catch (e) {
    Swal.fire({ icon: 'error', title: '沖帳失敗', text: e.message, confirmButtonColor: '#ef4444' })
    throw e
  }
}

async function handleDelete() {
  if (editingRecord.value) await deleteRecord(editingRecord.value.id)
}
</script>
