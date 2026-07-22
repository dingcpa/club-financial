<template>
  <div>
    <!-- 報表頁首 -->
    <v-card elevation="1" class="mb-3">
      <v-card-text class="pa-4 pa-sm-5">
        <div class="d-flex flex-wrap justify-space-between align-start ga-2">
          <div>
            <div class="text-body-2">
              <span class="font-weight-bold">嘉義中區扶輪社</span>
              <span class="text-medium-emphasis"> Rotary Club of Chiayi Central ・ 國際扶輪 3470 地區</span>
            </div>
            <h1 class="text-h5 text-sm-h4 font-weight-bold mt-1">收支月報表</h1>
            <div class="text-caption text-medium-emphasis mt-2">
              報表期間　民國 {{ minguoLabel }}（{{ selectedMonth }}）　・　幣別：新臺幣 NT$　・　認列基礎：權責發生制（分攤項目按月平攤）
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2 align-center">
            <v-select
              v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
              style="min-width:130px"
            />
            <v-select
              v-model="selectedMonth" :items="monthOptions" density="compact" variant="outlined" hide-details
              style="min-width:96px"
            />
            <v-btn color="primary" variant="tonal" prepend-icon="mdi-printer" @click="printReport">產生 PDF / 列印</v-btn>
          </div>
        </div>
      </v-card-text>
    </v-card>

    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>

    <template v-else>
      <!-- 摘要卡 -->
      <v-row dense class="mb-3">
        <v-col cols="12" sm="4">
          <v-card elevation="1" class="pa-3 pa-sm-4" style="border-left:4px solid #15803d">
            <div class="text-caption"><span style="color:#15803d">■</span> 本月合計收入</div>
            <div class="mt-1"><span class="text-caption text-medium-emphasis">NT$</span>
              <span class="text-h5 font-weight-bold" style="color:#15803d">{{ fmt(totalIncome) }}</span></div>
            <div class="text-caption text-medium-emphasis mt-1">{{ incomeCaption }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card elevation="1" class="pa-3 pa-sm-4" style="border-left:4px solid #b91c1c">
            <div class="text-caption"><span style="color:#b91c1c">■</span> 本月合計支出</div>
            <div class="mt-1"><span class="text-caption text-medium-emphasis">NT$</span>
              <span class="text-h5 font-weight-bold" style="color:#b91c1c">{{ fmt(totalExpense) }}</span></div>
            <div class="text-caption text-medium-emphasis mt-1">{{ expenseCaption }}</div>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card elevation="1" class="pa-3 pa-sm-4" style="border-left:4px solid #1d4ed8">
            <div class="text-caption"><span style="color:#1d4ed8">■</span> 本月收支餘額</div>
            <div class="mt-1"><span class="text-caption text-medium-emphasis">NT$</span>
              <span class="text-h5 font-weight-bold" :style="`color:${net >= 0 ? '#15803d' : '#b91c1c'}`">{{ fmt(net) }}</span></div>
            <div class="text-caption text-medium-emphasis mt-1">收入 − 支出（本月淨{{ net >= 0 ? '餘絀' : '短絀' }}）</div>
          </v-card>
        </v-col>
      </v-row>

      <!-- 雙欄明細表 -->
      <v-row dense class="mb-3">
        <!-- 收入明細表 -->
        <v-col cols="12" md="6">
          <v-card elevation="1">
            <div class="d-flex justify-space-between align-center pa-3 pa-sm-4" style="border-bottom:2px solid #15803d">
              <span class="text-body-1 font-weight-bold">收入明細表</span>
              <span class="text-body-1 font-weight-bold" style="color:#15803d">NT$ {{ fmt(totalIncome) }}</span>
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-caption">項目名稱</th>
                  <th class="text-caption text-right" style="width:120px">月計</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="sec in incomeSections" :key="sec.code">
                  <tr style="background:#eff6ff" :style="sec.amount ? 'cursor:pointer' : ''" @click="sec.amount && drillTo(sec.code)">
                    <td class="text-caption font-weight-bold" style="color:#1d4ed8">{{ sec.name }}</td>
                    <td class="text-right text-caption font-weight-bold" style="color:#1d4ed8">{{ fmt(sec.amount) }}</td>
                  </tr>
                  <tr
                    v-for="it in sec.items" :key="it.label"
                    :style="it.amount ? 'cursor:pointer' : ''"
                    :class="it.amount ? '' : 'text-disabled'"
                    @click="it.amount && drillTo(sec.code)"
                  >
                    <td class="text-caption pl-6">{{ it.label }}</td>
                    <td class="text-right text-caption" :style="it.amount ? 'color:#15803d' : ''">{{ fmt(it.amount) }}</td>
                  </tr>
                </template>
              </tbody>
            </v-table>
          </v-card>
        </v-col>

        <!-- 支出明細表 -->
        <v-col cols="12" md="6">
          <v-card elevation="1">
            <div class="d-flex justify-space-between align-center pa-3 pa-sm-4" style="border-bottom:2px solid #b91c1c">
              <span class="text-body-1 font-weight-bold">支出明細表</span>
              <span class="text-body-1 font-weight-bold" style="color:#b91c1c">NT$ {{ fmt(totalExpense) }}</span>
            </div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-caption">項目名稱</th>
                  <th class="text-caption text-right" style="width:120px">月計</th>
                </tr>
              </thead>
              <tbody>
                <template v-for="grp in expenseGroups" :key="grp.code">
                  <tr style="background:#eff6ff" :style="grp.amount ? 'cursor:pointer' : ''" @click="grp.amount && drillTo(grp.items[0]?.code || grp.code)">
                    <td class="text-caption font-weight-bold" style="color:#1d4ed8">{{ grp.name }}</td>
                    <td class="text-right text-caption font-weight-bold" style="color:#1d4ed8">{{ fmt(grp.amount) }}</td>
                  </tr>
                  <tr
                    v-for="it in grp.items" :key="it.code"
                    :style="it.amount ? 'cursor:pointer' : ''"
                    :class="it.amount ? '' : 'text-disabled'"
                    @click="it.amount && drillTo(it.code)"
                  >
                    <td class="text-caption pl-6">{{ it.name }}</td>
                    <td class="text-right text-caption" :style="it.amount ? 'color:#b91c1c' : ''">{{ fmt(it.amount) }}</td>
                  </tr>
                </template>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>

      <!-- 底部結餘條：本月結餘＋上月結餘＝累計結餘 -->
      <v-card elevation="1" class="mb-3">
        <v-row dense class="pa-2 pa-sm-3" align="center">
          <v-col cols="12" sm="4" style="border-right:1px solid #e2e8f0">
            <div class="pa-2">
              <div class="text-caption">本月結餘</div>
              <div class="text-h6 font-weight-bold" :style="`color:${net >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(net) }}</div>
              <div class="text-caption text-medium-emphasis">收入 {{ fmt(totalIncome) }} − 支出 {{ fmt(totalExpense) }}</div>
            </div>
          </v-col>
          <v-col cols="12" sm="4" style="border-right:1px solid #e2e8f0">
            <div class="pa-2">
              <div class="text-caption">＋ 上月結餘</div>
              <div class="text-h6 font-weight-bold" :style="`color:${prevCumNet >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(prevCumNet) }}</div>
              <div class="text-caption text-medium-emphasis">年度 7/1 起累計至上月底</div>
            </div>
          </v-col>
          <v-col cols="12" sm="4">
            <div class="pa-2">
              <div class="text-caption">＝ 累計結餘</div>
              <div class="text-h6 font-weight-bold" :style="`color:${cumNet >= 0 ? '#15803d' : '#b91c1c'}`">NT$ {{ fmt(cumNet) }}</div>
              <div class="text-caption text-medium-emphasis">本年度累計淨{{ cumNet >= 0 ? '餘絀' : '短絀' }}</div>
            </div>
          </v-col>
        </v-row>
      </v-card>

      <!-- 頁尾說明 -->
      <div class="text-caption text-medium-emphasis px-1" style="line-height:1.9">
        <div><b>說明</b>：本表涵蓋全部收入／支出會計科目；本月無金額之科目以灰階列示為 0，以利完整檢視科目結構。點擊有金額的列可查閱分類帳與傳票。</div>
        <div><b>認列原則</b>：季繳社費於開單時列預收社費、逐月轉列收入；跨月分攤之預收預付項目按月平攤認列（權責發生制），「月計」為當月認列額而非現金收付額。</div>
      </div>
    </template>

    <!-- 列印版（無金額項目不列示） -->
    <PrintSheet>
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
      <div class="print-title">收支月報表</div>
      <div class="print-meta">報表期間　民國 {{ minguoLabel }}　・　幣別：新臺幣 NT$　・　認列基礎：權責發生制</div>

      <div class="print-section-title">收入明細</div>
      <table>
        <thead>
          <tr><th>項目名稱</th><th class="num" style="width:130px">月計</th></tr>
        </thead>
        <tbody>
          <template v-for="sec in printIncomeSections" :key="sec.code">
            <tr class="group"><td>{{ sec.name }}</td><td class="num">{{ fmt(sec.amount) }}</td></tr>
            <tr v-for="it in sec.items" :key="it.label">
              <td style="padding-left:22px">{{ it.label }}</td><td class="num">{{ fmt(it.amount) }}</td>
            </tr>
          </template>
          <tr class="total"><td>收入合計</td><td class="num">{{ fmt(totalIncome) }}</td></tr>
        </tbody>
      </table>

      <div class="print-section-title">支出明細</div>
      <table>
        <thead>
          <tr><th>項目名稱</th><th class="num" style="width:130px">月計</th></tr>
        </thead>
        <tbody>
          <template v-for="grp in printExpenseGroups" :key="grp.code">
            <tr class="group"><td>{{ grp.name }}</td><td class="num">{{ fmt(grp.amount) }}</td></tr>
            <tr v-for="it in grp.items" :key="it.code">
              <td style="padding-left:22px">{{ it.name }}</td><td class="num">{{ fmt(it.amount) }}</td>
            </tr>
          </template>
          <tr class="total"><td>支出合計</td><td class="num">{{ fmt(totalExpense) }}</td></tr>
        </tbody>
      </table>

      <table>
        <tbody>
          <tr class="total">
            <td>本月結餘</td><td class="num" style="width:130px">{{ fmt(net) }}</td>
          </tr>
          <tr>
            <td>＋ 上月結餘（年度 7/1 起累計至上月底）</td><td class="num">{{ fmt(prevCumNet) }}</td>
          </tr>
          <tr class="total">
            <td>＝ 累計結餘（本年度累計淨餘絀）</td><td class="num">{{ fmt(cumNet) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="print-footer">認列原則：權責發生制；季繳社費於開單時列預收社費、逐月轉列收入。無金額之科目不列示。</div>
      <div class="print-sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>
    </PrintSheet>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { fyOf, fyLabel, fyMonths, monthEnd, toMinguoYear } from '../accounting/fiscal.js'
import { reportItemLabel } from '../accounting/coa.js'
import PrintSheet from '../components/PrintSheet.vue'

const records = inject('records')
const receivables = inject('receivables')
const duesSettings = inject('duesSettings')
const loading = inject('loading')
const accounting = inject('accounting')
const drillDown = inject('drillDown')

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

// ── 期間選擇（扶輪年度＋月份）──
const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const selectedMonth = ref(today.slice(0, 7))

const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const e of entries.value) {
    const fy = fyOf(e.date)
    if (fy != null) fys.add(fy)
  }
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})
const monthOptions = computed(() =>
  fyMonths(selectedFy.value).map(ym => ({ title: `${Number(ym.slice(5))} 月`, value: ym }))
)
const minguoLabel = computed(() => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return `${toMinguoYear(y)} 年 ${m} 月`
})

