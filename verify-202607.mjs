// 驗證：以前端分錄引擎推導全部單據，檢查平衡與 7 月月報表數字
import 'dotenv/config'
import mysql from 'mysql2/promise'
import { deriveAllEntries } from './client/src/accounting/deriveEntries.js'

const pool = mysql.createPool({
  host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER,
  password: process.env.DB_PASSWORD, database: process.env.DB_NAME, charset: 'utf8mb4',
})

const num = v => (v == null ? null : parseFloat(v))
const [finance] = await pool.query('SELECT * FROM finance')
const [receivables] = await pool.query('SELECT * FROM receivables')
const [accounts] = await pool.query('SELECT * FROM accounts')
const [obs] = await pool.query('SELECT * FROM opening_balances')
const [settingsRows] = await pool.query('SELECT * FROM app_settings')
await pool.end()

const settings = Object.fromEntries(settingsRows.map(r => [r.k, r.v]))
const fin = finance.map(f => ({ ...f, amount: num(f.amount) }))
const rcv = receivables.map(r => ({ ...r, amount: num(r.amount), paidAmount: num(r.paidAmount) }))
const ob = obs.map(o => ({ ...o, debit: num(o.debit), credit: num(o.credit) }))

const { entries, diagnostics } = deriveAllEntries({
  finance: fin, receivables: rcv, agencyCollections: [], manualJournals: [],
  openingBalances: ob, accounts, settings,
})

console.log(`分錄 ${entries.length} 張；診斷訊息 ${diagnostics.length} 則`)
for (const d of diagnostics) console.log(`  [${d.level}] ${d.message}`)

// 總試算平衡
let td = 0, tc = 0
for (const e of entries) for (const l of e.lines) { td += l.debit || 0; tc += l.credit || 0 }
console.log(`試算合計：借 ${td.toFixed(2)} / 貸 ${tc.toFixed(2)} ${Math.round(td * 100) === Math.round(tc * 100) ? '✓平衡' : '✗不平衡'}`)

const acctName = Object.fromEntries(accounts.map(a => [a.code, a.name]))
const inRange = (e, from, to) => e.date >= from && e.date <= to

function report(from, to, label) {
  const inc = new Map(), exp = new Map()
  for (const e of entries) {
    if (e.sourceType === 'closing' || !inRange(e, from, to)) continue
    for (const l of e.lines) {
      const a = accounts.find(x => x.code === l.accountCode)
      if (!a) continue
      if (a.type === 'income') inc.set(l.accountCode, (inc.get(l.accountCode) || 0) + (l.credit || 0) - (l.debit || 0))
      if (a.type === 'expense') exp.set(l.accountCode, (exp.get(l.accountCode) || 0) + (l.debit || 0) - (l.credit || 0))
    }
  }
  console.log(`\n── ${label}（${from} ~ ${to}）──`)
  let ti = 0, te = 0
  for (const [c, v] of [...inc].sort()) { if (v) { console.log(`  收入 ${c} ${acctName[c]}：${v.toLocaleString()}`); ti += v } }
  for (const [c, v] of [...exp].sort()) { if (v) { console.log(`  支出 ${c} ${acctName[c]}：${v.toLocaleString()}`); te += v } }
  console.log(`  收入合計 ${ti.toLocaleString()}／支出合計 ${te.toLocaleString()}／本期結餘 ${(ti - te).toLocaleString()}`)
}
report('2026-07-01', '2026-07-19', '7/1–7/19 實際單據期間')
report('2026-07-01', '2026-07-31', '7月全月（含月底權責轉列）')

// 資金/往來科目餘額（全期累計，至 7/31）
const balances = new Map()
for (const e of entries) {
  if (e.sourceType === 'closing' || e.date > '2026-07-31') continue
  for (const l of e.lines) {
    const key = `${l.accountCode}${l.person ? '|' + l.person : ''}`
    balances.set(key, (balances.get(key) || 0) + (l.debit || 0) - (l.credit || 0))
  }
}
console.log('\n── 主要科目餘額（借正/貸負，至 7/31 權責）──')
for (const [key, v] of [...balances].sort()) {
  const [code] = key.split('|')
  if (['1101', '1102', '1103', '1104', '1105', '1111', '1121', '2111', '2121', '2131', '2141'].includes(code) && Math.round(v * 100) !== 0) {
    if (code === '1111' || code === '1121') continue // 按人明細另計總額
    console.log(`  ${key} ${acctName[code] || ''}：${v.toLocaleString()}`)
  }
}
for (const code of ['1111', '1121']) {
  let sum = 0
  for (const [key, v] of balances) if (key.startsWith(code)) sum += v
  console.log(`  ${code} ${acctName[code]}（合計）：${Math.round(sum * 100) / 100}`)
}
