<template>
  <div>
    <v-card elevation="1" class="mb-3">
      <v-card-title class="d-flex flex-wrap align-center ga-2 pa-3 pa-sm-4">
        <v-icon color="warning">mdi-bell-ring-outline</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">Line 請款（繳費通知）</span>
        <v-spacer />
        <v-select
          v-model="selectedYear" :items="yearOptions"
          :item-title="y => toMinguoYear(y) + ' 年度'" :item-value="y => y"
          density="compact" variant="outlined" hide-details style="min-width:120px"
        />
      </v-card-title>
      <v-card-text class="pt-0 px-3 px-sm-4 pb-3">
        <span class="text-caption text-medium-emphasis">
          依未收帳款自動彙整請款訊息：先篩選對象與項目，可修改文字後推播到 LINE 財務群組或複製轉發。
        </span>
      </v-card-text>
    </v-card>

    <v-row dense>
      <!-- 條件區 -->
      <v-col cols="12" md="5">
        <v-card elevation="1" class="mb-3">
          <v-card-title class="text-subtitle-2 font-weight-bold py-2 px-3">篩選條件</v-card-title>
          <v-card-text class="pt-0">
            <v-autocomplete
              v-model="filterMembers" label="社友（不選＝全部欠費者）" :items="ownerOptions"
              multiple chips closable-chips clearable
              density="compact" variant="outlined" class="mb-2"
            />
            <v-autocomplete
              v-model="filterCats" label="帳款項目（不選＝全部）" :items="catOptions"
              multiple chips closable-chips clearable
              density="compact" variant="outlined" class="mb-2"
            />
            <v-checkbox v-model="includePartial" label="包含部分收款中的帳款（列剩餘額）" density="compact" hide-details />
            <v-alert color="warning" variant="tonal" density="compact" class="mt-2">
              <div class="text-caption">
                符合條件：<b>{{ filteredByMember.size }}</b> 位、<b>{{ filteredCount }}</b> 筆，
                未收合計 NT$ <b>{{ filteredTotal.toLocaleString() }}</b>
              </div>
            </v-alert>
            <v-btn color="primary" variant="tonal" block class="mt-3" prepend-icon="mdi-refresh" @click="regenerate">重新產生訊息</v-btn>
          </v-card-text>
        </v-card>

        <!-- 通知紀錄 -->
        <v-card elevation="1">
          <v-card-title class="text-subtitle-2 font-weight-bold py-2 px-3">通知紀錄</v-card-title>
          <v-card-text class="pt-0" style="max-height:300px;overflow-y:auto">
            <div v-if="!logs.length" class="text-caption text-medium-emphasis text-center pa-3">尚無通知紀錄</div>
            <div v-for="l in logs" :key="l.id" class="text-caption py-1" style="border-bottom:1px dashed #e2e8f0">
              {{ (l.createdAt || '').slice(0, 16).replace('T', ' ') }}｜{{ l.channel === 'line-group' ? 'LINE 群組' : '複製文字' }}｜
              <span :class="l.status === 'sent' ? 'text-success' : (l.status === 'failed' ? 'text-error' : 'text-medium-emphasis')">
                {{ l.status === 'sent' ? '已推播' : (l.status === 'failed' ? '失敗' : '草稿') }}
              </span>
              <span v-if="l.target" class="text-medium-emphasis">｜{{ l.target }}</span>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 訊息預覽 -->
      <v-col cols="12" md="7">
        <v-card elevation="1">
          <v-card-title class="text-subtitle-2 font-weight-bold py-2 px-3">請款訊息（可修改）</v-card-title>
          <v-card-text class="pt-0">
            <v-textarea v-model="messageText" rows="18" density="compact" variant="outlined" style="font-family:monospace" hide-details class="mb-3" />
            <div class="d-flex flex-wrap ga-2">
              <v-btn color="primary" variant="tonal" prepend-icon="mdi-content-copy" @click="copyMessage">複製文字</v-btn>
              <v-tooltip :disabled="linePushOk" text="LINE 財務精靈未設定，請用複製文字" location="top">
                <template #activator="{ props }">
                  <span v-bind="props">
                    <v-btn color="warning" variant="flat" prepend-icon="mdi-send" :loading="sending" :disabled="!linePushOk" @click="pushMessage">
                      推播 LINE 群組
                    </v-btn>
                  </span>
                </template>
              </v-tooltip>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { inject } from 'vue'
import Swal from 'sweetalert2'
import { toMinguoYear } from '../accounting/fiscal.js'
import { apiFetch } from '../composables/apiFetch.js'

const receivables = inject('receivables')
const members = inject('members')

const selectedYear = ref(new Date().getFullYear().toString())
const filterMembers = ref([])
const filterCats = ref([])
const includePartial = ref(true)
const messageText = ref('')
const logs = ref([])
const sending = ref(false)
const linePushOk = ref(true) // 樂觀預設；推播失敗（未設定）後降級
let lastMemberNames = []

