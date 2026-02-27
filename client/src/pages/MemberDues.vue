<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <!-- 標題列 -->
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-account-group</v-icon>
          <span class="text-h6 font-weight-bold">{{ toMinguoYear(selectedYear) }}年度 社友繳費明細表</span>
        </div>
        <div class="d-flex ga-2">
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openAddModal">新增收費項目</v-btn>
          <v-select
            v-model="selectedYear"
            :items="availableYears"
            :item-title="y => toMinguoYear(y) + ' 年度'"
            :item-value="y => y"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:120px"
          />
        </div>
      </v-card-title>

      <!-- 繳費表格 -->
      <div style="overflow:auto; max-height:calc(100vh - 300px)">
        <v-table density="compact" style="min-width:600px">
          <thead>
            <tr>
              <th class="sticky-col-0" style="min-width:80px">職稱</th>
              <th class="sticky-col-1" style="min-width:100px">社友姓名</th>
              <th
                v-for="cat in duesCategories"
                :key="cat"
                class="text-center"
                style="min-width:130px;white-space:nowrap;cursor:pointer"
                @click="openEditModal(cat)"
                :title="'點擊編輯 ' + cat + ' 的收費設定'"
              >
                <div class="d-flex flex-column align-center ga-1">
                  <span>{{ cat }}</span>
                  <span v-if="getCatSetting(cat)?.standardAmount > 0" class="text-caption text-primary">
                    (應收 {{ getCatSetting(cat).standardAmount.toLocaleString() }})
                  </span>
                </div>
              </th>
              <th class="text-right" style="min-width:100px;white-space:nowrap;border-left:1px solid #e2e8f0">年度總計</th>
              <th class="text-right text-success" style="min-width:100px;white-space:nowrap;border-left:1px solid #bbf7d0;background:#ecfdf5">溢收款餘額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="allUniqueMembers.length === 0">
              <td :colspan="duesCategories.length + 4" class="text-center text-medium-emphasis pa-12">
                尚未建立社友資料且無繳費紀錄
              </td>
            </tr>
            <tr v-for="member in allUniqueMembers" :key="member">
              <td class="sticky-col-0 text-caption text-primary font-weight-medium">{{ getMemberTitle(member) }}</td>
              <td class="sticky-col-1 font-weight-medium">{{ member }}</td>
              <td v-for="cat in duesCategories" :key="cat" class="text-center pa-2">
                <template v-if="getPayment(member, cat) > 0">
                  <div class="d-flex flex-column align-center" style="cursor:pointer" @click="onEditPayment(member, cat)">
                    <v-icon size="16" color="success">mdi-check-circle</v-icon>
                    <span class="text-caption text-success font-weight-bold">{{ getPayment(member, cat).toLocaleString() }}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="d-flex flex-column align-center" style="opacity:0.4">
                    <v-icon size="16" color="grey-lighten-1">mdi-close-circle</v-icon>
                    <span v-if="getCatSetting(cat)?.standardAmount > 0" class="text-caption text-medium-emphasis">
                      應收 {{ getCatSetting(cat).standardAmount.toLocaleString() }}
                    </span>
                  </div>
                </template>
              </td>
              <td class="text-right font-weight-bold text-primary" style="border-left:1px solid #e2e8f0;white-space:nowrap">
                NT$ {{ getMemberTotal(member).toLocaleString() }}
              </td>
              <td class="text-right font-weight-bold" :class="getOverpayment(member) > 0 ? 'text-success' : 'text-medium-emphasis'" style="border-left:1px solid #bbf7d0;background:#ecfdf5;white-space:nowrap">
                {{ getOverpayment(member) > 0 ? 'NT$ ' + Math.round(getOverpayment(member)).toLocaleString() : '—' }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- 功能說明 -->
      <v-card-text>
        <v-alert color="primary" variant="tonal" icon="mdi-information" density="compact" class="mt-4">
          <ul class="text-body-2 mb-0 pl-2">
            <li>點擊 <strong>[新增收費項目]</strong> 按鈕可擴充報表欄位。</li>
            <li>點擊 <strong>表頭項目名稱</strong>可設定統一應收金額。</li>
            <li>設定金額後，未繳費社友的格位會自動顯示 <strong>[應收 XXX]</strong> 提醒文字。</li>
          </ul>
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- 收費設定 Dialog -->
    <v-dialog v-model="isModalOpen" max-width="400">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingSetting ? '編輯收費設定' : '新增收費項目' }}</span>
          <v-btn icon variant="text" @click="isModalOpen = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleModalSubmit">
            <v-text-field v-model="modalData.category" label="項目名稱" placeholder="例如：114年春季旅遊" density="compact" variant="outlined" required class="mb-2" />
            <v-text-field v-model="modalData.dueDate" label="應收日期（可為空）" type="date" density="compact" variant="outlined" class="mb-2" />
            <v-text-field v-model="modalData.standardAmount" label="統一應收金額 (NT$)" type="number" placeholder="0" density="compact" variant="outlined" required class="mb-4" />
            <div class="d-flex ga-2">
              <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" class="flex-grow-1">儲存設定</v-btn>
              <v-btn v-if="editingSetting" color="error" icon variant="tonal" @click="handleDeleteSetting">
                <v-icon>mdi-delete</v-icon>
              </v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'

