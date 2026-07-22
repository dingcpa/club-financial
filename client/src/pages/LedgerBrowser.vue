<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
      <v-icon color="primary">mdi-notebook-outline</v-icon>
      <span class="text-body-1 text-sm-h6 font-weight-bold">帳簿查詢</span>
      <v-spacer />
      <v-chip v-if="errorCount" size="small" color="error" variant="tonal" @click="showDiag = true" style="cursor:pointer">
        <v-icon start size="small">mdi-alert</v-icon>{{ errorCount }} 項診斷
      </v-chip>
      <v-chip v-else-if="warnCount" size="small" color="warning" variant="tonal" @click="showDiag = true" style="cursor:pointer">
        <v-icon start size="small">mdi-alert-outline</v-icon>{{ warnCount }} 項提醒
      </v-chip>
    </v-card-title>

    <!-- 篩選列 -->
    <v-card-text class="pa-2 pa-sm-4 pt-0 pb-2">
      <v-row dense>
        <v-col cols="6" sm="3">
          <v-select v-model="selectedFy" label="扶輪年度" :items="fyOptions" density="compact" variant="outlined" hide-details />
        </v-col>
        <v-col cols="6" sm="3">
          <v-select v-model="selectedMonth" label="月份" :items="monthOptions" density="compact" variant="outlined" hide-details clearable placeholder="全年度" />
        </v-col>
        <v-col cols="6" sm="3">
          <v-autocomplete v-model="selectedAccount" label="科目（分類帳）" :items="acctOptions" density="compact" variant="outlined" hide-details clearable />
        </v-col>
        <v-col cols="6" sm="3">
          <v-autocomplete v-model="selectedPerson" label="對象（人員/案名）" :items="personOptions" density="compact" variant="outlined" hide-details clearable />
        </v-col>
      </v-row>
    </v-card-text>

    <v-tabs v-model="tab" color="primary" density="compact">
      <v-tab value="ledger">分類帳</v-tab>
      <v-tab value="journal">日記帳</v-tab>
      <v-tab value="trial">試算表</v-tab>
    </v-tabs>
    <v-divider />

    <v-window v-model="tab">
      <!-- 分類帳 -->
      <v-window-item value="ledger">
        <v-card-text class="pa-2 pa-sm-4">
          <div v-if="!selectedAccount" class="text-center text-medium-emphasis pa-8">請選擇科目</div>
          <template v-else>
            <div class="d-flex flex-wrap align-center ga-4 mb-2">
              <div class="text-subtitle-2 font-weight-bold">{{ acctTitle(selectedAccount) }}</div>
              <v-chip size="small" variant="tonal">期初 {{ ledger.opening.toLocaleString() }}</v-chip>
              <v-chip size="small" variant="tonal" color="primary">期末 {{ ledger.closing.toLocaleString() }}</v-chip>
            </div>
            <div style="overflow-x:auto">
              <v-table density="compact" style="min-width:720px">
                <thead>
                  <tr>
                    <th style="width:90px">日期</th>
                    <th>摘要</th>
                    <th style="width:120px">對象</th>
                    <th style="width:130px">活動別</th>
                    <th class="text-right" style="width:110px">借方</th>
                    <th class="text-right" style="width:110px">貸方</th>
                    <th class="text-right" style="width:120px">餘額</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td class="text-caption text-medium-emphasis" colspan="6">期初餘額</td>
                    <td class="text-right text-caption font-weight-medium">{{ ledger.opening.toLocaleString() }}</td>
                  </tr>
                  <tr v-for="(row, i) in ledger.rows" :key="i" style="cursor:pointer" @click="viewEntry = row.entry">
                    <td class="text-caption text-medium-emphasis" style="white-space:nowrap">{{ toMinguoDate(row.entry.date) }}</td>
                    <td class="text-caption">{{ row.entry.description }}</td>
                    <td class="text-caption text-medium-emphasis">{{ row.line.person }}</td>
                    <td class="text-caption">
                      <v-chip v-if="projectName(row.line.projectId)" size="x-small" color="teal" variant="tonal">
                        {{ projectName(row.line.projectId) }}
                      </v-chip>
                    </td>
                    <td class="text-right text-caption">{{ row.line.debit ? row.line.debit.toLocaleString() : '' }}</td>
                    <td class="text-right text-caption">{{ row.line.credit ? row.line.credit.toLocaleString() : '' }}</td>
                    <td class="text-right text-caption font-weight-medium">{{ row.balance.toLocaleString() }}</td>
                  </tr>
                  <tr v-if="!ledger.rows.length">
                    <td colspan="7" class="text-center text-medium-emphasis pa-6">本期間無異動</td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </template>
        </v-card-text>
      </v-window-item>

      <!-- 日記帳（傳票流水，點列開傳票） -->
      <v-window-item value="journal">
        <v-card-text class="pa-2 pa-sm-4">
          <div style="overflow-x:auto">
            <v-table density="compact" style="min-width:720px">
              <thead>
                <tr>
                  <th style="width:90px">日期</th>
                  <th style="width:110px">類型</th>
                  <th>摘要</th>
                  <th style="width:150px">對象</th>
                  <th class="text-right" style="width:120px">金額</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="e in pagedJournal" :key="e.id" style="cursor:pointer" @click="viewEntry = e">
                  <td class="text-caption text-medium-emphasis" style="white-space:nowrap">{{ toMinguoDate(e.date) }}</td>
                  <td><v-chip size="x-small" variant="tonal" :color="sourceColor(e.sourceType)">{{ sourceLabel(e.sourceType) }}</v-chip></td>
                  <td class="text-caption">{{ e.description }}</td>
                  <td class="text-caption text-medium-emphasis">{{ entryPersons(e) }}</td>
                  <td class="text-right text-caption font-weight-medium">{{ entryAmount(e).toLocaleString() }}</td>
                </tr>
                <tr v-if="!journalFiltered.length">
                  <td colspan="5" class="text-center text-medium-emphasis pa-6">本期間無分錄</td>
                </tr>
              </tbody>
            </v-table>
          </div>
          <div v-if="journalPages > 1" class="d-flex justify-space-between align-center px-3 py-2">
            <v-btn icon size="x-small" variant="text" :disabled="journalPage <= 1" @click="journalPage--"><v-icon>mdi-chevron-left</v-icon></v-btn>
            <span class="text-caption text-medium-emphasis">{{ journalPage }} / {{ journalPages }}（{{ journalFiltered.length }} 張傳票）</span>
            <v-btn icon size="x-small" variant="text" :disabled="journalPage >= journalPages" @click="journalPage++"><v-icon>mdi-chevron-right</v-icon></v-btn>
          </div>
        </v-card-text>
      </v-window-item>

      <!-- 試算表 -->
      <v-window-item value="trial">
        <v-card-text class="pa-2 pa-sm-4">
          <v-alert :color="trial.balanced ? 'success' : 'error'" variant="tonal" density="compact" class="mb-3">
            <span class="text-caption">
              截至 {{ toMinguoDate(rangeTo) }}：借方合計 {{ trial.totalDebit.toLocaleString() }}／貸方合計 {{ trial.totalCredit.toLocaleString() }}
              {{ trial.balanced ? '（平衡）' : '（不平衡！請查診斷）' }}
            </span>
          </v-alert>
          <v-table density="compact">
            <thead>
              <tr>
                <th>科目</th>
                <th class="text-right" style="width:140px">借方餘額</th>
                <th class="text-right" style="width:140px">貸方餘額</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in trial.rows" :key="row.code" style="cursor:pointer" @click="drillTo(row.code)">
                <td class="text-caption">{{ row.code }} {{ row.name }}</td>
                <td class="text-right text-caption">{{ row.debit ? row.debit.toLocaleString() : '' }}</td>
                <td class="text-right text-caption">{{ row.credit ? row.credit.toLocaleString() : '' }}</td>
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-window-item>
    </v-window>

    <JournalEntryDialog :entry="viewEntry" @close="viewEntry = null" />

    <!-- 診斷清單 -->
    <v-dialog v-model="showDiag" max-width="560">
      <v-card>
        <v-card-title class="text-h6 font-weight-bold pa-4">引擎診斷</v-card-title>
        <v-card-text>
          <div v-for="(d, i) in diagnostics" :key="i" class="text-caption mb-1">
            <v-icon size="small" :color="d.level === 'error' ? 'error' : 'warning'">
              {{ d.level === 'error' ? 'mdi-alert' : 'mdi-alert-outline' }}
            </v-icon>
            {{ d.message }}
          </div>
          <div v-if="!diagnostics.length" class="text-caption text-medium-emphasis">無診斷事項</div>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import JournalEntryDialog from './JournalEntryDialog.vue'
