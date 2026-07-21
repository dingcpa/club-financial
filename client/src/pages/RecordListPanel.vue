<template>
  <div>
    <div class="d-flex align-center ga-2 mb-4">
      <v-icon :color="cfg.color" size="24">{{ cfg.icon }}</v-icon>
      <h3 class="text-body-1 text-sm-h5 font-weight-bold">{{ cfg.label }}歷史記錄</h3>
      <v-chip size="small" variant="tonal" :color="cfg.color">{{ filtered.length }} 筆</v-chip>
    </div>

    <!-- Search -->
    <v-row dense class="mb-3">
      <v-col cols="12" sm="6">
        <v-text-field
          v-model="search"
          placeholder="搜尋項目、社友、科目、備註、金額..."
          prepend-inner-icon="mdi-magnify"
          :append-inner-icon="search ? 'mdi-close' : undefined"
          @click:append-inner="search = ''"
          density="compact"
          variant="outlined"
          hide-details
          @update:model-value="page = 1"
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-text-field v-model="dateFrom" label="期間起" type="date" density="compact" variant="outlined" hide-details clearable @update:model-value="page = 1" />
      </v-col>
      <v-col cols="6" sm="3">
        <v-text-field v-model="dateTo" label="期間迄" type="date" density="compact" variant="outlined" hide-details clearable @update:model-value="page = 1" />
      </v-col>
    </v-row>

    <!-- Table（手機橫向捲動） -->
    <v-card elevation="1" :style="`border:1px solid ${cfg.borderColor}`">
      <div style="overflow-x:auto">
        <v-table density="compact">
          <thead :style="`background:${cfg.bgColor}`">
            <tr>
              <th class="text-caption">日期</th>
              <th class="text-caption">{{ type === 'transfer' ? '帳戶' : '項目' }}</th>
              <th v-if="type !== 'transfer'" class="text-caption d-none d-sm-table-cell">科目 / 活動</th>
              <th v-if="type !== 'transfer'" class="text-caption">對象 / 帳戶</th>
              <th class="text-right text-caption">金額</th>
              <th class="text-caption d-none d-sm-table-cell">備註</th>
              <th class="text-center text-caption">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paged.length === 0">
              <td :colspan="type !== 'transfer' ? 7 : 5" class="text-center text-medium-emphasis pa-12">
                {{ search ? '查無符合的記錄' : '尚無記錄' }}
              </td>
            </tr>
            <tr
              v-for="r in paged"
              :key="r.id"
              :style="editingRecord?.id === r.id ? `background:${cfg.bgColor};border-left:3px solid ${cfg.colorHex}` : ''"
              style="cursor:pointer"
              @click="handleEditClick(r)"
            >
              <td class="text-caption text-medium-emphasis" style="white-space:nowrap">
                {{ toMinguoDate(r.date) }}
                <div v-if="r.occurredDate && r.occurredDate !== r.date" class="text-caption" style="font-size:10px">發生 {{ toMinguoDate(r.occurredDate) }}</div>
              </td>
              <td>
                <span v-if="type === 'transfer'" class="text-caption text-primary font-weight-medium">
                  {{ fundAccountLabel(r.fromAccount) }} → {{ fundAccountLabel(r.toAccount) }}
                </span>
                <span v-else class="text-caption font-weight-medium">{{ r.item }}</span>
                <v-icon v-if="attachCountOf(r)" size="12" color="primary" class="ml-1" :title="`${attachCountOf(r)} 張附件`">mdi-paperclip</v-icon>
              </td>
              <td v-if="type !== 'transfer'" class="text-caption d-none d-sm-table-cell">
                <span v-if="acctOf(r)" class="text-medium-emphasis">{{ acctOf(r) }}</span>
                <v-chip v-if="projectOf(r)" size="x-small" variant="tonal" color="primary" class="ml-1">{{ projectOf(r) }}</v-chip>
              </td>
              <td v-if="type !== 'transfer'" class="text-caption">
                <span v-if="r.member" class="text-primary">{{ r.member }}</span>
                <span v-if="r.account" :class="r.member ? 'text-medium-emphasis ml-1' : ''">{{ fundAccountLabel(r.account) }}</span>
              </td>
              <td class="text-right text-caption font-weight-bold" :style="`color:${cfg.colorHex}`" style="white-space:nowrap">
                {{ cfg.sign !== '⇄' ? cfg.sign : '' }}{{ Math.abs(r.amount).toLocaleString() }}
              </td>
              <td class="text-caption text-medium-emphasis d-none d-sm-table-cell">{{ r.remark || '-' }}</td>
              <td class="text-center">
                <v-btn icon size="x-small" variant="text" :color="cfg.color" @click.stop="handleEditClick(r)">
                  <v-icon size="16">mdi-pencil</v-icon>
                </v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="d-flex justify-space-between align-center px-3 py-2" style="border-top:1px solid rgba(0,0,0,0.08);background:#f8fafc">
        <v-btn icon size="x-small" variant="text" :disabled="page <= 1" @click="page--">
          <v-icon>mdi-chevron-left</v-icon>
        </v-btn>
        <span class="text-caption text-medium-emphasis">{{ page }} / {{ totalPages }}</span>
        <v-btn icon size="x-small" variant="text" :disabled="page >= totalPages" @click="page++">
          <v-icon>mdi-chevron-right</v-icon>
        </v-btn>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { fundAccountLabel, resolveRecordAccount, accountTitle } from '../accounting/coa.js'

