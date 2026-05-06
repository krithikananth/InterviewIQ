import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Camera, BookOpen, Plus, FolderOpen, TrendingUp, Eye, Smile, Activity } from 'lucide-react'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { user } = useAuth()

  return (
    <div className="animate-in">
      <div className="page-header">
        <h2>Welcome, {user?.name?.split(' ')[0] || 'User'} 👋</h2>
        <p>Your AI-powered interview coach — practice, create tests, and share</p>
      </div>

      {/* Action Cards */}
      <div className="grid-2" style={{marginBottom: '24px'}}>
        {/* Practice Interview */}
        <div className="card" onClick={() => navigate('/test/sample')} style={{cursor: 'pointer', padding: '32px', textAlign: 'center'}}>
          <div style={{
            width: '64px', height: '64px', borderRadius: 'var(--radius-xl)',
            background: 'var(--accent-gradient)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '28px',
            boxShadow: 'var(--shadow-glow)', marginBottom: '16px'
          }}>
            <BookOpen size={28} color="white" />
          </div>
          <h3 style={{fontSize: '18px', fontWeight: 700, marginBottom: '8px'}}>Practice Interview</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, maxWidth: '300px', margin: '0 auto 16px'}}>
            Take a sample test with 5 common interview questions. AI analyzes your emotions, eye contact, and speech fluency.
          </p>
          <button className="btn btn-primary">
            <BookOpen size={16} /> Start Practice
          </button>
        </div>

        {/* Free Camera Analysis */}
        <div className="card" onClick={() => navigate('/interview')} style={{cursor: 'pointer', padding: '32px', textAlign: 'center'}}>
          <div style={{
            width: '64px', height: '64px', borderRadius: 'var(--radius-xl)',
            background: 'linear-gradient(135deg, #00cec9 0%, #00b894 100%)', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '28px',
            marginBottom: '16px'
          }}>
            <Camera size={28} color="white" />
          </div>
          <h3 style={{fontSize: '18px', fontWeight: 700, marginBottom: '8px'}}>Free Practice</h3>
          <p style={{color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6, maxWidth: '300px', margin: '0 auto 16px'}}>
            Open webcam and practice on your own. See real-time emotion detection and confidence scoring.
          </p>
          <button className="btn btn-success">
            <Camera size={16} /> Open Camera
          </button>
        </div>
      </div>

      {/* Test Management */}
      <div className="grid-2" style={{marginBottom: '24px'}}>
        <div className="card" onClick={() => navigate('/create-test')} style={{cursor: 'pointer', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px'}}>
          <div style={{
            width: '52px', height: '52px', borderRadius: 'var(--radius-md)',
            background: 'rgba(253, 203, 110, 0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <Plus size={24} color="var(--color-warning)" />
          </div>
          <div>
            <h4 style={{fontSize: '16px', fontWeight: 600, marginBottom: '4px'}}>Create Test</h4>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)'}}>Create custom questions, share link, and collect responses with AI analysis</p>
          </div>
        </div>

        <div className="card" onClick={() => navigate('/my-tests')} style={{cursor: 'pointer', padding: '24px', display: 'flex', alignItems: 'center', gap: '20px'}}>
          <div style={{
            width: '52px', height: '52px', borderRadius: 'var(--radius-md)',
            background: 'rgba(116, 185, 255, 0.15)', display: 'flex',
            alignItems: 'center', justifyContent: 'center'
          }}>
            <FolderOpen size={24} color="var(--color-info)" />
          </div>
          <div>
            <h4 style={{fontSize: '16px', fontWeight: 600, marginBottom: '4px'}}>My Tests</h4>
            <p style={{fontSize: '13px', color: 'var(--text-secondary)'}}>View created tests, see who took them, and download their reports</p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="card" style={{padding: '32px'}}>
        <h3 className="card-title" style={{marginBottom: '20px'}}>How It Works</h3>
        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px'}}>
          {[
            { num: '01', title: 'Create or Practice', desc: 'Use sample questions or create your own test', icon: '📝' },
            { num: '02', title: 'AI Analysis', desc: 'CNN detects emotions, tracks eyes, analyzes speech', icon: '🧠' },
            { num: '03', title: 'Share & Collect', desc: 'Share test link and view all candidate responses', icon: '🔗' },
            { num: '04', title: 'Reports & PDF', desc: 'Get detailed reports with grades and download PDFs', icon: '📊' }
          ].map((step, i) => (
            <div key={i} style={{textAlign: 'center'}}>
              <div style={{fontSize: '32px', marginBottom: '12px'}}>{step.icon}</div>
              <div style={{fontSize: '11px', fontWeight: 700, color: 'var(--accent-secondary)', marginBottom: '6px'}}>{step.num}</div>
              <div style={{fontWeight: 600, fontSize: '14px', marginBottom: '4px'}}>{step.title}</div>
              <div style={{fontSize: '12px', color: 'var(--text-secondary)' }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tech Stack */}
      <div className="card" style={{marginTop: '16px'}}>
        <h3 className="card-title">Powered By</h3>
        <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap'}}>
          {['PyTorch CNN (66.8%)', 'OpenCV', 'Web Speech API', 'FastAPI', 'React', 'Node.js', 'MongoDB', 'jsPDF'].map(tech => (
            <span key={tech} style={{
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              background: 'rgba(108, 92, 231, 0.08)', border: '1px solid var(--border-color)',
              fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)'
            }}>{tech}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
