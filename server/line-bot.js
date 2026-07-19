// LINE「中區扶輪社財務精靈」— 常駐於財務系統本體（Zeabur），webhook 網址固定。
//
// Webhook：POST /line/webhook（LINE Developers Console 設一次即可）
// 功能（L1）：例會紅箱捐款登記與拋轉。純指令解析、不經 LLM。
//   /紅箱 姓名 金額     登記（可多行，一行一筆；姓名可用社名 nickname）
//   /紅箱名單           本場次名單與合計
//   /紅箱刪除 姓名      移除登記
//   /紅箱結算 [項目名]  直接寫入收入單（4102 紅箱收入、經手人），傳票即時產生
//   /紅箱清空           放棄本場次
//   /幫助               說明
//
// 環境變數（未設 SECRET/TOKEN 則不掛載）：
//   ROTARY_LINE_CHANNEL_SECRET / ROTARY_LINE_CHANNEL_ACCESS_TOKEN
//   ROTARY_ALLOWED_GROUP_IDS（逗號分隔；空 = 對指令回覆 groupId 供設定白名單）
//   ROTARY_ALLOWED_USER_IDS（允許私訊操作者，可空）
//   ROTARY_HANDLER_NAME（紅箱現金經手人，預設 陳淑華）
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

const SECRET = process.env.ROTARY_LINE_CHANNEL_SECRET || '';
const TOKEN = process.env.ROTARY_LINE_CHANNEL_ACCESS_TOKEN || '';
const HANDLER_NAME = process.env.ROTARY_HANDLER_NAME || '陳淑華';
const ALLOWED_GROUPS = new Set((process.env.ROTARY_ALLOWED_GROUP_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
const ALLOWED_USERS = new Set((process.env.ROTARY_ALLOWED_USER_IDS || '').split(',').map(s => s.trim()).filter(Boolean));
// LIFF 紅箱登記表單（選配）：LINE Login channel 下建 LIFF app
const LIFF_ID = process.env.ROTARY_LIFF_ID || '';
const LOGIN_CHANNEL_ID = process.env.ROTARY_LOGIN_CHANNEL_ID || '';

const HELP_TEXT = [
  '財務精靈指令：',
  '/紅箱 姓名 金額 — 登記一筆（可多行，一行一筆）',
  '/紅箱名單 — 本場次名單與合計',
  '/紅箱刪除 姓名 — 移除某人登記',
  '/紅箱結算 [項目名] — 寫入財務系統產生傳票',
  '   項目例：例會歡喜紅箱（預設）、授證紅箱、中秋節紅箱',
  '/紅箱清空 — 放棄本場次',
  `登記的現金以「經手人:${HANDLER_NAME}」入帳，存入銀行時請至系統開內部轉帳單。`,
].join('\n');

// 台北時區今日 YYYY-MM-DD
function today() {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

function fmt(n) {
  return Number(n).toLocaleString('en-US');
}

// ── 場次存取（redbox_sessions）─────────────────────────────
async function loadSession(sourceId) {
  const [r] = await pool.query('SELECT * FROM redbox_sessions WHERE sourceId=?', [sourceId]);
  if (!r.length) return null;
  return { date: r[0].date, rows: JSON.parse(r[0].rows || '[]') };
}

async function saveSession(sourceId, sess) {
  await pool.query(
    'INSERT INTO redbox_sessions (sourceId, date, `rows`) VALUES (?,?,?) ON DUPLICATE KEY UPDATE date=VALUES(date), `rows`=VALUES(`rows`)',
    [sourceId, sess.date, JSON.stringify(sess.rows)]
  );
}

async function dropSession(sourceId) {
  await pool.query('DELETE FROM redbox_sessions WHERE sourceId=?', [sourceId]);
}

// ── 名冊比對（姓名或社名 nickname）──────────────────────────
async function resolveMemberName(text) {
  const t = text.trim();
  const [members] = await pool.query('SELECT name, nickname FROM members');
  for (const m of members) if (m.name === t) return { name: t, ok: true };
  const low = t.toLowerCase();
  for (const m of members) {
    const nick = (m.nickname || '').trim().toLowerCase();
    if (nick && nick === low) return { name: m.name, ok: true };
  }
  return { name: t, ok: false };
}

// ── 指令 ───────────────────────────────────────────────────
const AMOUNT_RE = /^(\S+)\s+([0-9,]+)$/;

async function cmdAdd(sourceId, by, body) {
  const lines = body.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return '格式：/紅箱 姓名 金額（可多行，一行一筆）';
  const sess = (await loadSession(sourceId)) || { date: today(), rows: [] };
  if (sess.rows.length && sess.date !== today()) {
    return `⚠ 尚有 ${sess.date} 未結算的場次（${sess.rows.length} 筆）。\n請先 /紅箱結算 或 /紅箱清空，再登記今天的紅箱。`;
  }
  sess.date = today();
  const added = [], errors = [];
  for (const ln of lines) {
    const m = ln.match(AMOUNT_RE);
    if (!m) { errors.push(`看不懂：${ln}`); continue; }
    const amount = parseInt(m[2].replace(/,/g, ''), 10);
    if (!(amount > 0)) { errors.push(`金額需大於 0：${ln}`); continue; }
    const { name, ok } = await resolveMemberName(m[1]);
    sess.rows.push({ name, amount, member_ok: ok, by, ts: new Date().toISOString() });
    added.push(`${name} ${fmt(amount)}` + (ok ? '' : '（⚠ 不在名冊）'));
  }
  await saveSession(sourceId, sess);
  const total = sess.rows.reduce((s, r) => s + r.amount, 0);
  const out = [];
  if (added.length) out.push('已登記：\n' + added.map(a => `  ${a}`).join('\n'));
  if (errors.length) out.push(errors.map(e => `❌ ${e}`).join('\n'));
  out.push(`本場次累計 ${sess.rows.length} 筆、合計 NT$ ${fmt(total)}`);
  return out.join('\n');
}

async function cmdList(sourceId) {
  const sess = await loadSession(sourceId);
  if (!sess || !sess.rows.length) return '本場次尚無紅箱登記。/紅箱 姓名 金額 開始登記。';
  const lines = [`📋 紅箱名單（${sess.date}）`];
  sess.rows.forEach((r, i) => {
    lines.push(`${i + 1}. ${r.name} NT$ ${fmt(r.amount)}${r.member_ok ? '' : '（⚠ 不在名冊）'}`);
  });
  const total = sess.rows.reduce((s, r) => s + r.amount, 0);
  lines.push(`—— 共 ${sess.rows.length} 筆、合計 NT$ ${fmt(total)}`);
  return lines.join('\n');
}

async function cmdRemove(sourceId, nameArg) {
  const name = nameArg.trim();
  if (!name) return '格式：/紅箱刪除 姓名';
  const sess = await loadSession(sourceId);
  if (!sess || !sess.rows.length) return '本場次尚無登記。';
  const { name: resolved } = await resolveMemberName(name);
  const before = sess.rows.length;
  sess.rows = sess.rows.filter(r => r.name !== name && r.name !== resolved);
  const removed = before - sess.rows.length;
  if (!removed) return `名單中沒有「${name}」。/紅箱名單 檢視。`;
  await saveSession(sourceId, sess);
  return `已移除 ${name} 的 ${removed} 筆登記。`;
}

async function cmdClear(sourceId) {
  const sess = await loadSession(sourceId);
  await dropSession(sourceId);
  return `已清空本場次（${sess ? sess.rows.length : 0} 筆，未寫入）。`;
}

// 寫入 finance 收入單（引擎即時推導傳票）；rows: [{name, amount, by?}]
async function writeFinanceRows(rows, date, item, byLabel) {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    await pool.query('INSERT INTO finance SET ?', [{
      id: Date.now() + i,
      type: 'income',
      date,
      item,
      amount: r.amount,
      member: r.name,
      account: `經手人:${HANDLER_NAME}`,
      fromAccount: '', toAccount: '',
      startPeriod: null, endPeriod: null,
      remark: `LINE 財務精靈紅箱登記（${r.by || byLabel || ''}）`,
      accountCode: '4102',
    }]);
  }
}

async function cmdSettle(sourceId, itemArg) {
  const item = itemArg.trim() || '例會歡喜紅箱';
  const sess = await loadSession(sourceId);
  if (!sess || !sess.rows.length) return '本場次尚無登記，無可結算。';
  await writeFinanceRows(sess.rows, sess.date, item);
  const total = sess.rows.reduce((s, r) => s + r.amount, 0);
  const count = sess.rows.length;
  await dropSession(sourceId);
  return [
    `✅ 已寫入「${item}」${count} 筆、合計 NT$ ${fmt(total)}。`,
    `現金入帳於「經手人:${HANDLER_NAME}」，傳票已自動產生，`,
    '可至財務系統「帳簿查詢」或「收支月報表」檢視；',
    '現金存入銀行時請開「內部轉帳單」。',
  ].join('\n');
}

// 指令路由：非指令回 null（不回覆、不打擾群組）
async function handleText(sourceId, by, text) {
  const t = text.trim();
  if (['/幫助', '/help', '/紅箱幫助'].includes(t)) return HELP_TEXT;
  if (t === '/紅箱名單') return cmdList(sourceId);
  if (t.startsWith('/紅箱刪除')) return cmdRemove(sourceId, t.slice('/紅箱刪除'.length));
  if (t === '/紅箱清空') return cmdClear(sourceId);
  if (t.startsWith('/紅箱結算')) return cmdSettle(sourceId, t.slice('/紅箱結算'.length));
  if (t === '/紅箱') {
    if (LIFF_ID) {
      return [
        '🧧 紅箱登記表單（列出全體社友，填金額即可）：',
        `https://liff.line.me/${LIFF_ID}?src=${encodeURIComponent(sourceId)}`,
        '（也可直接輸入：/紅箱 姓名 金額）',
      ].join('\n');
    }
    return HELP_TEXT;
  }
  if (t.startsWith('/紅箱')) return cmdAdd(sourceId, by, t.slice('/紅箱'.length));
  return null;
}

// ── LINE API ────────────────────────────────────────────────
function verifySignature(rawBody, signature) {
  const digest = crypto.createHmac('sha256', SECRET).update(rawBody).digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature || ''));
  } catch {
    return false;
  }
}

