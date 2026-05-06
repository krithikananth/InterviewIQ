import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Camera, TrendingUp, Eye, Smile, Activity } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalSessions: 0,
    avgConfidence: 0,
    avgEyeContact: 0,
    dominantEmotion: 'neutral'
  })

  return (
    <div className="animate-in">
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Welcome to InterviewIQ — your AI-powered interview coach</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon purple"><Activity size={22} /></div>
          <div>
            <div className="stat-value">{stats.totalSessions}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><TrendingUp size={22} /></div>
          <div>
            <div className="stat-value">{stats.avgConfidence}%</div>
            <div className="stat-label">Avg Confidence</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Eye size={22} /></div>
          <div>
            <div className="stat-value">{stats.avgEyeContact}%</div>
            <div className="stat-label">Eye Contact</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><Smile size={22} /></div>
          <div>
            <div className="stat-value" style={{fontSize: '20px', textTransform: 'capitalize'}}>{stats.dominantEmotion}</div>
            <div className="stat-label">Top Emotion</div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="grid-2" style={{marginTop: '32px'}}>
        <div className="card" style={{display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '48px 32px'}}>
          <div style={{
            width: '80px', height: '80px', borderRadius: 'var(--radius-xl)',
            background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '36px', marginBottom: '24px',
            boxShadow: 'var(--shadow-glow)', animation: 'pulse-glow 2s ease-in-out infinite'
          }}>
            <Camera size={36} color="white" />
          </div>
          <h3 style={{fontSize: '22px', fontWeight: 700, marginBottom: '12px'}}>Start Interview Session</h3>
          <p style={{color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '400px', lineHeight: 1.7}}>
            Begin a real-time AI analysis session. Your webcam will detect facial emotions, track eye contact, and calculate your interview confidence score.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/interview')}>
            <Camera size={20} /> Start Analysis
          </button>
        </div>

        <div className="card" style={{padding: '32px'}}>
          <h3 className="card-title" style={{marginBottom: '20px'}}>How It Works</h3>
          <div style={{display: 'flex', flexDirection: 'column', gap: '20px'}}>
            {[
              { num: '01', title: 'Start Webcam', desc: 'Allow camera access for real-time face detection' },
              { num: '02', title: 'AI Analysis', desc: 'CNN detects emotions, MediaPipe tracks eye contact' },
              { num: '03', title: 'Confidence Score', desc: 'Multi-factor scoring algorithm rates your presence' },
              { num: '04', title: 'Get Report', desc: 'Review analytics, charts, and improvement tips' }
            ].map((step, i) => (
              <div key={i} style={{display: 'flex', gap: '16px', alignItems: 'flex-start'}}>
                <div style={{
                  minWidth: '36px', height: '36px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(108, 92, 231, 0.15)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'var(--accent-secondary)'
                }}>{step.num}</div>
                <div>
                  <div style={{fontWeight: 600, fontSize: '14px', marginBottom: '4px'}}>{step.title}</div>
                  <div style={{fontSize: '13px', color: 'var(--text-secondary)'}}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card" style={{marginTop: '24px'}}>
        <h3 className="card-title">Powered By</h3>
        <div style={{display: 'flex', gap: '24px', flexWrap: 'wrap'}}>
          {['PyTorch CNN', 'OpenCV', 'MediaPipe', 'FastAPI', 'React', 'Node.js', 'MongoDB'].map(tech => (
            <div key={tech} style={{
              padding: '8px 16px', borderRadius: 'var(--radius-full)',
              background: 'rgba(108, 92, 231, 0.08)', border: '1px solid var(--border-color)',
              fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)'
            }}>{tech}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
