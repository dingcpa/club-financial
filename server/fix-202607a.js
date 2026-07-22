// 一次性修正（2026-07-22，理監事會底稿確認後）：
// 1. 韓忠信實收 16,450：補沖父親節紅箱、中秋節紅箱各 1,000（7/10 現金）
// 2. 刪除項30「補助社友泰國之旅」現金付出 95,000（補助僅以抵減應繳發放）
// 3. 項31 就職費用 10,860 → 3,180（剔除重複之社長代購酒水 7,680）
// 4. 刪除項32 7/8 就職費用 10,860（重複）
require('dotenv').config()
const { pool } = require('./db')

let nextId = Date.now()

async function main() {
  // 1. 韓忠信補沖兩筆紅箱
  for (const ref of ['父親節紅箱', '中秋節紅箱']) {
    const [[r]] = await pool.query(
      `SELECT * FROM receivables WHERE sourceRef=? AND memberName='韓忠信'`, [ref])
    if (!r) throw new Error(`查無應收：${ref}/韓忠信`)
    if (r.status === 'paid') { console.log(`${ref} 已是 paid，略過`); continue }
    const fid = nextId++
    await pool.query('INSERT INTO finance SET ?', [{
      id: fid, type: 'income', date: '2026-07-10', item: ref, member: '韓忠信',
      account: '現金', amount: parseFloat(r.amount), remark: '', startPeriod: null, endPeriod: null,
      fromAccount: '', toAccount: '', accountCode: r.accountCode, projectId: null,
      sourceReceivableId: r.id, occurredDate: null,
    }])
    await pool.query(
      `UPDATE receivables SET status='paid', paidAmount=?, paidDate='2026-07-10', financeId=?, updatedAt=NOW() WHERE id=?`,
      [parseFloat(r.amount), fid, r.id])
    console.log(`已補沖 ${ref} ${parseFloat(r.amount)}（韓忠信）`)
  }

  // 2. 刪除補助現金付出 95,000
  const [d1] = await pool.query(
    `DELETE FROM finance WHERE type='expense' AND item='補助社友泰國之旅' AND amount=95000`)
  console.log(`刪除補助社友泰國之旅 95,000：${d1.affectedRows} 筆`)

  // 3. 項31 10,860 → 3,180
  const [u1] = await pool.query(
    `UPDATE finance SET amount=3180, remark='社長肩章560+槌480+簽到本540+贈卸任社長掛屏1600'
     WHERE type='expense' AND date='2026-07-05' AND accountCode='5302' AND amount=10860`)
  console.log(`項31 改 3,180：${u1.affectedRows} 筆`)

  // 4. 刪除 7/8 就職費用 10,860
  const [d2] = await pool.query(
    `DELETE FROM finance WHERE type='expense' AND date='2026-07-08' AND accountCode='5301' AND amount=10860`)
  console.log(`刪除 7/8 就職費用 10,860：${d2.affectedRows} 筆`)

  // 檢核
  const [sums] = await pool.query(`SELECT type, COUNT(*) c, SUM(amount) total FROM finance GROUP BY type`)
  console.table(sums.map(r => ({ ...r, total: parseFloat(r.total) })))
  const [cash] = await pool.query(`
    SELECT SUM(CASE WHEN type='income' AND account='現金' THEN amount ELSE 0 END)
         - SUM(CASE WHEN type='expense' AND account='現金' THEN amount ELSE 0 END)
         - SUM(CASE WHEN type='transfer' AND fromAccount='現金' THEN amount ELSE 0 END) AS cashBalance
    FROM finance`)
  console.log(`現金帳戶餘額（1105）：${parseFloat(cash[0].cashBalance)}`)
  const [[han]] = await pool.query(
    `SELECT SUM(amount) t, COUNT(*) c FROM finance WHERE member='韓忠信' AND date='2026-07-10'`)
  console.log(`韓忠信 7/10 收款合計：${parseFloat(han.t)}（應為 16450，${han.c} 筆）`)
  await pool.end()
  console.log('完成')
}

main().catch(e => { console.error(e); process.exit(1) })
