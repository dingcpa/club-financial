// 一次性修正（2026-07-22）：receivables 加 projectId，泰國補助掛「33屆社長就職之旅(泰國)」
// 分類帳活動別欄顯示用：補助之借 5302／貸 1111 分錄與其收款沖抵單皆標示活動
require('dotenv').config()
const { pool } = require('./db')

const THAI_PROJECT_ID = 1784590178368

async function main() {
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS projectId BIGINT`)
  const [a] = await pool.query(`UPDATE receivables SET projectId=? WHERE sourceRef='泰國補助'`, [THAI_PROJECT_ID])
  const [b] = await pool.query(
    `UPDATE finance SET projectId=? WHERE item='泰國補助' AND sourceReceivableId IS NOT NULL`, [THAI_PROJECT_ID])
  console.log(`receivables ${a.affectedRows} 筆、finance 收款沖抵單 ${b.affectedRows} 筆已掛泰國活動`)
  await pool.end()
  console.log('完成')
}

main().catch(e => { console.error(e); process.exit(1) })
