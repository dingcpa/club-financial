<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else>
      <!-- 標題列 + 年月選擇 -->
      <div class="d-flex flex-wrap justify-space-between align-center mb-4 ga-2">
        <h3 class="text-body-1 text-sm-h6 font-weight-bold d-flex align-center ga-2">
          <v-icon color="primary" size="20">mdi-wallet</v-icon>
          {{ toMinguoYear(selectedYear) }}年 {{ selectedMonth }}月 收支月報表
        </h3>
        <div class="d-flex ga-2">
          <v-select
            v-model="selectedYear"
            :items="availableYears.length > 0 ? availableYears : [currentYear]"
            :item-title="y => toMinguoYear(y) + ' 年度'"
            :item-value="y => y"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:100px"
          />
          <v-select
            v-model="selectedMonth"
            :items="months"
            :item-title="m => m + '月份'"
            :item-value="m => m"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:90px"
          />
        </div>
      </div>

      <!-- 統計卡片 -->
      <v-row class="mb-4" dense>
        <v-col cols="12" sm="4">
          <v-card color="green-lighten-5" elevation="0" rounded="lg">
            <v-card-text class="text-center pa-3">
              <div class="text-caption text-medium-emphasis mb-1">本月合計收入</div>
              <div class="text-body-1 text-sm-h6 font-weight-bold text-success">NT$ {{ Math.round(totalIncome).toLocaleString() }}</div>
              <v-icon color="success" size="18" class="mt-1">mdi-trending-up</v-icon>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card color="red-lighten-5" elevation="0" rounded="lg">
            <v-card-text class="text-center pa-3">
              <div class="text-caption text-medium-emphasis mb-1">本月合計支出</div>
              <div class="text-body-1 text-sm-h6 font-weight-bold text-error">NT$ {{ Math.round(totalExpense).toLocaleString() }}</div>
              <v-icon color="error" size="18" class="mt-1">mdi-trending-down</v-icon>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" sm="4">
          <v-card color="primary" elevation="0" rounded="lg">
            <v-card-text class="text-center pa-3">
              <div class="text-caption mb-1" style="color:rgba(255,255,255,0.8)">本月收支餘額</div>
              <div class="text-body-1 text-sm-h6 font-weight-bold text-white">NT$ {{ Math.round(balance).toLocaleString() }}</div>
              <v-icon color="white" size="18" class="mt-1">mdi-wallet</v-icon>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- 收支明細表格 -->
      <v-row dense>
        <!-- 收入 -->
        <v-col cols="12" md="6">
          <v-card elevation="1" rounded="lg">
            <v-card-title class="text-success text-body-2 font-weight-bold pb-0 pa-3">收入明細表</v-card-title>
            <v-divider color="success" thickness="2" class="mx-3" />
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-caption">類別</th>
                  <th class="text-caption">項目名稱</th>
                  <th class="text-right text-caption">月計</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="incomeTableData.length === 0">
                  <td colspan="3" class="text-center text-medium-emphasis py-8">無收入紀錄</td>
                </tr>
                <tr
                  v-for="(group, i) in incomeTableData"
                  :key="i"
                  style="cursor:pointer;background:#f0fdf4"
                  @click="detailView = group"
                >
                  <td class="text-caption text-success font-weight-bold">{{ group.category }}</td>
                  <td class="text-body-2">{{ group.name }}</td>
                  <td class="text-right text-body-2 font-weight-bold text-success">{{ Math.round(group.total).toLocaleString() }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>

        <!-- 支出 -->
        <v-col cols="12" md="6">
          <v-card elevation="1" rounded="lg">
            <v-card-title class="text-error text-body-2 font-weight-bold pb-0 pa-3">支出明細表</v-card-title>
            <v-divider color="error" thickness="2" class="mx-3" />
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-caption">類別</th>
                  <th class="text-caption">項目名稱</th>
                  <th class="text-right text-caption">月計</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="expenseTableData.length === 0">
                  <td colspan="3" class="text-center text-medium-emphasis py-8">無支出紀錄</td>
                </tr>
                <tr
                  v-for="(group, i) in expenseTableData"
                  :key="i"
                  style="cursor:pointer;background:#fef2f2"
                  @click="detailView = group"
                >
                  <td class="text-caption text-error font-weight-bold">{{ group.category }}</td>
                  <td class="text-body-2">{{ group.name }}</td>
                  <td class="text-right text-body-2 font-weight-bold text-error">{{ Math.round(group.total).toLocaleString() }}</td>
                </tr>
              </tbody>
            </v-table>
          </v-card>
        </v-col>
      </v-row>

      <!-- 明細 Dialog -->
      <v-dialog v-model="showDetail" :max-width="xs ? undefined : 800" :fullscreen="xs" scrollable>
        <v-card v-if="detailView">
          <v-card-title class="bg-grey-lighten-4 pa-3 pa-sm-4">
            <div class="text-caption text-medium-emphasis">{{ toMinguoYear(selectedYear) }}年 {{ selectedMonth }}月 淨收支</div>
            <div class="text-body-1 font-weight-bold">NT$ {{ Math.round(balance).toLocaleString() }}</div>
            <div class="text-subtitle-2 font-weight-bold">{{ detailView.name }} 明細</div>
            <div class="text-body-2 text-medium-emphasis">
              本月認列合計：
              <strong :class="detailView.type === 'income' ? 'text-success' : 'text-error'">
                NT$ {{ Math.round(detailView.total).toLocaleString() }}
              </strong>
            </div>
          </v-card-title>
          <v-card-text class="pa-2 pa-sm-4">
            <div style="overflow-x:auto">
              <v-table density="compact" class="text-body-2">
                <thead>
                  <tr>
                    <th class="text-caption">日期</th>
                    <th v-if="detailView.type === 'income'" class="text-caption">社友</th>
                    <th class="text-right text-caption">認列額</th>
                    <th class="text-caption">類型</th>
                    <th class="text-caption">備註</th>
                    <th style="width:40px"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(record, i) in detailView.records" :key="record.id || i">
                    <td class="text-caption">{{ toMinguoDate(record.date) }}</td>
                    <td v-if="detailView.type === 'income'" class="text-caption font-weight-medium">{{ record.member || '-' }}</td>
                    <td class="text-right text-caption font-weight-bold" :class="detailView.type === 'income' ? 'text-success' : 'text-error'">
                      {{ Math.round(record.displayAmount).toLocaleString() }}
                    </td>
                    <td>
                      <v-chip v-if="record.isAllocated" size="x-small" color="success" variant="tonal">平攤</v-chip>
                      <span v-else class="text-caption text-medium-emphasis">全額</span>
                    </td>
                    <td class="text-caption" style="max-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ record.remark || '-' }}</td>
                    <td>
                      <v-btn icon size="x-small" variant="text" color="primary" @click="onEditRecord(record)">
                        <v-icon size="16">mdi-pencil</v-icon>
                      </v-btn>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </v-card-text>
          <v-card-actions class="bg-grey-lighten-4 justify-end pa-3">
            <v-btn color="primary" variant="flat" @click="detailView = null">關閉視窗</v-btn>
          </v-card-actions>
        </v-card>
      </v-dialog>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'

const { xs } = useDisplay()

const records = inject('records')
const loading = inject('loading')
const handleEditClick = inject('handleEditClick')

const months = Array.from({ length: 12 }, (_, i) => i + 1)
const currentYear = new Date().getFullYear().toString()
const currentMonth = (new Date().getMonth() + 1).toString()

const selectedYear = ref(currentYear)
const selectedMonth = ref(parseInt(currentMonth))
const detailView = ref(null)
const showDetail = computed({
  get: () => detailView.value !== null,
  set: (v) => { if (!v) detailView.value = null }
})

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }
function toMinguoDate(adDateStr) {
  if (!adDateStr) return ''
  const [y, m, d] = adDateStr.split('-')
  return `${toMinguoYear(y)}-${m}-${d}`
}
function toMinguoMonth(adMonthStr) {
  if (!adMonthStr || !adMonthStr.includes('-')) return adMonthStr
  const [y, m] = adMonthStr.split('-')
  return `${toMinguoYear(y)}-${m}`
}

