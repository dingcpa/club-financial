<template>
  <v-card elevation="1">
    <v-card-title class="d-flex align-center ga-2 pa-3 pa-sm-4">
      <v-icon color="primary">mdi-cog-outline</v-icon>
      <span class="text-body-1 text-sm-h6 font-weight-bold">科目與類別設定</span>
    </v-card-title>

    <v-tabs v-model="tab" color="primary" density="compact">
      <v-tab value="accounts">會計科目</v-tab>
      <v-tab value="dues">帳款類別</v-tab>
      <v-tab value="params">系統參數</v-tab>
    </v-tabs>
    <v-divider />

    <v-window v-model="tab">
      <!-- ── 會計科目 ─────────────────────────────── -->
      <v-window-item value="accounts">
        <v-card-text class="pa-2 pa-sm-4">
          <div class="d-flex justify-space-between align-center mb-3">
            <div class="text-caption text-medium-emphasis">
              系統科目（<v-icon size="x-small">mdi-lock</v-icon>）為分錄推導引擎引用，僅可改名稱；單據只能選「細項」層級科目。
            </div>
            <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openAcctModal(null)">新增科目</v-btn>
          </div>

          <div v-for="group in acctGroups" :key="group.type" class="mb-4">
            <div class="text-subtitle-2 font-weight-bold mb-1">{{ group.label }}</div>
            <v-table density="compact">
              <thead>
                <tr>
                  <th style="width:90px">代碼</th>
                  <th>名稱</th>
                  <th style="width:160px">屬性</th>
                  <th class="text-center" style="width:110px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="a in group.rows" :key="a.code" :class="{ 'text-medium-emphasis': !a.active }">
                  <td class="text-caption">{{ a.code }}</td>
                  <td class="text-caption" :class="a.parentCode ? 'pl-8' : 'font-weight-medium'">
                    {{ a.name }}
                    <div v-if="a.description" class="text-caption text-medium-emphasis" style="font-size:11px">{{ a.description }}</div>
                  </td>
                  <td>
                    <v-chip v-if="a.isSystem" size="x-small" variant="tonal" color="grey" class="mr-1">
                      <v-icon size="x-small" start>mdi-lock</v-icon>系統
                    </v-chip>
                    <v-chip v-if="a.isCash" size="x-small" variant="tonal" color="success" class="mr-1">現金</v-chip>
                    <v-chip v-if="a.requiresPerson" size="x-small" variant="tonal" color="info" class="mr-1">人員明細</v-chip>
                    <v-chip v-if="!a.active" size="x-small" variant="tonal" color="error">停用</v-chip>
                  </td>
                  <td class="text-center">
                    <v-btn size="x-small" variant="tonal" color="primary" class="mr-1" @click="openAcctModal(a)">編輯</v-btn>
                    <v-btn v-if="!a.isSystem" size="x-small" variant="tonal" color="error" @click="handleDeleteAccount(a)">刪除</v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-window-item>

      <!-- ── 帳款類別 ─────────────────────────────── -->
      <v-window-item value="dues">
        <v-card-text class="pa-2 pa-sm-4">
          <v-alert color="primary" variant="tonal" icon="mdi-information" density="compact" class="mb-3">
            <div class="text-caption">
              帳款類別供「應收帳款」頁開單引用：類別 → 入帳科目 → 預設金額。設定<strong>攤提月數</strong>者（如季繳社費＝3），
              開單時未到期部分列預收、逐月轉列收入。
            </div>
          </v-alert>
          <div class="d-flex justify-end mb-2">
            <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openDuesModal(null)">新增類別</v-btn>
          </div>
          <div style="overflow-x:auto">
            <v-table density="compact" style="min-width:760px">
              <thead>
                <tr>
                  <th style="min-width:140px">類別名稱</th>
                  <th class="text-center" style="min-width:80px">類型</th>
                  <th style="min-width:140px">入帳科目</th>
                  <th class="text-right" style="min-width:100px">預設金額</th>
                  <th class="text-center" style="min-width:90px">攤提月數</th>
                  <th class="text-center" style="min-width:110px">應收日期</th>
                  <th class="text-center" style="min-width:110px">操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="sortedSettings.length === 0">
                  <td colspan="7" class="text-center text-medium-emphasis pa-8">尚無帳款類別，請點「新增類別」</td>
                </tr>
                <tr v-for="s in sortedSettings" :key="s.category">
                  <td class="text-caption font-weight-medium">{{ s.category }}</td>
                  <td class="text-center">
                    <v-chip size="x-small" :color="kindColor(s.kind)" variant="tonal">{{ kindLabel(s.kind) }}</v-chip>
                  </td>
                  <td class="text-caption" :class="acctLabelOf(s) ? '' : 'text-error'">
                    {{ acctLabelOf(s) || '未設定' }}
                  </td>
                  <td class="text-right text-caption">{{ (s.standardAmount || 0).toLocaleString() }}</td>
                  <td class="text-center text-caption">{{ s.periodMonths ? `${s.periodMonths} 個月` : '—' }}</td>
                  <td class="text-center text-caption text-medium-emphasis">{{ s.dueDate || '—' }}</td>
                  <td class="text-center">
                    <v-btn size="x-small" variant="tonal" color="primary" class="mr-1" @click="openDuesModal(s)">編輯</v-btn>
                    <v-btn size="x-small" variant="tonal" color="error" @click="handleDeleteDues(s)">刪除</v-btn>
                  </td>
                </tr>
              </tbody>
            </v-table>
          </div>
        </v-card-text>
      </v-window-item>

      <!-- ── 系統參數 ─────────────────────────────── -->
      <v-window-item value="params">
        <v-card-text class="pa-2 pa-sm-4" style="max-width:480px">
          <v-alert v-if="!isAdmin" color="warning" variant="tonal" density="compact" class="mb-3">
            <div class="text-caption">系統參數僅管理員可修改。</div>
          </v-alert>
          <v-text-field
            v-model="paramForm.baseDate"
            label="帳務基準日（此日以前的歷史以期初餘額表達）"
            type="date" density="compact" variant="outlined" class="mb-2" :readonly="!isAdmin"
          />
          <v-text-field
            v-model="paramForm.monthlyAmount"
            label="每月社費 (NT$)"
            type="number" density="compact" variant="outlined" class="mb-4" :readonly="!isAdmin"
          />
          <v-btn v-if="isAdmin" color="primary" prepend-icon="mdi-content-save" @click="saveParams">儲存參數</v-btn>
        </v-card-text>
      </v-window-item>
    </v-window>

    <!-- 科目 Dialog -->
    <v-dialog v-model="acctModal" :max-width="xs ? undefined : 440" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingAcct ? '編輯科目' : '新增科目' }}</span>
          <v-btn icon variant="text" @click="acctModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleSaveAccount">
            <v-text-field
              v-model="acctForm.code" label="科目代碼" placeholder="例如：5206"
              density="compact" variant="outlined" class="mb-2"
              :readonly="!!editingAcct" :hint="editingAcct ? '代碼不可修改' : ''"
            />
            <v-text-field
              v-model="acctForm.name" label="科目名稱"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-select
              v-model="acctForm.type" label="類型" :items="TYPE_OPTIONS"
              item-title="title" item-value="value"
              density="compact" variant="outlined" class="mb-2"
              :readonly="!!editingAcct"
            />
            <v-select
              v-model="acctForm.parentCode" label="上層科目（細項才需選）"
              :items="parentOptions" clearable
              density="compact" variant="outlined" class="mb-2"
              :readonly="!!editingAcct && !!editingAcct.isSystem"
            />
            <v-text-field
              v-model="acctForm.description" label="科目說明（表單下拉的副標，幫執秘判斷用途）"
              placeholder="例如：例會講師鐘點費、車馬費"
              density="compact" variant="outlined" class="mb-2"
            />
            <template v-if="!editingAcct || !editingAcct.isSystem">
              <v-checkbox v-model="acctForm.requiresPerson" label="分錄需指定對象（人員/案名明細）" density="compact" hide-details class="mb-1" />
              <v-checkbox v-if="editingAcct" v-model="acctForm.active" label="啟用" density="compact" hide-details class="mb-2" />
            </template>
            <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" block class="mt-2">儲存科目</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- 帳款類別 Dialog -->
    <v-dialog v-model="duesModal" :max-width="xs ? undefined : 440" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingDues ? '編輯帳款類別' : '新增帳款類別' }}</span>
          <v-btn icon variant="text" @click="duesModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleSaveDues">
            <v-text-field
              v-model="duesForm.category" label="類別名稱"
              placeholder="例如：115年7-9月社費、EREY費"
              density="compact" variant="outlined" required class="mb-2"
            />
            <v-select
              v-model="duesForm.kind" label="類型" :items="KIND_OPTIONS"
              item-title="title" item-value="value"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-select
              v-model="duesForm.accountCode" label="入帳科目"
              :items="receivableAccountOptions"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-text-field
              v-model="duesForm.standardAmount" label="預設金額 (NT$)" type="number" placeholder="0"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-select
              v-model="duesForm.periodMonths" label="攤提月數（權責分攤，季繳社費＝3）"
              :items="[{ title: '不攤提（即期認列）', value: null }, { title: '3 個月（季）', value: 3 }, { title: '6 個月（半年）', value: 6 }, { title: '12 個月（全年）', value: 12 }]"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-text-field
              v-model="duesForm.dueDate" label="應收日期（可為空）" type="date"
              density="compact" variant="outlined" class="mb-4"
            />
            <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" block>儲存設定</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { useAuth } from '../composables/useAuth.js'
