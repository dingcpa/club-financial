// 帳簿聚合（純函數）：分錄 → 日記帳 / 分類帳 / 試算表 / 資產負債表 / 收支表 / 現金流量表
import { CODES } from './coa.js'

const r2 = (n) => Math.round(n * 100) / 100

// 科目餘額正向：資產/費用＝借餘為正；負債/權益/收入＝貸餘為正
export function normalBalance(acctType, debit, credit) {
  return acctType === 'asset' || acctType === 'expense' ? debit - credit : credit - debit
}

// ── 日記帳：期間內分錄流水 ──────────────────────────────────
export function journalRows(entries, { from, to } = {}) {
  return entries.filter(e => (!from || e.date >= from) && (!to || e.date <= to))
}

// ── 分類帳：單一科目（可篩人員/專案）的期初、逐筆、餘額 ─────
export function ledgerFor(entries, acctByCode, { accountCode, person, projectId, from, to } = {}) {
  const acct = acctByCode[accountCode]
  const type = acct ? acct.type : 'asset'
  const match = (l) =>
    l.accountCode === accountCode &&
    (person === undefined || person === null || l.person === person) &&
    (projectId === undefined || projectId === null || l.projectId === projectId)

  let opening = 0
  const rows = []
  for (const e of entries) {
    for (const l of e.lines) {
      if (!match(l)) continue
      if (from && e.date < from) {
        opening += normalBalance(type, l.debit, l.credit)
        continue
      }
      if (to && e.date > to) continue
      rows.push({ entry: e, line: l })
    }
  }
  opening = r2(opening)
  let running = opening
  const detailed = rows.map(({ entry, line }) => {
    running = r2(running + normalBalance(type, line.debit, line.credit))
    return { entry, line, balance: running }
  })
  return { opening, rows: detailed, closing: running }
}

// ── 科目餘額表（截至 asOf；含 person 明細）───────────────────
export function balancesAsOf(entries, { asOf, withPerson = false } = {}) {
  const byCode = new Map() // code → { debit, credit }
  const byCodePerson = new Map() // code → Map(person → { debit, credit })
  for (const e of entries) {
    if (asOf && e.date > asOf) continue
    for (const l of e.lines) {
      if (!byCode.has(l.accountCode)) byCode.set(l.accountCode, { debit: 0, credit: 0 })
      const b = byCode.get(l.accountCode)
      b.debit += l.debit || 0
      b.credit += l.credit || 0
      if (withPerson) {
        if (!byCodePerson.has(l.accountCode)) byCodePerson.set(l.accountCode, new Map())
        const pm = byCodePerson.get(l.accountCode)
        const key = l.person || ''
        if (!pm.has(key)) pm.set(key, { debit: 0, credit: 0 })
        const pb = pm.get(key)
        pb.debit += l.debit || 0
        pb.credit += l.credit || 0
      }
    }
  }
  return { byCode, byCodePerson }
}

// ── 試算表 ──────────────────────────────────────────────────
export function trialBalance(entries, acctByCode, { asOf } = {}) {
  const { byCode } = balancesAsOf(entries, { asOf })
  const rows = []
  let totalDebit = 0, totalCredit = 0
  for (const [code, b] of byCode) {
    const net = r2(b.debit - b.credit)
    if (!net) continue
    const acct = acctByCode[code]
    const row = {
      code,
      name: acct ? acct.name : code,
      debit: net > 0 ? net : 0,
      credit: net < 0 ? -net : 0,
    }
    totalDebit += row.debit
    totalCredit += row.credit
    rows.push(row)
  }
  rows.sort((a, b) => a.code.localeCompare(b.code))
  return { rows, totalDebit: r2(totalDebit), totalCredit: r2(totalCredit), balanced: r2(totalDebit) === r2(totalCredit) }
}

