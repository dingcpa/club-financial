require('dotenv').config()
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDB } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    throw new Error('缺少必要的環境變數 JWT_SECRET（請設定 .env 或部署平台的 Variables）');
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
// 保留原始 body 供 LINE webhook 簽章驗證
app.use(bodyParser.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));

// LINE 財務精靈（設定 ROTARY_* 環境變數才掛載；LINE 簽章即其驗證，不走 JWT）
const lineBot = require('./line-bot');
if (lineBot.mount(app)) {
    console.log('LINE 財務精靈 mounted at /line/webhook');
}

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

function buildMemberRow(body, id) {
    const { name, nickname, birthday, email, phone, mobile, address, jobTitle1, jobTitle2, status, leaveDate, bankAccountLast5 } = body;
    return {
        id,
        name: name || '',
        nickname: nickname || '',
        birthday: birthday || '',
        email: email || '',
        phone: phone || '',
        mobile: mobile || '',
        address: address || '',
        jobTitle1: jobTitle1 || '',
        jobTitle2: jobTitle2 || '',
        status: status === 'left' ? 'left' : 'active',
        leaveDate: leaveDate || null,
        bankAccountLast5: bankAccountLast5 ? String(bankAccountLast5).trim() : null,
    };
}

app.post('/api/members', async (req, res) => {
    try {
        const newMember = buildMemberRow(req.body, Date.now());
        await pool.query('INSERT INTO members SET ?', [newMember]);
        res.status(201).json(newMember);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add member' });
    }
});

// 名冊批次匯入（Excel 解析後的陣列；以姓名 upsert：同名更新、無則新增）
app.post('/api/members/batch-import', async (req, res) => {
    try {
        const rows = req.body;
        if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'Payload must be a non-empty array' });
        const [existing] = await pool.query('SELECT id, name FROM members');
        const byName = Object.fromEntries(existing.map(m => [m.name, m.id]));
        let created = 0, updated = 0, skipped = 0;
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const name = (r.name || '').trim();
            if (!name) { skipped++; continue; }
            // 只更新有提供的欄位，避免範本空欄清掉既有資料
            const fields = {};
            for (const k of ['nickname', 'birthday', 'email', 'phone', 'mobile', 'address', 'jobTitle1', 'jobTitle2', 'bankAccountLast5', 'status', 'leaveDate']) {
                if (r[k] !== undefined && r[k] !== null && String(r[k]).trim() !== '') fields[k] = String(r[k]).trim();
            }
            if (fields.status) fields.status = fields.status === 'left' || fields.status === '退社' ? 'left' : 'active';
            if (byName[name]) {
                if (Object.keys(fields).length) await pool.query('UPDATE members SET ? WHERE id=?', [fields, byName[name]]);
                updated++;
            } else {
                await pool.query('INSERT INTO members SET ?', [buildMemberRow({ ...fields, name }, Date.now() + i)]);
                created++;
            }
        }
        res.json({ created, updated, skipped });
    } catch (e) {
        console.error('Error in members batch-import:', e);
        res.status(500).json({ error: 'Failed to import members' });
    }
});

app.put('/api/members/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) return res.status(400).json({ error: 'Invalid ID format' });
        const updates = req.body;
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
        const { category, dueDate, standardAmount, kind, incomeAccount, accountCode, periodMonths } = req.body;
        const [existing] = await pool.query('SELECT category FROM dues_settings WHERE category=?', [category]);
        if (existing.length > 0) return res.status(400).json({ error: 'Category already exists' });
        const newSetting = {
            category,
            dueDate: dueDate || '',
            standardAmount: parseFloat(standardAmount) || 0,
            kind: kind || 'dues',
            incomeAccount: incomeAccount || null,
            accountCode: accountCode || null,
            periodMonths: periodMonths ? parseInt(periodMonths) : null,
        };
        await pool.query('INSERT INTO dues_settings SET ?', [newSetting]);
        // 不再自動為全體社員開單——開單改由「應收帳款」頁明確批次產生
        res.status(201).json(newSetting);
    } catch (e) {
        res.status(500).json({ error: 'Failed to add dues setting' });
    }
});

