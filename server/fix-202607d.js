// 一次性修正（2026-07-22）：名冊排序依「115.7.1第33屆社友暨夫人資料更新及職務5.29.xls」
// 順序寫入 members.sortOrder；雷書維職稱改 卸任社長(IPP)（xls 社名 IPP.Chef）
require('dotenv').config()
const { pool } = require('./db')

// xls Sheet1 序號 1-33 之姓名順序
const ORDER = [
  '林協誠', '沈明哲', '嚴庚辰', '馬季里', '晉茂根', '王献增', '柯順哲', '蔡文森', '王瑞豊',
  '蕭武昌', '張文錫', '許隆誠', '王祈晴', '丁俊廷', '游宜凱', '雷書維', '廖炳麒', '賴彥全',
  '柯建彰', '呂耀宏', '林盟凱', '陳愷澤', '黃家釧', '張慶輝', '曹榮旭', '韓忠信', '劉治平',
  '林嵩堅', '黃淨林', '蕭湧達', '莊村智', '陳明成', '李明釗',
]

async function main() {
  await pool.query(`ALTER TABLE members ADD COLUMN IF NOT EXISTS sortOrder INT`)
  let updated = 0
  for (let i = 0; i < ORDER.length; i++) {
    const [r] = await pool.query(`UPDATE members SET sortOrder=? WHERE name=?`, [i + 1, ORDER[i]])
    if (r.affectedRows) updated++
    else console.warn(`名冊查無：${ORDER[i]}`)
  }
  // 名冊外的社友（如邱顯欽）排在最後
  await pool.query(`UPDATE members SET sortOrder=900 WHERE sortOrder IS NULL`)
  const [ipp] = await pool.query(`UPDATE members SET jobTitle1='卸任社長(IPP)' WHERE name='雷書維'`)
  console.log(`排序寫入 ${updated}/${ORDER.length} 名；雷書維改 IPP：${ipp.affectedRows} 筆`)
  await pool.end()
  console.log('完成')
}

main().catch(e => { console.error(e); process.exit(1) })