import { ledgerFor, journalRows, trialBalance } from '../accounting/ledger.js'
import { fyOf, fyRange, fyLabel, fyMonths, monthEnd, toMinguoDate } from '../accounting/fiscal.js'

const accounting = inject('accounting')
const members = inject('members')
const projects = inject('projects')
const drillContext = inject('drillContext')
const activeTab = inject('activeTab', ref(''))

// 選單「分類帳」「日記帳」共用本元件，依 activeTab 決定初始/切換的 tab
const tab = ref(activeTab?.value === 'journal' ? 'journal' : 'ledger')
watch(() => activeTab?.value, (t) => {
  if (t === 'journal') tab.value = 'journal'
  else if (t === 'ledger') tab.value = 'ledger'
})
const viewEntry = ref(null)
const showDiag = ref(false)
const journalPage = ref(1)
const JOURNAL_PAGE_SIZE = 30

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)
const diagnostics = computed(() => accounting.diagnostics.value)
const errorCount = computed(() => diagnostics.value.filter(d => d.level === 'error').length)
const warnCount = computed(() => diagnostics.value.filter(d => d.level === 'warn').length)

// ── 期間篩選（扶輪年度＋可選月份）──
const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const selectedMonth = ref(null)

const fyOptions = computed(() => {
  const fys = new Set(entries.value.map(e => fyOf(e.date)).filter(x => x != null))
  fys.add(fyOf(today))
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})
const monthOptions = computed(() =>
  fyMonths(selectedFy.value || fyOf(today)).map(ym => ({ title: `${Number(ym.slice(5))} 月`, value: ym }))
)
const rangeFrom = computed(() => selectedMonth.value ? `${selectedMonth.value}-01` : fyRange(selectedFy.value)[0])
const rangeTo = computed(() => selectedMonth.value ? monthEnd(selectedMonth.value) : fyRange(selectedFy.value)[1])

