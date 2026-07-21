<template>
  <v-card class="mx-auto" elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-3 pa-sm-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="success">mdi-plus-circle</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">{{ editingRecord ? '編輯收款單' : '新增收款單' }}</span>
      </div>
      <v-btn v-if="editingRecord" icon variant="tonal" size="small" @click="handleCancelEdit">
        <v-icon>mdi-close</v-icon>
      </v-btn>
      <v-btn v-else variant="tonal" size="small" prepend-icon="mdi-magnify" @click="setActiveTab('income-list')">歷史單據</v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4">
      <!-- ══════════ 新增模式：兩用表單（沖銷帳款＋直接認列收入） ══════════ -->
      <v-form v-if="!editingRecord" @submit.prevent="handleSubmit">
        <v-alert color="primary" variant="tonal" density="compact" icon="mdi-information" class="mb-3">
          <span class="text-caption">選擇社友可帶出其<strong>未收帳款</strong>勾選沖銷（不重複認列收入）；利息、紅箱、捐款等非帳款收入請在下方「直接認列收入」加列。同一張單可混搭。</span>
        </v-alert>

        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field v-model="formData.date" label="收款日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="12" sm="4">
            <v-select
              v-model="formData.account"
              label="收款帳戶 / 經手人"
              :items="fundOptions"
              density="compact" variant="outlined" required
              hint="選經手人＝款項在其手上（其他應收款），存入銀行時再開調撥單"
            />
          </v-col>
          <v-col cols="12" sm="4">
            <v-autocomplete
              v-model="formData.member"
              label="社友姓名（選填）"
              :items="memberOptions"
              item-title="label" item-value="name"
              density="compact" variant="outlined" clearable
              prepend-inner-icon="mdi-account"
            />
          </v-col>
        </v-row>

        <!-- 沖銷未收帳款 -->
        <v-card v-if="isRealMember" variant="outlined" class="mb-3" rounded="lg">
          <v-card-title class="text-subtitle-2 font-weight-bold py-2 px-3 bg-indigo-lighten-5">
            <v-icon size="small" class="mr-1">mdi-file-document-check</v-icon>
            {{ formData.member }} 的未收帳款
            <v-progress-circular v-if="outLoading" indeterminate size="16" width="2" class="ml-2" />
          </v-card-title>
          <v-card-text class="pa-2 pa-sm-3">
            <div v-if="!outLoading && !outstanding.length" class="text-caption text-medium-emphasis text-center pa-2">
              無未收帳款
            </div>
            <template v-else>
              <div v-for="r in outstanding" :key="r.id" class="d-flex align-center ga-1">
                <v-checkbox-btn v-model="picked" :value="r.id" density="compact" />
                <span class="text-body-2 flex-grow-1">
                  {{ r.sourceRef }}
                  <span class="text-caption text-medium-emphasis">（到期 {{ r.dueDate || '未指定' }}）</span>
                  <v-chip v-if="r.status === 'partial'" size="x-small" color="warning" variant="tonal">已收 {{ (r.paidAmount || 0).toLocaleString() }}</v-chip>
                </span>
                <span class="text-body-2 font-weight-bold">{{ remainingOf(r).toLocaleString() }}</span>
              </div>
              <v-row v-if="picked.length" dense class="mt-2" align="center">
                <v-col cols="12" sm="5">
                  <v-text-field
                    v-model="settleAmount" label="實收金額 (NT$)" type="number"
                    density="compact" variant="outlined" hide-details
                  />
                </v-col>
                <v-col cols="12" sm="7" class="text-caption">
                  <span v-if="Math.abs(settleAmountNum - pickedTotal) < 0.5">與勾選合計 {{ pickedTotal.toLocaleString() }} 吻合</span>
                  <span v-else-if="settleAmountNum < pickedTotal" class="text-warning">不足 {{ (pickedTotal - settleAmountNum).toLocaleString() }}，尾筆將列部分收款</span>
                  <span v-else class="text-warning">溢收 {{ (settleAmountNum - pickedTotal).toLocaleString() }} 將掛暫收款</span>
                </v-col>
              </v-row>
            </template>
          </v-card-text>
        </v-card>

        <!-- 直接認列收入 -->
        <v-card variant="outlined" class="mb-3" rounded="lg">
          <v-card-title class="d-flex align-center text-subtitle-2 font-weight-bold py-2 px-3 bg-green-lighten-5">
            <v-icon size="small" class="mr-1">mdi-cash-plus</v-icon>
            直接認列收入
            <v-spacer />
            <v-btn size="x-small" variant="tonal" color="success" prepend-icon="mdi-plus" @click="incomeLines.push(makeLine())">加一列</v-btn>
          </v-card-title>
          <v-card-text class="pa-2 pa-sm-3">
            <div v-for="(ln, i) in incomeLines" :key="i" class="mb-2">
              <v-row dense align="center">
                <v-col cols="12" sm="3">
                  <v-select
                    v-model="ln.accountCode" label="入帳科目" :items="acctOptions"
                    density="compact" variant="outlined" hide-details
                    @update:model-value="handleLineAccountChange(ln)"
                  />
                </v-col>
                <v-col cols="12" sm="3">
                  <v-text-field v-model="ln.item" label="摘要" placeholder="例如：授證紅箱、定存利息" density="compact" variant="outlined" hide-details />
                </v-col>
                <v-col cols="6" sm="2">
                  <v-text-field v-model="ln.amount" label="金額" type="number" density="compact" variant="outlined" hide-details />
                </v-col>
                <v-col cols="6" sm="2">
                  <v-select v-model="ln.projectId" label="活動" :items="projectOptions" density="compact" variant="outlined" hide-details clearable />
                </v-col>
                <v-col cols="10" sm="1">
                  <v-text-field v-model="ln.occurredDate" label="發生日" type="date" density="compact" variant="outlined" hide-details clearable />
                </v-col>
                <v-col cols="2" sm="1" class="text-center">
                  <v-btn icon size="x-small" variant="text" color="error" @click="incomeLines.splice(i, 1)">
                    <v-icon>mdi-close</v-icon>
                  </v-btn>
                </v-col>
              </v-row>
            </div>
            <div v-if="!incomeLines.length" class="text-caption text-medium-emphasis text-center pa-2">無直接收入項目（僅沖銷帳款）</div>
          </v-card-text>
        </v-card>

        <!-- 合計 -->
        <v-alert color="success" variant="tonal" density="compact" class="mb-3">
          <div class="d-flex flex-wrap justify-space-between text-body-2">
            <span>沖銷帳款 {{ (picked.length ? settleAmountNum : 0).toLocaleString() }}</span>
            <span>＋ 直接收入 {{ directTotal.toLocaleString() }}</span>
            <span class="font-weight-bold">＝ 本次收款 NT$ {{ grandTotal.toLocaleString() }}</span>
          </div>
        </v-alert>

        <v-textarea
          v-model="formData.remark" label="備註" rows="2"
          density="compact" variant="outlined" class="mb-3"
        />

        <AttachmentPanel v-model="pendingAttachments" ref-type="finance" :ref-id="null" />

        <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" block :loading="saving">
          儲存收款單
        </v-btn>
      </v-form>

      <!-- ══════════ 編輯模式：維持單筆編輯 ══════════ -->
      <v-form v-else @submit.prevent="handleSubmit">
        <v-alert v-if="isCollectionRecord" color="info" variant="tonal" density="compact" icon="mdi-link-variant" class="mb-3">
          <span class="text-caption">此為<strong>收款沖帳</strong>紀錄（沖銷應收帳款），僅可修改日期、收款帳戶與備註；金額或項目異動請刪除後重新收款。</span>
        </v-alert>

        <v-row dense>
          <v-col cols="12" sm="4">
            <v-text-field v-model="formData.date" label="收款日期" type="date" density="compact" variant="outlined" required />
          </v-col>
          <v-col cols="12" sm="4">
            <v-text-field
              v-if="!isCollectionRecord"
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
            />
          </v-col>
        </v-row>

        <template v-if="!isCollectionRecord">
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
                label="活動（選填）"
                :items="projectOptions"
                density="compact" variant="outlined" clearable
                prepend-inner-icon="mdi-folder-star-outline"
              />
            </v-col>
          </v-row>

          <!-- 舊制跨月分攤單：期間唯讀保留，避免更新時洗掉歷史分攤 -->
          <v-alert v-if="hasLegacyPeriod" color="warning" variant="tonal" density="compact" icon="mdi-calendar-range" class="mb-3">
            <span class="text-caption">此單為舊制<strong>跨月分攤</strong>收入（{{ editingRecord.startPeriod }} ～ {{ editingRecord.endPeriod }} 逐月轉列），期間維持不變。新收款單已不提供此功能。</span>
          </v-alert>

          <v-text-field
            v-model="formData.amount"
            label="金額 (NT$)" type="number"
            density="compact" variant="outlined" required class="mb-2"
          />
        </template>

        <v-textarea
          v-model="formData.remark" label="備註" rows="3"
          density="compact" variant="outlined" class="mb-3"
        />

        <AttachmentPanel v-model="pendingAttachments" ref-type="finance" :ref-id="editingRecord?.id || null" />

        <div class="d-flex flex-wrap ga-2">
          <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" class="flex-grow-1">
            更新收款單
          </v-btn>
          <v-btn color="error" variant="flat" prepend-icon="mdi-delete" @click="handleDelete">刪除</v-btn>
          <v-btn variant="tonal" @click="handleCancelEdit">取消</v-btn>
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
import { apiFetch } from '../composables/apiFetch.js'
import AttachmentPanel from '../components/AttachmentPanel.vue'

