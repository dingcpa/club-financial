// 歷史資料 backfill：舊 finance.item / 帳戶字串 / dues_settings → 新科目體系
//
// 用法：
//   node server/migrate-accounts.js          # DRY RUN（預設，只列印將執行的變更）
//   DRY_RUN=0 node server/migrate-accounts.js  # 實際寫入
//
// 冪等：所有 UPDATE 皆帶 WHERE 條件（accountCode IS NULL / 舊字串），可重複執行。
// 執行正式寫入前請先備份（mysqldump）。
require('dotenv').config()
const { pool } = require('./db')

const DRY_RUN = process.env.DRY_RUN !== '0'

// 與 client/src/accounting/coa.js 的 LEGACY_ITEM_MAP 同步維護
const ITEM_ACCOUNT_MAP = {
  // 收入
  '1-3月社費': '4101', '4-6月社費': '4101', '7-9月社費': '4101', '10-12月社費': '4101',
  '入社費': '4101',
  '授證紅箱': '4102', '交接紅箱': '4102', '春節紅箱': '4102', '母親節紅箱': '4102',
  '父親節紅箱': '4102', '中秋節紅箱': '4102', '例會歡喜紅箱': '4102', '其他紅箱': '4102',
  '其他收入-例會歡喜紅箱': '4102', '其他收入-其他紅箱': '4102',
  '其他收入-利息收入': '4103',
  '其他收入-其他': '4104',
  '溢收款': '2131',
  'EREY費': '2111', '總半年費': '2111', '總半年費(1-6)': '2111', '總半年費(7-12)': '2111',
  '金蘭房費': '2111',
  // 支出
  '辨公室租金及水電': '5201',
  '人事費 -薪資/油資': '5101',
  '文具費': '5203',
  '郵電費': '5204',
  '健保費': '5102',
  '印刷費': '5205',
  '雜費及設備更新': '5600',
  '助秘提撥金': '5103',
  '例會餐費(一般/聯合)': '5301', '一般例會/聯合例會': '5301', '餐費': '5301',
  '例會餐費(女賓夕/眷屬聯歡)': '5302', '女賓夕/眷屬聯歡': '5302',
  '資訊維修費(含地區網站)': '5204',
  '健遊活動': '5304',
  '演講車馬費': '5303',
  '爐邊會': '5305',
  '金蘭聯誼': '5307',
  '高球費用': '5310', '研習班': '5310',
  '職業參觀': '5308',
  '授證之旅補助': '5309',
}

// 經使用者（CPA）確認直接刪除的舊測試/委員會紀錄
const DELETE_ITEMS = ['服務計畫委員會', '扶輪基金委員會', '公共關係委員會', '社員發展委員會', '預備費']

// '還社長' 為歸墊性質 → 改為內部轉帳（淑華經手 → 社長經手）
const REPAY_ITEM = '還社長'

// 舊資金帳戶字串 → 新字彙
const FUND_MAP = {
  '淑華代收付': '經手人:陳淑華',
  '社長代收付': '經手人:雷書維',
}

// 舊 incomeAccount 字串 → 科目代碼
const INCOME_ACCOUNT_MAP = {
  '社費收入': '4101', '代收款': '2111', '紅箱收入': '4102', '其他收入': '4104', '利息收入': '4103',
}

// dues_settings 類別 → 科目/攤提月數（正式庫的 incomeAccount 尚未設值，依類別名對照）
const DUES_CATEGORY_MAP = {
  '1-3月社費': { accountCode: '4101', periodMonths: 3 },
  '4-6月社費': { accountCode: '4101', periodMonths: 3 },
  '7-9月社費': { accountCode: '4101', periodMonths: 3 },
  '10-12月社費': { accountCode: '4101', periodMonths: 3 },
  '入社費': { accountCode: '4101', periodMonths: null },
  'EREY費': { accountCode: '2111', periodMonths: null },
  '總半年費(1-6)': { accountCode: '2111', periodMonths: null },
  '總半年費(7-12)': { accountCode: '2111', periodMonths: null },
  '春節紅箱': { accountCode: '4102', periodMonths: null },
  '母親節紅箱': { accountCode: '4102', periodMonths: null },
  '父親節紅箱': { accountCode: '4102', periodMonths: null },
  '中秋節紅箱': { accountCode: '4102', periodMonths: null },
}

