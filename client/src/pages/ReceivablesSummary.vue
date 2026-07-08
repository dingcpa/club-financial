<template>
  <div>
    <div v-if="recLoading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <!-- 標題列 -->
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-file-document-check</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">{{ toMinguoYear(selectedYear) }}年度 應收帳款總覽</span>
        </div>
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-btn color="primary" prepend-icon="mdi-playlist-plus" size="small" @click="openBatchModal">批次產生帳款</v-btn>
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-plus" size="small" @click="openCreateModal">單筆新增</v-btn>
          <v-autocomplete
            v-model="filterMember"
            label="篩選社友"
            :items="memberOptions"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="min-width:140px;max-width:200px"
          />
          <v-btn-toggle v-model="filterStatus" density="compact" variant="outlined" divided>
            <v-btn value="all" size="small">全部</v-btn>
            <v-btn value="unpaid" size="small" color="error">未收</v-btn>
            <v-btn value="paid" size="small" color="success">已收</v-btn>
            <v-btn value="waived" size="small" color="grey">免繳</v-btn>
          </v-btn-toggle>
          <v-select
            v-model="selectedYear"
            :items="availableYears"
            :item-title="y => toMinguoYear(y) + ' 年度'"
            :item-value="y => y"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:110px"
          />
        </div>
      </v-card-title>

      <!-- 年度總計摘要 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <v-row dense>
          <v-col cols="3">
            <v-card color="primary" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">總應收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-primary">NT$ {{ yearSummary.totalTarget.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">已收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-success">NT$ {{ yearSummary.totalPaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">未收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-error">NT$ {{ yearSummary.totalUnpaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="grey" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">免繳</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-grey">NT$ {{ yearSummary.totalWaived.toLocaleString() }}</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- 月份區塊列表 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <div v-if="monthlyData.length === 0" class="text-center text-medium-emphasis pa-8">
          {{ filterMember ? '該社友無應收帳款' : '本年度無應收帳款' }}
        </div>

        <div v-for="month in monthlyData" :key="month.key" class="mb-4">
          <!-- 月份標題 -->
          <div
            class="d-flex justify-space-between align-center pa-2 rounded mb-2"
            style="background:#f1f5f9;cursor:pointer"
            @click="toggleMonth(month.key)"
          >
            <div class="d-flex align-center ga-2">
              <v-icon size="20" color="primary">mdi-calendar-month</v-icon>
              <span class="text-body-2 font-weight-bold">{{ month.label }}</span>
              <v-chip size="x-small" color="primary" variant="tonal">{{ month.items.length }} 項</v-chip>
            </div>
            <div class="d-flex align-center ga-3">
              <div class="text-right">
                <span class="text-caption text-success font-weight-bold">{{ month.paidAmount.toLocaleString() }}</span>
                <span class="text-caption text-medium-emphasis"> / {{ month.targetAmount.toLocaleString() }}</span>
              </div>
              <v-icon size="20">{{ expandedMonths.includes(month.key) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </div>
          </div>

          <!-- 月份明細 -->
          <div v-if="expandedMonths.includes(month.key)">
            <!-- 按項目分組 -->
            <div v-for="group in month.groups" :key="group.title" class="mb-3">
              <div class="d-flex align-center ga-2 mb-2 px-1">
                <v-chip size="x-small" :color="group.sourceType === 'agency' ? 'warning' : 'primary'" variant="flat">
                  {{ group.sourceType === 'agency' ? '代收' : '社費' }}
                </v-chip>
                <span class="text-caption font-weight-bold">{{ group.title }}</span>
                <span class="text-caption text-medium-emphasis">
                  (應收 NT$ {{ group.perAmount.toLocaleString() }}{{ group.sourceType === 'dues' ? ' / 人' : '' }})
                </span>
              </div>

              <!-- 社友明細表 -->
              <v-table density="compact" class="rounded" style="border:1px solid #e2e8f0">
                <thead>
                  <tr>
                    <th style="width:110px">社友</th>
                    <th class="text-right" style="width:90px">應收</th>
                    <th class="text-right" style="width:90px">已收</th>
                    <th class="text-right" style="width:90px">未收</th>
                    <th class="text-center" style="width:64px">狀態</th>
                    <th class="text-center" style="width:160px">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in group.members" :key="item.id" :class="item.status === 'waived' ? 'text-grey' : ''">
                    <td class="text-caption font-weight-medium">{{ item.memberName }}</td>
                    <td class="text-right text-caption">{{ item.amount.toLocaleString() }}</td>
                    <td class="text-right text-caption" :class="paidOf(item) > 0 ? 'text-success font-weight-bold' : 'text-medium-emphasis'">
                      {{ paidOf(item) > 0 ? paidOf(item).toLocaleString() : '—' }}
                    </td>
                    <td class="text-right text-caption" :class="remainingOf(item) > 0 ? 'text-error font-weight-bold' : 'text-medium-emphasis'">
                      {{ item.status === 'waived' ? '—' : remainingOf(item).toLocaleString() }}
                    </td>
                    <td class="text-center">
                      <v-icon v-if="item.status === 'paid'" size="16" color="success" title="已收">mdi-check-circle</v-icon>
                      <v-icon v-else-if="item.status === 'partial'" size="16" color="warning" title="部分收款">mdi-circle-half-full</v-icon>
                      <v-icon v-else-if="item.status === 'waived'" size="16" color="grey" title="免繳">mdi-cancel</v-icon>
                      <v-icon v-else size="16" color="grey-lighten-1" title="未收">mdi-clock-outline</v-icon>
                    </td>
                    <td class="text-center">
                      <div class="d-flex justify-center ga-1">
                        <v-btn
                          v-if="item.status === 'pending' || item.status === 'partial'"
                          size="x-small" variant="tonal" color="success"
                          prepend-icon="mdi-cash-plus"
                          @click.stop="openCollectModal(item)"
                        >收款</v-btn>
                        <v-btn
                          v-if="paidOf(item) === 0 && item.status !== 'waived'"
                          size="x-small" variant="text" icon="mdi-pencil" color="primary"
                          title="編輯" @click.stop="openEditModal(item)"
                        />
                        <v-btn
                          v-if="item.status === 'pending'"
                          size="x-small" variant="text" icon="mdi-cancel" color="grey"
                          title="免繳" @click.stop="handleWaive(item)"
                        />
                        <v-btn
                          v-if="item.status === 'waived' || item.status === 'paid' || item.status === 'partial'"
                          size="x-small" variant="text" icon="mdi-restore" color="primary"
                          title="恢復為未收" @click.stop="handleReopen(item)"
                        />
                        <v-btn
                          v-if="paidOf(item) === 0"
                          size="x-small" variant="text" icon="mdi-delete" color="error"
                          title="刪除" @click.stop="handleDelete(item)"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>
        </div>
      </div>
    </v-card>

    <!-- 批次產生帳款 Dialog -->
    <v-dialog v-model="batchModal" :max-width="xs ? undefined : 560" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">批次產生帳款</span>
          <v-btn icon variant="text" @click="batchModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <!-- 季度社費快速開單 -->
          <v-card variant="tonal" color="primary" class="pa-3 mb-3" rounded="lg">
            <div class="text-caption font-weight-bold mb-2">季度社費快速開單（每月 {{ monthlyDues.toLocaleString() }} × 3）</div>
            <v-row dense>
              <v-col cols="6">
                <v-select
                  v-model="quickFy" label="扶輪年度" :items="quickFyOptions"
                  density="compact" variant="outlined" hide-details
                />
              </v-col>
              <v-col cols="6">
                <v-select
                  v-model="quickQuarter" label="季別" :items="quarterOptions"
                  density="compact" variant="outlined" hide-details
                  @update:model-value="applyQuickDues"
                />
              </v-col>
            </v-row>
          </v-card>

          <v-combobox
            v-model="batchForm.category"
            label="帳款類別"
            :items="categoryOptions"
            density="compact" variant="outlined" class="mb-2"
            @update:model-value="onBatchCategoryChange"
          />
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="batchForm.amount" label="金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="batchForm.dueDate" label="應收日期" type="date" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select
            v-model="batchForm.accountCode"
            label="入帳科目"
            :items="receivableAcctOptions"
            density="compact" variant="outlined" class="mb-1"
          />
          <div v-if="batchPeriodLabel" class="text-caption text-medium-emphasis mb-2">
            權責認列區間 <strong>{{ batchPeriodLabel }}</strong>：未到期部分列預收社費，逐月自動轉列收入。
          </div>

          <div class="d-flex justify-space-between align-center mb-1">
            <span class="text-caption font-weight-bold">選擇社友（{{ batchForm.members.length }} / {{ memberNames.length }}）</span>
            <div>
              <v-btn size="x-small" variant="text" @click="selectAllMembers">全選</v-btn>
              <v-btn size="x-small" variant="text" @click="batchForm.members = []">全不選</v-btn>
            </div>
          </div>
          <v-card variant="outlined" class="pa-2" style="max-height:240px;overflow-y:auto">
            <v-row dense>
              <v-col v-for="name in memberNames" :key="name" cols="6" sm="4">
                <v-checkbox-btn v-model="batchForm.members" :value="name" :label="name" density="compact" />
              </v-col>
            </v-row>
            <div v-if="memberNames.length === 0" class="text-caption text-medium-emphasis pa-2">尚無社友資料</div>
          </v-card>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="batchModal = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="handleBatchGenerate">產生帳款</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 單筆新增 / 編輯 Dialog -->
    <v-dialog v-model="editModal" :max-width="xs ? undefined : 440" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingItem ? '編輯帳款' : '單筆新增帳款' }}</span>
          <v-btn icon variant="text" @click="editModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editForm.category"
            label="帳款類別"
            :items="categoryOptions"
            density="compact" variant="outlined" class="mb-2"
            @update:model-value="onEditCategoryChange"
          />
          <v-autocomplete
            v-model="editForm.memberName"
            label="社友"
            :items="memberNames"
            density="compact" variant="outlined" class="mb-2"
          />
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="editForm.amount" label="金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="editForm.dueDate" label="應收日期" type="date" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select
            v-model="editForm.accountCode"
            label="入帳科目"
            :items="receivableAcctOptions"
            density="compact" variant="outlined" class="mb-2"
          />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="editModal = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="handleSaveEdit">儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 收款 Dialog -->
    <v-dialog v-model="collectModal" :max-width="xs ? undefined : 420" :fullscreen="xs">
      <v-card v-if="collectingItem">
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">新增收款</span>
          <v-btn icon variant="text" @click="collectModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-card variant="tonal" color="primary" class="pa-3 mb-3">
            <div class="text-caption">{{ collectingItem.memberName }}．{{ collectingItem.sourceRef }}</div>
            <div class="d-flex justify-space-between mt-1">
              <span class="text-caption">應收 {{ collectingItem.amount.toLocaleString() }}</span>
              <span class="text-caption">已收 {{ paidOf(collectingItem).toLocaleString() }}</span>
              <span class="text-caption font-weight-bold text-error">未收 {{ remainingOf(collectingItem).toLocaleString() }}</span>
            </div>
          </v-card>
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="collectForm.date" label="收款日期" type="date" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="collectForm.amount" label="沖款金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select v-model="collectForm.account" label="收款帳戶 / 經手人" :items="fundOptions" density="compact" variant="outlined" class="mb-1" />
          <v-text-field v-model="collectForm.remark" label="備註（選填）" density="compact" variant="outlined" />
          <div v-if="collectOverRemaining" class="text-caption text-warning">
            沖款金額大於未收餘額，將以未收餘額 {{ remainingOf(collectingItem).toLocaleString() }} 沖抵。
          </div>
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="collectModal = false">取消</v-btn>
          <v-btn color="success" variant="flat" :loading="saving" @click="handleCollect">確認收款</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { buildFundAccountOptions, LEGACY_INCOME_ACCOUNT_MAP, CODES } from '../accounting/coa.js'
import { fyOf, fyLabel, DUES_QUARTERS, duesQuarterPeriod } from '../accounting/fiscal.js'

const { xs } = useDisplay()

const members = inject('members')
const accounts = inject('accounts')
const appSettings = inject('appSettings')
const receivables = inject('receivables')
const recLoading = inject('recLoading')
const duesSettings = inject('duesSettings')
const fetchReceivables = inject('fetchReceivables')
const fetchRecords = inject('fetchRecords')
const waiveReceivable = inject('waiveReceivable')
const reopenReceivable = inject('reopenReceivable')
const batchGenerate = inject('batchGenerate')
const createReceivable = inject('createReceivable')
const updateReceivable = inject('updateReceivable')
const deleteReceivable = inject('deleteReceivable')
const collectReceivable = inject('collectReceivable')

const selectedYear = ref(new Date().getFullYear().toString())
const filterMember = ref(null)
const filterStatus = ref('all')
const expandedMonths = ref([])
const saving = ref(false)

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }
function todayStr() { return new Date().toISOString().split('T')[0] }

// 年度為前端過濾（receivables 為全量載入，分錄引擎共用）
const availableYears = computed(() => {
  const years = [...new Set((receivables.value || []).map(r => r.dueYear))]
  if (!years.includes(selectedYear.value)) years.push(selectedYear.value)
  return years.sort((a, b) => b - a)
})

const memberNames = computed(() => (members.value || []).map(m => m.name))
const memberOptions = computed(() => memberNames.value)
const categoryOptions = computed(() => (duesSettings.value || []).map(s => s.category))
const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))
const monthlyDues = computed(() => parseFloat(appSettings?.value?.['dues.monthlyAmount']) || 6000)

// 開單入帳科目：收入葉節點 + 代收/暫收
const receivableAcctOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  const leaves = list.filter(a => !hasChildren.has(a.code))
  return [
    ...leaves.filter(a => a.type === 'income'),
    ...leaves.filter(a => a.type === 'liability' && [CODES.AGENCY, CODES.TEMP_RECEIPT].includes(a.code)),
  ].map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})

// ── 金額輔助 ──
function paidOf(item) {
  if (item.status === 'paid') return item.paidAmount != null ? item.paidAmount : item.amount
  if (item.status === 'partial') return item.paidAmount || 0
  return 0
}
function remainingOf(item) {
  if (item.status === 'waived') return 0
  return Math.max(0, item.amount - paidOf(item))
}

// ── 篩選 ──
const filteredReceivables = computed(() => {
  let items = (receivables.value || []).filter(r => r.dueYear === selectedYear.value)
  if (filterMember.value) items = items.filter(r => r.memberName === filterMember.value)
  if (filterStatus.value === 'paid') items = items.filter(r => r.status === 'paid')
  else if (filterStatus.value === 'waived') items = items.filter(r => r.status === 'waived')
  else if (filterStatus.value === 'unpaid') items = items.filter(r => r.status === 'pending' || r.status === 'partial')
  return items
})

const yearSummary = computed(() => {
  let items = (receivables.value || []).filter(r => r.dueYear === selectedYear.value)
  if (filterMember.value) items = items.filter(r => r.memberName === filterMember.value)
  const active = items.filter(r => r.status !== 'waived')
  const totalTarget = active.reduce((s, r) => s + r.amount, 0)
  const totalPaid = active.reduce((s, r) => s + paidOf(r), 0)
  const totalWaived = items.filter(r => r.status === 'waived').reduce((s, r) => s + r.amount, 0)
  return { totalTarget, totalPaid, totalUnpaid: totalTarget - totalPaid, totalWaived }
})

const monthlyData = computed(() => {
  const monthMap = {}
  filteredReceivables.value.forEach(item => {
    const key = item.dueDate ? item.dueDate.substring(0, 7) : `${selectedYear.value}-00`
    if (!monthMap[key]) monthMap[key] = []
    monthMap[key].push(item)
  })

  return Object.keys(monthMap).sort().map(key => {
    const items = monthMap[key]
    const activeItems = items.filter(r => r.status !== 'waived')
    const targetAmount = activeItems.reduce((s, r) => s + r.amount, 0)
    const paidAmount = activeItems.reduce((s, r) => s + paidOf(r), 0)

    const groupMap = {}
    items.forEach(item => {
      const gKey = `${item.sourceType}:${item.sourceRef}`
      if (!groupMap[gKey]) {
        groupMap[gKey] = { sourceType: item.sourceType, title: item.sourceRef, perAmount: item.amount, members: [] }
      }
      groupMap[gKey].members.push(item)
    })

    const label = key.endsWith('-00') ? '未指定月份' : `${parseInt(key.split('-')[1])} 月`
    return { key, label, items, targetAmount, paidAmount, groups: Object.values(groupMap) }
  })
})

function toggleMonth(key) {
  const idx = expandedMonths.value.indexOf(key)
  if (idx >= 0) expandedMonths.value.splice(idx, 1)
  else expandedMonths.value.push(key)
}

// ── 批次產生 ──
const batchModal = ref(false)
const batchForm = ref(makeBatchForm())

function makeBatchForm() {
  return { category: '', amount: '', dueDate: '', accountCode: null, periodStart: null, periodEnd: null, members: [] }
}

// 季度社費快速開單
const quickFy = ref(fyOf(todayStr()))
const quickQuarter = ref(null)
const quickFyOptions = computed(() => {
  const fy = fyOf(todayStr())
  return [fy - 1, fy, fy + 1].map(f => ({ title: fyLabel(f), value: f }))
})
const quarterOptions = DUES_QUARTERS.map(q => ({ title: `${q.label}社費`, value: q.q }))

function applyQuickDues() {
  const info = duesQuarterPeriod(quickFy.value, quickQuarter.value)
  if (!info) return
  batchForm.value.category = info.categoryName
  batchForm.value.amount = monthlyDues.value * 3
  batchForm.value.dueDate = info.dueDate
  batchForm.value.accountCode = CODES.DUES_INCOME
  batchForm.value.periodStart = info.periodStart
  batchForm.value.periodEnd = info.periodEnd
}

const batchPeriodLabel = computed(() =>
  batchForm.value.periodStart ? `${batchForm.value.periodStart} ~ ${batchForm.value.periodEnd}` : ''
)

function openBatchModal() {
  quickQuarter.value = null
  batchForm.value = { ...makeBatchForm(), members: [...memberNames.value] }
  batchModal.value = true
}
function selectAllMembers() {
  batchForm.value.members = [...memberNames.value]
}
function onBatchCategoryChange(cat) {
  const s = (duesSettings.value || []).find(x => x.category === cat)
  if (s) {
    batchForm.value.amount = s.standardAmount || ''
    batchForm.value.dueDate = s.dueDate || ''
    batchForm.value.accountCode = s.accountCode || LEGACY_INCOME_ACCOUNT_MAP[s.incomeAccount] || null
    // 期間由後端依 periodMonths 推得；此處僅顯示提示
    batchForm.value.periodStart = null
    batchForm.value.periodEnd = null
  }
}

async function handleBatchGenerate() {
  if (!batchForm.value.category) {
    Swal.fire({ icon: 'warning', title: '請選擇帳款類別', confirmButtonColor: '#4f46e5' }); return
  }
  if (batchForm.value.members.length === 0) {
    Swal.fire({ icon: 'warning', title: '請至少選擇一位社友', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const result = await batchGenerate({
      category: batchForm.value.category,
      memberNames: batchForm.value.members,
      amount: parseFloat(batchForm.value.amount) || 0,
      dueDate: batchForm.value.dueDate || '',
      accountCode: batchForm.value.accountCode || null,
      periodStart: batchForm.value.periodStart || null,
      periodEnd: batchForm.value.periodEnd || null,
    })
    const year = (batchForm.value.dueDate || '').substring(0, 4) || selectedYear.value
    selectedYear.value = year
    await fetchReceivables()
    batchModal.value = false
    Swal.fire({
      icon: 'success', title: '批次產生完成',
      html: `新增 <b>${result.created}</b> 筆${result.skipped ? `，略過 <b>${result.skipped}</b> 筆（已存在）` : ''}`,
      confirmButtonColor: '#4f46e5',
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '產生失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 單筆新增 / 編輯 ──
const editModal = ref(false)
const editingItem = ref(null)
const editForm = ref({ category: '', memberName: '', amount: '', dueDate: '', accountCode: null })

function openCreateModal() {
  editingItem.value = null
  editForm.value = { category: '', memberName: '', amount: '', dueDate: '', accountCode: null }
  editModal.value = true
}
function openEditModal(item) {
  editingItem.value = item
  editForm.value = {
    category: item.sourceRef,
    memberName: item.memberName,
    amount: (item.amount ?? '').toString(),
    dueDate: item.dueDate || '',
    accountCode: item.accountCode || LEGACY_INCOME_ACCOUNT_MAP[item.incomeAccount] || null,
  }
  editModal.value = true
}
function onEditCategoryChange(cat) {
  const s = (duesSettings.value || []).find(x => x.category === cat)
  if (s) {
    if (!editForm.value.amount) editForm.value.amount = s.standardAmount || ''
    if (!editForm.value.dueDate) editForm.value.dueDate = s.dueDate || ''
    if (!editForm.value.accountCode) editForm.value.accountCode = s.accountCode || LEGACY_INCOME_ACCOUNT_MAP[s.incomeAccount] || null
  }
}

async function handleSaveEdit() {
  if (!editForm.value.category || !editForm.value.memberName) {
    Swal.fire({ icon: 'warning', title: '請填寫類別與社友', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    if (editingItem.value) {
      await updateReceivable(editingItem.value.id, {
        sourceRef: editForm.value.category,
        memberName: editForm.value.memberName,
        amount: parseFloat(editForm.value.amount) || 0,
        dueDate: editForm.value.dueDate || '',
        accountCode: editForm.value.accountCode || null,
      })
    } else {
      await createReceivable({
        category: editForm.value.category,
        memberName: editForm.value.memberName,
        amount: parseFloat(editForm.value.amount) || 0,
        dueDate: editForm.value.dueDate || '',
        accountCode: editForm.value.accountCode || null,
      })
    }
    const year = (editForm.value.dueDate || '').substring(0, 4) || selectedYear.value
    if (year !== selectedYear.value) selectedYear.value = year
    await fetchReceivables()
    editModal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 收款 ──
const collectModal = ref(false)
const collectingItem = ref(null)
const collectForm = ref({ date: todayStr(), amount: '', account: '一銀帳戶', remark: '' })

const collectOverRemaining = computed(() => {
  if (!collectingItem.value) return false
  const entered = parseFloat(collectForm.value.amount)
  return entered > remainingOf(collectingItem.value)
})

function openCollectModal(item) {
  collectingItem.value = item
  collectForm.value = {
    date: todayStr(),
    amount: remainingOf(item).toString(),
    account: '一銀帳戶',
    remark: '',
  }
  collectModal.value = true
}

async function handleCollect() {
  if (!collectForm.value.date || !collectForm.value.account) {
    Swal.fire({ icon: 'warning', title: '請填寫收款日期與帳戶', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const result = await collectReceivable(collectingItem.value.id, {
      date: collectForm.value.date,
      amount: parseFloat(collectForm.value.amount) || 0,
      account: collectForm.value.account,
      remark: collectForm.value.remark,
    })
    await Promise.all([fetchRecords(), fetchReceivables()])
    collectModal.value = false
    Swal.fire({
      icon: 'success', title: '收款完成',
      html: `已沖抵 NT$ <b>${(result.applied || 0).toLocaleString()}</b>`,
      timer: 1500, showConfirmButton: false,
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '收款失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 免繳 / 恢復 / 刪除 ──
async function handleWaive(item) {
  const { value: reason } = await Swal.fire({
    title: '免繳確認',
    html: `確定要將 <b>${item.memberName}</b> 的「${item.sourceRef}」標記為免繳嗎？`,
    input: 'text', inputLabel: '免繳原因（選填）', inputPlaceholder: '例：榮譽社友免繳',
    showCancelButton: true, confirmButtonColor: '#6b7280', cancelButtonColor: '#4f46e5',
    confirmButtonText: '確定免繳', cancelButtonText: '取消',
  })
  if (reason !== undefined) await waiveReceivable(item.id, reason || '')
}

async function handleReopen(item) {
  const result = await Swal.fire({
    title: '恢復為未收',
    html: `確定要將 <b>${item.memberName}</b> 的「${item.sourceRef}」恢復為未收嗎？<br><span class="text-caption">此帳款已產生的收款單將一併刪除，帳務自動回復。</span>`,
    icon: 'question',
    showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定恢復', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    await reopenReceivable(item.id)
    await Promise.all([fetchRecords(), fetchReceivables()])
  }
}

async function handleDelete(item) {
  const result = await Swal.fire({
    title: '刪除帳款',
    html: `確定要刪除 <b>${item.memberName}</b> 的「${item.sourceRef}」這筆帳款嗎？`,
    icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    try {
      await deleteReceivable(item.id)
    } catch (e) {
      Swal.fire({ icon: 'error', title: '刪除失敗', text: e.message, confirmButtonColor: '#ef4444' })
    }
  }
}
</script>