const yearOptions = computed(() => {
  const years = new Set([selectedYear.value])
  for (const r of receivables.value || []) if (r.dueYear) years.add(String(r.dueYear))
  return [...years].sort((a, b) => b - a)
})

function remainingOf(r) {
  if (r.status === 'waived') return 0
  const paid = r.status === 'partial' ? (r.paidAmount || 0) : (r.status === 'paid' ? r.amount : 0)
  return Math.round((r.amount - paid) * 100) / 100
}

// 該年度未收帳款（pending＋可選 partial）
const unpaid = computed(() => (receivables.value || []).filter(r =>
  String(r.dueYear) === String(selectedYear.value) &&
  (r.status === 'pending' || (includePartial.value && r.status === 'partial'))
))

const ownerOptions = computed(() => [...new Set(unpaid.value.map(r => r.memberName))]
  .sort((a, b) => a.localeCompare(b, 'zh-Hant')))
const catOptions = computed(() => [...new Set(unpaid.value.map(r => r.sourceRef).filter(Boolean))])

const filtered = computed(() => unpaid.value.filter(r =>
  (!filterMembers.value.length || filterMembers.value.includes(r.memberName)) &&
  (!filterCats.value.length || filterCats.value.includes(r.sourceRef))
))
const filteredByMember = computed(() => {
  const map = new Map()
  for (const r of filtered.value) {
    if (!map.has(r.memberName)) map.set(r.memberName, [])
    map.get(r.memberName).push(r)
  }
  return map
})
const filteredCount = computed(() => filtered.value.length)
const filteredTotal = computed(() => Math.round(filtered.value.reduce((s, r) => s + remainingOf(r), 0) * 100) / 100)

function buildMessage() {
  const byMember = filteredByMember.value
  lastMemberNames = [...byMember.keys()]
  const lines = [`📢 ${toMinguoYear(Number(selectedYear.value))} 年度社費/帳款請款通知`]
  let grand = 0
  for (const [name, items] of byMember) {
    const total = items.reduce((s, r) => s + remainingOf(r), 0)
    grand += total
    lines.push(`\n${name}（未繳合計 NT$ ${total.toLocaleString()}）`)
    for (const r of items) {
      const partialNote = r.status === 'partial' ? `（已收 ${(r.paidAmount || 0).toLocaleString()}）` : ''
      lines.push(`  ・${r.sourceRef}：NT$ ${remainingOf(r).toLocaleString()}${partialNote}`)
    }
  }
  lines.push(`\n共 ${byMember.size} 位、合計 NT$ ${grand.toLocaleString()}`)
  lines.push('請儘速繳納，匯款後歡迎告知末五碼以利對帳，謝謝！')
  return byMember.size ? lines.join('\n') : '目前無符合條件的未收帳款 🎉'
}

function regenerate() {
  messageText.value = buildMessage()
}

watch([selectedYear, filterMembers, filterCats, includePartial, receivables], regenerate, { deep: true })

async function loadLogs() {
  try {
    const res = await apiFetch('/api/notifications')
    logs.value = (await res.json()).filter(l => l.kind === 'dues-reminder')
  } catch { logs.value = [] }
}

async function logNotification(channel) {
  const res = await apiFetch('/api/notifications/dues-reminder', {
    method: 'POST',
    body: JSON.stringify({ channel, content: messageText.value, memberNames: lastMemberNames }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || '通知失敗')
  logs.value = [body, ...logs.value]
  return body
}

async function copyMessage() {
  try {
    await navigator.clipboard.writeText(messageText.value)
    await logNotification('text').catch(() => {})
    Swal.fire({ icon: 'success', title: '已複製，可貼到 LINE 或簡訊', timer: 1500, showConfirmButton: false })
  } catch {
    Swal.fire({ icon: 'error', title: '複製失敗', confirmButtonColor: '#ef4444' })
  }
}

async function pushMessage() {
  const confirm = await Swal.fire({
    title: '推播到 LINE 財務群組？',
    text: '訊息將立即發送到財務精靈所在的授權群組。',
    icon: 'question', showCancelButton: true,
    confirmButtonColor: '#f59e0b', cancelButtonColor: '#6b7280',
    confirmButtonText: '推播', cancelButtonText: '取消',
  })
  if (!confirm.isConfirmed) return
  sending.value = true
  try {
    await logNotification('line-group')
    Swal.fire({ icon: 'success', title: '已推播到 LINE 群組', timer: 1500, showConfirmButton: false })
  } catch (e) {
    if (/LINE/i.test(e.message) || /未設定|not configured|群組/.test(e.message)) linePushOk.value = false
    Swal.fire({ icon: 'error', title: '推播失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    sending.value = false
  }
}

onMounted(() => {
  regenerate()
  loadLogs()
})
</script>