// ── 資產負債表（asOf）────────────────────────────────────────
// 經手人往來（1121）按人淨額歸邊：借餘 → 其他應收款(經手人)、貸餘 → 其他應付款(經手人)
export function balanceSheet(entries, acctByCode, { asOf } = {}) {
  const { byCode, byCodePerson } = balancesAsOf(entries, { asOf, withPerson: true })

  const rowsOf = (type) => {
    const rows = []
    for (const [code, b] of byCode) {
      const acct = acctByCode[code]
      if (!acct || acct.type !== type) continue
      if (code === CODES.HANDLER) continue // 經手人往來另行歸邊
      const bal = r2(normalBalance(type, b.debit, b.credit))
      if (!bal) continue
      rows.push({ code, name: acct.name, amount: bal, drill: { accountCode: code } })
    }
    rows.sort((a, b) => a.code.localeCompare(b.code))
    return rows
  }

  // 經手人往來按人淨額歸邊
  const handlerPersons = byCodePerson.get(CODES.HANDLER) || new Map()
  let handlerAR = 0, handlerAP = 0
  const handlerDetail = []
  for (const [person, b] of handlerPersons) {
    const bal = r2(b.debit - b.credit) // 借餘＝應收
    if (!bal) continue
    handlerDetail.push({ person, amount: bal })
    if (bal > 0) handlerAR = r2(handlerAR + bal)
    else handlerAP = r2(handlerAP - bal)
  }

  const assets = rowsOf('asset')
  // 現金（1105）列示於最前，其餘依代碼序
  assets.sort((a, b) => ((a.code === '1105' ? 0 : 1) - (b.code === '1105' ? 0 : 1)) || a.code.localeCompare(b.code))
  if (handlerAR) assets.push({ code: CODES.HANDLER, name: '其他應收款(經手人)', amount: handlerAR, drill: { accountCode: CODES.HANDLER } })
  const liabilities = rowsOf('liability')
  if (handlerAP) liabilities.push({ code: `${CODES.HANDLER}-AP`, name: '其他應付款(經手人)', amount: handlerAP, drill: { accountCode: CODES.HANDLER } })

  // 權益：累積餘絀（3101 已含年度結轉）＋ 本期餘絀（未結轉的收入−費用）
  const retained = byCode.get(CODES.RETAINED)
  const retainedBal = retained ? r2(retained.credit - retained.debit) : 0
  let currentNet = 0
  for (const [code, b] of byCode) {
    const acct = acctByCode[code]
    if (!acct) continue
    if (acct.type === 'income') currentNet += b.credit - b.debit
    else if (acct.type === 'expense') currentNet -= b.debit - b.credit
  }
  currentNet = r2(currentNet)
  const equity = []
  if (retainedBal) equity.push({ code: CODES.RETAINED, name: '累積餘絀', amount: retainedBal, drill: { accountCode: CODES.RETAINED } })
  if (currentNet) equity.push({ code: 'current', name: '本期餘絀', amount: currentNet, drill: null })

  const totalAssets = r2(assets.reduce((s, x) => s + x.amount, 0))
  const totalLiabilities = r2(liabilities.reduce((s, x) => s + x.amount, 0))
  const totalEquity = r2(equity.reduce((s, x) => s + x.amount, 0))
  return {
    assets, liabilities, equity, handlerDetail,
    totalAssets, totalLiabilities, totalEquity,
    balanced: r2(totalAssets) === r2(totalLiabilities + totalEquity),
  }
}