async function run() {
  console.log(DRY_RUN ? '=== DRY RUN（不寫入，DRY_RUN=0 才會執行）===' : '=== 實際寫入 ===')

  // 1. finance.item → accountCode
  const [rows] = await pool.query(
    `SELECT id, type, item, amount, date, account FROM finance WHERE accountCode IS NULL AND type IN ('income','expense')`
  )
  const unmapped = new Map()
  let mapped = 0
  for (const r of rows) {
    if (r.item === REPAY_ITEM || DELETE_ITEMS.includes(r.item)) continue
    const code = ITEM_ACCOUNT_MAP[r.item]
    if (!code) {
      unmapped.set(r.item, (unmapped.get(r.item) || 0) + 1)
      continue
    }
    mapped++
    if (!DRY_RUN) {
      await pool.query('UPDATE finance SET accountCode=? WHERE id=? AND accountCode IS NULL', [code, r.id])
    }
  }
  console.log(`\n[1] finance.accountCode backfill：${mapped} 筆可對應`)
  if (unmapped.size) {
    console.log('    ⚠ 未對應 item（維持 NULL，報表落入其他類）：')
    for (const [item, cnt] of unmapped) console.log(`      - ${item} × ${cnt}`)
  }

  // 2. 刪除委員會/預備費紀錄（使用者確認）
  const [delRows] = await pool.query(
    `SELECT id, item, date, amount FROM finance WHERE item IN (${DELETE_ITEMS.map(() => '?').join(',')})`,
    DELETE_ITEMS
  )
  console.log(`\n[2] 刪除委員會/預備費紀錄：${delRows.length} 筆`)
  for (const r of delRows) console.log(`      - ${r.date} ${r.item} ${r.amount}`)
  if (!DRY_RUN && delRows.length) {
    await pool.query(`DELETE FROM finance WHERE item IN (${DELETE_ITEMS.map(() => '?').join(',')})`, DELETE_ITEMS)
  }

  // 3. '還社長' → 內部轉帳（淑華經手 → 社長經手）
  const [repayRows] = await pool.query(
    `SELECT id, date, amount, account, remark FROM finance WHERE item=? AND type='expense'`, [REPAY_ITEM]
  )
  console.log(`\n[3] '還社長' 改內部轉帳：${repayRows.length} 筆`)
  for (const r of repayRows) {
    const from = FUND_MAP[r.account] || '經手人:陳淑華'
    console.log(`      - ${r.date} ${r.amount}：${from} → 經手人:雷書維`)
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE finance SET type='transfer', item=?, fromAccount=?, toAccount=?, account='', accountCode=NULL,
         remark=CONCAT(COALESCE(remark,''), ' [原「還社長」歸墊，遷移改列內部轉帳]') WHERE id=?`,
        ['內部轉帳: 陳淑華（經手） ➡ 雷書維（經手）', from, '經手人:雷書維', r.id]
      )
    }
  }

  // 4. 資金帳戶字串正規化（account / fromAccount / toAccount）
  console.log(`\n[4] 資金帳戶字串正規化：`)
  for (const col of ['account', 'fromAccount', 'toAccount']) {
    for (const [oldVal, newVal] of Object.entries(FUND_MAP)) {
      const [cnt] = await pool.query(`SELECT COUNT(*) AS c FROM finance WHERE ${col}=?`, [oldVal])
      if (cnt[0].c > 0) {
        console.log(`      - finance.${col}：'${oldVal}' → '${newVal}'（${cnt[0].c} 筆）`)
        if (!DRY_RUN) await pool.query(`UPDATE finance SET ${col}=? WHERE ${col}=?`, [newVal, oldVal])
      }
    }
  }

  // 5. receivables.incomeAccount → accountCode；社費類補 periodStart/End
  const [recvRows] = await pool.query(
    `SELECT id, sourceType, sourceRef, dueDate, dueYear, incomeAccount FROM receivables WHERE accountCode IS NULL`
  )
  let recvMapped = 0, recvAgency = 0, recvByName = 0
  for (const r of recvRows) {
    let code = INCOME_ACCOUNT_MAP[r.incomeAccount] || null
    if (!code && r.sourceType === 'agency') { code = '2111'; recvAgency++ }
    if (!code) {
      const m = DUES_CATEGORY_MAP[r.sourceRef]
      if (m) { code = m.accountCode; recvByName++ }
    }
    if (!code) continue
    recvMapped++
    if (!DRY_RUN) {
      await pool.query('UPDATE receivables SET accountCode=? WHERE id=? AND accountCode IS NULL', [code, r.id])
    }
  }
  console.log(`\n[5] receivables.accountCode backfill：${recvMapped}/${recvRows.length} 筆（代收 ${recvAgency}、依類別名 ${recvByName}）`)

  // 社費季別 receivable 補權責期間（依 sourceRef 'N-M月社費' + dueYear）
  const [duesRecv] = await pool.query(
    `SELECT id, sourceRef, dueYear FROM receivables WHERE sourceType='dues' AND periodStart IS NULL AND sourceRef REGEXP '^[0-9]{1,2}-[0-9]{1,2}月社費$'`
  )
  console.log(`    社費季別補 periodStart/End：${duesRecv.length} 筆`)
  for (const r of duesRecv) {
    const m = r.sourceRef.match(/^(\d{1,2})-(\d{1,2})月/)
    if (!m) continue
    const ps = `${r.dueYear}-${m[1].padStart(2, '0')}`
    const pe = `${r.dueYear}-${m[2].padStart(2, '0')}`
    if (!DRY_RUN) {
      await pool.query('UPDATE receivables SET periodStart=?, periodEnd=? WHERE id=?', [ps, pe, r.id])
    }
  }

  // 6. dues_settings 補 accountCode / periodMonths / kind
  const [settings] = await pool.query('SELECT category, incomeAccount, accountCode FROM dues_settings')
  console.log(`\n[6] dues_settings backfill：`)
  for (const s of settings) {
    if (s.accountCode) continue
    const m = DUES_CATEGORY_MAP[s.category]
    const code = (m && m.accountCode) || INCOME_ACCOUNT_MAP[s.incomeAccount] || null
    if (!code) { console.log(`      ⚠ 類別「${s.category}」無法對應科目，略過`); continue }
    const pm = m ? m.periodMonths : null
    const kind = code === '2111' ? 'agency' : 'dues'
    console.log(`      - ${s.category} → ${code}${pm ? `（攤提 ${pm} 個月）` : ''}`)
    if (!DRY_RUN) {
      await pool.query('UPDATE dues_settings SET accountCode=?, periodMonths=?, kind=? WHERE category=? AND accountCode IS NULL', [code, pm, kind, s.category])
    }
  }

  // 收尾統計
  const [remain] = await pool.query(
    `SELECT COUNT(*) AS c FROM finance WHERE accountCode IS NULL AND type IN ('income','expense') AND item NOT IN (${DELETE_ITEMS.map(() => '?').join(',')}) AND item<>?`,
    [...DELETE_ITEMS, REPAY_ITEM]
  )
  console.log(`\n完成。${DRY_RUN ? '（DRY RUN 未寫入）' : ''}剩餘未對應 finance 收支紀錄：${remain[0].c} 筆`)
  process.exit(0)
}

run().catch(e => { console.error(e); process.exit(1) })
