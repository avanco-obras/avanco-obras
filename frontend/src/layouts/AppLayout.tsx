import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Building2,
  LayoutDashboard,
  Calendar,
  Ruler,
  ClipboardList,
  Settings,
  LogOut,
  ChevronDown,
  Loader2,
  User,
  Menu,
  Bell,
  Download,
  MoreHorizontal,
  Sun,
  Moon,
} from 'lucide-react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'

const NAV_ITEMS = [
  { to: '/dashboard',          label: 'Dashboard',          icon: LayoutDashboard },
  { to: '/cronograma',         label: 'Cronograma',         icon: Calendar        },
  { to: '/medicao',            label: 'Medição',            icon: Ruler           },
  { to: '/programacao-semanal',label: 'Prog. Semanal',      icon: ClipboardList   },
]

const NAV_CONFIG = [
  { to: '/cadastro',      label: 'Cadastro',     icon: Building2 },
  { to: '/configuracoes', label: 'Configurações', icon: Settings  },
]

const PAGE_INFO: Record<string, { title: string; crumb: string }> = {
  '/dashboard':           { title: 'Dashboard',          crumb: 'Visão geral do projeto' },
  '/cronograma':          { title: 'Cronograma',          crumb: 'Linha de base · Gantt' },
  '/medicao':             { title: 'Medição Física',      crumb: 'Registro de avanço por unidade' },
  '/programacao-semanal': { title: 'Programação Semanal', crumb: 'Planejamento e PPC semanal' },
  '/cadastro':            { title: 'Cadastro',            crumb: 'Dados do projeto e equipe' },
  '/configuracoes':       { title: 'Configurações',       crumb: 'Tipos de atividade · Usuários' },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

function todayFormatted(): string {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`
}

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()
  const { currentProject, setCurrentProject, addToast } = useStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projDropOpen, setProjDropOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved === 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const projDropRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  const pageInfo = PAGE_INFO[location.pathname] ?? { title: 'AvancoObras', crumb: '' }

  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    projectsApi
      .list()
      .then((data) => {
        if (cancelled) return
        setProjects(data)
        if (!currentProject && data.length > 0) setCurrentProject(data[0])
      })
      .catch(() => {
        if (!cancelled) addToast({ type: 'error', title: 'Erro ao carregar projetos', description: 'Verifique a conexão.' })
      })
      .finally(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (projDropRef.current && !projDropRef.current.contains(e.target as Node))
        setProjDropOpen(false)
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node))
        setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelectProject(p: Project) {
    setCurrentProject(p)
    setProjDropOpen(false)
    addToast({ type: 'success', title: 'Projeto selecionado', description: p.name })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const userInitials = user?.fullName
    ? user.fullName.split(' ').slice(0,2).map(n => n[0]).join('').toUpperCase()
    : 'U'

  if (loadingProjects) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 style={{ width: 28, height: 28, color: 'var(--blue)', animation: 'ao-spin 1s linear infinite' }} />
          <p style={{ fontSize: 12, color: 'var(--t2)' }}>Carregando projetos…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="ao-app-shell">

      {/* ════════════════ SIDEBAR ════════════════ */}
      <aside className={`ao-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>

        {/* Logo */}
        <div className="ao-sidebar-logo">
          <div className="ao-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M3 21h18M3 10L12 3l9 7M5 10v11M19 10v11M9 21V15h6v6"/>
            </svg>
          </div>
          {!sidebarCollapsed && (
            <>
              <span className="ao-logo-text">Avanço<span>Obras</span></span>
              <span className="ao-logo-badge">PRO</span>
            </>
          )}
        </div>

        {/* Project selector */}
        {!sidebarCollapsed && (
          <div className="ao-proj-selector" ref={projDropRef}>
            <button className="ao-proj-btn" onClick={() => setProjDropOpen(o => !o)}>
              <div className="ao-proj-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18"/>
                </svg>
              </div>
              <div className="ao-proj-info">
                <div className="ao-proj-name">{currentProject ? currentProject.name : 'Selecionar projeto'}</div>
                {currentProject?.company && (
                  <div className="ao-proj-sub">{currentProject.company}</div>
                )}
              </div>
              <ChevronDown style={{ width: 12, height: 12, color: 'var(--t3)', transform: projDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s', flexShrink: 0 }} />
            </button>

            {projDropOpen && (
              <div className="ao-dropdown" style={{ top: 'calc(100% + 4px)', left: 10, right: 10, minWidth: 0 }}>
                {projects.length === 0 ? (
                  <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--t2)' }}>Nenhum projeto encontrado</div>
                ) : projects.map(p => (
                  <button key={p.id} className={`ao-dropdown-item${currentProject?.id === p.id ? ' active' : ''}`}
                    onClick={() => handleSelectProject(p)}>
                    <Building2 style={{ width: 12, height: 12, flexShrink: 0 }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    {currentProject?.id === p.id && (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width: 10, height: 10, color: 'var(--blue)', flexShrink: 0 }}>
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <nav className="ao-nav-section">
          {!sidebarCollapsed && <div className="ao-nav-label">Principal</div>}
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div className={`ao-nav-item${isActive ? ' active' : ''}`}>
                  <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {!sidebarCollapsed && label}
                </div>
              )}
            </NavLink>
          ))}

          {!sidebarCollapsed && <div className="ao-nav-label" style={{ marginTop: 6 }}>Configuração</div>}
          {sidebarCollapsed && <div style={{ height: 8 }} />}
          {NAV_CONFIG.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} style={{ textDecoration: 'none' }}>
              {({ isActive }) => (
                <div className={`ao-nav-item${isActive ? ' active' : ''}`}>
                  <Icon style={{ width: 14, height: 14, flexShrink: 0 }} />
                  {!sidebarCollapsed && label}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        {!sidebarCollapsed ? (
          <div className="ao-sidebar-footer" ref={userMenuRef}>
            <button className="ao-user-btn" onClick={() => setUserMenuOpen(o => !o)}>
              <div className="ao-user-avatar">{userInitials}</div>
              <div className="ao-user-info">
                <div className="ao-user-name">{user?.fullName ?? user?.username}</div>
                <div className="ao-user-role">{user?.role}</div>
              </div>
              <MoreHorizontal style={{ width: 12, height: 12, color: 'var(--t3)', flexShrink: 0 }} />
            </button>

            {userMenuOpen && (
              <div className="ao-dropdown" style={{ bottom: 'calc(100% + 4px)', left: 10, right: 10 }}>
                <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--bd)', marginBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)' }}>{user?.fullName ?? user?.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{user?.email}</div>
                </div>
                <button className="ao-dropdown-item" onClick={() => { setUserMenuOpen(false); navigate('/configuracoes') }}>
                  <User style={{ width: 12, height: 12 }} />
                  Meu Perfil
                </button>
                <button className="ao-dropdown-item" style={{ color: 'var(--red)' }} onClick={handleLogout}>
                  <LogOut style={{ width: 12, height: 12 }} />
                  Sair
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="ao-sidebar-footer" style={{ display: 'flex', justifyContent: 'center' }}>
            <div className="ao-user-avatar" style={{ cursor: 'pointer' }} onClick={handleLogout}>{userInitials}</div>
          </div>
        )}
      </aside>

      {/* ════════════════ MAIN ════════════════ */}
      <div className="ao-main">

        {/* Top bar */}
        <header className="ao-topbar">
          <button className="ao-icon-btn" onClick={() => setSidebarCollapsed(c => !c)}>
            <Menu style={{ width: 14, height: 14 }} />
          </button>

          <span className="ao-topbar-title">{pageInfo.title}</span>

          {pageInfo.crumb && (
            <>
              <span className="ao-topbar-sep" />
              <span className="ao-topbar-crumb">{pageInfo.crumb}</span>
            </>
          )}

          <span className="ao-topbar-spacer" />

          {/* Project deadline pill */}
          {currentProject?.endDate && (
            <div className="ao-topbar-pill">
              <span className="dot amber" />
              <span>Prazo: {formatDate(currentProject.endDate)}</span>
            </div>
          )}

          <div className="ao-topbar-pill">
            <span style={{ fontSize: 10, color: 'var(--t3)' }}>Atualizado</span>
            <span>{todayFormatted()}</span>
          </div>

          <button className="ao-icon-btn" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Modo claro' : 'Modo escuro'}>
            {darkMode ? <Sun style={{ width: 13, height: 13 }} /> : <Moon style={{ width: 13, height: 13 }} />}
          </button>

          <button className="ao-icon-btn">
            <Bell style={{ width: 13, height: 13 }} />
          </button>

          <button className="ao-icon-btn">
            <Download style={{ width: 13, height: 13 }} />
          </button>
        </header>

        {/* Content */}
        <div className="ao-content ao-fade-in">
          {!currentProject && location.pathname !== '/cadastro' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '40vh', gap: 12, textAlign: 'center' }}>
              <Building2 style={{ width: 40, height: 40, color: 'var(--t3)', opacity: 0.4 }} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>Nenhum projeto selecionado</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', maxWidth: 300 }}>
                  Selecione um projeto no menu lateral ou cadastre um novo.
                </div>
              </div>
              <button className="ao-btn ao-btn-primary" onClick={() => navigate('/cadastro')}>
                <Building2 style={{ width: 12, height: 12 }} />
                Cadastrar projeto
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}