// ── 收支表（期間；科目二層彙總，供收支月報表）────────────────
export function incomeStatement(entries, acctByCode, { from, to } = {}) {
  const agg = new Map() // code → amount（收入貸餘、費用借餘為正）
  for (const e of entries) {
    if (e.sourceType === 'closing') continue // 結轉不影響期間損益
    if ((from && e.date < from) || (to && e.date > to)) continue
    for (const l of e.lines) {
      const acct = acctByCode[l.accountCode]
      if (!acct || (acct.type !== 'income' && acct.type !== 'expense')) continue
      const amt = normalBalance(acct.type, l.debit, l.credit)
      agg.set(l.accountCode, r2((agg.get(l.accountCode) || 0) + amt))
    }
  }

  function section(type) {
    // 依上層科目分組（無細項者自成一組）
    const groups = new Map()
    for (const [code, amount] of agg) {
      const acct = acctByCode[code]
      if (!acct || acct.type !== type || !amount) continue
      const parent = acct.parentCode && acctByCode[acct.parentCode] ? acctByCode[acct.parentCode] : acct
      if (!groups.has(parent.code)) groups.set(parent.code, { code: parent.code, name: parent.name, amount: 0, items: [] })
      const g = groups.get(parent.code)
      g.amount = r2(g.amount + amount)
      g.items.push({ code, name: acct.name, amount, drill: { accountCode: code } })
    }
    const rows = [...groups.values()].sort((a, b) => a.code.localeCompare(b.code))
    for (const g of rows) g.items.sort((a, b) => a.code.localeCompare(b.code))
    return rows
  }

  const income = section('income')
  const expense = section('expense')
  const totalIncome = r2(income.reduce((s, g) => s + g.amount, 0))
  const totalExpense = r2(expense.reduce((s, g) => s + g.amount, 0))
  return { income, expense, totalIncome, totalExpense, net: r2(totalIncome - totalExpense) }
}

// ── 現金流量表（直接法；現金＝isCash 科目）───────────────────
// 每張觸及現金的分錄，以「對方科目」歸類現金流入/流出
export function cashFlow(entries, acctByCode, { from, to } = {}) {
  const isCash = (code) => !!acctByCode[code]?.isCash
  const inflows = new Map()  // 對方科目 code → 金額
  const outflows = new Map()
  let net = 0

  for (const e of entries) {
    if ((from && e.date < from) || (to && e.date > to)) continue
    const cashLines = e.lines.filter(l => isCash(l.accountCode))
    if (!cashLines.length) continue
    const cashDelta = r2(cashLines.reduce((s, l) => s + (l.debit || 0) - (l.credit || 0), 0))
    if (!cashDelta) continue
    net = r2(net + cashDelta)
    // 對方科目：非現金線，按絕對金額比例分攤現金變動
    const others = e.lines.filter(l => !isCash(l.accountCode))
    const totalOther = others.reduce((s, l) => s + Math.abs((l.debit || 0) - (l.credit || 0)), 0)
    const target = cashDelta > 0 ? inflows : outflows
    if (!others.length || !totalOther) {
      target.set('other', r2((target.get('other') || 0) + Math.abs(cashDelta)))
      continue
    }
    for (const l of others) {
      const w = Math.abs((l.debit || 0) - (l.credit || 0)) / totalOther
      const amt = r2(Math.abs(cashDelta) * w)
      if (!amt) continue
      target.set(l.accountCode, r2((target.get(l.accountCode) || 0) + amt))
    }
  }

  const toRows = (m) => [...m.entries()]
    .map(([code, amount]) => ({
      code,
      name: code === 'other' ? '其他' : (acctByCode[code] ? acctByCode[code].name : code),
      amount,
      drill: code === 'other' ? null : { accountCode: code },
    }))
    .filter(x => x.amount)
    .sort((a, b) => String(a.code).localeCompare(String(b.code)))

  const inRows = toRows(inflows)
  const outRows = toRows(outflows)
  const totalIn = r2(inRows.reduce((s, x) => s + x.amount, 0))
  const totalOut = r2(outRows.reduce((s, x) => s + x.amount, 0))
  return { inflows: inRows, outflows: outRows, totalIn, totalOut, net: r2(totalIn - totalOut) }
}

// ── 期末現金餘額（供現金流量表勾稽）─────────────────────────
export function cashBalance(entries, acctByCode, { asOf } = {}) {
  let bal = 0
  for (const e of entries) {
    if (asOf && e.date > asOf) continue
    for (const l of e.lines) {
      if (acctByCode[l.accountCode]?.isCash) bal += (l.debit || 0) - (l.credit || 0)
    }
  }
  return r2(bal)
}