import { LEGACY_INCOME_ACCOUNT_MAP } from '../accounting/coa.js'

const { xs } = useDisplay()
const { isAdmin } = useAuth()

const tab = ref('accounts')

const accounts = inject('accounts')
const addAccount = inject('addAccount')
const updateAccount = inject('updateAccount')
const deleteAccount = inject('deleteAccount')
const duesSettings = inject('duesSettings')
const addDuesSetting = inject('addDuesSetting')
const updateDuesSetting = inject('updateDuesSetting')
const deleteDuesSetting = inject('deleteDuesSetting')
const appSettings = inject('appSettings')
const saveAppSettings = inject('saveAppSettings')

// ── 會計科目 ──
const TYPE_OPTIONS = [
  { value: 'asset', title: '資產' },
  { value: 'liability', title: '負債' },
  { value: 'equity', title: '權益' },
  { value: 'income', title: '收入' },
  { value: 'expense', title: '費用' },
]
const TYPE_LABELS = Object.fromEntries(TYPE_OPTIONS.map(t => [t.value, t.title]))

// 依類型分組，細項排在其上層科目之後
const acctGroups = computed(() => {
  const list = accounts?.value || []
  return TYPE_OPTIONS.map(t => {
    const ofType = list.filter(a => a.type === t.value)
    const parents = ofType.filter(a => !a.parentCode)
    const rows = []
    for (const p of parents) {
      rows.push(p)
      rows.push(...ofType.filter(a => a.parentCode === p.code))
    }
    // 掛在不存在上層的細項也要列出
    rows.push(...ofType.filter(a => a.parentCode && !parents.some(p => p.code === a.parentCode)))
    return { type: t.value, label: t.title, rows }
  }).filter(g => g.rows.length)
})

