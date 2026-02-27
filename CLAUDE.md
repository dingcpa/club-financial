# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 專案說明

社團財務管理系統，供扶輪社記錄收支、社費、會員資料與代收代付。

## 開發指令

### 啟動後端伺服器
```bash
node server/index.js
```
伺服器跑在 `http://localhost:5000`。

### 啟動前端開發環境
```bash
cd client
npm run dev
```
前端跑在 `http://localhost:5173`（Vite 預設）。

### Lint 前端
```bash
cd client
npm run lint
```

### 建置前端
```bash
cd client
npm run build
```

目前無自動化測試。

## 架構概覽

### 整體結構
- **後端**：Node.js + Express 5（CommonJS），位於 `server/index.js`
- **前端**：React 19 + Vite，位於 `client/`
- **資料儲存**：JSON 檔案，位於 `server/data/`（非資料庫）

### 後端 (`server/index.js`)
單一檔案 REST API。使用同步 `fs.readFileSync` / `fs.writeFileSync` 讀寫 JSON 檔。資源 ID 一律用 `Date.now()` 產生。

四個資料檔：
| 檔案 | 說明 |
|------|------|
| `finance.json` | 收支、轉帳交易紀錄 |
| `members.json` | 社員資料 |
| `dues_settings.json` | 社費類別設定（名稱、截止日、標準金額）|
| `agency_collections.json` | 代收代付紀錄 |

API 路由前綴 `/api`：`/finance`、`/members`、`/dues-settings`、`/agency-collections`

### 前端 (`client/src/`)
- **`App.jsx`**：根元件，管理全域狀態（`records`、`members`、`duesSettings`）、sidebar 導覽、Tab 切換，並直接呼叫後端 API。
- **`pages/`**：各頁面為獨立元件，透過 props 接收資料與回呼，不使用 React Router（Tab 切換）。

| 頁面元件 | 功能 |
|----------|------|
| `Summary.jsx` | 收支總覽報表 |
| `AccountSummary.jsx` | 帳戶餘額統計 |
| `IncomeForm.jsx` | 新增 / 編輯收入 |
| `ExpenseForm.jsx` | 新增 / 編輯支出 |
| `TransferForm.jsx` | 帳戶轉帳 |
| `MemberDues.jsx` | 社費繳交管理 |
| `MemberList.jsx` | 社員資料維護 |
| `PrepaidIncome.jsx` | 預收收入（分攤） |
| `PrepaidExpense.jsx` | 預付費用（分攤） |
| `AgencyCollection.jsx` | 代收代付 |
| `RecordListPanel.jsx` | 交易紀錄列表 |

### 前後端 API 基礎 URL
```js
const API_URL = 'http://localhost:5000/api/finance';
const MEMBERS_API = 'http://localhost:5000/api/members';
const DUES_SETTINGS_API = 'http://localhost:5000/api/dues-settings';
```

### Finance 記錄欄位
`type`（`income` / `expense` / `transfer`）、`date`、`item`、`amount`、`member`、`account`、`fromAccount`、`toAccount`、`startPeriod`、`endPeriod`（分攤用）、`remark`
