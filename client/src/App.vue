<template>
  <!-- 未登入：顯示登入頁 -->
  <LoginPage v-if="!isAuthenticated" />

  <!-- 已登入：主應用 -->
  <v-app v-else>
    <!-- 手機版 App Bar -->
    <v-app-bar v-if="mobile" color="primary" elevation="2">
      <v-app-bar-nav-icon @click="drawer = !drawer" />
      <v-app-bar-title>社團收支系統</v-app-bar-title>
      <v-btn icon="mdi-logout" @click="handleLogout" />
    </v-app-bar>

    <!-- 側邊導覽欄 -->
    <v-navigation-drawer
      v-model="drawer"
      :rail="!mobile && rail"
      :temporary="mobile"
      color="white"
      elevation="2"
    >
      <!-- Logo 區（桌面版顯示） -->
      <v-list-item
        v-if="!mobile"
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

      <!-- 使用者資訊（手機版） -->
      <v-list-item
        v-if="mobile"
        :title="user?.displayName || user?.username"
        subtitle="已登入"
        prepend-icon="mdi-account-circle"
        class="py-3"
      />

      <v-divider />

      <v-list density="compact" nav>
        <v-list-group v-for="group in visibleMenuGroups" :key="group.value" :value="group.value">
          <template #activator="{ props }">
            <v-list-item v-bind="props" :prepend-icon="group.icon" :title="group.title" />
          </template>
          <v-list-item
            v-for="item in group.items"
            :key="item.tab"
            :prepend-icon="item.icon"
            :title="item.title"
            :active="activeTab === item.tab"
            active-color="primary"
            @click="navigate(item.tab)"
          />
        </v-list-group>
      </v-list>

      <!-- 桌面版底部：使用者資訊 + 登出 -->
      <template v-if="!mobile" #append>
        <v-divider />
        <v-list density="compact" nav>
          <v-list-item
            :prepend-icon="rail ? 'mdi-account-circle' : 'mdi-account-circle'"
            :title="rail ? '' : (user?.displayName || user?.username)"
            :subtitle="rail ? '' : '已登入'"
          />
          <v-list-item
            prepend-icon="mdi-logout"
            :title="rail ? '' : '登出'"
            @click="handleLogout"
          />
        </v-list>
      </template>
    </v-navigation-drawer>

    <!-- 主內容 -->
    <v-main>
      <v-container fluid class="pa-3 pa-sm-4">
        <component :is="currentPage" />
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, provide, watch } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'

import { useAuth } from './composables/useAuth.js'
import { useFinance } from './composables/useFinance.js'
import { useMembers } from './composables/useMembers.js'
import { useDues } from './composables/useDues.js'
import { useAgencyCollections } from './composables/useAgencyCollections.js'
import { useReceivables } from './composables/useReceivables.js'
import { useAccounts } from './composables/useAccounts.js'
import { useProjects } from './composables/useProjects.js'
import { useAppSettings } from './composables/useAppSettings.js'
import { useManualJournals } from './composables/useManualJournals.js'
import { useOpeningBalances } from './composables/useOpeningBalances.js'
import { useBankReconciliations } from './composables/useBankReconciliations.js'
import { useBudgets } from './composables/useBudgets.js'
import { useAttachments } from './composables/useAttachments.js'

import LoginPage from './pages/LoginPage.vue'
import Summary from './pages/Summary.vue'
import IncomeForm from './pages/IncomeForm.vue'
import ExpenseForm from './pages/ExpenseForm.vue'
import TransferForm from './pages/TransferForm.vue'
import MemberDues from './pages/MemberDues.vue'
import MemberList from './pages/MemberList.vue'
import BalanceSheet from './pages/BalanceSheet.vue'
import CashFlow from './pages/CashFlow.vue'
import AgencyCollection from './pages/AgencyCollection.vue'
import RecordListPanel from './pages/RecordListPanel.vue'
import UserManagement from './pages/UserManagement.vue'
import ReceivablesSummary from './pages/ReceivablesSummary.vue'
import CategorySettings from './pages/CategorySettings.vue'
import LedgerBrowser from './pages/LedgerBrowser.vue'
import ManualJournal from './pages/ManualJournal.vue'
import OpeningBalance from './pages/OpeningBalance.vue'
import BudgetReport from './pages/BudgetReport.vue'
import PrepaidDetail from './pages/PrepaidDetail.vue'
import RedboxStats from './pages/RedboxStats.vue'
import LineBilling from './pages/LineBilling.vue'
import ReceiptIssue from './pages/ReceiptIssue.vue'
import ActivityManagement from './pages/ActivityManagement.vue'
import ClosingWizard from './pages/ClosingWizard.vue'
import { useAccounting } from './composables/useAccounting.js'

