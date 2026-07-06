<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-scale-balance</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">資產負債表</span>
      </div>
      <div class="d-flex ga-2 align-center">
        <v-chip size="small" :color="bs.balanced ? 'success' : 'error'" variant="tonal">
          {{ bs.balanced ? '平衡' : '不平衡！' }}
        </v-chip>
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
      <div class="text-caption text-medium-emphasis mb-3">基準日：{{ toMinguoDate(asOf) }}。點擊科目可查閱分類帳。</div>

      <v-row dense>
        <!-- 資產 -->
        <v-col cols="12" md="6">
          <div class="text-subtitle-2 font-weight-bold mb-1">資產</div>
          <v-table density="compact">
            <tbody>
              <tr v-for="row in bs.assets" :key="row.code" style="cursor:pointer" @click="drill(row)">
                <td class="text-caption">
                  {{ row.name }}
                  <v-btn
                    v-if="row.code === HANDLER_CODE" icon size="x-small" variant="text"
                    @click.stop="showHandlers = !showHandlers"
                  ><v-icon size="14">{{ showHandlers ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon></v-btn>
                </td>
                <td class="text-right text-caption font-weight-medium" style="width:140px">{{ row.amount.toLocaleString() }}</td>
              </tr>
              <template v-if="showHandlers">
                <tr v-for="d in handlerAR" :key="d.person" style="cursor:pointer" @click="drillPerson(d.person)">
                  <td class="text-caption pl-8 text-medium-emphasis">{{ d.person }}</td>
                  <td class="text-right text-caption text-medium-emphasis">{{ d.amount.toLocaleString() }}</td>
                </tr>
              </template>
              <tr class="font-weight-bold" style="background:#f8fafc">
                <td class="text-caption">資產合計</td>
                <td class="text-right text-caption">{{ bs.totalAssets.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-col>

        <!-- 負債與權益 -->
        <v-col cols="12" md="6">
          <div class="text-subtitle-2 font-weight-bold mb-1">負債</div>
          <v-table density="compact" class="mb-3">
            <tbody>
              <tr v-for="row in bs.liabilities" :key="row.code" style="cursor:pointer" @click="drill(row)">
                <td class="text-caption">
                  {{ row.name }}
                  <v-btn
                    v-if="String(row.code).startsWith(HANDLER_CODE)" icon size="x-small" variant="text"
                    @click.stop="showHandlers = !showHandlers"
                  ><v-icon size="14">{{ showHandlers ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon></v-btn>
                </td>
                <td class="text-right text-caption font-weight-medium" style="width:140px">{{ row.amount.toLocaleString() }}</td>
              </tr>
              <template v-if="showHandlers">
                <tr v-for="d in handlerAP" :key="d.person" style="cursor:pointer" @click="drillPerson(d.person)">
                  <td class="text-caption pl-8 text-medium-emphasis">{{ d.person }}</td>
                  <td class="text-right text-caption text-medium-emphasis">{{ (-d.amount).toLocaleString() }}</td>
                </tr>
              </template>
              <tr v-if="!bs.liabilities.length">
                <td colspan="2" class="text-center text-caption text-medium-emphasis pa-3">無負債</td>
              </tr>
              <tr class="font-weight-bold" style="background:#f8fafc">
                <td class="text-caption">負債合計</td>
                <td class="text-right text-caption">{{ bs.totalLiabilities.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>

          <div class="text-subtitle-2 font-weight-bold mb-1">權益</div>
          <v-table density="compact">
            <tbody>
              <tr v-for="row in bs.equity" :key="row.code" style="cursor:pointer" @click="drill(row)">
                <td class="text-caption">{{ row.name }}</td>
                <td class="text-right text-caption font-weight-medium" style="width:140px">{{ row.amount.toLocaleString() }}</td>
              </tr>
              <tr class="font-weight-bold" style="background:#f8fafc">
                <td class="text-caption">負債及權益合計</td>
                <td class="text-right text-caption">{{ (bs.totalLiabilities + bs.totalEquity).toLocaleString() }}</td>
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
import { balanceSheet } from '../accounting/ledger.js'
import { CODES } from '../accounting/coa.js'
import { fyOf, fyLabel, fyMonths, monthEnd, toMinguoDate } from '../accounting/fiscal.js'

const accounting = inject('accounting')
const drillDown = inject('drillDown')

const HANDLER_CODE = CODES.HANDLER
const showHandlers = ref(false)

const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const selectedMonth = ref(today.slice(0, 7))

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
  fyMonths(selectedFy.value).map(ym => ({ title: `${Number(ym.slice(5))} 月底`, value: ym }))
)
const asOf = computed(() => monthEnd(selectedMonth.value))

const bs = computed(() => balanceSheet(entries.value, acctByCode.value, { asOf: asOf.value }))
const handlerAR = computed(() => bs.value.handlerDetail.filter(d => d.amount > 0))
const handlerAP = computed(() => bs.value.handlerDetail.filter(d => d.amount < 0))

function drill(row) {
  if (!row.drill) return
  drillDown({ ...row.drill, fy: selectedFy.value, month: null })
}
function drillPerson(person) {
  drillDown({ accountCode: HANDLER_CODE, person, fy: selectedFy.value, month: null })
}
</script>
