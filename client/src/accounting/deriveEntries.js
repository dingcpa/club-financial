// 分錄推導引擎（純函數）：把單據（finance/receivables/…）推導為借貸分錄
//
// 設計原則（與 CPA 使用者確認）：
// - 單據為唯一真實資料，分錄即時推算、不落地
// - 只處理基準日（baseDate）之後的單據；之前的歷史濃縮於期初餘額
// - 收入認列採權責基礎：開單掛應收/預收，逐月轉列收入，收款只沖應收
import { CODES, resolveFundAccount, resolveRecordAccount } from './coa.js'
import { fyOf, monthEnd, monthsBetween } from './fiscal.js'

// 每月攤提金額（尾差併末月）
export function splitMonthly(amount, months) {
  const n = months.length
  if (!n) return []
  const per = Math.round((amount / n) * 100) / 100
  return months.map((ym, i) => ({
    month: ym,
    amount: i === n - 1 ? Math.round((amount - per * (n - 1)) * 100) / 100 : per,
  }))
}

function line(accountCode, { debit = 0, credit = 0, person = '', projectId = null } = {}) {
  return { accountCode, person, projectId, debit, credit }
}

// 借/貸一對線（金額為負時自動反向）
function pair(debitCode, creditCode, amount, opts = {}) {
  const { debitPerson = '', creditPerson = '', projectId = null } = opts
  if (amount < 0) {
    return [
      line(creditCode, { debit: -amount, person: creditPerson, projectId }),
      line(debitCode, { credit: -amount, person: debitPerson, projectId }),
    ]
  }
  return [
    line(debitCode, { debit: amount, person: debitPerson, projectId }),
    line(creditCode, { credit: amount, person: creditPerson, projectId }),
  ]
}

