require('dotenv').config()
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// Serve Vue frontend static files
const clientDist = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(clientDist)) {
    app.use(express.static(clientDist));
}

// ─── Auth ───────────────────────────────────────────────────
function authMiddleware(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    try {
        req.user = jwt.verify(auth.slice(7), JWT_SECRET);
        next();
    } catch {
        res.status(401).json({ error: 'Token 無效或已過期' });
    }
}

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username]);
        if (!rows.length) return res.status(401).json({ error: '帳號或密碼錯誤' });
        const ok = await bcrypt.compare(password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: '帳號或密碼錯誤' });
        const token = jwt.sign(
            { id: rows[0].id, username: rows[0].username, displayName: rows[0].display_name },
            JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({ token, displayName: rows[0].display_name });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username, displayName: req.user.displayName });
});

// 所有 /api 路由（除 /api/auth/login）均需 token
app.use('/api', authMiddleware);

// ─── Helpers ───────────────────────────────────────────────
function parseCollection(row) {
    return {
        ...row,
        closedAmount:  parseFloat(row.closedAmount) || null,
        targetMembers: JSON.parse(row.targetMembers || '[]'),
        paidMembers:   JSON.parse(row.paidMembers   || '[]'),
    };
}

function parseFinance(row) {
    return { ...row, amount: parseFloat(row.amount) || 0 };
}

// ─── Members ───────────────────────────────────────────────
app.get('/api/members', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM members');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read members' });
    }
});

app.post('/api/members', async (req, res) => {
    try {
        const { name, nickname, birthday, email, phone, mobile, address, jobTitle1, jobTitle2 } = req.body;
        console.log('Incoming POST member:', req.body);
        const newMember = {
            id: Date.now(),
            name: name || '',
            nickname: nickname || '',
            birthday: birthday || '',
            email: email || '',
            phone: phone || '',
            mobile: mobile || '',
            address: address || '',
            jobTitle1: jobTitle1 || '',
            jobTitle2: jobTitle2 || ''
        };
        await pool.query('INSERT INTO members SET ?', [newMember]);
        res.status(201).json(newMember);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add member' });
    }
});

app.put('/api/members/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
        const updates = req.body;
        console.log(`Incoming PUT member ID ${id}:`, updates);
        const [result] = await pool.query('UPDATE members SET ? WHERE id=?', [updates, id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Member not found' });
        const [rows] = await pool.query('SELECT * FROM members WHERE id=?', [id]);
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update member' });
    }
});

