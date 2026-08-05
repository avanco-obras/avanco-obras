import { useState, useEffect, useRef, useCallback } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  Building2, LayoutDashboard, Calendar, Ruler, ClipboardList,
  Settings, LogOut, ChevronDown, Loader2, Download, Bell,
  Sun, Moon, Search, User, ChevronRight, PanelLeftClose, PanelLeftOpen,
  TrendingUp,
} from 'lucide-react'
import { useStore } from '@/store'
import { useAuth } from '@/hooks/useAuth'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'
import { useHistoryStore } from '@/store/historyStore'
import { jsPDF } from 'jspdf'
import type { LucideIcon } from 'lucide-react'
import { NoProjectState } from '@/components/NoProjectState'
import { useNotifications } from '@/hooks/useNotifications'

// ── Route registry — fonte única de nome/ícone/crumb por rota ─────────────────
// Menu principal, menu de configuração, breadcrumb e command palette derivam
// daqui, para que os rótulos não divirjam entre si.
interface RouteMeta {
  to: string
  label: string
  crumb: string
  icon: LucideIcon
  section: 'main' | 'config'
}

const ROUTES: RouteMeta[] = [
  { to: '/dashboard',           label: 'Dashboard',        crumb: 'Visão geral do projeto',        icon: LayoutDashboard, section: 'main'   },
  { to: '/cronograma',          label: 'Cronograma',       crumb: 'Gantt · Linha de base',         icon: Calendar,        section: 'main'   },
  { to: '/linha-de-balanco',    label: 'Linha de Balanço', crumb: 'Planejamento · Reprogramação',  icon: TrendingUp,      section: 'main'   },
  { to: '/medicao',             label: 'Medição Física',   crumb: 'Avanço por unidade',            icon: Ruler,           section: 'main'   },
  { to: '/programacao-semanal', label: 'Prog. Semanal',    crumb: 'PPC · Planejamento LPS',         icon: ClipboardList,   section: 'main'   },
  { to: '/cadastro',            label: 'Cadastro',         crumb: 'Dados do projeto e equipe',      icon: Building2,       section: 'config' },
  { to: '/configuracoes',       label: 'Configurações',    crumb: 'Conta · Tipos · Parâmetros',     icon: Settings,        section: 'config' },
]

const NAV_MAIN   = ROUTES.filter((r) => r.section === 'main')
const NAV_CONFIG = ROUTES.filter((r) => r.section === 'config')

const PAGE_META: Record<string, { title: string; crumb: string }> =
  Object.fromEntries(ROUTES.map((r) => [r.to, { title: r.label, crumb: r.crumb }]))

// ── Tooltip (shown when sidebar is collapsed) ─────────────────────────────────
function Tooltip({ label, visible }: { label: string; visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'absolute',
      left: 'calc(100% + 8px)',
      top: '50%',
      transform: 'translateY(-50%)',
      background: '#1A2D45',
      color: '#E2EBF5',
      fontSize: 11,
      fontWeight: 600,
      padding: '4px 9px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
      zIndex: 200,
      pointerEvents: 'none',
      boxShadow: '0 2px 8px rgba(0,0,0,.3)',
      border: '1px solid rgba(255,255,255,.08)',
    }}>
      {label}
    </div>
  )
}

// ── Command Palette ───────────────────────────────────────────────────────────
const CMD_ITEMS = ROUTES.map((r) => ({
  group: r.section === 'main' ? 'Navegação' : 'Ações',
  label: r.label,
  icon: r.icon,
  to: r.to,
}))