const records = inject('records')
const members = inject('members')
const duesSettings = inject('duesSettings')
const loading = inject('loading')
const handleEditClick = inject('handleEditClick')
const addDuesSetting = inject('addDuesSetting')
const updateDuesSetting = inject('updateDuesSetting')
const deleteDuesSetting = inject('deleteDuesSetting')

const selectedYear = ref(new Date().getFullYear().toString())
const isModalOpen = ref(false)
const editingSetting = ref(null)
const modalData = ref({ category: '', dueDate: '', standardAmount: '' })

const TITLE_ORDER = { '社長(P)': 1, '祕書(S)': 2, '社當(PE)': 3, '副社長(VP)': 4, '前社長(PP)': 5, '社友': 6, '': 7 }

function toMinguoYear(adYear) { return parseInt(adYear) - 1911 }

function getMemberTitle(memberName) {
  const m = (members.value || []).find(mem => mem.name === memberName)
  return m ? (m.jobTitle1 || '社友') : ''
}

function getTitlePriority(memberName) {
  const title = getMemberTitle(memberName)
  return TITLE_ORDER[title] || 99
}

const availableYears = computed(() => {
  const years = [...new Set((records.value || []).map(r => r.date.split('-')[0]))]
  if (!years.includes(selectedYear.value)) years.push(selectedYear.value)
  return years.sort((a, b) => b - a)
})

const duesCategories = computed(() => {
  const settingCats = (duesSettings.value || []).map(s => (s.category || '').trim()).filter(Boolean)
  const recordCats = (records.value || [])
    .filter(r => r.type === 'income' && r.member && r.item && r.date.startsWith(selectedYear.value))
    .map(r => r.item.trim())
  return [...new Set([...settingCats, ...recordCats])]
})

const memberPaymentData = computed(() => {
  const data = {}
  ;(records.value || [])
    .filter(r => r.type === 'income' && (r.member || '').trim() && r.item && r.date.startsWith(selectedYear.value))
    .forEach(r => {
      const name = r.member.trim()
      const cat = r.item.trim()
      if (!data[name]) data[name] = {}
      if (!data[name][cat]) data[name][cat] = { amount: 0, record: null }
      data[name][cat].amount += r.amount
      data[name][cat].record = r
    })
  return data
})

const memberOverpayment = computed(() => {
  const overpay = {}
  ;(records.value || [])
    .filter(r => r.type === 'income' && r.member && r.item === '溢收款')
    .forEach(r => {
      const name = r.member.trim()
      overpay[name] = (overpay[name] || 0) + r.amount
    })
  return overpay
})

const allUniqueMembers = computed(() => {
  const regMembers = (members.value || []).map(m => m.name)
  const legacyMembers = Object.keys(memberPaymentData.value).filter(n => !regMembers.includes(n))
  return [...regMembers, ...legacyMembers].sort((a, b) => {
    const pA = getTitlePriority(a), pB = getTitlePriority(b)
    if (pA !== pB) return pA - pB
    return a.localeCompare(b, 'zh-Hant')
  })
})

function getCatSetting(cat) {
  return (duesSettings.value || []).find(s => s.category === cat)
}

function getPayment(member, cat) {
  return memberPaymentData.value[member]?.[cat]?.amount || 0
}

function getMemberTotal(member) {
  const payments = memberPaymentData.value[member] || {}
  return Object.values(payments).reduce((s, v) => s + v.amount, 0)
}

function getOverpayment(member) {
  return memberOverpayment.value[member] || 0
}

function onEditPayment(member, cat) {
  const record = memberPaymentData.value[member]?.[cat]?.record
  if (record) handleEditClick(record)
}

function openAddModal() {
  editingSetting.value = null
  modalData.value = { category: '', dueDate: '', standardAmount: '' }
  isModalOpen.value = true
}

function openEditModal(cat) {
  const setting = (duesSettings.value || []).find(s => s.category.trim() === cat.trim())
  editingSetting.value = setting || null
  modalData.value = {
    category: setting ? setting.category : cat,
    dueDate: setting?.dueDate || '',
    standardAmount: setting ? setting.standardAmount.toString() : '0',
  }
  isModalOpen.value = true
}

async function handleModalSubmit() {
  const payload = {
    category: modalData.value.category,
    dueDate: modalData.value.dueDate,
    standardAmount: parseFloat(modalData.value.standardAmount) || 0,
  }
  if (editingSetting.value) {
    await updateDuesSetting(editingSetting.value.category, payload)
  } else {
    await addDuesSetting(payload)
  }
  isModalOpen.value = false
}

async function handleDeleteSetting() {
  const result = await Swal.fire({
    title: '確定要刪除此收費項目？',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await deleteDuesSetting(editingSetting.value.category)
  isModalOpen.value = false
}
</script>

<style scoped>
.sticky-col-0 {
  position: sticky;
  left: 0;
  background: white;
  z-index: 1;
  border-right: 1px solid #e2e8f0;
}
.sticky-col-1 {
  position: sticky;
  left: 80px;
  background: white;
  z-index: 1;
  border-right: 1px solid #e2e8f0;
}
</style>
