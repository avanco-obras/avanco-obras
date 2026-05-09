import { useState, useEffect, useRef } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
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
} from 'lucide-react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'

const NAV_TABS = [
  { to: '/cadastro', label: 'Cadastro', icon: Building2 },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/cronograma', label: 'Cronograma', icon: Calendar },
  { to: '/medicao', label: 'Medição', icon: Ruler },
  { to: '/programacao-semanal', label: 'Prog. Semanal', icon: ClipboardList },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
]

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

function todayFormatted(): string {
  const d = new Date()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function AppLayout() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { currentProject, setCurrentProject, addToast } = useStore()

  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projectDropdownOpen, setProjectDropdownOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const projectDropdownRef = useRef<HTMLDivElement>(null)
  const userMenuRef = useRef<HTMLDivElement>(null)

  // Load projects on mount
  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    projectsApi
      .list()
      .then((data) => {
        if (cancelled) return
        setProjects(data)
        // Set first project if none is currently selected
        if (!currentProject && data.length > 0) {
          setCurrentProject(data[0])
        }
      })
      .catch(() => {
        if (!cancelled) {
          addToast({
            type: 'error',
            title: 'Erro ao carregar projetos',
            description: 'Verifique a conexão com o servidor.',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingProjects(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        projectDropdownRef.current &&
        !projectDropdownRef.current.contains(e.target as Node)
      ) {
        setProjectDropdownOpen(false)
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelectProject(project: Project) {
    setCurrentProject(project)
    setProjectDropdownOpen(false)
    addToast({
      type: 'success',
      title: 'Projeto selecionado',
      description: project.name,
    })
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  const userInitials = user?.fullName
    ? user.fullName
        .split(' ')
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : 'U'

  if (loadingProjects) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <Loader2
            style={{ width: 36, height: 36, color: 'var(--amber)', animation: 'spin 1s linear infinite' }}
          />
          <p style={{ fontSize: 13, color: 'var(--t2)' }}>Carregando projetos...</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="ao-app">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '0.5px solid var(--bd)',
            marginBottom: '1rem',
            paddingBottom: '.875rem',
          }}
        >
          {/* Left: logo + project selector */}
          <div>
            {/* Logo */}
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
              Avanço
              <span style={{ color: 'var(--amber)' }}>Obras</span>{' '}
              <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400 }}>Pro</span>
            </div>

            {/* Project selector */}
            <div ref={projectDropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                onClick={() => setProjectDropdownOpen((o) => !o)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: 'var(--t2)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px 0',
                  fontFamily: 'var(--font)',
                }}
              >
                <span>
                  {currentProject ? currentProject.name : 'Selecionar projeto'}
                  {currentProject?.company ? ` · ${currentProject.company}` : ''}
                </span>
                <ChevronDown
                  style={{
                    width: 12,
                    height: 12,
                    transform: projectDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>

              {projectDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    minWidth: 220,
                    background: 'var(--bg1)',
                    border: '0.5px solid var(--bd2)',
                    borderRadius: 'var(--r-lg)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                    zIndex: 50,
                    padding: '4px 0',
                  }}
                >
                  {projects.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: 12, color: 'var(--t2)' }}>
                      Nenhum projeto encontrado
                    </div>
                  ) : (
                    projects.map((project) => {
                      const isActive = currentProject?.id === project.id
                      return (
                        <button
                          key={project.id}
                          onClick={() => handleSelectProject(project)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '7px 12px',
                            fontSize: 12,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            background: isActive ? 'var(--bg2)' : 'none',
                            color: isActive ? 'var(--t1)' : 'var(--t2)',
                            fontWeight: isActive ? 500 : 400,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'var(--font)',
                          }}
                        >
                          <Building2 style={{ width: 12, height: 12, flexShrink: 0 }} />
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {project.name}
                          </span>
                          {isActive && (
                            <span style={{ color: 'var(--amber)', fontSize: 11 }}>✓</span>
                          )}
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right: dates + user avatar */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            {/* Date info */}
            <div style={{ fontSize: 11, color: 'var(--t2)', textAlign: 'right' }}>
              <div>Atualização: {todayFormatted()}</div>
              {currentProject?.endDate && (
                <div>Prazo: {formatDate(currentProject.endDate)}</div>
              )}
            </div>

            {/* User avatar + menu */}
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'none',
                  border: '0.5px solid var(--bd)',
                  borderRadius: 'var(--r-md)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font)',
                }}
              >
                {user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: 'var(--amber)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
                    {userInitials}
                  </div>
                )}
                <ChevronDown
                  style={{
                    width: 12,
                    height: 12,
                    color: 'var(--t3)',
                    transform: userMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.15s',
                  }}
                />
              </button>

              {userMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    width: 200,
                    background: 'var(--bg1)',
                    border: '0.5px solid var(--bd2)',
                    borderRadius: 'var(--r-lg)',
                    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                    zIndex: 50,
                    padding: '4px 0',
                  }}
                >
                  <div
                    style={{
                      padding: '8px 12px',
                      borderBottom: '0.5px solid var(--bd)',
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.fullName ?? user?.username}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user?.email}
                    </div>
                    <span className="ao-badge ao-bk" style={{ marginTop: 4 }}>
                      {user?.role}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setUserMenuOpen(false)
                      navigate('/configuracoes')
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 12px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--t1)',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    <User style={{ width: 13, height: 13 }} />
                    Meu Perfil
                  </button>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 12px',
                      fontSize: 12,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--red)',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    <LogOut style={{ width: 13, height: 13 }} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Navigation ──────────────────────────────────────────── */}
        <nav
          style={{
            display: 'flex',
            background: 'var(--bg1)',
            border: '0.5px solid var(--bd)',
            borderRadius: 12,
            padding: 4,
            gap: 2,
            overflowX: 'auto',
            marginBottom: '1.25rem',
          }}
        >
          {NAV_TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              style={({ isActive }) => ({
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--t1)' : 'var(--t2)',
                background: isActive ? 'var(--bg2)' : 'none',
                border: 'none',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                textDecoration: 'none',
                transition: 'all 0.15s',
                flexShrink: 0,
              })}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    style={{
                      width: 14,
                      height: 14,
                      color: isActive ? 'var(--amber)' : 'var(--t3)',
                      flexShrink: 0,
                    }}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* ── Main Content ────────────────────────────────────────── */}
        <main>
          {!currentProject ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '40vh',
                gap: '1rem',
                textAlign: 'center',
              }}
            >
              <Building2 style={{ width: 48, height: 48, color: 'var(--t3)', opacity: 0.5 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>
                  Nenhum projeto selecionado
                </div>
                <div style={{ fontSize: 12, color: 'var(--t2)', maxWidth: 320 }}>
                  Selecione um projeto no menu acima para começar, ou cadastre um novo projeto.
                </div>
              </div>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  )
}