const monthFrom = computed(() => `${selectedMonth.value}-01`)
const monthTo = computed(() => monthEnd(selectedMonth.value))

const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const r2 = (n) => Math.round(n * 100) / 100

// ── 當月分錄彙總：科目金額 ＋ 收入科目的項目明細 ──
const recordsById = computed(() => new Map((records.value || []).map(r => [r.id, r])))
const receivablesById = computed(() => new Map((receivables.value || []).map(r => [r.id, r])))

function entryItemLabel(e) {
  const id = String(e.id)
  if (id.startsWith('fin-')) return recordsById.value.get(e.sourceId)?.item || e.description
  if (id.startsWith('rcv-')) return receivablesById.value.get(e.sourceId)?.sourceRef || e.description
  if (e.sourceType === 'manual') return '手工傳票調整'
  return e.description
}

const monthAgg = computed(() => {
  const byAccount = new Map()   // code → amount（收入貸餘/費用借餘為正）
  const incomeItems = new Map() // code → Map(label → amount)
  for (const e of entries.value) {
    if (e.sourceType === 'closing') continue
    if (e.date < monthFrom.value || e.date > monthTo.value) continue
    for (const l of e.lines) {
      const acct = acctByCode.value[l.accountCode]
      if (!acct || (acct.type !== 'income' && acct.type !== 'expense')) continue
      const amt = acct.type === 'income' ? (l.credit || 0) - (l.debit || 0) : (l.debit || 0) - (l.credit || 0)
      if (!amt) continue
      byAccount.set(l.accountCode, r2((byAccount.get(l.accountCode) || 0) + amt))
      if (acct.type === 'income') {
        if (!incomeItems.has(l.accountCode)) incomeItems.set(l.accountCode, new Map())
        const m = incomeItems.get(l.accountCode)
        // 顯示合併：社費四項（會費/服務基金/餐費/固定紅箱）→ X-X月社費、歡喜紅箱各項 → 歡喜紅箱
        const label = reportItemLabel(entryItemLabel(e))
        m.set(label, r2((m.get(label) || 0) + amt))
      }
    }
  }
  return { byAccount, incomeItems }
})