const PAGE_SIZE = 15

const records = inject('records')
const accounts = inject('accounts')
const projects = inject('projects')
const attachmentsMeta = inject('attachmentsMeta')

function attachCountOf(r) {
  return (attachmentsMeta?.value || []).filter(a => a.refType === 'finance' && String(a.refId) === String(r.id)).length
}
const activeTab = inject('activeTab')
const editingRecord = inject('editingRecord')
const handleEditClick = inject('handleEditClick')

function acctOf(r) {
  const code = resolveRecordAccount(r)
  return code ? accountTitle(accounts?.value, code) : ''
}

function projectOf(r) {
  if (!r.projectId) return ''
  return (projects?.value || []).find(p => p.id === r.projectId)?.name || ''
}

const search = ref('')
const dateFrom = ref(null)
const dateTo = ref(null)
const page = ref(1)

const TYPE_CONFIG = {
  income:   { label: '收款單', color: 'success', colorHex: '#10b981', bgColor: '#f0fdf4', borderColor: '#bbf7d0', sign: '+',  icon: 'mdi-trending-up' },
  expense:  { label: '付款單', color: 'error',   colorHex: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca', sign: '-',  icon: 'mdi-trending-down' },
  transfer: { label: '調撥單', color: 'primary',  colorHex: '#4f46e5', bgColor: '#f0f4ff', borderColor: '#c7d2fe', sign: '⇄', icon: 'mdi-swap-horizontal' },
}

const type = computed(() => {
  const tab = activeTab.value
  if (tab === 'income-list') return 'income'
  if (tab === 'expense-list') return 'expense'
  return 'transfer'
})

const cfg = computed(() => TYPE_CONFIG[type.value] || TYPE_CONFIG.income)

function toMinguoDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${parseInt(y) - 1911}-${m}-${d}`
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (records.value || [])
    .filter(r => r.type === type.value)
    .filter(r => (!dateFrom.value || r.date >= dateFrom.value) && (!dateTo.value || r.date <= dateTo.value))
    .filter(r => {
      if (!q) return true
      return (
        (r.item || '').toLowerCase().includes(q) ||
        (r.member || '').toLowerCase().includes(q) ||
        (r.remark || '').toLowerCase().includes(q) ||
        (r.account || '').toLowerCase().includes(q) ||
        (r.fromAccount || '').toLowerCase().includes(q) ||
        (r.toAccount || '').toLowerCase().includes(q) ||
        acctOf(r).toLowerCase().includes(q) ||
        projectOf(r).toLowerCase().includes(q) ||
        toMinguoDate(r.date).includes(q) ||
        String(r.amount || '').includes(q)
      )
    })
    .sort((a, b) => b.date.localeCompare(a.date))
})

const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))

const paged = computed(() => {
  const p = Math.min(page.value, totalPages.value)
  return filtered.value.slice((p - 1) * PAGE_SIZE, p * PAGE_SIZE)
})
</script>
