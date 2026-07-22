<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <!-- 標題列 -->
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-account-group</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">{{ toMinguoYear(selectedYear) }}年度 社友繳費明細表</span>
        </div>
        <div class="d-flex flex-wrap ga-2">
          <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openAddModal">新增收費項目</v-btn>
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

      <!-- 繳費表格（橫向捲動，sticky 欄） -->
      <div style="overflow:auto; max-height:calc(100vh - 280px)">
        <v-table density="compact" style="min-width:480px">
          <thead>
            <tr>
              <th class="sticky-col-0" style="min-width:60px">職稱</th>
              <th class="sticky-col-1" style="min-width:80px">姓名</th>
              <th
                v-for="col in duesColumns"
                :key="col.label"
                class="text-center"
                style="min-width:110px;white-space:nowrap"
                :style="col.cats.length === 1 ? 'cursor:pointer' : ''"
                @click="col.cats.length === 1 && openEditModal(col.cats[0])"
                :title="col.cats.length === 1 ? '點擊編輯 ' + col.label + ' 的收費設定' : '合併欄：' + col.cats.join('＋')"
              >
                <div class="d-flex flex-column align-center ga-1">
                  <span class="text-caption">{{ col.label }}</span>
                  <span v-if="colStandard(col) > 0" class="text-caption text-primary">
                    (應收 {{ colStandard(col).toLocaleString() }})
                  </span>
                </div>
              </th>
              <th
                v-for="agency in agencyCategories"
                :key="'a-'+agency.id"
                class="text-center"
                style="min-width:110px;white-space:nowrap;background:#fffbeb;border-left:1px solid #fcd34d"
              >
                <div class="d-flex flex-column align-center ga-1">
                  <v-chip size="x-small" color="warning" variant="tonal">代收</v-chip>
                  <span class="text-caption">{{ agency.title }}</span>
                </div>
              </th>
              <th class="text-right" style="min-width:90px;white-space:nowrap;border-left:1px solid #e2e8f0">年度總計</th>
              <th class="text-right text-success" style="min-width:90px;white-space:nowrap;border-left:1px solid #bbf7d0;background:#ecfdf5">溢收款</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="allUniqueMembers.length === 0">
              <td :colspan="duesColumns.length + agencyCategories.length + 4" class="text-center text-medium-emphasis pa-12">
                尚未建立社友資料且無繳費紀錄
              </td>
            </tr>
            <tr v-for="member in allUniqueMembers" :key="member">
              <td class="sticky-col-0 text-caption text-primary font-weight-medium">{{ getMemberTitle(member) }}</td>
              <td class="sticky-col-1 text-caption font-weight-medium">{{ member }}</td>
              <td v-for="col in duesColumns" :key="col.label" class="text-center pa-2">
                <template v-if="colInfo(member, col).paid > 0">
                  <div class="d-flex flex-column align-center" style="cursor:pointer" @click="onCellClick(member, col)">
                    <v-icon v-if="colInfo(member, col).fullyPaid" size="14" color="success">mdi-check-circle</v-icon>
                    <v-icon v-else size="14" color="warning">mdi-circle-half-full</v-icon>
                    <span class="text-caption text-success font-weight-bold">{{ colInfo(member, col).paid.toLocaleString() }}</span>
                  </div>
                </template>
                <template v-else-if="colInfo(member, col).allWaived">
                  <div class="d-flex flex-column align-center" style="opacity:0.5">
                    <v-icon size="14" color="grey">mdi-cancel</v-icon>
                    <span class="text-caption text-grey text-decoration-line-through">免繳</span>
                  </div>
                </template>
                <template v-else>
                  <div
                    class="d-flex flex-column align-center" style="opacity:0.4"
                    :style="col.cats.length > 1 ? 'cursor:pointer' : ''"
                    @click="col.cats.length > 1 && openGroupDetail(member, col)"
                  >
                    <v-icon size="14" color="grey-lighten-1">mdi-close-circle</v-icon>
                    <span v-if="colInfo(member, col).due" class="text-caption text-medium-emphasis">
                      {{ colInfo(member, col).due.toLocaleString() }}
                    </span>
                  </div>
                </template>
              </td>
              <td
                v-for="agency in agencyCategories"
                :key="'a-'+agency.id"
                class="text-center pa-2"
                style="background:#fffbeb;border-left:1px solid #fcd34d"
              >
                <template v-if="getAgencyPayment(member, agency).inScope">
                  <template v-if="getAgencyPayment(member, agency).paid">
                    <div class="d-flex flex-column align-center">
                      <v-icon size="14" color="success">mdi-check-circle</v-icon>
                      <span class="text-caption text-success font-weight-bold">{{ getAgencyPayment(member, agency).paidAmount.toLocaleString() }}</span>
                    </div>
                  </template>
                  <template v-else-if="getAgencyReceivableStatus(member, agency.id) === 'waived'">
                    <div class="d-flex flex-column align-center" style="opacity:0.5">
                      <v-icon size="14" color="grey">mdi-cancel</v-icon>
                      <span class="text-caption text-grey text-decoration-line-through">免繳</span>
                    </div>
                  </template>
                  <template v-else>
                    <div class="d-flex flex-column align-center" style="opacity:0.4">
                      <v-icon size="14" color="grey-lighten-1">mdi-close-circle</v-icon>
                      <span class="text-caption text-medium-emphasis">{{ getAgencyPayment(member, agency).targetAmount.toLocaleString() }}</span>
                    </div>
                  </template>
                </template>
                <template v-else>
                  <span class="text-caption text-medium-emphasis" style="opacity:0.3">—</span>
                </template>
              </td>
              <td class="text-right text-caption font-weight-bold text-primary" style="border-left:1px solid #e2e8f0;white-space:nowrap">
                {{ (getMemberTotal(member) + getAgencyTotal(member)).toLocaleString() }}
              </td>
              <td class="text-right text-caption font-weight-bold" :class="getOverpayment(member) > 0 ? 'text-success' : 'text-medium-emphasis'" style="border-left:1px solid #bbf7d0;background:#ecfdf5;white-space:nowrap">
                {{ getOverpayment(member) > 0 ? Math.round(getOverpayment(member)).toLocaleString() : '—' }}
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>

      <!-- 功能說明 -->
      <v-card-text class="pa-2 pa-sm-4">
        <v-alert color="primary" variant="tonal" icon="mdi-information" density="compact" class="mt-2">
          <ul class="text-caption mb-0 pl-2">
            <li>點擊 <strong>[新增收費項目]</strong> 按鈕可擴充報表欄位。</li>
            <li>點擊 <strong>表頭項目名稱</strong>可設定統一應收金額。</li>
            <li>設定金額後，未繳費社友的格位會自動顯示 <strong>[應收 XXX]</strong> 提醒文字。</li>
          </ul>
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- 合併欄細項 Dialog（社費四項） -->
    <v-dialog v-model="groupDetail.open" :max-width="xs ? undefined : 420" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ groupDetail.member }}．{{ groupDetail.label }}</span>
          <v-btn icon variant="text" @click="groupDetail.open = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text class="pt-0">
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-caption">項目</th>
                <th class="text-caption text-right">應收</th>
                <th class="text-caption text-right">已收</th>
                <th class="text-caption text-center">狀態</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in groupDetail.rows" :key="r.cat"
                :style="r.hasRecord ? 'cursor:pointer' : ''"
                :title="r.hasRecord ? '點擊查看收款單' : ''"
                @click="r.hasRecord && onGroupRowClick(r)"
              >
                <td class="text-caption">{{ r.cat }}</td>
                <td class="text-right text-caption">{{ r.due ? r.due.toLocaleString() : '—' }}</td>
                <td class="text-right text-caption" :class="r.paid ? 'text-success font-weight-bold' : 'text-medium-emphasis'">
                  {{ r.paid ? r.paid.toLocaleString() : '—' }}
                </td>
                <td class="text-center">
                  <v-chip v-if="r.status === 'paid'" size="x-small" color="success" variant="tonal">已收</v-chip>
                  <v-chip v-else-if="r.status === 'partial'" size="x-small" color="warning" variant="tonal">部分</v-chip>
                  <v-chip v-else-if="r.status === 'waived'" size="x-small" color="grey" variant="tonal">免繳</v-chip>
                  <v-chip v-else-if="r.status" size="x-small" color="error" variant="tonal">未收</v-chip>
                  <span v-else class="text-caption text-medium-emphasis">未開單</span>
                </td>
              </tr>
              <tr style="background:#f8fafc">
                <td class="text-caption font-weight-bold">合計</td>
                <td class="text-right text-caption font-weight-bold">{{ groupDetail.rows.reduce((s, r) => s + (r.due || 0), 0).toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold text-success">{{ groupDetail.rows.reduce((s, r) => s + (r.paid || 0), 0).toLocaleString() }}</td>
                <td />
              </tr>
            </tbody>
          </v-table>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 收費設定 Dialog -->
    <v-dialog v-model="isModalOpen" :max-width="xs ? undefined : 400" :fullscreen="xs">
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
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { duesGroupLabel } from '../accounting/coa.js'

const { xs } = useDisplay()

const records = inject('records')
const members = inject('members')
const duesSettings = inject('duesSettings')
const loading = inject('loading')
const handleEditClick = inject('handleEditClick')
const addDuesSetting = inject('addDuesSetting')
const updateDuesSetting = inject('updateDuesSetting')
const deleteDuesSetting = inject('deleteDuesSetting')
const agencyCollections = inject('agencyCollections')
const receivables = inject('receivables')

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

// 欄位＝該年度已開帳款（receivables）的項目，依最早到期日排序；
// 不再聯集收入單摘要（項目過多）——未開單的雜項收入請至帳簿查詢
const duesCategories = computed(() => {
  const map = new Map() // category → 最早 dueDate
  for (const r of receivables.value || []) {
    if (r.sourceType !== 'dues' || String(r.dueYear) !== String(selectedYear.value)) continue
    const cat = (r.sourceRef || '').trim()
    if (!cat) continue
    const d = r.dueDate || '9999-12-31'
    if (!map.has(cat) || d < map.get(cat)) map.set(cat, d)
  }
  return [...map.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]) || a[0].localeCompare(b[0], 'zh-Hant'))
    .map(([cat]) => cat)
})

