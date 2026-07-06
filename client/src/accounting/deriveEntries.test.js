import { describe, it, expect } from 'vitest'
import { deriveAllEntries, splitMonthly } from './deriveEntries.js'
import { balanceSheet, incomeStatement, cashFlow, cashBalance, trialBalance, ledgerFor } from './ledger.js'

// 最小科目表（與 db.js seed 對齊的必要科目）
const ACCOUNTS = [
  { code: '1101', name: '銀行存款-一銀', type: 'asset', isCash: 1, active: 1 },
  { code: '1111', name: '應收帳款', type: 'asset', requiresPerson: 1, active: 1 },
  { code: '1121', name: '經手人往來', type: 'asset', requiresPerson: 1, active: 1 },
  { code: '1131', name: '預付費用', type: 'asset', active: 1 },
  { code: '2111', name: '代收款', type: 'liability', requiresPerson: 1, active: 1 },
  { code: '2121', name: '預收社費', type: 'liability', active: 1 },
  { code: '2122', name: '其他預收收入', type: 'liability', active: 1 },
  { code: '2131', name: '暫收款(社友溢繳)', type: 'liability', requiresPerson: 1, active: 1 },
  { code: '3101', name: '累積餘絀', type: 'equity', active: 1 },
  { code: '4101', name: '社費收入', type: 'income', active: 1 },
  { code: '4103', name: '利息收入', type: 'income', active: 1 },
  { code: '4104', name: '其他收入', type: 'income', active: 1 },
  { code: '5301', name: '例會餐飲', type: 'expense', parentCode: '5300', active: 1 },
  { code: '5300', name: '社務活動費', type: 'expense', active: 1 },
  { code: '5900', name: '其他支出', type: 'expense', active: 1 },
]
const acctByCode = Object.fromEntries(ACCOUNTS.map(a => [a.code, a]))
const SETTINGS = { 'accounting.baseDate': '2026-06-30' }

const derive = (input) => deriveAllEntries({ accounts: ACCOUNTS, settings: SETTINGS, ...input })

function entryById(entries, id) {
  return entries.find(e => e.id === id)
}

function sumLines(entries, pred) {
  let s = 0
  for (const e of entries) for (const l of e.lines) if (pred(e, l)) s += (l.debit || 0) - (l.credit || 0)
  return Math.round(s * 100) / 100
}

describe('splitMonthly', () => {
  it('平均攤提且尾差併末月', () => {
    const parts = splitMonthly(1000, ['2026-07', '2026-08', '2026-09'])
    expect(parts.map(p => p.amount)).toEqual([333.33, 333.33, 333.34])
    expect(parts.reduce((s, p) => s + p.amount, 0)).toBeCloseTo(1000)
  })
})

