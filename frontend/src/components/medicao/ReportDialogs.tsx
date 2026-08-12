import type { ProjectReport, ReportComparison } from '@/types';
import { RestoreReportButton } from '@/components/RestoreReportModal';

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};

export interface SaveReportModalProps {
  open: boolean;
  description: string;
  saving: boolean;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SaveReportModal({ open, description, saving, onChange, onCancel, onConfirm }: SaveReportModalProps) {
  if (!open) return null;
  return (
    <div style={overlay}>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 500, boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 16px 0', color: 'var(--t1)' }}>Gravar Relatório de Avanço Físico</h2>
        <p style={{ margin: '0 0 16px 0', color: 'var(--t2)', fontSize: 14 }}>
          Consolida o avanço físico atual no cronograma. Indicadores, Curva S e gráficos passam a refletir estes valores.
        </p>
        <div style={{ margin: '0 0 16px 0' }}>
          <label style={{ display: 'block', marginBottom: 8, fontSize: 12, color: 'var(--t2)' }}>Descrição (opcional):</label>
          <input
            type="text"
            value={description}
            onChange={(e) => onChange(e.target.value)}
            placeholder="ex: Medição da semana 24"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--bd)', borderRadius: 6, background: 'var(--bg2)', color: 'var(--t1)', fontSize: 12, boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="ao-btn ao-btn-sm" onClick={onCancel} disabled={saving}>Cancelar</button>
          <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={onConfirm} disabled={saving}>
            {saving ? '⏳ Gravando…' : '📊 Gravar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface ReportHistoryModalProps {
  open: boolean;
  reports: ProjectReport[];
  selected: ReportComparison | null;
  onCompare: (r: ProjectReport) => void;
  onClose: () => void;
  /** Abre a confirmação de restauração. Ausente esconde o botão. */
  onRestore?: (r: ProjectReport) => void;
  restoring?: boolean;
}

export function ReportHistoryModal({ open, reports, selected, onCompare, onClose, onRestore, restoring }: ReportHistoryModalProps) {
  if (!open) return null;
  return (
    <div style={overlay}>
      <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 12, padding: 24, maxWidth: 900, maxHeight: '80vh', overflow: 'auto', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
        <h2 style={{ margin: '0 0 20px 0', color: 'var(--t1)' }}>Histórico de Reports</h2>
        {reports.length === 0 ? (
          <p style={{ color: 'var(--t3)', fontSize: 13 }}>Nenhum relatório gravado ainda.</p>
        ) : (
          <div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--bd)' }}>
                  <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Report #</th>
                  <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Data/Hora</th>
                  <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Usuário</th>
                  <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Avanço %</th>
                  <th style={{ padding: 8, textAlign: 'left', color: 'var(--t2)' }}>Descrição</th>
                  <th style={{ padding: 8, textAlign: 'center', color: 'var(--t2)' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '0.5px solid var(--bd)' }}>
                    <td style={{ padding: 8, color: 'var(--t1)', fontWeight: 500 }}>Report #{String(r.reportNumber).padStart(3, '0')}</td>
                    <td style={{ padding: 8, color: 'var(--t2)' }}>{new Date(r.createdAt).toLocaleString('pt-BR')}</td>
                    <td style={{ padding: 8, color: 'var(--t2)' }}>{r.user.fullName || r.user.email}</td>
                    <td style={{ padding: 8, color: 'var(--t1)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.physicalProgress.toFixed(2)}%</td>
                    <td style={{ padding: 8, color: 'var(--t2)', maxWidth: 200, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description || '—'}</td>
                    <td style={{ padding: 8, textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                        <button style={{ background: 'none', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: 12, textDecoration: 'underline' }} onClick={() => onCompare(r)}>
                          Comparar
                        </button>
                        {onRestore && <RestoreReportButton onClick={() => onRestore(r)} disabled={restoring} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {selected && (
              <div style={{ marginTop: 24, padding: 16, background: 'var(--bg2)', borderRadius: 8 }}>
                <h3 style={{ margin: '0 0 12px 0', color: 'var(--t1)', fontSize: 13 }}>
                  Report #{selected.reportNumber} vs Baseline v{selected.baselineVersion}
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <SummaryCard color="#3b82f6" label="No Prazo" value={selected.summary.onSchedule} />
                  <SummaryCard color="#ef4444" label="Atrasadas" value={selected.summary.delayed} />
                  <SummaryCard color="#10b981" label="Adiantadas" value={selected.summary.advanced} />
                  <SummaryCard color="#f59e0b" label="Avanço Acima" value={selected.summary.progressAbove} />
                  <SummaryCard color="#a855f7" label="Avanço Abaixo" value={selected.summary.progressBelow} />
                </div>
              </div>
            )}
          </div>
        )}
        <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
          <button className="ao-btn ao-btn-sm" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ padding: 12, background: 'var(--bg1)', borderRadius: 6, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>{value}</div>
    </div>
  );
}
