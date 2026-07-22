<template>
  <div>
    <v-card elevation="1" class="mb-3">
      <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
        <v-icon color="primary">mdi-calendar-star</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">活動管理</span>
        <v-spacer />
        <v-btn color="primary" size="small" prepend-icon="mdi-plus" @click="openActivityModal(null)">新增活動</v-btn>
      </v-card-title>
      <v-card-text class="pt-0 px-3 px-sm-4 pb-3">
        <span class="text-caption text-medium-emphasis">
          活動同時是收支單據的「活動」維度（原專案類別）。點活動列開報名明細：逐位社友登記參加／用餐／住房／上車地點，統計自動加總。
        </span>
      </v-card-text>
    </v-card>

    <!-- 活動列表 -->
    <v-card elevation="1" class="mb-3">
      <div style="overflow-x:auto">
        <v-table density="compact" style="min-width:720px">
          <thead>
            <tr>
              <th class="text-caption">活動名稱</th>
              <th class="text-caption" style="width:110px">活動日期</th>
              <th class="text-caption">地點</th>
              <th class="text-caption text-center" style="width:150px">參加 / 用餐 / 住房</th>
              <th class="text-caption text-center" style="width:70px">狀態</th>
              <th class="text-caption text-center" style="width:110px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="!projects?.length">
              <td colspan="6" class="text-center text-medium-emphasis pa-8">尚無活動，點右上角「新增活動」</td>
            </tr>
            <tr
              v-for="p in sortedProjects" :key="p.id"
              :style="selectedId === p.id ? 'background:#eef2ff' : 'cursor:pointer'"
              @click="selectActivity(p)"
            >
              <td class="text-body-2 font-weight-medium">{{ p.name }}</td>
              <td class="text-caption">{{ p.activityDate ? toMinguoDate(p.activityDate) : '—' }}</td>
              <td class="text-caption">{{ p.location || '—' }}</td>
              <td class="text-caption text-center">
                <template v-if="statsByProject[p.id]">
                  {{ statsByProject[p.id].attending }} / {{ statsByProject[p.id].meal }} / {{ statsByProject[p.id].room }}
                </template>
                <span v-else class="text-medium-emphasis">—</span>
              </td>
              <td class="text-center">
                <v-chip size="x-small" :color="p.active ? 'success' : 'grey'" variant="tonal">{{ p.active ? '啟用' : '停用' }}</v-chip>
              </td>
              <td class="text-center" @click.stop>
                <v-btn icon size="x-small" variant="text" color="primary" @click="openActivityModal(p)"><v-icon>mdi-pencil</v-icon></v-btn>
                <v-btn icon size="x-small" variant="text" color="error" @click="handleDeleteActivity(p)"><v-icon>mdi-delete</v-icon></v-btn>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card>

    <!-- 報名明細 -->
    <v-card v-if="selected" elevation="1">
      <v-card-title class="d-flex flex-wrap align-center ga-2 py-2 px-3 px-sm-4" style="border-bottom:2px solid #4f46e5">
        <span class="text-body-1 font-weight-bold">{{ selected.name }}｜報名明細</span>
        <v-progress-circular v-if="regLoading" indeterminate size="16" width="2" />
        <v-spacer />
        <v-btn color="primary" size="small" prepend-icon="mdi-content-save" :loading="regSaving" @click="saveRegistrations">儲存報名明細</v-btn>
      </v-card-title>

      <!-- 統計卡 -->
      <v-card-text class="pb-0">
        <v-row dense>
          <v-col cols="6" sm="3">
            <v-card variant="tonal" color="primary" class="pa-2 text-center">
              <div class="text-caption">參加人數</div>
              <div class="text-h6 font-weight-bold">{{ stats.attending }}</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="tonal" color="success" class="pa-2 text-center">
              <div class="text-caption">用餐人數</div>
              <div class="text-h6 font-weight-bold">{{ stats.meal }}</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="tonal" color="warning" class="pa-2 text-center">
              <div class="text-caption">住房人數</div>
              <div class="text-h6 font-weight-bold">{{ stats.room }}</div>
            </v-card>
          </v-col>
          <v-col cols="6" sm="3">
            <v-card variant="tonal" color="secondary" class="pa-2 text-center">
              <div class="text-caption">上車地點</div>
              <div class="text-caption font-weight-bold mt-1" style="line-height:1.5">
                <template v-if="stats.busStops.length">
                  <div v-for="b in stats.busStops" :key="b.stop">{{ b.stop }}：{{ b.count }} 人</div>
                </template>
                <span v-else>—</span>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>

      <!-- 報名表格 -->
      <v-card-text>
        <div style="overflow:auto; max-height:60vh">
          <v-table density="compact" style="min-width:760px">
            <thead>
              <tr>
                <th class="text-caption" style="min-width:90px;position:sticky;left:0;background:white;z-index:2">社友</th>
                <th class="text-caption text-center" style="width:70px">參加</th>
                <th class="text-caption text-center" style="width:70px">用餐</th>
                <th class="text-caption text-center" style="width:70px">住房</th>
                <th class="text-caption" style="min-width:150px">上車地點</th>
                <th class="text-caption" style="min-width:170px">備註</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in regRows" :key="row.memberName">
                <td class="text-caption font-weight-medium" style="position:sticky;left:0;background:white;z-index:1">{{ row.memberName }}</td>
                <td class="text-center"><v-checkbox-btn v-model="row.attending" density="compact" class="d-inline-flex" /></td>
                <td class="text-center"><v-checkbox-btn v-model="row.meal" density="compact" class="d-inline-flex" /></td>
                <td class="text-center"><v-checkbox-btn v-model="row.room" density="compact" class="d-inline-flex" /></td>
                <td>
                  <v-combobox
                    v-model="row.busStop" :items="busStopOptions"
                    density="compact" variant="outlined" hide-details clearable placeholder="—"
                  />
                </td>
                <td>
                  <v-text-field v-model="row.note" density="compact" variant="outlined" hide-details placeholder="—" />
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card-text>
    </v-card>

    <!-- 活動編輯 Dialog -->
    <v-dialog v-model="activityModal" :max-width="xs ? undefined : 460" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editingActivity ? '編輯活動' : '新增活動' }}</span>
          <v-btn icon variant="text" @click="activityModal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-form @submit.prevent="handleSaveActivity">
            <v-text-field v-model="actForm.name" label="活動名稱" placeholder="例如：授證之旅" density="compact" variant="outlined" class="mb-2" autofocus />
            <v-text-field v-model="actForm.activityDate" label="活動日期" type="date" density="compact" variant="outlined" clearable class="mb-2" />
            <v-text-field v-model="actForm.location" label="活動地點" placeholder="例如：日月潭雲品酒店" density="compact" variant="outlined" clearable class="mb-2" />
            <v-textarea v-model="actForm.note" label="備註（行程、集合時間、上車地點說明…）" rows="3" density="compact" variant="outlined" class="mb-2" />
            <v-switch v-if="editingActivity" v-model="actForm.active" label="啟用（停用後單據不可再選）" color="success" density="compact" hide-details class="mb-2" />
            <v-btn type="submit" color="primary" variant="flat" prepend-icon="mdi-content-save" block>儲存活動</v-btn>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { toMinguoDate } from '../accounting/fiscal.js'
