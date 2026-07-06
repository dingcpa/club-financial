<template>
  <v-card elevation="1">
    <v-card-title class="d-flex align-center ga-2 pa-3 pa-sm-4">
      <v-icon color="primary">mdi-scale-balance</v-icon>
      <span class="text-body-1 text-sm-h6 font-weight-bold">期初餘額設定</span>
    </v-card-title>

    <v-card-text class="pa-2 pa-sm-4">
      <v-alert color="primary" variant="tonal" icon="mdi-information" density="compact" class="mb-3">
        <div class="text-caption">
          輸入基準日（{{ baseDate }}）當日各<strong>資產/負債科目</strong>餘額（含人員明細）。
          <strong>累積餘絀由系統自動軋差</strong>，不需輸入。基準日之前的歷史交易一律以期初餘額表達。
        </div>
      </v-alert>

      <div v-for="(l, i) in rows" :key="i" class="d-flex ga-1 align-center mb-1">
        <v-autocomplete
          v-model="l.accountCode" :items="acctOptions" label="科目"
          density="compact" variant="outlined" hide-details style="flex:2.2"
        />
        <v-combobox
          v-model="l.person" :items="personOptions" label="對象（人員/案名）"
          density="compact" variant="outlined" hide-details style="flex:1.4"
        />
        <v-text-field v-model="l.debit" label="借方（資產）" type="number" density="compact" variant="outlined" hide-details style="flex:1" />
        <v-text-field v-model="l.credit" label="貸方（負債）" type="number" density="compact" variant="outlined" hide-details style="flex:1" />
        <v-btn icon size="x-small" variant="text" color="error" @click="rows.splice(i, 1)"><v-icon>mdi-close</v-icon></v-btn>
      </div>

      <div class="d-flex align-center ga-3 mt-3 mb-4 flex-wrap">
        <v-btn size="small" variant="tonal" prepend-icon="mdi-plus" @click="rows.push(makeRow())">加一行</v-btn>
        <v-spacer />
        <v-chip size="small" variant="tonal">借方合計 {{ totalDebit.toLocaleString() }}</v-chip>
        <v-chip size="small" variant="tonal">貸方合計 {{ totalCredit.toLocaleString() }}</v-chip>
        <v-chip size="small" :color="diff >= 0 ? 'primary' : 'warning'" variant="flat">
          累積餘絀（自動軋差）：{{ diff.toLocaleString() }}
        </v-chip>
      </div>

      <v-btn color="primary" variant="flat" prepend-icon="mdi-content-save" :loading="saving" @click="handleSave">儲存期初餘額</v-btn>
    </v-card-text>
  </v-card>
</template>

<script setup>
import { ref, computed, inject, watch } from 'vue'
import Swal from 'sweetalert2'

const accounts = inject('accounts')
const members = inject('members')
const appSettings = inject('appSettings')
const openingBalances = inject('openingBalances')
const saveOpeningBalances = inject('saveOpeningBalances')

const baseDate = computed(() => appSettings?.value?.['accounting.baseDate'] || '2026-06-30')

// 只列資產/負債葉節點（權益由引擎軋差）
const acctOptions = computed(() => {
  const list = (accounts?.value || []).filter(a => a.active && (a.type === 'asset' || a.type === 'liability'))
  const hasChildren = new Set((accounts?.value || []).filter(a => a.parentCode).map(a => a.parentCode))
  return list.filter(a => !hasChildren.has(a.code))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map(a => ({ title: `${a.code} ${a.name}`, value: a.code }))
})
const personOptions = computed(() => (members?.value || []).map(m => m.name))

function makeRow() {
  return { accountCode: null, person: '', debit: '', credit: '', remark: '' }
}

const rows = ref([makeRow()])
const saving = ref(false)

watch(() => openingBalances?.value, (val) => {
  if (val && val.length) {
    rows.value = val.map(r => ({
      accountCode: r.accountCode, person: r.person || '',
      debit: r.debit || '', credit: r.credit || '', remark: r.remark || '',
    }))
  }
}, { immediate: true })

const totalDebit = computed(() => rows.value.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0))
const totalCredit = computed(() => rows.value.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0))
// 借方（資產）> 貸方（負債）→ 差額貸記累積餘絀（正常為正數）
const diff = computed(() => Math.round((totalDebit.value - totalCredit.value) * 100) / 100)

async function handleSave() {
  const payload = rows.value
    .filter(l => l.accountCode && ((parseFloat(l.debit) || 0) !== 0 || (parseFloat(l.credit) || 0) !== 0))
    .map(l => ({
      accountCode: l.accountCode, person: l.person || '',
      debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0, remark: l.remark || '',
    }))
  saving.value = true
  try {
    await saveOpeningBalances(baseDate.value, payload)
    Swal.fire({ icon: 'success', title: '期初餘額已儲存', timer: 1200, showConfirmButton: false })
  } catch (e) {
    Swal.fire({ icon: 'error', title: '儲存失敗', text: e.message, confirmButtonColor: '#ef4444' })
  } finally {
    saving.value = false
  }
}
</script>