// ----- Auth -----
const { isAuthenticated, isAdmin, isViewer, user, logout } = useAuth()
const { smAndDown } = useDisplay()
const mobile = smAndDown

// ----- 狀態 -----
const drawer = ref(true)
const rail = ref(false)
const activeTab = ref('summary')
const editingRecord = ref(null)

const { records, loading, fetchRecords, addRecord: apiAddRecord, addRecordsBatch: apiAddBatch, updateRecord: apiUpdateRecord, deleteRecord: apiDeleteRecord } = useFinance()
const { members, memLoading, fetchMembers, addMember: apiAddMember, updateMember: apiUpdateMember, deleteMember: apiDeleteMember, importMembers } = useMembers()
const { duesSettings, fetchDuesSettings, addDuesSetting, updateDuesSetting, deleteDuesSetting } = useDues()
const { agencyCollections, agencyLoading, fetchAgencyCollections, createCollection, recordPayment, removePayment, closeCollection, deleteCollection } = useAgencyCollections()
const { receivables, recLoading, fetchReceivables, fetchOutstanding, settleBatch, waiveReceivable, reopenReceivable, batchGenerate, createReceivable, updateReceivable, deleteReceivable, collectReceivable } = useReceivables()
const { accounts, fetchAccounts, addAccount, updateAccount, deleteAccount } = useAccounts()
const { projects, fetchProjects, addProject, updateProject, deleteProject } = useProjects()
const { appSettings, fetchAppSettings, saveAppSettings } = useAppSettings()
const { manualJournals, fetchManualJournals, addManualJournal, updateManualJournal, deleteManualJournal } = useManualJournals()
const { openingBalances, fetchOpeningBalances, saveOpeningBalances } = useOpeningBalances()
const { bankReconciliations, fetchBankReconciliations, addBankReconciliation, deleteBankReconciliation } = useBankReconciliations()
const { budgets, fetchBudgets, saveBudgets } = useBudgets()
const { attachmentsMeta, fetchAttachmentsMeta, getAttachmentData, deleteAttachment } = useAttachments()

// 分錄推導引擎：所有帳簿與報表的資料源
const accounting = useAccounting({ records, receivables, agencyCollections, manualJournals, openingBalances, accounts, appSettings })
const drillContext = ref(null)

