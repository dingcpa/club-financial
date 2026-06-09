<template>
  <v-card elevation="1">
    <!-- 標題列 -->
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-tag-multiple</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">帳款類別設定</span>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openAddModal">新增類別</v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <v-alert color="primary" variant="tonal" icon="mdi-information" density="compact" class="mb-3">
        <div class="text-caption">
          設定每一種帳款的<strong>對方收入科目</strong>與<strong>預設金額</strong>。批次產生帳款與沖帳時會引用此處設定
          （例：社費 → 社費收入、代收款 → 代收款）。
        </div>
      </v-alert>

      <div style="overflow-x:auto">
        <v-table density="compact" style="min-width:680px">
          <thead>
            <tr>
              <th style="min-width:140px">類別名稱</th>
              <th class="text-center" style="min-width:90px">類型</th>
              <th style="min-width:130px">對方收入科目</th>
              <th class="text-right" style="min-width:100px">預設金額</th>
              <th class="text-center" style="min-width:120px">應收日期</th>
              <th class="text-center" style="min-width:90px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="sortedSettings.length === 0">
              <td colspan="6" class="text-center text-medium-emphasis pa-8">尚無帳款類別，請點「新增類別」</td>
            </tr>
            <tr v-for="s in sortedSettings" :key="s.category">
              <td class="text-caption font-weight-medium">{{ s.category }}</td>
              <td class="text-center">
                <v-chip size="x-small" :color="kindColor(s.kind)" variant="tonal">{{ kindLabel(s.kind) }}</v-chip>
              </td>
              <td class="text-caption" :class="s.incomeAccount ? '' : 'text-error'">
                {{ s.incomeAccount || '未設定' }}
              </td>
              <td class="text-right text-caption">{{ (s.standardAmount || 0).toLocaleString() }}</td>
              <td class="text-center text-caption text-medium-emphasis">{{ s.dueDate || '—' }}</td>
              <td class="text-center">
                <v-btn size="x-small" variant="tonal" color="primary" class="mr-1" @click="openEditModal(s)">編輯</v-btn>
                <v-btn size="x-small" variant="tonal" color="error" @click="handleDelete(s)">刪除</v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>

    <!-- 新增 / 編輯 Dialog -->
    <v-dialog v-model="isModalOpen" :max-width="xs ? undefined : 440" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editing ? '編輯帳款類別' : '新增帳款類別' }}</span>
          <v-btn icon variant="text" @click="isModalOpen = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleSubmit">
            <v-text-field
              v-model="form.category"
              label="類別名稱"
              placeholder="例如：7-9月社費、代收款、春節紅箱"
              density="compact" variant="outlined" required class="mb-2"
            />
            <v-select
              v-model="form.kind"
              label="類型"
              :items="KIND_OPTIONS"
              item-title="title" item-value="value"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-combobox
              v-model="form.incomeAccount"
              label="對方收入科目"
              :items="ACCOUNT_PRESETS"
              placeholder="例如：社費收入"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-text-field
              v-model="form.standardAmount"
              label="預設金額 (NT$)"
              type="number" placeholder="0"
              density="compact" variant="outlined" class="mb-2"
            />
            <v-text-field
              v-model="form.dueDate"
              label="應收日期（可為空）"
              type="date"
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
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'

const { xs } = useDisplay()

const duesSettings = inject('duesSettings')
const addDuesSetting = inject('addDuesSetting')
const updateDuesSetting = inject('updateDuesSetting')
const deleteDuesSetting = inject('deleteDuesSetting')

const KIND_OPTIONS = [
  { value: 'dues', title: '社費' },
  { value: 'agency', title: '代收款' },
  { value: 'other', title: '其他' },
]
const ACCOUNT_PRESETS = ['社費收入', '代收款', '紅箱收入', '其他收入', '利息收入']

const isModalOpen = ref(false)
const editing = ref(null)
const form = ref(makeDefaultForm())

function makeDefaultForm() {
  return { category: '', kind: 'dues', incomeAccount: '社費收入', standardAmount: '', dueDate: '' }
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

function openAddModal() {
  editing.value = null
  form.value = makeDefaultForm()
  isModalOpen.value = true
}

function openEditModal(s) {
  editing.value = s
  form.value = {
    category: s.category,
    kind: s.kind || 'dues',
    incomeAccount: s.incomeAccount || '',
    standardAmount: (s.standardAmount ?? '').toString(),
    dueDate: s.dueDate || '',
  }
  isModalOpen.value = true
}

async function handleSubmit() {
  if (!form.value.category?.trim()) {
    Swal.fire({ icon: 'warning', title: '請輸入類別名稱', confirmButtonColor: '#4f46e5' })
    return
  }
  const payload = {
    category: form.value.category.trim(),
    kind: form.value.kind,
    incomeAccount: (form.value.incomeAccount || '').trim() || null,
    standardAmount: parseFloat(form.value.standardAmount) || 0,
    dueDate: form.value.dueDate || '',
  }
  try {
    if (editing.value) {
      await updateDuesSetting(editing.value.category, payload)
    } else {
      await addDuesSetting(payload)
    }
    isModalOpen.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message || '請稍後再試', confirmButtonColor: '#ef4444' })
  }
}

async function handleDelete(s) {
  const result = await Swal.fire({
    title: '確定要刪除此帳款類別？',
    html: `將刪除「<b>${s.category}</b>」，並一併移除此類別<b>尚未收款(pending)</b>的應收帳款。`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await deleteDuesSetting(s.category)
}
</script>
