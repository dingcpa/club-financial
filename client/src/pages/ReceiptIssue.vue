<template>
  <div>
    <v-card elevation="1" class="mb-3">
      <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
        <v-icon color="primary">mdi-receipt-text-outline</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">開立收據</span>
        <v-spacer />
        <v-select
          v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
          style="min-width:140px" @update:model-value="loadReceipts"
        />
      </v-card-title>
      <v-card-text class="pt-0 px-3 px-sm-4 pb-3">
        <span class="text-caption text-medium-emphasis">
          選社友帶出其收款紀錄勾選組成收據，或手動加列；存檔自動取號（{{ minguoFy }}-0001 起連號），可列印/另存 PDF。作廢不刪除、編號不回收。
        </span>
      </v-card-text>
    </v-card>

    <v-row dense>
      <!-- 開立新收據 -->
      <v-col cols="12" md="6">
        <v-card elevation="1">
          <v-card-title class="text-subtitle-2 font-weight-bold py-2 px-3">開立新收據</v-card-title>
          <v-card-text class="pt-1">
            <v-row dense>
              <v-col cols="6">
                <v-text-field v-model="draft.date" label="收據日期" type="date" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="6">
                <v-autocomplete
                  v-model="draft.memberName" label="社友 / 抬頭" :items="memberNames"
                  density="compact" variant="outlined" hide-details clearable
                />
              </v-col>
            </v-row>

            <!-- 該社友的收款紀錄 -->
            <v-card v-if="draft.memberName && memberRecords.length" variant="outlined" class="mt-3 pa-2" style="max-height:220px;overflow-y:auto">
              <div class="text-caption text-medium-emphasis mb-1">勾選要列入收據的收款紀錄：</div>
              <div v-for="r in memberRecords" :key="r.id" class="d-flex align-center ga-1">
                <v-checkbox-btn :model-value="pickedRecordIds.includes(r.id)" density="compact" @update:model-value="toggleRecord(r)" />
                <span class="text-caption flex-grow-1">{{ toMinguoDate(r.date) }}　{{ r.item }}</span>
                <span class="text-caption font-weight-bold">{{ r.amount.toLocaleString() }}</span>
              </div>
            </v-card>

            <!-- 明細列 -->
            <div class="d-flex align-center mt-3 mb-1">
              <span class="text-caption font-weight-bold">收據明細</span>
              <v-spacer />
              <v-btn size="x-small" variant="tonal" prepend-icon="mdi-plus" @click="draft.items.push({ desc: '', amount: '', financeId: null })">加一列</v-btn>
            </div>
            <v-row v-for="(it, i) in draft.items" :key="i" dense align="center">
              <v-col cols="7">
                <v-text-field v-model="it.desc" label="項目說明" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="4">
                <v-text-field v-model="it.amount" label="金額" type="number" density="compact" variant="outlined" hide-details />
              </v-col>
              <v-col cols="1" class="text-center">
                <v-btn icon size="x-small" variant="text" color="error" @click="removeItem(i)"><v-icon>mdi-close</v-icon></v-btn>
              </v-col>
            </v-row>

            <v-alert color="primary" variant="tonal" density="compact" class="mt-2 mb-3">
              <span class="text-body-2">合計 NT$ <b>{{ draftTotal.toLocaleString() }}</b>（{{ chineseAmount(draftTotal) }}）</span>
            </v-alert>

            <v-btn color="primary" variant="flat" block prepend-icon="mdi-content-save" :loading="saving" @click="handleCreate">
              存檔並取號
            </v-btn>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 收據列表 -->
      <v-col cols="12" md="6">
        <v-card elevation="1">
          <v-card-title class="text-subtitle-2 font-weight-bold py-2 px-3">已開立收據（{{ minguoFy }} 年度）</v-card-title>
          <div style="max-height:520px;overflow-y:auto">
            <v-table density="compact">
              <thead>
                <tr>
                  <th class="text-caption">編號</th>
                  <th class="text-caption">日期</th>
                  <th class="text-caption">社友</th>
                  <th class="text-caption text-right">金額</th>
                  <th class="text-caption text-center" style="width:110px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="!receipts.length">
                  <td colspan="5" class="text-center text-medium-emphasis text-caption pa-6">本年度尚未開立收據</td>
                </tr>
                <tr v-for="r in receipts" :key="r.id" :class="r.voided ? 'text-disabled' : ''">
                  <td class="text-caption font-weight-bold">
                    {{ r.receiptNo }}
                    <v-chip v-if="r.voided" size="x-small" color="error" variant="tonal">作廢</v-chip>
                  </td>
                  <td class="text-caption">{{ toMinguoDate(r.date) }}</td>
                  <td class="text-caption">{{ r.memberName }}</td>
                  <td class="text-caption text-right">{{ r.totalAmount.toLocaleString() }}</td>
                  <td class="text-center">
                    <v-btn icon size="x-small" variant="text" color="primary" title="列印" @click="printReceipt(r)"><v-icon>mdi-printer</v-icon></v-btn>
                    <v-btn v-if="!r.voided" icon size="x-small" variant="text" color="error" title="作廢" @click="handleVoid(r)"><v-icon>mdi-cancel</v-icon></v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- 收據列印版 -->
    <PrintSheet>
      <div v-if="printing" :class="printing.voided ? 'watermark-void' : ''">
        <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
        <div class="print-title">收　據</div>
        <div class="print-meta">收據編號：{{ printing.receiptNo }}　　開立日期：民國 {{ toMinguoDate(printing.date) }}</div>
        <p style="margin:10px 0">茲收到　<b style="font-size:14px">{{ printing.memberName }}</b>　繳納下列款項：</p>
        <table>
          <thead>
            <tr><th>項目說明</th><th class="num" style="width:140px">金額（NT$）</th></tr>
          </thead>
          <tbody>
            <tr v-for="(it, i) in printing.items" :key="i">
              <td>{{ it.desc }}</td><td class="num">{{ it.amount.toLocaleString() }}</td>
            </tr>
            <tr class="total">
              <td>合計　新臺幣{{ chineseAmount(printing.totalAmount) }}</td>
              <td class="num">{{ printing.totalAmount.toLocaleString() }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="printing.voided" style="color:#dc2626;font-weight:bold">本收據已作廢{{ printing.voidReason ? `（${printing.voidReason}）` : '' }}</div>
        <div class="print-sign">
          <span>經手人：{{ printing.issuedBy || '＿＿＿＿＿＿' }}</span>
          <span>財務：＿＿＿＿＿＿＿＿</span>
          <span>社章：</span>
        </div>
      </div>
    </PrintSheet>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, nextTick } from 'vue'
