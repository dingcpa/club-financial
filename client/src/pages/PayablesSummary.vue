<template>
  <div>
    <div v-if="payLoading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <!-- 標題列 -->
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-file-document-minus</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">{{ toMinguoYear(selectedYear) }}年度 應付明細表</span>
        </div>
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-btn color="primary" variant="tonal" prepend-icon="mdi-printer" size="small" @click="printReport">產生附表</v-btn>
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openCreateModal">新增應付帳款</v-btn>
          <v-select
            v-model="selectedYear"
            :items="availableYears"
            :item-title="y => toMinguoYear(y) + ' 年度'"
            :item-value="y => y"
            density="compact" variant="outlined" hide-details
            style="min-width:110px"
          />
        </div>
      </v-card-title>

      <!-- 年度總計摘要 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <v-row dense>
          <v-col cols="3">
            <v-card color="primary" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">總應付</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-primary">NT$ {{ yearSummary.totalTarget.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">已付</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-success">NT$ {{ yearSummary.totalPaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">未付</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-error">NT$ {{ yearSummary.totalUnpaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="grey" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">免付</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-grey">NT$ {{ yearSummary.totalWaived.toLocaleString() }}</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- 明細↔總帳勾稽 -->
      <div class="px-3 px-sm-4 pb-2">
        <v-chip
          size="small" variant="tonal"
          :color="apTieOut.matched ? 'success' : 'error'"
          :prepend-icon="apTieOut.matched ? 'mdi-check-circle' : 'mdi-alert-circle'"
        >
          應付明細未付合計 {{ apTieOut.detailTotal.toLocaleString() }} {{ apTieOut.matched ? '＝' : '≠' }} 帳上應付帳款餘額 {{ apTieOut.ledgerTotal.toLocaleString() }}
        </v-chip>
      </div>

      <!-- 逐欄篩選列 -->
      <div class="px-3 px-sm-4 pb-2">
        <v-row dense>
          <v-col cols="6" sm="2">
            <v-select v-model="filterPeriod" label="帳期" :items="periodOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="6" sm="3">
            <v-select v-model="filterItem" label="項目" :items="itemOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="6" sm="3">
            <v-autocomplete v-model="filterPayee" label="對象" :items="payeeOptions" density="compact" variant="outlined" hide-details clearable />
          </v-col>
          <v-col cols="12" sm="4" class="d-flex align-center">
            <v-btn-toggle v-model="filterStatus" density="compact" variant="outlined" divided>
              <v-btn value="all" size="small">全部</v-btn>
              <v-btn value="unpaid" size="small" color="error">未付</v-btn>
              <v-btn value="paid" size="small" color="success">已付</v-btn>
              <v-btn value="waived" size="small" color="grey">免付</v-btn>
            </v-btn-toggle>
          </v-col>
        </v-row>
      </div>

      <!-- 應付明細平表 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <div v-if="tableRows.length === 0" class="text-center text-medium-emphasis pa-8">
          無符合條件的應付帳款。每月固定費用（薪資、租金）或代收款轉繳（總半年費、月刊、EREY…）可在此立帳，
          費用即認列於當月月報表，之後再以付款單沖帳。
        </div>
        <div v-else style="overflow-x:auto">
          <v-table density="compact" class="rounded" style="border:1px solid #e2e8f0;min-width:860px">
            <thead>
              <tr>
                <th style="width:70px">帳期</th>
                <th>項目</th>
                <th style="width:120px">對象</th>
                <th style="width:130px">科目</th>
                <th class="text-right" style="width:90px">應付</th>
                <th class="text-right" style="width:90px">已付</th>
                <th class="text-right" style="width:90px">未付</th>
                <th class="text-center" style="width:56px">狀態</th>
                <th class="text-center" style="width:150px">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in tableRows" :key="item.id" :class="item.status === 'waived' ? 'text-grey' : ''">
                <td class="text-caption text-medium-emphasis">{{ periodOf(item) }}</td>
                <td class="text-caption">{{ item.sourceRef }}</td>
                <td class="text-caption font-weight-medium">{{ item.payee }}</td>
                <td class="text-caption text-medium-emphasis">{{ acctLabel(item.accountCode) }}</td>
                <td class="text-right text-caption">{{ item.amount.toLocaleString() }}</td>
                <td class="text-right text-caption" :class="paidOf(item) ? 'text-success font-weight-bold' : 'text-medium-emphasis'">
                  {{ paidOf(item) ? paidOf(item).toLocaleString() : '—' }}
                </td>
                <td class="text-right text-caption" :class="remainingOf(item) ? 'text-error font-weight-bold' : 'text-medium-emphasis'">
                  {{ item.status === 'waived' ? '—' : remainingOf(item).toLocaleString() }}
                </td>
                <td class="text-center">
                  <v-icon v-if="item.status === 'paid'" size="16" color="success" title="已付">mdi-check-circle</v-icon>
                  <v-icon v-else-if="item.status === 'partial'" size="16" color="warning" title="部分付款">mdi-circle-half-full</v-icon>
                  <v-icon v-else-if="item.status === 'waived'" size="16" color="grey" title="免付">mdi-cancel</v-icon>
                  <v-icon v-else size="16" color="grey-lighten-1" title="未付">mdi-clock-outline</v-icon>
                </td>
                <td class="text-center">
                  <div class="d-flex justify-center ga-1">
                    <v-btn
                      v-if="item.status === 'pending' || item.status === 'partial'"
                      size="x-small" variant="tonal" color="error"
                      prepend-icon="mdi-cash-minus"
                      @click.stop="openPayModal(item)"
                    >付款</v-btn>
                    <v-btn
                      v-if="paidOf(item) === 0 && item.status !== 'waived'"
                      size="x-small" variant="text" icon="mdi-pencil" color="primary"
                      title="編輯" @click.stop="openEditModal(item)"
                    />
                    <v-btn
                      v-if="item.status === 'pending'"
                      size="x-small" variant="text" icon="mdi-cancel" color="grey"
                      title="免付" @click.stop="handleWaive(item)"
                    />
                    <v-btn
                      v-if="['waived', 'paid', 'partial'].includes(item.status)"
                      size="x-small" variant="text" icon="mdi-restore" color="primary"
                      title="恢復為未付" @click.stop="handleReopen(item)"
                    />
                    <v-btn
                      v-if="paidOf(item) === 0"
                      size="x-small" variant="text" icon="mdi-delete" color="error"
                      title="刪除" @click.stop="handleDelete(item)"
                    />
                  </div>
                </td>
              </tr>
              <tr style="background:#f8fafc">
                <td colspan="4" class="text-caption font-weight-bold text-right">篩選合計（{{ tableRows.length }} 筆）</td>
                <td class="text-right text-caption font-weight-bold">{{ tableTotals.amount.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold text-success">{{ tableTotals.paid.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold text-error">{{ tableTotals.remaining.toLocaleString() }}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </div>
    </v-card>

    <!-- 列印附表：科目×項目統計 -->
    <PrintSheet>
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
      <div class="print-title">應付明細表（項目統計）</div>
      <div class="print-meta">民國 {{ toMinguoYear(selectedYear) }} 年度　・　製表日 {{ toMinguoDate(todayStr()) }}　・　幣別：新臺幣 NT$</div>
      <table>
        <thead>
          <tr>
            <th>科目 / 項目</th>
            <th style="width:110px">對象</th>
            <th class="num" style="width:56px">筆數</th>
            <th class="num" style="width:96px">應付</th>
            <th class="num" style="width:96px">已付</th>
            <th class="num" style="width:96px">未付</th>
            <th class="num" style="width:86px">免付</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="g in printStats" :key="g.code">
            <tr class="group">
              <td colspan="2">{{ g.label }}</td>
              <td class="num">{{ g.count }}</td>
              <td class="num">{{ g.target.toLocaleString() }}</td>
              <td class="num">{{ g.paid.toLocaleString() }}</td>
              <td class="num">{{ g.unpaid.toLocaleString() }}</td>
              <td class="num">{{ g.waived ? g.waived.toLocaleString() : '—' }}</td>
            </tr>
            <tr v-for="it in g.items" :key="it.key">
              <td style="padding-left:22px">{{ it.item }}</td>
              <td>{{ it.payee }}</td>
              <td class="num">{{ it.count }}</td>
              <td class="num">{{ it.target.toLocaleString() }}</td>
              <td class="num">{{ it.paid.toLocaleString() }}</td>
              <td class="num">{{ it.unpaid.toLocaleString() }}</td>
              <td class="num">{{ it.waived ? it.waived.toLocaleString() : '—' }}</td>
            </tr>
          </template>
          <tr class="total">
            <td colspan="2">合計</td>
            <td class="num">{{ printGrand.count }}</td>
            <td class="num">{{ printGrand.target.toLocaleString() }}</td>
            <td class="num">{{ printGrand.paid.toLocaleString() }}</td>
            <td class="num">{{ printGrand.unpaid.toLocaleString() }}</td>
            <td class="num">{{ printGrand.waived ? printGrand.waived.toLocaleString() : '—' }}</td>
          </tr>
        </tbody>
      </table>
      <div class="print-footer">
        科目 2111 為代收款轉繳義務（立帳借代收款／貸應付）。應付明細未付合計與帳上應付帳款（2112）餘額勾稽：
        {{ apTieOut.matched ? '一致' : '不一致' }}（明細 {{ apTieOut.detailTotal.toLocaleString() }}／總帳 {{ apTieOut.ledgerTotal.toLocaleString() }}）。
      </div>
      <div class="print-sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>
    </PrintSheet>

    <!-- 新增 / 編輯 Dialog -->
    <v-dialog v-model="editModal" :max-width="xs ? undefined : 460" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingItem ? '編輯應付帳款' : '新增應付帳款' }}</span>
          <v-btn icon variant="text" @click="editModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-combobox
            v-model="editForm.sourceRef" label="項目（例：7月薪資、總半年費轉繳）"
            :items="itemOptions" density="compact" variant="outlined" class="mb-2"
          />
          <v-combobox
            v-model="editForm.payee" label="對象 / 受款人（例：陳淑華、總會、中華扶輪教育基金會）"
            :items="payeeSuggestions" density="compact" variant="outlined" class="mb-2"
          />
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="editForm.amount" label="金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="editForm.dueDate" label="立帳日期（費用認列日）" type="date" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select
            v-model="editForm.accountCode"
            label="支出科目 / 代收款"
            :items="payableAcctOptions"
            density="compact" variant="outlined" class="mb-2"
            hint="選 2111 代收款＝代收款轉繳義務（借代收款/貸應付）；費用科目＝借費用/貸應付"
            persistent-hint
          />
          <v-select
            v-model="editForm.projectId" label="活動（選填）"
            :items="projectOptions" density="compact" variant="outlined" clearable class="mb-2"
          />
          <v-text-field v-model="editForm.remark" label="備註（選填）" density="compact" variant="outlined" />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="editModal = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="handleSaveEdit">儲存</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 付款 Dialog -->
    <v-dialog v-model="payModal" :max-width="xs ? undefined : 420" :fullscreen="xs">
      <v-card v-if="payingItem">
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">付款沖帳</span>
          <v-btn icon variant="text" @click="payModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-card variant="tonal" color="primary" class="pa-3 mb-3">
            <div class="text-caption">{{ payingItem.payee }}．{{ payingItem.sourceRef }}</div>
            <div class="d-flex justify-space-between mt-1">
              <span class="text-caption">應付 {{ payingItem.amount.toLocaleString() }}</span>
              <span class="text-caption">已付 {{ paidOf(payingItem).toLocaleString() }}</span>
              <span class="text-caption font-weight-bold text-error">未付 {{ remainingOf(payingItem).toLocaleString() }}</span>
            </div>
          </v-card>
          <v-row dense>
            <v-col cols="6">
              <v-text-field v-model="payForm.date" label="付款日期" type="date" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="6">
              <v-text-field v-model="payForm.amount" label="付款金額 (NT$)" type="number" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <v-select v-model="payForm.account" label="付款帳戶 / 經手人" :items="fundOptions" density="compact" variant="outlined" class="mb-1" />
          <v-text-field v-model="payForm.remark" label="備註（選填）" density="compact" variant="outlined" />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="payModal = false">取消</v-btn>
          <v-btn color="error" variant="flat" :loading="saving" @click="handlePay">確認付款</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { buildFundAccountOptions, CODES } from '../accounting/coa.js'
import { balancesAsOf } from '../accounting/ledger.js'
import { toMinguoDate } from '../accounting/fiscal.js'
import PrintSheet from '../components/PrintSheet.vue'

const { xs } = useDisplay()

const members = inject('members')
const accounts = inject('accounts')
const projects = inject('projects')
const accounting = inject('accounting')
const payables = inject('payables')
const payLoading = inject('payLoading')
const fetchPayables = inject('fetchPayables')
const fetchRecords = inject('fetchRecords')
const createPayable = inject('createPayable')
const updatePayable = inject('updatePayable')
const deletePayable = inject('deletePayable')
const payPayable = inject('payPayable')
const waivePayable = inject('waivePayable')
const reopenPayable = inject('reopenPayable')

const selectedYear = ref(new Date().getFullYear().toString())
const filterPeriod = ref(null)
const filterItem = ref(null)
const filterPayee = ref(null)
const filterStatus = ref('all')
const saving = ref(false)

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }
function todayStr() { return new Date().toISOString().split('T')[0] }

const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))
const projectOptions = computed(() =>
  (projects?.value || []).filter(p => p.active).map(p => ({ title: p.name, value: p.id })))

// 立帳科目：費用葉節點＋代收款（2111 轉繳）
const payableAcctOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  const leaves = list.filter(a => !hasChildren.has(a.code))
  return [
    ...leaves.filter(a => a.type === 'expense'),
    ...leaves.filter(a => a.code === CODES.AGENCY),
  ].map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})

function acctLabel(code) {
  const a = (accounts?.value || []).find(x => x.code === code)
  return a ? `${a.code} ${a.name}` : (code || '—')
}

function periodOf(p) {
  const ym = p.dueDate ? p.dueDate.substring(0, 7) : ''
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  return `${parseInt(y) - 1911}${m}`
}
function paidOf(p) {
  if (p.status === 'paid') return p.paidAmount != null ? p.paidAmount : p.amount
  if (p.status === 'partial') return p.paidAmount || 0
  return 0
}
function remainingOf(p) {
  if (p.status === 'waived') return 0
  return Math.round((p.amount - paidOf(p)) * 100) / 100
}

const availableYears = computed(() => {
  const years = [...new Set((payables.value || []).map(p => p.dueYear))]
  if (!years.includes(selectedYear.value)) years.push(selectedYear.value)
  return years.sort((a, b) => b - a)
})
const yearItems = computed(() => (payables.value || []).filter(p => p.dueYear === selectedYear.value))

function applyColumnFilters(items) {
  let out = items
  if (filterPeriod.value) out = out.filter(p => periodOf(p) === filterPeriod.value)
  if (filterItem.value) out = out.filter(p => p.sourceRef === filterItem.value)
  if (filterPayee.value) out = out.filter(p => p.payee === filterPayee.value)
  return out
}
const periodOptions = computed(() => [...new Set(yearItems.value.map(periodOf))].sort())
const itemOptions = computed(() => [...new Set(yearItems.value.map(p => p.sourceRef))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
const payeeOptions = computed(() => [...new Set(yearItems.value.map(p => p.payee))].sort((a, b) => a.localeCompare(b, 'zh-Hant')))
const payeeSuggestions = computed(() => {
  const names = new Set((payables.value || []).map(p => p.payee))
  for (const m of members?.value || []) if (m.status !== 'left') names.add(m.name)
  return [...names]
})

const filteredPayables = computed(() => {
  let items = applyColumnFilters(yearItems.value)
  if (filterStatus.value === 'paid') items = items.filter(p => p.status === 'paid')
  else if (filterStatus.value === 'waived') items = items.filter(p => p.status === 'waived')
  else if (filterStatus.value === 'unpaid') items = items.filter(p => p.status === 'pending' || p.status === 'partial')
  return items
})

const yearSummary = computed(() => {
  const items = applyColumnFilters(yearItems.value)
  const active = items.filter(p => p.status !== 'waived')
  const totalTarget = active.reduce((s, p) => s + p.amount, 0)
  const totalPaid = active.reduce((s, p) => s + paidOf(p), 0)
  const totalWaived = items.filter(p => p.status === 'waived').reduce((s, p) => s + p.amount, 0)
  return { totalTarget, totalPaid, totalUnpaid: totalTarget - totalPaid, totalWaived }
})

const tableRows = computed(() =>
  [...filteredPayables.value].sort((a, b) =>
    periodOf(a).localeCompare(periodOf(b)) ||
    a.sourceRef.localeCompare(b.sourceRef, 'zh-Hant') ||
    a.payee.localeCompare(b.payee, 'zh-Hant')
  )
)
const tableTotals = computed(() => {
  const active = tableRows.value.filter(p => p.status !== 'waived')
  const amount = Math.round(active.reduce((s, p) => s + p.amount, 0) * 100) / 100
  const paid = Math.round(active.reduce((s, p) => s + paidOf(p), 0) * 100) / 100
  return { amount, paid, remaining: Math.round((amount - paid) * 100) / 100 }
})

// 明細↔總帳勾稽（應付明細未付合計 vs 引擎 2112 餘額）
const apTieOut = computed(() => {
  const detailTotal = (payables.value || []).reduce((s, p) => s + remainingOf(p), 0)
  const { byCode } = balancesAsOf(accounting.entries.value, {})
  const b = byCode.get(CODES.PAYABLE) || { debit: 0, credit: 0 }
  const ledgerTotal = Math.round((b.credit - b.debit) * 100) / 100
  return {
    detailTotal: Math.round(detailTotal * 100) / 100,
    ledgerTotal,
    matched: Math.round(detailTotal * 100) === Math.round(ledgerTotal * 100),
  }
})

// ── 列印附表：全年度 科目 → 項目×對象 統計（不受畫面篩選影響）──
const printStats = computed(() => {
  const r2 = (n) => Math.round(n * 100) / 100
  const byCode = new Map()
  for (const p of yearItems.value) {
    const code = p.accountCode || '—'
    if (!byCode.has(code)) byCode.set(code, new Map())
    const items = byCode.get(code)
    const key = `${p.sourceRef}|${p.payee}`
    if (!items.has(key)) items.set(key, { key, item: p.sourceRef, payee: p.payee, count: 0, target: 0, paid: 0, waived: 0 })
    const g = items.get(key)
    g.count++
    if (p.status === 'waived') g.waived += p.amount
    else { g.target += p.amount; g.paid += paidOf(p) }
  }
  return [...byCode.keys()].sort().map(code => {
    const items = [...byCode.get(code).values()]
      .map(g => ({ ...g, target: r2(g.target), paid: r2(g.paid), waived: r2(g.waived), unpaid: r2(g.target - g.paid) }))
      .sort((a, b) => a.item.localeCompare(b.item, 'zh-Hant') || a.payee.localeCompare(b.payee, 'zh-Hant'))
    const sum = (f) => r2(items.reduce((s, g) => s + g[f], 0))
    return {
      code, label: acctLabel(code), items,
      count: items.reduce((s, g) => s + g.count, 0),
      target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived'),
    }
  })
})
const printGrand = computed(() => {
  const r2 = (n) => Math.round(n * 100) / 100
  const sum = (f) => r2(printStats.value.reduce((s, g) => s + g[f], 0))
  return { count: printStats.value.reduce((s, g) => s + g.count, 0), target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived') }
})
function printReport() { window.print() }

// ── 新增 / 編輯 ──
const editModal = ref(false)
const editingItem = ref(null)
const editForm = ref(makeEditForm())

function makeEditForm() {
  return { sourceRef: '', payee: '', amount: '', dueDate: todayStr(), accountCode: null, projectId: null, remark: '' }
}
function openCreateModal() {
  editingItem.value = null
  editForm.value = makeEditForm()
  editModal.value = true
}
function openEditModal(item) {
  editingItem.value = item
  editForm.value = {
    sourceRef: item.sourceRef, payee: item.payee,
    amount: (item.amount ?? '').toString(),
    dueDate: item.dueDate || '', accountCode: item.accountCode || null,
    projectId: item.projectId || null, remark: item.remark || '',
  }
  editModal.value = true
}
async function handleSaveEdit() {
  if (!editForm.value.sourceRef || !editForm.value.payee) {
    Swal.fire({ icon: 'warning', title: '請填寫項目與對象', confirmButtonColor: '#4f46e5' }); return
  }
  if (!editForm.value.accountCode) {
    Swal.fire({ icon: 'warning', title: '請選擇科目', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const payload = {
      sourceRef: editForm.value.sourceRef,
      payee: editForm.value.payee,
      amount: parseFloat(editForm.value.amount) || 0,
      dueDate: editForm.value.dueDate || '',
      accountCode: editForm.value.accountCode,
      projectId: editForm.value.projectId || null,
      remark: editForm.value.remark || '',
    }
    if (editingItem.value) await updatePayable(editingItem.value.id, payload)
    else await createPayable(payload)
    const year = (editForm.value.dueDate || '').substring(0, 4) || selectedYear.value
    if (year !== selectedYear.value) selectedYear.value = year
    await fetchPayables()
    editModal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 付款 ──
const payModal = ref(false)
const payingItem = ref(null)
const payForm = ref({ date: todayStr(), amount: '', account: '一銀帳戶', remark: '' })

function openPayModal(item) {
  payingItem.value = item
  payForm.value = { date: todayStr(), amount: remainingOf(item).toString(), account: '一銀帳戶', remark: '' }
  payModal.value = true
}
async function handlePay() {
  if (!payForm.value.date || !payForm.value.account) {
    Swal.fire({ icon: 'warning', title: '請填寫付款日期與帳戶', confirmButtonColor: '#4f46e5' }); return
  }
  saving.value = true
  try {
    const result = await payPayable(payingItem.value.id, {
      date: payForm.value.date,
      amount: parseFloat(payForm.value.amount) || 0,
      account: payForm.value.account,
      remark: payForm.value.remark,
    })
    await Promise.all([fetchRecords(), fetchPayables()])
    payModal.value = false
    Swal.fire({
      icon: 'success', title: '付款完成',
      html: `已沖抵 NT$ <b>${(result.applied || 0).toLocaleString()}</b>`,
      timer: 1500, showConfirmButton: false,
    })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '付款失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

// ── 免付 / 恢復 / 刪除 ──
async function handleWaive(item) {
  const { value: reason } = await Swal.fire({
    title: '免付確認',
    html: `確定要將「${item.sourceRef}／${item.payee}」標記為免付嗎？`,
    input: 'text', inputLabel: '免付原因（選填）',
    showCancelButton: true, confirmButtonColor: '#6b7280', cancelButtonColor: '#4f46e5',
    confirmButtonText: '確定免付', cancelButtonText: '取消',
  })
  if (reason !== undefined) {
    await waivePayable(item.id, reason || '')
    await fetchPayables()
  }
}
async function handleReopen(item) {
  const result = await Swal.fire({
    title: '恢復為未付',
    html: `確定要將「${item.sourceRef}／${item.payee}」恢復為未付嗎？<br><span class="text-caption">已產生的付款單將一併刪除，帳務自動回復。</span>`,
    icon: 'question',
    showCancelButton: true, confirmButtonColor: '#4f46e5', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定恢復', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    await reopenPayable(item.id)
    await Promise.all([fetchRecords(), fetchPayables()])
  }
}
async function handleDelete(item) {
  const result = await Swal.fire({
    title: '刪除應付帳款',
    html: `確定要刪除「${item.sourceRef}／${item.payee}」嗎？`,
    icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    try {
      await deletePayable(item.id)
      await fetchPayables()
    } catch (e) {
      Swal.fire({ icon: 'error', title: '刪除失敗', text: e.message, confirmButtonColor: '#ef4444' })
    }
  }
}
</script>
