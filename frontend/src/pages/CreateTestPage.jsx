import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Plus, Trash2, Clock, Share2, Video, Send, GripVertical } from 'lucide-react'

export default function CreateTestPage() {
  const { authFetch } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState([{ text: '', timeLimit: 90 }])
  const [mode, setMode] = useState('async')
  const [loading, setLoading] = useState(false)
  const [shareLink, setShareLink] = useState(null)

  const addQuestion = () => setQuestions(prev => [...prev, { text: '', timeLimit: 90 }])

  const updateQuestion = (i, field, value) => {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, [field]: value } : q))
  }

  const removeQuestion = (i) => {
    if (questions.length <= 1) return
    setQuestions(prev => prev.filter((_, idx) => idx !== i))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!title || questions.some(q => !q.text)) return
    setLoading(true)

    try {
      const res = await authFetch('/tests', {
        method: 'POST',
        body: JSON.stringify({ title, description, questions, mode })
      })
      const data = await res.json()
      if (res.ok) {
        setShareLink(`${window.location.origin}/test/${data.test.shareCode}`)
      }
    } catch (err) {
      console.error(err)
    }
    setLoading(false)
  }

  if (shareLink) {
    return (
      <div className="animate-in" style={{ maxWidth: '600px', margin: '40px auto', textAlign: 'center' }}>
        <div style={{
          width: '80px', height: '80px', borderRadius: 'var(--radius-xl)',
          background: 'rgba(0, 206, 201, 0.15)', display: 'inline-flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '40px', marginBottom: '24px'
        }}>✅</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Test Created!</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>Share this link with candidates</p>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{
            background: 'rgba(108, 92, 231, 0.08)', padding: '16px', borderRadius: 'var(--radius-md)',
            fontSize: '14px', fontWeight: 500, wordBreak: 'break-all', color: 'var(--accent-secondary)',
            marginBottom: '16px'
          }}>{shareLink}</div>
          <button className="btn btn-primary" style={{ width: '100%' }}
            onClick={() => { navigator.clipboard.writeText(shareLink); }}>
            <Share2 size={16} /> Copy Link
          </button>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '24px' }}>
          <button className="btn btn-outline" onClick={() => navigate('/my-tests')}>View My Tests</button>
          <button className="btn btn-primary" onClick={() => { setShareLink(null); setTitle(''); setDescription(''); setQuestions([{ text: '', timeLimit: 90 }]) }}>Create Another</button>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div className="page-header">
        <h2>Create Interview Test</h2>
        <p>Add questions, set time limits, and share with candidates</p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Title & Description */}
        <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Test Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="e.g. Frontend Developer Interview"
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box'
              }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of this test..."
              rows={2}
              style={{
                width: '100%', padding: '12px 16px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                fontFamily: 'inherit'
              }} />
          </div>
        </div>

        {/* Test Mode */}
        <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
          <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Test Mode</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button type="button" onClick={() => setMode('async')} style={{
              flex: 1, padding: '16px', borderRadius: 'var(--radius-md)', border: `2px solid ${mode === 'async' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              background: mode === 'async' ? 'rgba(108,92,231,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)'
            }}>
              <Send size={20} style={{ color: 'var(--accent-secondary)', marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Share & Collect</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>Candidates take test on their own. View all responses.</div>
            </button>
            <button type="button" onClick={() => setMode('live')} style={{
              flex: 1, padding: '16px', borderRadius: 'var(--radius-md)', border: `2px solid ${mode === 'live' ? 'var(--accent-primary)' : 'var(--border-color)'}`,
              background: mode === 'live' ? 'rgba(108,92,231,0.1)' : 'transparent', cursor: 'pointer', textAlign: 'left', color: 'var(--text-primary)'
            }}>
              <Video size={20} style={{ color: 'var(--accent-secondary)', marginBottom: '8px' }} />
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Live Interview</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>One-to-one video interview with real-time analysis.</div>
            </button>
          </div>
        </div>

        {/* Questions */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="card-title">Questions</h3>
          {questions.map((q, i) => (
            <div key={i} style={{
              display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '16px',
              padding: '16px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 700, minWidth: '28px', paddingTop: '8px' }}>
                {i + 1}.
              </div>
              <div style={{ flex: 1 }}>
                <textarea value={q.text} onChange={e => updateQuestion(i, 'text', e.target.value)}
                  placeholder="Enter your question..."
                  rows={2} required
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-primary)', fontSize: '14px', outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', fontFamily: 'inherit'
                  }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                  <Clock size={14} color="var(--text-muted)" />
                  <select value={q.timeLimit} onChange={e => updateQuestion(i, 'timeLimit', Number(e.target.value))}
                    style={{
                      padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-color)', background: 'var(--bg-card)',
                      color: 'var(--text-primary)', fontSize: '12px', outline: 'none'
                    }}>
                    <option value={30}>30s</option><option value={60}>60s</option>
                    <option value={90}>90s</option><option value={120}>2 min</option>
                    <option value={180}>3 min</option><option value={300}>5 min</option>
                  </select>
                </div>
              </div>
              <button type="button" onClick={() => removeQuestion(i)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', opacity: questions.length <= 1 ? 0.2 : 0.7, padding: '8px' }}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}

          <button type="button" onClick={addQuestion} className="btn btn-outline" style={{ width: '100%', marginTop: '8px' }}>
            <Plus size={16} /> Add Question
          </button>
        </div>

        <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
          style={{ width: '100%', marginTop: '24px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating...' : <><Share2 size={20} /> Create & Get Share Link</>}
        </button>
      </form>
    </div>
  )
}
