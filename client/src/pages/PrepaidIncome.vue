<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else>
      <!-- 標題 + 年月選擇 -->
      <div class="d-flex flex-wrap justify-space-between align-center mb-6 ga-3">
        <h3 class="text-h6 font-weight-bold d-flex align-center ga-2">
          <v-icon color="success">mdi-piggy-bank</v-icon>
          {{ toMinguoYear(selectedYear) }}年 {{ selectedMonth }}月 預收收入明細表
        </h3>
        <div class="d-flex ga-2">
          <v-select v-model="selectedYear" :items="availableYears" :item-title="y => toMinguoYear(y) + ' 年度'" :item-value="y => y" density="compact" variant="outlined" hide-details style="min-width:120px" />
          <v-select v-model="selectedMonth" :items="months" :item-title="m => m + '月份'" :item-value="m => m" density="compact" variant="outlined" hide-details style="min-width:100px" />
        </div>
      </div>

      <!-- 統計卡片 -->
      <v-card class="mb-6" elevation="0" rounded="lg" style="background:linear-gradient(135deg,#10b981,#3b82f6)">
        <v-card-text class="text-white d-flex align-center ga-4">
          <v-icon size="40">mdi-piggy-bank</v-icon>
          <div>
            <div style="opacity:.8" class="text-body-2">截至 {{ toMinguoYear(selectedYear) }}年{{ selectedMonth }}月 預收收入餘額</div>
            <div class="text-h5 font-weight-bold">NT$ {{ Math.round(totalLiability).toLocaleString() }}</div>
          </div>
        </v-card-text>
      </v-card>

      <!-- 明細表 -->
      <v-card elevation="1">
        <div style="overflow-x:auto">
          <v-table density="compact">
            <thead>
              <tr>
                <th>收款日期</th>
                <th>社友</th>
                <th>項目</th>
                <th>認列區間</th>
                <th class="text-right">原始金額</th>
                <th class="text-right">已認列（累計）</th>
                <th class="text-right text-success">剩餘預收額</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="prepaidRows.length === 0">
                <td colspan="7" class="text-center text-medium-emphasis pa-12">此期間尚無預收收入紀錄</td>
              </tr>
              <tr v-for="r in prepaidRows" :key="r.id" :style="{ opacity: r.remaining === 0 ? 0.55 : 1 }">
                <td>{{ toMinguoDate(r.date) }}</td>
                <td class="font-weight-medium">{{ r.member || '-' }}</td>
                <td>{{ r.item }}</td>
                <td><v-chip size="x-small" color="success" variant="tonal">{{ r.periodText }}</v-chip></td>
                <td class="text-right">{{ Math.round(r.total).toLocaleString() }}</td>
                <td class="text-right text-primary">{{ Math.round(r.recognized).toLocaleString() }}</td>
                <td class="text-right font-weight-bold" :class="r.remaining > 0 ? 'text-success' : 'text-medium-emphasis'">
                  {{ Math.round(r.remaining).toLocaleString() }}
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card>

      <!-- 說明 -->
      <v-row class="mt-4">
        <v-col cols="12" md="6">
          <v-card elevation="0" variant="tonal" color="primary" class="pa-3">
            <div class="d-flex ga-2">
              <v-icon>mdi-history</v-icon>
              <div>
                <div class="font-weight-bold text-body-2">已認列（累計）</div>
                <p class="text-caption text-medium-emphasis mb-0">截至 <strong>{{ toMinguoYear(selectedYear) }}年 {{ selectedMonth }}月</strong> 已轉入各月收支報表中的認列金額。</p>
              </div>
            </div>
          </v-card>
        </v-col>
        <v-col cols="12" md="6">
          <v-card elevation="0" variant="tonal" color="success" class="pa-3">
            <div class="d-flex ga-2">
              <v-icon>mdi-arrow-right</v-icon>
              <div>
                <div class="font-weight-bold text-body-2">預收收入餘額</div>
                <p class="text-caption text-medium-emphasis mb-0">截至 <strong>{{ toMinguoYear(selectedYear) }}年 {{ selectedMonth }}月</strong> 尚未認列為收入的預收項餘額。</p>
              </div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'

