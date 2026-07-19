<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-lock-check</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">年度關帳（屆次交接）</span>
      </div>
      <v-select
        v-model="selectedFy" :items="fyOptions" density="compact" variant="outlined" hide-details
        style="min-width:130px"
      />
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <v-alert
        density="compact" variant="tonal" class="mb-3"
        :color="lockDate ? 'success' : 'info'"
        :icon="lockDate ? 'mdi-lock' : 'mdi-lock-open-variant'"
      >
        <span class="text-caption">
          {{ lockDate
            ? `目前已關帳至 ${toMinguoDate(lockDate)}——該日（含）以前的單據、傳票與收款均為唯讀。`
            : '尚未設定關帳日。年度收支結轉由引擎自動處理，關帳僅是把該年度鎖為唯讀，防止交接後誤改。' }}
        </span>
        <template v-if="lockDate" #append>
          <v-btn size="x-small" variant="tonal" color="warning" @click="handleUnlock">解除關帳</v-btn>
        </template>
      </v-alert>

      <!-- 步驟 1：檢核 -->
      <div class="text-subtitle-2 font-weight-bold mb-2">1. 結帳前檢核（{{ fyLabel(selectedFy) }}）</div>
      <v-list density="compact" class="mb-3">
        <v-list-item v-for="c in checks" :key="c.title" :prepend-icon="c.ok ? 'mdi-check-circle' : 'mdi-alert-circle'"
          :class="c.ok ? 'text-success' : (c.blocking ? 'text-error' : 'text-warning')">
          <v-list-item-title class="text-caption">{{ c.title }}</v-list-item-title>
          <v-list-item-subtitle v-if="c.detail" class="text-caption">{{ c.detail }}</v-list-item-subtitle>
        </v-list-item>
      </v-list>

      <!-- 步驟 2：年度摘要 -->
      <div class="text-subtitle-2 font-weight-bold mb-2">2. 年度摘要</div>
      <v-row dense class="mb-3">
        <v-col cols="6" sm="3">
          <v-card variant="tonal" color="success" class="pa-2 text-center">
            <div class="text-caption text-medium-emphasis">收入合計</div>
            <div class="text-body-2 font-weight-bold">{{ fyIS.totalIncome.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card variant="tonal" color="error" class="pa-2 text-center">
            <div class="text-caption text-medium-emphasis">支出合計</div>
            <div class="text-body-2 font-weight-bold">{{ fyIS.totalExpense.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card variant="tonal" :color="fyIS.net >= 0 ? 'primary' : 'warning'" class="pa-2 text-center">
            <div class="text-caption text-medium-emphasis">本期餘絀</div>
            <div class="text-body-2 font-weight-bold">{{ fyIS.net.toLocaleString() }}</div>
          </v-card>
        </v-col>
        <v-col cols="6" sm="3">
          <v-card variant="tonal" color="primary" class="pa-2 text-center">
            <div class="text-caption text-medium-emphasis">{{ toMinguoDate(fyEnd) }} 資產合計</div>
            <div class="text-body-2 font-weight-bold">{{ fyBS.totalAssets.toLocaleString() }}</div>
          </v-card>
        </v-col>
      </v-row>
      <div class="text-caption text-medium-emphasis mb-3">
        收支餘絀於 {{ toMinguoDate(fyEnd) }} 由引擎自動結轉累積餘絀；資產負債（含應收/預收）自動帶入下年度，無需另設期初。
      </div>

      <!-- 步驟 3：執行 -->
      <div class="text-subtitle-2 font-weight-bold mb-2">3. 執行關帳</div>
      <v-btn
        color="primary" variant="flat" prepend-icon="mdi-lock"
        :disabled="!!blockingIssue || (lockDate >= fyEnd)"
        :loading="saving"
        @click="handleLock"
      >
        關帳至 {{ toMinguoDate(fyEnd) }}（鎖定 {{ fyLabel(selectedFy) }}）
      </v-btn>
      <div v-if="blockingIssue" class="text-caption text-error mt-2">請先排除：{{ blockingIssue }}</div>
      <div v-else-if="lockDate >= fyEnd" class="text-caption text-medium-emphasis mt-2">此年度已在關帳範圍內。</div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'
import { incomeStatement, balanceSheet } from '../accounting/ledger.js'
import { fyOf, fyLabel, fyRange, toMinguoDate } from '../accounting/fiscal.js'

const accounting = inject('accounting')
const appSettings = inject('appSettings')
const saveAppSettings = inject('saveAppSettings')
const fetchAppSettings = inject('fetchAppSettings')
const receivables = inject('receivables')
const bankReconciliations = inject('bankReconciliations')
const accounts = inject('accounts')

const today = new Date().toISOString().split('T')[0]
const selectedFy = ref(fyOf(today))
const saving = ref(false)

const entries = computed(() => accounting.entries.value)
const acctByCode = computed(() => accounting.acctByCode.value)
const lockDate = computed(() => appSettings?.value?.['accounting.lockDate'] || '')

const fyOptions = computed(() => {
  const fys = new Set([fyOf(today)])
  for (const e of entries.value) {
    const fy = fyOf(e.date)
    if (fy != null) fys.add(fy)
  }
  return [...fys].sort((a, b) => b - a).map(fy => ({ title: fyLabel(fy), value: fy }))
})

const fyStart = computed(() => fyRange(selectedFy.value)[0])
const fyEnd = computed(() => fyRange(selectedFy.value)[1])

const fyIS = computed(() => incomeStatement(entries.value, acctByCode.value, { from: fyStart.value, to: fyEnd.value }))
const fyBS = computed(() => balanceSheet(entries.value, acctByCode.value, { asOf: fyEnd.value }))

// 檢核清單
const checks = computed(() => {
  const out = []
  const errors = accounting.diagnostics.value.filter(d => d.level === 'error')
  out.push({
    title: errors.length ? `引擎診斷有 ${errors.length} 項錯誤` : '分錄推導引擎診斷無錯誤',
    detail: errors.length ? errors[0].message : '',
    ok: !errors.length, blocking: true,
  })
  out.push({
    title: fyBS.value.balanced ? `${toMinguoDate(fyEnd.value)} 資產負債表平衡` : '資產負債表不平衡！',
    ok: fyBS.value.balanced, blocking: true,
  })
  const outstanding = (receivables?.value || []).filter(r =>
    (r.status === 'pending' || r.status === 'partial') &&
    r.dueDate && r.dueDate >= fyStart.value && r.dueDate <= fyEnd.value
  )
  out.push({
    title: outstanding.length ? `本年度尚有 ${outstanding.length} 筆應收未收` : '本年度應收帳款均已收訖或處理',
    detail: outstanding.length ? `${outstanding.slice(0, 5).map(r => `${r.memberName}/${r.sourceRef}`).join('、')}${outstanding.length > 5 ? '…' : ''}（可先催繳，或按應收留待下年度續收）` : '',
    ok: !outstanding.length, blocking: false,
  })
  const cashAccts = (accounts?.value || []).filter(a => a.isCash && a.active)
  const reconciled = cashAccts.filter(a =>
    (bankReconciliations?.value || []).some(r => r.accountCode === a.code && r.reconDate >= fyEnd.value)
  )
  out.push({
    title: reconciled.length === cashAccts.length && cashAccts.length
      ? '各銀行帳戶已完成年度末存摺核對'
      : `建議先於資產負債表完成 ${toMinguoDate(fyEnd.value)} 之後的存摺核對`,
    ok: reconciled.length === cashAccts.length && cashAccts.length > 0, blocking: false,
  })
  return out
})

const blockingIssue = computed(() => {
  const bad = checks.value.find(c => !c.ok && c.blocking)
  return bad ? bad.title : ''
})

async function handleLock() {
  const result = await Swal.fire({
    title: `關帳至 ${toMinguoDate(fyEnd.value)}？`,
    html: `${fyLabel(selectedFy.value)} 之全部單據將轉為唯讀。<br><span class="text-caption">如需更正，管理員可隨時回此頁解除關帳。</span>`,
    icon: 'question', showCancelButton: true,
    confirmButtonColor: '#4f46e5', cancelButtonColor: '#6b7280',
    confirmButtonText: '執行關帳', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  saving.value = true
  try {
    await saveAppSettings({ 'accounting.lockDate': fyEnd.value })
    await fetchAppSettings()
    Swal.fire({ icon: 'success', title: '已完成關帳', text: `${fyLabel(selectedFy.value)} 已鎖定唯讀，可安心交接。`, confirmButtonColor: '#4f46e5' })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '關帳失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}

async function handleUnlock() {
  const result = await Swal.fire({
    title: '解除關帳？',
    text: '解除後歷史單據可再編輯，請於更正後重新關帳。',
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#f59e0b', cancelButtonColor: '#6b7280',
    confirmButtonText: '解除', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await saveAppSettings({ 'accounting.lockDate': '' })
  await fetchAppSettings()
}
</script>
