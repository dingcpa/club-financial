# 社團財務管理系統 — 開發對話紀錄

日期：2026-02-27

---

## 1. 初始化 CLAUDE.md

使用 `/init` 指令分析專案結構，產生 `CLAUDE.md`，記錄開發指令、架構說明、API 路由等。

---

## 2. 發佈到 GitHub

```bash
git init
git remote add origin git@github.com:dingcpa/club-financial.git
git push -u origin main
```

---

## 3. 前端從 React 19 遷移至 Vue 3

### 使用者需求
- 只換前端（後端 Express 不動）
- 狀態管理：純 Composition API（provide/inject，不用 Pinia）
- UI 框架：Vuetify 3 + SweetAlert2

### 安裝套件

```bash
cd client
npm remove react react-dom lucide-react @vitejs/plugin-react ...
npm install vue@^3 vuetify@^3 @mdi/font sweetalert2
npm install -D @vitejs/plugin-vue
```

### 建立檔案結構

```
client/src/
├── main.js                    # Vue 進入點（取代 main.jsx）
├── App.vue                    # 主框架，v-navigation-drawer + provide()
├── composables/
│   ├── useFinance.js          # records CRUD
│   ├── useMembers.js          # members CRUD
│   └── useDues.js             # duesSettings CRUD
└── pages/
    ├── Summary.vue            # 財務月報表
    ├── IncomeForm.vue         # 收入單（含批次社費）
    ├── ExpenseForm.vue        # 支出單
    ├── TransferForm.vue       # 資金調撥
    ├── MemberDues.vue         # 社費繳交明細
    ├── MemberList.vue         # 社友名單
    ├── PrepaidIncome.vue      # 預收收入攤銷
    ├── PrepaidExpense.vue     # 預付費用攤銷
    ├── AccountSummary.vue     # 資金帳戶明細
    ├── AgencyCollection.vue   # 代收代付專區
    └── RecordListPanel.vue    # 收/支/調撥記錄列表
```

### 轉換原則

| React | Vue 3 |
|-------|-------|
| `useState` | `ref()` / `reactive()` |
| `useEffect(fn, [])` | `onMounted(fn)` |
| `{cond && <X />}` | `<X v-if="cond" />` |
| `.map()` JSX | `v-for` |
| `onClick` | `@click` |
| `window.confirm()` | `Swal.fire()` |
| `window.prompt()` | `v-dialog` + `v-text-field` |
| Props 傳遞 | `provide()` / `inject()` |

### 刪除舊 React 檔案

```
client/src/main.jsx
client/src/App.jsx
client/src/App.css
client/src/index.css
client/src/assets/react.svg
client/src/pages/*.jsx（共 11 個）
```

---

## 4. GitHub Pages 部署

建立 `.github/workflows/deploy.yml`，push main 時自動 build 並發佈。

**GitHub 設定步驟：**
Settings → Pages → Source → **GitHub Actions**

**初始網址：** `https://dingcpa.github.io/club-financial/`

---

## 5. Zeabur 後端部署問題排除

### 問題一：`Cannot find module '/src/index.js'`

**原因：** 根目錄 `package.json` 缺少 `start` 腳本，Zeabur 找不到入口點。

**修正：**
```json
// package.json
"scripts": {
  "start": "node server/index.js"
}
```

### 問題二：Port 寫死 5000

**修正：**
```js
// server/index.js
const PORT = process.env.PORT || 5000;
```

---

## 6. 改由 Express 統一服務前後端

**問題：** 前端部署在 GitHub Pages，API 網址寫死 `localhost:5000`，無法連接 Zeabur 後端。

**解決方案：** Express 同時服務 API 和前端靜態檔案。

### server/index.js 新增

```js
// 靜態檔案服務
const clientDist = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(clientDist)) {
    app.use(express.static(clientDist));
}

// SPA fallback（Express 5 語法）
app.get('/{*path}', (req, res) => {
    const indexFile = path.join(__dirname, '../client/dist/index.html');
    if (require('fs').existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send('Frontend not built yet');
    }
});
```

### Composables API 網址改為相對路徑

```js
// 修改前
const API_URL = 'http://localhost:5000/api/finance'

// 修改後
const API_URL = '/api/finance'
```

### vite.config.js 加入 Dev Proxy

```js
export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
```

### package.json 加入 Build 腳本

```json
"build": "npm install --prefix client && npm run build --prefix client"
```

**Zeabur 設定：** Build Command → `npm run build`

---

## 7. Express 5 Wildcard 語法錯誤

**錯誤：**
```
PathError: Missing parameter name at index 1: *
```

**原因：** Express 5 不支援 `app.get('*', ...)` 寫法。

**修正：**
```js
// Express 4（舊）
app.get('*', ...)

// Express 5（新）
app.get('/{*path}', ...)
```

---

## 最終架構

```
Zeabur
└── Express (server/index.js)
    ├── GET /api/finance          # 財務記錄
    ├── GET /api/members          # 社友名單
    ├── GET /api/dues-settings    # 社費設定
    ├── GET /api/agency-collections  # 代收代付
    └── GET /{*path}              # → client/dist/index.html (SPA)
```

本機開發：
- `node server/index.js`（後端，port 5000）
- `cd client && npm run dev`（前端，port 5173，自動 proxy `/api` → 5000）
