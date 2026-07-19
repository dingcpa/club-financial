# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案說明

社團財務管理系統，供扶輪社記錄收支、社費、會員資料與代收代付。

**2026-07 起採複式簿記體系（權責基礎）**：單據（finance/receivables 等）為唯一真實資料，前端純函數引擎（`client/src/accounting/`）即時推導借貸分錄；傳票、日記帳、分類帳、資產負債表、現金流量表、收支月報表全部由分錄產生。帳務基準日（`app_settings` 的 `accounting.baseDate`，預設 2026-06-30）之前的歷史以期初餘額（`opening_balances`）表達，引擎只處理基準日後的單據。會計年度採扶輪年度（7/1–6/30）。

## 開發指令

### 啟動後端伺服器
```bash
node server/index.js
```
需有 `.env`（見下方），伺服器跑在 `http://localhost:5000`。

### 啟動前端開發環境
```bash
cd client && npm run dev
```
前端跑在 `http://localhost:5173`，Vite 自動 proxy `/api` → `localhost:5000`。

### 建置前端 / 測試
```bash
npm run build            # 根目錄，建置 client/dist/
cd client && npm test    # vitest：分錄推導引擎單元測試
```

### 歷史資料遷移（一次性）
```bash
node server/migrate-accounts.js          # DRY RUN
DRY_RUN=0 node server/migrate-accounts.js  # 實際寫入（先備份）
```

## 環境設定

根目錄建立 `.env`（已加入 .gitignore，不提交）：
```
DB_HOST=...
DB_PORT=...
DB_USER=root
DB_PASSWORD=...
DB_NAME=zeabur
PORT=5000
JWT_SECRET=<強密碼，Zeabur 部署時在 Variables 設定>
```

### 建立初始使用者帳號
```bash
npm run create-user -- <username> <password> [displayName]
```

## 架構概覽

```
club-financial/
├── server/
│   ├── index.js             # Express 5 API 入口
│   ├── db.js                # mysql2 連線池 + initDB()（自動建表＋科目/專案 seed）
│   ├── line-bot.js          # LINE 財務精靈（/line/webhook，紅箱登記→直接寫收入單；
│   │                        #   設 ROTARY_LINE_CHANNEL_SECRET/TOKEN 才掛載，LINE 簽章驗證不走 JWT）
│   ├── migrate-accounts.js  # 歷史資料 → 新科目體系遷移腳本（冪等、DRY_RUN 預設）
│   └── seed-user.js
├── client/                  # Vue 3 + Vuetify 3 + Vite
│   └── src/
│       ├── App.vue          # 主框架，provide() 全域狀態、drillDown 機制
│       ├── accounting/      # ★ 複式簿記核心（純函數，vitest 測試）
│       │   ├── coa.js           # 科目常數、資金帳戶解析、舊資料映射
│       │   ├── fiscal.js        # 扶輪年度/月份工具
│       │   ├── deriveEntries.js # 單據 → 借貸分錄推導引擎
│       │   └── ledger.js        # 分錄 → 日記帳/分類帳/試算/BS/IS/CF 聚合
│       ├── composables/     # useAccounting（引擎綁定）+ 各資料 CRUD
│       └── pages/           # 頁面元件
└── .mcp.json                # MariaDB MCP Server（唯讀查詢）
```

## 後端

### 資料庫（MariaDB，Zeabur 托管）

由 `server/db.js` 的 `initDB()` 自動建立（含冪等 ALTER 與 seed）：