// ── 科目/人員篩選 ──
const selectedAccount = ref(null)
const selectedPerson = ref(null)

const acctOptions = computed(() =>
  (Object.values(acctByCode.value) || [])
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
)
const personOptions = computed(() => {
  const names = new Set((members?.value || []).map(m => m.name))
  for (const e of entries.value) for (const l of e.lines) if (l.person) names.add(l.person)
  return [...names]
})

function acctTitle(code) {
  const a = acctByCode.value[code]
  return a ? `${a.code} ${a.name}` : code
}

// 活動別：分錄行 projectId → 活動名稱
const projectById = computed(() =>
  new Map((projects?.value || []).map(p => [String(p.id), p.name]))
)
function projectName(projectId) {
  if (!projectId) return ''
  return projectById.value.get(String(projectId)) || ''
}

// drill-down 進入點：其他頁面點金額 → 設定篩選並切到分類帳
watch(() => drillContext?.value, (ctx) => {
  if (!ctx) return
  tab.value = 'ledger'
  if (ctx.accountCode) selectedAccount.value = ctx.accountCode
  if (ctx.person !== undefined) selectedPerson.value = ctx.person
  if (ctx.fy) selectedFy.value = ctx.fy
  if (ctx.month !== undefined) selectedMonth.value = ctx.month
  drillContext.value = null
}, { immediate: true })

const ledger = computed(() => {
  if (!selectedAccount.value) return { opening: 0, rows: [], closing: 0 }
  return ledgerFor(entries.value, acctByCode.value, {
    accountCode: selectedAccount.value,
    person: selectedPerson.value || undefined,
    from: rangeFrom.value,
    to: rangeTo.value,
  })
})

const journalFiltered = computed(() => {
  let rows = journalRows(entries.value, { from: rangeFrom.value, to: rangeTo.value })
  if (selectedPerson.value) rows = rows.filter(e => e.lines.some(l => l.person === selectedPerson.value))
  if (selectedAccount.value) rows = rows.filter(e => e.lines.some(l => l.accountCode === selectedAccount.value))
  return rows
})
const journalPages = computed(() => Math.max(1, Math.ceil(journalFiltered.value.length / JOURNAL_PAGE_SIZE)))
const pagedJournal = computed(() => {
  const p = Math.min(journalPage.value, journalPages.value)
  return journalFiltered.value.slice((p - 1) * JOURNAL_PAGE_SIZE, p * JOURNAL_PAGE_SIZE)
})
watch([rangeFrom, rangeTo, selectedAccount, selectedPerson], () => { journalPage.value = 1 })

const trial = computed(() => trialBalance(entries.value, acctByCode.value, { asOf: rangeTo.value }))

function entryAmount(e) {
  return e.lines.reduce((s, l) => s + (l.debit || 0), 0)
}

// 傳票層級的對象：彙整各分錄行的人員/案名（去重）
function entryPersons(e) {
  return [...new Set(e.lines.map(l => l.person).filter(Boolean))].join('、')
}

const SOURCE_LABELS = {
  opening: '期初', receivable: '開單', recognition: '轉列', collection: '收款',
  payable: '應付立帳', payment: '付款沖帳',
  income: '收入', expense: '支出', transfer: '轉帳', overpayment: '溢收',
  'agency-payout': '代付', manual: '手工', closing: '結轉',
}
function sourceLabel(t) { return SOURCE_LABELS[t] || t }
function sourceColor(t) {
  if (t === 'income' || t === 'collection') return 'success'
  if (t === 'expense' || t === 'agency-payout' || t === 'payable' || t === 'payment') return 'error'
  if (t === 'manual') return 'warning'
  if (t === 'recognition' || t === 'closing' || t === 'opening') return 'grey'
  return 'primary'
}

function drillTo(code) {
  selectedAccount.value = code
  tab.value = 'ledger'
}
</script>