app.delete('/api/members/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
        console.log(`Incoming DELETE member ID ${id}`);
        const [result] = await pool.query('DELETE FROM members WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Member not found' });
        res.json({ message: 'Member deleted successfully' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// ─── Dues Settings ─────────────────────────────────────────
app.get('/api/dues-settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM dues_settings');
        res.json(rows.map(r => ({ ...r, standardAmount: parseFloat(r.standardAmount) || 0 })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read dues settings' });
    }
});

app.post('/api/dues-settings', async (req, res) => {
    try {
        const { category, dueDate, standardAmount } = req.body;
        const [existing] = await pool.query('SELECT category FROM dues_settings WHERE category=?', [category]);
        if (existing.length > 0) return res.status(400).json({ error: 'Category already exists' });
        const newSetting = { category, dueDate: dueDate || '', standardAmount: parseFloat(standardAmount) || 0 };
        await pool.query('INSERT INTO dues_settings SET ?', [newSetting]);
        res.status(201).json(newSetting);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add dues setting' });
    }
});

app.put('/api/dues-settings/:category', async (req, res) => {
    try {
        const oldCategory = req.params.category;
        const { category, dueDate, standardAmount } = req.body;
        const [rows] = await pool.query('SELECT * FROM dues_settings WHERE category=?', [oldCategory]);
        if (rows.length === 0) return res.status(404).json({ error: 'Setting not found' });
        const current = rows[0];
        const updated = {
            category:       category       !== undefined ? category       : current.category,
            dueDate:        dueDate        !== undefined ? dueDate        : current.dueDate,
            standardAmount: standardAmount !== undefined ? parseFloat(standardAmount) : current.standardAmount,
        };
        if (updated.category !== oldCategory) {
            // Category rename: insert new row then delete old
            await pool.query('INSERT INTO dues_settings SET ?', [updated]);
            await pool.query('DELETE FROM dues_settings WHERE category=?', [oldCategory]);
        } else {
            await pool.query('UPDATE dues_settings SET ? WHERE category=?', [updated, oldCategory]);
        }
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update dues setting' });
    }
});

app.delete('/api/dues-settings/:category', async (req, res) => {
    try {
        const category = req.params.category;
        await pool.query('DELETE FROM dues_settings WHERE category=?', [category]);
        res.json({ message: 'Setting deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete dues setting' });
    }
});

// ─── Finance ───────────────────────────────────────────────
app.get('/api/finance', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM finance ORDER BY date DESC');
        res.json(rows.map(parseFinance));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/finance', async (req, res) => {
    try {
        const { type, date, item, amount, remark, member, account, fromAccount, toAccount, startPeriod, endPeriod } = req.body;
        console.log('Incoming POST request:', req.body);
        if (!type || !date || !item || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const newRecord = {
            id: Date.now(),
            type, date, item,
            member:      member      || '',
            account:     account     || '',
            fromAccount: fromAccount || '',
            toAccount:   toAccount   || '',
            amount:      parseFloat(amount),
            remark:      remark      || '',
            startPeriod: startPeriod || null,
            endPeriod:   endPeriod   || null,
        };
        console.log('Saving new record:', newRecord);
        await pool.query('INSERT INTO finance SET ?', [newRecord]);
        res.status(201).json(newRecord);
    } catch (e) {
        console.error('Error saving data:', e);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.post('/api/finance/batch', async (req, res) => {
    try {
        const records = req.body;
        if (!Array.isArray(records)) return res.status(400).json({ error: 'Payload must be an array' });
        const newRecords = records.map((r, i) => ({
            ...r,
            id:     Date.now() + i,
            amount: parseFloat(r.amount) || 0,
        }));
        for (const r of newRecords) {
            await pool.query('INSERT INTO finance SET ?', [r]);
        }
        res.status(201).json(newRecords);
    } catch (e) {
        console.error('Error saving batch data:', e);
        res.status(500).json({ error: 'Failed to save batch data' });
    }
});

app.put('/api/finance/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { date, item, amount, remark, member, account, fromAccount, toAccount, startPeriod, endPeriod } = req.body;
        console.log(`\n>>> INCOMING PUT REQUEST FOR ID ${id}`);
        const [rows] = await pool.query('SELECT * FROM finance WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        const current = rows[0];
        const updated = {
            date:        date        || current.date,
            item:        item        || current.item,
            member:      member      !== undefined ? member      : (current.member || ''),
            amount:      amount      !== undefined ? parseFloat(amount) : current.amount,
            remark:      remark      !== undefined ? remark      : (current.remark || ''),
            account:     account     !== undefined ? account     : (current.account || ''),
            fromAccount: fromAccount !== undefined ? fromAccount : (current.fromAccount || ''),
            toAccount:   toAccount   !== undefined ? toAccount   : (current.toAccount || ''),
            startPeriod: startPeriod !== undefined ? startPeriod : current.startPeriod,
            endPeriod:   endPeriod   !== undefined ? endPeriod   : current.endPeriod,
        };
        await pool.query('UPDATE finance SET ? WHERE id=?', [updated, id]);
        res.json({ ...current, ...updated });
    } catch (e) {
        console.error('Error updating data:', e);
        res.status(500).json({ error: 'Failed to update data' });
    }
});

app.delete('/api/finance/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        console.log(`Incoming DELETE request for ID ${id}`);
        const [result] = await pool.query('DELETE FROM finance WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
        res.json({ message: 'Record deleted successfully' });
    } catch (e) {
        console.error('Error deleting data:', e);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// ─── Agency Collections ────────────────────────────────────
app.get('/api/agency-collections', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM agency_collections ORDER BY createdDate DESC');
        res.json(rows.map(parseCollection));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read agency collections' });
    }
});

app.post('/api/agency-collections', async (req, res) => {
    try {
        const { title, targetMembers, remark } = req.body || {};
        if (!title || !targetMembers || !Array.isArray(targetMembers) || targetMembers.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const newCollection = {
            id:            Date.now(),
            title,
            targetMembers: JSON.stringify(targetMembers),
            paidMembers:   JSON.stringify([]),
            status:        'open',
            createdDate:   new Date().toISOString().split('T')[0],
            closedDate:    null,
            closedAmount:  null,
            remark:        remark || '',
        };
        await pool.query('INSERT INTO agency_collections SET ?', [newCollection]);
        res.status(201).json(parseCollection(newCollection));
    } catch (e) {
        res.status(500).json({ error: 'Failed to create agency collection' });
    }
});

app.put('/api/agency-collections/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
        await pool.query('UPDATE agency_collections SET ? WHERE id=?', [req.body, id]);
        const [updated] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        res.json(parseCollection(updated[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to update agency collection' });
    }
});

app.post('/api/agency-collections/:id/pay', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { memberName, date, amount } = req.body;
        const [rows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
        const collection = parseCollection(rows[0]);
        collection.paidMembers.push({
            memberName,
            date: date || new Date().toISOString().split('T')[0],
            amount: parseFloat(amount),
        });
        await pool.query('UPDATE agency_collections SET paidMembers=? WHERE id=?',
            [JSON.stringify(collection.paidMembers), id]);
        res.json(collection);
    } catch (e) {
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

app.delete('/api/agency-collections/:id/pay/:memberName', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const memberName = decodeURIComponent(req.params.memberName);
        const [rows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
        const collection = parseCollection(rows[0]);
        collection.paidMembers = collection.paidMembers.filter(p => p.memberName !== memberName);
        await pool.query('UPDATE agency_collections SET paidMembers=? WHERE id=?',
            [JSON.stringify(collection.paidMembers), id]);
        res.json(collection);
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove payment' });
    }
});

app.post('/api/agency-collections/:id/close', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { closedAmount, closedRemark } = req.body;
        const [rows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
        const closeData = {
            status:       'closed',
            closedDate:   new Date().toISOString().split('T')[0],
            closedAmount: parseFloat(closedAmount) || 0,
            closedRemark: closedRemark || '',
        };
        await pool.query('UPDATE agency_collections SET ? WHERE id=?', [closeData, id]);
        const [updated] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        res.json(parseCollection(updated[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to close collection' });
    }
});

app.delete('/api/agency-collections/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        await pool.query('DELETE FROM agency_collections WHERE id=?', [id]);
        res.json({ message: 'Collection deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

// ─── Debug ─────────────────────────────────────────────────
app.get('/api/debug', async (req, res) => {
    try {
        const [[{ count }]] = await pool.query('SELECT COUNT(*) as count FROM finance');
        res.json({
            serverVersion: 'v3.0-MariaDB',
            timestamp: new Date().toISOString(),
            count,
        });
    } catch (e) {
        res.status(500).json({ error: 'Debug failed' });
    }
});

// ─── Users ─────────────────────────────────────────────────
app.get('/api/users', authMiddleware, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, display_name, created_at FROM users ORDER BY created_at ASC'
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read users' });
    }
});

app.post('/api/users', authMiddleware, async (req, res) => {
    try {
        const { username, password, displayName } = req.body;
        if (!username || !password) return res.status(400).json({ error: '帳號與密碼為必填' });
        const hash = await bcrypt.hash(password, 12);
        await pool.query(
            'INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)',
            [username, hash, displayName || username]
        );
        res.status(201).json({ message: '使用者建立成功' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '帳號已存在' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { password, displayName } = req.body;
        if (password) {
            const hash = await bcrypt.hash(password, 12);
            await pool.query(
                'UPDATE users SET password_hash=?, display_name=? WHERE id=?',
                [hash, displayName, id]
            );
        } else {
            await pool.query('UPDATE users SET display_name=? WHERE id=?', [displayName, id]);
        }
        res.json({ message: '更新成功' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.id) return res.status(400).json({ error: '不可刪除自己的帳號' });
        const [result] = await pool.query('DELETE FROM users WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: '刪除成功' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// ─── SPA fallback ──────────────────────────────────────────
app.get('/{*path}', (req, res) => {
    const indexFile = path.join(__dirname, '../client/dist/index.html');
    if (require('fs').existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send('Frontend not built yet');
    }
});

// ─── Start ─────────────────────────────────────────────────
async function start() {
    await initDB();
    app.listen(PORT, () => {
        console.log(`=========================================`);
        console.log(`Server v3.0-MariaDB started at ${new Date().toISOString()}`);
        console.log(`Listening on port ${PORT}`);
        console.log(`=========================================`);
    });
}

start().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