describe('季度社費開單（權責認列）', () => {
  const receivable = {
    id: 1, sourceType: 'dues', sourceRef: '115年7-9月社費', memberName: '丁俊廷',
    amount: 18000, dueDate: '2026-07-01', dueYear: '2026', status: 'pending',
    accountCode: '4101', periodStart: '2026-07', periodEnd: '2026-09',
  }

  it('開單：借應收/貸預收；逐月轉列 6000（不論是否收款）', () => {
    const { entries, diagnostics } = derive({ receivables: [receivable] })
    expect(diagnostics.filter(d => d.level === 'error')).toEqual([])
    const bill = entryById(entries, 'rcv-1')
    expect(bill.lines).toContainEqual(expect.objectContaining({ accountCode: '1111', debit: 18000, person: '丁俊廷' }))
    expect(bill.lines).toContainEqual(expect.objectContaining({ accountCode: '2121', credit: 18000 }))
    // 7 月報表：社費收入 6000、預收餘額 12000
    const is7 = incomeStatement(entries, acctByCode, { from: '2026-07-01', to: '2026-07-31' })
    expect(is7.totalIncome).toBe(6000)
    const bs7 = balanceSheet(entries, acctByCode, { asOf: '2026-07-31' })
    expect(bs7.liabilities.find(x => x.code === '2121')?.amount).toBe(12000)
    expect(bs7.balanced).toBe(true)
    // 9 月底預收轉列完畢
    const bs9 = balanceSheet(entries, acctByCode, { asOf: '2026-09-30' })
    expect(bs9.liabilities.find(x => x.code === '2121')).toBeUndefined()
  })

  it('收款單（sourceReceivableId）只沖應收、不重複認列收入', () => {
    const collection = {
      id: 100, type: 'income', date: '2026-07-10', item: '115年7-9月社費',
      amount: 18000, member: '丁俊廷', account: '經手人:陳淑華', sourceReceivableId: 1,
    }
    const { entries } = derive({ receivables: [receivable], finance: [collection] })
    // 應收餘額歸零
    expect(sumLines(entries, (e, l) => l.accountCode === '1111')).toBe(0)
    // 經手人往來借餘 18000
    expect(sumLines(entries, (e, l) => l.accountCode === '1121' && l.person === '陳淑華')).toBe(18000)
    // 全年收入仍只有 18000
    const isFy = incomeStatement(entries, acctByCode, { from: '2026-07-01', to: '2027-06-30' })
    expect(isFy.totalIncome).toBe(18000)
  })

  it('部分收款兩次，各自沖應收', () => {
    const c1 = { id: 101, type: 'income', date: '2026-07-10', item: '收款1', amount: 10000, member: '丁俊廷', account: '一銀帳戶', sourceReceivableId: 1 }
    const c2 = { id: 102, type: 'income', date: '2026-08-10', item: '收款2', amount: 8000, member: '丁俊廷', account: '一銀帳戶', sourceReceivableId: 1 }
    const { entries } = derive({ receivables: [receivable], finance: [c1, c2] })
    expect(sumLines(entries, (e, l) => l.accountCode === '1111' && l.person === '丁俊廷')).toBe(0)
    expect(cashBalance(entries, acctByCode, {})).toBe(18000)
  })

  it('免繳不產生任何分錄', () => {
    const { entries } = derive({ receivables: [{ ...receivable, status: 'waived' }] })
    expect(entries.length).toBe(0)
  })
})

describe('溢收款', () => {
  it('正額掛暫收、負額沖回，人員明細正確', () => {
    const over = { id: 200, type: 'income', date: '2026-07-05', item: '溢收款', amount: 500, member: '王祈晴', account: '一銀帳戶', accountCode: '2131' }
    const offset = { id: 201, type: 'income', date: '2026-08-05', item: '溢收款', amount: -500, member: '王祈晴', account: '一銀帳戶', accountCode: '2131' }
    const { entries } = derive({ finance: [over, offset] })
    expect(sumLines(entries, (e, l) => l.accountCode === '2131' && l.person === '王祈晴')).toBe(0)
    expect(cashBalance(entries, acctByCode, {})).toBe(0)
  })
})

describe('經手人代墊與歸還', () => {
  it('代墊付款掛其他應付（貸餘）、歸還後歸零', () => {
    const exp = { id: 300, type: 'expense', date: '2026-07-08', item: '例會餐費', amount: 14000, account: '經手人:雷書維', accountCode: '5301' }
    const { entries } = derive({ finance: [exp] })
    const bs = balanceSheet(entries, acctByCode, { asOf: '2026-07-31' })
    expect(bs.liabilities.find(x => x.name === '其他應付款(經手人)')?.amount).toBe(14000)
    expect(bs.handlerDetail).toContainEqual({ person: '雷書維', amount: -14000 })

    const repay = { id: 301, type: 'transfer', date: '2026-07-20', item: '歸還代墊', amount: 14000, fromAccount: '一銀帳戶', toAccount: '經手人:雷書維' }
    const { entries: e2 } = derive({ finance: [exp, repay] })
    const bs2 = balanceSheet(e2, acctByCode, { asOf: '2026-07-31' })
    expect(bs2.liabilities.find(x => x.name === '其他應付款(經手人)')).toBeUndefined()
    expect(bs2.balanced).toBe(true)
  })

  it('同一人淨額歸邊：收款在手 > 代墊 → 其他應收款', () => {
    const inc = { id: 310, type: 'income', date: '2026-07-05', item: '紅箱', amount: 5000, account: '經手人:陳淑華', accountCode: '4104' }
    const exp = { id: 311, type: 'expense', date: '2026-07-06', item: '文具', amount: 2000, account: '經手人:陳淑華', accountCode: '5900' }
    const { entries } = derive({ finance: [inc, exp] })
    const bs = balanceSheet(entries, acctByCode, { asOf: '2026-07-31' })
    expect(bs.assets.find(x => x.name === '其他應收款(經手人)')?.amount).toBe(3000)
    expect(bs.liabilities.find(x => x.name === '其他應付款(經手人)')).toBeUndefined()
  })
})

