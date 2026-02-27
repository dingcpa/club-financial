<template>
  <div>
    <div class="d-flex align-center ga-2 mb-6">
      <v-icon :color="cfg.color" size="28">{{ cfg.icon }}</v-icon>
      <h3 class="text-h5 font-weight-bold">{{ cfg.label }}歷史記錄</h3>
      <v-chip size="small" variant="tonal" :color="cfg.color">{{ filtered.length }} 筆</v-chip>
    </div>

    <!-- Search -->
    <v-text-field
      v-model="search"
      placeholder="搜尋項目、社友、金額..."
      prepend-inner-icon="mdi-magnify"
      :append-inner-icon="search ? 'mdi-close' : undefined"
      @click:append-inner="search = ''"
      density="compact"
      variant="outlined"
      hide-details
      class="mb-4"
      @update:model-value="page = 1"
    />

    <!-- Table -->
    <v-card elevation="1" :style="`border:1px solid ${cfg.borderColor}`">
      <div style="overflow-x:auto">
        <v-table density="compact">
          <thead :style="`background:${cfg.bgColor}`">
            <tr>
              <th>日期</th>
              <th>{{ type === 'transfer' ? '帳戶' : '項目' }}</th>
              <th v-if="type !== 'transfer'">對象 / 帳戶</th>
              <th class="text-right">金額</th>
              <th>備註</th>
              <th class="text-center">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="paged.length === 0">
              <td :colspan="type !== 'transfer' ? 6 : 5" class="text-center text-medium-emphasis pa-12">
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
              <td class="text-caption text-medium-emphasis">{{ toMinguoDate(r.date) }}</td>
              <td>
                <span v-if="type === 'transfer'" class="text-primary font-weight-medium">
                  {{ r.fromAccount }} → {{ r.toAccount }}
                </span>
                <span v-else class="font-weight-medium">{{ r.item }}</span>
              </td>
              <td v-if="type !== 'transfer'" class="text-caption">
                <span v-if="type === 'income' && r.member" class="text-primary">{{ r.member }}</span>
                <span v-if="r.account" :class="r.member ? 'text-medium-emphasis ml-1' : ''">{{ r.account }}</span>
              </td>
              <td class="text-right font-weight-bold" :style="`color:${cfg.colorHex}`">
                {{ cfg.sign !== '⇄' ? cfg.sign : '' }}{{ Math.abs(r.amount).toLocaleString() }}
              </td>
              <td class="text-caption text-medium-emphasis">{{ r.remark || '-' }}</td>
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
      <div v-if="totalPages > 1" class="d-flex justify-space-between align-center px-4 py-2" style="border-top:1px solid rgba(0,0,0,0.08);background:#f8fafc">
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

const PAGE_SIZE = 15

const records = inject('records')
const activeTab = inject('activeTab')
const editingRecord = inject('editingRecord')
const handleEditClick = inject('handleEditClick')

const search = ref('')
const page = ref(1)

const TYPE_CONFIG = {
  income:   { label: '收入單', color: 'success', colorHex: '#10b981', bgColor: '#f0fdf4', borderColor: '#bbf7d0', sign: '+',  icon: 'mdi-trending-up' },
  expense:  { label: '支出單', color: 'error',   colorHex: '#ef4444', bgColor: '#fef2f2', borderColor: '#fecaca', sign: '-',  icon: 'mdi-trending-down' },
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
    .filter(r => {
      if (!q) return true
      return (
        (r.item || '').toLowerCase().includes(q) ||
        (r.member || '').toLowerCase().includes(q) ||
        (r.remark || '').toLowerCase().includes(q) ||
        (r.account || '').toLowerCase().includes(q) ||
        (r.fromAccount || '').toLowerCase().includes(q) ||
        (r.toAccount || '').toLowerCase().includes(q) ||
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
