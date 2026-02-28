/**
 * 一次性遷移腳本：根據現有資料產生 receivables 記錄
 *
 * 用法：node server/migrate-receivables.js
 *
 * 邏輯：
 * 1. 掃描 dues_settings × members → 產生社費應收
 * 2. 掃描 agency_collections.targetMembers → 產生代收應收
 * 3. 比對 finance income 記錄和 paidMembers → 標記已繳
 * 4. 使用 INSERT IGNORE 確保冪等，可安全重複執行
 */
require('dotenv').config()
const { pool, initDB } = require('./db')

async function migrate() {
  await initDB()
  console.log('開始遷移 receivables...\n')

  const currentYear = new Date().getFullYear().toString()
  const [settings] = await pool.query('SELECT * FROM dues_settings')
  const [members] = await pool.query('SELECT name FROM members')
  const [incomes] = await pool.query(`SELECT * FROM finance WHERE type='income'`)
  const [agencies] = await pool.query('SELECT * FROM agency_collections')

  let created = 0
  let markedPaid = 0
  let counter = 0

  // 1. 社費應收：dues_settings × members
  console.log(`社費設定: ${settings.length} 項，社員: ${members.length} 人`)
  for (const s of settings) {
    const dueYear = s.dueDate ? s.dueDate.substring(0, 4) : currentYear
    const amount = parseFloat(s.standardAmount) || 0

    for (const m of members) {
      // 查找該社員是否已繳此社費（同年度）
      const payment = incomes.find(r =>
        r.member === m.name &&
        r.item === s.category &&
        r.date && r.date.startsWith(dueYear)
      )

      const id = Date.now() + counter++
      const status = payment ? 'paid' : 'pending'
      const paidAmount = payment ? parseFloat(payment.amount) : null
      const paidDate = payment ? payment.date : null
      const financeId = payment ? payment.id : null

      try {
        const [result] = await pool.query(
          `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status, paidAmount, paidDate, financeId) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [id, 'dues', s.category, m.name, amount, s.dueDate || null, dueYear, status, paidAmount, paidDate, financeId]
        )
        if (result.affectedRows > 0) {
          created++
          if (status === 'paid') markedPaid++
        }
      } catch (e) {
        // UNIQUE conflict, skip
      }
    }
  }
  console.log(`  社費應收: 新建 ${created} 筆（其中 ${markedPaid} 筆已標記 paid）\n`)

  // 2. 代收代付應收
  let agencyCreated = 0
  let agencyPaid = 0
  console.log(`代收代付項目: ${agencies.length} 項`)
  for (const a of agencies) {
    const targets = JSON.parse(a.targetMembers || '[]')
    const paids = JSON.parse(a.paidMembers || '[]')
    const dueYear = a.createdDate ? a.createdDate.substring(0, 4) : currentYear

    for (const t of targets) {
      const paid = paids.find(p => p.memberName === t.name)
      const isClosed = a.status === 'closed'

      const id = Date.now() + counter++
      let status = 'pending'
      if (paid) status = 'paid'
      else if (isClosed) status = 'waived'  // 已結案但未繳 → 免繳

      try {
        const [result] = await pool.query(
          `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status, paidAmount, paidDate, waivedReason) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          [id, 'agency', String(a.id), t.name, parseFloat(t.amount), a.createdDate || null, dueYear, status,
           paid ? parseFloat(paid.amount) : null, paid ? paid.date : null,
           (isClosed && !paid) ? '代收項目已結案' : null]
        )
        if (result.affectedRows > 0) {
          agencyCreated++
          if (status === 'paid') agencyPaid++
        }
      } catch (e) {
        // UNIQUE conflict, skip
      }
    }
  }
  console.log(`  代收應收: 新建 ${agencyCreated} 筆（其中 ${agencyPaid} 筆已標記 paid）\n`)

  // 3. 統計
  const [[stats]] = await pool.query(
    `SELECT COUNT(*) as total,
            SUM(status='pending') as pending,
            SUM(status='paid') as paid,
            SUM(status='waived') as waived
     FROM receivables`
  )
  console.log('=== 遷移結果 ===')
  console.log(`  總計: ${stats.total} 筆`)
  console.log(`  pending: ${stats.pending} 筆`)
  console.log(`  paid: ${stats.paid} 筆`)
  console.log(`  waived: ${stats.waived} 筆`)

  await pool.end()
  console.log('\n遷移完成！')
}

migrate().catch(err => {
  console.error('遷移失敗:', err)
  process.exit(1)
})
