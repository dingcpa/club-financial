<template>
  <div>
    <v-card elevation="1" class="mb-3">
      <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
        <v-icon color="error">mdi-gift-outline</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">紅箱統計</span>
        <v-spacer />
        <v-select
          v-model="selectedItem" :items="itemOptions" density="compact" variant="outlined" hide-details
          clearable placeholder="全部項目" style="min-width:170px"
        />
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="min-width:140px"
        />
      </v-card-title>
      <v-card-text class="pt-0 px-3 px-sm-4 pb-3">
        <span class="text-caption text-medium-emphasis">
          彙總紅箱收入（4102）：列＝社友、欄＝月份。含 LINE 財務精靈結算與手動登錄的紅箱收款。
        </span>
      </v-card-text>
    </v-card>

    <!-- 未結算場次提醒 -->
    <v-alert v-if="pendingSessions.length" color="warning" variant="tonal" density="compact" icon="mdi-alert-circle-outline" class="mb-3">
      <div class="text-caption">
        LINE 紅箱有 <b>{{ pendingSessions.length }}</b> 場未結算（合計 NT$ <b>{{ pendingSessionTotal.toLocaleString() }}</b>）：
        <span v-for="s in pendingSessions" :key="s.sourceId" class="mr-2">{{ s.date }}（{{ s.rows.length }} 筆）</span>
        — 請至 LINE 群組輸入「/紅箱結算」入帳。
      </div>
    </v-alert>

    <v-card elevation="1">
      <div style="overflow:auto; max-height:calc(100vh - 300px)">
        <v-table density="compact" style="min-width:900px">
          <thead>
            <tr>
              <th class="text-caption" style="min-width:90px;position:sticky;left:0;background:white;z-index:2">社友</th>
              <th v-for="ym in months" :key="ym" class="text-caption text-right" style="min-width:64px">
                {{ Number(ym.slice(5)) }} 月
              </th>
              <th class="text-caption text-right font-weight-bold" style="min-width:90px;border-left:1px solid #e2e8f0">合計</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!matrix.rows.length">
              <td :colspan="months.length + 2" class="text-center text-medium-emphasis pa-8">本年度尚無紅箱收入</td>
            </tr>
            <tr v-for="row in matrix.rows" :key="row.member">
              <td class="text-caption font-weight-medium" style="position:sticky;left:0;background:white;z-index:1">{{ row.member }}</td>
              <td v-for="ym in months" :key="ym" class="text-right text-caption" :class="row.byMonth[ym] ? '' : 'text-disabled'">
                {{ row.byMonth[ym] ? row.byMonth[ym].toLocaleString() : '—' }}
              </td>
              <td class="text-right text-caption font-weight-bold" style="color:#b91c1c;border-left:1px solid #e2e8f0">{{ row.total.toLocaleString() }}</td>
            </tr>
            <tr v-if="matrix.rows.length" style="background:#fef2f2">
              <td class="text-caption font-weight-bold" style="position:sticky;left:0;background:#fef2f2;z-index:1">月合計</td>
              <td v-for="ym in months" :key="ym" class="text-right text-caption font-weight-bold">
                {{ matrix.monthTotals[ym] ? matrix.monthTotals[ym].toLocaleString() : '—' }}
              </td>
              <td class="text-right text-caption font-weight-bold" style="color:#b91c1c;border-left:1px solid #e2e8f0">{{ matrix.grand.toLocaleString() }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { fyOf, fyLabel, fyMonths } from '../accounting/fiscal.js'
import { resolveRecordAccount } from '../accounting/coa.js'
import { apiFetch } from '../composables/apiFetch.js'

const records = inject('records')

const REDBOX_CODE = '4102'
const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const selectedItem = ref(null)

// 全部紅箱收入列（跨年度，供年度選單）
const redboxRecords = computed(() => (records.value || []).filter(r =>
  r.type === 'income' && resolveRecordAccount(r) === REDBOX_CODE
))

const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const r of redboxRecords.value) {
    const fy = fyOf(r.date)
    if (fy != null) fys.add(fy)
  }
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})

const months = computed(() => fyMonths(selectedFy.value))

const fyRecords = computed(() => {
  const monthSet = new Set(months.value)
  return redboxRecords.value.filter(r =>
    monthSet.has(r.date.slice(0, 7)) &&
    (!selectedItem.value || r.item === selectedItem.value)
  )
})

const itemOptions = computed(() => {
  const monthSet = new Set(months.value)
  return [...new Set(redboxRecords.value
    .filter(r => monthSet.has(r.date.slice(0, 7)))
    .map(r => r.item).filter(Boolean))]
})

const matrix = computed(() => {
  const byMember = new Map()
  const monthTotals = {}
  let grand = 0
  for (const r of fyRecords.value) {
    const member = (r.member || '').trim() || '未指定'
    const ym = r.date.slice(0, 7)
    if (!byMember.has(member)) byMember.set(member, { member, byMonth: {}, total: 0 })
    const g = byMember.get(member)
    g.byMonth[ym] = (g.byMonth[ym] || 0) + r.amount
    g.total += r.amount
    monthTotals[ym] = (monthTotals[ym] || 0) + r.amount
    grand += r.amount
  }
  const rows = [...byMember.values()].sort((a, b) => (b.total - a.total) || a.member.localeCompare(b.member, 'zh-Hant'))
  return { rows, monthTotals, grand }
})

// 未結算 LINE 紅箱場次
const pendingSessions = ref([])
const pendingSessionTotal = computed(() => pendingSessions.value
  .reduce((s, sess) => s + sess.rows.reduce((a, r) => a + (r.amount || 0), 0), 0))

onMounted(async () => {
  try {
    const res = await apiFetch('/api/redbox/sessions')
    if (res.ok) pendingSessions.value = await res.json()
  } catch { pendingSessions.value = [] }
})
</script>