// 顯示欄位：社費四項（會費/服務基金/餐費/固定紅箱）合併為「X-X月社費」一欄，其餘各自成欄
const duesColumns = computed(() => {
  const cols = []
  const groupIdx = new Map()
  for (const cat of duesCategories.value) {
    const g = duesGroupLabel(cat)
    if (g) {
      if (!groupIdx.has(g)) {
        const col = { label: g, cats: [] }
        groupIdx.set(g, col)
        cols.push(col)
      }
      groupIdx.get(g).cats.push(cat)
    } else {
      cols.push({ label: cat, cats: [cat] })
    }
  }
  return cols
})

function colStandard(col) {
  return col.cats.reduce((s, c) => s + (getCatSetting(c)?.standardAmount || 0), 0)
}

// 合併欄格位彙總：已收/應收（免繳項不計應收）
function colInfo(member, col) {
  let paid = 0, due = 0, recCount = 0, waivedCount = 0
  for (const cat of col.cats) {
    paid += getPayment(member, cat)
    const rec = getReceivable(member, cat)
    if (rec) {
      recCount++
      if (rec.status === 'waived') waivedCount++
      else due += rec.amount
    }
  }
  if (!recCount && !due) due = colStandard(col)
  return {
    paid,
    due,
    fullyPaid: due > 0 && paid >= due,
    allWaived: recCount > 0 && waivedCount === recCount,
  }
}

