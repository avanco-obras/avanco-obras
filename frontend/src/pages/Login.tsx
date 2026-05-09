import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  HardHat,
  Mail,
  Lock,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEMO_EMAIL = 'carlos@horizonte.com.br'
const DEMO_PASSWORD = 'admin123'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const addToast = useStore((s) => s.addToast)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Preencha o e-mail e a senha.')
      return
    }
    setError('')
    setIsLoading(true)
    try {
      await login(email.trim(), password)
      addToast({
        type: 'success',
        title: 'Login realizado com sucesso',
        description: 'Bem-vindo ao AvançoObras Pro!',
      })
      navigate('/', { replace: true })
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ??
        'E-mail ou senha inválidos. Verifique as credenciais.'
      setError(msg)
      addToast({ type: 'error', title: 'Falha no login', description: msg })
    } finally {
      setIsLoading(false)
    }
  }

  function fillDemo() {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError('')
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Left Hero Panel ─────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-800">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 30px,
              rgba(255,255,255,0.05) 30px,
              rgba(255,255,255,0.05) 31px
            )`,
          }}
        />

        {/* Decorative circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-sky-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col items-center justify-center w-full px-12 py-16 text-white">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3">
              <HardHat className="h-10 w-10 text-sky-300" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight leading-none">
                AvançoObras
              </h1>
              <span className="text-sky-300 font-bold text-xl">Pro</span>
            </div>
          </div>

          {/* Building SVG Illustration */}
          <div className="mb-10">
            <svg
              width="280"
              height="220"
              viewBox="0 0 280 220"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="opacity-80"
            >
              {/* Ground */}
              <rect x="0" y="205" width="280" height="15" rx="2" fill="rgba(255,255,255,0.15)" />
              {/* Building A */}
              <rect x="20" y="80" width="70" height="125" rx="3" fill="rgba(99,179,237,0.4)" />
              <rect x="20" y="80" width="70" height="6" rx="1" fill="rgba(99,179,237,0.7)" />
              {/* Windows A */}
              {[0, 1, 2, 3, 4].map((row) =>
                [0, 1, 2].map((col) => (
                  <rect
                    key={`a-${row}-${col}`}
                    x={29 + col * 22}
                    y={94 + row * 24}
                    width={14}
                    height={16}
                    rx="2"
                    fill={row === 4 && col === 1 ? 'rgba(254,240,138,0.9)' : 'rgba(255,255,255,0.25)'}
                  />
                ))
              )}
              {/* Building B (tallest) */}
              <rect x="105" y="30" width="80" height="175" rx="3" fill="rgba(129,140,248,0.45)" />
              <rect x="105" y="30" width="80" height="7" rx="1" fill="rgba(129,140,248,0.8)" />
              {/* Antenna */}
              <rect x="143" y="10" width="4" height="22" rx="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="145" cy="9" r="3" fill="rgba(248,113,113,0.8)" />
              {/* Windows B */}
              {[0, 1, 2, 3, 4, 5, 6].map((row) =>
                [0, 1, 2, 3].map((col) => (
                  <rect
                    key={`b-${row}-${col}`}
                    x={112 + col * 19}
                    y={44 + row * 23}
                    width={13}
                    height={15}
                    rx="2"
                    fill={
                      (row + col) % 3 === 0
                        ? 'rgba(254,240,138,0.85)'
                        : 'rgba(255,255,255,0.2)'
                    }
                  />
                ))
              )}
              {/* Building C */}
              <rect x="200" y="100" width="60" height="105" rx="3" fill="rgba(52,211,153,0.35)" />
              <rect x="200" y="100" width="60" height="6" rx="1" fill="rgba(52,211,153,0.7)" />
              {/* Windows C */}
              {[0, 1, 2, 3].map((row) =>
                [0, 1].map((col) => (
                  <rect
                    key={`c-${row}-${col}`}
                    x={208 + col * 26}
                    y={114 + row * 24}
                    width={17}
                    height={15}
                    rx="2"
                    fill={row % 2 === 0 ? 'rgba(254,240,138,0.8)' : 'rgba(255,255,255,0.25)'}
                  />
                ))
              )}
              {/* Crane */}
              <rect x="252" y="50" width="4" height="70" fill="rgba(255,255,255,0.4)" />
              <rect x="230" y="50" width="50" height="4" fill="rgba(255,255,255,0.4)" />
              <rect x="277" y="54" width="2" height="20" fill="rgba(255,255,255,0.3)" />
              {/* Crane hook */}
              <circle cx="278" cy="75" r="3" fill="rgba(254,240,138,0.9)" />
              {/* Progress bar on building B */}
              <rect x="108" y="155" width="74" height="6" rx="3" fill="rgba(255,255,255,0.15)" />
              <rect x="108" y="155" width="52" height="6" rx="3" fill="rgba(52,211,153,0.8)" />
            </svg>
          </div>

          {/* Headline */}
          <div className="text-center max-w-sm">
            <h2 className="text-2xl font-bold mb-3 leading-tight">
              Gestão de obras inteligente e eficiente
            </h2>
            <p className="text-blue-200/80 text-sm leading-relaxed">
              Acompanhe o progresso físico, cronograma e planejamento semanal
              de suas obras em tempo real.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center mt-8">
            {['Curva S', 'Medição física', 'PPC / LPS', 'Gantt'].map((feat) => (
              <span
                key={feat}
                className="bg-white/10 border border-white/20 rounded-full px-3 py-1 text-xs font-medium"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Login Panel ───────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="bg-primary rounded-xl p-2">
              <HardHat className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <span className="text-2xl font-black text-foreground leading-none block">
                AvançoObras
              </span>
              <span className="text-primary font-bold text-base">Pro</span>
            </div>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Entrar</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Acesse sua conta para continuar
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com.br"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                  className="pl-9"
                  autoComplete="email"
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError('')
                  }}
                  className="pl-9 pr-10"
                  autoComplete="current-password"
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-4 rounded-md bg-muted/60 border border-border px-3 py-2.5">
            <p className="text-xs text-muted-foreground mb-1.5 font-medium">
              Credenciais de demonstração:
            </p>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-foreground font-mono">
                <span className="block">{DEMO_EMAIL}</span>
                <span className="block">{DEMO_PASSWORD}</span>
              </div>
              <button
                type="button"
                onClick={fillDemo}
                className="shrink-0 text-xs text-primary hover:underline font-medium"
              >
                Preencher
              </button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border text-center">
            <p className="text-xs text-muted-foreground">
              Não tem acesso?{' '}
              <span className="text-foreground font-medium">
                Contate o administrador.
              </span>
            </p>
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} AvançoObras Pro. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </div>
  )
}
