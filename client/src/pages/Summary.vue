<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-chart-bar</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">收支月報表</span>
      </div>
      <div class="d-flex ga-2">
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="min-width:130px"
        />
        <v-select
          v-model="selectedMonth" :items="monthOptions" density="compact" variant="outlined" hide-details
          style="min-width:100px"
        />
      </div>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <v-alert v-if="isLegacyPeriod" color="warning" variant="tonal" density="compact" icon="mdi-history" class="mb-3">
        <span class="text-caption">此期間在帳務基準日（{{ baseDate }}）之前，以歷史單據直接彙總呈現（收付實現＋跨期平攤）。</span>
      </v-alert>

      <div v-if="loading" class="text-center pa-12">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <template v-else>
        <!-- 摘要卡 -->
        <v-row dense class="mb-3">
          <v-col cols="4">
            <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">本月收入</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-success">NT$ {{ report.totalIncome.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="4">
            <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">本月支出</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-error">NT$ {{ report.totalExpense.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="4">
            <v-card :color="report.net >= 0 ? 'primary' : 'warning'" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">本月餘絀</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold" :class="report.net >= 0 ? 'text-primary' : 'text-warning'">
                NT$ {{ report.net.toLocaleString() }}
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- 收入 -->
        <div class="text-subtitle-2 font-weight-bold mb-1 text-success">收入</div>
        <v-table density="compact" class="mb-4">
          <thead>
            <tr>
              <th>科目</th>
              <th class="text-right" style="width:130px">本月</th>
              <th class="text-right d-none d-sm-table-cell" style="width:130px">年度累計</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="g in report.income" :key="g.code">
              <tr style="cursor:pointer" @click="clickRow(g)">
                <td class="text-caption font-weight-bold">{{ g.name }}</td>
                <td class="text-right text-caption font-weight-bold">{{ g.amount.toLocaleString() }}</td>
                <td class="text-right text-caption text-medium-emphasis d-none d-sm-table-cell">{{ ytdOf(g.code, 'income').toLocaleString() }}</td>
              </tr>
              <tr v-for="it in subItemsOf(g)" :key="it.code" style="cursor:pointer" @click="clickRow(it)">
                <td class="text-caption pl-8">{{ it.name }}</td>
                <td class="text-right text-caption">{{ it.amount.toLocaleString() }}</td>
                <td class="text-right text-caption text-medium-emphasis d-none d-sm-table-cell">{{ ytdOf(it.code, 'income').toLocaleString() }}</td>
              </tr>
            </template>
            <tr v-if="!report.income.length">
              <td colspan="3" class="text-center text-medium-emphasis pa-4">本月無收入</td>
            </tr>
            <tr class="font-weight-bold" style="background:#f0fdf4">
              <td class="text-caption">收入合計</td>
              <td class="text-right text-caption">{{ report.totalIncome.toLocaleString() }}</td>
              <td class="text-right text-caption d-none d-sm-table-cell">{{ ytdReport.totalIncome.toLocaleString() }}</td>
            </tr>
          </tbody>
        </v-table>

        <!-- 支出 -->
        <div class="text-subtitle-2 font-weight-bold mb-1 text-error">支出</div>
        <v-table density="compact">
          <thead>
            <tr>
              <th>科目</th>
              <th class="text-right" style="width:130px">本月</th>
              <th class="text-right d-none d-sm-table-cell" style="width:130px">年度累計</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="g in report.expense" :key="g.code">
              <tr style="cursor:pointer" @click="clickRow(g)">
                <td class="text-caption font-weight-bold">{{ g.name }}</td>
                <td class="text-right text-caption font-weight-bold">{{ g.amount.toLocaleString() }}</td>
                <td class="text-right text-caption text-medium-emphasis d-none d-sm-table-cell">{{ ytdOf(g.code, 'expense').toLocaleString() }}</td>
              </tr>
              <tr v-for="it in subItemsOf(g)" :key="it.code" style="cursor:pointer" @click="clickRow(it)">
                <td class="text-caption pl-8">{{ it.name }}</td>
                <td class="text-right text-caption">{{ it.amount.toLocaleString() }}</td>
                <td class="text-right text-caption text-medium-emphasis d-none d-sm-table-cell">{{ ytdOf(it.code, 'expense').toLocaleString() }}</td>
              </tr>
            </template>
            <tr v-if="!report.expense.length">
              <td colspan="3" class="text-center text-medium-emphasis pa-4">本月無支出</td>
            </tr>
            <tr class="font-weight-bold" style="background:#fef2f2">
              <td class="text-caption">支出合計</td>
              <td class="text-right text-caption">{{ report.totalExpense.toLocaleString() }}</td>
              <td class="text-right text-caption d-none d-sm-table-cell">{{ ytdReport.totalExpense.toLocaleString() }}</td>
            </tr>
          </tbody>
        </v-table>
      </template>
    </v-card-text>

    <!-- 歷史模式 drill-down：該科目本月明細 -->
    <v-dialog v-model="legacyDetail.show" :max-width="xs ? undefined : 560" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ legacyDetail.title }}</span>
          <v-btn icon variant="text" @click="legacyDetail.show = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-table density="compact">
            <thead>
              <tr>
                <th>日期</th><th>摘要</th><th>社友</th>
                <th class="text-right">認列額</th><th class="text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in legacyDetail.rows" :key="row.record.id">
                <td class="text-caption text-medium-emphasis">{{ toMinguoDate(row.record.date) }}</td>
                <td class="text-caption">{{ row.record.item }}</td>
                <td class="text-caption">{{ row.record.member }}</td>
                <td class="text-right text-caption">
                  {{ row.amount.toLocaleString() }}
                  <v-chip v-if="row.allocated" size="x-small" variant="tonal" color="success" class="ml-1">平攤</v-chip>
                </td>
                <td class="text-center">
                  <v-btn icon size="x-small" variant="text" color="primary" @click="editLegacy(row.record)">
                    <v-icon size="16">mdi-pencil</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import { incomeStatement } from '../accounting/ledger.js'
import { resolveRecordAccount } from '../accounting/coa.js'
import { fyOf, fyLabel, fyMonths, fyRange, monthEnd, monthsBetween, toMinguoDate } from '../accounting/fiscal.js'

const { xs } = useDisplay()

const records = inject('records')
const loading = inject('loading')
const accounting = inject('accounting')
const drillDown = inject('drillDown')
const handleEditClick = inject('handleEditClick')

const baseDate = computed(() => accounting.baseDate.value)
const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

// ── 期間選擇（扶輪年度＋月份）──
const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const selectedMonth = ref(today.slice(0, 7))

const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const r of records.value || []) {
    const fy = fyOf(r.date)
    if (fy != null) fys.add(fy)
  }
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})
const monthOptions = computed(() =>
  fyMonths(selectedFy.value).map(ym => ({ title: `${Number(ym.slice(5))} 月`, value: ym }))
)