| 資料表 | 說明 |
|--------|------|
| `finance` | 單據主檔（income/expense/transfer；`accountCode` 科目、`projectId` 專案、`sourceReceivableId` 收款單標記）|
| `receivables` | 應收帳款（`accountCode`、`periodStart/End` 權責期間；status: pending/partial/paid/waived）|
| `accounts` | ★ 會計科目表（二層、isSystem 系統科目、isCash、requiresPerson 人員明細）|
| `projects` | ★ 專案類別（三社聯誼、肺癌篩檢…，收入支出皆可掛）|
| `manual_journals` | ★ 手工傳票（調整分錄；後端強制借貸平衡）|
| `opening_balances` | ★ 期初餘額（基準日各科目/人員；累積餘絀由引擎軋差）|
| `app_settings` | ★ 系統參數（accounting.baseDate、accounting.lockDate 關帳日、dues.monthlyAmount）|
| `members` | 名冊（status 現職/退社、leaveDate、bankAccountLast5 收款對帳用）|
| `bank_reconciliations` | 銀行存款核對（帳戶/核對日/存摺餘額；同科目同日覆蓋）|
| `budgets` | 年度預算（扶輪年度＋科目，整批覆寫）|
| `attachments` | 佐證附件（refType finance/journal；壓縮後 base64，每單據最多 3 張）|
| `notification_logs` | 催繳通知紀錄（LINE 群組推播 / 複製文字草稿）|
| `share_links` | 唯讀分享連結（token；監事/查帳人免帳號看報表）|
| `dues_settings` / `agency_collections` / `users` | 同前（dues_settings 加 accountCode/periodMonths）|

### 關鍵帳務規則（server 端）

- **收款不認列收入**：collect / settle-batch 產生帶 `sourceReceivableId` 的 finance 列（引擎推導「借資金/貸應收」）；收入由開單與預收轉列認列（權責）。
- **reopen / 取消收款 / 刪除收款單**：連動刪除收款單或回退應收狀態。
- **開單為明確動作**：新增帳款類別或社友「不再」自動全員開單；由應收帳款頁批次產生（含季度社費快速開單，每月金額看 `dues.monthlyAmount`）。
- **資金帳戶字彙**：`account/fromAccount/toAccount` 只能是銀行名（`一銀帳戶`）或 `經手人:<姓名>`（→1121 經手人往來按人明細）。
- **雙日期**：finance 可填 `occurredDate`（發生日期）；引擎對收入/支出單以發生日期入帳（權責），收款單/轉帳單一律用單據日期（資金移動）。
- **年度關帳**：`accounting.lockDate`（含）以前的 finance/手工傳票/應收異動一律 400 拒絕；年度損益結轉與 BS 承轉由引擎自動處理，關帳只是鎖唯讀。
- **唯讀分享**：`Bearer share:<token>`（share_links 驗證）僅允許 GET；前端 `?share=<token>` 進唯讀模式（僅報表選單）。

### API 路由（前綴 `/api`，除 login 外皆需 JWT）

| 路由 | 說明 |
|------|------|
| `POST /auth/login`、`GET /auth/me` | 認證 |
| `/finance` | 單據 CRUD + `/batch`（刪除收款單會回退應收）|
| `/members`、`/users`（admin） | 名冊 / 帳號 |
| `/dues-settings` | 帳款類別（accountCode/periodMonths）|
| `/agency-collections` | 代收代付＋`/:id/pay`（產生收款單）、`/:id/close`（payAccount 產生付出支出單）|
| `/receivables` | 應收 CRUD＋`/batch-generate`（accountCode/period）、`/:id/collect`（部分收款）、`/:id/waive`、`/:id/reopen`、`/settle-batch` |
| `/accounts`、`/projects` | ★ 科目表 / 專案 CRUD（系統科目保護、已用檢查）|
| `/manual-journals` | ★ 手工傳票（借貸平衡/人員/葉節點驗證）|
| `/opening-balances`（PUT admin） | ★ 期初餘額整批覆寫 |
| `/settings`（PUT admin） | ★ 系統參數 |
| `/members/batch-import` | 名冊 Excel 批次匯入（以姓名 upsert，空欄不覆蓋）|
| `/bank-reconciliations` | 銀行存款核對 CRUD |
| `/budgets`＋`PUT /budgets/:fy`（admin） | 年度預算查詢 / 整批覆寫 |
| `/attachments` | 附件 metadata / 單筆含 data / 刪除（新增隨 finance、manual-journals 的 `attachments` 欄位一併寫入）|
| `/notifications`＋`/notifications/dues-reminder` | 通知紀錄 / 催繳（LINE 群組推播或文字草稿）|
| `/share-links`（admin） | 唯讀分享連結管理 |

