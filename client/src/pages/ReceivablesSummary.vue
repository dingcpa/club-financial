<template>
  <div>
    <div v-if="recLoading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <!-- 標題列 -->
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-file-document-check</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">{{ toMinguoYear(selectedYear) }}年度 應收帳款總覽</span>
        </div>
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-autocomplete
            v-model="filterMember"
            label="篩選社友"
            :items="memberOptions"
            density="compact"
            variant="outlined"
            hide-details
            clearable
            style="min-width:140px;max-width:200px"
          />
          <v-btn-toggle v-model="filterStatus" density="compact" variant="outlined" divided>
            <v-btn value="all" size="small">全部</v-btn>
            <v-btn value="pending" size="small" color="error">未收</v-btn>
            <v-btn value="paid" size="small" color="success">已收</v-btn>
            <v-btn value="waived" size="small" color="grey">免繳</v-btn>
          </v-btn-toggle>
          <v-select
            v-model="selectedYear"
            :items="availableYears"
            :item-title="y => toMinguoYear(y) + ' 年度'"
            :item-value="y => y"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:110px"
          />
        </div>
      </v-card-title>

      <!-- 年度總計摘要 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <v-row dense>
          <v-col cols="3">
            <v-card color="primary" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">總應收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-primary">NT$ {{ yearSummary.totalTarget.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">已收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-success">NT$ {{ yearSummary.totalPaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">未收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-error">NT$ {{ yearSummary.totalUnpaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="3">
            <v-card color="grey" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">免繳</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-grey">NT$ {{ yearSummary.totalWaived.toLocaleString() }}</div>
            </v-card>
          </v-col>
        </v-row>
      </div>

      <!-- 月份區塊列表 -->
      <div class="pa-3 pa-sm-4 pt-0">
        <div v-if="monthlyData.length === 0" class="text-center text-medium-emphasis pa-8">
          {{ filterMember ? '該社友無應收帳款' : '本年度無應收帳款' }}
        </div>

        <div v-for="month in monthlyData" :key="month.key" class="mb-4">
          <!-- 月份標題 -->
          <div
            class="d-flex justify-space-between align-center pa-2 rounded mb-2"
            style="background:#f1f5f9;cursor:pointer"
            @click="toggleMonth(month.key)"
          >
            <div class="d-flex align-center ga-2">
              <v-icon size="20" color="primary">mdi-calendar-month</v-icon>
              <span class="text-body-2 font-weight-bold">{{ month.label }}</span>
              <v-chip size="x-small" color="primary" variant="tonal">{{ month.items.length }} 項</v-chip>
            </div>
            <div class="d-flex align-center ga-3">
              <div class="text-right">
                <span class="text-caption text-success font-weight-bold">{{ month.paidAmount.toLocaleString() }}</span>
                <span class="text-caption text-medium-emphasis"> / {{ month.targetAmount.toLocaleString() }}</span>
              </div>
              <v-icon size="20">{{ expandedMonths.includes(month.key) ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
            </div>
          </div>

          <!-- 月份明細 -->
          <div v-if="expandedMonths.includes(month.key)">
            <!-- 按項目分組 -->
            <div v-for="group in month.groups" :key="group.title" class="mb-3">
              <div class="d-flex align-center ga-2 mb-2 px-1">
                <v-chip size="x-small" :color="group.sourceType === 'agency' ? 'warning' : 'primary'" variant="flat">
                  {{ group.sourceType === 'agency' ? '代收' : '社費' }}
                </v-chip>
                <span class="text-caption font-weight-bold">{{ group.title }}</span>
                <span class="text-caption text-medium-emphasis">
                  (應收 NT$ {{ group.perAmount.toLocaleString() }}{{ group.sourceType === 'dues' ? ' / 人' : '' }})
                </span>
              </div>

              <!-- 社友明細表 -->
              <v-table density="compact" class="rounded" style="border:1px solid #e2e8f0">
                <thead>
                  <tr>
                    <th style="width:120px">社友</th>
                    <th class="text-right" style="width:100px">應收</th>
                    <th class="text-right" style="width:100px">已收</th>
                    <th class="text-center" style="width:80px">狀態</th>
                    <th class="text-center" style="width:80px">操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in group.members" :key="item.id" :class="item.status === 'waived' ? 'text-decoration-line-through text-grey' : ''">
                    <td class="text-caption font-weight-medium">{{ item.memberName }}</td>
                    <td class="text-right text-caption">{{ item.amount.toLocaleString() }}</td>
                    <td class="text-right text-caption" :class="item.status === 'paid' ? 'text-success font-weight-bold' : 'text-medium-emphasis'">
                      {{ item.status === 'paid' ? (item.paidAmount || item.amount).toLocaleString() : '—' }}
                    </td>
                    <td class="text-center">
                      <v-icon v-if="item.status === 'paid'" size="16" color="success">mdi-check-circle</v-icon>
                      <v-icon v-else-if="item.status === 'waived'" size="16" color="grey">mdi-cancel</v-icon>
                      <v-icon v-else size="16" color="grey-lighten-1">mdi-clock-outline</v-icon>
                    </td>
                    <td class="text-center">
                      <v-btn
                        v-if="item.status === 'pending'"
                        size="x-small"
                        variant="tonal"
                        color="grey"
                        @click.stop="handleWaive(item)"
                      >免繳</v-btn>
                      <v-btn
                        v-if="item.status === 'waived'"
                        size="x-small"
                        variant="tonal"
                        color="primary"
                        @click.stop="handleReopen(item)"
                      >恢復</v-btn>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </div>
          </div>
        </div>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import Swal from 'sweetalert2'

const members = inject('members')
const receivables = inject('receivables')
const recLoading = inject('recLoading')
const fetchReceivables = inject('fetchReceivables')
const waiveReceivable = inject('waiveReceivable')
const reopenReceivable = inject('reopenReceivable')

const selectedYear = ref(new Date().getFullYear().toString())
const filterMember = ref(null)
const filterStatus = ref('all')
const expandedMonths = ref([])

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }

// 切換年度時重新載入 receivables
watch(selectedYear, (year) => {
  fetchReceivables({ year })
})

const availableYears = computed(() => {
  const years = [...new Set((receivables.value || []).map(r => r.dueYear))]
  if (!years.includes(selectedYear.value)) years.push(selectedYear.value)
  return years.sort((a, b) => b - a)
})

const memberOptions = computed(() => (members.value || []).map(m => m.name))

// 直接使用 receivables 資料（不再虛擬推算）
const filteredReceivables = computed(() => {
  let items = (receivables.value || []).filter(r => r.dueYear === selectedYear.value)
  if (filterMember.value) {
    items = items.filter(r => r.memberName === filterMember.value)
  }
  if (filterStatus.value !== 'all') {
    items = items.filter(r => r.status === filterStatus.value)
  }
  return items
})

// 年度摘要
const yearSummary = computed(() => {
  // 摘要計算不受 filterStatus 影響，但受 filterMember 影響
  let items = (receivables.value || []).filter(r => r.dueYear === selectedYear.value)
  if (filterMember.value) {
    items = items.filter(r => r.memberName === filterMember.value)
  }
  const totalTarget = items.filter(r => r.status !== 'waived').reduce((s, r) => s + r.amount, 0)
  const totalPaid = items.filter(r => r.status === 'paid').reduce((s, r) => s + (r.paidAmount || r.amount), 0)
  const totalWaived = items.filter(r => r.status === 'waived').reduce((s, r) => s + r.amount, 0)
  return { totalTarget, totalPaid, totalUnpaid: totalTarget - totalPaid, totalWaived }
})

// 按月份分組
const monthlyData = computed(() => {
  const monthMap = {}
  filteredReceivables.value.forEach(item => {
    const key = item.dueDate ? item.dueDate.substring(0, 7) : `${selectedYear.value}-00`
    if (!monthMap[key]) monthMap[key] = []
    monthMap[key].push(item)
  })

  return Object.keys(monthMap)
    .sort()
    .map(key => {
      const items = monthMap[key]
      const activeItems = items.filter(r => r.status !== 'waived')
      const targetAmount = activeItems.reduce((s, r) => s + r.amount, 0)
      const paidAmount = items.filter(r => r.status === 'paid').reduce((s, r) => s + (r.paidAmount || r.amount), 0)

      // 在月份內按「項目名稱」分組
      const groupMap = {}
      items.forEach(item => {
        const gKey = `${item.sourceType}:${item.sourceRef}`
        if (!groupMap[gKey]) {
          groupMap[gKey] = {
            sourceType: item.sourceType,
            title: item.sourceRef,
            perAmount: item.amount,
            members: [],
          }
        }
        groupMap[gKey].members.push(item)
      })

      const label = key.endsWith('-00')
        ? '未指定月份'
        : `${parseInt(key.split('-')[1])} 月`

      return {
        key,
        label,
        items,
        targetAmount,
        paidAmount,
        groups: Object.values(groupMap),
      }
    })
})

function toggleMonth(key) {
  const idx = expandedMonths.value.indexOf(key)
  if (idx >= 0) expandedMonths.value.splice(idx, 1)
  else expandedMonths.value.push(key)
}

async function handleWaive(item) {
  const { value: reason } = await Swal.fire({
    title: '免繳確認',
    html: `確定要將 <b>${item.memberName}</b> 的「${item.sourceRef}」標記為免繳嗎？`,
    input: 'text',
    inputLabel: '免繳原因（選填）',
    inputPlaceholder: '例：榮譽社友免繳',
    showCancelButton: true,
    confirmButtonColor: '#6b7280',
    cancelButtonColor: '#4f46e5',
    confirmButtonText: '確定免繳',
    cancelButtonText: '取消',
  })
  if (reason !== undefined) {
    await waiveReceivable(item.id, reason || '')
  }
}

async function handleReopen(item) {
  const result = await Swal.fire({
    title: '恢復應收',
    html: `確定要將 <b>${item.memberName}</b> 的「${item.sourceRef}」恢復為待收嗎？`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確定恢復',
    cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    await reopenReceivable(item.id)
  }
}
</script>