const monthFrom = computed(() => `${selectedMonth.value}-01`)
const monthTo = computed(() => monthEnd(selectedMonth.value))
const isLegacyPeriod = computed(() => monthTo.value <= baseDate.value)

// ── 引擎模式（基準日後：權責認列）──
const engineReport = computed(() =>
  incomeStatement(entries.value, acctByCode.value, { from: monthFrom.value, to: monthTo.value })
)
const ytdReportEngine = computed(() =>
  incomeStatement(entries.value, acctByCode.value, { from: fyRange(selectedFy.value)[0], to: monthTo.value })
)

// ── 歷史模式（基準日前：單據直接彙總，跨期平攤/當月全額）──
// 以科目分類（新單據看 accountCode、舊單據 fallback item 對照），結構與引擎模式一致
function legacyContributions(targetYm) {
  const rows = [] // { record, code, amount, allocated }
  for (const r of records.value || []) {
    if (r.type !== 'income' && r.type !== 'expense') continue
    if (r.sourceReceivableId) continue // 收款單不屬損益
    const code = resolveRecordAccount(r) || (r.type === 'income' ? '4104' : '5900')
    if (!(code.startsWith('4') || code.startsWith('5'))) continue // 代收/暫收不屬損益
    let startP = r.startPeriod || null
    let endP = r.endPeriod || null
    // 相容最舊資料：從 item 名稱解析 N-M月（以單據年份為準）
    if (!startP) {
      const m = (r.item || '').match(/(\d{1,2})-(\d{1,2})月/)
      if (m) {
        const y = r.date.slice(0, 4)
        startP = `${y}-${String(m[1]).padStart(2, '0')}`
        endP = `${y}-${String(m[2]).padStart(2, '0')}`
      }
    }
    if (startP && endP && startP <= endP) {
      const months = monthsBetween(startP, endP)
      if (months.includes(targetYm)) {
        rows.push({ record: r, code, amount: Math.round((r.amount / months.length) * 100) / 100, allocated: true })
      }
    } else if (r.date.slice(0, 7) === targetYm) {
      rows.push({ record: r, code, amount: r.amount, allocated: false })
    }
  }
  return rows
}

