// 科目體系常數與資金帳戶解析（純函數，前後端皆可 import）
// 「資金帳戶」＝ (科目, 人員) 二元組，以字串表達：
//   - 銀行：科目名稱字串（如 '一銀帳戶'，對應 1101）
//   - 經手人：'經手人:<姓名>'（對應 1121 經手人往來 + person）

// 引擎直接引用的系統科目代碼（accounts.isSystem=1）
export const CODES = {
  BANK: '1101',            // 銀行存款-一銀
  RECEIVABLE: '1111',      // 應收帳款（person=社友）
  HANDLER: '1121',         // 經手人往來（person=經手人）
  PREPAID_EXPENSE: '1131', // 預付費用
  AGENCY: '2111',          // 代收款（person=代收案名）
  PAYABLE: '2112',         // 應付帳款（person=對象/受款人）
  UNEARNED_DUES: '2121',   // 預收社費
  UNEARNED_OTHER: '2122',  // 其他預收收入
  TEMP_RECEIPT: '2131',    // 暫收款(社友溢繳)（person=社友）
  RETAINED: '3101',        // 累積餘絀
  DUES_INCOME: '4101',     // 社費收入
}

export const HANDLER_PREFIX = '經手人:'
export const BANK_NAME = '一銀帳戶'

// 舊資料的資金帳戶字串 → (科目, 人員)。空字串沿用舊 AccountSummary 慣例視為淑華經手。
export const LEGACY_FUND_MAP = {
  '一銀帳戶': { code: CODES.BANK, person: '' },
  '淑華代收付': { code: CODES.HANDLER, person: '陳淑華' },
  '社長代收付': { code: CODES.HANDLER, person: '雷書維' },
  '': { code: CODES.HANDLER, person: '陳淑華' },
}

// 資金帳戶字串 → { code, person }；無法辨識時回 null
export function resolveFundAccount(str) {
  const s = (str || '').trim()
  if (s.startsWith(HANDLER_PREFIX)) {
    const person = s.slice(HANDLER_PREFIX.length).trim()
    return person ? { code: CODES.HANDLER, person } : null
  }
  if (Object.prototype.hasOwnProperty.call(LEGACY_FUND_MAP, s)) return { ...LEGACY_FUND_MAP[s] }
  if (s === BANK_NAME) return { code: CODES.BANK, person: '' }
  return null
}

export function handlerFundValue(person) {
  return `${HANDLER_PREFIX}${person}`
}

// 顯示用：'經手人:陳淑華' → '陳淑華（經手）'
export function fundAccountLabel(str) {
  const s = (str || '').trim()
  if (s.startsWith(HANDLER_PREFIX)) return `${s.slice(HANDLER_PREFIX.length)}（經手）`
  return s || '（未指定）'
}

// 收入/支出/轉帳單的「資金帳戶」下拉選項：銀行科目（isCash）+ 經手人（幹事、全體社友）
// 銀行的資金字串＝科目名稱（1101 沿用舊字彙 '一銀帳戶'）
export function buildFundAccountOptions(members, accounts, extraHandlers = ['陳淑華']) {
  const options = []
  const banks = (accounts || []).filter(a => a.isCash && a.active)
  if (banks.length) {
    for (const b of banks) {
      options.push(b.code === CODES.BANK
        ? { title: `${BANK_NAME}（${b.name}）`, value: BANK_NAME }
        : { title: b.name, value: b.name })
    }
  } else {
    options.push({ title: BANK_NAME, value: BANK_NAME })
  }
  const seen = new Set()
  for (const name of extraHandlers) {
    if (!name || seen.has(name)) continue
    seen.add(name)
    options.push({ title: `${name}（經手）`, value: handlerFundValue(name) })
  }
  for (const m of members || []) {
    if (m && typeof m === 'object' && m.status === 'left') continue // 退社社友不再列為經手人
    const name = typeof m === 'string' ? m : m.name
    if (!name || seen.has(name)) continue
    seen.add(name)
    options.push({ title: `${name}（經手）`, value: handlerFundValue(name) })
  }
  return options
}

