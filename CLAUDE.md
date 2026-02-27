# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案說明

社團財務管理系統，供扶輪社記錄收支、社費、會員資料與代收代付。

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

### 建置前端
```bash
npm run build        # 根目錄，建置 client/dist/
```

## 環境設定

根目錄建立 `.env`（已加入 .gitignore，不提交）：
```
DB_HOST=43.167.238.175
DB_PORT=30466
DB_USER=root
DB_PASSWORD=...
DB_NAME=zeabur
PORT=5000
JWT_SECRET=<強密碼，Zeabur 部署時在 Variables 設定>
```

### 建立初始使用者帳號
```bash
npm run create-user -- <username> <password> [displayName]
# 範例：npm run create-user -- admin mypassword 管理員
```

## 架構概覽

```
club-finance-tracker/
├── server/
│   ├── index.js      # Express 5 API 入口（async/await）
│   ├── db.js         # mysql2 連線池 + initDB()（自動建表）
│   └── seed-user.js  # 建立初始使用者帳號
├── client/           # Vue 3 + Vuetify 3 + Vite
│   ├── src/
│   │   ├── App.vue          # 主框架，provide() 全域狀態，登入判斷
│   │   ├── main.js          # 建立 Vue + Vuetify 應用
│   │   ├── composables/     # useFinance / useMembers / useDues / useAuth / apiFetch
│   │   └── pages/           # 12 個頁面元件（.vue）
│   └── vite.config.js       # dev proxy /api → :5000
├── .env              # 本機 DB + JWT 連線設定（不進 git）
├── .mcp.json         # MariaDB MCP Server 設定
└── package.json      # build / start / create-user 腳本
```

## 後端

### 資料庫（MariaDB，Zeabur 托管）

五張資料表，由 `server/db.js` 的 `initDB()` 自動建立：

| 資料表 | 說明 |
|--------|------|
| `finance` | 收支 / 轉帳交易紀錄 |
| `members` | 社員資料 |
| `dues_settings` | 社費類別設定（category 為 PK）|
| `agency_collections` | 代收代付（targetMembers / paidMembers 存為 JSON 字串）|
| `users` | 系統使用者（username, password_hash, display_name）|

### 身份驗證（JWT）
- 除 `POST /api/auth/login` 外，所有 `/api` 路由均需 Bearer Token
- Token 由前端存在 localStorage（`cf_token`），有效期 7 天
- `authMiddleware` 在 `server/index.js` 中以 `app.use('/api', authMiddleware)` 套用

### API 路由（前綴 `/api`）

| 路由 | 說明 |
|------|------|
| `POST /auth/login` | 登入（不需 token） |
| `GET /auth/me` | 確認 token 有效 |
| `/finance` | 財務記錄 CRUD + `/batch` 批次新增 |
| `/members` | 社員 CRUD |
| `/dues-settings` | 社費設定 CRUD（以 category 為識別） |
| `/agency-collections` | 代收代付 CRUD + `/:id/pay`、`/:id/close` |
| `/users` | 使用者管理 CRUD |

### Finance 記錄欄位
`type`（`income` / `expense` / `transfer`）、`date`、`item`、`amount`、`member`、`account`、`fromAccount`、`toAccount`、`startPeriod`、`endPeriod`（分攤用）、`remark`

## 前端

### 狀態管理
- `App.vue` 用 `provide()` 向下傳遞所有資料與操作函數
- 頁面元件用 `inject()` 取得所需資料，不透過 props
- 刪除操作一律用 **SweetAlert2** 確認框
- `useAuth()` 管理登入狀態（token 存 localStorage）
- `apiFetch()` 取代 `fetch()`，自動附加 Authorization header，401 時自動登出

### API 網址
前端一律使用相對路徑（`/api/...`），生產環境由 Express 直接服務，開發環境透過 Vite proxy 轉發。

### 頁面元件（`client/src/pages/`）

| 元件 | 功能 |
|------|------|
| `Summary.vue` | 收支月報表 |
| `AccountSummary.vue` | 帳戶餘額統計 |
| `IncomeForm.vue` | 新增 / 編輯收入（含批次社費） |
| `ExpenseForm.vue` | 新增 / 編輯支出 |
| `TransferForm.vue` | 帳戶轉帳 |
| `MemberDues.vue` | 社費繳交管理 |
| `MemberList.vue` | 社員資料維護 |
| `PrepaidIncome.vue` | 預收收入攤銷 |
| `PrepaidExpense.vue` | 預付費用攤銷 |
| `AgencyCollection.vue` | 代收代付（有自己的 API 呼叫） |
| `RecordListPanel.vue` | 收 / 支 / 調撥記錄列表（依 activeTab 切換） |
| `LoginPage.vue` | 登入頁面（未認證時顯示） |
| `UserManagement.vue` | 使用者帳號管理（新增/編輯/刪除） |

## 部署（Zeabur）

- **Build Command**：`npm run build`（建置 Vue 前端）
- **Start Command**：`npm start`（啟動 Express，同時服務 API 和前端靜態檔）
- **環境變數**：在 Zeabur Variables 頁面設定 DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME / JWT_SECRET
