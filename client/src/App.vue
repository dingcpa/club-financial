<template>
  <v-app>
    <!-- 側邊欄 -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="rail"
      permanent
      color="white"
      elevation="2"
    >
      <!-- Logo 區 -->
      <v-list-item
        prepend-icon="mdi-wallet"
        :title="rail ? '' : '社團收支系統'"
        nav
      >
        <template #append>
          <v-btn
            :icon="rail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
            variant="text"
            @click="rail = !rail"
          />
        </template>
      </v-list-item>

      <v-divider />

      <v-list density="compact" nav>
        <!-- 報表查詢 -->
        <v-list-group value="reports">
          <template #activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-chart-bar" title="報表查詢" />
          </template>
          <v-list-item
            v-for="item in reportItems"
            :key="item.tab"
            :prepend-icon="item.icon"
            :title="item.title"
            :active="activeTab === item.tab"
            active-color="primary"
            @click="navigate(item.tab)"
          />
        </v-list-group>

        <!-- 社友管理 -->
        <v-list-group value="members">
          <template #activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-account-group" title="社友管理" />
          </template>
          <v-list-item
            v-for="item in memberItems"
            :key="item.tab"
            :prepend-icon="item.icon"
            :title="item.title"
            :active="activeTab === item.tab"
            active-color="primary"
            @click="navigate(item.tab)"
          />
        </v-list-group>

        <!-- 收支單據 -->
        <v-list-group value="transactions">
          <template #activator="{ props }">
            <v-list-item v-bind="props" prepend-icon="mdi-file-document-outline" title="收支單據" />
          </template>
          <v-list-item
            v-for="item in transactionItems"
            :key="item.tab"
            :prepend-icon="item.icon"
            :title="item.title"
            :active="activeTab === item.tab"
            active-color="primary"
            @click="navigate(item.tab)"
          />
        </v-list-group>
      </v-list>
    </v-navigation-drawer>

    <!-- 主內容 -->
    <v-main>
      <v-container fluid class="pa-4">
        <component :is="currentPage" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, provide, onMounted } from 'vue'
import Swal from 'sweetalert2'

import { useFinance } from './composables/useFinance.js'
import { useMembers } from './composables/useMembers.js'
import { useDues } from './composables/useDues.js'

import Summary from './pages/Summary.vue'
import IncomeForm from './pages/IncomeForm.vue'
import ExpenseForm from './pages/ExpenseForm.vue'
import TransferForm from './pages/TransferForm.vue'
import MemberDues from './pages/MemberDues.vue'
import MemberList from './pages/MemberList.vue'
import PrepaidIncome from './pages/PrepaidIncome.vue'
import PrepaidExpense from './pages/PrepaidExpense.vue'
import AccountSummary from './pages/AccountSummary.vue'
import AgencyCollection from './pages/AgencyCollection.vue'
import RecordListPanel from './pages/RecordListPanel.vue'

// ----- 狀態 -----
const drawer = ref(true)
const rail = ref(false)
const activeTab = ref('summary')
const editingRecord = ref(null)

const { records, loading, fetchRecords, addRecord: apiAddRecord, addRecordsBatch: apiAddBatch, updateRecord: apiUpdateRecord, deleteRecord: apiDeleteRecord } = useFinance()
const { members, memLoading, fetchMembers, addMember: apiAddMember, updateMember: apiUpdateMember, deleteMember: apiDeleteMember } = useMembers()
const { duesSettings, fetchDuesSettings, addDuesSetting, updateDuesSetting, deleteDuesSetting } = useDues()

