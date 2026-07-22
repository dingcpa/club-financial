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
        <v-btn color="primary" variant="tonal" prepend-icon="mdi-printer" size="small" @click="printReport">產生 PDF / 列印</v-btn>
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

      <!-- 銀行核對提醒 -->
      <v-alert
        v-if="reconAlert" density="compact" variant="tonal"
        :color="reconAlert.color" :icon="reconAlert.icon" class="mb-3"
      >
        <span class="text-caption">{{ reconAlert.text }}</span>
        <template #append>
          <v-btn size="x-small" variant="tonal" @click="showRecon = true">去核對</v-btn>
        </template>
      </v-alert>

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

      <!-- 銀行存款核對 -->
      <div class="mt-4">
        <div class="d-flex justify-space-between align-center mb-1">
          <div class="text-subtitle-2 font-weight-bold">
            銀行存款核對
            <v-btn icon size="x-small" variant="text" @click="showRecon = !showRecon">
              <v-icon size="16">{{ showRecon ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </v-btn>
          </div>
        </div>
        <template v-if="showRecon">
          <v-table density="compact" class="mb-2">
            <thead>
              <tr>
                <th class="text-caption">銀行帳戶</th>
                <th class="text-caption text-right">帳上餘額</th>
                <th class="text-caption text-right">存摺餘額</th>
                <th class="text-caption text-right">差額</th>
                <th class="text-caption text-center">核對日</th>
                <th class="text-caption text-center" style="width:60px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in reconRows" :key="row.code">
                <td class="text-caption">{{ row.name }}</td>
                <td class="text-right text-caption">{{ row.bookBalance.toLocaleString() }}</td>
                <td class="text-right text-caption">{{ row.recon ? row.recon.statementBalance.toLocaleString() : '—' }}</td>
                <td class="text-right text-caption" :class="row.recon ? (row.diff === 0 ? 'text-success font-weight-bold' : 'text-error font-weight-bold') : 'text-medium-emphasis'">
                  {{ row.recon ? (row.diff === 0 ? '✓ 相符' : row.diff.toLocaleString()) : '未核對' }}
                </td>
                <td class="text-center text-caption text-medium-emphasis">{{ row.recon ? toMinguoDate(row.recon.reconDate) : '—' }}</td>
                <td class="text-center">
                  <v-btn v-if="row.recon" icon size="x-small" variant="text" color="error" title="刪除此核對紀錄" @click="handleDeleteRecon(row.recon)">
                    <v-icon size="14">mdi-delete</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
          <div v-if="reconDiffNote" class="text-caption text-error mb-2">
            {{ reconDiffNote }}
          </div>

          <!-- 新增核對 -->
          <v-card variant="outlined" class="pa-2">
            <v-row dense align="center">
              <v-col cols="12" sm="3">
                <v-select v-model="reconForm.accountCode" label="銀行帳戶" :items="cashAcctOptions" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model="reconForm.reconDate" label="核對日" type="date" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="6" sm="3">
                <v-text-field v-model="reconForm.statementBalance" label="存摺餘額" type="number" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="12" sm="3">
                <v-btn color="primary" variant="flat" size="small" block prepend-icon="mdi-check" @click="handleAddRecon">記錄核對</v-btn>
              </v-col>
            </v-row>
          </v-card>
        </template>
      </div>
    </v-card-text>

    <!-- 列印版 -->
    <PrintSheet>
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
      <div class="print-title">資產負債表</div>
      <div class="print-meta">基準日 {{ toMinguoDate(asOf) }}　・　幣別：新臺幣 NT$　・　{{ bs.balanced ? '借貸平衡' : '（警告：借貸不平衡）' }}</div>

      <div class="print-section-title">資產</div>
      <table>
        <tbody>
          <tr v-for="row in bs.assets" :key="row.code">
            <td>{{ row.name }}</td>
            <td class="num" style="width:140px">{{ row.amount.toLocaleString() }}</td>
          </tr>
          <template v-for="d in handlerAR" :key="'ar-' + d.person">
            <tr>
              <td style="padding-left:22px">經手人往來－{{ d.person }}</td>
              <td class="num">{{ d.amount.toLocaleString() }}</td>
            </tr>
          </template>
          <tr class="total"><td>資產合計</td><td class="num">{{ bs.totalAssets.toLocaleString() }}</td></tr>
        </tbody>
      </table>

      <div class="print-section-title">負債</div>
      <table>
        <tbody>
          <tr v-for="row in bs.liabilities" :key="row.code">
            <td>{{ row.name }}</td>
            <td class="num" style="width:140px">{{ row.amount.toLocaleString() }}</td>
          </tr>
          <template v-for="d in handlerAP" :key="'ap-' + d.person">
            <tr>
              <td style="padding-left:22px">經手人往來－{{ d.person }}</td>
              <td class="num">{{ (-d.amount).toLocaleString() }}</td>
            </tr>
          </template>
          <tr v-if="!bs.liabilities.length"><td colspan="2">（無負債）</td></tr>
          <tr class="total"><td>負債合計</td><td class="num">{{ bs.totalLiabilities.toLocaleString() }}</td></tr>
        </tbody>
      </table>

      <div class="print-section-title">權益</div>
      <table>
        <tbody>
          <tr v-for="row in bs.equity" :key="row.code">
            <td>{{ row.name }}</td>
            <td class="num" style="width:140px">{{ row.amount.toLocaleString() }}</td>
          </tr>
          <tr class="total"><td>負債及權益合計</td><td class="num">{{ (bs.totalLiabilities + bs.totalEquity).toLocaleString() }}</td></tr>
        </tbody>
      </table>

      <div class="print-section-title">銀行存款核對</div>
      <table>
        <thead>
          <tr>
            <th>銀行帳戶</th>
            <th class="num" style="width:110px">帳上餘額</th>
            <th class="num" style="width:110px">存摺餘額</th>
            <th class="num" style="width:100px">差額</th>
            <th style="width:90px">核對日</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in reconRows" :key="'p-' + row.code">
            <td>{{ row.name }}</td>
            <td class="num">{{ row.bookBalance.toLocaleString() }}</td>
            <td class="num">{{ row.recon ? row.recon.statementBalance.toLocaleString() : '—' }}</td>
            <td class="num">{{ row.recon ? (row.diff === 0 ? '相符' : row.diff.toLocaleString()) : '未核對' }}</td>
            <td>{{ row.recon ? toMinguoDate(row.recon.reconDate) : '—' }}</td>
          </tr>
        </tbody>
      </table>

      <div class="print-footer">經手人往來按人淨額歸邊列示（借餘＝其他應收、貸餘＝其他應付）；代收款屬負債，不計入收支餘絀。</div>
      <div class="print-sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>
    </PrintSheet>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'
import { balanceSheet, balancesAsOf } from '../accounting/ledger.js'
import { CODES } from '../accounting/coa.js'
import { fyOf, fyLabel, fyMonths, monthEnd, toMinguoDate } from '../accounting/fiscal.js'
import PrintSheet from '../components/PrintSheet.vue'

const accounting = inject('accounting')
const drillDown = inject('drillDown')
const accounts = inject('accounts')
const bankReconciliations = inject('bankReconciliations')
const addBankReconciliation = inject('addBankReconciliation')
const deleteBankReconciliation = inject('deleteBankReconciliation')

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

function printReport() { window.print() }

function drill(row) {
  if (!row.drill) return
  drillDown({ ...row.drill, fy: selectedFy.value, month: null })
}
function drillPerson(person) {
  drillDown({ accountCode: HANDLER_CODE, person, fy: selectedFy.value, month: null })
}

// ── 銀行存款核對 ────────────────────────────────────────────
const showRecon = ref(false)
const reconForm = ref({ accountCode: CODES.BANK, reconDate: today, statementBalance: '' })

const cashAccounts = computed(() => (accounts?.value || []).filter(a => a.isCash && a.active))
const cashAcctOptions = computed(() => cashAccounts.value.map(a => ({ title: `${a.code} ${a.name}`, value: a.code })))

// 各銀行帳戶：最近一次核對 vs 該核對日的帳上餘額
const reconRows = computed(() => {
  return cashAccounts.value.map(a => {
    const recons = (bankReconciliations?.value || [])
      .filter(r => r.accountCode === a.code)
      .sort((x, y) => y.reconDate.localeCompare(x.reconDate))
    const recon = recons[0] || null
    const { byCode } = balancesAsOf(entries.value, { asOf: recon ? recon.reconDate : asOf.value })
    const b = byCode.get(a.code) || { debit: 0, credit: 0 }
    const bookBalance = Math.round((b.debit - b.credit) * 100) / 100
    const diff = recon ? Math.round((recon.statementBalance - bookBalance) * 100) / 100 : null
    return { code: a.code, name: a.name, bookBalance, recon, diff }
  })
})

// 提醒：未核對或差額不符 → 紅；超過 31 天未核對 → 黃
const reconAlert = computed(() => {
  const rows = reconRows.value
  if (!rows.length) return null
  const mismatch = rows.filter(r => r.recon && r.diff !== 0)
  if (mismatch.length) {
    return { color: 'error', icon: 'mdi-alert-circle', text: `${mismatch.map(r => r.name).join('、')} 存摺餘額與帳上不符，請查明差異（可用帳簿查詢核對明細）。` }
  }
  const never = rows.filter(r => !r.recon)
  if (never.length === rows.length) {
    return { color: 'warning', icon: 'mdi-bank-outline', text: '存摺與銀行存款尚未核對過，建議每月對一次帳。' }
  }
  const staleLimit = new Date(Date.now() - 31 * 86400000).toISOString().slice(0, 10)
  const stale = rows.filter(r => r.recon && r.recon.reconDate < staleLimit)
  if (never.length || stale.length) {
    const names = [...never, ...stale].map(r => r.name).join('、')
    return { color: 'warning', icon: 'mdi-bank-outline', text: `${names} 超過一個月未核對存摺。` }
  }
  return null
})

const reconDiffNote = computed(() => {
  const mismatch = reconRows.value.filter(r => r.recon && r.diff !== 0)
  if (!mismatch.length) return ''
  return '差額＝存摺餘額−帳上餘額。正數表示存摺比帳上多（可能有漏記收入或在途轉帳），負數表示帳上多（可能有漏記支出/手續費）。'
})

async function handleAddRecon() {
  if (!reconForm.value.accountCode || !reconForm.value.reconDate || reconForm.value.statementBalance === '') {
    Swal.fire({ icon: 'warning', title: '請填寫帳戶、核對日與存摺餘額', confirmButtonColor: '#4f46e5' }); return
  }
  try {
    await addBankReconciliation({
      accountCode: reconForm.value.accountCode,
      reconDate: reconForm.value.reconDate,
      statementBalance: parseFloat(reconForm.value.statementBalance) || 0,
    })
    reconForm.value.statementBalance = ''
    Swal.fire({ icon: 'success', title: '已記錄核對', timer: 1200, showConfirmButton: false })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '記錄失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

async function handleDeleteRecon(recon) {
  const result = await Swal.fire({
    title: '刪除核對紀錄？',
    text: `${toMinguoDate(recon.reconDate)} 的存摺核對紀錄將刪除。`,
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '刪除', cancelButtonText: '取消',
  })
  if (result.isConfirmed) await deleteBankReconciliation(recon.id)
}
</script>