function legacyReportFor(rows) {
  const agg = new Map()
  for (const { code, amount } of rows) {
    agg.set(code, (agg.get(code) || 0) + amount)
  }
  const section = (type) => {
    const groups = new Map()
    for (const [code, amount] of agg) {
      const acct = acctByCode.value[code]
      if (!acct || acct.type !== type || !amount) continue
      const parent = acct.parentCode && acctByCode.value[acct.parentCode] ? acctByCode.value[acct.parentCode] : acct
      if (!groups.has(parent.code)) groups.set(parent.code, { code: parent.code, name: parent.name, amount: 0, items: [] })
      const g = groups.get(parent.code)
      g.amount = Math.round((g.amount + amount) * 100) / 100
      g.items.push({ code, name: acct.name, amount: Math.round(amount * 100) / 100 })
    }
    const out = [...groups.values()].sort((a, b) => a.code.localeCompare(b.code))
    for (const g of out) g.items.sort((a, b) => a.code.localeCompare(b.code))
    return out
  }
  const income = section('income')
  const expense = section('expense')
  const totalIncome = Math.round(income.reduce((s, g) => s + g.amount, 0) * 100) / 100
  const totalExpense = Math.round(expense.reduce((s, g) => s + g.amount, 0) * 100) / 100
  return { income, expense, totalIncome, totalExpense, net: Math.round((totalIncome - totalExpense) * 100) / 100 }
}

const legacyRows = computed(() => legacyContributions(selectedMonth.value))
const legacyReport = computed(() => legacyReportFor(legacyRows.value))
const legacyYtd = computed(() => {
  const [fromDate] = fyRange(selectedFy.value)
  const months = monthsBetween(fromDate.slice(0, 7), selectedMonth.value)
  return legacyReportFor(months.flatMap(m => legacyContributions(m)))
})

// ── 對外統一介面 ──
const report = computed(() => (isLegacyPeriod.value ? legacyReport.value : engineReport.value))
const ytdReport = computed(() => (isLegacyPeriod.value ? legacyYtd.value : ytdReportEngine.value))

function ytdOf(code, type) {
  for (const g of ytdReport.value[type]) {
    if (g.code === code) return g.amount
    const it = g.items?.find(x => x.code === code)
    if (it) return it.amount
  }
  return 0
}

// 群組只有同代碼一個細項時不重複列出
function subItemsOf(g) {
  if (!g.items) return []
  if (g.items.length === 1 && g.items[0].code === g.code) return []
  return g.items
}

// ── Drill-down ──
const legacyDetail = ref({ show: false, title: '', rows: [] })

function clickRow(row) {
  if (isLegacyPeriod.value) {
    const codes = row.items ? row.items.map(i => i.code) : [row.code]
    legacyDetail.value = {
      show: true,
      title: `${row.name}（${Number(selectedMonth.value.slice(5))} 月認列明細）`,
      rows: legacyRows.value.filter(r => codes.includes(r.code)),
    }
  } else {
    const code = row.items && row.items.length ? row.items[0].code : row.code
    drillDown({ accountCode: code, fy: selectedFy.value, month: selectedMonth.value })
  }
}

function editLegacy(record) {
  legacyDetail.value.show = false
  handleEditClick(record)
}
</script>
