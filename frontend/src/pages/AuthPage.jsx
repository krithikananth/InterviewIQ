import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LogIn, UserPlus, Mail, Lock, User, ArrowRight } from 'lucide-react'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isLogin) {
        await login(email, password)
      } else {
        await register(name, email, password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)', padding: '20px'
    }}>
      <div style={{width: '100%', maxWidth: '420px'}}>
        {/* Logo */}
        <div style={{textAlign: 'center', marginBottom: '40px'}}>
          <div style={{
            width: '64px', height: '64px', borderRadius: 'var(--radius-xl)',
            background: 'var(--accent-gradient)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '32px',
            boxShadow: 'var(--shadow-glow)', marginBottom: '16px'
          }}>🧠</div>
          <h1 style={{
            fontSize: '28px', fontWeight: 800,
            background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent', backgroundClip: 'text'
          }}>InterviewIQ</h1>
          <p style={{color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px'}}>
            AI-Powered Interview Analysis
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{padding: '32px'}}>
          {/* Toggle */}
          <div style={{
            display: 'flex', background: 'rgba(255,255,255,0.05)',
            borderRadius: 'var(--radius-md)', padding: '4px', marginBottom: '28px'
          }}>
            <button onClick={() => { setIsLogin(true); setError('') }} style={{
              flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: isLogin ? 'var(--accent-primary)' : 'transparent',
              color: isLogin ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}><LogIn size={16} /> Sign In</button>
            <button onClick={() => { setIsLogin(false); setError('') }} style={{
              flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', border: 'none',
              background: !isLogin ? 'var(--accent-primary)' : 'transparent',
              color: !isLogin ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
            }}><UserPlus size={16} /> Sign Up</button>
          </div>

          {error && (
            <div style={{
              padding: '12px 16px', background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.3)', borderRadius: 'var(--radius-sm)',
              marginBottom: '20px', color: 'var(--color-danger)', fontSize: '13px'
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div style={{marginBottom: '16px'}}>
                <label style={{display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px'}}>Full Name</label>
                <div style={{position: 'relative'}}>
                  <User size={16} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}} />
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required
                    placeholder="John Doe"
                    style={{
                      width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                      color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                      transition: 'border-color 0.2s', boxSizing: 'border-box'
                    }}
                    onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                  />
                </div>
              </div>
            )}

            <div style={{marginBottom: '16px'}}>
              <label style={{display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px'}}>Email</label>
              <div style={{position: 'relative'}}>
                <Mail size={16} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}} />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  style={{
                    width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                    transition: 'border-color 0.2s', boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
            </div>

            <div style={{marginBottom: '24px'}}>
              <label style={{display: 'block', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px'}}>Password</label>
              <div style={{position: 'relative'}}>
                <Lock size={16} style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)'}} />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                  placeholder={isLogin ? '••••••••' : 'Min 6 characters'}
                  style={{
                    width: '100%', padding: '12px 12px 12px 40px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none',
                    transition: 'border-color 0.2s', boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent-primary)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-color)'}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}
              style={{width: '100%', padding: '14px', fontSize: '15px', opacity: loading ? 0.7 : 1}}>
              {loading ? 'Please wait...' : (
                <>{isLogin ? 'Sign In' : 'Create Account'} <ArrowRight size={18} /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
