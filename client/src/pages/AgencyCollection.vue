<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else>
      <!-- Header -->
      <v-card elevation="1" class="mb-4 pa-3 pa-sm-4">
        <div class="d-flex flex-wrap justify-space-between align-center ga-2">
          <div class="d-flex align-center ga-2">
            <v-icon color="primary" size="24">mdi-hand-coin</v-icon>
            <div>
              <div class="text-body-1 font-weight-bold">代收付明細表</div>
              <div class="text-caption text-medium-emphasis">代收款（2111）收付進度與各案餘額，與資產負債表代收款科目勾稽</div>
            </div>
          </div>
          <div class="d-flex flex-wrap ga-2">
            <v-btn color="primary" variant="tonal" size="small" prepend-icon="mdi-printer" @click="printReport">產生附表</v-btn>
            <v-btn :color="showForm ? 'grey' : 'primary'" size="small" @click="showForm = !showForm" prepend-icon="mdi-plus">
              {{ showForm ? '取消' : '新增代收項目' }}
            </v-btn>
          </div>
        </div>
      </v-card>

      <!-- Create Form -->
      <v-card v-if="showForm" elevation="1" border="primary sm" class="mb-4 pa-3 pa-sm-4">
        <div class="d-flex align-center ga-2 mb-3">
          <v-icon color="primary">mdi-plus</v-icon>
          <span class="font-weight-bold text-body-2">建立新的代收項目</span>
        </div>

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-text-field
              v-model="formData.title"
              label="項目名稱"
              placeholder="例如：XXX當選理事長賀禮"
              variant="outlined"
              density="compact"
              required
            />
          </v-col>
          <v-col cols="12" sm="6">
            <div class="d-flex ga-2">
              <v-text-field
                v-model="formData.defaultAmount"
                label="預設金額 (NT$)"
                placeholder="例如：500"
                type="number"
                variant="outlined"
                density="compact"
                min="0"
              />
              <v-btn
                v-if="formData.targetMembers.length > 0 && formData.defaultAmount"
                variant="tonal"
                color="grey"
                size="small"
                class="mt-1"
                @click="applyDefaultToAll"
              >
                套用全部
              </v-btn>
            </div>
          </v-col>
        </v-row>

        <v-text-field
          v-model="formData.remark"
          label="備註"
          placeholder="其他說明..."
          variant="outlined"
          density="compact"
          class="mb-2"
        />

        <div class="mb-3">
          <div class="d-flex justify-space-between align-center mb-2">
            <span class="text-caption font-weight-medium">選擇應收社友 <span class="text-error">*</span></span>
            <div class="d-flex ga-1">
              <v-btn size="x-small" variant="tonal" color="grey" @click="selectAllMembers">全選</v-btn>
              <v-btn size="x-small" variant="tonal" color="grey" @click="clearAllMembers">清除</v-btn>
            </div>
          </div>

          <div style="max-height:260px;overflow-y:auto;border:1px solid rgba(0,0,0,0.12);border-radius:8px;padding:8px;background:#f8fafc">
            <div
              v-for="m in members"
              :key="m.id"
              class="d-flex align-center ga-2 pa-1 mb-1 rounded"
              :style="isMemberSelected(m.name)
                ? 'border:1px solid #4f46e5;background:white'
                : 'border:1px solid transparent'"
            >
              <v-checkbox
                :model-value="isMemberSelected(m.name)"
                @update:model-value="toggleMember(m.name)"
                hide-details
                density="compact"
                color="primary"
                style="flex:0"
              />
              <span class="flex-grow-1 text-caption" :class="isMemberSelected(m.name) ? 'text-primary font-weight-bold' : ''">
                {{ m.name }}
                <span v-if="m.nickname" class="text-caption text-medium-emphasis ml-1">({{ m.nickname }})</span>
              </span>
              <div v-if="isMemberSelected(m.name)" class="d-flex align-center ga-1" @click.stop>
                <span class="text-caption text-medium-emphasis">NT$</span>
                <v-text-field
                  :model-value="getMemberAmount(m.name)"
                  @update:model-value="updateMemberAmount(m.name, $event)"
                  type="number"
                  density="compact"
                  variant="outlined"
                  hide-details
                  min="0"
                  style="width:80px"
                />
              </div>
            </div>
          </div>

          <div class="d-flex justify-space-between mt-1 text-caption text-medium-emphasis">
            <span>已選擇 {{ formData.targetMembers.length }} 位社友</span>
            <span class="text-primary font-weight-bold">預計收款 NT$ {{ totalSelectedAmount.toLocaleString() }}</span>
          </div>
        </div>

        <v-btn color="primary" block size="small" @click="handleCreate">建立代收項目</v-btn>
      </v-card>

      <!-- Open Collections -->
      <v-card v-if="openCollections.length > 0" elevation="1" class="mb-4 pa-3 pa-sm-4">
        <div class="d-flex align-center ga-2 mb-3">
          <v-icon color="warning">mdi-clock-outline</v-icon>
          <span class="font-weight-bold text-body-2">進行中 ({{ openCollections.length }})</span>
        </div>

        <div class="d-flex flex-column ga-3">
          <div
            v-for="col in openCollections"
            :key="col.id"
            style="border:1px solid #fcd34d;border-radius:12px;overflow:hidden;background:#fffbeb"
          >
            <!-- Card Header -->
            <div
              class="pa-3 d-flex justify-space-between align-center"
              style="cursor:pointer"
              @click="toggleExpand(col.id)"
            >
              <div class="flex-grow-1 mr-2">
                <div class="font-weight-bold text-body-2 mb-1">{{ col.title }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ col.createdDate }}{{ col.remark ? ` · ${col.remark}` : '' }}
                </div>
              </div>
              <div class="d-flex align-center ga-2">
                <div class="text-right">
                  <div class="text-caption font-weight-bold text-primary">{{ col.paidMembers.length }} / {{ getTargetMemberNames(col).length }} 人</div>
                  <div class="text-caption text-medium-emphasis">
                    NT$ {{ col.paidMembers.reduce((s, p) => s + p.amount, 0).toLocaleString() }}
                  </div>
                </div>
                <v-icon size="20">{{ expandedId === col.id ? 'mdi-chevron-up' : 'mdi-chevron-down' }}</v-icon>
              </div>
            </div>

            <!-- Progress Bar -->
            <div class="px-3" :class="expandedId === col.id ? '' : 'pb-3'">
              <v-progress-linear
                :model-value="getProgress(col)"
                :color="getProgress(col) === 100 ? 'success' : 'primary'"
                bg-color="#fde68a"
                rounded
                height="6"
              />
            </div>

            <!-- Expanded Content -->
            <div v-if="expandedId === col.id" class="pa-3" style="border-top:1px solid #fcd34d">
              <!-- Unpaid -->
              <div v-if="getUnpaidMembers(col).length > 0" class="mb-3">
                <div class="d-flex align-center ga-1 mb-2 text-warning font-weight-bold text-caption">
                  <v-icon color="warning" size="14">mdi-alert-circle</v-icon>
                  未收款 ({{ getUnpaidMembers(col).length }})
                </div>
                <div class="d-flex flex-column ga-2">
                  <div
                    v-for="name in getUnpaidMembers(col)"
                    :key="name"
                    class="d-flex justify-space-between align-center pa-2 rounded"
                    style="border:1px solid #e2e8f0;background:white"
                  >
                    <span class="text-caption font-weight-medium">{{ name }}</span>
                    <div class="d-flex align-center ga-2">
                      <span class="text-caption text-medium-emphasis">NT$ {{ getTargetMemberInfo(col, name)?.amount?.toLocaleString() ?? 0 }}</span>
                      <v-btn size="x-small" color="success" @click="handlePayment(col.id, name, getTargetMemberInfo(col, name)?.amount || 0)" prepend-icon="mdi-check">已收</v-btn>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Paid -->
              <div v-if="col.paidMembers.length > 0" class="mb-3">
                <div class="d-flex align-center ga-1 mb-2 text-success font-weight-bold text-caption">
                  <v-icon color="success" size="14">mdi-check-circle</v-icon>
                  已收款 ({{ col.paidMembers.length }})
                </div>
                <div class="d-flex flex-column ga-2">
                  <div
                    v-for="p in col.paidMembers"
                    :key="p.memberName"
                    class="d-flex justify-space-between align-center pa-2 rounded"
                    style="background:#dcfce7"
                  >
                    <div class="d-flex align-center ga-1">
                      <v-icon color="success" size="14">mdi-check-circle</v-icon>
                      <span class="text-caption font-weight-medium">{{ p.memberName }}</span>
                      <span class="text-caption text-medium-emphasis">{{ p.date }}</span>
                    </div>
                    <div class="d-flex align-center ga-2">
                      <span class="text-caption font-weight-bold text-success">NT$ {{ p.amount.toLocaleString() }}</span>
                      <v-btn icon size="x-small" variant="tonal" color="grey" @click="confirmRemovePayment(col.id, p.memberName)">
                        <v-icon size="12">mdi-close</v-icon>
                      </v-btn>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 2111 勾稽 -->
              <div v-if="ledgerOf(col.title)" class="d-flex flex-wrap align-center ga-2 pa-2 mb-1 rounded text-caption" style="background:#eef2ff">
                <v-icon size="14" color="primary">mdi-scale-balance</v-icon>
                <span>帳上代收款（2111）：</span>
                <span>開單/收現（貸）<b>{{ ledgerOf(col.title).credit.toLocaleString() }}</b></span>
                <span>付出（借）<b>{{ ledgerOf(col.title).debit.toLocaleString() }}</b></span>
                <span class="text-primary font-weight-bold" style="cursor:pointer" @click="drillDown({ accountCode: AGENCY_CODE, person: col.title })">
                  餘額 NT$ {{ ledgerOf(col.title).balance.toLocaleString() }}
                </span>
              </div>

              <!-- Actions -->
              <div class="d-flex flex-wrap ga-2 pt-3" style="border-top:1px dashed #fcd34d">
                <v-btn
                  v-if="col.paidMembers.length === getTargetMemberNames(col).length && getTargetMemberNames(col).length > 0"
                  color="success"
                  size="small"
                  prepend-icon="mdi-check-circle"
                  @click="openCloseDialog(col)"
                >
                  結案
                </v-btn>
                <v-btn color="error" size="small" prepend-icon="mdi-trash-can" @click="handleDelete(col.id)">刪除</v-btn>
              </div>
            </div>
          </div>
        </div>
      </v-card>

      <!-- Closed Collections -->
      <v-card v-if="closedCollections.length > 0" elevation="1" class="pa-3 pa-sm-4">
        <div class="d-flex align-center ga-2 mb-3">
          <v-icon color="success">mdi-check-circle</v-icon>
          <span class="font-weight-bold text-body-2">已結案 ({{ closedCollections.length }})</span>
        </div>
        <div class="d-flex flex-column ga-3">
          <div
            v-for="col in closedCollections"
            :key="col.id"
            class="d-flex justify-space-between align-center pa-2 rounded"
            style="border:1px solid #bbf7d0;background:#f0fdf4"
          >
            <div class="flex-grow-1 mr-2">
              <div class="text-caption font-weight-bold mb-1">{{ col.title }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ col.closedDate }} · {{ col.paidMembers.length }} 人{{ col.closedRemark ? ` · ${col.closedRemark}` : '' }}
              </div>
            </div>
            <div class="d-flex align-center ga-2">
              <span class="text-caption font-weight-bold text-success">NT$ {{ (col.closedAmount || 0).toLocaleString() }}</span>
              <v-btn icon size="x-small" variant="tonal" color="grey" @click="handleDelete(col.id)">
                <v-icon size="14">mdi-trash-can</v-icon>
              </v-btn>
            </div>
          </div>
        </div>
      </v-card>

      <!-- 代收款總勾稽（各對象 2111 餘額 ＝ 資產負債表代收款） -->
      <v-card v-if="agencyLedger.length" elevation="1" class="mt-4">
        <v-card-title class="d-flex align-center py-2 px-3 px-sm-4" style="border-bottom:2px solid #4f46e5">
          <v-icon color="primary" size="20" class="mr-1">mdi-scale-balance</v-icon>
          <span class="text-body-2 font-weight-bold">代收款（2111）總勾稽</span>
          <v-spacer />
          <span class="text-body-2 font-weight-bold" style="color:#4f46e5">帳上餘額 NT$ {{ agencyLedgerTotal.toLocaleString() }}</span>
        </v-card-title>
        <div style="overflow-x:auto">
          <v-table density="compact" style="min-width:560px">
            <thead>
              <tr>
                <th class="text-caption">案名 / 對象</th>
                <th class="text-caption text-right" style="width:130px">開單/收現（貸）</th>
                <th class="text-caption text-right" style="width:130px">付出（借）</th>
                <th class="text-caption text-right" style="width:130px">餘額</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="g in agencyLedger" :key="g.person" style="cursor:pointer" @click="drillDown({ accountCode: AGENCY_CODE, person: g.person })">
                <td class="text-caption">{{ g.person }}</td>
                <td class="text-right text-caption">{{ g.credit.toLocaleString() }}</td>
                <td class="text-right text-caption">{{ g.debit.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold" :style="g.balance ? 'color:#4f46e5' : ''">{{ g.balance.toLocaleString() }}</td>
              </tr>
              <tr style="background:#eef2ff">
                <td class="text-caption font-weight-bold">合計（＝資產負債表代收款餘額）</td>
                <td class="text-right text-caption font-weight-bold">{{ agencyLedgerCredit.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold">{{ agencyLedgerDebit.toLocaleString() }}</td>
                <td class="text-right text-caption font-weight-bold" style="color:#4f46e5">{{ agencyLedgerTotal.toLocaleString() }}</td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card>

      <!-- Empty State -->
      <v-card v-if="collections.length === 0 && !showForm" elevation="1" class="pa-8 text-center">
        <v-icon size="40" color="grey-lighten-2" class="mb-3">mdi-hand-coin</v-icon>
        <div class="text-medium-emphasis mb-3">尚無代收代付項目</div>
        <v-btn color="primary" prepend-icon="mdi-plus" @click="showForm = true">建立第一個代收項目</v-btn>
      </v-card>
    </div>

    <!-- 列印附表：代收款（2111）總勾稽 -->
    <PrintSheet>
      <div class="print-org">嘉義中區扶輪社 Rotary Club of Chiayi Central</div>
      <div class="print-title">代收付明細表</div>
      <div class="print-meta">製表日 {{ toMinguoDate(todayStr) }}　・　幣別：新臺幣 NT$　・　代收款（2111）按案名彙總</div>
      <table>
        <thead>
          <tr>
            <th>案名 / 對象</th>
            <th class="num" style="width:130px">開單/收現（貸）</th>
            <th class="num" style="width:130px">付出（借）</th>
            <th class="num" style="width:130px">餘額</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="g in agencyLedger" :key="g.person">
            <td>{{ g.person }}</td>
            <td class="num">{{ g.credit.toLocaleString() }}</td>
            <td class="num">{{ g.debit.toLocaleString() }}</td>
            <td class="num">{{ g.balance.toLocaleString() }}</td>
          </tr>
          <tr class="total">
            <td>合計（＝資產負債表代收款餘額）</td>
            <td class="num">{{ agencyLedgerCredit.toLocaleString() }}</td>
            <td class="num">{{ agencyLedgerDebit.toLocaleString() }}</td>
            <td class="num">{{ agencyLedgerTotal.toLocaleString() }}</td>
          </tr>
        </tbody>
      </table>
      <div class="print-footer">代收款屬負債科目，不計入收支餘絀；「開單/收現」含開立帳款與直接代收，「付出」為代收款轉繳/結案付出。</div>
      <div class="print-sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>
    </PrintSheet>

    <!-- Close Dialog -->
    <v-dialog v-model="closeDialog.show" :max-width="xs ? undefined : 400" :fullscreen="xs">
      <v-card class="pa-3 pa-sm-4">
        <div class="text-subtitle-2 font-weight-bold mb-3">結案（付出代收款）</div>
        <v-select
          v-model="closeDialog.payAccount"
          label="付款帳戶 / 經手人"
          :items="fundOptions"
          variant="outlined"
          density="compact"
          class="mb-2"
          hint="結案將產生一筆代收款付出的付款單"
          persistent-hint
        />
        <v-text-field
          v-model="closeDialog.remark"
          label="結案備註（例如：已轉交給XXX）"
          variant="outlined"
          density="compact"
          autofocus
        />
        <div class="d-flex justify-end ga-2 mt-2">
          <v-btn variant="text" @click="closeDialog.show = false">取消</v-btn>
          <v-btn color="success" @click="handleClose">確認結案</v-btn>
        </div>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { buildFundAccountOptions, handlerFundValue, CODES } from '../accounting/coa.js'
import { toMinguoDate } from '../accounting/fiscal.js'
import PrintSheet from '../components/PrintSheet.vue'

const { xs } = useDisplay()

const AGENCY_CODE = CODES.AGENCY

const members = inject('members')
const accounts = inject('accounts')
const collections = inject('agencyCollections')
const loading = inject('loading')
const accounting = inject('accounting')
const drillDown = inject('drillDown')
const injCreateCollection = inject('createCollection')
const injRecordPayment = inject('recordPayment')
const injRemovePayment = inject('removePayment')
const injCloseCollection = inject('closeCollection')
const injDeleteCollection = inject('deleteCollection')
const fetchRecords = inject('fetchRecords')
const fetchReceivables = inject('fetchReceivables')

const fundOptions = computed(() => buildFundAccountOptions(members?.value, accounts?.value))

const showForm = ref(false)
const expandedId = ref(null)
const formData = ref({ title: '', defaultAmount: '', targetMembers: [], remark: '' })
const closeDialog = ref({ show: false, collectionId: null, remark: '', payAccount: null })

async function handleCreate() {
  if (!formData.value.title || formData.value.targetMembers.length === 0) {
    await Swal.fire({ title: '請填寫項目名稱並選擇至少一位社友', icon: 'warning', confirmButtonText: '確定' })
    return
  }
  const invalid = formData.value.targetMembers.filter(m => !m.amount || m.amount <= 0)
  if (invalid.length > 0) {
    await Swal.fire({ title: '請確認所有社友都有設定金額', icon: 'warning', confirmButtonText: '確定' })
    return
  }
  await injCreateCollection({ title: formData.value.title, targetMembers: formData.value.targetMembers, remark: formData.value.remark })
  formData.value = { title: '', defaultAmount: '', targetMembers: [], remark: '' }
  showForm.value = false
}

async function handlePayment(collectionId, memberName, amount) {
  // 選擇收款帳戶（現金流入帳：借資金/貸應收）
  const options = {}
  for (const o of fundOptions.value) options[o.value] = o.title
  const { value: account, isConfirmed } = await Swal.fire({
    title: `${memberName} 收款 NT$ ${amount.toLocaleString()}`,
    input: 'select',
    inputOptions: options,
    inputValue: handlerFundValue('陳淑華'),
    inputLabel: '收款帳戶 / 經手人',
    showCancelButton: true,
    confirmButtonText: '確認收款',
    cancelButtonText: '取消',
    confirmButtonColor: '#4f46e5',
  })
  if (!isConfirmed) return
  await injRecordPayment(collectionId, memberName, amount, null, account)
  await Promise.all([fetchRecords(), fetchReceivables()])
}

async function confirmRemovePayment(collectionId, memberName) {
  const result = await Swal.fire({
    title: `確定要取消 ${memberName} 的收款記錄嗎？`,
    text: '對應的收款單也會一併刪除。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '確定取消',
    cancelButtonText: '保留',
    confirmButtonColor: '#ef4444'
  })
  if (result.isConfirmed) {
    await injRemovePayment(collectionId, memberName)
    await Promise.all([fetchRecords(), fetchReceivables()])
  }
}

function openCloseDialog(collection) {
  closeDialog.value = { show: true, collectionId: collection.id, remark: '', payAccount: null }
}

async function handleClose() {
  const { collectionId, remark, payAccount } = closeDialog.value
  const collection = collections.value.find(c => c.id === collectionId)
  if (!collection) return
  const totalCollected = collection.paidMembers.reduce((sum, p) => sum + p.amount, 0)
  closeDialog.value.show = false
  await injCloseCollection(collectionId, totalCollected, remark, payAccount)
  await fetchRecords()
}

async function handleDelete(collectionId) {
  const result = await Swal.fire({
    title: '確定要刪除此代收項目嗎？',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消',
    confirmButtonColor: '#ef4444'
  })
  if (!result.isConfirmed) return
  await injDeleteCollection(collectionId)
}

function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id
}

function isMemberSelected(name) {
  return formData.value.targetMembers.some(m => m.name === name)
}

function getMemberAmount(name) {
  return formData.value.targetMembers.find(m => m.name === name)?.amount || ''
}

function toggleMember(name) {
  const defaultAmt = parseFloat(formData.value.defaultAmount) || 0
  const idx = formData.value.targetMembers.findIndex(m => m.name === name)
  if (idx >= 0) {
    formData.value.targetMembers.splice(idx, 1)
  } else {
    formData.value.targetMembers.push({ name, amount: defaultAmt })
  }
}

function updateMemberAmount(name, amount) {
  const m = formData.value.targetMembers.find(m => m.name === name)
  if (m) m.amount = parseFloat(amount) || 0
}

function selectAllMembers() {
  const defaultAmt = parseFloat(formData.value.defaultAmount) || 0
  formData.value.targetMembers = (members.value || []).filter(m => m.status !== 'left').map(m => ({ name: m.name, amount: defaultAmt }))
}

function clearAllMembers() {
  formData.value.targetMembers = []
}

function applyDefaultToAll() {
  const defaultAmt = parseFloat(formData.value.defaultAmount) || 0
  formData.value.targetMembers = formData.value.targetMembers.map(m => ({ ...m, amount: defaultAmt }))
}

function getTargetMemberInfo(col, name) {
  if (col.targetMembers.length > 0 && typeof col.targetMembers[0] === 'object') {
    return col.targetMembers.find(m => m.name === name)
  }
  return { name, amount: col.amountPerPerson || 0 }
}

function getTargetMemberNames(col) {
  if (col.targetMembers.length > 0 && typeof col.targetMembers[0] === 'object') {
    return col.targetMembers.map(m => m.name)
  }
  return col.targetMembers
}

function getTotalTargetAmount(col) {
  if (col.targetMembers.length > 0 && typeof col.targetMembers[0] === 'object') {
    return col.targetMembers.reduce((sum, m) => sum + (m.amount || 0), 0)
  }
  return col.targetMembers.length * (col.amountPerPerson || 0)
}

function getProgress(col) {
  const total = getTargetMemberNames(col).length
  return total > 0 ? (col.paidMembers.length / total) * 100 : 0
}

function getUnpaidMembers(col) {
  return getTargetMemberNames(col).filter(name => !col.paidMembers.some(p => p.memberName === name))
}

const totalSelectedAmount = computed(() =>
  formData.value.targetMembers.reduce((sum, m) => sum + (m.amount || 0), 0)
)

const openCollections = computed(() => collections.value.filter(c => c.status === 'open'))
const closedCollections = computed(() => collections.value.filter(c => c.status === 'closed'))

// ── 代收款（2111）勾稽：分錄按對象（案名）彙總，合計＝資產負債表代收款餘額 ──
const r2 = (n) => Math.round(n * 100) / 100
const agencyLedger = computed(() => {
  const map = new Map()
  for (const e of accounting.entries.value) {
    if (e.sourceType === 'closing') continue
    for (const l of e.lines) {
      if (l.accountCode !== AGENCY_CODE) continue
      const person = l.person || '未指定'
      if (!map.has(person)) map.set(person, { person, credit: 0, debit: 0 })
      const g = map.get(person)
      g.credit += l.credit || 0
      g.debit += l.debit || 0
    }
  }
  return [...map.values()]
    .map(g => ({ ...g, credit: r2(g.credit), debit: r2(g.debit), balance: r2(g.credit - g.debit) }))
    .sort((a, b) => (Math.abs(b.balance) - Math.abs(a.balance)) || a.person.localeCompare(b.person, 'zh-Hant'))
})
const agencyLedgerCredit = computed(() => r2(agencyLedger.value.reduce((s, g) => s + g.credit, 0)))
const agencyLedgerDebit = computed(() => r2(agencyLedger.value.reduce((s, g) => s + g.debit, 0)))
const agencyLedgerTotal = computed(() => r2(agencyLedger.value.reduce((s, g) => s + g.balance, 0)))
function ledgerOf(title) {
  return agencyLedger.value.find(g => g.person === title) || null
}

// 列印附表
const todayStr = new Date().toISOString().split('T')[0]
function printReport() { window.print() }
</script>
