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
        <div class="d-flex flex-wrap ga-2">
          <v-text-field
            v-model="searchTerm"
            placeholder="搜尋姓名、手機..."
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:160px;max-width:220px"
          />
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
              <th style="max-width:120px" class="text-caption d-none d-lg-table-cell">地址</th>
              <th class="text-center" style="width:80px" class="text-caption">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="filteredMembers.length === 0">
              <td colspan="7" class="text-center text-medium-emphasis pa-8">尚未建立資料</td>
            </tr>
            <tr v-for="(member, i) in filteredMembers" :key="member.id" :class="i % 2 === 0 ? 'bg-white' : 'bg-grey-lighten-5'">
              <td class="text-caption font-weight-medium">{{ member.name }}</td>
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

const members = inject('members')
const memLoading = inject('memLoading')
const addMember = inject('addMember')
const updateMember = inject('updateMember')
const deleteMember = inject('deleteMember')

const searchTerm = ref('')
const showForm = ref(false)
const editingId = ref(null)

const JOB_TITLES_1 = ['社長(P)', '祕書(S)', '社當(PE)', '副社長(VP)', '前社長(PP)', '社友']
const JOB_TITLES_2 = ['', '理事', '監事', 'CUSTOM']
const TITLE_ORDER = { '社長(P)': 1, '祕書(S)': 2, '社當(PE)': 3, '副社長(VP)': 4, '前社長(PP)': 5, '社友': 6, '': 7 }

function makeDefaultForm() {
  return { name: '', nickname: '', birthday: '', phone: '', mobile: '', email: '', address: '', jobTitle1: '社友', jobTitle2: '', customJobTitle2: '' }
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
    ...member,
    jobTitle1: member.jobTitle1 || '社友',
    jobTitle2: isCustom2 ? 'CUSTOM' : (member.jobTitle2 || ''),
    customJobTitle2: isCustom2 ? member.jobTitle2 : '',
  }
  showForm.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function handleSave() {
  if (!formData.value.name) { alert('請輸入姓名'); return }
  const finalJobTitle2 = formData.value.jobTitle2 === 'CUSTOM' ? formData.value.customJobTitle2 : formData.value.jobTitle2
  const payload = { ...formData.value, jobTitle2: finalJobTitle2 }
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

const filteredMembers = computed(() => {
  const term = searchTerm.value
  return (members.value || [])
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
