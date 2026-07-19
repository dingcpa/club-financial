import { ref, computed } from 'vue'

const TOKEN_KEY = 'cf_token'
const USER_KEY = 'cf_user'
const SHARE_KEY = 'cf_share'

// 唯讀分享連結：網址帶 ?share=<token> 進入唯讀模式（免帳號）
const urlShare = new URLSearchParams(location.search).get('share')
if (urlShare) {
    localStorage.setItem(SHARE_KEY, urlShare)
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    history.replaceState(null, '', location.pathname)
}

const token = ref(localStorage.getItem(TOKEN_KEY) || '')
const shareToken = ref(localStorage.getItem(SHARE_KEY) || '')
const storedUser = JSON.parse(localStorage.getItem(USER_KEY) || 'null')
const user = ref(storedUser || (shareToken.value ? { displayName: '唯讀檢視', username: 'share-viewer', role: 'viewer' } : null))

export function useAuth() {
    const isAuthenticated = computed(() => !!token.value || !!shareToken.value)
    const isAdmin = computed(() => user.value?.role === 'admin')
    const isViewer = computed(() => !token.value && !!shareToken.value)

    async function login(username, password) {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        })
        if (!res.ok) {
            const err = await res.json()
            throw new Error(err.error || '登入失敗')
        }
        const data = await res.json()
        token.value = data.token
        shareToken.value = ''
        localStorage.removeItem(SHARE_KEY)
        user.value = { displayName: data.displayName, username, role: data.role }
        localStorage.setItem(TOKEN_KEY, data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    }

    function logout() {
        token.value = ''
        shareToken.value = ''
        user.value = null
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
        localStorage.removeItem(SHARE_KEY)
    }

    function getToken() {
        return token.value || (shareToken.value ? `share:${shareToken.value}` : '')
    }

    return { isAuthenticated, isAdmin, isViewer, user, token, login, logout, getToken }
}
