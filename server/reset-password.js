require('dotenv').config()
const bcrypt = require('bcryptjs')
const { pool } = require('./db')

async function main() {
    const [username, password] = process.argv.slice(2)
    if (!username || !password) {
        console.error('用法：node server/reset-password.js <username> <newPassword>')
        process.exit(1)
    }
    const hash = await bcrypt.hash(password, 12)
    const [r] = await pool.query(
        'UPDATE users SET password_hash = ? WHERE username = ?',
        [hash, username]
    )
    if (r.affectedRows === 0) {
        console.error(`找不到使用者 "${username}"`)
    } else {
        console.log(`✅ 已將 "${username}" 的密碼重設`)
    }
    await pool.end()
}

main().catch(e => {
    console.error('重設失敗：', e.message)
    process.exit(1)
})