// 舊 finance.item → 新科目代碼（歷史 backfill 與 legacy 顯示共用）
// '還社長' 為歸墊性質，由遷移腳本個案改 type='transfer'，不在此表。
// 委員會支出與預備費經使用者確認直接刪除，不在此表。
export const LEGACY_ITEM_MAP = {
  // 收入
  '1-3月社費': CODES.DUES_INCOME,
  '4-6月社費': CODES.DUES_INCOME,
  '7-9月社費': CODES.DUES_INCOME,
  '10-12月社費': CODES.DUES_INCOME,
  '入社費': CODES.DUES_INCOME,
  '授證紅箱': '4102',
  '交接紅箱': '4102',
  '春節紅箱': '4102',
  '母親節紅箱': '4102',
  '父親節紅箱': '4102',
  '中秋節紅箱': '4102',
  '例會歡喜紅箱': '4102',
  '其他紅箱': '4102',
  '其他收入-例會歡喜紅箱': '4102',
  '其他收入-其他紅箱': '4102',
  '其他收入-利息收入': '4103',
  '其他收入-其他': '4104',
  '溢收款': CODES.TEMP_RECEIPT,
  'EREY費': CODES.AGENCY,
  '總半年費': CODES.AGENCY,
  '總半年費(1-6)': CODES.AGENCY,
  '總半年費(7-12)': CODES.AGENCY,
  '金蘭房費': CODES.AGENCY,
  // 支出
  '辨公室租金及水電': '5201',
  '人事費 -薪資/油資': '5101',
  '文具費': '5203',
  '郵電費': '5204',
  '健保費': '5102',
  '印刷費': '5205',
  '雜費及設備更新': '5600',
  '助秘提撥金': '5103',
  '例會餐費(一般/聯合)': '5301',
  '一般例會/聯合例會': '5301',
  '餐費': '5301',
  '例會餐費(女賓夕/眷屬聯歡)': '5302',
  '女賓夕/眷屬聯歡': '5302',
  '資訊維修費(含地區網站)': '5204',
  '健遊活動': '5304',
  '演講車馬費': '5303',
  '爐邊會': '5305',
  '金蘭聯誼': '5307',
  '高球費用': '5310',
  '研習班': '5310',
  '職業參觀': '5308',
  '授證之旅補助': '5309',
}

// 帳款類別的舊 incomeAccount 字串 → 科目代碼
export const LEGACY_INCOME_ACCOUNT_MAP = {
  '社費收入': CODES.DUES_INCOME,
  '代收款': CODES.AGENCY,
  '紅箱收入': '4102',
  '其他收入': '4104',
  '利息收入': '4103',
}

// 取得單據應歸的科目：新資料看 accountCode，舊資料 fallback 到 item 對照
export function resolveRecordAccount(record) {
  if (record.accountCode) return record.accountCode
  return LEGACY_ITEM_MAP[record.item] || null
}

// ── 報表項目合併顯示 ─────────────────────────────────────────
// 社費按季拆四類別開單（會費/服務基金/餐費/固定紅箱），報表合併為「X-X月社費」
export const DUES_MERGE_RE = /^(\d{1,2}-\d{1,2}月)(會費|服務基金|餐費|固定紅箱)$/

// 帳款類別名稱 → 合併組名（非社費四項回 null）
export function duesGroupLabel(name) {
  const m = (name || '').trim().match(DUES_MERGE_RE)
  return m ? `${m[1]}社費` : null
}

// 收支月報表項目標籤：社費四項合併、各式歡喜紅箱合併為單一「歡喜紅箱」
export function reportItemLabel(name) {
  const g = duesGroupLabel(name)
  if (g) return g
  const s = (name || '').trim()
  if (s.startsWith('歡喜紅箱')) return '歡喜紅箱'
  return s
}

// ── 表單科目選項（Vuetify grouped select items）──────────────

function leavesOf(accounts) {
  const list = (accounts || []).filter(a => a.active)
  const hasChildren = new Set(list.filter(a => a.parentCode).map(a => a.parentCode))
  return list.filter(a => !hasChildren.has(a.code))
}

