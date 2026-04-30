import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Layers, FileText, BarChart2, Zap, Layout, TrendingUp } from 'lucide-react'
import ListingsPage from './pages/ListingsPage.jsx'
import ResumePage from './pages/ResumePage.jsx'
import SkillsPage from './pages/SkillsPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import PipelinePage from './pages/PipelinePage.jsx'
import ActivityPage from './pages/ActivityPage.jsx'

const nav = [
  { to: '/', label: 'Listings', icon: Layers },
  { to: '/pipeline', label: 'Pipeline', icon: Layout },
  { to: '/activity', label: 'Activity', icon: TrendingUp },
  { to: '/skills', label: 'Skills', icon: BarChart2 },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/analysis', label: 'Gap Analysis', icon: Zap },
]

export default function App() {
  const location = useLocation()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <header style={{
        borderBottom: '1px solid var(--border)',
        background: 'white',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '0 24px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          gap: 32,
        }}>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em' }}>
            JobScout
          </span>
          <nav style={{ display: 'flex', gap: 2 }}>
            {nav.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '5px 10px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  background: isActive ? 'var(--bg)' : 'transparent',
                  transition: 'all 0.12s',
                })}
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main style={{ flex: 1, maxWidth: 1100, margin: '0 auto', width: '100%', padding: '32px 24px' }}>
        <Routes>
          <Route path="/" element={<ListingsPage />} />
          <Route path="/skills" element={<SkillsPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/pipeline" element={<PipelinePage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
        </Routes>
      </main>
    </div>
  )
}