const members = inject('members')
const accounts = inject('accounts')
const projects = inject('projects')
const editingRecord = inject('editingRecord')
const updateRecord = inject('updateRecord')
const deleteRecord = inject('deleteRecord')
const handleCancelEdit = inject('handleCancelEdit')
const setActiveTab = inject('setActiveTab')
const fetchRecords = inject('fetchRecords')
const fetchReceivables = inject('fetchReceivables')
const fetchOutstanding = inject('fetchOutstanding')
const settleBatch = inject('settleBatch')
const fetchAttachmentsMeta = inject('fetchAttachmentsMeta')

const acctOptions = computed(() => incomeAccountOptions(accounts?.value))
const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))
const projectOptions = computed(() =>
  (projects?.value || []).filter(p => p.active).map(p => ({ title: p.name, value: p.id }))
)
const memberOptions = computed(() => [
  { name: '其他', label: '其他（非社友收入 / 外部入帳）' },
  ...(members.value || []).map(m => ({ name: m.name, label: `${m.name} ${m.nickname || ''} ${m.jobTitle1 ? '·' + m.jobTitle1 : ''}` })),
])

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
  }
}
function makeLine() {
  return { accountCode: '4102', item: '', amount: '', projectId: null, occurredDate: null }
}

const formData = ref(makeDefaultForm())
const incomeLines = ref([makeLine()])
const pendingAttachments = ref([])
const saving = ref(false)

