import type { ReactNode } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export default function Modal({ title, onClose, children, footer, width = 520 }: Props) {
  return (
    <div
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-label={title}
        style={{
          background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--r-xl)',
          boxShadow: 'var(--shadow-lg)', width: '100%', maxWidth: width,
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 14px', borderBottom: '1px solid var(--bd)',
          }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>{title}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            style={{ border: 'none', background: 'none', color: 'var(--t3)', cursor: 'pointer', fontSize: 15, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto' }}>{children}</div>
        {footer && (
          <div
            style={{
              display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 14px',
              borderTop: '1px solid var(--bd)', background: 'var(--s1)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
