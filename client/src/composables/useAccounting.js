import { computed } from 'vue'
import { deriveAllEntries } from '../accounting/deriveEntries.js'

// 把單據 refs 綁進推導引擎：單據變動 → computed 自動重算全部分錄
export function useAccounting({ records, receivables, agencyCollections, manualJournals, openingBalances, accounts, appSettings }) {
  const derived = computed(() => deriveAllEntries({
    finance: records?.value || [],
    receivables: receivables?.value || [],
    agencyCollections: agencyCollections?.value || [],
    manualJournals: manualJournals?.value || [],
    openingBalances: openingBalances?.value || [],
    accounts: accounts?.value || [],
    settings: appSettings?.value || {},
  }))

  const entries = computed(() => derived.value.entries)
  const diagnostics = computed(() => derived.value.diagnostics)
  const baseDate = computed(() => derived.value.baseDate)
  const acctByCode = computed(() => Object.fromEntries((accounts?.value || []).map(a => [a.code, a])))

  return { entries, diagnostics, baseDate, acctByCode }
}