// ── 沖銷未收帳款 ──
const outstanding = ref([])
const outLoading = ref(false)
const picked = ref([])
const settleAmount = ref('')

const isRealMember = computed(() => !!formData.value.member && formData.value.member !== '其他')
function remainingOf(r) {
  return Math.round((r.amount - (r.paidAmount || 0)) * 100) / 100
}
const pickedTotal = computed(() => {
  const ids = new Set(picked.value)
  return Math.round(outstanding.value
    .filter(r => ids.has(r.id))
    .reduce((s, r) => s + remainingOf(r), 0) * 100) / 100
})
const settleAmountNum = computed(() => parseFloat(settleAmount.value) || 0)
const directTotal = computed(() => Math.round(incomeLines.value
  .reduce((s, ln) => s + (parseFloat(ln.amount) || 0), 0) * 100) / 100)
const grandTotal = computed(() =>
  Math.round(((picked.value.length ? settleAmountNum.value : 0) + directTotal.value) * 100) / 100)

watch(() => (editingRecord.value ? null : formData.value.member), async (name) => {
  picked.value = []
  outstanding.value = []
  if (!name || name === '其他') return
  outLoading.value = true
  try {
    const rows = await fetchOutstanding(name)
    outstanding.value = Array.isArray(rows) ? rows : []
  } finally {
    outLoading.value = false
  }
})
// 勾選變動 → 實收金額預設帶勾選剩餘合計（可再下修）
watch(pickedTotal, (v) => { settleAmount.value = v ? String(v) : '' })

// ── 編輯模式 ──
const isCollectionRecord = computed(() => !!editingRecord.value?.sourceReceivableId)
const hasLegacyPeriod = computed(() => !!(editingRecord.value?.startPeriod && editingRecord.value?.endPeriod))

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
    }
  } else {
    formData.value = makeDefaultForm()
    incomeLines.value = [makeLine()]
    picked.value = []
    outstanding.value = []
  }
}, { immediate: true })

function handleAccountChange(code) {
  const name = accountTitle(accounts?.value, code).replace(/^\d+\s*/, '')
  const prevIsAuto = !formData.value.item ||
    (accounts?.value || []).some(a => a.name === formData.value.item)
  if (prevIsAuto) formData.value.item = name
}

