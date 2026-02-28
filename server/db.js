const mysql = require('mysql2/promise')

const pool = mysql.createPool({
  host:     process.env.DB_HOST     || '43.167.238.175',
  port:     parseInt(process.env.DB_PORT) || 30466,
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || 'P5xury6Yf9V3IvTpz21s4Gn0BoENb8q7',
  database: process.env.DB_NAME     || 'zeabur',
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
      standardAmount DECIMAL(12,2)
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
      waivedReason TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_receivable (sourceType, sourceRef, memberName, dueYear)
    ) CHARACTER SET utf8mb4
  `)
  // 為已存在的 users 表補上 role 欄位（MariaDB 支援 IF NOT EXISTS）
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user'`)
  console.log('DB tables initialized')
}

module.exports = { pool, initDB }
