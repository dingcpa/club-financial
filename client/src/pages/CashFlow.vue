<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-cash-fast</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">現金流量表（直接法）</span>
      </div>
      <div class="d-flex ga-2">
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="min-width:130px"
        />
        <v-select
          v-model="selectedMonth" :items="monthOptions" density="compact" variant="outlined" hide-details clearable
          placeholder="全年度" style="min-width:110px"
        />
      </div>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <div class="text-caption text-medium-emphasis mb-3">
        期間：{{ toMinguoDate(rangeFrom) }} ~ {{ toMinguoDate(rangeTo) }}。現金＝銀行存款。點擊項目可查閱分類帳。
      </div>

      <v-row dense class="mb-3">
        <v-col cols="6" sm="3">
          <v-card variant="tonal" class="pa-2 pa-sm-3 text-center">
            <div class="text-caption text-medium-emphasis">期初現金</div>
            <div class="text-body-2 font-weight-bold">NT$ {{ openingCash.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
            <div class="text-caption text-medium-emphasis">現金流入</div>
            <div class="text-body-2 font-weight-bold text-success">NT$ {{ cf.totalIn.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
            <div class="text-caption text-medium-emphasis">現金流出</div>
            <div class="text-body-2 font-weight-bold text-error">NT$ {{ cf.totalOut.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card color="primary" variant="tonal" class="pa-2 pa-sm-3 text-center">
            <div class="text-caption text-medium-emphasis">期末現金</div>
            <div class="text-body-2 font-weight-bold text-primary">NT$ {{ closingCash.toLocaleString() }}</div>
          </v-card>
        </v-col>
      </v-row>

      <v-alert v-if="!reconciles" color="error" variant="tonal" density="compact" class="mb-3">
        <span class="text-caption">勾稽異常：期初 + 淨流量 ≠ 期末，請查帳簿診斷。</span>
      </v-alert>

      <v-row dense>
        <v-col cols="12" md="6">
          <div class="text-subtitle-2 font-weight-bold mb-1 text-success">現金流入（依對方科目）</div>
          <v-table density="compact">
            <tbody>
              <tr v-for="row in cf.inflows" :key="row.code" style="cursor:pointer" @click="drill(row)">
                <td class="text-caption">{{ row.name }}</td>
                <td class="text-right text-caption font-weight-medium" style="width:140px">{{ row.amount.toLocaleString() }}</td>
              </tr>
              <tr v-if="!cf.inflows.length">
                <td colspan="2" class="text-center text-caption text-medium-emphasis pa-3">本期間無現金流入</td>
              </tr>
              <tr class="font-weight-bold" style="background:#f0fdf4">
                <td class="text-caption">流入合計</td>
                <td class="text-right text-caption">{{ cf.totalIn.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
        <v-col cols="12" md="6">
          <div class="text-subtitle-2 font-weight-bold mb-1 text-error">現金流出（依對方科目）</div>
          <v-table density="compact">
            <tbody>
              <tr v-for="row in cf.outflows" :key="row.code" style="cursor:pointer" @click="drill(row)">
                <td class="text-caption">{{ row.name }}</td>
                <td class="text-right text-caption font-weight-medium" style="width:140px">{{ row.amount.toLocaleString() }}</td>
              </tr>
              <tr v-if="!cf.outflows.length">
                <td colspan="2" class="text-center text-caption text-medium-emphasis pa-3">本期間無現金流出</td>
              </tr>
              <tr class="font-weight-bold" style="background:#fef2f2">
                <td class="text-caption">流出合計</td>
                <td class="text-right text-caption">{{ cf.totalOut.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>
      </v-row>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { cashFlow, cashBalance } from '../accounting/ledger.js'
import { fyOf, fyLabel, fyMonths, fyRange, monthEnd, toMinguoDate } from '../accounting/fiscal.js'

const accounting = inject('accounting')
const drillDown = inject('drillDown')

const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const selectedMonth = ref(null)

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

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

const rangeFrom = computed(() => selectedMonth.value ? `${selectedMonth.value}-01` : fyRange(selectedFy.value)[0])
const rangeTo = computed(() => selectedMonth.value ? monthEnd(selectedMonth.value) : fyRange(selectedFy.value)[1])

const cf = computed(() => cashFlow(entries.value, acctByCode.value, { from: rangeFrom.value, to: rangeTo.value }))

// 期初現金：期間起日前一日的現金餘額（以「< from」計）
const openingCash = computed(() => {
  let bal = 0
  for (const e of entries.value) {
    if (e.date >= rangeFrom.value) continue
    for (const l of e.lines) {
      if (acctByCode.value[l.accountCode]?.isCash) bal += (l.debit || 0) - (l.credit || 0)
    }
  }
  return Math.round(bal * 100) / 100
})
const closingCash = computed(() => cashBalance(entries.value, acctByCode.value, { asOf: rangeTo.value }))
const reconciles = computed(() =>
  Math.round((openingCash.value + cf.value.net - closingCash.value) * 100) === 0
)

function drill(row) {
  if (!row.drill) return
  drillDown({ ...row.drill, fy: selectedFy.value, month: selectedMonth.value })
}
</script>