// ----- 導覽選單定義 -----
const reportItems = [
  { tab: 'summary', icon: 'mdi-chart-bar', title: '收支月報表' },
  { tab: 'prepaid-income', icon: 'mdi-piggy-bank', title: '預收收入明細' },
  { tab: 'prepaid-expense', icon: 'mdi-book-open-variant', title: '預付支出明細' },
  { tab: 'accounts', icon: 'mdi-bank', title: '資金帳戶明細' },
]
const memberItems = [
  { tab: 'dues', icon: 'mdi-format-list-bulleted', title: '社友繳費總覽' },
  { tab: 'members', icon: 'mdi-account-multiple', title: '社友名冊' },
  { tab: 'agency', icon: 'mdi-hand-coin', title: '代收代付' },
]
const transactionItems = [
  { tab: 'income', icon: 'mdi-plus-circle', title: '新增收入單' },
  { tab: 'income-list', icon: 'mdi-magnify', title: '查詢收入單' },
  { tab: 'expense', icon: 'mdi-minus-circle', title: '新增支出單' },
  { tab: 'expense-list', icon: 'mdi-magnify', title: '查詢支出單' },
  { tab: 'transfer', icon: 'mdi-swap-horizontal', title: '新增調撥單' },
  { tab: 'transfer-list', icon: 'mdi-magnify', title: '查詢調撥單' },
]

// ----- 頁面對應 -----
const pageMap = {
  'summary': Summary,
  'prepaid-income': PrepaidIncome,
  'prepaid-expense': PrepaidExpense,
  'accounts': AccountSummary,
  'dues': MemberDues,
  'members': MemberList,
  'agency': AgencyCollection,
  'income': IncomeForm,
  'income-list': RecordListPanel,
  'expense': ExpenseForm,
  'expense-list': RecordListPanel,
  'transfer': TransferForm,
  'transfer-list': RecordListPanel,
}
const currentPage = computed(() => pageMap[activeTab.value] || Summary)

// ----- 導覽 -----
function navigate(tab) {
  activeTab.value = tab
  editingRecord.value = null
}

function setActiveTab(tab) {
  activeTab.value = tab
}

// ----- 業務 handlers -----
async function addRecord(newRecord) {
  await apiAddRecord(newRecord)
  activeTab.value = 'summary'
}

async function addRecordsBatch(newRecords) {
  await apiAddBatch(newRecords)
  activeTab.value = 'summary'
}

async function addRecordsBatchAndGoToDues(newRecords) {
  await apiAddBatch(newRecords)
  activeTab.value = 'dues'
}

async function updateRecord(id, updatedRecord) {
  await apiUpdateRecord(id, updatedRecord)
  editingRecord.value = null
  activeTab.value = 'summary'
}

async function deleteRecord(id) {
  const result = await Swal.fire({
    title: '確定要刪除？',
    text: '此動作無法復原。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await apiDeleteRecord(id)
  editingRecord.value = null
  activeTab.value = 'summary'
}

async function addMember(newMember) {
  await apiAddMember(newMember)
}

async function updateMember(id, updatedMember) {
  await apiUpdateMember(id, updatedMember)
}

async function deleteMember(id) {
  const result = await Swal.fire({
    title: '確定要刪除此社友？',
    text: '相關繳費紀錄仍會保留姓名，但無法再從選單選取。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await apiDeleteMember(id)
}

function handleEditClick(record) {
  editingRecord.value = record
  activeTab.value = record.type
}

function handleCancelEdit() {
  editingRecord.value = null
}

// ----- Provide -----
provide('records', records)
provide('loading', loading)
provide('members', members)
provide('memLoading', memLoading)
provide('duesSettings', duesSettings)
provide('editingRecord', editingRecord)
provide('activeTab', activeTab)
provide('setActiveTab', setActiveTab)
provide('addRecord', addRecord)
provide('addRecordsBatch', addRecordsBatch)
provide('addRecordsBatchAndGoToDues', addRecordsBatchAndGoToDues)
provide('updateRecord', updateRecord)
provide('deleteRecord', deleteRecord)
provide('addMember', addMember)
provide('updateMember', updateMember)
provide('deleteMember', deleteMember)
provide('addDuesSetting', addDuesSetting)
provide('updateDuesSetting', updateDuesSetting)
provide('deleteDuesSetting', deleteDuesSetting)
provide('handleEditClick', handleEditClick)
provide('handleCancelEdit', handleCancelEdit)

// ----- 初始化 -----
onMounted(() => {
  Promise.all([fetchRecords(), fetchMembers(), fetchDuesSettings()])
})
</script>
