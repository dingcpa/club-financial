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

function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: '權限不足，需要管理員身份' });
    next();
}

app.post('/api/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const [rows] = await pool.query('SELECT * FROM users WHERE username=?', [username]);
        if (!rows.length) return res.status(401).json({ error: '帳號或密碼錯誤' });
        const ok = await bcrypt.compare(password, rows[0].password_hash);
        if (!ok) return res.status(401).json({ error: '帳號或密碼錯誤' });
        const token = jwt.sign(
            { id: rows[0].id, username: rows[0].username, displayName: rows[0].display_name, role: rows[0].role },
            JWT_SECRET, { expiresIn: '7d' }
        );
        res.json({ token, displayName: rows[0].display_name, role: rows[0].role });
    } catch (e) {
        res.status(500).json({ error: 'Login failed' });
    }
});

app.get('/api/auth/me', authMiddleware, (req, res) => {
    res.json({ id: req.user.id, username: req.user.username, displayName: req.user.displayName, role: req.user.role });
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
        // 自動為新社員產生所有社費設定的應收
        await generateMemberReceivables(name || '');
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
        // 先查出 memberName 以便刪除 receivables
        const [memberRows] = await pool.query('SELECT name FROM members WHERE id=?', [id]);
        const [result] = await pool.query('DELETE FROM members WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Member not found' });
        // 刪除對應的 pending receivables
        if (memberRows.length > 0) {
            await pool.query(`DELETE FROM receivables WHERE memberName=? AND status='pending'`, [memberRows[0].name]);
        }
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
        // 自動為所有社員產生應收
        await generateDuesReceivables(category, dueDate || '', parseFloat(standardAmount) || 0);
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
            // 同步更新 receivables 的 sourceRef
            await pool.query(
                `UPDATE receivables SET sourceRef=?, amount=?, dueDate=? WHERE sourceType='dues' AND sourceRef=? AND status='pending'`,
                [updated.category, updated.standardAmount, updated.dueDate || null, oldCategory]
            );
        } else {
            await pool.query('UPDATE dues_settings SET ? WHERE category=?', [updated, oldCategory]);
            // 同步更新 pending receivables 的金額和日期
            await pool.query(
                `UPDATE receivables SET amount=?, dueDate=? WHERE sourceType='dues' AND sourceRef=? AND status='pending'`,
                [updated.standardAmount, updated.dueDate || null, oldCategory]
            );
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
        // 刪除對應的 pending receivables
        await pool.query(`DELETE FROM receivables WHERE sourceType='dues' AND sourceRef=? AND status='pending'`, [category]);
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
        // 自動為 targetMembers 產生應收
        await generateAgencyReceivables(newCollection.id, targetMembers, newCollection.createdDate);
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
        // 同步更新 receivable → paid
        await pool.query(
            `UPDATE receivables SET status='paid', paidAmount=?, paidDate=?, updatedAt=NOW() WHERE sourceType='agency' AND sourceRef=? AND memberName=? AND status='pending'`,
            [parseFloat(amount), date || new Date().toISOString().split('T')[0], String(id), memberName]
        );
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
        // 同步回滾 receivable → pending
        await pool.query(
            `UPDATE receivables SET status='pending', paidAmount=NULL, paidDate=NULL, financeId=NULL, updatedAt=NOW() WHERE sourceType='agency' AND sourceRef=? AND memberName=? AND status='paid'`,
            [String(id), memberName]
        );
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
        // 刪除對應的 pending receivables
        await pool.query(`DELETE FROM receivables WHERE sourceType='agency' AND sourceRef=? AND status='pending'`, [String(id)]);
        res.json({ message: 'Collection deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

// ─── Receivables (應收帳款) ─────────────────────────────────
function parseReceivable(row) {
    return {
        ...row,
        amount: parseFloat(row.amount) || 0,
        paidAmount: row.paidAmount != null ? parseFloat(row.paidAmount) : null,
    };
}

// 輔助：為社費設定產生所有社員的應收
async function generateDuesReceivables(category, dueDate, standardAmount) {
    const dueYear = dueDate ? dueDate.substring(0, 4) : new Date().getFullYear().toString();
    const [members] = await pool.query('SELECT name FROM members');
    const results = [];
    for (let i = 0; i < members.length; i++) {
        const id = Date.now() + i;
        try {
            await pool.query(
                `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status) VALUES (?,?,?,?,?,?,?,?)`,
                [id, 'dues', category, members[i].name, parseFloat(standardAmount), dueDate || null, dueYear, 'pending']
            );
            results.push({ id, memberName: members[i].name });
        } catch (e) { /* UNIQUE conflict, skip */ }
    }
    return results;
}

// 輔助：為新社員產生所有社費設定的應收
async function generateMemberReceivables(memberName) {
    const currentYear = new Date().getFullYear().toString();
    const [settings] = await pool.query('SELECT * FROM dues_settings');
    const results = [];
    for (let i = 0; i < settings.length; i++) {
        const s = settings[i];
        const dueYear = s.dueDate ? s.dueDate.substring(0, 4) : currentYear;
        const id = Date.now() + i;
        try {
            await pool.query(
                `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status) VALUES (?,?,?,?,?,?,?,?)`,
                [id, 'dues', s.category, memberName, parseFloat(s.standardAmount), s.dueDate || null, dueYear, 'pending']
            );
            results.push({ id, category: s.category });
        } catch (e) { /* UNIQUE conflict, skip */ }
    }
    return results;
}

// 輔助：為代收代付產生應收
async function generateAgencyReceivables(collectionId, targetMembers, createdDate) {
    const dueYear = createdDate ? createdDate.substring(0, 4) : new Date().getFullYear().toString();
    const results = [];
    for (let i = 0; i < targetMembers.length; i++) {
        const t = targetMembers[i];
        const id = Date.now() + i;
        try {
            await pool.query(
                `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status) VALUES (?,?,?,?,?,?,?,?)`,
                [id, 'agency', String(collectionId), t.name, parseFloat(t.amount), createdDate || null, dueYear, 'pending']
            );
            results.push({ id, memberName: t.name });
        } catch (e) { /* UNIQUE conflict, skip */ }
    }
    return results;
}

// 查詢應收列表
app.get('/api/receivables', async (req, res) => {
    try {
        const { year, member, status, sourceType } = req.query;
        let sql = 'SELECT * FROM receivables WHERE 1=1';
        const params = [];
        if (year) { sql += ' AND dueYear=?'; params.push(year); }
        if (member) { sql += ' AND memberName=?'; params.push(member); }
        if (status) { sql += ' AND status=?'; params.push(status); }
        if (sourceType) { sql += ' AND sourceType=?'; params.push(sourceType); }
        sql += ' ORDER BY dueDate ASC, memberName ASC';
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(parseReceivable));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read receivables' });
    }
});

// 特定社友的未沖帳應收（IncomeForm 用）
app.get('/api/receivables/outstanding/:memberName', async (req, res) => {
    try {
        const memberName = decodeURIComponent(req.params.memberName);
        const [rows] = await pool.query(
            `SELECT * FROM receivables WHERE memberName=? AND status='pending' ORDER BY dueDate ASC`,
            [memberName]
        );
        res.json(rows.map(parseReceivable));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read outstanding receivables' });
    }
});

// 批次沖帳（核心 API）
app.post('/api/receivables/settle-batch', async (req, res) => {
    try {
        const { memberName, date, account, receivableIds, receivedAmount, prevOverpayment, remark } = req.body;
        if (!memberName || !date || !account || !receivableIds?.length) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 查出指定的 receivables
        const placeholders = receivableIds.map(() => '?').join(',');
        const [receivables] = await pool.query(
            `SELECT * FROM receivables WHERE id IN (${placeholders}) AND status='pending'`,
            receivableIds
        );

        // 依序沖抵（與前端 computeSettlement 邏輯一致）
        const total = (parseFloat(receivedAmount) || 0) + (parseFloat(prevOverpayment) || 0);
        let remaining = total;
        const settled = [];
        const skipped = [];
        for (const r of receivables) {
            const amt = parseFloat(r.amount);
            if (remaining >= amt) {
                settled.push(r);
                remaining -= amt;
            } else {
                skipped.push(r);
            }
        }

        const financeRecords = [];
        const selYear = date.split('-')[0];

        // 社費已沖項 → 產生 finance income 記錄 + 更新 receivable
        const duesSettled = settled.filter(r => r.sourceType === 'dues');
        for (let i = 0; i < duesSettled.length; i++) {
            const r = duesSettled[i];
            const amt = parseFloat(r.amount);
            // 自動判斷平攤區間
            const auto = getAutoPeriodServer(r.sourceRef);
            const financeId = Date.now() + i;
            const record = {
                id: financeId,
                type: 'income',
                date,
                item: r.sourceRef,
                member: memberName,
                account,
                amount: amt,
                remark: remark || '',
                startPeriod: auto ? `${selYear}-${auto.start}` : null,
                endPeriod: auto ? `${selYear}-${auto.end}` : null,
                fromAccount: '',
                toAccount: '',
            };
            await pool.query('INSERT INTO finance SET ?', [record]);
            await pool.query(
                `UPDATE receivables SET status='paid', paidAmount=?, paidDate=?, financeId=?, updatedAt=NOW() WHERE id=?`,
                [amt, date, financeId, r.id]
            );
            financeRecords.push(record);
        }

        // 代收已沖項 → 更新 agency_collections paidMembers + receivable
        const agencySettled = settled.filter(r => r.sourceType === 'agency');
        for (const r of agencySettled) {
            const agencyId = parseInt(r.sourceRef);
            const amt = parseFloat(r.amount);
            // 更新 agency_collections paidMembers
            const [agRows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [agencyId]);
            if (agRows.length > 0) {
                const col = parseCollection(agRows[0]);
                col.paidMembers.push({ memberName, date, amount: amt });
                await pool.query('UPDATE agency_collections SET paidMembers=? WHERE id=?',
                    [JSON.stringify(col.paidMembers), agencyId]);
            }
            await pool.query(
                `UPDATE receivables SET status='paid', paidAmount=?, paidDate=?, updatedAt=NOW() WHERE id=?`,
                [amt, date, r.id]
            );
        }

        // 溢收款處理
        const extraRecords = [];
        const baseTs = Date.now() + duesSettled.length + 100;
        if ((parseFloat(prevOverpayment) || 0) > 0) {
            const rec = {
                id: baseTs,
                type: 'income', date, item: '溢收款', member: memberName, account,
                amount: -(parseFloat(prevOverpayment)), remark: '前期溢收款結清（沖抵本次收款計算）',
                startPeriod: null, endPeriod: null, fromAccount: '', toAccount: '',
            };
            await pool.query('INSERT INTO finance SET ?', [rec]);
            extraRecords.push(rec);
        }
        if (remaining > 0) {
            const rec = {
                id: baseTs + 1,
                type: 'income', date, item: '溢收款', member: memberName, account,
                amount: remaining,
                remark: `溢收款（收款 ${(parseFloat(receivedAmount) || 0).toLocaleString()}，超出已沖項目總額）`,
                startPeriod: null, endPeriod: null, fromAccount: '', toAccount: '',
            };
            await pool.query('INSERT INTO finance SET ?', [rec]);
            extraRecords.push(rec);
        }

        res.json({
            settled: settled.map(parseReceivable),
            skipped: skipped.map(parseReceivable),
            surplus: remaining,
            financeRecords: [...financeRecords, ...extraRecords].map(parseFinance),
        });
    } catch (e) {
        console.error('Error in settle-batch:', e);
        res.status(500).json({ error: 'Failed to settle receivables' });
    }
});

// 免繳
app.put('/api/receivables/:id/waive', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { waivedReason } = req.body || {};
        const [rows] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Receivable not found' });
        if (rows[0].status !== 'pending') return res.status(400).json({ error: '只有 pending 狀態可免繳' });
        await pool.query(
            `UPDATE receivables SET status='waived', waivedReason=?, updatedAt=NOW() WHERE id=?`,
            [waivedReason || '', id]
        );
        const [updated] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        res.json(parseReceivable(updated[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to waive receivable' });
    }
});

// 重新開立（撤銷 paid/waived）
app.put('/api/receivables/:id/reopen', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Receivable not found' });
        if (rows[0].status === 'pending') return res.status(400).json({ error: '已是 pending 狀態' });
        await pool.query(
            `UPDATE receivables SET status='pending', paidAmount=NULL, paidDate=NULL, financeId=NULL, waivedReason=NULL, updatedAt=NOW() WHERE id=?`,
            [id]
        );
        const [updated] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        res.json(parseReceivable(updated[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to reopen receivable' });
    }
});

// 手動觸發產生（遷移/補建用）
app.post('/api/receivables/generate', async (req, res) => {
    try {
        const currentYear = new Date().getFullYear().toString();
        const [settings] = await pool.query('SELECT * FROM dues_settings');
        const [members] = await pool.query('SELECT name FROM members');
        const [agencies] = await pool.query('SELECT * FROM agency_collections');
        let count = 0;

        // 社費 × 社員
        for (const s of settings) {
            const dueYear = s.dueDate ? s.dueDate.substring(0, 4) : currentYear;
            for (const m of members) {
                try {
                    await pool.query(
                        `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status) VALUES (?,?,?,?,?,?,?,?)`,
                        [Date.now() + count, 'dues', s.category, m.name, parseFloat(s.standardAmount), s.dueDate || null, dueYear, 'pending']
                    );
                    count++;
                } catch (e) { /* skip */ }
            }
        }

        // 代收代付
        for (const a of agencies) {
            const targets = JSON.parse(a.targetMembers || '[]');
            const dueYear = a.createdDate ? a.createdDate.substring(0, 4) : currentYear;
            for (const t of targets) {
                try {
                    await pool.query(
                        `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status) VALUES (?,?,?,?,?,?,?,?)`,
                        [Date.now() + count, 'agency', String(a.id), t.name, parseFloat(t.amount), a.createdDate || null, dueYear, 'pending']
                    );
                    count++;
                } catch (e) { /* skip */ }
            }
        }

        res.json({ message: `產生完成，共 ${count} 筆`, count });
    } catch (e) {
        res.status(500).json({ error: 'Failed to generate receivables' });
    }
});

// 後端用：自動判斷社費項目的平攤區間
function getAutoPeriodServer(itemName) {
    const match = itemName.match(/^(\d{1,2})-(\d{1,2})月/);
    if (!match) return null;
    return {
        start: match[1].padStart(2, '0'),
        end:   match[2].padStart(2, '0'),
    };
}

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
app.get('/api/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, username, display_name, role, created_at FROM users ORDER BY created_at ASC'
        );
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read users' });
    }
});

app.post('/api/users', authMiddleware, adminOnly, async (req, res) => {
    try {
        const { username, password, displayName, role = 'user' } = req.body;
        if (!username || !password) return res.status(400).json({ error: '帳號與密碼為必填' });
        if (!['admin', 'user'].includes(role)) return res.status(400).json({ error: '角色必須為 admin 或 user' });
        const hash = await bcrypt.hash(password, 12);
        await pool.query(
            'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
            [username, hash, displayName || username, role]
        );
        res.status(201).json({ message: '使用者建立成功' });
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '帳號已存在' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.put('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { password, displayName, role } = req.body;
        // 不可修改自己的角色（防止自己降權）
        if (role && id === req.user.id) return res.status(400).json({ error: '不可修改自己的角色' });
        if (role && !['admin', 'user'].includes(role)) return res.status(400).json({ error: '角色必須為 admin 或 user' });
        const sets = [];
        const params = [];
        if (displayName !== undefined) { sets.push('display_name=?'); params.push(displayName); }
        if (role)     { sets.push('role=?');         params.push(role); }
        if (password) { sets.push('password_hash=?'); params.push(await bcrypt.hash(password, 12)); }
        if (sets.length === 0) return res.status(400).json({ error: '無可更新欄位' });
        params.push(id);
        await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id=?`, params);
        res.json({ message: '更新成功' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/users/:id', authMiddleware, adminOnly, async (req, res) => {
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