app.put('/api/dues-settings/:category', async (req, res) => {
    try {
        const oldCategory = req.params.category;
        const { category, dueDate, standardAmount, kind, incomeAccount, accountCode, periodMonths } = req.body;
        const [rows] = await pool.query('SELECT * FROM dues_settings WHERE category=?', [oldCategory]);
        if (rows.length === 0) return res.status(404).json({ error: 'Setting not found' });
        const current = rows[0];
        const updated = {
            category:       category       !== undefined ? category       : current.category,
            dueDate:        dueDate        !== undefined ? dueDate        : current.dueDate,
            standardAmount: standardAmount !== undefined ? parseFloat(standardAmount) : current.standardAmount,
            kind:           kind           !== undefined ? kind           : (current.kind || 'dues'),
            incomeAccount:  incomeAccount  !== undefined ? incomeAccount  : (current.incomeAccount || null),
            accountCode:    accountCode    !== undefined ? (accountCode || null) : (current.accountCode || null),
            periodMonths:   periodMonths   !== undefined ? (periodMonths ? parseInt(periodMonths) : null) : (current.periodMonths || null),
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
        const { type, date, item, amount, remark, member, account, fromAccount, toAccount, startPeriod, endPeriod, accountCode, projectId, sourceReceivableId, occurredDate } = req.body;
        if (!type || !date || !item || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const newRecord = {
            id: Date.now(),
            type, date, item,
            occurredDate: occurredDate || null,
            member:      member      || '',
            account:     account     || '',
            fromAccount: fromAccount || '',
            toAccount:   toAccount   || '',
            amount:      parseFloat(amount),
            remark:      remark      || '',
            startPeriod: startPeriod || null,
            endPeriod:   endPeriod   || null,
            accountCode: accountCode || null,
            projectId:   projectId   || null,
            sourceReceivableId: sourceReceivableId || null,
        };
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
        const { date, item, amount, remark, member, account, fromAccount, toAccount, startPeriod, endPeriod, accountCode, projectId, occurredDate } = req.body;
        const [rows] = await pool.query('SELECT * FROM finance WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Record not found' });
        const current = rows[0];
        const updated = {
            date:        date        || current.date,
            occurredDate: occurredDate !== undefined ? (occurredDate || null) : current.occurredDate,
            item:        item        || current.item,
            member:      member      !== undefined ? member      : (current.member || ''),
            amount:      amount      !== undefined ? parseFloat(amount) : current.amount,
            remark:      remark      !== undefined ? remark      : (current.remark || ''),
            account:     account     !== undefined ? account     : (current.account || ''),
            fromAccount: fromAccount !== undefined ? fromAccount : (current.fromAccount || ''),
            toAccount:   toAccount   !== undefined ? toAccount   : (current.toAccount || ''),
            startPeriod: startPeriod !== undefined ? startPeriod : current.startPeriod,
            endPeriod:   endPeriod   !== undefined ? endPeriod   : current.endPeriod,
            accountCode: accountCode !== undefined ? (accountCode || null) : current.accountCode,
            projectId:   projectId   !== undefined ? (projectId   || null) : current.projectId,
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
        const [rows] = await pool.query('SELECT * FROM finance WHERE id=?', [id]);
        const [result] = await pool.query('DELETE FROM finance WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
        // 刪除收款單 → 同步回退應收帳款的已收金額與狀態
        if (rows.length && rows[0].sourceReceivableId) {
            const [rv] = await pool.query('SELECT * FROM receivables WHERE id=?', [rows[0].sourceReceivableId]);
            if (rv.length) {
                const total = parseFloat(rv[0].amount) || 0;
                const newPaid = Math.max(0, (parseFloat(rv[0].paidAmount) || 0) - (parseFloat(rows[0].amount) || 0));
                const newStatus = newPaid <= 0 ? 'pending' : (newPaid >= total ? 'paid' : 'partial');
                await pool.query(
                    `UPDATE receivables SET status=?, paidAmount=?, paidDate=IF(?<=0, NULL, paidDate), financeId=IF(?<=0, NULL, financeId), updatedAt=NOW() WHERE id=?`,
                    [newStatus, newPaid <= 0 ? null : newPaid, newPaid, newPaid, rv[0].id]
                );
            }
        }
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
        const { memberName, date, amount, account } = req.body;
        const [rows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
        const collection = parseCollection(rows[0]);
        const payDate = date || new Date().toISOString().split('T')[0];
        collection.paidMembers.push({ memberName, date: payDate, amount: parseFloat(amount) });
        await pool.query('UPDATE agency_collections SET paidMembers=? WHERE id=?',
            [JSON.stringify(collection.paidMembers), id]);
        // 產生收款單（借資金/貸應收）＋ receivable → paid，代收現金流完整入帳
        const [recvRows] = await pool.query(
            `SELECT * FROM receivables WHERE sourceType='agency' AND sourceRef=? AND memberName=? AND status='pending'`,
            [String(id), memberName]
        );
        if (recvRows.length > 0) {
            const recv = recvRows[0];
            const financeId = Date.now();
            await pool.query('INSERT INTO finance SET ?', [{
                id: financeId,
                type: 'income',
                date: payDate,
                item: collection.title,
                member: memberName,
                account: account || '經手人:陳淑華',
                amount: parseFloat(amount),
                remark: '代收款收款',
                fromAccount: '', toAccount: '',
                startPeriod: null, endPeriod: null,
                accountCode: recv.accountCode || '2111',
                sourceReceivableId: recv.id,
            }]);
            await pool.query(
                `UPDATE receivables SET status='paid', paidAmount=?, paidDate=?, financeId=?, updatedAt=NOW() WHERE id=?`,
                [parseFloat(amount), payDate, financeId, recv.id]
            );
        }
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
        // 同步回滾 receivable → pending，並刪除已產生的收款單
        const [recvRows] = await pool.query(
            `SELECT id FROM receivables WHERE sourceType='agency' AND sourceRef=? AND memberName=? AND status='paid'`,
            [String(id), memberName]
        );
        for (const recv of recvRows) {
            await pool.query('DELETE FROM finance WHERE sourceReceivableId=?', [recv.id]);
        }
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
        const { closedAmount, closedRemark, payAccount } = req.body;
        const [rows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Collection not found' });
        const closeData = {
            status:       'closed',
            closedDate:   new Date().toISOString().split('T')[0],
            closedAmount: parseFloat(closedAmount) || 0,
            closedRemark: closedRemark || '',
        };
        await pool.query('UPDATE agency_collections SET ? WHERE id=?', [closeData, id]);
        // 結案付出：產生支出單（accountCode=2111 代收款），沖銷代收款負債並記資金流出
        if (payAccount && closeData.closedAmount > 0) {
            await pool.query('INSERT INTO finance SET ?', [{
                id: Date.now(),
                type: 'expense',
                date: closeData.closedDate,
                item: rows[0].title,
                member: rows[0].title,
                account: payAccount,
                amount: closeData.closedAmount,
                remark: `代收款結案付出${closedRemark ? '：' + closedRemark : ''}`,
                fromAccount: '', toAccount: '',
                startPeriod: null, endPeriod: null,
                accountCode: '2111',
            }]);
        }
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

        // 已沖項 → 一律產生 finance「收款單」（sourceReceivableId 標記，引擎推導為借資金/貸應收，
        // 不認列收入——收入由開單/預收轉列認列，權責基礎）＋ 更新 receivable
        for (let i = 0; i < settled.length; i++) {
            const r = settled[i];
            const amt = parseFloat(r.amount);
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
                startPeriod: null,
                endPeriod: null,
                fromAccount: '',
                toAccount: '',
                accountCode: r.accountCode || null,
                sourceReceivableId: r.id,
            };
            await pool.query('INSERT INTO finance SET ?', [record]);
            await pool.query(
                `UPDATE receivables SET status='paid', paidAmount=?, paidDate=?, financeId=?, updatedAt=NOW() WHERE id=?`,
                [amt, date, financeId, r.id]
            );
            financeRecords.push(record);
            // 代收沖項同步更新 agency_collections paidMembers
            if (r.sourceType === 'agency') {
                const agencyId = parseInt(r.sourceRef);
                const [agRows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [agencyId]);
                if (agRows.length > 0) {
                    const col = parseCollection(agRows[0]);
                    col.paidMembers.push({ memberName, date, amount: amt });
                    await pool.query('UPDATE agency_collections SET paidMembers=? WHERE id=?',
                        [JSON.stringify(col.paidMembers), agencyId]);
                }
            }
        }

        // 溢收款處理
        const extraRecords = [];
        const baseTs = Date.now() + settled.length + 100;
        if ((parseFloat(prevOverpayment) || 0) > 0) {
            const rec = {
                id: baseTs,
                type: 'income', date, item: '溢收款', member: memberName, account,
                amount: -(parseFloat(prevOverpayment)), remark: '前期溢收款結清（沖抵本次收款計算）',
                startPeriod: null, endPeriod: null, fromAccount: '', toAccount: '',
                accountCode: '2131',
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
                accountCode: '2131',
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

// 輔助：查詢類別的對方收入科目
async function lookupIncomeAccount(category, fallback) {
    if (fallback) return fallback;
    const [s] = await pool.query('SELECT incomeAccount FROM dues_settings WHERE category=?', [category]);
    return s.length ? s[0].incomeAccount : null;
}

// ─── 批次產生帳款（Phase 2）─────────────────────────────────
app.post('/api/receivables/batch-generate', async (req, res) => {
    try {
        const { category, memberNames, amount, dueDate, incomeAccount, accountCode, periodStart, periodEnd } = req.body;
        if (!category || !Array.isArray(memberNames) || memberNames.length === 0) {
            return res.status(400).json({ error: '缺少類別或社友清單' });
        }
        const amt = parseFloat(amount) || 0;
        const dueYear = (dueDate && dueDate.substring(0, 4)) || new Date().getFullYear().toString();
        const acct = await lookupIncomeAccount(category, incomeAccount);
        // 科目/攤提期間：未指定時依帳款類別設定推得
        const [setting] = await pool.query('SELECT accountCode, periodMonths FROM dues_settings WHERE category=?', [category]);
        const code = accountCode || (setting.length ? setting[0].accountCode : null);
        let ps = periodStart || null, pe = periodEnd || null;
        if (!ps && setting.length && setting[0].periodMonths && dueDate) {
            const [y, m] = dueDate.split('-').map(Number);
            const endM = m + setting[0].periodMonths - 1;
            const ey = y + Math.floor((endM - 1) / 12);
            const em = ((endM - 1) % 12) + 1;
            ps = `${y}-${String(m).padStart(2, '0')}`;
            pe = `${ey}-${String(em).padStart(2, '0')}`;
        }
        let created = 0;
        for (let i = 0; i < memberNames.length; i++) {
            const [r] = await pool.query(
                `INSERT IGNORE INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status, incomeAccount, accountCode, periodStart, periodEnd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [Date.now() + i, 'dues', category, memberNames[i], amt, dueDate || null, dueYear, 'pending', acct || null, code || null, ps, pe]
            );
            if (r.affectedRows > 0) created++;
        }
        res.status(201).json({ created, skipped: memberNames.length - created });
    } catch (e) {
        console.error('Error in batch-generate:', e);
        res.status(500).json({ error: 'Failed to batch-generate receivables' });
    }
});

// ─── 單筆新增帳款 ──────────────────────────────────────────
app.post('/api/receivables', async (req, res) => {
    try {
        const { sourceType, category, memberName, amount, dueDate, incomeAccount, accountCode, periodStart, periodEnd } = req.body;
        if (!category || !memberName) return res.status(400).json({ error: '缺少類別或社友' });
        const amt = parseFloat(amount) || 0;
        const dueYear = (dueDate && dueDate.substring(0, 4)) || new Date().getFullYear().toString();
        const acct = await lookupIncomeAccount(category, incomeAccount);
        const id = Date.now();
        try {
            await pool.query(
                `INSERT INTO receivables (id, sourceType, sourceRef, memberName, amount, dueDate, dueYear, status, incomeAccount, accountCode, periodStart, periodEnd) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                [id, sourceType || 'dues', category, memberName, amt, dueDate || null, dueYear, 'pending', acct || null, accountCode || null, periodStart || null, periodEnd || null]
            );
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '該社友此類別本年度帳款已存在' });
            throw e;
        }
        const [rows] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        res.status(201).json(parseReceivable(rows[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to create receivable' });
    }
});

// ─── 編輯帳款（未收款才可改）──────────────────────────────
app.put('/api/receivables/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Receivable not found' });
        const cur = rows[0];
        if (cur.status === 'paid' || (parseFloat(cur.paidAmount) || 0) > 0) {
            return res.status(400).json({ error: '已收款的帳款不可編輯，請先恢復' });
        }
        const { memberName, amount, dueDate, sourceRef, incomeAccount, accountCode, periodStart, periodEnd } = req.body;
        const updated = {
            memberName:    memberName    !== undefined ? memberName              : cur.memberName,
            sourceRef:     sourceRef     !== undefined ? sourceRef               : cur.sourceRef,
            amount:        amount        !== undefined ? parseFloat(amount)      : cur.amount,
            dueDate:       dueDate       !== undefined ? (dueDate || null)       : cur.dueDate,
            incomeAccount: incomeAccount !== undefined ? (incomeAccount || null) : cur.incomeAccount,
            accountCode:   accountCode   !== undefined ? (accountCode || null)   : cur.accountCode,
            periodStart:   periodStart   !== undefined ? (periodStart || null)   : cur.periodStart,
            periodEnd:     periodEnd     !== undefined ? (periodEnd || null)     : cur.periodEnd,
        };
        updated.dueYear = updated.dueDate ? updated.dueDate.substring(0, 4) : cur.dueYear;
        await pool.query('UPDATE receivables SET ? WHERE id=?', [updated, id]);
        const [r2] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        res.json(parseReceivable(r2[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to update receivable' });
    }
});

// ─── 刪除帳款 ──────────────────────────────────────────────
app.delete('/api/receivables/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [result] = await pool.query('DELETE FROM receivables WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Receivable not found' });
        res.json({ message: 'Receivable deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete receivable' });
    }
});

// ─── 單筆收款 / 沖帳（Phase 3，支援部分收款）─────────────────
app.post('/api/receivables/:id/collect', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { date, amount, account, remark } = req.body;
        if (!date || !account) return res.status(400).json({ error: '缺少收款日期或收款帳戶' });
        const [rows] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Receivable not found' });
        const r = rows[0];
        if (r.status === 'paid')   return res.status(400).json({ error: '此帳款已全額收款' });
        if (r.status === 'waived') return res.status(400).json({ error: '免繳帳款不可收款，請先恢復' });

        const total     = parseFloat(r.amount) || 0;
        const already   = parseFloat(r.paidAmount) || 0;
        const remaining = total - already;
        const entered   = parseFloat(amount);
        const applied   = (!entered || entered <= 0) ? remaining : Math.min(entered, remaining);
        if (applied <= 0) return res.status(400).json({ error: '無可沖抵金額' });

        // 一律產生 finance「收款單」（sourceReceivableId：引擎推導為借資金/貸應收，
        // 收入認列由開單/預收轉列處理，權責基礎；代收現金流也完整入帳）
        const financeRecord = {
            id: Date.now(),
            type: 'income',
            date,
            item: r.sourceRef,
            member: r.memberName,
            account,
            amount: applied,
            remark: remark || '',
            startPeriod: null,
            endPeriod: null,
            fromAccount: '',
            toAccount: '',
            accountCode: r.accountCode || null,
            sourceReceivableId: r.id,
        };
        await pool.query('INSERT INTO finance SET ?', [financeRecord]);

        if (r.sourceType === 'agency') {
            // 代收：同步更新 agency_collections paidMembers
            const agencyId = parseInt(r.sourceRef);
            const [agRows] = await pool.query('SELECT * FROM agency_collections WHERE id=?', [agencyId]);
            if (agRows.length > 0) {
                const col = parseCollection(agRows[0]);
                col.paidMembers.push({ memberName: r.memberName, date, amount: applied });
                await pool.query('UPDATE agency_collections SET paidMembers=? WHERE id=?',
                    [JSON.stringify(col.paidMembers), agencyId]);
            }
        }

        const newPaid = already + applied;
        const newStatus = newPaid >= total ? 'paid' : 'partial';
        await pool.query(
            `UPDATE receivables SET status=?, paidAmount=?, paidDate=?, financeId=COALESCE(financeId, ?) WHERE id=?`,
            [newStatus, newPaid, date, financeRecord ? financeRecord.id : null, id]
        );
        const [updated] = await pool.query('SELECT * FROM receivables WHERE id=?', [id]);
        res.json({
            receivable: parseReceivable(updated[0]),
            financeRecord: financeRecord ? parseFinance(financeRecord) : null,
            applied,
        });
    } catch (e) {
        console.error('Error in collect:', e);
        res.status(500).json({ error: 'Failed to collect receivable' });
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
        // 一併刪除此帳款已產生的收款單（引擎分錄隨之消失，帳自動回復）
        await pool.query('DELETE FROM finance WHERE sourceReceivableId=?', [id]);
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

// ─── Accounts（會計科目表）──────────────────────────────────
app.get('/api/accounts', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM accounts ORDER BY sortOrder ASC, code ASC');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read accounts' });
    }
});

app.post('/api/accounts', async (req, res) => {
    try {
        const { code, name, type, parentCode, isCash, requiresPerson, sortOrder, description } = req.body;
        if (!code || !name || !type) return res.status(400).json({ error: '科目代碼、名稱、類型為必填' });
        if (!['asset', 'liability', 'equity', 'income', 'expense'].includes(type)) {
            return res.status(400).json({ error: '科目類型不正確' });
        }
        if (parentCode) {
            const [p] = await pool.query('SELECT code, type FROM accounts WHERE code=?', [parentCode]);
            if (!p.length) return res.status(400).json({ error: '上層科目不存在' });
            if (p[0].type !== type) return res.status(400).json({ error: '細項類型須與上層科目相同' });
        }
        try {
            await pool.query(
                'INSERT INTO accounts (code, name, type, parentCode, isCash, isSystem, requiresPerson, sortOrder, description) VALUES (?,?,?,?,?,0,?,?,?)',
                [code, name, type, parentCode || null, isCash ? 1 : 0, requiresPerson ? 1 : 0, sortOrder || 999, description || null]
            );
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '科目代碼已存在' });
            throw e;
        }
        const [rows] = await pool.query('SELECT * FROM accounts WHERE code=?', [code]);
        res.status(201).json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create account' });
    }
});

app.put('/api/accounts/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const [rows] = await pool.query('SELECT * FROM accounts WHERE code=?', [code]);
        if (!rows.length) return res.status(404).json({ error: 'Account not found' });
        const cur = rows[0];
        const { name, parentCode, isCash, requiresPerson, sortOrder, active, description } = req.body;
        // 系統科目：僅允許改名稱、說明與排序（引擎依 code/type 推導分錄）
        const updated = {
            name:      name      !== undefined ? name : cur.name,
            sortOrder: sortOrder !== undefined ? sortOrder : cur.sortOrder,
        };
        if (description !== undefined) updated.description = description || null;
        if (!cur.isSystem) {
            if (parentCode !== undefined)      updated.parentCode = parentCode || null;
            if (isCash !== undefined)          updated.isCash = isCash ? 1 : 0;
            if (requiresPerson !== undefined)  updated.requiresPerson = requiresPerson ? 1 : 0;
            if (active !== undefined)          updated.active = active ? 1 : 0;
        }
        await pool.query('UPDATE accounts SET ? WHERE code=?', [updated, code]);
        const [r2] = await pool.query('SELECT * FROM accounts WHERE code=?', [code]);
        res.json(r2[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to update account' });
    }
});

app.delete('/api/accounts/:code', async (req, res) => {
    try {
        const code = req.params.code;
        const [rows] = await pool.query('SELECT * FROM accounts WHERE code=?', [code]);
        if (!rows.length) return res.status(404).json({ error: 'Account not found' });
        if (rows[0].isSystem) return res.status(400).json({ error: '系統科目不可刪除' });
        const [children] = await pool.query('SELECT code FROM accounts WHERE parentCode=?', [code]);
        if (children.length) return res.status(400).json({ error: '此科目下仍有細項，不可刪除' });
        const [used] = await pool.query('SELECT COUNT(*) AS cnt FROM finance WHERE accountCode=?', [code]);
        if (used[0].cnt > 0) return res.status(400).json({ error: `已有 ${used[0].cnt} 筆單據使用此科目，不可刪除（可改為停用）` });
        await pool.query('DELETE FROM accounts WHERE code=?', [code]);
        res.json({ message: 'Account deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

// ─── Projects（專案類別）────────────────────────────────────
app.get('/api/projects', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM projects ORDER BY sortOrder ASC, id ASC');
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read projects' });
    }
});

app.post('/api/projects', async (req, res) => {
    try {
        const { name, sortOrder } = req.body;
        if (!name) return res.status(400).json({ error: '專案名稱為必填' });
        const id = Date.now();
        try {
            await pool.query('INSERT INTO projects (id, name, sortOrder) VALUES (?,?,?)', [id, name, sortOrder || 999]);
        } catch (e) {
            if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '專案名稱已存在' });
            throw e;
        }
        const [rows] = await pool.query('SELECT * FROM projects WHERE id=?', [id]);
        res.status(201).json(rows[0]);
    } catch (e) {
        res.status(500).json({ error: 'Failed to create project' });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, active, sortOrder } = req.body;
        const updated = {};
        if (name !== undefined) updated.name = name;
        if (active !== undefined) updated.active = active ? 1 : 0;
        if (sortOrder !== undefined) updated.sortOrder = sortOrder;
        if (!Object.keys(updated).length) return res.status(400).json({ error: '無可更新欄位' });
        const [result] = await pool.query('UPDATE projects SET ? WHERE id=?', [updated, id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
        const [rows] = await pool.query('SELECT * FROM projects WHERE id=?', [id]);
        res.json(rows[0]);
    } catch (e) {
        if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: '專案名稱已存在' });
        res.status(500).json({ error: 'Failed to update project' });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [used] = await pool.query('SELECT COUNT(*) AS cnt FROM finance WHERE projectId=?', [id]);
        if (used[0].cnt > 0) return res.status(400).json({ error: `已有 ${used[0].cnt} 筆單據使用此專案，不可刪除（可改為停用）` });
        const [result] = await pool.query('DELETE FROM projects WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Project not found' });
        res.json({ message: 'Project deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete project' });
    }
});

// ─── App Settings（系統參數）────────────────────────────────
app.get('/api/settings', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT k, v FROM app_settings');
        const settings = {};
        for (const r of rows) settings[r.k] = r.v;
        res.json(settings);
    } catch (e) {
        res.status(500).json({ error: 'Failed to read settings' });
    }
});

