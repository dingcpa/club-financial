// 一次性修正（2026-07-22，依執祕說明）：交接紅箱改為單筆入帳
// 原：33 筆應收開單＋逐筆收款（85,000，依現行名冊）
// 改：7/1 一筆收入單 借現金／貸 4102 紅箱收入 87,000（依 6 月當時社友人數收取）
require('dotenv').config()
const { pool } = require('./db')

async function main() {
  // 刪除交接紅箱收款單（finance）與應收（receivables）
  const [rcv] = await pool.query(`SELECT id FROM receivables WHERE sourceRef='交接紅箱'`)
  const ids = rcv.map(r => r.id)
  let delFin = 0
  if (ids.length) {
    const [f] = await pool.query(`DELETE FROM finance WHERE sourceReceivableId IN (${ids.map(() => '?').join(',')})`, ids)
    delFin = f.affectedRows
  }
  const [r] = await pool.query(`DELETE FROM receivables WHERE sourceRef='交接紅箱'`)
  // 帳款類別移除（一次性項目，不再開單）
  const [c] = await pool.query(`DELETE FROM dues_settings WHERE category='交接紅箱'`)
  // 單筆入帳
  await pool.query('INSERT INTO finance SET ?', [{
    id: Date.now(), type: 'income', date: '2026-07-01', item: '交接紅箱',
    member: '', account: '現金', amount: 87000,
    remark: '依114年6月社友人數收取，全數單筆入帳（執祕說明）',
    startPeriod: null, endPeriod: null, fromAccount: '', toAccount: '',
    accountCode: '4102', projectId: null, sourceReceivableId: null, sourcePayableId: null, occurredDate: null,
  }])
  console.log(`刪除交接紅箱：應收 ${r.affectedRows} 筆、收款單 ${delFin} 筆、帳款類別 ${c.affectedRows} 筆；已新增 7/1 收入單 87,000（現金／4102）`)

  const [cash] = await pool.query(`
    SELECT SUM(CASE WHEN type='income' AND account='現金' THEN amount ELSE 0 END)
         - SUM(CASE WHEN type='expense' AND account='現金' THEN amount ELSE 0 END)
         - SUM(CASE WHEN type='transfer' AND fromAccount='現金' THEN amount ELSE 0 END) AS cashBalance
    FROM finance`)
  console.log(`現金帳戶餘額（1105）：${parseFloat(cash[0].cashBalance)}`)
  await pool.end()
  console.log('完成')
}

main().catch(e => { console.error(e); process.exit(1) })
