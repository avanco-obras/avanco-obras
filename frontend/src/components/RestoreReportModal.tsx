import { AlertTriangle, RotateCcw, ShieldCheck } from 'lucide-react';
import type { ProjectReport } from '@/types';

/**
 * Confirmação da restauração de um Report.
 *
 * A operação sobrescreve os dados atuais em todas as telas que compartilham o
 * histórico, então o modal nomeia a versão, lista o que será substituído e
 * exige confirmação explícita.
 */

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100,
  padding: 16,
};

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface RestoreReportModalProps {
  open: boolean;
  report: ProjectReport | null;
  restoring: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function RestoreReportModal({ open, report, restoring, onCancel, onConfirm }: RestoreReportModalProps) {
  if (!open || !report) return null;

  // Reports gravados antes do snapshot completo existir.
  const partial = report.restoresFully === false;

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-labelledby="restore-title">
      <div style={{
        background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12,
        padding: 24, maxWidth: 520, width: '100%',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <RotateCcw size={20} style={{ color: 'var(--red)' }} />
          <h2 id="restore-title" style={{ margin: 0, fontSize: 17, color: 'var(--t1)' }}>
            Restaurar o Report #{report.reportNumber}?
          </h2>
        </div>

        <div style={{
          background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 8,
          padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: 'var(--t2)',
          display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          <span><strong style={{ color: 'var(--t1)' }}>Gravado em:</strong> {fmtDateTime(report.createdAt)}</span>
          <span><strong style={{ color: 'var(--t1)' }}>Por:</strong> {report.user?.fullName ?? '—'}</span>
          <span><strong style={{ color: 'var(--t1)' }}>Avanço físico:</strong> {report.physicalProgress.toFixed(2)}%</span>
          {report.itemCount != null && (
            <span><strong style={{ color: 'var(--t1)' }}>Atividades:</strong> {report.itemCount}</span>
          )}
          {report.description && (
            <span><strong style={{ color: 'var(--t1)' }}>Descrição:</strong> {report.description}</span>
          )}
        </div>

        <p style={{ margin: '0 0 12px', fontSize: 13.5, color: 'var(--t2)' }}>
          Os dados atuais serão <strong style={{ color: 'var(--t1)' }}>substituídos</strong> pelo
          estado desta versão. A mudança vale para o Cronograma, a Medição e a Linha de Balanço,
          que compartilham o mesmo histórico.
        </p>

        <ul style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 13, color: 'var(--t2)', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <li>Atividades, hierarquia, datas e percentuais de avanço</li>
          {partial ? (
            <li style={{ color: 'var(--t3)' }}>Dependências e medições <strong>não</strong> serão alteradas</li>
          ) : (
            <>
              <li>Vínculos de predecessora e sucessora</li>
              <li>Medições por unidade</li>
            </>
          )}
        </ul>

        {partial && (
          <div style={{
            display: 'flex', gap: 9, alignItems: 'flex-start',
            background: 'var(--amb-bg, #fef3c7)', border: '1px solid var(--amber)',
            color: 'var(--amber)', borderRadius: 8, padding: '10px 12px',
            marginBottom: 14, fontSize: 12.5,
          }}>
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>
              Esta versão é anterior ao registro completo, então guarda apenas o cronograma.
              Só as atividades serão restauradas — dependências e medições permanecem como estão hoje.
            </span>
          </div>
        )}

        <div style={{
          display: 'flex', gap: 9, alignItems: 'flex-start',
          background: 'var(--grn-bg)', border: '1px solid var(--grn-bd)',
          color: 'var(--grn-t)', borderRadius: 8, padding: '10px 12px',
          marginBottom: 18, fontSize: 12.5,
        }}>
          <ShieldCheck size={15} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            Antes de substituir, o estado atual é gravado como um novo Report — dá para voltar
            atrás restaurando essa versão de segurança.
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="ao-btn ao-btn-sm" onClick={onCancel} disabled={restoring}>
            Cancelar
          </button>
          <button
            className="ao-btn ao-btn-sm ao-btn-danger"
            onClick={onConfirm}
            disabled={restoring}
          >
            <RotateCcw size={13} />
            {restoring ? 'Restaurando…' : `Restaurar o Report #${report.reportNumber}`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Botão de restaurar para dentro das listas de histórico. */
export function RestoreReportButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      className="ao-btn ao-btn-xs"
      onClick={onClick}
      disabled={disabled}
      title="Restaurar o sistema para esta versão"
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      <RotateCcw size={11} /> Restaurar
    </button>
  );
}