app.put('/api/settings', adminOnly, async (req, res) => {
    try {
        const entries = Object.entries(req.body || {});
        if (!entries.length) return res.status(400).json({ error: '無可更新設定' });
        for (const [k, v] of entries) {
            await pool.query('INSERT INTO app_settings (k, v) VALUES (?,?) ON DUPLICATE KEY UPDATE v=?', [k, String(v), String(v)]);
        }
        res.json({ message: '設定已更新' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to update settings' });
    }
});

// ─── Budgets（年度預算）─────────────────────────────────────
app.get('/api/budgets', async (req, res) => {
    try {
        const { fy } = req.query;
        let sql = 'SELECT * FROM budgets';
        const params = [];
        if (fy) { sql += ' WHERE fy=?'; params.push(parseInt(fy)); }
        const [rows] = await pool.query(sql, params);
        res.json(rows.map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read budgets' });
    }
});

// 依年度整批覆寫（僅管理員）
app.put('/api/budgets/:fy', adminOnly, async (req, res) => {
    try {
        const fy = parseInt(req.params.fy);
        const rows = req.body;
        if (!fy || !Array.isArray(rows)) return res.status(400).json({ error: '缺少年度或預算明細' });
        const [accounts] = await pool.query('SELECT code FROM accounts');
        const codes = new Set(accounts.map(a => a.code));
        for (const r of rows) {
            if (!codes.has(r.accountCode)) return res.status(400).json({ error: `科目 ${r.accountCode} 不存在` });
        }
        await pool.query('DELETE FROM budgets WHERE fy=?', [fy]);
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            const amt = parseFloat(r.amount) || 0;
            if (!amt) continue;
            await pool.query(
                'INSERT INTO budgets (id, fy, accountCode, amount, remark) VALUES (?,?,?,?,?)',
                [Date.now() + i, fy, r.accountCode, amt, r.remark || null]
            );
        }
        const [saved] = await pool.query('SELECT * FROM budgets WHERE fy=?', [fy]);
        res.json(saved.map(r => ({ ...r, amount: parseFloat(r.amount) || 0 })));
    } catch (e) {
        console.error('Error saving budgets:', e);
        res.status(500).json({ error: 'Failed to save budgets' });
    }
});

// ─── Bank Reconciliations（銀行存款核對）────────────────────
app.get('/api/bank-reconciliations', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM bank_reconciliations ORDER BY reconDate DESC, accountCode ASC');
        res.json(rows.map(r => ({ ...r, statementBalance: parseFloat(r.statementBalance) || 0 })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read bank reconciliations' });
    }
});

app.post('/api/bank-reconciliations', async (req, res) => {
    try {
        const { accountCode, reconDate, statementBalance, remark } = req.body;
        if (!accountCode || !reconDate || statementBalance === undefined) {
            return res.status(400).json({ error: '缺少科目、核對日或存摺餘額' });
        }
        const row = {
            id: Date.now(),
            accountCode,
            reconDate,
            statementBalance: parseFloat(statementBalance) || 0,
            remark: remark || '',
            createdBy: req.user.username,
        };
        // 同科目同日重複核對 → 覆蓋
        await pool.query(
            `INSERT INTO bank_reconciliations SET ? ON DUPLICATE KEY UPDATE statementBalance=VALUES(statementBalance), remark=VALUES(remark), createdBy=VALUES(createdBy)`,
            [row]
        );
        res.status(201).json(row);
    } catch (e) {
        console.error('Error saving bank reconciliation:', e);
        res.status(500).json({ error: 'Failed to save bank reconciliation' });
    }
});

app.delete('/api/bank-reconciliations/:id', async (req, res) => {
    try {
        const [result] = await pool.query('DELETE FROM bank_reconciliations WHERE id=?', [parseInt(req.params.id)]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Reconciliation not found' });
        res.json({ message: 'Reconciliation deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete reconciliation' });
    }
});

// ─── Manual Journals（手工傳票）─────────────────────────────
async function validateJournalLines(lines) {
    if (!Array.isArray(lines) || lines.length < 2) return '傳票至少需要兩行分錄';
    let debit = 0, credit = 0;
    const [accounts] = await pool.query('SELECT code, requiresPerson, parentCode, type FROM accounts');
    const byCode = Object.fromEntries(accounts.map(a => [a.code, a]));
    const hasChildren = new Set(accounts.filter(a => a.parentCode).map(a => a.parentCode));
    for (const line of lines) {
        const acct = byCode[line.accountCode];
        if (!acct) return `科目 ${line.accountCode} 不存在`;
        if (hasChildren.has(acct.code)) return `科目 ${acct.code} 下設有細項，請選擇細項科目`;
        if (acct.requiresPerson && !line.person) return `科目 ${line.accountCode} 需指定對象（人員/案名）`;
        const d = parseFloat(line.debit) || 0;
        const c = parseFloat(line.credit) || 0;
        if (d < 0 || c < 0) return '借貸金額不可為負數';
        if ((d > 0) === (c > 0)) return '每行分錄須為借方或貸方擇一';
        debit += d; credit += c;
    }
    if (Math.round(debit * 100) !== Math.round(credit * 100)) {
        return `借貸不平衡（借 ${debit} / 貸 ${credit}）`;
    }
    return null;
}

function parseJournal(row) {
    return { ...row, lines: JSON.parse(row.lines || '[]') };
}

app.get('/api/manual-journals', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM manual_journals ORDER BY date DESC, id DESC');
        res.json(rows.map(parseJournal));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read manual journals' });
    }
});

app.post('/api/manual-journals', async (req, res) => {
    try {
        const { date, description, lines } = req.body;
        if (!date) return res.status(400).json({ error: '缺少傳票日期' });
        const err = await validateJournalLines(lines);
        if (err) return res.status(400).json({ error: err });
        const journal = {
            id: Date.now(),
            date,
            description: description || '',
            lines: JSON.stringify(lines),
            createdBy: req.user.username,
        };
        await pool.query('INSERT INTO manual_journals SET ?', [journal]);
        res.status(201).json(parseJournal(journal));
    } catch (e) {
        res.status(500).json({ error: 'Failed to create manual journal' });
    }
});

app.put('/api/manual-journals/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [rows] = await pool.query('SELECT * FROM manual_journals WHERE id=?', [id]);
        if (!rows.length) return res.status(404).json({ error: 'Journal not found' });
        const { date, description, lines } = req.body;
        const err = await validateJournalLines(lines !== undefined ? lines : JSON.parse(rows[0].lines));
        if (err) return res.status(400).json({ error: err });
        const updated = {
            date:        date        !== undefined ? date : rows[0].date,
            description: description !== undefined ? description : rows[0].description,
            lines:       lines       !== undefined ? JSON.stringify(lines) : rows[0].lines,
        };
        await pool.query('UPDATE manual_journals SET ? WHERE id=?', [updated, id]);
        const [r2] = await pool.query('SELECT * FROM manual_journals WHERE id=?', [id]);
        res.json(parseJournal(r2[0]));
    } catch (e) {
        res.status(500).json({ error: 'Failed to update manual journal' });
    }
});

