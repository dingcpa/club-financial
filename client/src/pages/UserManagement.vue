<template>
  <!-- 非管理員：拒絕存取 -->
  <v-container v-if="!isAdmin" class="text-center py-16">
    <v-icon size="64" color="error" class="mb-4">mdi-shield-off</v-icon>
    <div class="text-h6 mb-2">存取被拒</div>
    <div class="text-body-2 text-medium-emphasis">您沒有存取此頁面的權限</div>
  </v-container>

  <div v-else>
    <div class="d-flex align-center justify-space-between mb-4 flex-wrap gap-2">
      <h2 class="text-h6 font-weight-bold">帳號管理</h2>
      <v-btn color="primary" prepend-icon="mdi-account-plus" @click="openCreate">
        新增使用者
      </v-btn>
    </div>

    <v-card rounded="lg" elevation="1">
      <v-data-table
        :headers="headers"
        :items="users"
        :loading="loading"
        item-value="id"
        no-data-text="尚無使用者"
      >
        <template #item.display_name="{ item }">
          {{ item.display_name || item.username }}
        </template>
        <template #item.role="{ item }">
          <v-chip
            :color="item.role === 'admin' ? 'primary' : 'default'"
            size="small"
            label
          >
            {{ item.role === 'admin' ? '管理員' : '使用者' }}
          </v-chip>
        </template>
        <template #item.created_at="{ item }">
          {{ item.created_at ? item.created_at.slice(0, 10) : '' }}
        </template>
        <template #item.actions="{ item }">
          <v-btn icon="mdi-pencil" size="small" variant="text" color="primary" @click="openEdit(item)" />
          <v-btn
            icon="mdi-delete"
            size="small"
            variant="text"
            color="error"
            :disabled="item.id === currentUserId"
            @click="confirmDelete(item)"
          />
        </template>
      </v-data-table>
    </v-card>

    <!-- 唯讀分享連結 -->
    <v-card rounded="lg" elevation="1" class="mt-6">
      <v-card-title class="d-flex justify-space-between align-center pa-4">
        <div class="d-flex align-center ga-2">
          <v-icon color="primary">mdi-link-variant</v-icon>
          <span class="text-body-1 font-weight-bold">唯讀分享連結</span>
        </div>
        <v-btn size="small" color="primary" prepend-icon="mdi-plus" @click="handleCreateLink">建立連結</v-btn>
      </v-card-title>
      <v-card-text class="pt-0">
        <div class="text-caption text-medium-emphasis mb-2">
          提供監事、查帳人免帳號檢視報表（收支月報、預算、資產負債表、現金流量、帳簿查詢）；僅可讀取，無法異動資料。
        </div>
        <v-table density="compact">
          <thead>
            <tr>
              <th class="text-caption">名稱</th>
              <th class="text-caption">連結</th>
              <th class="text-caption text-center">到期日</th>
              <th class="text-caption text-center">狀態</th>
              <th class="text-caption text-center" style="width:120px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!shareLinks.length">
              <td colspan="5" class="text-center text-medium-emphasis pa-4">尚無分享連結</td>
            </tr>
            <tr v-for="l in shareLinks" :key="l.id">
              <td class="text-caption">{{ l.label }}</td>
              <td class="text-caption" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                {{ shareUrl(l) }}
              </td>
              <td class="text-center text-caption">{{ l.expiresAt || '不限' }}</td>
              <td class="text-center">
                <v-chip size="x-small" :color="l.active ? 'success' : 'grey'" variant="tonal">{{ l.active ? '有效' : '已停用' }}</v-chip>
              </td>
              <td class="text-center">
                <v-btn icon size="x-small" variant="text" color="primary" title="複製連結" @click="copyLink(l)"><v-icon size="14">mdi-content-copy</v-icon></v-btn>
                <v-btn icon size="x-small" variant="text" :color="l.active ? 'warning' : 'success'" :title="l.active ? '停用' : '啟用'" @click="toggleLink(l)">
                  <v-icon size="14">{{ l.active ? 'mdi-pause' : 'mdi-play' }}</v-icon>
                </v-btn>
                <v-btn icon size="x-small" variant="text" color="error" title="刪除" @click="deleteLink(l)"><v-icon size="14">mdi-delete</v-icon></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </v-card-text>
    </v-card>

    <!-- 新增/編輯 Dialog -->
    <v-dialog v-model="dialog" max-width="480" :fullscreen="xs">
      <v-card :title="editingUser ? '編輯使用者' : '新增使用者'" rounded="lg">
        <v-card-text class="pt-4">
          <v-text-field
            v-if="!editingUser"
            v-model="form.username"
            label="帳號"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            prepend-inner-icon="mdi-account"
          />
          <v-text-field
            v-model="form.displayName"
            label="顯示名稱"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            prepend-inner-icon="mdi-badge-account"
          />
          <v-select
            v-model="form.role"
            :items="roleOptions"
            label="角色"
            variant="outlined"
            density="comfortable"
            class="mb-3"
            prepend-inner-icon="mdi-shield-account"
            :disabled="editingUser && editingUser.id === currentUserId"
            :hint="editingUser && editingUser.id === currentUserId ? '不可修改自己的角色' : ''"
            persistent-hint
          />
          <v-text-field
            v-model="form.password"
            :label="editingUser ? '新密碼（留空不更改）' : '密碼'"
            variant="outlined"
            density="comfortable"
            :type="showPwd ? 'text' : 'password'"
            :append-inner-icon="showPwd ? 'mdi-eye-off' : 'mdi-eye'"
            prepend-inner-icon="mdi-lock"
            @click:append-inner="showPwd = !showPwd"
          />
          <v-alert v-if="formError" type="error" variant="tonal" density="compact" class="mt-2" :text="formError" />
        </v-card-text>
        <v-card-actions class="px-4 pb-4">
          <v-spacer />
          <v-btn variant="text" @click="dialog = false">取消</v-btn>
          <v-btn color="primary" variant="flat" :loading="saving" @click="save">
            {{ editingUser ? '儲存' : '建立' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>


<script setup>
import { ref, onMounted, inject } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { apiFetch } from '../composables/apiFetch.js'
import { useAuth } from '../composables/useAuth.js'

const { xs } = useDisplay()
const { user, isAdmin } = useAuth()
const currentUserId = inject('currentUserId', null)

const users = ref([])
const loading = ref(false)
const dialog = ref(false)
const saving = ref(false)
const showPwd = ref(false)
const editingUser = ref(null)
const formError = ref('')

const form = ref({ username: '', displayName: '', password: '', role: 'user' })

const roleOptions = [
  { title: '管理員', value: 'admin' },
  { title: '使用者', value: 'user' },
]

const headers = [
  { title: '帳號', key: 'username', sortable: false },
  { title: '顯示名稱', key: 'display_name', sortable: false },
  { title: '角色', key: 'role', sortable: false },
  { title: '建立日期', key: 'created_at', sortable: false },
  { title: '操作', key: 'actions', sortable: false, align: 'end' },
]

async function fetchUsers() {
  loading.value = true
  try {
    const res = await apiFetch('/api/users')
    users.value = await res.json()
  } finally {
    loading.value = false
  }
}

// ── 唯讀分享連結 ──
const shareLinks = ref([])

function shareUrl(l) {
  return `${location.origin}/?share=${l.token}`
}

async function fetchShareLinks() {
  try {
    const res = await apiFetch('/api/share-links')
    shareLinks.value = await res.json()
  } catch { shareLinks.value = [] }
}

async function handleCreateLink() {
  const { value: formValues } = await Swal.fire({
    title: '建立唯讀分享連結',
    html:
      '<input id="sl-label" class="swal2-input" placeholder="名稱（例：33屆監事查帳）">' +
      '<input id="sl-expires" type="date" class="swal2-input" title="到期日（留空＝不限）">',
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonColor: '#4f46e5', cancelButtonColor: '#6b7280',
    confirmButtonText: '建立', cancelButtonText: '取消',
    preConfirm: () => ({
      label: document.getElementById('sl-label').value,
      expiresAt: document.getElementById('sl-expires').value,
    }),
  })
  if (!formValues) return
  const res = await apiFetch('/api/share-links', { method: 'POST', body: JSON.stringify(formValues) })
  if (res.ok) {
    const link = await res.json()
    await fetchShareLinks()
    await navigator.clipboard.writeText(shareUrl(link)).catch(() => {})
    Swal.fire({ icon: 'success', title: '連結已建立並複製', text: shareUrl(link), confirmButtonColor: '#4f46e5' })
  }
}

async function copyLink(l) {
  await navigator.clipboard.writeText(shareUrl(l))
  Swal.fire({ icon: 'success', title: '已複製連結', timer: 1200, showConfirmButton: false })
}

async function toggleLink(l) {
  const res = await apiFetch(`/api/share-links/${l.id}`, { method: 'PUT', body: JSON.stringify({ active: !l.active }) })
  if (res.ok) await fetchShareLinks()
}

async function deleteLink(l) {
  const result = await Swal.fire({
    title: '刪除分享連結？', text: `「${l.label}」將立即失效。`, icon: 'warning',
    showCancelButton: true, confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '刪除', cancelButtonText: '取消',
  })
  if (result.isConfirmed) {
    await apiFetch(`/api/share-links/${l.id}`, { method: 'DELETE' })
    await fetchShareLinks()
  }
}

function openCreate() {
  editingUser.value = null
  form.value = { username: '', displayName: '', password: '', role: 'user' }
  formError.value = ''
  showPwd.value = false
  dialog.value = true
}

function openEdit(u) {
  editingUser.value = u
  form.value = { username: u.username, displayName: u.display_name || '', password: '', role: u.role || 'user' }
  formError.value = ''
  showPwd.value = false
  dialog.value = true
}

async function save() {
  formError.value = ''
  if (!editingUser.value && (!form.value.username || !form.value.password)) {
    formError.value = '帳號與密碼為必填'
    return
  }
  saving.value = true
  try {
    if (editingUser.value) {
      const body = { displayName: form.value.displayName }
      if (form.value.password) body.password = form.value.password
      // 只有非自己才能修改角色
      if (editingUser.value.id !== currentUserId?.value) body.role = form.value.role
      const res = await apiFetch(`/api/users/${editingUser.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        formError.value = err.error || '更新失敗'
        return
      }
    } else {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          username: form.value.username,
          password: form.value.password,
          displayName: form.value.displayName,
          role: form.value.role,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        formError.value = err.error || '建立失敗'
        return
      }
    }
    dialog.value = false
    await fetchUsers()
  } catch (e) {
    formError.value = e.message || '操作失敗'
  } finally {
    saving.value = false
  }
}

async function confirmDelete(u) {
  const result = await Swal.fire({
    title: `確定要刪除「${u.display_name || u.username}」？`,
    text: '此動作無法復原。',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除',
    cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await apiFetch(`/api/users/${u.id}`, { method: 'DELETE' })
  await fetchUsers()
}

onMounted(() => { fetchUsers(); fetchShareLinks() })
</script>
