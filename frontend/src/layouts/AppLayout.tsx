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
  HardHat,
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando projetos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Top Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-card border-b border-border shadow-sm">
        <div className="flex items-center h-14 px-4 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="bg-primary rounded-md p-1.5">
              <HardHat className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-base hidden sm:block leading-tight">
              AvançoObras{' '}
              <span className="text-primary font-extrabold">Pro</span>
            </span>
          </div>

          {/* Project Selector — center */}
          <div className="flex-1 flex justify-center">
            <div ref={projectDropdownRef} className="relative">
              <button
                onClick={() => setProjectDropdownOpen((o) => !o)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-background hover:bg-accent transition-colors text-sm font-medium max-w-xs min-w-[160px]"
              >
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="truncate flex-1 text-left">
                  {currentProject ? currentProject.name : 'Selecionar projeto'}
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                    projectDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {projectDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50 py-1">
                  {projects.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      Nenhum projeto encontrado
                    </div>
                  ) : (
                    projects.map((project) => (
                      <button
                        key={project.id}
                        onClick={() => handleSelectProject(project)}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                          currentProject?.id === project.id
                            ? 'bg-accent text-accent-foreground font-medium'
                            : 'text-foreground'
                        }`}
                      >
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{project.name}</span>
                        {currentProject?.id === project.id && (
                          <span className="ml-auto text-primary text-xs">✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* User Menu */}
          <div ref={userMenuRef} className="relative shrink-0">
            <button
              onClick={() => setUserMenuOpen((o) => !o)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent transition-colors"
            >
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.fullName}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                  {userInitials}
                </div>
              )}
              <span className="hidden md:block text-sm font-medium text-foreground max-w-[120px] truncate">
                {user?.fullName ?? user?.username ?? 'Usuário'}
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  userMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {userMenuOpen && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-popover border border-border rounded-md shadow-lg z-50 py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {user?.fullName ?? user?.username}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                  <span className="inline-flex mt-1 items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                    {user?.role}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setUserMenuOpen(false)
                    navigate('/configuracoes')
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-foreground"
                >
                  <User className="h-4 w-4" />
                  Meu Perfil
                </button>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Navigation Tabs ───────────────────────────────────────── */}
        <nav className="overflow-x-auto scrollbar-none">
          <div className="flex items-center px-4 gap-0.5 min-w-max">
            {NAV_TABS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    isActive
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  }`
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      {/* ── Main Content ──────────────────────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        {!currentProject ? (
          <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 text-center px-4">
            <Building2 className="h-16 w-16 text-muted-foreground/40" />
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">
                Nenhum projeto selecionado
              </h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Selecione um projeto no menu acima para começar, ou cadastre um novo projeto.
              </p>
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  )
}