// ----- 導覽選單定義（七組） -----
const docItems = [
  { tab: 'income', icon: 'mdi-plus-circle', title: '新增收款單' },
  { tab: 'expense', icon: 'mdi-minus-circle', title: '新增付款單' },
  { tab: 'transfer', icon: 'mdi-swap-horizontal', title: '新增調撥單' },
  { tab: 'journal-entry', icon: 'mdi-file-sign', title: '手工傳票' },
]
const reportItems = [
  { tab: 'summary', icon: 'mdi-chart-bar', title: '收支月報表' },
  { tab: 'balance-sheet', icon: 'mdi-scale-balance', title: '資產負債表' },
  { tab: 'cash-flow', icon: 'mdi-cash-fast', title: '現金流量表' },
  { tab: 'budget', icon: 'mdi-chart-donut', title: '預算執行表' },
]
const bookItems = [
  { tab: 'dues', icon: 'mdi-format-list-bulleted', title: '社友繳費總覽' },
  { tab: 'receivables', icon: 'mdi-file-document-check', title: '帳款明細表' },
  { tab: 'prepaid-detail', icon: 'mdi-clock-plus-outline', title: '預收明細表' },
  { tab: 'agency', icon: 'mdi-hand-coin', title: '代收付明細表' },
  { tab: 'ledger', icon: 'mdi-notebook-outline', title: '分類帳' },
  { tab: 'journal', icon: 'mdi-notebook-edit-outline', title: '日記帳' },
]
const mgmtItems = [
  { tab: 'redbox-stats', icon: 'mdi-gift-outline', title: '紅箱統計' },
  { tab: 'line-billing', icon: 'mdi-bell-ring-outline', title: 'Line請款' },
  { tab: 'receipt-issue', icon: 'mdi-receipt-text-outline', title: '開立收據' },
]
const activityItems = [
  { tab: 'activities', icon: 'mdi-calendar-star', title: '活動管理' },
]
const settingItems = [
  { tab: 'members', icon: 'mdi-account-multiple', title: '社友名冊' },
  { tab: 'categories', icon: 'mdi-tag-multiple', title: '科目與類別設定' },
  { tab: 'opening-balance', icon: 'mdi-scale-balance', title: '期初餘額設定', adminOnly: true },
  { tab: 'closing', icon: 'mdi-lock-check', title: '年度關帳', adminOnly: true },
]
const adminItems = [
  { tab: 'user-management', icon: 'mdi-account-key', title: '帳號管理' },
]
const visibleMenuGroups = computed(() => [
  { value: 'transactions', icon: 'mdi-file-document-outline', title: '收支單據', items: docItems, show: !isViewer.value },
  { value: 'reports', icon: 'mdi-chart-bar', title: '報表查詢', items: reportItems, show: true },
  { value: 'books', icon: 'mdi-notebook-multiple', title: '帳冊查詢', items: bookItems, show: !isViewer.value },
  { value: 'mgmt', icon: 'mdi-cash-register', title: '帳務管理', items: mgmtItems, show: !isViewer.value },
  { value: 'activities', icon: 'mdi-calendar-star', title: '活動管理', items: activityItems, show: !isViewer.value },
  { value: 'settings', icon: 'mdi-cog', title: '基本設定', items: settingItems.filter(i => !i.adminOnly || isAdmin.value), show: !isViewer.value },
  { value: 'admin', icon: 'mdi-shield-account', title: '系統管理', items: adminItems, show: isAdmin.value },
].filter(g => g.show && g.items.length > 0))

// ----- 頁面對應 -----
const pageMap = {
  'summary': Summary,
  'budget': BudgetReport,
  'balance-sheet': BalanceSheet,
  'cash-flow': CashFlow,
  'dues': MemberDues,
  'members': MemberList,
  'agency': AgencyCollection,
  'receivables': ReceivablesSummary,
  'prepaid-detail': PrepaidDetail,
  'redbox-stats': RedboxStats,
  'line-billing': LineBilling,
  'receipt-issue': ReceiptIssue,
  'activities': ActivityManagement,
  'categories': CategorySettings,
  'income': IncomeForm,
  'income-list': RecordListPanel,
  'expense': ExpenseForm,
  'expense-list': RecordListPanel,
  'transfer': TransferForm,
  'transfer-list': RecordListPanel,
  'ledger': LedgerBrowser,
  'journal': LedgerBrowser,
  'journal-entry': ManualJournal,
  'opening-balance': OpeningBalance,
  'closing': ClosingWizard,
  'user-management': UserManagement,
}
const currentPage = computed(() => pageMap[activeTab.value] || Summary)

// 需要管理員的頁面清單；唯讀分享僅可看報表
const ADMIN_TABS = ['user-management', 'opening-balance', 'closing']
const VIEWER_TABS = ['summary', 'budget', 'balance-sheet', 'cash-flow', 'ledger', 'journal']

// ----- 導覽 -----
function navigate(tab) {
  if (ADMIN_TABS.includes(tab) && !isAdmin.value) return
  if (isViewer.value && !VIEWER_TABS.includes(tab)) return
  activeTab.value = tab
  editingRecord.value = null
  if (mobile.value) drawer.value = false
}

function setActiveTab(tab) {
  if (ADMIN_TABS.includes(tab) && !isAdmin.value) return
  if (isViewer.value && !VIEWER_TABS.includes(tab)) return
  activeTab.value = tab
}

