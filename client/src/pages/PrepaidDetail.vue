<template>
  <div>
    <v-card elevation="1" class="mb-3">
      <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
        <v-icon color="primary">mdi-clock-plus-outline</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">預收明細表</span>
        <v-spacer />
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="max-width:150px"
        />
      </v-card-title>
      <v-card-text class="pt-0 pb-3 px-3 px-sm-4">
        <span class="text-caption text-medium-emphasis">
          按對象列示預收款變動：期初預收＋本期新增－本期轉列收入＝期末餘額。點列展開逐筆明細，點金額查分類帳。合計與資產負債表預收科目餘額一致。
        </span>
      </v-card-text>
    </v-card>

    <v-card v-for="sec in sections" :key="sec.code" elevation="1" class="mb-3">
      <v-card-title class="d-flex align-center py-2 px-3 px-sm-4" style="border-bottom:2px solid #4f46e5">
        <span class="text-body-1 font-weight-bold">{{ sec.code }} {{ sec.name }}</span>
        <v-spacer />
        <span class="text-body-2 font-weight-bold" style="color:#4f46e5">期末 NT$ {{ fmt(sec.totals.closing) }}</span>
      </v-card-title>
      <div style="overflow-x:auto">
        <v-table density="compact" style="min-width:680px">
          <thead>
            <tr>
              <th class="text-caption">對象</th>
              <th class="text-caption text-right" style="width:110px">期初預收</th>
              <th class="text-caption text-right" style="width:110px">本期新增</th>
              <th class="text-caption text-right" style="width:110px">本期轉列收入</th>
              <th class="text-caption text-right" style="width:120px">期末餘額</th>
              <th style="width:40px" />
            </tr>
          </thead>
          <tbody>
            <tr v-if="!sec.rows.length">
              <td colspan="6" class="text-center text-medium-emphasis text-caption pa-6">本年度無{{ sec.name }}異動</td>
            </tr>
            <template v-for="g in sec.rows" :key="g.person">
              <tr style="cursor:pointer" @click="toggle(sec.code, g.person)">
                <td class="text-body-2">{{ g.person }}</td>
                <td class="text-right text-caption">{{ fmt(g.opening) }}</td>
                <td class="text-right text-caption" style="color:#15803d">{{ fmt(g.added) }}</td>
                <td class="text-right text-caption" style="color:#b91c1c">{{ fmt(g.recognized) }}</td>
                <td class="text-right text-caption font-weight-bold" style="cursor:pointer;color:#4f46e5"
                    @click.stop="drillDown({ accountCode: sec.code, person: g.person, fy: selectedFy })">
                  {{ fmt(g.closing) }}
                </td>
                <td class="text-center">
                  <v-icon size="small">{{ isOpen(sec.code, g.person) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
                </td>
              </tr>
              <tr v-if="isOpen(sec.code, g.person)">
                <td colspan="6" class="pa-0">
                  <v-table density="compact" class="bg-grey-lighten-5">
                    <tbody>
                      <tr v-for="(r, i) in g.details" :key="i">
                        <td class="text-caption" style="width:100px">{{ toMinguoDate(r.date) }}</td>
                        <td class="text-caption">{{ r.description }}</td>
                        <td class="text-caption text-right" style="width:110px">{{ r.credit ? '新增 ' + fmt(r.credit) : '' }}</td>
                        <td class="text-caption text-right" style="width:110px">{{ r.debit ? '轉列 ' + fmt(r.debit) : '' }}</td>
                      </tr>
                    </tbody>
                  </v-table>
                </td>
              </tr>
            </template>
            <tr v-if="sec.rows.length" style="background:#eef2ff">
              <td class="text-caption font-weight-bold">合計</td>
              <td class="text-right text-caption font-weight-bold">{{ fmt(sec.totals.opening) }}</td>
              <td class="text-right text-caption font-weight-bold">{{ fmt(sec.totals.added) }}</td>
              <td class="text-right text-caption font-weight-bold">{{ fmt(sec.totals.recognized) }}</td>
              <td class="text-right text-caption font-weight-bold" style="color:#4f46e5">{{ fmt(sec.totals.closing) }}</td>
              <td />
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { fyOf, fyRange, fyLabel, toMinguoDate } from '../accounting/fiscal.js'
import { CODES } from '../accounting/coa.js'

const accounting = inject('accounting')
const drillDown = inject('drillDown')

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const e of entries.value) {
    const fy = fyOf(e.date)
    if (fy != null) fys.add(fy)
  }
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})

const fmt = (n) => Number(n || 0).toLocaleString('en-US')
const r2 = (n) => Math.round(n * 100) / 100

// 展開狀態：`${code}|${person}`
const opened = ref(new Set())
const keyOf = (code, person) => `${code}|${person}`
const isOpen = (code, person) => opened.value.has(keyOf(code, person))
function toggle(code, person) {
  const k = keyOf(code, person)
  const next = new Set(opened.value)
  if (next.has(k)) next.delete(k)
  else next.add(k)
  opened.value = next
}

function buildSection(code) {
  const [fyStart, fyEnd] = fyRange(selectedFy.value)
  const map = new Map()
  for (const e of entries.value) {
    if (e.sourceType === 'closing') continue
    if (e.date > fyEnd) continue
    for (const l of e.lines) {
      if (l.accountCode !== code) continue
      const person = l.person || '未指定'
      if (!map.has(person)) map.set(person, { person, opening: 0, added: 0, recognized: 0, details: [] })
      const g = map.get(person)
      const cr = l.credit || 0
      const dr = l.debit || 0
      if (e.date < fyStart) {
        g.opening += cr - dr
      } else {
        g.added += cr
        g.recognized += dr
        g.details.push({ date: e.date, description: e.description, debit: dr, credit: cr })
      }
    }
  }
  const rows = [...map.values()]
    .map(g => ({
      ...g,
      opening: r2(g.opening),
      added: r2(g.added),
      recognized: r2(g.recognized),
      closing: r2(g.opening + g.added - g.recognized),
      details: g.details.sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter(g => g.opening || g.added || g.recognized)
    .sort((a, b) => a.person.localeCompare(b.person, 'zh-Hant'))
  const totals = {
    opening: r2(rows.reduce((s, g) => s + g.opening, 0)),
    added: r2(rows.reduce((s, g) => s + g.added, 0)),
    recognized: r2(rows.reduce((s, g) => s + g.recognized, 0)),
    closing: r2(rows.reduce((s, g) => s + g.closing, 0)),
  }
  return { code, name: acctByCode.value[code]?.name || code, rows, totals }
}

const sections = computed(() => [
  buildSection(CODES.UNEARNED_DUES),
  buildSection(CODES.UNEARNED_OTHER),
])
</script>
