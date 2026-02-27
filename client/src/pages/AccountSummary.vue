<template>
  <div>
    <div v-if="loading" class="text-center pa-12">
      <v-progress-circular indeterminate color="primary" />
    </div>
    <div v-else>
      <div class="d-flex align-center ga-2 mb-4">
        <v-icon color="primary" size="24">mdi-bank</v-icon>
        <h3 class="text-body-1 text-sm-h5 font-weight-bold">資金帳戶明細表</h3>
      </div>

      <!-- 帳戶卡片 -->
      <v-row class="mb-4" dense>
        <v-col v-for="acc in ACCOUNTS" :key="acc" cols="12" sm="4">
          <v-card
            :elevation="selectedAccount === acc ? 4 : 1"
            :color="selectedAccount === acc ? 'blue-lighten-5' : undefined"
            :border="selectedAccount === acc ? 'primary sm' : undefined"
            rounded="lg"
            class="pa-3"
            style="cursor:pointer;transition:all 0.2s"
            @click="toggleAccount(acc)"
          >
            <div class="d-flex justify-space-between mb-2">
              <span class="text-caption font-weight-bold text-medium-emphasis">{{ acc }}</span>
              <v-icon :color="selectedAccount === acc ? 'primary' : 'grey-lighten-1'" size="18">mdi-wallet</v-icon>
            </div>
            <div class="text-body-1 text-sm-h6 font-weight-bold mb-2">NT$ {{ Math.round(accountData[acc].balance).toLocaleString() }}</div>
            <v-row dense>
              <v-col cols="6">
                <div class="text-caption text-success font-weight-medium">累積收款</div>
                <div class="text-caption">+{{ Math.round(accountData[acc].income).toLocaleString() }}</div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-error font-weight-medium">累積付款</div>
                <div class="text-caption">-{{ Math.round(accountData[acc].expense).toLocaleString() }}</div>
              </v-col>
            </v-row>
          </v-card>
        </v-col>
      </v-row>

      <!-- 交易明細 -->
      <v-card elevation="1">
        <v-card-title class="d-flex flex-wrap justify-space-between align-center pa-3 ga-2">
          <span class="text-body-2 font-weight-bold">
            {{ selectedAccount === 'ALL' ? '所有帳戶' : selectedAccount }} 明細紀錄
          </span>
          <v-text-field
            v-model="searchTerm"
            placeholder="搜尋項目、社友或備註..."
            prepend-inner-icon="mdi-magnify"
            density="compact"
            variant="outlined"
            hide-details
            style="min-width:180px;max-width:100%"
          />
        </v-card-title>

        <div style="overflow-x:auto">
          <v-table density="compact">
            <thead>
              <tr>
                <th class="text-caption">日期</th>
                <th class="text-caption">帳戶</th>
                <th class="text-caption">項目 / 對象</th>
                <th class="text-right text-caption">金額</th>
                <th class="text-caption d-none d-sm-table-cell">備註</th>
                <th class="text-center text-caption">操作</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="filteredTransactions.length === 0">
                <td colspan="6" class="text-center text-medium-emphasis pa-12">無相關交易紀錄</td>
              </tr>
              <tr v-for="(tx, idx) in filteredTransactions" :key="tx.id || idx">
                <td class="text-caption" style="white-space:nowrap">{{ toMinguoDate(tx.date) }}</td>
                <td>
                  <v-chip size="x-small" variant="tonal" color="grey" style="font-size:10px">
                    {{ tx.type === 'transfer' ? `${tx.fromAccount} ➡ ${tx.toAccount}` : (tx.account || '淑華代收付') }}
                  </v-chip>
                </td>
                <td>
                  <div class="text-caption font-weight-medium" :class="tx.type === 'transfer' ? 'text-primary' : ''">
                    {{ tx.type === 'transfer' ? '資金調撥' : tx.item }}
                  </div>
                  <div v-if="tx.type !== 'transfer' && tx.member" class="text-caption text-primary">{{ tx.member }}</div>
                </td>
                <td class="text-right text-caption font-weight-bold" :class="getAmtClass(tx)" style="white-space:nowrap">
                  {{ getAmtPrefix(tx) }}{{ Math.round(tx.amount).toLocaleString() }}
                </td>
                <td class="text-caption text-medium-emphasis d-none d-sm-table-cell" style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ tx.remark || '-' }}</td>
                <td class="text-center">
                  <v-btn icon size="x-small" variant="text" color="primary" @click="handleEditClick(tx)">
                    <v-icon size="16">mdi-pencil</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </div>
      </v-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'

const records = inject('records')
const loading = inject('loading')
const handleEditClick = inject('handleEditClick')

const ACCOUNTS = ['淑華代收付', '一銀帳戶', '社長代收付']
const selectedAccount = ref('ALL')
const searchTerm = ref('')

function toMinguoYear(y) { return parseInt(y) - 1911 }
function toMinguoDate(s) {
  if (!s) return ''
  const [y, m, d] = s.split('-')
  return `${toMinguoYear(y)}-${m}-${d}`
}

function toggleAccount(acc) {
  selectedAccount.value = selectedAccount.value === acc ? 'ALL' : acc
}

const accountData = computed(() => {
  const stats = {
    '淑華代收付': { income: 0, expense: 0, balance: 0, transactions: [] },
    '一銀帳戶': { income: 0, expense: 0, balance: 0, transactions: [] },
    '社長代收付': { income: 0, expense: 0, balance: 0, transactions: [] },
  }
  ;(records.value || []).forEach(r => {
    const amt = parseFloat(r.amount) || 0
    if (r.type === 'transfer') {
      const from = r.fromAccount, to = r.toAccount
      if (stats[from]) { stats[from].expense += amt; stats[from].balance -= amt; stats[from].transactions.push(r) }
      if (stats[to]) { stats[to].income += amt; stats[to].balance += amt; stats[to].transactions.push(r) }
    } else {
      const acc = r.account || '淑華代收付'
      if (stats[acc]) {
        if (r.type === 'income') { stats[acc].income += amt; stats[acc].balance += amt }
        else { stats[acc].expense += amt; stats[acc].balance -= amt }
        stats[acc].transactions.push(r)
      }
    }
  })
  Object.keys(stats).forEach(acc => stats[acc].transactions.sort((a, b) => b.date.localeCompare(a.date)))
  return stats
})

const filteredTransactions = computed(() => {
  const term = searchTerm.value
  let txs = selectedAccount.value === 'ALL'
    ? (records.value || []).filter(t => t.type === 'transfer' || ACCOUNTS.includes(t.account || '淑華代收付'))
    : accountData.value[selectedAccount.value].transactions
  return txs
    .filter(t => (t.item || '').includes(term) || (t.member || '').includes(term) || (t.remark || '').includes(term))
    .sort((a, b) => b.date.localeCompare(a.date))
})

function getAmtClass(tx) {
  if (tx.type === 'transfer') {
    if (selectedAccount.value === 'ALL') return ''
    return tx.toAccount === selectedAccount.value ? 'text-success' : 'text-error'
  }
  return tx.type === 'income' ? 'text-success' : 'text-error'
}

function getAmtPrefix(tx) {
  if (tx.type === 'transfer') {
    if (selectedAccount.value === 'ALL') return ''
    return tx.toAccount === selectedAccount.value ? '+' : '-'
  }
  return tx.type === 'income' ? '+' : '-'
}
</script>
