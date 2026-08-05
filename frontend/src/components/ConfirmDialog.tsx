import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface ConfirmOptions {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/**
 * Hook para pedir confirmação com o modal padrão do app (substitui window.confirm).
 * Uso: `if (!(await confirm({ message: 'Remover?', tone: 'danger' }))) return;`
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm deve ser usado dentro de <ConfirmProvider>.');
  return ctx;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolver.current?.(result);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <ConfirmModal
          options={options}
          onConfirm={() => close(true)}
          onCancel={() => close(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function ConfirmModal({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', tone = 'default' } = options;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
      if (e.key === 'Enter') { e.preventDefault(); onConfirm(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(13,22,41,0.55)', backdropFilter: 'blur(4px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          background: 'var(--s0)', border: '1px solid var(--bd2)', borderRadius: 8, width: '100%',
          maxWidth: 440, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{title ?? 'Confirmar ação'}</div>
        </div>
        <div style={{ padding: 16, fontSize: 13, color: 'var(--t2)', lineHeight: 1.55, whiteSpace: 'pre-line' }}>
          {message}
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--bd)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="ao-btn ao-btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button
            className={`ao-btn ao-btn-sm ${tone === 'danger' ? 'ao-btn-danger' : 'ao-btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
