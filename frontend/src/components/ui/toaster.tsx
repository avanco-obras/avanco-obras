import { useEffect } from 'react'
import { useStore } from '@/store'

interface ToastData {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
}

export function Toaster() {
  const { toasts, removeToast } = useStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast as ToastData}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}

function ToastItem({
  toast,
  onClose,
}: {
  toast: ToastData
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const colorMap: Record<string, string> = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-500',
    info: 'bg-blue-600',
  }

  const iconMap: Record<string, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }

  const bgColor = colorMap[toast.type] ?? 'bg-gray-800'
  const icon = iconMap[toast.type] ?? '•'

  return (
    <div
      className={`${bgColor} text-white rounded-lg shadow-xl p-4 flex items-start gap-3 pointer-events-auto
        animate-in slide-in-from-right-5 duration-300`}
    >
      <span className="text-white font-bold text-sm mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="text-xs mt-1 opacity-90 leading-snug">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-white/70 hover:text-white text-lg leading-none shrink-0 transition-colors"
        aria-label="Fechar notificação"
      >
        ×
      </button>
    </div>
  )
}
