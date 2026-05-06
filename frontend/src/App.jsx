import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom'
import { Camera, BarChart3, FileText, Home, Plus, FolderOpen, LogOut, BookOpen, User } from 'lucide-react'
import { AuthProvider, useAuth } from './context/AuthContext'
import './index.css'

import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import InterviewPage from './pages/InterviewPage'
import ReportPage from './pages/ReportPage'
import TakeTestPage from './pages/TakeTestPage'
import CreateTestPage from './pages/CreateTestPage'
import MyTestsPage from './pages/MyTestsPage'
import LiveHostPage from './pages/LiveHostPage'
import LiveJoinPage from './pages/LiveJoinPage'

// Protected route wrapper
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',color:'var(--text-muted)'}}>Loading...</div>
  if (!user) return <Navigate to="/auth" replace />
  return children
}

// Layout with sidebar (only for logged-in users)
function AppLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()

  // No sidebar for auth page or public test page
  const noSidebar = ['/auth'].includes(location.pathname) || location.pathname.startsWith('/test/') || location.pathname.startsWith('/live/')
  if (noSidebar || !user) {
    return (
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/test/:code" element={<TakeTestPage />} />
        <Route path="/live/join/:roomId" element={<LiveJoinPage />} />
        <Route path="/live/host/:roomId" element={<ProtectedRoute><LiveHostPage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    )
  }

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🧠</div>
          <h1>InterviewIQ</h1>
        </div>

        <nav className="sidebar-nav">
          <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
            <Home size={18} /> Dashboard
          </NavLink>
          <NavLink to="/interview" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Camera size={18} /> Free Practice
          </NavLink>
          <NavLink to="/test/sample" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <BookOpen size={18} /> Sample Test
          </NavLink>

          <div style={{height:'1px', background:'var(--border-color)', margin:'12px 0'}} />
          <div style={{fontSize:'11px', color:'var(--text-muted)', padding:'4px 16px', textTransform:'uppercase', letterSpacing:'1px'}}>Tests</div>

          <NavLink to="/create-test" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <Plus size={18} /> Create Test
          </NavLink>
          <NavLink to="/my-tests" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <FolderOpen size={18} /> My Tests
          </NavLink>
          <NavLink to="/report" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
            <FileText size={18} /> Reports
          </NavLink>
        </nav>

        {/* User section */}
        <div style={{borderTop:'1px solid var(--border-color)', paddingTop:'16px', marginTop:'auto'}}>
          <div style={{display:'flex', alignItems:'center', gap:'12px', padding:'8px 16px', marginBottom:'8px'}}>
            <div style={{
              width:'36px', height:'36px', borderRadius:'50%',
              background:'var(--accent-gradient)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:'14px', fontWeight:700, color:'white'
            }}>{user.name?.charAt(0).toUpperCase()}</div>
            <div>
              <div style={{fontSize:'13px', fontWeight:600}}>{user.name}</div>
              <div style={{fontSize:'11px', color:'var(--text-muted)'}}>{user.email}</div>
            </div>
          </div>
          <button onClick={logout} className="nav-item" style={{color:'var(--color-danger)', opacity:0.7}}>
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <Routes>
          <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/interview" element={<ProtectedRoute><InterviewPage /></ProtectedRoute>} />
          <Route path="/test/:code" element={<TakeTestPage />} />
          <Route path="/create-test" element={<ProtectedRoute><CreateTestPage /></ProtectedRoute>} />
          <Route path="/my-tests" element={<ProtectedRoute><MyTestsPage /></ProtectedRoute>} />
          <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />
          <Route path="/live/host/:roomId" element={<ProtectedRoute><LiveHostPage /></ProtectedRoute>} />
          <Route path="/live/join/:roomId" element={<LiveJoinPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