const records = inject('records')
const loading = inject('loading')

const months = Array.from({ length: 12 }, (_, i) => i + 1)
const currentYear = new Date().getFullYear().toString()

const selectedYear = ref(currentYear)
const selectedMonth = ref(new Date().getMonth() + 1)

function toMinguoYear(y) { return parseInt(y) - 1911 }
function toMinguoDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${toMinguoYear(y)}-${m}-${d}`
}
function toMinguoMonth(s) {
  if (!s || !s.includes('-')) return s
  const [y, m] = s.split('-')
  return `${toMinguoYear(y)}-${m}`
}
function parsePeriod(item) {
  const match = item.match(/(\d+)-(\d+)月/)
  return match ? { start: parseInt(match[1]), end: parseInt(match[2]) } : null
}
function getTotalMonths(startP, endP) {
  if (!startP || !endP) return 1
  if (startP.includes('-')) {
    const [sY, sM] = startP.split('-').map(Number)
    const [eY, eM] = endP.split('-').map(Number)
    return (eY - sY) * 12 + (eM - sM) + 1
  }
  return parseInt(endP) - parseInt(startP) + 1
}
function getRecognizedMonths(tY, tM, startP, endP, recordDate) {
  if (!startP || !endP) return 0
  const targetStr = `${tY}-${tM.toString().padStart(2, '0')}`
  const total = getTotalMonths(startP, endP)
  if (startP.includes('-')) {
    if (targetStr < startP) return 0
    if (targetStr >= endP) return total
    const [sY, sM] = startP.split('-').map(Number)
    return (tY - sY) * 12 + (tM - sM) + 1
  } else {
    const recYear = parseInt(recordDate.split('-')[0])
    if (tY < recYear) return 0
    if (tY > recYear) return total
    return Math.max(0, Math.min(total, tM - parseInt(startP) + 1))
  }
}

const availableYears = computed(() =>
  [...new Set((records.value || []).map(r => r.date.split('-')[0]))].sort((a, b) => b - a)
)

const prepaidRows = computed(() => {
  const tY = parseInt(selectedYear.value), tM = parseInt(selectedMonth.value)
  const rows = []
  ;(records.value || []).filter(r => r.type === 'income').forEach(r => {
    let startP = r.startPeriod, endP = r.endPeriod
    const isYYYYMM = !!(startP && startP.includes('-'))
    if (startP === undefined && r.startMonth) startP = r.startMonth
    if (endP === undefined && r.endMonth) endP = r.endMonth
    if (startP === undefined) {
      const p = parsePeriod(r.item)
      if (p) { startP = p.start.toString(); endP = p.end.toString() }
    }
    if (!startP) return
    const monthsCount = getTotalMonths(startP, endP)
    const monthly = r.amount / monthsCount
    const recognized = getRecognizedMonths(tY, tM, startP, endP, r.date) * monthly
    const remaining = r.amount - recognized
    const rYear = r.date.split('-')[0]
    const fStart = isYYYYMM ? toMinguoMonth(startP) : `${toMinguoYear(rYear)}-${startP.padStart(2,'0')}`
    const fEnd = isYYYYMM ? toMinguoMonth(endP) : `${toMinguoYear(rYear)}-${endP.padStart(2,'0')}`
    rows.push({ ...r, periodText: `${fStart} ~ ${fEnd}`, total: r.amount, recognized, remaining })
  })
  return rows.sort((a, b) => {
    const aZ = Math.round(a.remaining) === 0, bZ = Math.round(b.remaining) === 0
    if (aZ !== bZ) return aZ ? 1 : -1
    return new Date(b.date) - new Date(a.date)
  })
})

const totalLiability = computed(() => prepaidRows.value.reduce((s, r) => s + r.remaining, 0))
</script>
