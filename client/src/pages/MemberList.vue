<template>
  <div>
    <div v-if="memLoading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <v-card v-else elevation="1">
      <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-account-multiple</v-icon>
          <span class="text-body-1 text-sm-h6 font-weight-bold">社友名冊管理</span>
        </div>
        <div class="d-flex flex-wrap ga-2 align-center">
          <v-text-field
            v-model="searchTerm"
            placeholder="搜尋姓名、手機..."
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:160px;max-width:220px"
          />
          <v-btn variant="tonal" size="small" prepend-icon="mdi-file-download-outline" @click="downloadTemplate">空白範本</v-btn>
          <v-btn variant="tonal" size="small" prepend-icon="mdi-file-upload-outline" @click="fileInput?.click()">Excel 匯入</v-btn>
          <input ref="fileInput" type="file" accept=".xlsx,.xls" style="display:none" @change="handleImportFile" />
          <v-btn :color="showForm ? 'grey' : 'primary'" :prepend-icon="showForm ? 'mdi-close' : 'mdi-plus'" size="small" @click="toggleForm">
            {{ showForm ? '取消' : '新增' }}
          </v-btn>
        </div>
      </v-card-title>

      <!-- 新增/編輯表單 -->
      <v-card-text v-if="showForm" class="pa-2 pa-sm-4">
        <v-card variant="outlined" color="primary" class="pa-3 mb-3" rounded="lg">
          <div class="text-subtitle-2 font-weight-bold mb-3">{{ editingId ? '編輯社員：' + formData.name : '新增社友' }}</div>
          <v-row dense>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="formData.name" label="姓名 *" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="formData.nickname" label="社名" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select v-model="formData.jobTitle1" label="職稱 1" :items="JOB_TITLES_1" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-row no-gutters>
                <v-col>
                  <v-select v-model="formData.jobTitle2" label="職稱 2" :items="JOB_TITLES_2" :item-title="i => i === 'CUSTOM' ? '+ 新增其他...' : (i || '(無)')" density="compact" variant="outlined" />
                </v-col>
                <v-col v-if="formData.jobTitle2 === 'CUSTOM'" cols="auto" class="pl-1">
                  <v-text-field v-model="formData.customJobTitle2" label="自訂" density="compact" variant="outlined" style="min-width:80px" />
                </v-col>
              </v-row>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="formData.birthday" label="生日" type="date" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="formData.phone" label="市話" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="formData.mobile" label="手機" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field v-model="formData.email" label="Email" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-text-field
                v-model="formData.bankAccountLast5" label="銀行帳號末五碼"
                density="compact" variant="outlined" maxlength="10"
                hint="收款對帳用：比對匯款帳號末碼" persistent-hint
              />
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-select
                v-model="formData.status" label="社籍"
                :items="[{ title: '現職', value: 'active' }, { title: '退社', value: 'left' }]"
                density="compact" variant="outlined"
              />
            </v-col>
            <v-col v-if="formData.status === 'left'" cols="12" sm="6" md="3">
              <v-text-field v-model="formData.leaveDate" label="退社日" type="date" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12">
              <v-text-field v-model="formData.address" label="地址" density="compact" variant="outlined" />
            </v-col>
          </v-row>
          <div class="d-flex justify-end ga-2 mt-2">
            <v-btn variant="tonal" size="small" @click="cancelForm">取消</v-btn>
            <v-btn color="success" variant="flat" prepend-icon="mdi-content-save" size="small" @click="handleSave">儲存變更</v-btn>
          </div>
        </v-card>
      </v-card-text>

      <div class="d-flex align-center px-3 px-sm-4">
        <v-checkbox v-model="showLeft" density="compact" hide-details :label="`顯示已退社（${leftCount}）`" />
      </div>

      <!-- 社友列表（橫向捲動） -->
      <div style="overflow-x:auto">
        <v-table density="compact" style="min-width:600px;font-size:0.8rem">
          <thead>
            <tr>
              <th style="min-width:80px" class="text-caption">姓名</th>
              <th style="width:80px" class="text-caption">職稱</th>
              <th style="width:60px" class="text-caption d-none d-sm-table-cell">社名</th>
              <th style="width:90px" class="text-caption d-none d-md-table-cell">生日</th>
              <th style="width:160px" class="text-caption">聯絡</th>
              <th style="width:80px" class="text-caption d-none d-sm-table-cell">帳號末碼</th>
              <th style="max-width:120px" class="text-caption d-none d-lg-table-cell">地址</th>
              <th class="text-center text-caption" style="width:80px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredMembers.length === 0">
              <td colspan="8" class="text-center text-medium-emphasis pa-8">尚未建立資料</td>
            </tr>
            <tr v-for="(member, i) in filteredMembers" :key="member.id" :class="[i % 2 === 0 ? 'bg-white' : 'bg-grey-lighten-5', member.status === 'left' ? 'text-medium-emphasis' : '']">
              <td class="text-caption font-weight-medium">
                {{ member.name }}
                <v-chip v-if="member.status === 'left'" size="x-small" color="error" variant="tonal" class="ml-1">退社</v-chip>
              </td>
              <td>
                <div class="d-flex flex-column">
                  <span class="text-caption text-primary font-weight-bold">{{ member.jobTitle1 || '社友' }}</span>
                  <span v-if="member.jobTitle2" class="text-caption text-medium-emphasis">{{ member.jobTitle2 }}</span>
                </div>
              </td>
              <td class="d-none d-sm-table-cell">
                <v-chip size="x-small" color="primary" variant="tonal">{{ member.nickname }}</v-chip>
              </td>
              <td class="text-caption text-medium-emphasis d-none d-md-table-cell">{{ member.birthday }}</td>
              <td>
                <div class="text-caption d-flex flex-column ga-1">
                  <div><v-icon size="10" color="primary">mdi-cellphone</v-icon> {{ member.mobile || '-' }}</div>
                  <div class="d-none d-sm-flex"><v-icon size="10" color="grey-lighten-1">mdi-email</v-icon> {{ member.email || '-' }}</div>
                </div>
              </td>
              <td class="text-caption d-none d-sm-table-cell">{{ member.bankAccountLast5 || '-' }}</td>
              <td class="text-caption text-medium-emphasis d-none d-lg-table-cell" style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="member.address">
                {{ member.address || '-' }}
              </td>
              <td>
                <div class="d-flex justify-center ga-1">
                  <v-btn icon size="x-small" variant="tonal" color="primary" @click="handleEdit(member)">
                    <v-icon size="14">mdi-pencil</v-icon>
                  </v-btn>
                  <v-btn icon size="x-small" variant="tonal" color="error" @click="handleDelete(member.id)">
                    <v-icon size="14">mdi-delete</v-icon>
                  </v-btn>
                </div>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import Swal from 'sweetalert2'
