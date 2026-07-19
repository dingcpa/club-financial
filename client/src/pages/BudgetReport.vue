<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-chart-donut</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">收支預算執行表</span>
      </div>
      <div class="d-flex ga-2 align-center">
        <v-btn
          v-if="isAdmin && !editMode" size="small" variant="tonal" color="primary"
          prepend-icon="mdi-pencil" @click="startEdit"
        >編製預算</v-btn>
        <template v-if="editMode">
          <v-btn size="small" variant="text" @click="editMode = false">取消</v-btn>
          <v-btn size="small" variant="flat" color="primary" :loading="saving" prepend-icon="mdi-content-save" @click="handleSave">儲存預算</v-btn>
        </template>
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="min-width:130px"
        />
      </div>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <div class="text-caption text-medium-emphasis mb-3">
        {{ fyLabel(selectedFy) }}（{{ toMinguoDate(fyFrom) }} ~ {{ toMinguoDate(fyTo) }}）。
        累積實際數為引擎權責分錄之年度累計；點金額可查分類帳。
        {{ editMode ? '輸入各科目年度預算後按「儲存預算」。' : '' }}
      </div>

      <v-row dense>
        <v-col v-for="sec in sections" :key="sec.type" cols="12" md="6">
          <div class="text-subtitle-2 font-weight-bold mb-1">{{ sec.label }}</div>
          <v-table density="compact" class="mb-2">
            <thead>
              <tr>
                <th class="text-caption">科目</th>
                <th class="text-caption text-right" style="width:110px">預算</th>
                <th class="text-caption text-right" style="width:110px">累積實際</th>
                <th class="text-caption text-right" style="width:70px">執行率</th>
              </tr>
            </thead>
            <tbody>
              <template v-for="g in sec.groups" :key="g.code">
                <tr style="background:#f8fafc">
                  <td class="text-caption font-weight-medium">{{ g.code }} {{ g.name }}</td>
                  <td class="text-right text-caption font-weight-medium">{{ fmt(g.budget) }}</td>
                  <td class="text-right text-caption font-weight-medium">{{ fmt(g.actual) }}</td>
                  <td class="text-right text-caption">{{ rate(g.actual, g.budget) }}</td>
                </tr>
                <tr v-for="row in g.items" :key="row.code">
                  <td class="text-caption pl-6 text-medium-emphasis">{{ row.code }} {{ row.name }}</td>
                  <td class="text-right text-caption">
                    <v-text-field
                      v-if="editMode"
                      v-model="editBudget[row.code]"
                      type="number" density="compact" variant="outlined" hide-details
                      style="max-width:110px;margin-left:auto"
                    />
                    <span v-else>{{ fmt(row.budget) }}</span>
                  </td>
                  <td
                    class="text-right text-caption"
                    :style="row.actual ? 'cursor:pointer' : ''"
                    @click="row.actual && drill(row.code)"
                  >
                    <span :class="row.actual ? 'text-primary' : 'text-medium-emphasis'">{{ fmt(row.actual) }}</span>
                  </td>
                  <td class="text-right text-caption" :class="overClass(row.actual, row.budget)">{{ rate(row.actual, row.budget) }}</td>
                </tr>
              </template>
              <tr class="font-weight-bold" style="background:#eef2ff">
                <td class="text-caption">{{ sec.label }}合計</td>
                <td class="text-right text-caption">{{ fmt(sec.totalBudget) }}</td>
                <td class="text-right text-caption">{{ fmt(sec.totalActual) }}</td>
                <td class="text-right text-caption">{{ rate(sec.totalActual, sec.totalBudget) }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>

      <!-- 本期結餘 -->
      <v-card variant="tonal" :color="netActual >= 0 ? 'success' : 'error'" class="pa-3 mt-2">
        <div class="d-flex justify-space-between text-caption font-weight-bold">
          <span>本期結餘（收入−支出）</span>
          <span>預算 {{ fmt(netBudget) }}｜實際 {{ fmt(netActual) }}</span>
        </div>
      </v-card>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'
import { incomeStatement } from '../accounting/ledger.js'
import { fyOf, fyLabel, fyRange, toMinguoDate } from '../accounting/fiscal.js'
import { useAuth } from '../composables/useAuth.js'

const accounting = inject('accounting')
const accounts = inject('accounts')
const budgets = inject('budgets')
const saveBudgets = inject('saveBudgets')
const drillDown = inject('drillDown')
const { isAdmin } = useAuth()

const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const editMode = ref(false)
const editBudget = ref({})
const saving = ref(false)

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const e of entries.value) {
    const fy = fyOf(e.date)
    if (fy != null) fys.add(fy)
  }
  for (const b of budgets?.value || []) fys.add(b.fy)
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})

