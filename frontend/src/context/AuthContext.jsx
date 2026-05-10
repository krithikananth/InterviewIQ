import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // Restore user from localStorage immediately to prevent flash-redirect on reload
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('iq_user')
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })
  const [token, setToken] = useState(localStorage.getItem('iq_token'))
  const [loading, setLoading] = useState(!!localStorage.getItem('iq_token'))

  // Verify token on mount (background check — user is already restored from localStorage)
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    let cancelled = false

    fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (!r.ok) throw new Error('Token invalid')
        return r.json()
      })
      .then(data => {
        if (cancelled) return
        // Update user with fresh data from server
        setUser(data.user)
        localStorage.setItem('iq_user', JSON.stringify(data.user))
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        // Token is genuinely invalid — clear everything
        localStorage.removeItem('iq_token')
        localStorage.removeItem('iq_user')
        setToken(null)
        setUser(null)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [token])

  const login = async (email, password) => {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    localStorage.setItem('iq_token', data.token)
    localStorage.setItem('iq_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data
  }

  const register = async (name, email, password) => {
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    localStorage.setItem('iq_token', data.token)
    localStorage.setItem('iq_user', JSON.stringify(data.user))
    setToken(data.token)
    setUser(data.user)
    return data
  }

  const logout = useCallback(() => {
    localStorage.removeItem('iq_token')
    localStorage.removeItem('iq_user')
    setToken(null)
    setUser(null)
  }, [])

  const authFetch = useCallback((url, opts = {}) => {
    return fetch(url.startsWith('http') ? url : `${API}${url}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers }
    })
  }, [token])

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, authFetch }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export default AuthContext
