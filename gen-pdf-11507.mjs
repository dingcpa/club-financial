// 一次性：產出 115年7月 理監事會財務報表 PDF（月報表＋BS 同頁、附表緊湊排版）
import 'dotenv/config'
import fs from 'fs'
import { execFileSync } from 'child_process'
import mysql from 'mysql2/promise'
import { deriveAllEntries } from './client/src/accounting/deriveEntries.js'
import { balanceSheet } from './client/src/accounting/ledger.js'
import { reportItemLabel, CODES } from './client/src/accounting/coa.js'

const YM = '2026-07', FROM = '2026-07-01', TO = '2026-07-31', YEAR = '2026'
const r2 = n => Math.round(n * 100) / 100
const fmt = n => Number(n || 0).toLocaleString('en-US')

const pool = mysql.createPool({
  host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4',
})
const num = v => (v == null ? null : parseFloat(v))
const [finance] = await pool.query('SELECT * FROM finance')
const [receivables] = await pool.query('SELECT * FROM receivables')
const [payables] = await pool.query('SELECT * FROM payables')
const [accounts] = await pool.query('SELECT * FROM accounts')
const [obs] = await pool.query('SELECT * FROM opening_balances')
const [st] = await pool.query('SELECT * FROM app_settings')
const [duesSettings] = await pool.query('SELECT * FROM dues_settings')
await pool.end()

const fin = finance.map(f => ({ ...f, amount: num(f.amount) }))
const rcv = receivables.map(r => ({ ...r, amount: num(r.amount), paidAmount: num(r.paidAmount) }))
const pay = payables.map(p => ({ ...p, amount: num(p.amount), paidAmount: num(p.paidAmount) }))
const { entries } = deriveAllEntries({
  finance: fin, receivables: rcv, payables: pay,
  openingBalances: obs.map(o => ({ ...o, debit: num(o.debit), credit: num(o.credit) })),
  accounts, settings: Object.fromEntries(st.map(r => [r.k, r.v])),
  agencyCollections: [], manualJournals: [],
})
const acctByCode = Object.fromEntries(accounts.map(a => [a.code, a]))
const acctName = c => acctByCode[c] ? acctByCode[c].name : c

// ── 月報表（7月，項目合併顯示）──
const recordsById = new Map(fin.map(f => [f.id, f]))
const rcvById = new Map(rcv.map(r => [r.id, r]))
function entryItemLabel(e) {
  const id = String(e.id)
  if (id.startsWith('fin-')) return recordsById.get(e.sourceId)?.item || e.description
  if (id.startsWith('rcv-')) return rcvById.get(e.sourceId)?.sourceRef || e.description
  return e.description
}
const byAccount = new Map(), incomeItems = new Map()
let prevCum = 0
for (const e of entries) {
  if (e.sourceType === 'closing') continue
  for (const l of e.lines) {
    const a = acctByCode[l.accountCode]
    if (!a) continue
    if (a.type === 'equity') { if (e.date < FROM) prevCum += (l.credit || 0) - (l.debit || 0); continue }
    if (a.type !== 'income' && a.type !== 'expense') continue
    const amt = a.type === 'income' ? (l.credit || 0) - (l.debit || 0) : (l.debit || 0) - (l.credit || 0)
    if (e.date >= FROM && e.date <= TO) {
      byAccount.set(l.accountCode, r2((byAccount.get(l.accountCode) || 0) + amt))
      if (a.type === 'income') {
        if (!incomeItems.has(l.accountCode)) incomeItems.set(l.accountCode, new Map())
        const m = incomeItems.get(l.accountCode)
        const label = reportItemLabel(entryItemLabel(e))
        m.set(label, r2((m.get(label) || 0) + amt))
      }
    } else if (e.date < FROM) {
      prevCum += a.type === 'income' ? amt : -amt
    }
  }
}
prevCum = r2(prevCum)
const incomeSections = accounts.filter(a => a.type === 'income' && a.active && byAccount.get(a.code))
  .sort((a, b) => a.code.localeCompare(b.code))
  .map(a => ({
    name: `${a.code} ${a.name}`, amount: byAccount.get(a.code),
    items: [...(incomeItems.get(a.code) || new Map())].filter(([, v]) => v).map(([label, v]) => ({ label, v })),
  }))