const fyFrom = computed(() => fyRange(selectedFy.value)[0])
const fyTo = computed(() => fyRange(selectedFy.value)[1])

// 年度實際數（權責）：科目 → 金額
const actualByCode = computed(() => {
  const is = incomeStatement(entries.value, acctByCode.value, { from: fyFrom.value, to: fyTo.value })
  const map = {}
  for (const g of [...is.income, ...is.expense]) {
    for (const item of g.items) map[item.code] = item.amount
  }
  return map
})

const budgetByCode = computed(() => {
  const map = {}
  for (const b of budgets?.value || []) {
    if (b.fy === selectedFy.value) map[b.accountCode] = b.amount
  }
  return map
})

// 科目結構：income/expense 葉節點依上層分組（含沒有實際數的科目，供編預算）
function buildSection(type, label) {
  const list = (accounts?.value || []).filter(a => a.active && a.type === type)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  const leaves = list.filter(a => !hasChildren.has(a.code))
  const groups = []
  const parents = list.filter(a => !a.parentCode)
  for (const p of parents) {
    const children = leaves.filter(a => a.parentCode === p.code)
    const items = (children.length ? children : leaves.filter(a => a.code === p.code)).map(a => ({
      code: a.code,
      name: a.name,
      budget: budgetByCode.value[a.code] || 0,
      actual: actualByCode.value[a.code] || 0,
    }))
    if (!items.length) continue
    groups.push({
      code: p.code,
      name: p.name,
      items,
      budget: items.reduce((s, x) => s + x.budget, 0),
      actual: items.reduce((s, x) => s + x.actual, 0),
    })
  }
  const totalBudget = groups.reduce((s, g) => s + g.budget, 0)
  const totalActual = groups.reduce((s, g) => s + g.actual, 0)
  return { type, label, groups, totalBudget, totalActual }
}

const sections = computed(() => [buildSection('income', '收入'), buildSection('expense', '支出')])
const netBudget = computed(() => sections.value[0].totalBudget - sections.value[1].totalBudget)
const netActual = computed(() => sections.value[0].totalActual - sections.value[1].totalActual)

function fmt(n) { return n ? Math.round(n).toLocaleString() : '—' }
function rate(actual, budget) {
  if (!budget) return '—'
  return `${Math.round((actual / budget) * 100)}%`
}
function overClass(actual, budget) {
  if (!budget) return ''
  return actual > budget ? 'text-error font-weight-bold' : ''
}

function drill(code) {
  drillDown({ accountCode: code, fy: selectedFy.value, month: null })
}

function startEdit() {
  const init = {}
  for (const sec of sections.value) {
    for (const g of sec.groups) {
      for (const row of g.items) init[row.code] = row.budget || ''
    }
  }
  editBudget.value = init
  editMode.value = true
}

async function handleSave() {
  saving.value = true
  try {
    const rows = Object.entries(editBudget.value)
      .map(([accountCode, amount]) => ({ accountCode, amount: parseFloat(amount) || 0 }))
      .filter(r => r.amount > 0)
    await saveBudgets(selectedFy.value, rows)
    editMode.value = false
    Swal.fire({ icon: 'success', title: '預算已儲存', timer: 1200, showConfirmButton: false })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}
</script>