import * as XLSX from 'xlsx'

const members = inject('members')
const memLoading = inject('memLoading')
const addMember = inject('addMember')
const updateMember = inject('updateMember')
const deleteMember = inject('deleteMember')
const importMembers = inject('importMembers')

const searchTerm = ref('')
const showForm = ref(false)
const showLeft = ref(false)
const editingId = ref(null)
const fileInput = ref(null)

const JOB_TITLES_1 = ['社長(P)', '祕書(S)', '社當(PE)', '副社長(VP)', '前社長(PP)', '社友']
const JOB_TITLES_2 = ['', '理事', '監事', 'CUSTOM']
const TITLE_ORDER = { '社長(P)': 1, '祕書(S)': 2, '社當(PE)': 3, '副社長(VP)': 4, '前社長(PP)': 5, '社友': 6, '': 7 }

function makeDefaultForm() {
  return { name: '', nickname: '', birthday: '', phone: '', mobile: '', email: '', address: '', jobTitle1: '社友', jobTitle2: '', customJobTitle2: '', status: 'active', leaveDate: '', bankAccountLast5: '' }
}

const formData = ref(makeDefaultForm())

function toggleForm() {
  if (showForm.value) {
    cancelForm()
  } else {
    editingId.value = null
    formData.value = makeDefaultForm()
    showForm.value = true
  }
}

function cancelForm() {
  showForm.value = false
  editingId.value = null
  formData.value = makeDefaultForm()
}