describe('基準日切換', () => {
  it('基準日前單據不入帳；期初餘額＋基準日後收款沖期初應收', () => {
    const preDoc = { id: 400, type: 'income', date: '2026-03-01', item: '舊收入', amount: 9999, account: '一銀帳戶', accountCode: '4104' }
    const opening = [
      { accountCode: '1101', person: '', debit: 50000, credit: 0 },
      { accountCode: '1111', person: '莊村智', debit: 16500, credit: 0 },
      { accountCode: '2121', person: '', debit: 0, credit: 10000 },
    ]
    // 期初應收在基準日後收款（開單日在基準日前 → 不重複入帳）
    const oldRcv = {
      id: 401, sourceType: 'dues', sourceRef: '4-6月社費', memberName: '莊村智',
      amount: 16500, dueDate: '2026-04-01', dueYear: '2026', status: 'pending',
      accountCode: '4101', periodStart: '2026-04', periodEnd: '2026-06',
    }
    const collect = { id: 402, type: 'income', date: '2026-07-15', item: '4-6月社費', amount: 16500, member: '莊村智', account: '一銀帳戶', sourceReceivableId: 401 }
    const { entries, diagnostics } = derive({ finance: [preDoc, collect], receivables: [oldRcv], openingBalances: opening })
    expect(diagnostics.filter(d => d.level === 'error')).toEqual([])
    // 舊收入不出現
    expect(entries.find(e => e.id === 'fin-400')).toBeUndefined()
    // 開單分錄不出現（開單日 ≤ 基準日）、轉列分錄不出現（期間皆 ≤ 基準日）
    expect(entries.find(e => e.id === 'rcv-401')).toBeUndefined()
    expect(entries.filter(e => String(e.id).startsWith('rcv-401-rec'))).toEqual([])
    // 期初 66500 資產 − 10000 預收 = 56500 累積餘絀；收款後應收歸零、銀行 66500
    const bs = balanceSheet(entries, acctByCode, { asOf: '2026-07-31' })
    expect(bs.assets.find(x => x.code === '1111')).toBeUndefined()
    expect(bs.assets.find(x => x.code === '1101')?.amount).toBe(66500)
    expect(bs.equity.find(x => x.code === '3101')?.amount).toBe(56500)
    expect(bs.balanced).toBe(true)
  })
})

describe('年度結轉', () => {
  it('FY 結束後收入/費用轉入累積餘絀', () => {
    const inc = { id: 500, type: 'income', date: '2026-08-01', item: '利息', amount: 1000, account: '一銀帳戶', accountCode: '4103' }
    const exp = { id: 501, type: 'expense', date: '2026-09-01', item: '雜支', amount: 400, account: '一銀帳戶', accountCode: '5900' }
    const { entries } = derive({ finance: [inc, exp] })
    // FY2026 結轉分錄存在，日期 2027-06-30
    const closing = entries.find(e => e.sourceType === 'closing')
    expect(closing?.date).toBe('2027-06-30')
    // 結轉後（2027-07-01）：累積餘絀 600、本期餘絀無
    const bs = balanceSheet(entries, acctByCode, { asOf: '2027-07-01' })
    expect(bs.equity.find(x => x.code === '3101')?.amount).toBe(600)
    expect(bs.equity.find(x => x.code === 'current')).toBeUndefined()
    // 結轉前（2026-12-31）：本期餘絀 600
    const bsMid = balanceSheet(entries, acctByCode, { asOf: '2026-12-31' })
    expect(bsMid.equity.find(x => x.code === 'current')?.amount).toBe(600)
    // 期間損益不受結轉影響
    const isFy = incomeStatement(entries, acctByCode, { from: '2026-07-01', to: '2027-06-30' })
    expect(isFy.net).toBe(600)
  })
})