function handleLineAccountChange(ln) {
  const name = accountTitle(accounts?.value, ln.accountCode).replace(/^\d+\s*/, '')
  const prevIsAuto = !ln.item || (accounts?.value || []).some(a => a.name === ln.item)
  if (prevIsAuto) ln.item = name
}

async function postFinance(payload) {
  const res = await apiFetch('/api/finance', { method: 'POST', body: JSON.stringify(payload) })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '儲存失敗')
  return data
}

async function handleSubmit() {
  // ── 編輯模式 ──
  if (editingRecord.value) {
    const ed = editingRecord.value
    const payload = isCollectionRecord.value
      ? { // 收款沖帳單只放行日期/帳戶/備註
          date: formData.value.date,
          account: formData.value.account,
          remark: formData.value.remark,
          attachments: pendingAttachments.value,
        }
      : {
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
          // 舊制跨月分攤期間原樣保留，避免更新洗掉歷史分攤
          startPeriod: ed.startPeriod || null,
          endPeriod: ed.endPeriod || null,
          attachments: pendingAttachments.value,
        }
    await updateRecord(ed.id, payload)
    pendingAttachments.value = []
    return
  }

  // ── 新增模式：沖銷＋直接收入 ──
  const validLines = incomeLines.value.filter(ln => ln.accountCode && ln.item && parseFloat(ln.amount))
  const halfFilled = incomeLines.value.some(ln =>
    (ln.item || parseFloat(ln.amount)) && !(ln.accountCode && ln.item && parseFloat(ln.amount)))
  if (halfFilled) {
    Swal.fire({ icon: 'warning', title: '直接收入列請填齊科目、摘要與金額', confirmButtonColor: '#4f46e5' })
    return
  }
  if (!picked.value.length && !validLines.length) {
    Swal.fire({ icon: 'warning', title: '請勾選要沖銷的帳款，或填寫直接收入項目', confirmButtonColor: '#4f46e5' })
    return
  }
  if (picked.value.length && settleAmountNum.value <= 0) {
    Swal.fire({ icon: 'warning', title: '請輸入實收金額', confirmButtonColor: '#4f46e5' })
    return
  }

  saving.value = true
  try {
    let settleResult = null
    if (picked.value.length) {
      const ids = new Set(picked.value)
      const receivableIds = outstanding.value.filter(r => ids.has(r.id)).map(r => r.id)
      settleResult = await settleBatch({
        memberName: formData.value.member,
        date: formData.value.date,
        account: formData.value.account,
        receivableIds,
        receivedAmount: settleAmountNum.value,
        prevOverpayment: 0,
        remark: formData.value.remark || '',
      })
      if (settleResult?.error) throw new Error(settleResult.error)
    }

    for (let i = 0; i < validLines.length; i++) {
      const ln = validLines[i]
      await postFinance({
        type: 'income',
        date: formData.value.date,
        occurredDate: ln.occurredDate || null,
        item: ln.item,
        member: formData.value.member || '',
        account: formData.value.account,
        accountCode: ln.accountCode,
        projectId: ln.projectId || null,
        amount: ln.amount,
        remark: formData.value.remark || '',
        startPeriod: null,
        endPeriod: null,
        attachments: i === 0 ? pendingAttachments.value : [],
      })
    }

    await Promise.all([fetchRecords(), fetchReceivables()])
    if (pendingAttachments.value.length) fetchAttachmentsMeta()

    const parts = []
    if (settleResult) {
      parts.push(`沖銷帳款 <b>${settleResult.settled.length}</b> 筆`)
      if (settleResult.partialSettled?.length) parts.push(`部分收款 <b>${settleResult.partialSettled.length}</b> 筆`)
      if (settleResult.surplus > 0) parts.push(`溢收 NT$ <b>${settleResult.surplus.toLocaleString()}</b> 掛暫收款`)
    }
    if (validLines.length) parts.push(`直接收入 <b>${validLines.length}</b> 筆`)
    Swal.fire({
      icon: 'success', title: '收款單已儲存',
      html: parts.join('，'),
      confirmButtonColor: '#4f46e5',
    })

    const keepDate = formData.value.date
    const keepAccount = formData.value.account
    formData.value = { ...makeDefaultForm(), date: keepDate, account: keepAccount }
    incomeLines.value = [makeLine()]
    picked.value = []
    outstanding.value = []
    settleAmount.value = ''
    pendingAttachments.value = []
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (editingRecord.value) await deleteRecord(editingRecord.value.id)
}
</script>