// 科目 → select item（description 顯示為副標，執秘可直接看科目用途）
function acctItem(a, titleSuffix = '') {
  const item = { title: `${a.code} ${a.name}${titleSuffix}`, value: a.code }
  if (a.description) item.props = { subtitle: a.description }
  return item
}

// 收入科目的語意分群（無上層科目時使用；未列者歸入其他收入類）
const INCOME_GROUPS = [
  { title: '社費類收入', codes: ['4101', '4106'] },
  { title: '捐贈與活動收入', codes: ['4102', '4107', '4108', '4109'] },
  { title: '其他收入類', codes: ['4103', '4104', '4105'] },
]

// 收入單「入帳科目」：收入科目（語意/上層分群）+ 代收付/暫收（負債）科目
export function incomeAccountOptions(accounts) {
  const list = (accounts || []).filter(a => a.active)
  const leaves = leavesOf(accounts)
  const income = leaves.filter(a => a.type === 'income')
  const liab = leaves.filter(a => a.type === 'liability' && [CODES.AGENCY, CODES.TEMP_RECEIPT].includes(a.code))
  const items = []
  const used = new Set()
  // 使用者自建的上層收入科目：依上層分群
  const parents = list.filter(a => a.type === 'income' && !a.parentCode && leaves.every(l => l.code !== a.code))
  for (const p of parents) {
    const children = income.filter(a => a.parentCode === p.code)
    if (!children.length) continue
    items.push({ type: 'subheader', title: `${p.code} ${p.name}` })
    for (const a of children) { items.push(acctItem(a)); used.add(a.code) }
  }
  // 平鋪收入科目：語意分群
  for (const g of INCOME_GROUPS) {
    const grp = income.filter(a => !used.has(a.code) && g.codes.includes(a.code))
    if (!grp.length) continue
    items.push({ type: 'subheader', title: g.title })
    for (const a of grp) { items.push(acctItem(a)); used.add(a.code) }
  }
  const rest = income.filter(a => !used.has(a.code))
  if (rest.length) {
    items.push({ type: 'subheader', title: '其他收入類' })
    items.push(...rest.map(a => acctItem(a)))
  }
  if (liab.length) {
    items.push({ type: 'divider' }, { type: 'subheader', title: '代收付科目（不計入收支餘絀）' })
    items.push(...liab.map(a => acctItem(a)))
  }
  return items
}

// 支出單「支出科目」：費用葉節點（依上層科目分組）+ 代收款付出
export function expenseAccountOptions(accounts) {
  const list = (accounts || []).filter(a => a.active)
  const leaves = leavesOf(accounts)
  const parents = list.filter(a => a.type === 'expense' && !a.parentCode)
  const items = []
  for (const p of parents) {
    const children = leaves.filter(a => a.parentCode === p.code)
    if (children.length) {
      items.push({ type: 'subheader', title: `${p.code} ${p.name}` })
      items.push(...children.map(a => acctItem(a)))
    } else if (leaves.some(a => a.code === p.code)) {
      items.push(acctItem(p))
    }
  }
  const agency = leaves.find(a => a.code === CODES.AGENCY)
  if (agency) {
    items.push({ type: 'divider' }, { type: 'subheader', title: '代收付科目（不計入收支餘絀）' })
    items.push({ title: `${agency.code} ${agency.name}（代收款付出/轉繳）`, value: agency.code, ...(agency.description ? { props: { subtitle: agency.description } } : {}) })
  }
  return items
}

// 科目代碼 → '4101 社費收入' 顯示字串
export function accountTitle(accounts, code) {
  const a = (accounts || []).find(x => x.code === code)
  return a ? `${a.code} ${a.name}` : (code || '')
}

// 編輯舊單據時，把 legacy 資金帳戶字串轉為新字彙（'淑華代收付' → '經手人:陳淑華'）
export function normalizeFundValue(str) {
  const resolved = resolveFundAccount(str)
  if (!resolved) return str || BANK_NAME
  return resolved.code === CODES.HANDLER ? handlerFundValue(resolved.person) : BANK_NAME
}