// 葉節點清單（依 chart 排序）
function leaves(type) {
  const list = Object.values(acctByCode.value).filter(a => a.type === type && a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  return list.filter(a => !hasChildren.has(a.code)).sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code))
}

// ── 收入區段：每個收入科目一組，項目＝帳款類別目錄 ∪ 實際發生項目 ──
const incomeSections = computed(() => {
  const { byAccount, incomeItems } = monthAgg.value
  return leaves('income').map(a => {
    const amount = byAccount.get(a.code) || 0
    const actual = incomeItems.get(a.code) || new Map()
    // 目錄：帳款類別設定中掛此科目者（未開單月份顯示灰色 0，如樣張）
    const catalog = (duesSettings.value || [])
      .filter(s => (s.accountCode || '') === a.code)
      .map(s => reportItemLabel(s.category))
    const labels = [...new Set([...catalog, ...actual.keys()])]
    const items = labels.map(label => ({ label, amount: actual.get(label) || 0 }))
    if (!items.length) items.push({ label: a.name, amount })
    return { code: a.code, name: a.name, amount, items }
  })
})

// ── 支出區段：上層科目分組 → 細項（無細項科目自成一組）──
const expenseGroups = computed(() => {
  const { byAccount } = monthAgg.value
  const list = Object.values(acctByCode.value).filter(a => a.type === 'expense' && a.active)
  const parents = list.filter(a => !a.parentCode).sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code))
  return parents.map(p => {
    const children = list.filter(a => a.parentCode === p.code)
      .sort((a, b) => (a.sortOrder - b.sortOrder) || a.code.localeCompare(b.code))
    const items = (children.length ? children : [p]).map(a => ({
      code: a.code, name: a.name, amount: byAccount.get(a.code) || 0,
    }))
    const amount = r2(items.reduce((s, x) => s + x.amount, 0))
    return { code: p.code, name: p.name, amount, items }
  })
})

