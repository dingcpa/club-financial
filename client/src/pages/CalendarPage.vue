<template>
  <v-card elevation="1">
    <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 pa-sm-4 ga-2">
      <div class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-calendar-month</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">行事曆</span>
      </div>
      <div class="d-flex align-center ga-1">
        <v-btn icon size="small" variant="text" @click="shiftMonth(-1)"><v-icon>mdi-chevron-left</v-icon></v-btn>
        <span class="text-body-2 font-weight-bold" style="min-width:120px;text-align:center">{{ monthLabel }}</span>
        <v-btn icon size="small" variant="text" @click="shiftMonth(1)"><v-icon>mdi-chevron-right</v-icon></v-btn>
        <v-btn size="small" variant="tonal" class="ml-2" @click="goToday">今天</v-btn>
      </div>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <div class="d-flex ga-3 mb-2 text-caption text-medium-emphasis">
        <span><v-icon size="10" color="teal">mdi-circle</v-icon> 活動（活動管理）</span>
        <span><v-icon size="10" color="indigo">mdi-circle</v-icon> 理監事會議</span>
      </div>

      <!-- 月曆格 -->
      <div style="overflow-x:auto">
        <div style="min-width:640px">
          <div class="cal-grid">
            <div v-for="w in WEEKDAYS" :key="w" class="cal-head text-caption font-weight-bold">{{ w }}</div>
          </div>
          <div v-for="(week, wi) in weeks" :key="wi" class="cal-grid">
            <div
              v-for="cell in week" :key="cell.key"
              class="cal-cell"
              :class="{ 'cal-dim': !cell.inMonth, 'cal-today': cell.date === todayStr }"
            >
              <div class="text-caption" :class="cell.date === todayStr ? 'font-weight-bold text-primary' : 'text-medium-emphasis'">
                {{ cell.day }}
              </div>
              <div
                v-for="ev in cell.events" :key="ev.key"
                class="cal-event text-caption"
                :style="`background:${ev.type === 'meeting' ? '#eef2ff' : '#f0fdfa'};border-left:3px solid ${ev.type === 'meeting' ? '#4f46e5' : '#0d9488'}`"
                :title="ev.tooltip"
              >
                {{ ev.title }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 本月清單 -->
      <div class="mt-4">
        <div class="text-subtitle-2 font-weight-bold mb-1">本月行程</div>
        <div v-if="!monthEvents.length" class="text-caption text-medium-emphasis pa-2">本月尚無活動或會議</div>
        <v-table v-else density="compact">
          <tbody>
            <tr v-for="ev in monthEvents" :key="ev.key">
              <td class="text-caption" style="width:100px;white-space:nowrap">{{ toMinguoDate(ev.date) }}</td>
              <td style="width:70px">
                <v-chip size="x-small" :color="ev.type === 'meeting' ? 'indigo' : 'teal'" variant="tonal">
                  {{ ev.type === 'meeting' ? '會議' : '活動' }}
                </v-chip>
              </td>
              <td class="text-caption">{{ ev.title }}</td>
              <td class="text-caption text-medium-emphasis">{{ ev.detail }}</td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { apiFetch } from '../composables/apiFetch.js'
import { toMinguoDate, toMinguoYear } from '../accounting/fiscal.js'

const projects = inject('projects')

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
const todayStr = new Date().toISOString().split('T')[0]
const currentYm = ref(todayStr.slice(0, 7))

const meetings = ref([])
async function fetchMeetings() {
  try {
    const res = await apiFetch('/api/meetings')
    meetings.value = await res.json()
  } catch (e) { /* 未登入或離線時行事曆仍可看活動 */ }
}
fetchMeetings()

const monthLabel = computed(() => {
  const [y, m] = currentYm.value.split('-').map(Number)
  return `民國 ${toMinguoYear(y)} 年 ${m} 月`
})

function shiftMonth(delta) {
  const [y, m] = currentYm.value.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  currentYm.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function goToday() { currentYm.value = todayStr.slice(0, 7) }

// 事件來源：活動管理（activityDate）＋理監事會議
const allEvents = computed(() => {
  const evs = []
  for (const p of projects?.value || []) {
    if (!p.activityDate || !p.active) continue
    evs.push({
      key: `p-${p.id}`, date: p.activityDate, type: 'activity', title: p.name,
      detail: p.location || '', tooltip: `${p.name}${p.location ? `（${p.location}）` : ''}`,
    })
  }
  for (const m of meetings.value) {
    if (!m.meetingDate) continue
    evs.push({
      key: `m-${m.id}`, date: m.meetingDate, type: 'meeting', title: m.title,
      detail: [m.meetingTime, m.location].filter(Boolean).join('・'),
      tooltip: `${m.title}${m.meetingTime ? ` ${m.meetingTime}` : ''}${m.location ? `（${m.location}）` : ''}`,
    })
  }
  return evs
})

const monthEvents = computed(() =>
  allEvents.value.filter(e => e.date.startsWith(currentYm.value)).sort((a, b) => a.date.localeCompare(b.date)))

const weeks = computed(() => {
  const [y, m] = currentYm.value.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay()) // 回到週日
  const out = []
  const cursor = new Date(start)
  while (true) {
    const week = []
    for (let i = 0; i < 7; i++) {
      const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
      week.push({
        key: date, date, day: cursor.getDate(),
        inMonth: cursor.getMonth() === m - 1,
        events: allEvents.value.filter(e => e.date === date),
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    out.push(week)
    if (cursor.getMonth() !== m - 1 && cursor.getDay() === 0 && out.length >= 4) break
    if (out.length > 6) break
  }
  return out
})
</script>

<style scoped>
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
}
.cal-head {
  text-align: center;
  padding: 4px 0;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
}
.cal-cell {
  min-height: 84px;
  border: 1px solid #e2e8f0;
  padding: 4px;
  background: white;
}
.cal-dim {
  background: #f8fafc;
  opacity: 0.55;
}
.cal-today {
  background: #eff6ff;
}
.cal-event {
  margin-top: 2px;
  padding: 1px 4px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