import Swal from 'sweetalert2'
import { fyOf, fyLabel, toMinguoDate, toMinguoYear } from '../accounting/fiscal.js'
import { apiFetch } from '../composables/apiFetch.js'
import PrintSheet from '../components/PrintSheet.vue'

const records = inject('records')
const members = inject('members')

const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const minguoFy = computed(() => toMinguoYear(selectedFy.value))
const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const r of records.value || []) {
    const fy = fyOf(r.date)
    if (fy != null) fys.add(fy)
  }
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})

const memberNames = computed(() => (members.value || []).map(m => m.name))

// ── 草稿 ──
function makeDraft() {
  return { date: today, memberName: '', items: [{ desc: '', amount: '', financeId: null }] }
}
const draft = ref(makeDraft())
const saving = ref(false)

const memberRecords = computed(() => {
  if (!draft.value.memberName) return []
  return (records.value || [])
    .filter(r => r.type === 'income' && (r.member || '').trim() === draft.value.memberName)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 40)
})
const pickedRecordIds = computed(() => draft.value.items.map(it => it.financeId).filter(Boolean))

function toggleRecord(r) {
  const idx = draft.value.items.findIndex(it => it.financeId === r.id)
  if (idx >= 0) {
    draft.value.items.splice(idx, 1)
  } else {
    // 蓋掉尚未填寫的空白列
    const emptyIdx = draft.value.items.findIndex(it => !it.desc && !it.amount)
    const item = { desc: `${r.item}（${toMinguoDate(r.date)}）`, amount: String(r.amount), financeId: r.id }
    if (emptyIdx >= 0) draft.value.items.splice(emptyIdx, 1, item)
    else draft.value.items.push(item)
  }
}
function removeItem(i) {
  draft.value.items.splice(i, 1)
  if (!draft.value.items.length) draft.value.items.push({ desc: '', amount: '', financeId: null })
}

