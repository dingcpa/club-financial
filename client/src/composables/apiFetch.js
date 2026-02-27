import { useAuth } from './useAuth.js'

export async function apiFetch(url, options = {}) {
    const { getToken, logout } = useAuth()
    const token = getToken()
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
    }
    const res = await fetch(url, { ...options, headers })
    if (res.status === 401) {
        logout()
        location.reload()
        return
    }
    return res
}