export function deriveAllEntries({
  finance = [],
  receivables = [],
  agencyCollections = [],
  manualJournals = [],
  openingBalances = [],
  accounts = [],
  settings = {},
} = {}) {
  const baseDate = settings['accounting.baseDate'] || '2026-06-30'
  const entries = []
  const diagnostics = []
  const acctByCode = Object.fromEntries((accounts || []).map(a => [a.code, a]))
  const collectionById = Object.fromEntries((agencyCollections || []).map(c => [String(c.id), c]))

  const afterBase = (d) => d && d > baseDate

  function push(entry) {
    const debit = entry.lines.reduce((s, l) => s + (l.debit || 0), 0)
    const credit = entry.lines.reduce((s, l) => s + (l.credit || 0), 0)
    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
      diagnostics.push({ level: 'error', entryId: entry.id, message: `分錄不平衡（借 ${debit} / 貸 ${credit}）：${entry.description}` })
    }
    for (const l of entry.lines) {
      if (!acctByCode[l.accountCode]) {
        diagnostics.push({ level: 'error', entryId: entry.id, message: `科目 ${l.accountCode} 不存在：${entry.description}` })
      }
    }
    entries.push(entry)
  }

  function fundOf(str, ctx) {
    const f = resolveFundAccount(str)
    if (f) return f
    // 動態銀行科目：資金字串＝isCash 科目名稱（如 '銀行存款-定存'）
    const s = (str || '').trim()
    const byName = (accounts || []).find(a => a.isCash && a.name === s)
    if (byName) return { code: byName.code, person: '' }
    diagnostics.push({ level: 'warn', message: `無法辨識資金帳戶「${str}」（${ctx}），以經手人:陳淑華處理` })
    return { code: CODES.HANDLER, person: '陳淑華' }
  }

  // ── 1. 期初餘額（基準日一張傳票，差額軋入累積餘絀）─────────
  if (openingBalances.length) {
    const lines = openingBalances.map(r =>
      line(r.accountCode, { debit: r.debit || 0, credit: r.credit || 0, person: r.person || '' })
    )
    const debit = lines.reduce((s, l) => s + l.debit, 0)
    const credit = lines.reduce((s, l) => s + l.credit, 0)
    const diff = Math.round((debit - credit) * 100) / 100
    if (diff > 0) lines.push(line(CODES.RETAINED, { credit: diff }))
    else if (diff < 0) lines.push(line(CODES.RETAINED, { debit: -diff }))
    push({
      id: 'opening',
      date: baseDate,
      sourceType: 'opening',
      sourceId: null,
      description: `期初餘額（基準日 ${baseDate}）`,
      lines,
    })
  }

  // ── 2/3/10. 應收帳款：開單 ＋ 預收逐月轉列 ──────────────────
  for (const r of receivables) {
    if (r.status === 'waived') continue // 免繳視同作廢開單
    // 基準日前已收訖者，整個生命週期屬歷史（現金已於基準日前入帳），不再產生任何分錄
    if (r.status === 'paid' && r.paidDate && r.paidDate <= baseDate) continue
    const billDate = r.dueDate || (r.createdAt ? String(r.createdAt).slice(0, 10) : null)
    const code = r.accountCode || null
    const isAgency = r.sourceType === 'agency'
    const collection = isAgency ? collectionById[String(r.sourceRef)] : null
    const agencyTitle = collection ? collection.title : r.sourceRef
    const amount = r.amount || 0

    // 開單分錄（基準日後開的單才入帳；之前的在期初 1111/2121 餘額中）
    // 對象（person）一律帶在分錄行上：社友名或代收案名，供分類帳/日記帳對象欄與篩選
    // 負數帳款（如補助抵減）由 pair() 自動轉正向：借費用科目／貸應收帳款-社友
    if (afterBase(billDate)) {
      let creditCode, creditPerson
      if (isAgency || code === CODES.AGENCY) {
        creditCode = CODES.AGENCY; creditPerson = agencyTitle
      } else if (r.periodStart && r.periodEnd && code && code.startsWith('4')) {
        creditCode = CODES.UNEARNED_DUES; creditPerson = r.memberName
      } else if (code) {
        creditCode = code; creditPerson = r.memberName
      } else {
        diagnostics.push({ level: 'warn', message: `應收帳款「${r.sourceRef}/${r.memberName}」未設科目，暫以其他收入認列` })
        creditCode = '4104'; creditPerson = r.memberName
      }
      push({
        id: `rcv-${r.id}`,
        date: billDate,
        sourceType: 'receivable',
        sourceId: r.id,
        description: `${amount < 0 ? '沖減應收' : '開立帳款'}：${r.sourceRef}`,
        lines: pair(CODES.RECEIVABLE, creditCode, amount, { debitPerson: r.memberName, creditPerson, projectId: r.projectId || null }),
      })
    }

    // 預收社費逐月轉列（權責：不論是否已收款；只轉基準日後的月份）
    if (!isAgency && r.periodStart && r.periodEnd && code && code.startsWith('4')) {
      const months = monthsBetween(r.periodStart, r.periodEnd)
      for (const { month, amount: m } of splitMonthly(amount, months)) {
        const d = monthEnd(month)
        if (!afterBase(d)) continue
        push({
          id: `rcv-${r.id}-rec-${month}`,
          date: d,
          sourceType: 'recognition',
          sourceId: r.id,
          description: `預收轉列：${r.sourceRef} ${month}`,
          lines: pair(CODES.UNEARNED_DUES, code, m, { debitPerson: r.memberName, creditPerson: r.memberName, projectId: r.projectId || null }),
        })
      }
    }

    // 舊制收款（沒有對應 finance 收款列）的診斷：paid/partial 而查無 finance 列者由呼叫端比對
  }

  // ── 4/6/7/8/9/11/12. finance 單據 ──────────────────────────
  for (const f of finance) {
    // 發生日期（權責歸屬）：收入/支出單可另填 occurredDate；收款單與轉帳單
    // 屬資金移動，一律以單據日期入帳
    const effDate = (f.type === 'income' || f.type === 'expense') && !f.sourceReceivableId && f.occurredDate
      ? f.occurredDate : f.date
    if (!afterBase(effDate)) continue
    const amount = f.amount || 0
    const projectId = f.projectId || null

    if (f.type === 'transfer') {
      const from = fundOf(f.fromAccount, `調撥單 ${f.date}`)
      const to = fundOf(f.toAccount, `調撥單 ${f.date}`)
      push({
        id: `fin-${f.id}`,
        date: f.date,
        sourceType: 'transfer',
        sourceId: f.id,
        description: f.item || '內部轉帳',
        lines: pair(to.code, from.code, amount, { debitPerson: to.person, creditPerson: from.person }),
      })
      continue
    }

    const fund = fundOf(f.account, `${f.item} ${f.date}`)
    const code = resolveRecordAccount(f)

    if (f.type === 'income') {
      // 收款單：沖應收（不認列收入）；負數＝抵減額沖抵（如補助自本次繳費扣抵）
      if (f.sourceReceivableId) {
        push({
          id: `fin-${f.id}`,
          date: f.date,
          sourceType: 'collection',
          sourceId: f.id,
          description: `${amount < 0 ? '收款沖抵' : '收款'}：${f.item}`,
          lines: pair(fund.code, CODES.RECEIVABLE, amount, { debitPerson: fund.person, creditPerson: f.member || '', projectId }),
        })
        continue
      }
      // 溢收款／暫收款（正：收現掛暫收；負：沖抵前期溢收）
      if (code === CODES.TEMP_RECEIPT) {
        push({
          id: `fin-${f.id}`,
          date: f.date,
          sourceType: 'overpayment',
          sourceId: f.id,
          description: f.item,
          lines: pair(fund.code, CODES.TEMP_RECEIPT, amount, { debitPerson: fund.person, creditPerson: f.member || '' }),
        })
        continue
      }
      // 直接代收（未開帳款的代收款收現）
      if (code === CODES.AGENCY) {
        push({
          id: `fin-${f.id}`,
          date: f.date,
          sourceType: 'income',
          sourceId: f.id,
          description: `代收：${f.item}`,
          lines: pair(fund.code, CODES.AGENCY, amount, { debitPerson: fund.person, creditPerson: f.item }),
        })
        continue
      }
      const incomeCode = code && code.startsWith('4') ? code : null
      if (!incomeCode) {
        diagnostics.push({ level: 'warn', message: `收款單「${f.item}」（${f.date}）未設科目，暫列其他收入` })
      }
      const useCode = incomeCode || '4104'
      // 預收性質：先掛其他預收收入，期間內逐月轉列
      if (f.startPeriod && f.endPeriod) {
        push({
          id: `fin-${f.id}`,
          date: effDate,
          sourceType: 'income',
          sourceId: f.id,
          description: `預收收入：${f.item}`,
          lines: pair(fund.code, CODES.UNEARNED_OTHER, amount, { debitPerson: fund.person, creditPerson: f.member || '', projectId }),
        })
        const months = monthsBetween(f.startPeriod, f.endPeriod)
        for (const { month, amount: m } of splitMonthly(amount, months)) {
          const d = monthEnd(month)
          if (!afterBase(d)) continue
          push({
            id: `fin-${f.id}-rec-${month}`,
            date: d,
            sourceType: 'recognition',
            sourceId: f.id,
            description: `預收轉列：${f.item} ${month}`,
            lines: pair(CODES.UNEARNED_OTHER, useCode, m, { debitPerson: f.member || '', creditPerson: f.member || '', projectId }),
          })
        }
      } else {
        push({
          id: `fin-${f.id}`,
          date: effDate,
          sourceType: 'income',
          sourceId: f.id,
          description: `收入：${f.item}`,
          lines: pair(fund.code, useCode, amount, { debitPerson: fund.person, creditPerson: f.member || '', projectId }),
        })
      }
      continue
    }

    if (f.type === 'expense') {
      // 代收款付出／轉繳
      if (code === CODES.AGENCY) {
        push({
          id: `fin-${f.id}`,
          date: f.date,
          sourceType: 'agency-payout',
          sourceId: f.id,
          description: `代收款付出：${f.item}`,
          lines: pair(CODES.AGENCY, fund.code, amount, { debitPerson: f.member || f.item, creditPerson: fund.person, projectId }),
        })
        continue
      }
      const expenseCode = code && code.startsWith('5') ? code : null
      if (!expenseCode) {
        diagnostics.push({ level: 'warn', message: `付款單「${f.item}」（${f.date}）未設科目，暫列其他支出` })
      }
      const useCode = expenseCode || '5900'
      // 預付性質：先掛預付費用，期間內逐月攤銷
      if (f.startPeriod && f.endPeriod) {
        push({
          id: `fin-${f.id}`,
          date: effDate,
          sourceType: 'expense',
          sourceId: f.id,
          description: `預付費用：${f.item}`,
          lines: pair(CODES.PREPAID_EXPENSE, fund.code, amount, { debitPerson: f.member || '', creditPerson: fund.person, projectId }),
        })
        const months = monthsBetween(f.startPeriod, f.endPeriod)
        for (const { month, amount: m } of splitMonthly(amount, months)) {
          const d = monthEnd(month)
          if (!afterBase(d)) continue
          push({
            id: `fin-${f.id}-rec-${month}`,
            date: d,
            sourceType: 'recognition',
            sourceId: f.id,
            description: `預付攤銷：${f.item} ${month}`,
            lines: pair(useCode, CODES.PREPAID_EXPENSE, m, { debitPerson: f.member || '', creditPerson: f.member || '', projectId }),
          })
        }
      } else {
        push({
          id: `fin-${f.id}`,
          date: effDate,
          sourceType: 'expense',
          sourceId: f.id,
          description: `支出：${f.item}`,
          lines: pair(useCode, fund.code, amount, { debitPerson: f.member || '', creditPerson: fund.person, projectId }),
        })
      }
      continue
    }
  }

  // ── 13. 手工傳票 ────────────────────────────────────────────
  for (const j of manualJournals) {
    if (!afterBase(j.date)) {
      diagnostics.push({ level: 'warn', message: `手工傳票「${j.description}」（${j.date}）早於基準日，不入帳` })
      continue
    }
    push({
      id: `mj-${j.id}`,
      date: j.date,
      sourceType: 'manual',
      sourceId: j.id,
      description: j.description || '手工傳票',
      lines: (j.lines || []).map(l => line(l.accountCode, {
        debit: parseFloat(l.debit) || 0,
        credit: parseFloat(l.credit) || 0,
        person: l.person || '',
        projectId: l.projectId || null,
      })),
    })
  }

  // ── 14. 年度結轉（每一扶輪年度 6/30 將收入/費用淨額結轉累積餘絀）──
  // 依實際分錄產生；結轉分錄日期為 FY 末（fy+1 年 6/30），報表以日期篩選自然生效
  const plByFy = new Map() // fy → Map(code|person|projectId → net debit)
  for (const e of entries) {
    const fy = fyOf(e.date)
    if (fy == null) continue
    for (const l of e.lines) {
      const acct = acctByCode[l.accountCode]
      if (!acct || (acct.type !== 'income' && acct.type !== 'expense')) continue
      if (!plByFy.has(fy)) plByFy.set(fy, new Map())
      const key = l.accountCode
      const m = plByFy.get(fy)
      m.set(key, (m.get(key) || 0) + (l.debit || 0) - (l.credit || 0))
    }
  }
  for (const [fy, m] of plByFy) {
    const lines = []
    let net = 0 // 借方淨額（費用>收入 → 虧絀）
    for (const [code, bal] of m) {
      const rounded = Math.round(bal * 100) / 100
      if (!rounded) continue
      // 結清：收入科目餘額在貸方（bal<0）→ 借記結清；費用反之
      if (rounded < 0) lines.push(line(code, { debit: -rounded }))
      else lines.push(line(code, { credit: rounded }))
      net += rounded
    }
    if (!lines.length) continue
    net = Math.round(net * 100) / 100
    // net<0 → 收入>費用（餘絀），貸記累積餘絀
    if (net < 0) lines.push(line(CODES.RETAINED, { credit: -net }))
    else if (net > 0) lines.push(line(CODES.RETAINED, { debit: net }))
    push({
      id: `closing-${fy}`,
      date: `${fy + 1}-06-30`,
      sourceType: 'closing',
      sourceId: fy,
      description: `年度結轉：${fy - 1911}-${fy - 1910}年度收支餘絀轉入累積餘絀`,
      lines,
    })
  }

  // 同日排序：結轉分錄固定排最後
  const sortKey = (e) => `${e.date}|${e.sourceType === 'closing' ? '~' : ' '}|${e.id}`
  entries.sort((a, b) => sortKey(a).localeCompare(sortKey(b)))
  return { entries, diagnostics, baseDate }
}
