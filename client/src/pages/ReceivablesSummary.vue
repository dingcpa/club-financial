<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
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
          <v-col cols="4">
            <v-card color="primary" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">總應收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-primary">NT$ {{ yearSummary.totalTarget.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="4">
            <v-card color="success" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">已收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-success">NT$ {{ yearSummary.totalPaid.toLocaleString() }}</div>
            </v-card>
          </v-col>
          <v-col cols="4">
            <v-card color="error" variant="tonal" class="pa-2 pa-sm-3 text-center">
              <div class="text-caption text-medium-emphasis">未收</div>
              <div class="text-body-2 text-sm-body-1 font-weight-bold text-error">NT$ {{ yearSummary.totalUnpaid.toLocaleString() }}</div>
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
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in group.members" :key="item.memberName">
                    <td class="text-caption font-weight-medium">{{ item.memberName }}</td>
                    <td class="text-right text-caption">{{ item.targetAmount.toLocaleString() }}</td>
                    <td class="text-right text-caption" :class="item.paid ? 'text-success font-weight-bold' : 'text-medium-emphasis'">
                      {{ item.paid ? item.paidAmount.toLocaleString() : '—' }}
                    </td>
                    <td class="text-center">
                      <v-icon v-if="item.paid" size="16" color="success">mdi-check-circle</v-icon>
                      <v-icon v-else size="16" color="grey-lighten-1">mdi-clock-outline</v-icon>
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
import { ref, computed, inject } from 'vue'

const records = inject('records')
const members = inject('members')
const duesSettings = inject('duesSettings')
const loading = inject('loading')
const agencyCollections = inject('agencyCollections')

const selectedYear = ref(new Date().getFullYear().toString())
const filterMember = ref(null)
const expandedMonths = ref([])

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }

const availableYears = computed(() => {
  const years = [...new Set((records.value || []).map(r => r.date.split('-')[0]))]
  if (!years.includes(selectedYear.value)) years.push(selectedYear.value)
  return years.sort((a, b) => b - a)
})

const memberOptions = computed(() => (members.value || []).map(m => m.name))

// 建立所有應收項目（社費 + 代收款），每項展開為每位社友一筆
const allReceivables = computed(() => {
  const items = []
  const year = selectedYear.value

  // 社費應收：每個 dues_settings x 每位社友
  const memberPayments = {}
  ;(records.value || [])
    .filter(r => r.type === 'income' && r.member && r.item && r.date.startsWith(year))
    .forEach(r => {
      const key = `${r.member.trim()}|${r.item.trim()}`
      memberPayments[key] = (memberPayments[key] || 0) + r.amount
    })

  const allMembers = (members.value || []).map(m => m.name)

  ;(duesSettings.value || []).forEach(setting => {
    if (!setting.standardAmount || setting.standardAmount <= 0) return
    const dueMonth = setting.dueDate ? setting.dueDate.substring(0, 7) : null
    // 只列屬於本年度的社費
    if (dueMonth && !dueMonth.startsWith(year)) return

    allMembers.forEach(memberName => {
      const key = `${memberName}|${setting.category}`
      const paidAmount = memberPayments[key] || 0
      items.push({
        sourceType: 'dues',
        title: setting.category,
        memberName,
        targetAmount: setting.standardAmount,
        paidAmount,
        paid: paidAmount > 0,
        dueMonth: dueMonth || `${year}-00`,
      })
    })
  })

  // 代收款應收：每個 agency_collection x targetMembers 中的社友
  ;(agencyCollections.value || [])
    .filter(col => col.createdDate?.startsWith(year))
    .forEach(col => {
      const dueMonth = col.createdDate.substring(0, 7)
      col.targetMembers.forEach(target => {
        const paid = col.paidMembers.find(p => p.memberName === target.name)
        items.push({
          sourceType: 'agency',
          title: col.title,
          memberName: target.name,
          targetAmount: target.amount,
          paidAmount: paid?.amount || 0,
          paid: !!paid,
          dueMonth,
        })
      })
    })

  return items
})

// 套用社友篩選
const filteredReceivables = computed(() => {
  if (!filterMember.value) return allReceivables.value
  return allReceivables.value.filter(r => r.memberName === filterMember.value)
})

// 年度摘要
const yearSummary = computed(() => {
  const items = filteredReceivables.value
  const totalTarget = items.reduce((s, r) => s + r.targetAmount, 0)
  const totalPaid = items.reduce((s, r) => s + r.paidAmount, 0)
  return { totalTarget, totalPaid, totalUnpaid: totalTarget - totalPaid }
})

// 按月份分組
const monthlyData = computed(() => {
  const monthMap = {}
  filteredReceivables.value.forEach(item => {
    const key = item.dueMonth
    if (!monthMap[key]) monthMap[key] = []
    monthMap[key].push(item)
  })

  return Object.keys(monthMap)
    .sort()
    .map(key => {
      const items = monthMap[key]
      const targetAmount = items.reduce((s, r) => s + r.targetAmount, 0)
      const paidAmount = items.reduce((s, r) => s + r.paidAmount, 0)

      // 在月份內按「項目名稱」分組
      const groupMap = {}
      items.forEach(item => {
        const gKey = `${item.sourceType}:${item.title}`
        if (!groupMap[gKey]) {
          groupMap[gKey] = {
            sourceType: item.sourceType,
            title: item.title,
            perAmount: item.targetAmount,
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
</script>