describe('代收代付', () => {
  const agencyRcv = {
    id: 600, sourceType: 'agency', sourceRef: '999', memberName: '林盟凱',
    amount: 3000, dueDate: '2026-07-05', dueYear: '2026', status: 'pending', accountCode: '2111',
  }
  const collections = [{ id: 999, title: '理事長賀禮', targetMembers: [], paidMembers: [] }]

  it('開單掛代收款（案名明細）；收款沖應收；付出沖代收款', () => {
    const collect = { id: 601, type: 'income', date: '2026-07-08', item: '理事長賀禮', amount: 3000, member: '林盟凱', account: '經手人:陳淑華', sourceReceivableId: 600 }
    const payout = { id: 602, type: 'expense', date: '2026-07-15', item: '理事長賀禮', amount: 3000, member: '理事長賀禮', account: '經手人:陳淑華', accountCode: '2111' }
    const { entries, diagnostics } = derive({ receivables: [agencyRcv], finance: [collect, payout], agencyCollections: collections })
    expect(diagnostics.filter(d => d.level === 'error')).toEqual([])
    // 代收款餘額歸零、應收歸零、經手人歸零、不影響損益
    expect(sumLines(entries, (e, l) => l.accountCode === '2111')).toBe(0)
    expect(sumLines(entries, (e, l) => l.accountCode === '1111')).toBe(0)
    expect(sumLines(entries, (e, l) => l.accountCode === '1121')).toBe(0)
    const is = incomeStatement(entries, acctByCode, { from: '2026-07-01', to: '2027-06-30' })
    expect(is.totalIncome).toBe(0)
    expect(is.totalExpense).toBe(0)
  })
})

describe('現金流量表', () => {
  it('直接法：淨變動＝現金餘額變動；分類到對方科目', () => {
    const docs = [
      { id: 700, type: 'income', date: '2026-07-05', item: '利息', amount: 380, account: '一銀帳戶', accountCode: '4103' },
      { id: 701, type: 'expense', date: '2026-07-10', item: '餐費', amount: 14000, account: '一銀帳戶', accountCode: '5301' },
      { id: 702, type: 'transfer', date: '2026-07-12', item: '存入', amount: 5000, fromAccount: '經手人:陳淑華', toAccount: '一銀帳戶' },
    ]
    const { entries } = derive({ finance: docs })
    const cf = cashFlow(entries, acctByCode, { from: '2026-07-01', to: '2026-07-31' })
    expect(cf.net).toBe(380 - 14000 + 5000)
    expect(cf.net).toBe(cashBalance(entries, acctByCode, { asOf: '2026-07-31' }))
    expect(cf.inflows.find(x => x.code === '4103')?.amount).toBe(380)
    expect(cf.inflows.find(x => x.code === '1121')?.amount).toBe(5000)
    expect(cf.outflows.find(x => x.code === '5301')?.amount).toBe(14000)
  })
})

describe('試算表與分類帳', () => {
  it('試算平衡；分類帳期初/流水/餘額正確', () => {
    const docs = [
      { id: 800, type: 'income', date: '2026-07-05', item: '紅箱', amount: 3000, account: '一銀帳戶', accountCode: '4104' },
      { id: 801, type: 'income', date: '2026-08-05', item: '紅箱', amount: 2000, account: '一銀帳戶', accountCode: '4104' },
    ]
    const { entries } = derive({ finance: docs })
    const tb = trialBalance(entries, acctByCode, { asOf: '2026-08-31' })
    expect(tb.balanced).toBe(true)
    const lg = ledgerFor(entries, acctByCode, { accountCode: '1101', from: '2026-08-01', to: '2026-08-31' })
    expect(lg.opening).toBe(3000)
    expect(lg.rows.length).toBe(1)
    expect(lg.closing).toBe(5000)
  })
})