// ── 合計與組成說明 ──
const totalIncome = computed(() => r2(incomeSections.value.reduce((s, x) => s + x.amount, 0)))
const totalExpense = computed(() => r2(expenseGroups.value.reduce((s, x) => s + x.amount, 0)))
const net = computed(() => r2(totalIncome.value - totalExpense.value))

// 上月結餘：扶輪年度 7/1 起累計至上月底的淨餘絀（7 月為 0，每年度歸零）
const prevCumNet = computed(() => {
  const fyStart = `${selectedFy.value}-07-01`
  const end = monthFrom.value
  if (end <= fyStart) return 0
  let acc = 0
  for (const e of entries.value) {
    if (e.sourceType === 'closing') continue
    if (e.date < fyStart || e.date >= end) continue
    for (const l of e.lines) {
      const acct = acctByCode.value[l.accountCode]
      if (!acct) continue
      if (acct.type === 'income') acc += (l.credit || 0) - (l.debit || 0)
      else if (acct.type === 'expense') acc -= (l.debit || 0) - (l.credit || 0)
    }
  }
  return r2(acc)
})
const cumNet = computed(() => r2(net.value + prevCumNet.value))

// ── 列印版資料：無金額的項目與空組不列示 ──
const printIncomeSections = computed(() => incomeSections.value
  .filter(s => s.amount)
  .map(s => ({ ...s, items: s.items.filter(it => it.amount) })))
const printExpenseGroups = computed(() => expenseGroups.value
  .filter(g => g.amount)
  .map(g => ({ ...g, items: g.items.filter(it => it.amount) })))

function printReport() {
  window.print()
}

const shortName = (name) => name.replace(/(收入|支出|費)$/, '') || name

const incomeCaption = computed(() => {
  const parts = incomeSections.value.filter(s => s.amount).map(s => shortName(s.name))
  return parts.length ? parts.join('・') : '—'
})
const expenseCaption = computed(() => {
  const parts = expenseGroups.value.filter(g => g.amount).map(g => shortName(g.name))
  return parts.length ? parts.join('・') : '—'
})

// ── Drill-down ──
function drillTo(code) {
  drillDown({ accountCode: code, fy: selectedFy.value, month: selectedMonth.value })
}
</script>
