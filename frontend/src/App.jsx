import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { Camera, BarChart3, FileText, Home, Settings } from 'lucide-react'
import './index.css'
import DashboardPage from './pages/DashboardPage'
import InterviewPage from './pages/InterviewPage'
import ReportPage from './pages/ReportPage'

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-logo">
            <div className="logo-icon">🧠</div>
            <h1>InterviewIQ</h1>
          </div>

          <nav className="sidebar-nav">
            <NavLink to="/" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`} end>
              <Home size={18} /> Dashboard
            </NavLink>
            <NavLink to="/interview" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <Camera size={18} /> Interview
            </NavLink>
            <NavLink to="/report" className={({isActive}) => `nav-item ${isActive ? 'active' : ''}`}>
              <FileText size={18} /> Reports
            </NavLink>
          </nav>

          <div style={{borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: 'auto'}}>
            <div className="nav-item" style={{opacity: 0.6}}>
              <Settings size={18} /> Settings
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/interview" element={<InterviewPage />} />
            <Route path="/report" element={<ReportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
