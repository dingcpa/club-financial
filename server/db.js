const mysql = require('mysql2/promise')

// 必要的資料庫連線設定一律由環境變數提供，缺一即拒絕啟動，
// 避免把正式憑證寫死在原始碼中。
const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASSWORD', 'DB_NAME']
const missing = required.filter((k) => !process.env[k])
if (missing.length) {
  throw new Error(`缺少必要的資料庫環境變數：${missing.join(', ')}（請設定 .env 或部署平台的 Variables）`)
}

const pool = mysql.createPool({
  host:     process.env.DB_HOST,
  port:     parseInt(process.env.DB_PORT),
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS finance (
      id BIGINT PRIMARY KEY,
      type VARCHAR(20) NOT NULL,
      date VARCHAR(20) NOT NULL,
      item VARCHAR(255) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      remark TEXT,
      member VARCHAR(100),
      account VARCHAR(100),
      fromAccount VARCHAR(100),
      toAccount VARCHAR(100),
      startPeriod VARCHAR(7),
      endPeriod VARCHAR(7)
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS members (
      id BIGINT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      nickname VARCHAR(100),
      birthday VARCHAR(20),
      email VARCHAR(200),
      phone VARCHAR(50),
      mobile VARCHAR(50),
      address TEXT,
      jobTitle1 VARCHAR(100),
      jobTitle2 VARCHAR(100)
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS dues_settings (
      category VARCHAR(100) PRIMARY KEY,
      dueDate VARCHAR(20),
      standardAmount DECIMAL(12,2),
      kind VARCHAR(20) NOT NULL DEFAULT 'dues',
      incomeAccount VARCHAR(100)
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS agency_collections (
      id BIGINT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      targetMembers LONGTEXT,
      paidMembers LONGTEXT,
      status VARCHAR(20) DEFAULT 'open',
      createdDate VARCHAR(20),
      closedDate VARCHAR(20),
      closedAmount DECIMAL(12,2),
      closedRemark TEXT,
      remark TEXT
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      display_name VARCHAR(100),
      role VARCHAR(20) NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receivables (
      id BIGINT PRIMARY KEY,
      sourceType VARCHAR(20) NOT NULL,
      sourceRef VARCHAR(255) NOT NULL,
      memberName VARCHAR(100) NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      dueDate VARCHAR(20),
      dueYear VARCHAR(4) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      paidAmount DECIMAL(12,2),
      paidDate VARCHAR(20),
      financeId BIGINT,
      incomeAccount VARCHAR(100),
      waivedReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_receivable (sourceType, sourceRef, memberName, dueYear)
    ) CHARACTER SET utf8mb4
  `)
  // ── 複式簿記體系（2026-07 重構）────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts (
      code VARCHAR(10) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      type VARCHAR(20) NOT NULL,
      parentCode VARCHAR(10),
      isCash TINYINT NOT NULL DEFAULT 0,
      isSystem TINYINT NOT NULL DEFAULT 0,
      requiresPerson TINYINT NOT NULL DEFAULT 0,
      sortOrder INT DEFAULT 0,
      active TINYINT NOT NULL DEFAULT 1
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id BIGINT PRIMARY KEY,
      name VARCHAR(100) UNIQUE NOT NULL,
      active TINYINT NOT NULL DEFAULT 1,
      sortOrder INT DEFAULT 0
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS manual_journals (
      id BIGINT PRIMARY KEY,
      date VARCHAR(10) NOT NULL,
      description VARCHAR(255),
      \`lines\` LONGTEXT NOT NULL,
      createdBy VARCHAR(50),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS opening_balances (
      id BIGINT PRIMARY KEY,
      baseDate VARCHAR(10) NOT NULL,
      accountCode VARCHAR(10) NOT NULL,
      person VARCHAR(100) NOT NULL DEFAULT '',
      debit DECIMAL(12,2) NOT NULL DEFAULT 0,
      credit DECIMAL(12,2) NOT NULL DEFAULT 0,
      remark TEXT,
      UNIQUE KEY uq_opening (baseDate, accountCode, person)
    ) CHARACTER SET utf8mb4
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      k VARCHAR(50) PRIMARY KEY,
      v TEXT
    ) CHARACTER SET utf8mb4
  `)
  // LINE 財務精靈：紅箱登記場次（結算後轉為 finance 單據）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS redbox_sessions (
      sourceId VARCHAR(64) PRIMARY KEY,
      date VARCHAR(10) NOT NULL,
      \`rows\` LONGTEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)
  // 為已存在的 users 表補上 role 欄位（MariaDB 支援 IF NOT EXISTS）
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'`)
  // 為已存在的 dues_settings 補上「類型」與「對方科目」欄位
  await pool.query(`ALTER TABLE dues_settings ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'dues'`)
  await pool.query(`ALTER TABLE dues_settings ADD COLUMN IF NOT EXISTS incomeAccount VARCHAR(100)`)
  // 為已存在的 receivables 補上「對方收入科目」欄位（沖帳記入正確科目）
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS incomeAccount VARCHAR(100)`)
  // 複式簿記新欄位：單據直掛科目/專案；收款單以 sourceReceivableId 標記（引擎視為沖應收，非收入）
  await pool.query(`ALTER TABLE finance ADD COLUMN IF NOT EXISTS accountCode VARCHAR(10)`)
  await pool.query(`ALTER TABLE finance ADD COLUMN IF NOT EXISTS projectId BIGINT`)
  await pool.query(`ALTER TABLE finance ADD COLUMN IF NOT EXISTS sourceReceivableId BIGINT`)
  // 應收帳款：科目代碼＋權責歸屬期間（取代由名稱正則推期間）
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS accountCode VARCHAR(10)`)
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS periodStart VARCHAR(7)`)
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS periodEnd VARCHAR(7)`)
  // 帳款類別：科目代碼＋期間月數（開單時據以計算 periodStart/End）
  await pool.query(`ALTER TABLE dues_settings ADD COLUMN IF NOT EXISTS accountCode VARCHAR(10)`)
  await pool.query(`ALTER TABLE dues_settings ADD COLUMN IF NOT EXISTS periodMonths INT`)

  await seedAccounting()
  console.log('DB tables initialized')
}

// 科目表 seed：isSystem=1 者為分錄推導引擎直接引用的科目，不可刪、code/type 不可改。
// INSERT IGNORE 冪等；使用者於設定頁的改名（name）與新增細項不會被覆蓋。
const ACCOUNT_SEED = [
  // 資產
  ['1101', '銀行存款-一銀', 'asset', null, { isCash: 1, isSystem: 1 }],
  ['1111', '應收帳款', 'asset', null, { isSystem: 1, requiresPerson: 1 }],
  ['1121', '經手人往來', 'asset', null, { isSystem: 1, requiresPerson: 1 }],
  ['1131', '預付費用', 'asset', null, { isSystem: 1 }],
  // 負債
  ['2111', '代收款', 'liability', null, { isSystem: 1, requiresPerson: 1 }],
  ['2121', '預收社費', 'liability', null, { isSystem: 1 }],
  ['2122', '其他預收收入', 'liability', null, { isSystem: 1 }],
  ['2131', '暫收款(社友溢繳)', 'liability', null, { isSystem: 1, requiresPerson: 1 }],
  // 權益
  ['3101', '累積餘絀', 'equity', null, { isSystem: 1 }],
  // 收入
  ['4101', '社費收入', 'income', null, { isSystem: 1 }],
  ['4102', '紅箱收入', 'income', null, {}],
  ['4103', '利息收入', 'income', null, {}],
  ['4104', '其他收入', 'income', null, {}],
  ['4105', '兌換利益', 'income', null, {}],
  // 費用（二層：細項掛在科目下，單據只能選葉節點）
  ['5100', '人事費', 'expense', null, {}],
  ['5101', '薪資支出', 'expense', '5100', {}],
  ['5102', '保險費', 'expense', '5100', {}],
  ['5103', '退休金', 'expense', '5100', {}],
  ['5200', '辦公費', 'expense', null, {}],
  ['5201', '租金支出', 'expense', '5200', {}],
  ['5202', '水電費', 'expense', '5200', {}],
  ['5203', '文具用品', 'expense', '5200', {}],
  ['5204', '郵電網路費', 'expense', '5200', {}],
  ['5205', '印刷費', 'expense', '5200', {}],
  ['5300', '社務活動費', 'expense', null, {}],
  ['5301', '例會餐飲', 'expense', '5300', {}],
  ['5302', '活動支出', 'expense', '5300', {}],
  ['5303', '演講車馬費', 'expense', '5300', {}],
  ['5304', '健遊活動', 'expense', '5300', {}],
  ['5305', '爐邊會', 'expense', '5300', {}],
  ['5306', '內輪會', 'expense', '5300', {}],
  ['5307', '三社聯誼', 'expense', '5300', {}],
  ['5308', '職業參觀', 'expense', '5300', {}],
  ['5309', '授證之旅', 'expense', '5300', {}],
  ['5310', '研習補助(高球/Sax)', 'expense', '5300', {}],
  ['5311', 'RYE交換', 'expense', '5300', {}],
  ['5400', '專案計劃支出', 'expense', null, {}],
  ['5401', '扶輪之子', 'expense', '5400', {}],
  ['5402', '肺癌篩檢', 'expense', '5400', {}],
  ['5403', '生命橋樑', 'expense', '5400', {}],
  ['5404', '尼泊爾義診', 'expense', '5400', {}],
  ['5405', '其他社區服務', 'expense', '5400', {}],
  ['5500', '公關費', 'expense', null, {}],
  ['5600', '雜項購置', 'expense', null, {}],
  ['5900', '其他支出', 'expense', null, {}],
]

const PROJECT_SEED = [
  '三社聯誼', '爐邊會', '內輪會', '授證之旅', '運動會',
  '肺癌篩檢', '扶輪之子', '生命橋樑', '尼泊爾義診',
]

const SETTINGS_SEED = [
  ['accounting.baseDate', '2026-06-30'],
  ['dues.monthlyAmount', '6000'],
]

async function seedAccounting() {
  for (let i = 0; i < ACCOUNT_SEED.length; i++) {
    const [code, name, type, parentCode, opts] = ACCOUNT_SEED[i]
    await pool.query(
      `INSERT IGNORE INTO accounts (code, name, type, parentCode, isCash, isSystem, requiresPerson, sortOrder) VALUES (?,?,?,?,?,?,?,?)`,
      [code, name, type, parentCode, opts.isCash || 0, opts.isSystem || 0, opts.requiresPerson || 0, i]
    )
  }
  for (let i = 0; i < PROJECT_SEED.length; i++) {
    await pool.query(`INSERT IGNORE INTO projects (id, name, sortOrder) VALUES (?,?,?)`, [i + 1, PROJECT_SEED[i], i])
  }
  for (const [k, v] of SETTINGS_SEED) {
    await pool.query(`INSERT IGNORE INTO app_settings (k, v) VALUES (?,?)`, [k, v])
  }
}

module.exports = { pool, initDB }