const expParents = accounts.filter(a => a.type === 'expense' && !a.parentCode).sort((a, b) => a.code.localeCompare(b.code))
const expenseGroups = expParents.map(p => {
  const children = accounts.filter(a => a.parentCode === p.code)
  const items = (children.length ? children : [p]).map(a => ({ label: `${a.code} ${a.name}`, v: byAccount.get(a.code) || 0 })).filter(x => x.v)
  return { name: `${p.code} ${p.name}`, amount: r2(items.reduce((s, x) => s + x.v, 0)), items }
}).filter(g => g.amount)
const totalIncome = r2(incomeSections.reduce((s, x) => s + x.amount, 0))
const totalExpense = r2(expenseGroups.reduce((s, x) => s + x.amount, 0))
const net = r2(totalIncome - totalExpense)
const cumNet = r2(net + prevCum)

// ── BS ──
const bs = balanceSheet(entries, acctByCode, { asOf: TO })

// ── 附表一 應收統計 ──
const paidOf = r => r.status === 'paid' ? (r.paidAmount != null ? r.paidAmount : r.amount) : (r.status === 'partial' ? (r.paidAmount || 0) : 0)
function natureOf(r) {
  if (r.sourceType === 'agency' || r.accountCode === CODES.AGENCY) return '代收'
  if (r.accountCode === '4101' || r.accountCode === '4106') return '社費'
  if (r.accountCode === '4102') return '紅箱'
  if ((r.accountCode || '').startsWith('5')) return '補助'
  return '其他'
}
function statGroups(rows, groupKeyFn, itemKeyFn) {
  const byG = new Map()
  for (const row of rows) {
    const gk = groupKeyFn(row)
    if (!byG.has(gk)) byG.set(gk, new Map())
    const items = byG.get(gk)
    const ik = itemKeyFn(row)
    if (!items.has(ik.key)) items.set(ik.key, { ...ik, count: 0, target: 0, paid: 0, waived: 0 })
    const g = items.get(ik.key)
    g.count++
    if (row.status === 'waived') g.waived += row.amount
    else { g.target += row.amount; g.paid += paidOf(row) }
  }
  return byG
}
const arByNature = statGroups(rcv.filter(r => String(r.dueYear) === YEAR), natureOf, r => ({ key: r.sourceRef, label: r.sourceRef }))
const AR_ORDER = ['社費', '紅箱', '代收', '補助', '其他']
const arGroups = AR_ORDER.filter(n => arByNature.has(n)).map(n => {
  const items = [...arByNature.get(n).values()].map(g => ({ ...g, target: r2(g.target), paid: r2(g.paid), unpaid: r2(g.target - g.paid), waived: r2(g.waived) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'))
  const sum = f => r2(items.reduce((s, g) => s + g[f], 0))
  return { name: n, items, count: items.reduce((s, g) => s + g.count, 0), target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived') }
})
const arTotal = { count: arGroups.reduce((s, g) => s + g.count, 0), target: r2(arGroups.reduce((s, g) => s + g.target, 0)), paid: r2(arGroups.reduce((s, g) => s + g.paid, 0)), unpaid: r2(arGroups.reduce((s, g) => s + g.unpaid, 0)), waived: r2(arGroups.reduce((s, g) => s + g.waived, 0)) }

// ── 附表二 應付統計 ──
const apByCode = statGroups(pay.filter(p => String(p.dueYear) === YEAR), p => p.accountCode || '—', p => ({ key: `${p.sourceRef}|${p.payee}`, label: p.sourceRef, payee: p.payee }))
const apGroups = [...apByCode.keys()].sort().map(code => {
  const items = [...apByCode.get(code).values()].map(g => ({ ...g, target: r2(g.target), paid: r2(g.paid), unpaid: r2(g.target - g.paid), waived: r2(g.waived) }))
  const sum = f => r2(items.reduce((s, g) => s + g[f], 0))
  return { name: `${code} ${acctName(code)}`, items, count: items.reduce((s, g) => s + g.count, 0), target: sum('target'), paid: sum('paid'), unpaid: sum('unpaid'), waived: sum('waived') }
})
const apTotal = { count: apGroups.reduce((s, g) => s + g.count, 0), target: r2(apGroups.reduce((s, g) => s + g.target, 0)), paid: r2(apGroups.reduce((s, g) => s + g.paid, 0)), unpaid: r2(apGroups.reduce((s, g) => s + g.unpaid, 0)), waived: r2(apGroups.reduce((s, g) => s + g.waived, 0)) }

// ── 附表三 預收（按對象；期初＋新增－轉列＝期末）──
function prepaidSection(code) {
  const map = new Map()
  for (const e of entries) {
    if (e.sourceType === 'closing' || e.date > TO) continue
    for (const l of e.lines) {
      if (l.accountCode !== code) continue
      const person = l.person || '未指定'
      if (!map.has(person)) map.set(person, { person, opening: 0, added: 0, recognized: 0 })
      const g = map.get(person)
      if (e.date < FROM) g.opening += (l.credit || 0) - (l.debit || 0)
      else { g.added += l.credit || 0; g.recognized += l.debit || 0 }
    }
  }
  const rows = [...map.values()].map(g => ({ ...g, opening: r2(g.opening), added: r2(g.added), recognized: r2(g.recognized), closing: r2(g.opening + g.added - g.recognized) }))
    .filter(g => g.opening || g.added || g.recognized)
    .sort((a, b) => a.person.localeCompare(b.person, 'zh-Hant'))
  const t = f => r2(rows.reduce((s, g) => s + g[f], 0))
  return { code, name: acctName(code), rows, totals: { opening: t('opening'), added: t('added'), recognized: t('recognized'), closing: t('closing') } }
}
const prepaidSecs = [prepaidSection(CODES.UNEARNED_DUES), prepaidSection(CODES.UNEARNED_OTHER)].filter(s => s.rows.length)

// ── 附表四 代收付 ──
const agMap = new Map()
for (const e of entries) {
  if (e.sourceType === 'closing' || e.date > TO) continue
  for (const l of e.lines) {
    if (l.accountCode !== CODES.AGENCY) continue
    const person = l.person || '未指定'
    if (!agMap.has(person)) agMap.set(person, { person, credit: 0, debit: 0 })
    const g = agMap.get(person)
    g.credit += l.credit || 0; g.debit += l.debit || 0
  }
}
const agRows = [...agMap.values()].map(g => ({ ...g, credit: r2(g.credit), debit: r2(g.debit), balance: r2(g.credit - g.debit) }))
  .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
const agTotal = { credit: r2(agRows.reduce((s, g) => s + g.credit, 0)), debit: r2(agRows.reduce((s, g) => s + g.debit, 0)), balance: r2(agRows.reduce((s, g) => s + g.balance, 0)) }

// ── HTML ──
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const statTable = (groups, total, hasPayee) => `
<table>
<thead><tr><th>項目</th>${hasPayee ? '<th style="width:9%">對象</th>' : ''}<th class="n" style="width:6%">筆數</th><th class="n" style="width:12%">${hasPayee ? '應付' : '應收'}</th><th class="n" style="width:12%">已${hasPayee ? '付' : '收'}</th><th class="n" style="width:12%">未${hasPayee ? '付' : '收'}</th><th class="n" style="width:10%">免${hasPayee ? '付' : '繳'}</th></tr></thead>
<tbody>
${groups.map(g => `
<tr class="g"><td${hasPayee ? ' colspan="2"' : ''}>${esc(g.name)}</td><td class="n">${g.count}</td><td class="n">${fmt(g.target)}</td><td class="n">${fmt(g.paid)}</td><td class="n">${fmt(g.unpaid)}</td><td class="n">${g.waived ? fmt(g.waived) : '—'}</td></tr>
${g.items.map(it => `<tr><td class="i">${esc(it.label)}</td>${hasPayee ? `<td>${esc(it.payee || '')}</td>` : ''}<td class="n">${it.count}</td><td class="n">${fmt(it.target)}</td><td class="n">${fmt(it.paid)}</td><td class="n">${fmt(it.unpaid)}</td><td class="n">${it.waived ? fmt(it.waived) : '—'}</td></tr>`).join('')}
`).join('')}
<tr class="t"><td${hasPayee ? ' colspan="2"' : ''}>合計</td><td class="n">${total.count}</td><td class="n">${fmt(total.target)}</td><td class="n">${fmt(total.paid)}</td><td class="n">${fmt(total.unpaid)}</td><td class="n">${total.waived ? fmt(total.waived) : '—'}</td></tr>
</tbody></table>`

const prepaidCols = (sec) => {
  const half = Math.ceil(sec.rows.length / 2)
  const col = rows => `<table><thead><tr><th>對象</th><th class="n">期初</th><th class="n">新增</th><th class="n">轉列</th><th class="n">期末</th></tr></thead><tbody>
${rows.map(g => `<tr><td>${esc(g.person)}</td><td class="n">${fmt(g.opening)}</td><td class="n">${fmt(g.added)}</td><td class="n">${fmt(g.recognized)}</td><td class="n">${fmt(g.closing)}</td></tr>`).join('')}</tbody></table>`
  return `<div class="cols"><div>${col(sec.rows.slice(0, half))}</div><div>${col(sec.rows.slice(half))}
<table><tbody><tr class="t"><td>合計</td><td class="n">${fmt(sec.totals.opening)}</td><td class="n">${fmt(sec.totals.added)}</td><td class="n">${fmt(sec.totals.recognized)}</td><td class="n">${fmt(sec.totals.closing)}</td></tr></tbody></table></div></div>`
}

const html = `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><title>理監事會財務報表 115年7月</title>
<style>
@page { size: A4; margin: 9mm 10mm; }
* { box-sizing: border-box; }
body { font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; font-size: 9.5px; color: #000; line-height: 1.45; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.org { font-size: 10.5px; font-weight: bold; }
h1 { font-size: 15px; text-align: center; margin: 2px 0; }
.meta { font-size: 8.5px; color: #333; text-align: center; margin-bottom: 6px; }
h2 { font-size: 11px; margin: 6px 0 3px; border-left: 4px solid #4f46e5; padding-left: 6px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 5px; }
th, td { border: 1px solid #999; padding: 1px 5px; font-size: 9px; }
th { background: #eee; text-align: left; }
td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
td.i { padding-left: 16px; }
tr.g td { background: #f3f4f6; font-weight: bold; }
tr.t td { background: #fafafa; font-weight: bold; }
.cols { display: flex; gap: 8px; align-items: flex-start; }
.cols > div { flex: 1 1 0; min-width: 0; }
.cards { display: flex; gap: 8px; margin: 4px 0 6px; }
.card { flex: 1; border: 1px solid #bbb; border-left: 4px solid #1d4ed8; border-radius: 3px; padding: 3px 8px; }
.card .lb { font-size: 8px; color: #444; }
.card .amt { font-size: 12.5px; font-weight: bold; }
.grn { color: #15803d; } .red { color: #b91c1c; } .blu { color: #1d4ed8; }
.pb { page-break-before: always; }
.foot { font-size: 8px; color: #444; margin-top: 2px; }
.sign { display: flex; justify-content: space-between; margin-top: 14px; font-size: 10px; }
</style></head><body>

<div class="org">嘉義中區扶輪社 Rotary Club of Chiayi Central ・ 國際扶輪 3470 地區</div>
<h1>收支月報表暨資產負債表</h1>
<div class="meta">報表期間 民國 115 年 7 月（收支）／基準日 115-07-31（資產負債）　・　幣別：新臺幣 NT$　・　權責發生制　・　製表日 115-07-22</div>

<h2>收支月報表</h2>
<div class="cols">
<div>
<table><thead><tr><th>收入項目</th><th class="n" style="width:28%">月計</th></tr></thead><tbody>
${incomeSections.map(s => `<tr class="g"><td>${esc(s.name)}</td><td class="n">${fmt(s.amount)}</td></tr>
${s.items.map(it => `<tr><td class="i">${esc(it.label)}</td><td class="n">${fmt(it.v)}</td></tr>`).join('')}`).join('')}
<tr class="t"><td>收入合計</td><td class="n">${fmt(totalIncome)}</td></tr>
</tbody></table>
</div>
<div>
<table><thead><tr><th>支出項目</th><th class="n" style="width:28%">月計</th></tr></thead><tbody>
${expenseGroups.map(g => `<tr class="g"><td>${esc(g.name)}</td><td class="n">${fmt(g.amount)}</td></tr>
${g.items.map(it => `<tr><td class="i">${esc(it.label)}</td><td class="n">${fmt(it.v)}</td></tr>`).join('')}`).join('')}
<tr class="t"><td>支出合計</td><td class="n">${fmt(totalExpense)}</td></tr>
</tbody></table>
</div>
</div>
<div class="cards">
<div class="card" style="border-left-color:#15803d"><div class="lb">本月合計收入</div><div class="amt grn">NT$ ${fmt(totalIncome)}</div></div>
<div class="card" style="border-left-color:#b91c1c"><div class="lb">－ 本月合計支出</div><div class="amt red">NT$ ${fmt(totalExpense)}</div></div>
<div class="card"><div class="lb">＝ 本月結餘</div><div class="amt ${net >= 0 ? 'grn' : 'red'}">NT$ ${fmt(net)}</div></div>
<div class="card"><div class="lb">＋ 上期結餘（期初權益）</div><div class="amt">NT$ ${fmt(prevCum)}</div></div>
<div class="card"><div class="lb">＝ 累計結餘（＝BS 權益合計）</div><div class="amt blu">NT$ ${fmt(cumNet)}</div></div>
</div>

<h2>資產負債表（115-07-31）</h2>
<div class="cols">
<div>
<table><thead><tr><th>資產</th><th class="n" style="width:28%">金額</th></tr></thead><tbody>
${bs.assets.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${fmt(x.amount)}</td></tr>`).join('')}
<tr class="t"><td>資產合計</td><td class="n">${fmt(bs.totalAssets)}</td></tr>
</tbody></table>
</div>
<div>
<table><thead><tr><th>負債</th><th class="n" style="width:28%">金額</th></tr></thead><tbody>
${bs.liabilities.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${fmt(x.amount)}</td></tr>`).join('')}
<tr class="t"><td>負債合計</td><td class="n">${fmt(bs.totalLiabilities)}</td></tr>
</tbody></table>
<table><thead><tr><th>權益</th><th class="n" style="width:28%">金額</th></tr></thead><tbody>
${bs.equity.map(x => `<tr><td>${esc(x.name)}</td><td class="n">${fmt(x.amount)}</td></tr>`).join('')}
<tr class="t"><td>權益合計</td><td class="n">${fmt(bs.totalEquity)}</td></tr>
<tr class="t"><td>負債及權益合計</td><td class="n">${fmt(r2(bs.totalLiabilities + bs.totalEquity))}</td></tr>
</tbody></table>
</div>
</div>
<div class="foot">認列原則：權責發生制；季繳社費開單掛預收、逐月轉列，應付款於立帳日認列費用。累計結餘＝資產負債表累積餘絀＋本期餘絀。</div>
<div class="sign"><span>製表：＿＿＿＿＿＿＿＿</span><span>財務：＿＿＿＿＿＿＿＿</span><span>社長：＿＿＿＿＿＿＿＿</span></div>

<div class="pb"></div>
<div class="org">嘉義中區扶輪社 ・ 民國 115 年度 理監事會財務報表附表　（製表日 115-07-22）</div>
<h2>附表一　應收明細表（項目統計）</h2>
${statTable(arGroups, arTotal, false)}
<div class="foot">負數項目為補助抵減（借費用／貸應收）。</div>
<h2>附表二　應付明細表（項目統計）</h2>
${apGroups.length ? statTable(apGroups, apTotal, true) : '<div class="foot">（本年度無應付帳款）</div>'}
<h2>附表四　代收付明細表（代收款 2111 按案名，至 115-07-31）</h2>
<table><thead><tr><th>案名</th><th class="n" style="width:20%">開單/收現（貸）</th><th class="n" style="width:20%">付出（借）</th><th class="n" style="width:20%">餘額</th></tr></thead><tbody>
${agRows.map(g => `<tr><td>${esc(g.person)}</td><td class="n">${fmt(g.credit)}</td><td class="n">${fmt(g.debit)}</td><td class="n">${fmt(g.balance)}</td></tr>`).join('')}
<tr class="t"><td>合計（＝資產負債表代收款餘額）</td><td class="n">${fmt(agTotal.credit)}</td><td class="n">${fmt(agTotal.debit)}</td><td class="n">${fmt(agTotal.balance)}</td></tr>
</tbody></table>

${prepaidSecs.map(sec => `
<h2>附表三　預收明細表：${sec.code} ${esc(sec.name)}（期初＋新增－轉列＝期末，至 115-07-31）</h2>
${prepaidCols(sec)}
`).join('')}
<div class="foot">附表三期末合計與資產負債表 ${prepaidSecs.map(s => s.name).join('、')} 餘額一致。</div>

</body></html>`

fs.writeFileSync('backup/report-11507.html', html, 'utf8')
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const out = 'C:/Code/club-financial/理監事會財務報表-11507.pdf'
execFileSync(EDGE, [
  '--headless', '--disable-gpu', '--no-first-run',
  `--print-to-pdf=${out}`, '--print-to-pdf-no-header',
  'file:///C:/Code/club-financial/backup/report-11507.html',
], { timeout: 60000 })
console.log('PDF 已產出：', out)
console.log(`月報：收入 ${fmt(totalIncome)}／支出 ${fmt(totalExpense)}／本月結餘 ${fmt(net)}／上期 ${fmt(prevCum)}／累計 ${fmt(cumNet)}`)
console.log(`BS：資產 ${fmt(bs.totalAssets)}＝負債 ${fmt(bs.totalLiabilities)}＋權益 ${fmt(bs.totalEquity)}`)