function parsePeriod(itemName) {
  const match = itemName.match(/(\d+)-(\d+)月/)
  if (match) return { start: parseInt(match[1]), end: parseInt(match[2]) }
  return null
}

function isDashboardMonthInRange(targetY, targetM, startP, endP) {
  if (!startP || !endP) return false
  if (startP.includes('-')) {
    const targetStr = `${targetY}-${targetM.toString().padStart(2, '0')}`
    return targetStr >= startP && targetStr <= endP
  }
  return targetM >= parseInt(startP) && targetM <= parseInt(endP)
}

function getTotalMonthsInRange(startP, endP) {
  if (!startP || !endP) return 1
  if (startP.includes('-')) {
    const [sY, sM] = startP.split('-').map(Number)
    const [eY, eM] = endP.split('-').map(Number)
    return (eY - sY) * 12 + (eM - sM) + 1
  }
  return parseInt(endP) - parseInt(startP) + 1
}

function getIncomeCategory(item) {
  const duesItems = ['1-3月社費', '4-6月社費', '7-9月社費', '10-12月社費', '入社費']
  const redBoxItems = ['授證紅箱', '交接紅箱', '春節紅箱', '母親節紅箱', '父親節紅箱', '中秋節紅箱', '例會歡喜紅箱', '其他紅箱']
  if (duesItems.includes(item)) return '社費收入'
  if (redBoxItems.some(rb => item.includes(rb))) return '紅箱收入'
  return '其他收入'
}

function getExpenseCategory(item) {
  const officeItems = ['辨公室租金及水電', '人事費 -薪資/油資', '文具費', '郵電費', '健保費', '印刷費', '雜費及設備更新', '助秘提撥金']
  const mealItems = ['例會餐費(一般/聯合)', '例會餐費(女賓夕/眷屬聯歡)']
  const activityItems = ['資訊維修費(含地區網站)', '健遊活動', '演講車馬費', '爐邊會', '金蘭聯誼', '高球費用', '職業參觀', '授證之旅補助', '還社長', '研習班']
  if (officeItems.includes(item)) return '辦公室設備費'
  if (mealItems.includes(item)) return '餐費'
  if (activityItems.includes(item)) return '社務活動費'
  return '其他'
}

