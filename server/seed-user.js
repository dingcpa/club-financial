require('dotenv').config()
const bcrypt = require('bcryptjs')
const { pool, initDB } = require('./db')

async function main() {
    const [username, password, displayName] = process.argv.slice(2)
    if (!username || !password) {
        console.error('用法：node server/seed-user.js <username> <password> [displayName]')
        process.exit(1)
    }
    await initDB()
    const hash = await bcrypt.hash(password, 12)
    await pool.query(
        'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
        [username, hash, displayName || username]
    )
    console.log(`✅ 使用者 "${username}" 建立成功`)
    await pool.end()
}

main().catch(e => {
    console.error('建立失敗：', e.message)
    process.exit(1)
})