const acctModal = ref(false)
const editingAcct = ref(null)
const acctForm = ref(makeAcctForm())

function makeAcctForm() {
  return { code: '', name: '', type: 'expense', parentCode: null, requiresPerson: false, active: true, description: '' }
}

const parentOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.type === acctForm.value.type && !a.parentCode)
  return list.map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})

function openAcctModal(a) {
  editingAcct.value = a
  acctForm.value = a
    ? { code: a.code, name: a.name, type: a.type, parentCode: a.parentCode, requiresPerson: !!a.requiresPerson, active: !!a.active, description: a.description || '' }
    : makeAcctForm()
  acctModal.value = true
}

async function handleSaveAccount() {
  if (!acctForm.value.name?.trim()) {
    Swal.fire({ icon: 'warning', title: '請輸入科目名稱', confirmButtonColor: '#4f46e5' })
    return
  }
  try {
    if (editingAcct.value) {
      await updateAccount(editingAcct.value.code, {
        name: acctForm.value.name.trim(),
        parentCode: acctForm.value.parentCode,
        requiresPerson: acctForm.value.requiresPerson,
        active: acctForm.value.active,
        description: acctForm.value.description?.trim() || '',
      })
    } else {
      if (!acctForm.value.code?.trim()) {
        Swal.fire({ icon: 'warning', title: '請輸入科目代碼', confirmButtonColor: '#4f46e5' })
        return
      }
      await addAccount({
        code: acctForm.value.code.trim(),
        name: acctForm.value.name.trim(),
        type: acctForm.value.type,
        parentCode: acctForm.value.parentCode,
        requiresPerson: acctForm.value.requiresPerson,
        description: acctForm.value.description?.trim() || '',
      })
    }
    acctModal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

async function handleDeleteAccount(a) {
  const result = await Swal.fire({
    title: '確定要刪除此科目？',
    html: `將刪除「<b>${a.code} ${a.name}</b>」。已有單據使用的科目無法刪除。`,
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  try {
    await deleteAccount(a.code)
  } catch (e) {
    Swal.fire({ icon: 'error', title: '刪除失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

// 專案（活動）管理已移至「活動管理」頁（ActivityManagement.vue）

// ── 帳款類別 ──
const KIND_OPTIONS = [
  { value: 'dues', title: '社費' },
  { value: 'agency', title: '代收款' },
  { value: 'other', title: '其他' },
]

// 開單入帳科目：收入類葉節點 + 代收/暫收等負債科目
const receivableAccountOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  const leaves = list.filter(a => !hasChildren.has(a.code))
  const income = leaves.filter(a => a.type === 'income')
  const liab = leaves.filter(a => a.type === 'liability' && ['2111', '2131'].includes(a.code))
  return [...income, ...liab].map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})

function acctLabelOf(s) {
  const code = s.accountCode || LEGACY_INCOME_ACCOUNT_MAP[s.incomeAccount] || null
  if (!code) return null
  const a = (accounts?.value || []).find(x => x.code === code)
  return a ? `${a.code} ${a.name}` : code
}

const duesModal = ref(false)
const editingDues = ref(null)
const duesForm = ref(makeDuesForm())

function makeDuesForm() {
  return { category: '', kind: 'dues', accountCode: '4101', standardAmount: '', periodMonths: null, dueDate: '' }
}

function kindLabel(kind) {
  return KIND_OPTIONS.find(k => k.value === kind)?.title || '社費'
}
function kindColor(kind) {
  return kind === 'agency' ? 'warning' : kind === 'other' ? 'grey' : 'primary'
}

const KIND_ORDER = { dues: 1, agency: 2, other: 3 }
const sortedSettings = computed(() =>
  [...(duesSettings.value || [])].sort((a, b) => {
    const ka = KIND_ORDER[a.kind] || 9, kb = KIND_ORDER[b.kind] || 9
    if (ka !== kb) return ka - kb
    return (a.category || '').localeCompare(b.category || '', 'zh-Hant')
  })
)

function openDuesModal(s) {
  editingDues.value = s
  duesForm.value = s
    ? {
        category: s.category,
        kind: s.kind || 'dues',
        accountCode: s.accountCode || LEGACY_INCOME_ACCOUNT_MAP[s.incomeAccount] || null,
        standardAmount: (s.standardAmount ?? '').toString(),
        periodMonths: s.periodMonths || null,
        dueDate: s.dueDate || '',
      }
    : makeDuesForm()
  duesModal.value = true
}

async function handleSaveDues() {
  if (!duesForm.value.category?.trim()) {
    Swal.fire({ icon: 'warning', title: '請輸入類別名稱', confirmButtonColor: '#4f46e5' })
    return
  }
  const acct = (accounts?.value || []).find(a => a.code === duesForm.value.accountCode)
  const payload = {
    category: duesForm.value.category.trim(),
    kind: duesForm.value.kind,
    accountCode: duesForm.value.accountCode || null,
    incomeAccount: acct ? acct.name : null, // 舊欄位同步維護，供未升級的畫面顯示
    standardAmount: parseFloat(duesForm.value.standardAmount) || 0,
    periodMonths: duesForm.value.periodMonths || null,
    dueDate: duesForm.value.dueDate || '',
  }
  try {
    if (editingDues.value) {
      await updateDuesSetting(editingDues.value.category, payload)
    } else {
      await addDuesSetting(payload)
    }
    duesModal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message || '請稍後再試', confirmButtonColor: '#ef4444' })
  }
}

async function handleDeleteDues(s) {
  const result = await Swal.fire({
    title: '確定要刪除此帳款類別？',
    html: `將刪除「<b>${s.category}</b>」，並一併移除此類別<b>尚未收款(pending)</b>的應收帳款。`,
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await deleteDuesSetting(s.category)
}

// ── 系統參數 ──
const paramForm = ref({ baseDate: '', monthlyAmount: '' })

watch(() => appSettings?.value, (val) => {
  if (!val) return
  paramForm.value = {
    baseDate: val['accounting.baseDate'] || '',
    monthlyAmount: val['dues.monthlyAmount'] || '',
  }
}, { immediate: true, deep: true })

async function saveParams() {
  try {
    await saveAppSettings({
      'accounting.baseDate': paramForm.value.baseDate,
      'dues.monthlyAmount': paramForm.value.monthlyAmount,
    })
    Swal.fire({ icon: 'success', title: '參數已儲存', timer: 1200, showConfirmButton: false })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}
</script>