import { apiFetch } from '../composables/apiFetch.js'

const { xs } = useDisplay()

const projects = inject('projects')
const members = inject('members')
const addProject = inject('addProject')
const updateProject = inject('updateProject')
const deleteProject = inject('deleteProject')

const sortedProjects = computed(() => [...(projects.value || [])]
  .sort((a, b) => (b.activityDate || '').localeCompare(a.activityDate || '') || (a.sortOrder - b.sortOrder)))

// ── 活動主檔編輯 ──
const activityModal = ref(false)
const editingActivity = ref(null)
const actForm = ref({ name: '', activityDate: null, location: '', note: '', active: true })

function openActivityModal(p) {
  editingActivity.value = p
  actForm.value = p
    ? { name: p.name, activityDate: p.activityDate || null, location: p.location || '', note: p.note || '', active: !!p.active }
    : { name: '', activityDate: null, location: '', note: '', active: true }
  activityModal.value = true
}

async function handleSaveActivity() {
  const f = actForm.value
  if (!f.name.trim()) {
    Swal.fire({ icon: 'warning', title: '請輸入活動名稱', confirmButtonColor: '#4f46e5' })
    return
  }
  try {
    const payload = { name: f.name.trim(), activityDate: f.activityDate || null, location: f.location || null, note: f.note || null }
    if (editingActivity.value) {
      await updateProject(editingActivity.value.id, { ...payload, active: f.active })
    } else {
      await addProject(payload)
    }
    activityModal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

async function handleDeleteActivity(p) {
  const result = await Swal.fire({
    title: '確定要刪除此活動？',
    html: `將刪除「<b>${p.name}</b>」與其報名明細。已有單據使用的活動無法刪除，可改為停用。`,
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  try {
    await deleteProject(p.id)
    if (selectedId.value === p.id) { selectedId.value = null }
  } catch (e) {
    Swal.fire({ icon: 'error', title: '刪除失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

// ── 報名明細 ──
const selectedId = ref(null)
const selected = computed(() => (projects.value || []).find(p => p.id === selectedId.value) || null)
const regRows = ref([])
const regLoading = ref(false)
const regSaving = ref(false)
const allStats = ref({}) // projectId → 統計（列表欄用，載入過的活動才有）

function buildRows(saved) {
  const savedMap = new Map((saved || []).map(r => [r.memberName, r]))
  const activeNames = (members.value || []).filter(m => m.status !== 'left').map(m => m.name)
  const extraNames = [...savedMap.keys()].filter(n => !activeNames.includes(n))
  return [...activeNames, ...extraNames].map(name => {
    const s = savedMap.get(name)
    return {
      memberName: name,
      attending: !!s?.attending,
      meal: !!s?.meal,
      room: !!s?.room,
      busStop: s?.busStop || null,
      note: s?.note || '',
    }
  })
}

async function selectActivity(p) {
  selectedId.value = p.id
  regLoading.value = true
  try {
    const res = await apiFetch(`/api/projects/${p.id}/registrations`)
    const saved = res.ok ? await res.json() : []
    regRows.value = buildRows(saved)
    cacheStats(p.id, saved)
  } catch {
    regRows.value = buildRows([])
  } finally {
    regLoading.value = false
  }
}

async function saveRegistrations() {
  if (!selected.value) return
  const payload = regRows.value
    .filter(r => r.attending || r.meal || r.room || r.busStop || (r.note || '').trim())
    .map(r => ({ ...r, busStop: r.busStop || null }))
  regSaving.value = true
  try {
    const res = await apiFetch(`/api/projects/${selected.value.id}/registrations`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    if (!res.ok) throw new Error(body.error || '儲存失敗')
    regRows.value = buildRows(body)
    cacheStats(selected.value.id, body)
    Swal.fire({ icon: 'success', title: '報名明細已儲存', timer: 1200, showConfirmButton: false })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    regSaving.value = false
  }
}

function computeStats(rows) {
  const busMap = new Map()
  for (const r of rows) {
    if (r.busStop) busMap.set(r.busStop, (busMap.get(r.busStop) || 0) + 1)
  }
  return {
    attending: rows.filter(r => r.attending).length,
    meal: rows.filter(r => r.meal).length,
    room: rows.filter(r => r.room).length,
    busStops: [...busMap.entries()].map(([stop, count]) => ({ stop, count })).sort((a, b) => b.count - a.count),
  }
}
function cacheStats(projectId, saved) {
  allStats.value = { ...allStats.value, [projectId]: computeStats(saved.map(r => ({ ...r, attending: !!r.attending, meal: !!r.meal, room: !!r.room }))) }
}

const stats = computed(() => computeStats(regRows.value))
const statsByProject = computed(() => allStats.value)
const busStopOptions = computed(() => [...new Set(regRows.value.map(r => r.busStop).filter(Boolean))])

// 列表統計欄：載入各活動報名數（輕量：一次抓全部活動的明細會多次請求，改為點選才載入；
// 初始只載入前 5 個有日期的活動，避免大量請求）
onMounted(async () => {
  const recent = sortedProjects.value.slice(0, 5)
  for (const p of recent) {
    try {
      const res = await apiFetch(`/api/projects/${p.id}/registrations`)
      if (res.ok) cacheStats(p.id, await res.json())
    } catch { /* 忽略 */ }
  }
})
</script>