async function handleLogout() {
  const result = await Swal.fire({
    title: '確定要登出？',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#4f46e5',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '登出',
    cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  logout()
}

// ----- 業務 handlers -----
async function addRecord(newRecord) {
  await apiAddRecord(newRecord)
  if (newRecord.attachments?.length) fetchAttachmentsMeta()
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
  if (updatedRecord.attachments?.length) fetchAttachmentsMeta()
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
provide('importMembers', importMembers)
provide('addDuesSetting', addDuesSetting)
provide('updateDuesSetting', updateDuesSetting)
provide('deleteDuesSetting', deleteDuesSetting)
provide('handleEditClick', handleEditClick)
provide('handleCancelEdit', handleCancelEdit)
provide('currentUserId', computed(() => user.value?.id))
provide('agencyCollections', agencyCollections)
provide('fetchAgencyCollections', fetchAgencyCollections)
provide('createCollection', createCollection)
provide('recordPayment', recordPayment)
provide('removePayment', removePayment)
provide('closeCollection', closeCollection)
provide('deleteCollection', deleteCollection)
provide('fetchRecords', fetchRecords)
provide('receivables', receivables)
provide('recLoading', recLoading)
provide('fetchReceivables', fetchReceivables)
provide('fetchOutstanding', fetchOutstanding)
provide('settleBatch', settleBatch)
provide('waiveReceivable', waiveReceivable)
provide('reopenReceivable', reopenReceivable)
provide('batchGenerate', batchGenerate)
provide('createReceivable', createReceivable)
provide('updateReceivable', updateReceivable)
provide('deleteReceivable', deleteReceivable)
provide('collectReceivable', collectReceivable)
provide('accounts', accounts)
provide('fetchAccounts', fetchAccounts)
provide('addAccount', addAccount)
provide('updateAccount', updateAccount)
provide('deleteAccount', deleteAccount)
provide('projects', projects)
provide('fetchProjects', fetchProjects)
provide('addProject', addProject)
provide('updateProject', updateProject)
provide('deleteProject', deleteProject)
provide('appSettings', appSettings)
provide('fetchAppSettings', fetchAppSettings)
provide('saveAppSettings', saveAppSettings)
provide('manualJournals', manualJournals)
provide('fetchManualJournals', fetchManualJournals)
provide('addManualJournal', addManualJournal)
provide('updateManualJournal', updateManualJournal)
provide('deleteManualJournal', deleteManualJournal)
provide('attachmentsMeta', attachmentsMeta)
provide('fetchAttachmentsMeta', fetchAttachmentsMeta)
provide('getAttachmentData', getAttachmentData)
provide('deleteAttachment', deleteAttachment)
provide('budgets', budgets)
provide('saveBudgets', saveBudgets)
provide('bankReconciliations', bankReconciliations)
provide('fetchBankReconciliations', fetchBankReconciliations)
provide('addBankReconciliation', addBankReconciliation)
provide('deleteBankReconciliation', deleteBankReconciliation)
provide('openingBalances', openingBalances)
provide('fetchOpeningBalances', fetchOpeningBalances)
provide('saveOpeningBalances', saveOpeningBalances)
provide('accounting', accounting)
provide('drillContext', drillContext)
provide('isViewer', isViewer)
// 各報表點金額 → 設定篩選脈絡並切到帳簿查詢分類帳
provide('drillDown', (ctx) => {
  drillContext.value = ctx
  navigate('ledger')
})

// ----- 初始化 -----
watch(isAuthenticated, (val) => {
  if (val) {
    // 分錄推導引擎需要全量 receivables（不限年度）
    Promise.all([
      fetchRecords(), fetchMembers(), fetchDuesSettings(), fetchAgencyCollections(), fetchReceivables(),
      fetchAccounts(), fetchProjects(), fetchAppSettings(), fetchManualJournals(), fetchOpeningBalances(),
      fetchBankReconciliations(), fetchBudgets(), fetchAttachmentsMeta(),
    ])
  }
}, { immediate: true })
</script>