const draftTotal = computed(() => Math.round(draft.value.items
  .reduce((s, it) => s + (parseFloat(it.amount) || 0), 0) * 100) / 100)

// 國字大寫金額（收據慣用）
const CN_DIGITS = ['零', '壹', '貳', '參', '肆', '伍', '陸', '柒', '捌', '玖']
const CN_UNITS = ['', '拾', '佰', '仟']
const CN_GROUPS = ['', '萬', '億']
function chineseAmount(n) {
  const num = Math.round(Number(n) || 0)
  if (num === 0) return '零元整'
  const groups = []
  let rest = num
  while (rest > 0) { groups.push(rest % 10000); rest = Math.floor(rest / 10000) }
  let s = ''
  for (let gi = groups.length - 1; gi >= 0; gi--) {
    const group = groups[gi]
    if (!group) continue
    let gs = ''
    let zeroPending = false
    for (let u = 3; u >= 0; u--) {
      const d = Math.floor(group / Math.pow(10, u)) % 10
      if (d === 0) { if (gs) zeroPending = true; continue }
      gs += (zeroPending ? '零' : '') + CN_DIGITS[d] + CN_UNITS[u]
      zeroPending = false
    }
    if (s && group < 1000 && !s.endsWith('零')) s += '零'
    s += gs + CN_GROUPS[gi]
  }
  return s + '元整'
}

// ── 收據列表 ──
const receipts = ref([])
async function loadReceipts() {
  try {
    const res = await apiFetch(`/api/receipts?fy=${minguoFy.value}`)
    receipts.value = res.ok ? await res.json() : []
  } catch { receipts.value = [] }
}

async function handleCreate() {
  const validItems = draft.value.items.filter(it => it.desc && parseFloat(it.amount))
  if (!draft.value.memberName || !validItems.length) {
    Swal.fire({ icon: 'warning', title: '請選擇社友並填寫至少一列明細', confirmButtonColor: '#4f46e5' })
    return
  }
  saving.value = true
  try {
    const res = await apiFetch('/api/receipts', {
      method: 'POST',
      body: JSON.stringify({
        date: draft.value.date,
        memberName: draft.value.memberName,
        items: validItems.map(it => ({ desc: it.desc, amount: parseFloat(it.amount) })),
        financeIds: validItems.map(it => it.financeId).filter(Boolean),
      }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || '開立失敗')
    receipts.value = [body, ...receipts.value]
    draft.value = makeDraft()
    const print = await Swal.fire({
      icon: 'success', title: `收據 ${body.receiptNo} 已開立`,
      showCancelButton: true, confirmButtonText: '立即列印', cancelButtonText: '關閉',
      confirmButtonColor: '#4f46e5',
    })
    if (print.isConfirmed) printReceipt(body)
  } catch (e) {
    Swal.fire({ icon: 'error', title: '開立失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

async function handleVoid(r) {
  const { value: reason, isConfirmed } = await Swal.fire({
    title: `作廢收據 ${r.receiptNo}？`,
    input: 'text', inputLabel: '作廢原因（選填）',
    icon: 'warning', showCancelButton: true,
    confirmButtonText: '確認作廢', cancelButtonText: '取消',
    confirmButtonColor: '#ef4444',
  })
  if (!isConfirmed) return
  try {
    const res = await apiFetch(`/api/receipts/${r.id}/void`, {
      method: 'PUT',
      body: JSON.stringify({ voidReason: reason || '' }),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || '作廢失敗')
    receipts.value = receipts.value.map(x => x.id === r.id ? { ...x, voided: 1, voidReason: body.voidReason } : x)
  } catch (e) {
    Swal.fire({ icon: 'error', title: '作廢失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

// ── 列印 ──
const printing = ref(null)
async function printReceipt(r) {
  printing.value = r
  await nextTick()
  window.print()
}

onMounted(loadReceipts)
</script>
