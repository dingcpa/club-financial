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
      active TINYINT NOT NULL DEFAULT 1,
      description VARCHAR(255)
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
  // 銀行存款核對紀錄（存摺實際餘額 vs 帳上餘額）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bank_reconciliations (
      id BIGINT PRIMARY KEY,
      accountCode VARCHAR(10) NOT NULL,
      reconDate VARCHAR(10) NOT NULL,
      statementBalance DECIMAL(12,2) NOT NULL,
      remark TEXT,
      createdBy VARCHAR(50),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_recon (accountCode, reconDate)
    ) CHARACTER SET utf8mb4
  `)
  // 年度預算（依扶輪年度＋科目）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id BIGINT PRIMARY KEY,
      fy INT NOT NULL,
      accountCode VARCHAR(10) NOT NULL,
      amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      remark VARCHAR(255),
      UNIQUE KEY uq_budget (fy, accountCode)
    ) CHARACTER SET utf8mb4
  `)
  // 佐證附件（收據/發票/匯款水單照片；前端壓縮後以 base64 存 DB）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS attachments (
      id BIGINT PRIMARY KEY,
      refType VARCHAR(20) NOT NULL,
      refId BIGINT NOT NULL,
      filename VARCHAR(255),
      mimeType VARCHAR(100),
      size INT,
      data LONGTEXT NOT NULL,
      createdBy VARCHAR(50),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ref (refType, refId)
    ) CHARACTER SET utf8mb4
  `)
  // 催繳/通知紀錄
  await pool.query(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id BIGINT PRIMARY KEY,
      kind VARCHAR(20) NOT NULL,
      target VARCHAR(100) NOT NULL,
      channel VARCHAR(20) NOT NULL,
      content TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'sent',
      error TEXT,
      createdBy VARCHAR(50),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)
  // 唯讀分享連結（給監事/查帳人免帳號檢視報表）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS share_links (
      id BIGINT PRIMARY KEY,
      token VARCHAR(64) UNIQUE NOT NULL,
      label VARCHAR(100),
      expiresAt VARCHAR(10),
      active TINYINT NOT NULL DEFAULT 1,
      createdBy VARCHAR(50),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) CHARACTER SET utf8mb4
  `)
  // 收據（開立收據頁：流水編號、可作廢不可刪，作廢不回收編號）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS receipts (
      id BIGINT PRIMARY KEY,
      receiptNo VARCHAR(20) UNIQUE NOT NULL,
      fy INT NOT NULL,
      date VARCHAR(10) NOT NULL,
      memberName VARCHAR(100) NOT NULL,
      items LONGTEXT NOT NULL,
      totalAmount DECIMAL(12,2) NOT NULL,
      financeIds LONGTEXT,
      issuedBy VARCHAR(50),
      voided TINYINT NOT NULL DEFAULT 0,
      voidReason VARCHAR(255),
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_fy (fy)
    ) CHARACTER SET utf8mb4
  `)
  // 理監事會議程（會議主檔＋議案 JSON：reports 報告事項 / proposals 提案討論）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS meetings (
      id BIGINT PRIMARY KEY,
      title VARCHAR(200) NOT NULL,
      meetingDate VARCHAR(10),
      meetingTime VARCHAR(20),
      location VARCHAR(200),
      agenda LONGTEXT,
      note TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
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
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS projectId BIGINT`)
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS periodStart VARCHAR(7)`)
  await pool.query(`ALTER TABLE receivables ADD COLUMN IF NOT EXISTS periodEnd VARCHAR(7)`)
  // 帳款類別：科目代碼＋期間月數（開單時據以計算 periodStart/End）
  await pool.query(`ALTER TABLE dues_settings ADD COLUMN IF NOT EXISTS accountCode VARCHAR(10)`)
  await pool.query(`ALTER TABLE dues_settings ADD COLUMN IF NOT EXISTS periodMonths INT`)
  // 科目說明（表單下拉的副標，讓執秘清楚科目用途）
  await pool.query(`ALTER TABLE accounts ADD COLUMN IF NOT EXISTS description VARCHAR(255)`)
  // 社籍狀態（active 現職 / left 退社）＋退社日＋銀行帳號末五碼（收款對帳用）
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'`)
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS leaveDate VARCHAR(20)`)
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS bankAccountLast5 VARCHAR(10)`)
  // 名冊排序（依社友資料表順序；NULL 排最後）
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS sortOrder INT`)
  // 單據雙日期：發生日期（權責歸屬；未填視同單據日期）
  await pool.query(`ALTER TABLE finance ADD COLUMN IF NOT EXISTS occurredDate VARCHAR(20)`)
  // 活動管理：projects 擴充活動屬性欄位
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS activityDate VARCHAR(10)`)
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS location VARCHAR(200)`)
  await pool.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS note TEXT`)
  // 活動報名明細（按社友登記參加/用餐/住房/上車地點；統計由前端加總）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS activity_registrations (
      id BIGINT PRIMARY KEY,
      projectId BIGINT NOT NULL,
      memberName VARCHAR(100) NOT NULL,
      attending TINYINT NOT NULL DEFAULT 0,
      meal TINYINT NOT NULL DEFAULT 0,
      room TINYINT NOT NULL DEFAULT 0,
      busStop VARCHAR(100),
      note VARCHAR(255),
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_reg (projectId, memberName)
    ) CHARACTER SET utf8mb4
  `)

  await seedAccounting()
  console.log('DB tables initialized')
}

// 科目表 seed：isSystem=1 者為分錄推導引擎直接引用的科目，不可刪、code/type 不可改。
// INSERT IGNORE 冪等；使用者於設定頁的改名（name）與新增細項不會被覆蓋。
// description 為表單下拉的科目用途說明（既有列為空時會冪等回填）。
const ACCOUNT_SEED = [
  // 資產
  ['1101', '銀行存款-一銀', 'asset', null, { isCash: 1, isSystem: 1 }, '本社一銀活存帳戶；其他銀行帳戶可於科目設定新增（勾選資金帳戶）'],
  ['1111', '應收帳款', 'asset', null, { isSystem: 1, requiresPerson: 1 }, '已開單未收之社費/活動費/代收款（按社友明細，由開單自動產生）'],
  ['1121', '經手人往來', 'asset', null, { isSystem: 1, requiresPerson: 1 }, '幹部/社友代收代付往來（按人明細；資金帳戶選「某人（經手）」自動掛此）'],
  ['1131', '預付費用', 'asset', null, { isSystem: 1 }, '已付款未耗用之費用；支出單填攤提期間自動掛此並逐月攤銷'],
  ['1141', '存出保證金', 'asset', null, {}, '場地、設備等押金'],
  ['1401', '什項設備', 'asset', null, {}, '音響、旗座等社有財產'],
  // 負債
  ['2111', '代收款', 'liability', null, { isSystem: 1, requiresPerson: 1 }, '代收代付案（EREY、總半年費、金蘭房費…），結案付出時沖銷'],
  ['2121', '預收社費', 'liability', null, { isSystem: 1 }, '開單之社費先掛此，權責期間內逐月轉列社費收入（引擎自動）'],
  ['2122', '其他預收收入', 'liability', null, { isSystem: 1 }, '活動費等預收款；收入單填期間自動掛此並逐月轉列'],
  ['2131', '暫收款(社友溢繳)', 'liability', null, { isSystem: 1, requiresPerson: 1 }, '社友溢繳待沖抵（按社友明細）'],
  ['2141', '應付費用', 'liability', null, {}, '已發生尚未付款之費用（手工傳票調整用）'],
  // 權益
  ['3101', '累積餘絀', 'equity', null, { isSystem: 1 }, '歷年收支結餘；年度結轉自動軋入'],
  // 收入
  ['4101', '社費收入', 'income', null, { isSystem: 1 }, '常年社費（開單後權責期間逐月認列）'],
  ['4102', '紅箱收入', 'income', null, {}, '例會歡喜紅箱、節慶紅箱等樂捐'],
  ['4103', '利息收入', 'income', null, {}, '銀行存款利息'],
  ['4104', '其他收入', 'income', null, {}, '不屬於其他收入科目之雜項收入'],
  ['4105', '兌換利益', 'income', null, {}, '外幣兌換產生之利益'],
  ['4106', '入社費收入', 'income', null, {}, '新社友入社費'],
  ['4107', '活動收入', 'income', null, {}, '活動報名費、對外收費等'],
  ['4108', '捐款收入', 'income', null, {}, '社友或外界之一般/指定捐款'],
  ['4109', '補助收入', 'income', null, {}, '地區/國際扶輪獎助金、政府或外界補助款'],
  // 費用（二層：細項掛在科目下，單據只能選葉節點）
  ['5100', '人事費', 'expense', null, {}, '辦事處人員相關費用'],
  ['5101', '薪資支出', 'expense', '5100', {}, '祕書/助理薪資、油資津貼'],
  ['5102', '保險費', 'expense', '5100', {}, '勞保、健保、團保等'],
  ['5103', '退休金', 'expense', '5100', {}, '退休金提撥（含助秘提撥金）'],
  ['5200', '辦公費', 'expense', null, {}, '辦事處日常營運費用'],
  ['5201', '租金支出', 'expense', '5200', {}, '辦公室租金'],
  ['5202', '水電費', 'expense', '5200', {}, '水費、電費、瓦斯費'],
  ['5203', '文具用品', 'expense', '5200', {}, '文具、紙張、辦公耗材'],
  ['5204', '郵電網路費', 'expense', '5200', {}, '郵資、電話費、網路費、資訊系統維護'],
  ['5205', '印刷費', 'expense', '5200', {}, '週報、名冊、文件印刷'],
  ['5206', '銀行手續費', 'expense', '5200', {}, '匯費、轉帳手續費'],
  ['5207', '稅捐規費', 'expense', '5200', {}, '政府規費、稅捐、行政規費'],
  ['5300', '社務活動費', 'expense', null, {}, '例會與社內活動費用'],
  ['5301', '例會餐飲', 'expense', '5300', {}, '一般例會、聯合例會餐費與場地'],
  ['5302', '活動支出', 'expense', '5300', {}, '各項社務活動雜項支出'],
  ['5303', '演講車馬費', 'expense', '5300', {}, '例會講師鐘點費、車馬費'],
  ['5304', '健遊活動', 'expense', '5300', {}, '健行、旅遊等康樂活動'],
  ['5305', '爐邊會', 'expense', '5300', {}, '爐邊會餐費與相關支出'],
  ['5306', '內輪會', 'expense', '5300', {}, '內輪會（寶眷）活動'],
  ['5307', '三社聯誼', 'expense', '5300', {}, '三社/金蘭社聯誼活動'],
  ['5308', '職業參觀', 'expense', '5300', {}, '職業參觀活動'],
  ['5309', '授證之旅', 'expense', '5300', {}, '授證典禮相關差旅、補助'],
  ['5310', '研習補助(高球/Sax)', 'expense', '5300', {}, '社友研習、社團才藝補助'],
  ['5311', 'RYE交換', 'expense', '5300', {}, '青少年交換學生相關支出'],
  ['5312', '友社聯誼註冊費', 'expense', '5300', {}, '友社授證、聯誼活動之註冊費與賀禮'],
  ['5313', '地區年會及訓練註冊費', 'expense', '5300', {}, '地區年會、訓練會、研習會之註冊費'],
  ['5400', '專案計劃支出', 'expense', null, {}, '服務計畫專案支出（可另掛專案類別統計）'],
  ['5401', '扶輪之子', 'expense', '5400', {}, '扶輪之子認養計畫'],
  ['5402', '肺癌篩檢', 'expense', '5400', {}, '肺癌篩檢公益專案'],
  ['5403', '生命橋樑', 'expense', '5400', {}, '生命橋樑助學計畫'],
  ['5404', '尼泊爾義診', 'expense', '5400', {}, '國際義診服務計畫'],
  ['5405', '其他社區服務', 'expense', '5400', {}, '其他社區服務支出'],
  ['5406', '職業服務支出', 'expense', '5400', {}, '職業服務相關計畫'],
  ['5407', '國際服務支出', 'expense', '5400', {}, '國際服務相關計畫'],
  ['5500', '公關費', 'expense', null, {}, '花籃、奠儀、賀禮等對外公關支出'],
  ['5600', '雜項購置', 'expense', null, {}, '小額設備、用品購置與更新'],
  ['5700', '扶輪組織費', 'expense', null, {}, '對國際扶輪與地區之會費分攤（若以本社費用列帳）'],
  ['5701', '國際扶輪社費', 'expense', '5700', {}, 'RI 人頭費/總社半年費（代收代付者請走代收款 2111）'],
  ['5702', '地區分攤金', 'expense', '5700', {}, '地區行政分攤金'],
  ['5703', '扶輪雜誌費', 'expense', '5700', {}, '扶輪月刊/雜誌訂閱費'],
  ['5704', 'RI及基金會捐款', 'expense', '5700', {}, '以社名義對 RI/扶輪基金會之捐款'],
  ['5800', '呆帳費用', 'expense', null, {}, '應收帳款免繳或無法收回之轉銷'],
  ['5900', '其他支出', 'expense', null, {}, '不屬於其他費用科目之雜項支出'],
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
    const [code, name, type, parentCode, opts, description] = ACCOUNT_SEED[i]
    await pool.query(
      `INSERT IGNORE INTO accounts (code, name, type, parentCode, isCash, isSystem, requiresPerson, sortOrder, description) VALUES (?,?,?,?,?,?,?,?,?)`,
      [code, name, type, parentCode, opts.isCash || 0, opts.isSystem || 0, opts.requiresPerson || 0, i, description || null]
    )
    // 既有列的說明為空時回填（不覆蓋使用者自訂內容）
    if (description) {
      await pool.query(
        `UPDATE accounts SET description=? WHERE code=? AND (description IS NULL OR description='')`,
        [description, code]
      )
    }
  }
  for (let i = 0; i < PROJECT_SEED.length; i++) {
    await pool.query(`INSERT IGNORE INTO projects (id, name, sortOrder) VALUES (?,?,?)`, [i + 1, PROJECT_SEED[i], i])
  }
  for (const [k, v] of SETTINGS_SEED) {
    await pool.query(`INSERT IGNORE INTO app_settings (k, v) VALUES (?,?)`, [k, v])
  }
}

module.exports = { pool, initDB }
