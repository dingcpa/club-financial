// 一次性腳本：2026-07 理監事會前資料重建（2026-07-22 執行）
// 1. 備份 finance / receivables / dues_settings / accounts / projects / members 至 JSON
// 2. 清除 finance 與 receivables（保留 opening_balances）
// 3. 建基礎資料：1105 現金科目、例會活動、新帳款類別（7-9月會費/服務基金/餐費/固定紅箱、
//    交接紅箱、泰國補助）、EREY費 3200、蕭湧達 status=onleave
// 4. 批次產生應收帳款（社費、紅箱、代收、補助）＋收款沖帳＋直接收支單據
// 執行：node server/seed-202607.js（DRY_RUN=1 只印不寫）
require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { pool } = require('./db')

const DRY = process.env.DRY_RUN === '1'
const BACKUP_DIR = path.join(__dirname, '..', 'backup')
const CASH = '現金'                       // 資金帳戶字串（1105 現金，isCash 由名稱解析）
const THAI_PROJECT_ID = 1784590178368     // 33屆社長就職之旅(泰國)

let nextId = Date.now()
const nid = () => nextId++

async function main() {
  // ── 0. 撈名冊、決定名單 ────────────────────────────────
  const [memberRows] = await pool.query(`SELECT name, jobTitle1, jobTitle2, status FROM members`)
  const active = memberRows.filter(m => m.status !== 'left')
  const names = active.map(m => m.name)
  console.log(`現職(含請假)社友 ${names.length} 名`)
  if (names.length !== 33) throw new Error(`預期 33 名現職社友，實得 ${names.length}`)

  const except = (...ex) => names.filter(n => !ex.includes(n))
  const PRESIDENT = '林盟凱'
  const ONLEAVE = '蕭湧達'
  const PHF = ['晉茂根', '游宜凱', '呂耀宏', '林盟凱']              // 保羅哈里斯 → 免EREY
  const CREF = ['游宜凱', '雷書維', '廖炳麒']                       // 中華扶輪教育基金
  const THAI = ['嚴庚辰', '馬季里', '晉茂根', '王献增', '柯順哲', '蔡文森', '張文錫', '許隆誠', '丁俊廷',
    '廖炳麒', '柯建彰', '林盟凱', '黃家釧', '張慶輝', '曹榮旭', '韓忠信', '劉治平', '林嵩堅', '陳明成']
  for (const n of [...PHF, ...CREF, ...THAI, PRESIDENT, ONLEAVE]) {
    if (!names.includes(n)) throw new Error(`名冊查無社友：${n}`)
  }
  // 交接紅箱：林盟凱2萬、雷書維/黃淨林各1萬、其他理監事2千、其餘社友1千
  const isDirector = m => ['理事', '監事'].includes((m.jobTitle2 || '').trim())
  const handoverAmt = m =>
    m.name === '林盟凱' ? 20000 :
    (m.name === '雷書維' || m.name === '黃淨林') ? 10000 :
    isDirector(m) ? 2000 : 1000
  const handover = active.map(m => ({ name: m.name, amount: handoverAmt(m) }))
  const handoverTotal = handover.reduce((s, h) => s + h.amount, 0)
  console.log(`交接紅箱合計 ${handoverTotal}（理監事 ${active.filter(isDirector).length} 名）`)

  // ── 1. 備份 ──────────────────────────────────────────
  const backup = {}
  for (const t of ['finance', 'receivables', 'dues_settings', 'accounts', 'projects', 'members']) {
    const [rows] = await pool.query(`SELECT * FROM ${t}`)
    backup[t] = rows
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true })
  const backupFile = path.join(BACKUP_DIR, `backup-before-seed-${new Date().toISOString().slice(0, 10)}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(backup, null, 1), 'utf8')
  console.log(`備份完成：${backupFile}（finance ${backup.finance.length} 筆、receivables ${backup.receivables.length} 筆）`)

  if (DRY) { console.log('DRY_RUN=1，不寫入'); process.exit(0) }

  // ── 2. 清除收支資料（保留期初餘額） ─────────────────────
  await pool.query('DELETE FROM finance')
  await pool.query('DELETE FROM receivables')
  console.log('已清除 finance / receivables')

  // ── 3. 基礎資料 ──────────────────────────────────────
  await pool.query(`INSERT IGNORE INTO accounts (code, name, type, parentCode, isCash, isSystem, requiresPerson, sortOrder, active, description)
    VALUES ('1105', '現金', 'asset', NULL, 1, 0, 0, 0, 1, '庫存現金（收付現金之資金帳戶）')`)
  await pool.query(`INSERT IGNORE INTO projects (id, name, active, sortOrder) VALUES (?, '例會', 1, 0)`, [nid()])
  const [[meeting]] = await pool.query(`SELECT id FROM projects WHERE name='例會'`)
  const MEETING_ID = meeting.id
  await pool.query(`UPDATE members SET status='onleave' WHERE name=?`, [ONLEAVE])

  const cat = (category, dueDate, standardAmount, accountCode, periodMonths) =>
    pool.query(`INSERT INTO dues_settings (category, dueDate, standardAmount, kind, incomeAccount, accountCode, periodMonths)
      VALUES (?,?,?,?,NULL,?,?) ON DUPLICATE KEY UPDATE dueDate=VALUES(dueDate), standardAmount=VALUES(standardAmount), accountCode=VALUES(accountCode), periodMonths=VALUES(periodMonths)`,
      [category, dueDate, standardAmount, 'dues', accountCode, periodMonths])
  await cat('7-9月會費', '2026-07-01', 4200, '4101', 3)
  await cat('7-9月服務基金', '2026-07-01', 2400, '4101', 3)
  await cat('7-9月餐費', '2026-07-01', 7500, '4101', 3)
  await cat('7-9月固定紅箱', '2026-07-01', 3900, '4102', 3)
  await cat('交接紅箱', '2026-07-01', 1000, '4102', null)
  await cat('泰國補助', '2026-07-01', -5000, '5302', null)
  await pool.query(`UPDATE dues_settings SET standardAmount=3200 WHERE category='EREY費'`)
  console.log('基礎資料建立完成（1105 現金、例會、帳款類別）')

  // ── 4. 應收帳款 ──────────────────────────────────────
  const receivableIdx = {} // `${sourceRef}|${memberName}` → id
  async function bill(sourceRef, memberName, amount, dueDate, accountCode, periodStart = null, periodEnd = null) {
    const id = nid()
    await pool.query(
      `INSERT INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status, incomeAccount, accountCode, periodStart, periodEnd)
       VALUES (?,?,?,?,?,?,?,?,NULL,?,?,?)`,
      [id, 'dues', sourceRef, memberName, amount, dueDate, dueDate.slice(0, 4), 'pending', accountCode, periodStart, periodEnd])
    receivableIdx[`${sourceRef}|${memberName}`] = id
    return id
  }
  const billAll = async (list, ...args) => { for (const n of list) await bill(args[0], n, ...args.slice(1)) }

  // 7-9月社費（權責：開單掛 2121 預收社費，逐月轉列 4101/4102）
  await billAll(names, '7-9月會費', 4200, '2026-07-01', '4101', '2026-07', '2026-09')
  await billAll(names, '7-9月服務基金', 2400, '2026-07-01', '4101', '2026-07', '2026-09')
  await billAll(except(ONLEAVE), '7-9月餐費', 7500, '2026-07-01', '4101', '2026-07', '2026-09')
  await billAll(except(PRESIDENT, ONLEAVE), '7-9月固定紅箱', 3900, '2026-07-01', '4102', '2026-07', '2026-09')
  // 節慶紅箱（開單借應收貸預收，當月底轉列紅箱收入）
  await billAll(names, '父親節紅箱', 1000, '2026-08-01', '4102', '2026-08', '2026-08')
  await billAll(names, '中秋節紅箱', 1000, '2026-09-01', '4102', '2026-09', '2026-09')
  // 代收（2111 代收款，person=案名）
  await billAll(names, '總半年費(7-12)', 600, '2026-07-01', '2111')
  await billAll(names, '扶輪月刊(7-12)', 350, '2026-07-01', '2111')
  await billAll(except(PRESIDENT), '社長賀匾', 500, '2026-07-01', '2111')
  await billAll(names, '地區基金', 800, '2026-07-01', '2111')
  await billAll(except(...PHF), 'EREY費', 3200, '2026-07-01', '2111')
  await billAll(PHF, '保羅哈里斯', 32000, '2026-07-01', '2111')
  await billAll(CREF, '中華扶輪教育基金', 10000, '2026-07-01', '2111')
  // 泰國補助（負數應收：借 5302 活動支出／貸 1111 應收）
  await billAll(THAI, '泰國補助', -5000, '2026-07-01', '5302')
  // 交接紅箱（無攤提期間：開單即認列 4102）
  for (const h of handover) await bill('交接紅箱', h.name, h.amount, '2026-07-01', '4102')
  const [[{ c: rcvCount }]] = await pool.query('SELECT COUNT(*) c FROM receivables')
  console.log(`應收帳款開單完成：${rcvCount} 筆`)

  // ── 5. 收款沖帳（finance 收款單 + 應收狀態） ─────────────
  async function collect(sourceRef, memberName, date, account = CASH, remark = '') {
    const rid = receivableIdx[`${sourceRef}|${memberName}`]
    if (!rid) throw new Error(`查無應收：${sourceRef}/${memberName}`)
    const [[r]] = await pool.query('SELECT * FROM receivables WHERE id=?', [rid])
    const amount = parseFloat(r.amount)
    const fid = nid()
    await pool.query('INSERT INTO finance SET ?', [{
      id: fid, type: 'income', date, item: sourceRef, member: memberName, account,
      amount, remark, startPeriod: null, endPeriod: null, fromAccount: '', toAccount: '',
      accountCode: r.accountCode || null, projectId: null, sourceReceivableId: rid, occurredDate: null,
    }])
    await pool.query(`UPDATE receivables SET status='paid', paidAmount=?, paidDate=?, financeId=?, updatedAt=NOW() WHERE id=?`,
      [amount, date, fid, rid])
    return amount
  }

  // 項13：7/1 全體社友交接紅箱收現
  let handoverCollected = 0
  for (const h of handover) handoverCollected += await collect('交接紅箱', h.name, '2026-07-01')
  console.log(`交接紅箱收款 ${handoverCollected}（應為 ${handoverTotal}）`)

  // 項10：7/10 林盟凱 44,850（含泰國補助 -5,000 沖抵）
  const linItems = ['7-9月會費', '7-9月服務基金', '7-9月餐費', '總半年費(7-12)', '扶輪月刊(7-12)',
    '地區基金', '保羅哈里斯', '父親節紅箱', '中秋節紅箱', '泰國補助']
  let linTotal = 0
  for (const it of linItems) linTotal += await collect(it, '林盟凱', '2026-07-10')
  console.log(`林盟凱收款合計 ${linTotal}（應為 44850）`)
  if (linTotal !== 44850) throw new Error('林盟凱收款金額不符')

  // 項11：7/10 韓忠信 14,450（沖款不含父親節/中秋紅箱——與陳述金額勾稽後之取捨，見紀錄文件）
  const hanItems = ['7-9月會費', '7-9月服務基金', '7-9月餐費', '7-9月固定紅箱',
    '總半年費(7-12)', '扶輪月刊(7-12)', '社長賀匾', '泰國補助']
  let hanTotal = 0
  for (const it of hanItems) hanTotal += await collect(it, '韓忠信', '2026-07-10')
  console.log(`韓忠信收款合計 ${hanTotal}（應為 14450）`)
  if (hanTotal !== 14450) throw new Error('韓忠信收款金額不符')

  // ── 6. 直接收入／付款／調撥單據 ────────────────────────
  async function fin(row) {
    await pool.query('INSERT INTO finance SET ?', [{
      id: nid(), member: '', account: '', fromAccount: '', toAccount: '',
      remark: '', startPeriod: null, endPeriod: null, accountCode: null,
      projectId: null, sourceReceivableId: null, occurredDate: null, ...row,
    }])
  }
  const income = (date, item, amount, accountCode, account, projectId = null, remark = '') =>
    fin({ type: 'income', date, item, amount, accountCode, account, projectId, remark })
  const expense = (date, item, amount, accountCode, account, projectId = null, remark = '') =>
    fin({ type: 'expense', date, item, amount, accountCode, account, projectId, remark })

  // 項14-21 收款單（直接認列）
  await income('2026-07-02', '歡喜紅箱', 133600, '4102', CASH, MEETING_ID)
  await income('2026-07-02', '歡喜紅箱-PP威男夫人', 6000, '4102', CASH, MEETING_ID)
  await income('2026-07-02', '歡喜紅箱-PP献增指定扶輪之子', 10000, '4102', CASH, MEETING_ID)
  await income('2026-07-02', '歡喜紅箱-IPP書維贊助泰國之旅', 10000, '4102', CASH, MEETING_ID)
  await income('2026-07-02', '歡喜紅箱-PP順哲贊助榴槤', 5000, '4102', CASH, MEETING_ID)
  await income('2026-07-02', '歡喜紅箱-明成贊助導遊小費', 5000, '4102', CASH, MEETING_ID)
  await income('2026-07-19', '歡喜紅箱-梅花餐廳例會', 27000, '4102', CASH, MEETING_ID)
  await income('2026-07-01', '利息收入（844+182+2）', 1028, '4103', '一銀帳戶')

  // 項22-26、28-32 付款單
  await expense('2026-07-01', '115年7月份房租-每社', 2000, '5201', CASH)
  await expense('2026-07-01', '粉彩粉色紙2*43', 2000, '5203', CASH)
  await expense('2026-07-19', '8/20內輪會場地訂金(2600/2+申請會員證100)', 1400, '5201', CASH)
  await expense('2026-07-19', '健遊活動', 50110, '5304', CASH, null,
    '玉井鄉梅花餐廳6000*6桌+2素800(400*2)+鰻7840+飲料2360+冰品2950+160')
  await expense('2026-07-01', '社長訂酒水1280*6', 7680, '5301', '經手人:林盟凱')
  await expense('2026-07-06', '購33屆運動服700*34*2', 47600, '5600', CASH)
  await expense('2026-07-05', '就職費用', 96068, '5302', CASH, THAI_PROJECT_ID,
    '48850(社長免稅蛋酒19490+米粉15360+首敲餐會14000)+泰國之旅酒水37218(7/1酒水1120+燕窩16800+7/2酒水8630+柳子3500+晚宴酒水3828+第三天酒水1800+7/4中午酒水1540)+PP順哲榴槤5000+明成導遊小費5000')
  await expense('2026-07-05', '補助社友泰國之旅', 95000, '5302', CASH, THAI_PROJECT_ID, '5000*19')
  await expense('2026-07-05', '就職費用', 10860, '5302', CASH, THAI_PROJECT_ID,
    '社長肩章560+槌480+簽到本540+贈卸任社長掛屏1600+社長代購酒水7680(1280*6)')
  await expense('2026-07-08', '就職費用', 10860, '5301', CASH, THAI_PROJECT_ID)

  // 項27 調撥單：現金 → 林盟凱(經手) 歸墊
  await fin({ type: 'transfer', date: '2026-07-05', item: '現金調撥-歸墊社長訂酒水',
    amount: 7680, fromAccount: CASH, toAccount: '經手人:林盟凱', remark: '社長訂酒水' })

  const [[{ c: finCount }]] = await pool.query('SELECT COUNT(*) c FROM finance')
  console.log(`finance 單據共 ${finCount} 筆`)

  // ── 7. 檢核輸出 ──────────────────────────────────────
  const [sums] = await pool.query(`SELECT type, COUNT(*) c, SUM(amount) total FROM finance GROUP BY type`)
  console.table(sums.map(r => ({ ...r, total: parseFloat(r.total) })))
  const [rstat] = await pool.query(`SELECT status, COUNT(*) c, SUM(amount) total FROM receivables GROUP BY status`)
  console.table(rstat.map(r => ({ ...r, total: parseFloat(r.total) })))
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
