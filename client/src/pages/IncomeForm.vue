<template>
  <v-card class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-3 pa-sm-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="success">mdi-plus-circle</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">{{ editingRecord ? '編輯收入單' : '新增收入單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4">
      <v-alert v-if="!editingRecord" color="primary" variant="tonal" density="compact" icon="mdi-information" class="mb-3">
        <span class="text-caption">社費、代收等<strong>已開帳款</strong>請至「應收帳款」頁收款沖帳。此頁登錄利息、紅箱、捐款等<strong>非帳款收入</strong>，或直接收取的代收款。</span>
      </v-alert>

      <v-form @submit.prevent="handleSubmit">
        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field v-model="formData.date" label="收款日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-model="formData.occurredDate" label="發生日期（選填）" type="date"
              density="compact" variant="outlined" clearable
              hint="權責歸屬月份與收款日不同時填寫" persistent-hint
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select
              v-model="formData.account"
              label="收款帳戶 / 經手人"
              :items="fundOptions"
              density="compact" variant="outlined" required
              hint="選經手人＝款項在其手上（其他應收款），存入銀行時再開內部轉帳單"
            />
          </v-col>
        </v-row>

        <v-select
          v-model="formData.accountCode"
          label="入帳科目"
          :items="acctOptions"
          density="compact" variant="outlined" required
          prepend-inner-icon="mdi-book-open-variant"
          class="mb-2"
          @update:model-value="handleAccountChange"
        />

        <v-text-field
          v-model="formData.item"
          label="摘要"
          placeholder="例如：授證紅箱、定存利息"
          density="compact" variant="outlined" required class="mb-2"
        />

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-autocomplete
              v-model="formData.member"
              label="社友姓名（選填）"
              :items="memberOptions"
              item-title="label" item-value="name"
              density="compact" variant="outlined" clearable
              prepend-inner-icon="mdi-account"
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-select
              v-model="formData.projectId"
              label="專案類別（選填）"
              :items="projectOptions"
              density="compact" variant="outlined" clearable
              prepend-inner-icon="mdi-folder-star-outline"
            />
          </v-col>
        </v-row>

        <!-- 平攤設定（預收性質收入 → 其他預收收入逐月轉列） -->
        <v-card v-if="isIncomeAccount" variant="tonal" color="success" class="pa-2 pa-sm-3 mb-3" rounded="lg">
          <v-checkbox
            v-model="formData.isPrepaid"
            label="此筆為「跨月份平攤」收入（預收性質，逐月認列）"
            color="success" density="compact" hide-details
          />
          <div v-if="formData.isPrepaid" class="mt-3">
            <v-row dense align="center">
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">認列開始</label>
                <v-text-field v-model="formData.startPeriod" type="month" density="compact" variant="outlined" hide-details required @update:model-value="handleStartPeriodChange" />
              </v-col>
              <v-col cols="2" class="text-center"><v-icon>mdi-arrow-right</v-icon></v-col>
              <v-col cols="5">
                <label class="text-caption text-medium-emphasis d-block mb-1">認列結束</label>
                <v-text-field v-model="formData.endPeriod" type="month" density="compact" variant="outlined" hide-details required />
              </v-col>
            </v-row>
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
import Swal from 'sweetalert2'
import {
  incomeAccountOptions, buildFundAccountOptions, normalizeFundValue,
  resolveRecordAccount, accountTitle, BANK_NAME,
} from '../accounting/coa.js'

const members = inject('members')
const accounts = inject('accounts')
const projects = inject('projects')
const editingRecord = inject('editingRecord')
const addRecord = inject('addRecord')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')

const currentMonth = new Date().toISOString().substring(0, 7)

const acctOptions = computed(() => incomeAccountOptions(accounts?.value))
const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))
const projectOptions = computed(() =>
  (projects?.value || []).filter(p => p.active).map(p => ({ title: p.name, value: p.id }))
)
const memberOptions = computed(() => [
  { name: '其他', label: '其他（非社友收入 / 外部入帳）' },
  ...(members.value || []).map(m => ({ name: m.name, label: `${m.name} ${m.nickname || ''} ${m.jobTitle1 ? '·' + m.jobTitle1 : ''}` })),
])

// 只有「收入科目」可平攤（代收款/暫收本來就不認列收入）
const isIncomeAccount = computed(() => (formData.value.accountCode || '').startsWith('4'))

function makeDefaultForm() {
  return {
    date: new Date().toISOString().split('T')[0],
    occurredDate: null,
    accountCode: '4102',
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
  // 摘要空白或原為科目名時，自動帶入新科目名稱
  const name = accountTitle(accounts?.value, code).replace(/^\d+\s*/, '')
  const prevIsAuto = !formData.value.item ||
    (accounts?.value || []).some(a => a.name === formData.value.item)
  if (prevIsAuto) formData.value.item = name
  if (!isIncomeAccount.value) formData.value.isPrepaid = false
}

function handleStartPeriodChange(val) {
  formData.value.startPeriod = val
  if (val > formData.value.endPeriod) formData.value.endPeriod = val
}

async function handleSubmit() {
  if (!formData.value.accountCode) {
    Swal.fire({ icon: 'warning', title: '請選擇入帳科目', confirmButtonColor: '#4f46e5' })
    return
  }
  if (!formData.value.item || !formData.value.amount) return
  const usePrepaid = isIncomeAccount.value && formData.value.isPrepaid
  const payload = {
    type: 'income',
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
