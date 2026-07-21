<template>
  <v-dialog :model-value="!!entry" :max-width="xs ? undefined : 640" :fullscreen="xs" @update:model-value="$emit('close')">
    <v-card v-if="entry">
      <v-card-title class="d-flex justify-space-between align-center pa-4">
        <div>
          <div class="text-h6 font-weight-bold">傳票 {{ voucherNo }}</div>
          <div class="text-caption text-medium-emphasis">{{ toMinguoDate(entry.date) }} · {{ sourceLabel }}</div>
        </div>
        <v-btn icon variant="text" @click="$emit('close')"><v-icon>mdi-close</v-icon></v-btn>
      </v-card-title>
      <v-card-text class="pa-4 pt-0">
        <div class="text-body-2 mb-3">{{ entry.description }}</div>
        <v-table density="compact">
          <thead>
            <tr>
              <th>科目</th>
              <th>對象 / 活動</th>
              <th class="text-right">借方</th>
              <th class="text-right">貸方</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(l, i) in entry.lines" :key="i">
              <td class="text-caption">{{ acctTitle(l.accountCode) }}</td>
              <td class="text-caption text-medium-emphasis">
                {{ l.person }}<v-chip v-if="projectName(l.projectId)" size="x-small" variant="tonal" color="primary" class="ml-1">{{ projectName(l.projectId) }}</v-chip>
              </td>
              <td class="text-right text-caption">{{ l.debit ? l.debit.toLocaleString() : '' }}</td>
              <td class="text-right text-caption">{{ l.credit ? l.credit.toLocaleString() : '' }}</td>
            </tr>
            <tr class="font-weight-bold" style="background:#f8fafc">
              <td class="text-caption" colspan="2">合計</td>
              <td class="text-right text-caption">{{ totalDebit.toLocaleString() }}</td>
              <td class="text-right text-caption">{{ totalCredit.toLocaleString() }}</td>
            </tr>
          </tbody>
        </v-table>

        <div class="d-flex flex-wrap ga-2 mt-4">
          <v-btn
            v-if="editableFinance"
            color="primary" variant="flat" prepend-icon="mdi-pencil" size="small"
            @click="editSource"
          >編輯原始單據</v-btn>
          <v-btn
            v-else-if="entry.sourceType === 'receivable' || entry.sourceType === 'recognition' && String(entry.id).startsWith('rcv')"
            color="primary" variant="tonal" prepend-icon="mdi-file-document-check" size="small"
            @click="goReceivables"
          >前往應收帳款頁</v-btn>
          <v-btn
            v-else-if="entry.sourceType === 'manual'"
            color="primary" variant="tonal" prepend-icon="mdi-pencil" size="small"
            @click="goManual"
          >前往手工傳票頁</v-btn>
          <v-chip v-else size="small" variant="tonal" color="grey">系統推導分錄，不可直接編輯</v-chip>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import { toMinguoDate } from '../accounting/fiscal.js'

const props = defineProps({ entry: { type: Object, default: null } })
const emit = defineEmits(['close'])
const { xs } = useDisplay()

const accounts = inject('accounts')
const projects = inject('projects')
const records = inject('records')
const handleEditClick = inject('handleEditClick')
const setActiveTab = inject('setActiveTab')

const SOURCE_LABELS = {
  opening: '期初餘額', receivable: '開立帳款', recognition: '預收/預付轉列',
  collection: '收款沖帳', income: '收款單', expense: '付款單', transfer: '調撥單',
  overpayment: '溢收款', 'agency-payout': '代收款付出', manual: '手工傳票', closing: '年度結轉',
}
const sourceLabel = computed(() => SOURCE_LABELS[props.entry?.sourceType] || props.entry?.sourceType)
const voucherNo = computed(() => props.entry ? `#${props.entry.date.replaceAll('-', '')}-${props.entry.id}` : '')

const totalDebit = computed(() => (props.entry?.lines || []).reduce((s, l) => s + (l.debit || 0), 0))
const totalCredit = computed(() => (props.entry?.lines || []).reduce((s, l) => s + (l.credit || 0), 0))

function acctTitle(code) {
  const a = (accounts?.value || []).find(x => x.code === code)
  return a ? `${a.code} ${a.name}` : code
}
function projectName(id) {
  if (!id) return ''
  return (projects?.value || []).find(p => p.id === id)?.name || ''
}

// 來源為 finance 單據（含收款單/轉帳單）才可直接編輯
const editableFinance = computed(() => {
  const t = props.entry?.sourceType
  return ['collection', 'income', 'expense', 'transfer', 'overpayment', 'agency-payout'].includes(t) ||
    (t === 'recognition' && String(props.entry?.id).startsWith('fin-'))
})

function editSource() {
  const rec = (records?.value || []).find(r => r.id === props.entry.sourceId)
  if (rec) {
    emit('close')
    handleEditClick(rec)
  }
}
function goReceivables() {
  emit('close')
  setActiveTab('receivables')
}
function goManual() {
  emit('close')
  setActiveTab('journal-entry')
}
</script>