function handleEdit(member) {
  editingId.value = member.id
  const isCustom2 = member.jobTitle2 !== '理事' && member.jobTitle2 !== '監事' && member.jobTitle2 !== '' && member.jobTitle2 != null
  formData.value = {
    ...makeDefaultForm(),
    ...member,
    jobTitle1: member.jobTitle1 || '社友',
    jobTitle2: isCustom2 ? 'CUSTOM' : (member.jobTitle2 || ''),
    customJobTitle2: isCustom2 ? member.jobTitle2 : '',
    status: member.status === 'left' ? 'left' : 'active',
    leaveDate: member.leaveDate || '',
    bankAccountLast5: member.bankAccountLast5 || '',
  }
  showForm.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function handleSave() {
  if (!formData.value.name) { alert('請輸入姓名'); return }
  const finalJobTitle2 = formData.value.jobTitle2 === 'CUSTOM' ? formData.value.customJobTitle2 : formData.value.jobTitle2
  const payload = { ...formData.value, jobTitle2: finalJobTitle2 }
  if (payload.status !== 'left') payload.leaveDate = null
  delete payload.customJobTitle2
  if (editingId.value) {
    await updateMember(editingId.value, payload)
  } else {
    await addMember(payload)
  }
  cancelForm()
}

async function handleDelete(id) {
  await deleteMember(id)
}

// ── Excel 匯入 / 範本 ────────────────────────────────────────
const IMPORT_COLUMNS = [
  ['姓名', 'name'], ['社名', 'nickname'], ['職稱1', 'jobTitle1'], ['職稱2', 'jobTitle2'],
  ['生日', 'birthday'], ['市話', 'phone'], ['手機', 'mobile'], ['Email', 'email'],
  ['地址', 'address'], ['銀行帳號末五碼', 'bankAccountLast5'], ['社籍(現職/退社)', 'status'], ['退社日', 'leaveDate'],
]

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([IMPORT_COLUMNS.map(([label]) => label)])
  ws['!cols'] = IMPORT_COLUMNS.map(() => ({ wch: 14 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '社友名冊')
  XLSX.writeFile(wb, '社友名冊範本.xlsx')
}

async function handleImportFile(ev) {
  const file = ev.target.files?.[0]
  ev.target.value = ''
  if (!file) return
  try {
    const wb = XLSX.read(await file.arrayBuffer())
    const sheet = wb.Sheets[wb.SheetNames[0]]
    const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    const labelMap = Object.fromEntries(IMPORT_COLUMNS.map(([label, key]) => [label, key]))
    const rows = raw.map(r => {
      const out = {}
      for (const [label, val] of Object.entries(r)) {
        const key = labelMap[String(label).trim()]
        if (key) out[key] = typeof val === 'string' ? val.trim() : String(val ?? '').trim()
      }
      return out
    }).filter(r => r.name)
    if (!rows.length) {
      Swal.fire({ icon: 'warning', title: '找不到可匯入的資料', text: '請確認第一列為欄位名稱（可先下載空白範本）', confirmButtonColor: '#4f46e5' })
      return
    }
    const confirm = await Swal.fire({
      title: `匯入 ${rows.length} 筆社友資料？`,
      text: '同名社友將更新資料（空欄不覆蓋），新名字將新增。',
      icon: 'question', showCancelButton: true,
      confirmButtonColor: '#4f46e5', cancelButtonColor: '#6b7280',
      confirmButtonText: '匯入', cancelButtonText: '取消',
    })
    if (!confirm.isConfirmed) return
    const result = await importMembers(rows)
    Swal.fire({ icon: 'success', title: '匯入完成', text: `新增 ${result.created} 筆、更新 ${result.updated} 筆、略過 ${result.skipped} 筆`, confirmButtonColor: '#4f46e5' })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '匯入失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

const leftCount = computed(() => (members.value || []).filter(m => m.status === 'left').length)

const filteredMembers = computed(() => {
  const term = searchTerm.value
  return (members.value || [])
    .filter(m => showLeft.value || m.status !== 'left')
    .filter(m =>
      m.name.includes(term) ||
      (m.nickname && m.nickname.toLowerCase().includes(term.toLowerCase())) ||
      (m.mobile && m.mobile.includes(term)) ||
      (m.jobTitle1 && m.jobTitle1.includes(term))
    )
    .sort((a, b) => {
      const pA = TITLE_ORDER[a.jobTitle1 || '社友'] || 99
      const pB = TITLE_ORDER[b.jobTitle1 || '社友'] || 99
      if (pA !== pB) return pA - pB
      return a.name.localeCompare(b.name, 'zh-Hant')
    })
})
</script>
