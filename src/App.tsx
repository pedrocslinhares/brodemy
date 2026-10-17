import { useEffect } from 'react'
import { HashRouter, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { CalendarCheck, FolderKanban, History as HistoryIcon, LineChart, Settings as SettingsIcon } from 'lucide-react'
import { TimerProvider } from './components/Timer'
import Today from './pages/Today'
import Projects from './pages/Projects'
import ProjectForm from './pages/ProjectForm'
import ProjectDetail from './pages/ProjectDetail'
import DayEditor from './pages/DayEditor'
import SessionPage from './pages/Session'
import History from './pages/History'
import Evolution from './pages/Evolution'
import Settings from './pages/Settings'

const NAV = [
  { to: '/', label: 'Hoje', icon: CalendarCheck, end: true },
  { to: '/projetos', label: 'Projetos', icon: FolderKanban },
  { to: '/historico', label: 'Histórico', icon: HistoryIcon },
  { to: '/evolucao', label: 'Evolução', icon: LineChart },
  { to: '/ajustes', label: 'Ajustes', icon: SettingsIcon },
]

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <TimerProvider>
        <ScrollToTop />
        <main className="app">
          <Routes>
            <Route path="/" element={<Today />} />
            <Route path="/projetos" element={<Projects />} />
            <Route path="/projetos/novo" element={<ProjectForm />} />
            <Route path="/projetos/:id" element={<ProjectDetail />} />
            <Route path="/projetos/:id/editar" element={<ProjectForm />} />
            <Route path="/dia/:dayId" element={<DayEditor />} />
            <Route path="/sessao/:id" element={<SessionPage />} />
            <Route path="/historico" element={<History />} />
            <Route path="/evolucao" element={<Evolution />} />
            <Route path="/ajustes" element={<Settings />} />
            <Route path="*" element={<Today />} />
          </Routes>
        </main>
        <nav className="bottom-nav">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </TimerProvider>
    </HashRouter>
  )
}