const availableYears = computed(() =>
  [...new Set((records.value || []).map(r => r.date.split('-')[0]))].sort((a, b) => b - a)
)

const reportData = computed(() => {
  const targetYear = parseInt(selectedYear.value)
  const targetMonth = parseInt(selectedMonth.value)
  let totalIncome = 0, totalExpense = 0
  const incomeGroups = {}, expenseGroups = {}

  ;(records.value || []).forEach(record => {
    if (record.type === 'transfer') return
    const dateParts = record.date.split('-')
    const recordYear = parseInt(dateParts[0])
    const recordMonth = parseInt(dateParts[1])

    let item = record.item
    if (item === '一般例會/聯合例會') item = '例會餐費(一般/聯合)'
    if (item === '女賓夕/眷屬聯歡') item = '例會餐費(女賓夕/眷屬聯歡)'
    if (item === '其他收入-例會歡喜紅箱') item = '例會歡喜紅箱'
    if (item === '其他收入-其他紅箱') item = '其他紅箱'

    let startP = record.startPeriod
    let endP = record.endPeriod
    if (startP === undefined && record.startMonth) startP = record.startMonth
    if (endP === undefined && record.endMonth) endP = record.endMonth
    if (startP === undefined) {
      const p = parsePeriod(item)
      if (p) { startP = p.start.toString(); endP = p.end.toString() }
    }

    const isMonthOnly = startP && !startP.includes('-')
    const sameYear = recordYear === targetYear
    const inRange = startP && endP && (
      (isMonthOnly && sameYear && isDashboardMonthInRange(targetYear, targetMonth, startP, endP)) ||
      (!isMonthOnly && isDashboardMonthInRange(targetYear, targetMonth, startP, endP))
    )

    if (startP && endP) {
      if (inRange) {
        const monthsCount = getTotalMonthsInRange(startP, endP)
        const allocatedAmount = record.amount / monthsCount
        const groups = record.type === 'income' ? incomeGroups : expenseGroups
        if (!groups[item]) groups[item] = { total: 0, records: [] }
        groups[item].records.push({
          ...record, item,
          displayAmount: allocatedAmount,
          isAllocated: true,
          periodNote: isMonthOnly
            ? `(${toMinguoYear(recordYear)}-${startP.padStart(2,'0')} ~ ${toMinguoYear(recordYear)}-${endP.padStart(2,'0')} 平攤)`
            : `(${toMinguoMonth(startP)} ~ ${toMinguoMonth(endP)} 平攤)`
        })
        groups[item].total += allocatedAmount
        if (record.type === 'income') totalIncome += allocatedAmount
        else totalExpense += allocatedAmount
      }
    } else {
      if (recordYear === targetYear && recordMonth === targetMonth) {
        const groups = record.type === 'income' ? incomeGroups : expenseGroups
        if (!groups[item]) groups[item] = { total: 0, records: [] }
        groups[item].records.push({ ...record, item, displayAmount: record.amount })
        groups[item].total += record.amount
        if (record.type === 'income') totalIncome += record.amount
        else totalExpense += record.amount
      }
    }
  })

  return { totalIncome, totalExpense, incomeGroups, expenseGroups }
})

const totalIncome = computed(() => reportData.value.totalIncome)
const totalExpense = computed(() => reportData.value.totalExpense)
const balance = computed(() => totalIncome.value - totalExpense.value)

const incomeTableData = computed(() => {
  return Object.keys(reportData.value.incomeGroups).map(name => ({
    category: getIncomeCategory(name),
    name,
    type: 'income',
    ...reportData.value.incomeGroups[name]
  })).sort((a, b) => {
    const order = { '社費收入': 1, '紅箱收入': 2, '其他收入': 3 }
    if ((order[a.category]||99) !== (order[b.category]||99)) return (order[a.category]||99) - (order[b.category]||99)
    return a.name.localeCompare(b.name, 'zh-Hant')
  })
})

const EXPENSE_CAT_ORDER = { '辦公室設備費': 1, '餐費': 2, '社務活動費': 3, '其他': 4 }
const expenseTableData = computed(() => {
  return Object.keys(reportData.value.expenseGroups).map(name => ({
    category: getExpenseCategory(name),
    name,
    type: 'expense',
    ...reportData.value.expenseGroups[name]
  })).sort((a, b) => {
    if ((EXPENSE_CAT_ORDER[a.category]||99) !== (EXPENSE_CAT_ORDER[b.category]||99))
      return (EXPENSE_CAT_ORDER[a.category]||99) - (EXPENSE_CAT_ORDER[b.category]||99)
    return a.name.localeCompare(b.name, 'zh-Hant')
  })
})

function onEditRecord(record) {
  detailView.value = null
  handleEditClick(record)
}
</script>
