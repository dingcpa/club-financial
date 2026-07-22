<template>
  <div>
    <v-card elevation="1" class="mb-3">
      <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
        <v-icon color="primary">mdi-clock-plus-outline</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">預收明細表</span>
        <v-spacer />
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-printer" size="small" @click="printReport">產生附表</v-btn>
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="max-width:150px"
        />
        <v-select
          v-model="selectedMonth" :items="monthOptions" density="compact" variant="outlined" hide-details
          style="max-width:110px"
        />
      </v-card-title>
      <v-card-text class="pt-0 pb-3 px-3 px-sm-4">
        <span class="text-caption text-medium-emphasis">
          按對象列示預收款變動（年度 7/1 起至基準日 <strong>{{ toMinguoDate(asOf) }}</strong>）：期初預收＋本期新增－本期轉列收入＝期末餘額。
          點列展開逐筆明細，點金額查分類帳。期末合計與同基準日資產負債表預收科目餘額一致。
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

    <!-- 列印附表：按對象預收款變動 -->
    <PrintSheet>
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
      <div class="print-title">預收明細表</div>
      <div class="print-meta">{{ fyLabel(selectedFy) }}　・　基準日 {{ toMinguoDate(asOf) }}　・　幣別：新臺幣 NT$　・　期初預收＋本期新增－本期轉列收入＝期末餘額</div>
      <template v-for="sec in printSections" :key="sec.code">
        <div class="print-section-title">{{ sec.code }} {{ sec.name }}</div>
        <table>
          <thead>
            <tr>
              <th>對象</th>
              <th class="num" style="width:100px">期初預收</th>
              <th class="num" style="width:100px">本期新增</th>
              <th class="num" style="width:110px">本期轉列收入</th>
              <th class="num" style="width:110px">期末餘額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="g in sec.rows" :key="g.person">
              <td>{{ g.person }}</td>
              <td class="num">{{ fmt(g.opening) }}</td>
              <td class="num">{{ fmt(g.added) }}</td>
              <td class="num">{{ fmt(g.recognized) }}</td>
              <td class="num">{{ fmt(g.closing) }}</td>
            </tr>
            <tr class="total">
              <td>合計</td>
              <td class="num">{{ fmt(sec.totals.opening) }}</td>
              <td class="num">{{ fmt(sec.totals.added) }}</td>
              <td class="num">{{ fmt(sec.totals.recognized) }}</td>
              <td class="num">{{ fmt(sec.totals.closing) }}</td>
            </tr>
          </tbody>
        </table>
      </template>
      <div class="print-footer">期末合計與同基準日資產負債表預收科目餘額一致（權責發生制：開單掛預收、逐月轉列收入）。</div>
      <div class="print-sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>
    </PrintSheet>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { fyOf, fyRange, fyLabel, fyMonths, monthEnd, toMinguoDate } from '../accounting/fiscal.js'
import { CODES } from '../accounting/coa.js'
import PrintSheet from '../components/PrintSheet.vue'

const accounting = inject('accounting')
const drillDown = inject('drillDown')

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)

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
  fyMonths(selectedFy.value).map(ym => ({ title: `${Number(ym.slice(5))} 月底`, value: ym }))
)
// 切換年度時，基準月落回該年度（本年度→當月，過往年度→年度末 6 月）
watch(selectedFy, (fy) => {
  const months = fyMonths(fy)
  if (!months.includes(selectedMonth.value)) {
    selectedMonth.value = fy === fyOf(today) ? today.slice(0, 7) : months[months.length - 1]
  }
})
// 報表基準日（月底）：期末餘額截至此日，與同基準日資產負債表勾稽
const asOf = computed(() => monthEnd(selectedMonth.value))

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
  const [fyStart] = fyRange(selectedFy.value)
  const map = new Map()
  for (const e of entries.value) {
    if (e.sourceType === 'closing') continue
    if (e.date > asOf.value) continue
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

// 列印附表：無異動科目不列示
const printSections = computed(() => sections.value.filter(sec => sec.rows.length))
function printReport() { window.print() }
</script>
