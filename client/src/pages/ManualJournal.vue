<template>
  <v-card elevation="1">
    <v-card-title class="d-flex justify-space-between align-center pa-3 pa-sm-4">
      <div class="d-flex align-center ga-2">
        <v-icon color="warning">mdi-file-sign</v-icon>
        <span class="text-body-1 text-sm-h6 font-weight-bold">手工傳票</span>
      </div>
      <v-btn color="primary" prepend-icon="mdi-plus" size="small" @click="openModal(null)">新增傳票</v-btn>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4 pt-0">
      <v-alert color="primary" variant="tonal" icon="mdi-information" density="compact" class="mb-3">
        <div class="text-caption">
          供<strong>調整分錄</strong>使用（兌換損益、期末調整、更正分錄）。日常收支請用收入單/支出單/內部轉帳單。
          借貸必須平衡才能儲存。
        </div>
      </v-alert>

      <v-table density="compact">
        <thead>
          <tr>
            <th style="width:100px">日期</th>
            <th>摘要</th>
            <th class="text-right" style="width:130px">金額</th>
            <th class="text-center" style="width:110px">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="!(manualJournals || []).length">
            <td colspan="4" class="text-center text-medium-emphasis pa-8">尚無手工傳票</td>
          </tr>
          <tr v-for="j in manualJournals" :key="j.id">
            <td class="text-caption text-medium-emphasis" style="white-space:nowrap">{{ toMinguoDate(j.date) }}</td>
            <td class="text-caption">{{ j.description || '—' }}</td>
            <td class="text-right text-caption">{{ totalOf(j).toLocaleString() }}</td>
            <td class="text-center">
              <v-btn size="x-small" variant="tonal" color="primary" class="mr-1" @click="openModal(j)">編輯</v-btn>
              <v-btn size="x-small" variant="tonal" color="error" @click="handleDelete(j)">刪除</v-btn>
            </td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>

    <!-- 編輯 Dialog -->
    <v-dialog v-model="modal" :max-width="xs ? undefined : 720" :fullscreen="xs">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center pa-4">
          <span class="text-h6 font-weight-bold">{{ editing ? '編輯傳票' : '新增傳票' }}</span>
          <v-btn icon variant="text" @click="modal = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <v-row dense>
            <v-col cols="12" sm="4">
              <v-text-field v-model="form.date" label="傳票日期" type="date" density="compact" variant="outlined" />
            </v-col>
            <v-col cols="12" sm="8">
              <v-text-field v-model="form.description" label="摘要" placeholder="例如：外幣兌換損益調整" density="compact" variant="outlined" />
            </v-col>
          </v-row>

          <div v-for="(l, i) in form.lines" :key="i" class="d-flex ga-1 align-center mb-1">
            <v-autocomplete
              v-model="l.accountCode" :items="acctOptions" label="科目"
              density="compact" variant="outlined" hide-details style="flex:2.2"
            />
            <v-combobox
              v-model="l.person" :items="personOptions" label="對象"
              density="compact" variant="outlined" hide-details style="flex:1.3"
            />
            <v-text-field v-model="l.debit" label="借方" type="number" density="compact" variant="outlined" hide-details style="flex:1" />
            <v-text-field v-model="l.credit" label="貸方" type="number" density="compact" variant="outlined" hide-details style="flex:1" />
            <v-btn icon size="x-small" variant="text" color="error" :disabled="form.lines.length <= 2" @click="form.lines.splice(i, 1)">
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </div>

          <div class="d-flex align-center ga-3 mt-2 mb-3">
            <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="form.lines.push(makeLine())">加一行</v-btn>
            <v-spacer />
            <v-chip size="small" :color="balanced ? 'success' : 'error'" variant="tonal">
              借 {{ totalDebit.toLocaleString() }}／貸 {{ totalCredit.toLocaleString() }}{{ balanced ? '（平衡）' : '（不平衡）' }}
            </v-chip>
          </div>

          <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" block :disabled="!balanced" @click="handleSave">儲存傳票</v-btn>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { useDisplay } from 'vuetify'
import Swal from 'sweetalert2'
import { toMinguoDate } from '../accounting/fiscal.js'

const { xs } = useDisplay()

const accounts = inject('accounts')
const members = inject('members')
const manualJournals = inject('manualJournals')
const addManualJournal = inject('addManualJournal')
const updateManualJournal = inject('updateManualJournal')
const deleteManualJournal = inject('deleteManualJournal')

const modal = ref(false)
const editing = ref(null)

// 葉節點科目（有細項的上層科目不可記帳）
const acctOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  return list.filter(a => !hasChildren.has(a.code))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})
const personOptions = computed(() => (members?.value || []).map(m => m.name))

function makeLine() {
  return { accountCode: null, person: '', debit: '', credit: '' }
}

const form = ref({ date: '', description: '', lines: [makeLine(), makeLine()] })

const totalDebit = computed(() => form.value.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0))
const totalCredit = computed(() => form.value.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0))
const balanced = computed(() =>
  totalDebit.value > 0 && Math.round(totalDebit.value * 100) === Math.round(totalCredit.value * 100)
)

function totalOf(j) {
  return (j.lines || []).reduce((s, l) => s + (parseFloat(l.debit) || 0), 0)
}

function openModal(j) {
  editing.value = j
  form.value = j
    ? {
        date: j.date,
        description: j.description || '',
        lines: (j.lines || []).map(l => ({ accountCode: l.accountCode, person: l.person || '', debit: l.debit || '', credit: l.credit || '' })),
      }
    : { date: new Date().toISOString().split('T')[0], description: '', lines: [makeLine(), makeLine()] }
  modal.value = true
}

async function handleSave() {
  const lines = form.value.lines
    .filter(l => l.accountCode && ((parseFloat(l.debit) || 0) > 0 || (parseFloat(l.credit) || 0) > 0))
    .map(l => ({
      accountCode: l.accountCode,
      person: l.person || '',
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
    }))
  try {
    if (editing.value) {
      await updateManualJournal(editing.value.id, { date: form.value.date, description: form.value.description, lines })
    } else {
      await addManualJournal({ date: form.value.date, description: form.value.description, lines })
    }
    modal.value = false
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  }
}

async function handleDelete(j) {
  const result = await Swal.fire({
    title: '確定要刪除此傳票？',
    text: j.description || '',
    icon: 'warning', showCancelButton: true,
    confirmButtonColor: '#ef4444', cancelButtonColor: '#6b7280',
    confirmButtonText: '確定刪除', cancelButtonText: '取消',
  })
  if (!result.isConfirmed) return
  await deleteManualJournal(j.id)
}
</script>
