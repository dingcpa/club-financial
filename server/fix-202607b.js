// 一次性修正（2026-07-22）：7-9月固定紅箱性質改為社費（accountCode 4102 → 4101）
// 影響：帳款明細表性質欄、收支月報表歸屬（固定紅箱轉列改列 4101 社費收入）
require('dotenv').config()
const { pool } = require('./db')

async function main() {
  const [a] = await pool.query(`UPDATE dues_settings SET accountCode='4101' WHERE category='7-9月固定紅箱'`)
  const [b] = await pool.query(`UPDATE receivables SET accountCode='4101' WHERE sourceRef='7-9月固定紅箱'`)
  const [c] = await pool.query(`UPDATE finance SET accountCode='4101' WHERE item='7-9月固定紅箱' AND sourceReceivableId IS NOT NULL`)
  console.log(`dues_settings ${a.affectedRows} 筆、receivables ${b.affectedRows} 筆、finance 收款單 ${c.affectedRows} 筆`)
  await pool.end()
  console.log('完成')
}

main().catch(e => { console.error(e); process.exit(1) })