## 前端

### 狀態管理與帳務引擎
- `App.vue` 用 `provide()` 下發資料與函數；頁面 `inject()` 取得。
- `useAccounting()` 把全量單據 refs 綁進 `deriveAllEntries()`，單據變動 → 分錄/報表 computed 自動重算。
- `provide('drillDown', ctx)`：各報表點金額 → 帳簿查詢分類帳（帶科目/人員/期間篩選）→ 點分錄開傳票 dialog → 可回溯編輯原始單據。
- 刪除操作一律 SweetAlert2 確認；`apiFetch()` 自動附 JWT、401 登出。

### 頁面元件（`client/src/pages/`）

| 元件 | 功能 |
|------|------|
| `Summary.vue` | 收支月報表（扶輪年度＋月；基準日後走引擎權責、基準日前歷史彙總）|
| `BudgetReport.vue` | 預算執行表（科目別預算/累積實際/執行率；admin 可編製預算）|
| `ClosingWizard.vue` | 年度關帳（admin：檢核→年度摘要→鎖帳/解除）|
| `BalanceSheet.vue` | ★ 資產負債表（經手人往來按人淨額歸邊為其他應收/應付；含銀行存款核對區與提醒）|
| `CashFlow.vue` | ★ 現金流量表（直接法，現金=銀行存款，依對方科目分類）|
| `LedgerBrowser.vue` | ★ 帳簿查詢（分類帳/日記帳/試算表＋引擎診斷）|
| `JournalEntryDialog.vue` | ★ 傳票檢視（借貸全貌、編輯原始單據入口）|
| `ManualJournal.vue` | ★ 手工傳票 |
| `OpeningBalance.vue` | ★ 期初餘額設定（admin）|
| `IncomeForm.vue` / `ExpenseForm.vue` | 收入/支出單（科目 select 分群＋說明副標、發生日期、附件、預收/預付平攤）|
| `TransferForm.vue` | 內部轉帳單（資產科目間移轉：存入銀行、歸墊；可附件）|
| `ReceivablesSummary.vue` | 應收帳款（季度快速開單、批次產生、收款/免繳/恢復、收款對帳、催繳通知、明細↔總帳勾稽）|
| `MemberDues.vue` / `MemberList.vue` / `AgencyCollection.vue` | 繳費總覽 / 名冊（社籍、銀行末五碼、Excel 匯入）/ 代收代付 |
| `components/AttachmentPanel.vue` | 附件元件（壓縮上傳、檢視、刪除；四張單據表單共用）|
| `CategorySettings.vue` | 科目/專案/帳款類別/系統參數 四分頁設定 |
| `RecordListPanel.vue` | 收/支/轉帳單據查詢（科目/專案欄）|
| `LoginPage.vue` / `UserManagement.vue` | 登入 / 帳號管理 |

已裁撤：預收收入明細、預付支出明細、資金帳戶明細（由資產負債表點科目查分類帳取代）。

## 部署（Zeabur）

- **Build Command**：`npm run build`；**Start Command**：`npm start`
- **環境變數**：DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / JWT_SECRET；
  LINE 財務精靈另需 ROTARY_LINE_CHANNEL_SECRET / ROTARY_LINE_CHANNEL_ACCESS_TOKEN
  （選配 ROTARY_ALLOWED_GROUP_IDS / ROTARY_ALLOWED_USER_IDS / ROTARY_HANDLER_NAME）；
  LIFF 紅箱表單另需 ROTARY_LIFF_ID / ROTARY_LOGIN_CHANNEL_ID（LINE Login channel）
- LINE webhook 固定網址：`https://<域名>/line/webhook`（LINE Developers Console 設一次即可）；
  LIFF 表單頁：`https://<域名>/liff/redbox`（LINE ID Token 驗證，不走系統 JWT）
- 部署後 `initDB()` 自動補表/欄位/seed（冪等）。