function CommandPalette({ open, onClose, onNavigate }: {
  open: boolean; onClose: () => void; onNavigate: (to: string) => void
}) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setQuery(''); setFocused(0); setTimeout(() => inputRef.current?.focus(), 40) }
  }, [open])

  const filtered = CMD_ITEMS.filter(i =>
    query === '' ||
    i.label.toLowerCase().includes(query.toLowerCase()) ||
    i.group.toLowerCase().includes(query.toLowerCase())
  )

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, filtered.length - 1)) }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
      if (e.key === 'Enter' && filtered[focused]) { onNavigate(filtered[focused].to); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, filtered, focused, onClose, onNavigate])

  if (!open) return null

  const groups = [...new Set(filtered.map(i => i.group))]

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(13,22,41,.55)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}
      onClick={onClose}
    >
      <div style={{ width: 540, maxWidth: 'calc(100vw - 32px)', background: 'var(--s0)', border: '1px solid var(--bd2)', borderRadius: 8, boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderBottom: '1px solid var(--bd)' }}>
          <Search style={{ width: 15, height: 15, color: 'var(--t3)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            style={{ flex: 1, padding: '12px 4px', fontSize: 14, border: 'none', outline: 'none', background: 'transparent', color: 'var(--t1)', fontFamily: 'var(--font)' }}
            placeholder="Buscar ou executar um comando…"
            value={query}
            onChange={e => { setQuery(e.target.value); setFocused(0) }}
          />
        </div>
        <div style={{ maxHeight: 360, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Nenhum resultado para "{query}"</div>
          ) : groups.map(group => (
            <div key={group}>
              <div style={{ padding: '8px 14px 2px', fontSize: 9, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.7px' }}>{group}</div>
              {filtered.filter(i => i.group === group).map(item => {
                const idx = filtered.indexOf(item)
                const Icon = item.icon
                return (
                  <div
                    key={item.to}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', fontSize: 13, color: 'var(--t1)', cursor: 'pointer', background: focused === idx ? 'var(--blu-bg)' : 'transparent', transition: 'background .07s' }}
                    onMouseEnter={() => setFocused(idx)}
                    onClick={() => { onNavigate(item.to); onClose() }}
                  >
                    <Icon style={{ width: 15, height: 15, color: 'var(--t3)' }} />
                    {item.label}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--bd)', display: 'flex', gap: 12, fontSize: 10, color: 'var(--t4)', fontFamily: 'var(--mono)' }}>
          <span>↑↓ navegar</span><span>↵ selecionar</span><span>Esc fechar</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Layout ───────────────────────────────────────────────────────────────
export function AppLayout() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, logout } = useAuth()
  const { currentProject, setCurrentProject, addToast } = useStore()

  const [projects, setProjects]             = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)
  const [projDropOpen, setProjDropOpen]     = useState(false)
  const [userMenuOpen, setUserMenuOpen]     = useState(false)
  const [collapsed, setCollapsed]           = useState(false)
  const [cmdOpen, setCmdOpen]               = useState(false)
  const [tooltip, setTooltip]              = useState<string | null>(null)
  const [exporting, setExporting]           = useState(false)
  const [notifOpen, setNotifOpen]           = useState(false)

  const { undo, redo } = useHistoryStore()

  const [darkMode, setDarkMode] = useState(() => {
    const s = localStorage.getItem('theme')
    return s ? s === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    document.documentElement.classList.toggle('light', !darkMode)
    localStorage.setItem('theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const projRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const { alerts, unreadCount, readIds, markRead, markAllRead } =
    useNotifications(currentProject?.id, user?.notificationPreferences)

  const pageMeta = PAGE_META[location.pathname] ?? { title: 'AvançoObras', crumb: '' }

  // Load projects
  useEffect(() => {
    let cancelled = false
    setLoadingProjects(true)
    projectsApi.list()
      .then(data => {
        if (cancelled) return
        setProjects(data)
        if (!currentProject && data.length > 0) setCurrentProject(data[0])
      })
      .catch(() => { if (!cancelled) addToast({ type: 'error', title: 'Erro ao carregar projetos' }) })
      .finally(() => { if (!cancelled) setLoadingProjects(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Click-outside to close dropdowns
  useEffect(() => {
    function h(e: MouseEvent) {
      if (projRef.current && !projRef.current.contains(e.target as Node)) setProjDropOpen(false)
      if (userRef.current && !userRef.current.contains(e.target as Node)) setUserMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  // Global keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

      // Undo/Redo — only when not typing in an input
      if (!isInput && (e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'z') {
        e.preventDefault(); undo(); return
      }
      if (!isInput && ((e.metaKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y'))) {
        e.preventDefault(); redo(); return
      }

      if (isInput) return
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCmdOpen(o => !o); return }
      // ⌘/Ctrl + 1..N → itens do menu principal, na mesma ordem em que aparecem.
      if (e.metaKey || e.ctrlKey) {
        const n = Number(e.key)
        if (Number.isInteger(n) && n >= 1 && n <= NAV_MAIN.length) {
          e.preventDefault(); navigate(NAV_MAIN[n - 1].to)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate, undo, redo])

  function handleSelectProject(p: Project) {
    setCurrentProject(p)
    setProjDropOpen(false)
    addToast({ type: 'success', title: 'Projeto selecionado', description: p.name })
  }

  function handleLogout() { logout(); navigate('/login', { replace: true }) }

  // Export the current screen as a single-page PDF snapshot.
  async function handleExport() {
    if (exporting) return
    const el = document.querySelector('.ao-content') as HTMLElement | null
    if (!el) return
    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      const pageBg = getComputedStyle(document.documentElement).getPropertyValue('--page').trim() || '#ffffff'
      const canvas = await html2canvas(el, {
        backgroundColor: pageBg,
        scale: 2,
        useCORS: true,
        windowWidth: el.scrollWidth,
        windowHeight: el.scrollHeight,
      })
      const imgData = canvas.toDataURL('image/png')
      const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait'
      const pdf = new jsPDF({ orientation, unit: 'px', format: [canvas.width, canvas.height] })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)
      const safe = (s?: string) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '')
      const stamp = new Date().toISOString().slice(0, 10)
      pdf.save(`${safe(pageMeta.title) || 'tela'}_${safe(currentProject?.name) || 'projeto'}_${stamp}.pdf`)
      addToast({ type: 'success', title: 'Exportado', description: 'PDF da tela atual gerado.' })
    } catch (e) {
      addToast({ type: 'error', title: 'Falha ao exportar', description: (e as Error).message })
    } finally {
      setExporting(false)
    }
  }

  const initials = user?.fullName
    ? user.fullName.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
    : 'U'

  const deadlinePill = (() => {
    if (!currentProject?.endDate) return null
    const diff = Math.ceil((new Date(currentProject.endDate).getTime() - Date.now()) / 86400000)
    const fmt = (d: string) => {
      const dt = new Date(d)
      return `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}/${dt.getFullYear()}`
    }
    if (diff < 0)  return { label: `${Math.abs(diff)}d vencido`, cls: 'red' }
    if (diff < 30) return { label: `${diff}d restantes`,         cls: 'amber' }
    return           { label: fmt(currentProject.endDate),        cls: 'green' }
  })()

  if (loadingProjects) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--page)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 style={{ width: 24, height: 24, color: 'var(--blue)', animation: 'ao-spin 0.7s linear infinite' }} />
          <p style={{ fontSize: 12, color: 'var(--t3)' }}>Carregando…</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} onNavigate={navigate} />

      <div className="ao-app-shell">

        {/* ════════════ SIDEBAR UNIFICADA ════════════ */}
        <aside style={{
          width: collapsed ? 52 : 220,
          background: 'var(--ctx-bg, #0D1526)',
          borderRight: '1px solid rgba(255,255,255,.07)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
          transition: 'width .2s ease',
          zIndex: 30,
        }}>

          {/* ── Logo + toggle ─────────────────────────── */}
          <div style={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            padding: collapsed ? '0 13px' : '0 12px',
            borderBottom: '1px solid rgba(255,255,255,.07)',
            gap: 8,
            flexShrink: 0,
            justifyContent: collapsed ? 'center' : 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
              {/* Logo mark */}
              <div style={{ width: 26, height: 26, background: '#1D4ED8', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" style={{ width: 13, height: 13, display: 'block' }}>
                  <path d="M3 21h18M3 10L12 3l9 7M5 10v11M19 10v11M9 21V15h6v6"/>
                </svg>
              </div>
              {/* Logo text — hidden when collapsed */}
              {!collapsed && (
                <span style={{ fontSize: 13, fontWeight: 700, color: '#E2EBF5', letterSpacing: '-0.2px', whiteSpace: 'nowrap' }}>
                  Avanço<span style={{ color: '#F59E0B' }}>Obras</span>
                  <span style={{ marginLeft: 5, fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,.35)', background: 'rgba(255,255,255,.08)', borderRadius: 2, padding: '1px 4px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>PRO</span>
                </span>
              )}
            </div>
            {/* Toggle button — só aparece quando expandido */}
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', padding: 2, borderRadius: 3, flexShrink: 0, transition: 'color .1s' }}
                title="Recolher menu"
              >
                <PanelLeftClose style={{ width: 15, height: 15 }} />
              </button>
            )}
          </div>

          {/* ── Project selector ──────────────────────── */}
          {!collapsed ? (
            <div style={{ padding: '8px 8px', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0, position: 'relative' }} ref={projRef}>
              <button
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 7,
                  background: 'rgba(255,255,255,.07)', border: '1px solid rgba(255,255,255,.09)',
                  borderRadius: 4, padding: '6px 8px', cursor: 'pointer', fontFamily: 'var(--font)',
                  transition: 'background .1s',
                }}
                onClick={() => setProjDropOpen(o => !o)}
              >
                <div style={{ width: 18, height: 18, background: 'rgba(29,78,216,.28)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" style={{ width: 10, height: 10, display: 'block' }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#E2EBF5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {currentProject ? currentProject.name : 'Selecionar projeto'}
                  </div>
                  {currentProject?.company && (
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentProject.company}
                    </div>
                  )}
                </div>
                <ChevronDown style={{ width: 11, height: 11, color: 'rgba(255,255,255,.3)', flexShrink: 0, transform: projDropOpen ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
              </button>

              {projDropOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 2px)', left: 8, right: 8, background: '#1A2D45', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 100, padding: '4px 0' }}>
                  {projects.length === 0 ? (
                    <div style={{ padding: '8px 12px', fontSize: 11, color: 'rgba(255,255,255,.4)' }}>Nenhum projeto</div>
                  ) : projects.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleSelectProject(p)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px',
                        background: currentProject?.id === p.id ? 'rgba(255,255,255,.07)' : 'none',
                        border: 'none', cursor: 'pointer', fontSize: 12, color: '#D8E6F4',
                        fontFamily: 'var(--font)', textAlign: 'left', transition: 'background .07s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = currentProject?.id === p.id ? 'rgba(255,255,255,.07)' : 'none')}
                    >
                      <Building2 style={{ width: 12, height: 12, flexShrink: 0, color: 'rgba(255,255,255,.4)' }} />
                      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                      {currentProject?.id === p.id && (
                        <svg viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2.5" style={{ width: 10, height: 10, flexShrink: 0 }}><path d="M20 6L9 17l-5-5"/></svg>
                      )}
                    </button>
                  ))}
                  <div style={{ height: 1, background: 'rgba(255,255,255,.08)', margin: '4px 0' }} />
                  <button
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,.5)', fontFamily: 'var(--font)', textAlign: 'left' }}
                    onClick={() => { navigate('/cadastro'); setProjDropOpen(false) }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Novo projeto
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed: small project dot indicator */
            <div style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderBottom: '1px solid rgba(255,255,255,.07)', flexShrink: 0 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: currentProject ? '#3B82F6' : 'rgba(255,255,255,.2)' }} title={currentProject?.name} />
            </div>
          )}

          {/* ── Navigation ────────────────────────────── */}
          <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>

            {/* Section label — only when expanded */}
            {!collapsed && (
              <div style={{ fontSize: 8.5, fontWeight: 800, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '1.2px', padding: '8px 12px 4px' }}>
                Principal
              </div>
            )}

            {NAV_MAIN.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} style={{ textDecoration: 'none', display: 'block' }}>
                {({ isActive }) => (
                  <div
                    className={isActive ? 'ao-ctx-item active' : 'ao-ctx-item'}
                    style={{
                      position: 'relative',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '10px 0' : '7px 12px',
                    }}
                    onMouseEnter={() => collapsed && setTooltip(label)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <Icon style={{ width: collapsed ? 18 : 14, height: collapsed ? 18 : 14, flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                    {!collapsed && <span style={{ fontSize: 12 }}>{label}</span>}
                    {collapsed && <Tooltip label={label} visible={tooltip === label} />}
                  </div>
                )}
              </NavLink>
            ))}

            {/* Config section */}
            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '6px 10px' }} />

            {!collapsed && (
              <div style={{ fontSize: 8.5, fontWeight: 800, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '1.2px', padding: '4px 12px' }}>
                Configuração
              </div>
            )}

            {NAV_CONFIG.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} style={{ textDecoration: 'none', display: 'block' }}>
                {({ isActive }) => (
                  <div
                    className={isActive ? 'ao-ctx-item active' : 'ao-ctx-item'}
                    style={{
                      position: 'relative',
                      justifyContent: collapsed ? 'center' : 'flex-start',
                      padding: collapsed ? '10px 0' : '7px 12px',
                    }}
                    onMouseEnter={() => collapsed && setTooltip(label)}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <Icon style={{ width: collapsed ? 18 : 14, height: collapsed ? 18 : 14, flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                    {!collapsed && <span style={{ fontSize: 12 }}>{label}</span>}
                    {collapsed && <Tooltip label={label} visible={tooltip === label} />}
                  </div>
                )}
              </NavLink>
            ))}
          </nav>

          {/* ── User footer ───────────────────────────── */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,.07)', padding: collapsed ? '8px 0' : '8px 10px', flexShrink: 0, position: 'relative' }} ref={userRef}>

            {/* Expand button when collapsed */}
            {collapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setCollapsed(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 3, transition: 'color .1s', position: 'relative' }}
                  title="Expandir menu"
                  onMouseEnter={() => setTooltip('Expandir menu')}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <PanelLeftOpen style={{ width: 16, height: 16 }} />
                  <Tooltip label="Expandir menu" visible={tooltip === 'Expandir menu'} />
                </button>
                <div
                  style={{ width: 26, height: 26, borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, cursor: 'pointer', position: 'relative' }}
                  onClick={handleLogout}
                  onMouseEnter={() => setTooltip('Sair')}
                  onMouseLeave={() => setTooltip(null)}
                  title="Sair"
                >
                  {initials}
                  <Tooltip label="Sair" visible={tooltip === 'Sair'} />
                </div>
              </div>
            )}

            {/* Expanded user button */}
            {!collapsed && (
              <>
                <button
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: '4px 4px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font)', transition: 'background .1s' }}
                  onClick={() => setUserMenuOpen(o => !o)}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.05)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#1D4ED8', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#E2EBF5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.fullName ?? user?.username}</div>
                    <div style={{ fontSize: 9, color: 'rgba(255,255,255,.3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{user?.role}</div>
                  </div>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 12, height: 12, color: 'rgba(255,255,255,.25)', flexShrink: 0 }}>
                    <circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>
                  </svg>
                </button>

                {userMenuOpen && (
                  <div style={{ position: 'absolute', bottom: 'calc(100% + 4px)', left: 8, right: 8, background: '#1A2D45', border: '1px solid rgba(255,255,255,.12)', borderRadius: 6, boxShadow: '0 8px 24px rgba(0,0,0,.3)', zIndex: 100, padding: '4px 0' }}>
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,.08)', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#D8E6F4' }}>{user?.fullName ?? user?.username}</div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', marginTop: 1 }}>{user?.email}</div>
                    </div>
                    <button
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#8AAAC8', fontFamily: 'var(--font)', textAlign: 'left', transition: 'background .07s' }}
                      onClick={() => { setUserMenuOpen(false); navigate('/configuracoes') }}
                    >
                      <User style={{ width: 12, height: 12 }} /> Meu Perfil
                    </button>
                    <button
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#FCA5A5', fontFamily: 'var(--font)', textAlign: 'left', transition: 'background .07s' }}
                      onClick={handleLogout}
                    >
                      <LogOut style={{ width: 12, height: 12 }} /> Sair
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* ════════════ MAIN AREA ════════════ */}
        <div className="ao-main">

          {/* Topbar */}
          <header className="ao-topbar">
            {/* Breadcrumb */}
            <div className="ao-breadcrumb">
              {currentProject && (
                <>
                  <span className="ao-breadcrumb-item" style={{ maxWidth: 140 }}>{currentProject.name}</span>
                  <ChevronRight className="ao-breadcrumb-sep" style={{ width: 12, height: 12 }} />
                </>
              )}
              <span className="ao-breadcrumb-item active">{pageMeta.title}</span>
              {pageMeta.crumb && (
                <>
                  <ChevronRight className="ao-breadcrumb-sep" style={{ width: 12, height: 12 }} />
                  <span className="ao-breadcrumb-item" style={{ color: 'var(--t4)' }}>{pageMeta.crumb}</span>
                </>
              )}
            </div>

            <div className="ao-topbar-spacer" />

            {/* Deadline */}
            {deadlinePill && (
              <div className="ao-topbar-pill">
                <span className={`dot ${deadlinePill.cls}`} />
                <span>Prazo: {deadlinePill.label}</span>
              </div>
            )}

            {/* Command palette */}
            <button className="ao-topbar-cmd" onClick={() => setCmdOpen(true)}>
              <Search style={{ width: 12, height: 12 }} />
              Buscar…<kbd>⌘K</kbd>
            </button>

            {/* Dark mode */}
            <button className="ao-icon-btn" onClick={() => setDarkMode(d => !d)} title={darkMode ? 'Modo claro' : 'Modo escuro'}>
              {darkMode ? <Sun style={{ width: 14, height: 14 }} /> : <Moon style={{ width: 14, height: 14 }} />}
            </button>

            {/* Notifications */}
            <div ref={notifRef} style={{ position: 'relative' }}>
              <button
                className="ao-icon-btn"
                onClick={() => setNotifOpen(o => !o)}
                title="Notificações"
                style={{ position: 'relative' }}
              >
                <Bell style={{ width: 14, height: 14 }} />
                {unreadCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 0, right: 0, minWidth: 14, height: 14, padding: '0 3px',
                    borderRadius: 7, background: 'var(--red)', color: '#fff', fontSize: 8.5, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1.5px solid var(--s0)', fontFamily: 'var(--mono)', lineHeight: 1,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', right: 0, width: 320,
                  background: 'var(--s0)', border: '1px solid var(--bd2)', borderRadius: 8,
                  boxShadow: 'var(--shadow-lg)', zIndex: 100, overflow: 'hidden',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid var(--bd)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>Notificações</span>
                    {alerts.length > 0 && (
                      <button
                        onClick={markAllRead}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10.5, color: 'var(--blue)', fontFamily: 'var(--font)' }}
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {alerts.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 11.5, color: 'var(--t3)' }}>
                        Nenhum alerta no momento.
                      </div>
                    ) : alerts.map((a) => {
                      const isRead = readIds.has(a.id)
                      return (
                        <button
                          key={a.id}
                          onClick={() => { markRead(a.id); setNotifOpen(false); navigate(a.to) }}
                          style={{
                            display: 'flex', gap: 8, width: '100%', textAlign: 'left', padding: '9px 12px',
                            border: 'none', borderBottom: '1px solid var(--bd)',
                            background: isRead ? 'transparent' : 'var(--blu-bg)', cursor: 'pointer', fontFamily: 'var(--font)',
                          }}
                        >
                          <span style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, marginTop: 4, background: a.kind === 'delay' ? 'var(--red)' : 'var(--amber)' }} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                            <div style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 1 }}>{a.detail}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Export current screen as PDF */}
            <button
              className="ao-icon-btn"
              onClick={handleExport}
              disabled={exporting || !currentProject}
              title={currentProject ? 'Exportar tela atual (PDF)' : 'Selecione um projeto para exportar'}
              style={{ opacity: exporting || !currentProject ? 0.5 : 1, cursor: exporting || !currentProject ? 'not-allowed' : 'pointer' }}
            >
              {exporting
                ? <Loader2 style={{ width: 14, height: 14 }} className="ao-spin" />
                : <Download style={{ width: 14, height: 14 }} />}
            </button>
          </header>

          {/* Page content */}
          <div className="ao-content ao-fade-in">
            {!currentProject && location.pathname !== '/cadastro' ? (
              <NoProjectState action={{ label: 'Cadastrar projeto', onClick: () => navigate('/cadastro') }} />
            ) : (
              <Outlet />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