// 合併欄細項 Dialog
const groupDetail = ref({ open: false, member: '', label: '', rows: [] })

function openGroupDetail(member, col) {
  groupDetail.value = {
    open: true,
    member,
    label: col.label,
    rows: col.cats.map(cat => {
      const rec = getReceivable(member, cat)
      return {
        cat,
        due: rec ? (rec.status === 'waived' ? 0 : rec.amount) : (getCatSetting(cat)?.standardAmount || 0),
        paid: getPayment(member, cat),
        status: rec ? rec.status : null,
        hasRecord: !!memberPaymentData.value[member]?.[cat]?.record,
        member,
      }
    }),
  }
}

function onCellClick(member, col) {
  if (col.cats.length === 1) onEditPayment(member, col.cats[0])
  else openGroupDetail(member, col)
}

function onGroupRowClick(r) {
  groupDetail.value.open = false
  onEditPayment(r.member, r.cat)
}

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

const agencyCategories = computed(() => {
  return (agencyCollections.value || [])
    .filter(col => col.createdDate?.startsWith(selectedYear.value))
    .map(col => ({
      id: col.id, title: col.title, status: col.status,
      targetMembers: col.targetMembers, paidMembers: col.paidMembers,
      createdDate: col.createdDate,
    }))
})

function getAgencyPayment(memberName, agency) {
  const target = agency.targetMembers.find(m => m.name === memberName)
  if (!target) return { inScope: false }
  const paid = agency.paidMembers.find(p => p.memberName === memberName)
  return {
    inScope: true,
    targetAmount: target.amount,
    paid: !!paid,
    paidAmount: paid?.amount || 0,
  }
}

function getAgencyTotal(memberName) {
  return agencyCategories.value.reduce((sum, agency) => {
    const info = getAgencyPayment(memberName, agency)
    return sum + (info.inScope && info.paid ? info.paidAmount : 0)
  }, 0)
}

function getCatSetting(cat) {
  return (duesSettings.value || []).find(s => s.category === cat)
}

function getPayment(member, cat) {
  return memberPaymentData.value[member]?.[cat]?.amount || 0
}

// 從 receivables 取得特定社費項目的狀態
function getReceivable(member, cat) {
  return (receivables.value || []).find(r =>
    r.sourceType === 'dues' && r.sourceRef === cat && r.memberName === member && String(r.dueYear) === String(selectedYear.value)
  ) || null
}
function getReceivableStatus(member, cat) {
  const rec = getReceivable(member, cat)
  return rec ? rec.status : null  // 'pending' | 'partial' | 'paid' | 'waived' | null
}

// 從 receivables 取得代收項目的狀態
function getAgencyReceivableStatus(member, agencyId) {
  const rec = (receivables.value || []).find(r =>
    r.sourceType === 'agency' && r.sourceRef === String(agencyId) && r.memberName === member
  )
  return rec ? rec.status : null
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
  left: 60px;
  background: white;
  z-index: 1;
  border-right: 1px solid #e2e8f0;
}
</style>