// 主動推播（催繳通知等系統觸發訊息）；回傳 null 表成功、字串為錯誤訊息
async function linePush(to, text) {
  if (!TOKEN) return 'LINE TOKEN 未設定';
  const r = await fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  if (!r.ok) {
    const detail = await r.text();
    console.error('LINE push failed:', r.status, detail);
    return `LINE 推播失敗（${r.status}）`;
  }
  return null;
}

function pushAvailable() { return !!TOKEN; }
function defaultGroupId() { return [...ALLOWED_GROUPS][0] || ''; }

async function lineReply(replyToken, text) {
  const r = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4900) }] }),
  });
  if (!r.ok) console.error('LINE reply failed:', r.status, await r.text());
}

async function displayName(source) {
  const userId = source.userId || '';
  try {
    const url = source.type === 'group'
      ? `https://api.line.me/v2/bot/group/${source.groupId}/member/${userId}`
      : `https://api.line.me/v2/bot/profile/${userId}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (r.ok) {
      const j = await r.json();
      if (j.displayName) return j.displayName;
    }
  } catch { /* 取不到名字用 id 尾碼 */ }
  return userId ? userId.slice(-6) : '?';
}

async function handleEvent(event) {
  if (event.type !== 'message' || event.message?.type !== 'text') return;
  const source = event.source || {};
  const replyToken = event.replyToken || '';
  const text = event.message.text || '';
  let sourceId;

  if (source.type === 'group') {
    if (ALLOWED_GROUPS.size && !ALLOWED_GROUPS.has(source.groupId)) {
      if (text.trim().startsWith('/')) {
        await lineReply(replyToken, `此群組未授權使用財務精靈。\ngroupId: ${source.groupId}`);
      }
      return;
    }
    sourceId = source.groupId;
  } else if (source.type === 'user') {
    if (ALLOWED_USERS.size && !ALLOWED_USERS.has(source.userId)) {
      if (text.trim().startsWith('/')) {
        await lineReply(replyToken, `未授權使用者。\nuserId: ${source.userId}`);
      }
      return;
    }
    sourceId = source.userId;
  } else {
    return;
  }

  const by = await displayName(source);
  let out;
  try {
    out = await handleText(sourceId, by, text);
  } catch (e) {
    console.error('財務精靈指令處理失敗:', e);
    out = '❌ 處理失敗，請稍後再試。';
  }
  if (out && replyToken) await lineReply(replyToken, out);
}

// ── LIFF 紅箱登記表單 ───────────────────────────────────────
// 以 LINE ID Token 驗證身份（LIFF app 需開 openid scope），不走系統 JWT
async function verifyIdToken(idToken) {
  if (!idToken || !LOGIN_CHANNEL_ID) return null;
  const r = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ id_token: idToken, client_id: LOGIN_CHANNEL_ID }),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return { userId: j.sub, name: j.name || '' };
}

function liffUserAllowed(userId) {
  return !ALLOWED_USERS.size || ALLOWED_USERS.has(userId);
}

// LIFF 表單寫入的場次歸屬：指令來源的聊天室（群組須在白名單），或本人私訊場次
function resolveSrc(src, userId) {
  if (!src || src === userId) return userId;
  if (src.startsWith('C') || src.startsWith('R')) {
    if (ALLOWED_GROUPS.size && !ALLOWED_GROUPS.has(src)) return null;
    return src;
  }
  return null; // 不接受寫入他人的個人場次
}

function mountLiff(app) {
  app.get('/liff/redbox', (req, res) => {
    const html = fs.readFileSync(path.join(__dirname, 'liff-redbox.html'), 'utf8');
    res.type('html').send(html.replace('__LIFF_ID__', LIFF_ID));
  });

  app.post('/line/liff/context', async (req, res) => {
    try {
      const auth = await verifyIdToken(req.body.idToken);
      if (!auth) return res.status(401).json({ error: 'LINE 身份驗證失敗，請重新開啟頁面' });
      if (!liffUserAllowed(auth.userId)) return res.status(403).json({ error: `未授權使用者（userId: ${auth.userId}）` });
      const src = resolveSrc(req.body.src, auth.userId);
      if (!src) return res.status(403).json({ error: '此聊天室未授權' });
      const [members] = await pool.query('SELECT name, nickname FROM members ORDER BY name');
      const sess = await loadSession(src);
      res.json({
        src,
        date: (sess && sess.rows.length) ? sess.date : today(),
        rows: sess ? sess.rows : [],
        members,
        handler: HANDLER_NAME,
      });
    } catch (e) {
      console.error('liff/context error:', e);
      res.status(500).json({ error: '載入失敗' });
    }
  });

  app.post('/line/liff/save', async (req, res) => {
    try {
      const auth = await verifyIdToken(req.body.idToken);
      if (!auth) return res.status(401).json({ error: 'LINE 身份驗證失敗，請重新開啟頁面' });
      if (!liffUserAllowed(auth.userId)) return res.status(403).json({ error: `未授權使用者（userId: ${auth.userId}）` });
      const src = resolveSrc(req.body.src, auth.userId);
      if (!src) return res.status(403).json({ error: '此聊天室未授權' });

      const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body.date || '') ? req.body.date : today();
      const item = String(req.body.item || '例會歡喜紅箱').trim().slice(0, 100) || '例會歡喜紅箱';
      const rows = [];
      for (const r of req.body.rows || []) {
        const amount = parseInt(r.amount, 10);
        const name = String(r.name || '').trim().slice(0, 100);
        if (!name || !(amount > 0)) continue;
        rows.push({ name, amount, by: auth.name || auth.userId.slice(-6), ts: new Date().toISOString() });
      }
      if (!rows.length) return res.status(400).json({ error: '沒有有效的登記資料' });

      const total = rows.reduce((s, r) => s + r.amount, 0);
      if (req.body.settle) {
        await writeFinanceRows(rows, date, item);
        await dropSession(src);
        return res.json({ ok: true, settled: true, count: rows.length, total, handler: HANDLER_NAME });
      }
      await saveSession(src, { date, rows });
      res.json({ ok: true, settled: false, count: rows.length, total, handler: HANDLER_NAME });
    } catch (e) {
      console.error('liff/save error:', e);
      res.status(500).json({ error: '儲存失敗' });
    }
  });
}

function mount(app) {
  if (!SECRET || !TOKEN) return false;
  app.post('/line/webhook', (req, res) => {
    const signature = req.headers['x-line-signature'];
    if (!req.rawBody || !verifySignature(req.rawBody, signature)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }
    res.json({ ok: true }); // 先回 200，事件非同步處理（LINE 要求快速回應）
    for (const event of req.body.events || []) {
      handleEvent(event).catch(e => console.error('handleEvent error:', e));
    }
  });
  if (LIFF_ID && LOGIN_CHANNEL_ID) {
    mountLiff(app);
    console.log('LINE 財務精靈 LIFF mounted at /liff/redbox');
  }
  return true;
}

module.exports = { mount, handleText, linePush, pushAvailable, defaultGroupId };
