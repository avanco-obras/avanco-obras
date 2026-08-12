import { Building2 } from 'lucide-react';

/**
 * Estado vazio padrão para quando nenhum projeto está selecionado.
 * Centraliza o visual (antes duplicado em 4 telas com textos e ícones
 * diferentes). Usa tokens de tema, então funciona em claro e escuro.
 */
export function NoProjectState({
  message,
  action,
}: {
  message?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        gap: 16,
        textAlign: 'center',
        padding: '0 16px',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          background: 'var(--s2)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Building2 style={{ width: 24, height: 24, color: 'var(--t3)' }} />
      </div>
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--t1)', marginBottom: 6 }}>
          Nenhum projeto selecionado
        </div>
        <div style={{ fontSize: 12, color: 'var(--t3)', maxWidth: 300, lineHeight: 1.5 }}>
          {message ?? 'Selecione um projeto no menu lateral ou cadastre um novo empreendimento.'}
        </div>
      </div>
      {action && (
        <button className="ao-btn ao-btn-primary" onClick={action.onClick}>
          <Building2 style={{ width: 13, height: 13 }} /> {action.label}
        </button>
      )}
    </div>
  );
}