app.delete('/api/manual-journals/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const [result] = await pool.query('DELETE FROM manual_journals WHERE id=?', [id]);
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Journal not found' });
        res.json({ message: 'Journal deleted' });
    } catch (e) {
        res.status(500).json({ error: 'Failed to delete manual journal' });
    }
});

// ─── Opening Balances（期初餘額）────────────────────────────
app.get('/api/opening-balances', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM opening_balances ORDER BY accountCode ASC, person ASC');
        res.json(rows.map(r => ({ ...r, debit: parseFloat(r.debit) || 0, credit: parseFloat(r.credit) || 0 })));
    } catch (e) {
        res.status(500).json({ error: 'Failed to read opening balances' });
    }
});

// 以基準日為單位整批覆寫（期初盤點一次輸入）
app.put('/api/opening-balances', adminOnly, async (req, res) => {
    try {
        const { baseDate, rows } = req.body;
        if (!baseDate || !Array.isArray(rows)) return res.status(400).json({ error: '缺少基準日或期初明細' });
        const [accounts] = await pool.query('SELECT code FROM accounts');
        const codes = new Set(accounts.map(a => a.code));
        for (const r of rows) {
            if (!codes.has(r.accountCode)) return res.status(400).json({ error: `科目 ${r.accountCode} 不存在` });
        }
        await pool.query('DELETE FROM opening_balances WHERE baseDate=?', [baseDate]);
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            await pool.query(
                'INSERT INTO opening_balances (id, baseDate, accountCode, person, debit, credit, remark) VALUES (?,?,?,?,?,?,?)',
                [Date.now() + i, baseDate, r.accountCode, r.person || '', parseFloat(r.debit) || 0, parseFloat(r.credit) || 0, r.remark || '']
            );
        }
        const [saved] = await pool.query('SELECT * FROM opening_balances WHERE baseDate=?', [baseDate]);
        res.json(saved.map(r => ({ ...r, debit: parseFloat(r.debit) || 0, credit: parseFloat(r.credit) || 0 })));
    } catch (e) {
        console.error('Error saving opening balances:', e);
        res.status(500).json({ error: 'Failed to save opening balances' });
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
