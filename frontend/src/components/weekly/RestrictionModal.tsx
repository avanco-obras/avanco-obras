import { useState } from 'react';
import type { RestrictionType, WeeklyActivity, WeeklyRestriction } from '../../types';
import Modal from './Modal';

interface Props {
  restriction?: WeeklyRestriction | null;
  activities: WeeklyActivity[];
  types: RestrictionType[];
  /** Atividade pré-selecionada (quando aberto pelo "+" da linha). */
  preselectedActivityId?: string;
  onSave: (data: {
    description: string;
    responsible: string;
    typeId?: string;
    dueDate?: string;
    impactsProgram: boolean;
    status?: WeeklyRestriction['status'];
    activityIds: string[];
  }) => Promise<void>;
  onClose: () => void;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', fontSize: 11.5, padding: '6px 8px', borderRadius: 'var(--r-md)',
  border: '1px solid var(--bd2)', background: 'var(--s0)', color: 'var(--t1)',
  fontFamily: 'var(--font)', outline: 'none',
};

const labelStyle: React.CSSProperties = {
  fontSize: 9.5, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase',
  letterSpacing: '0.6px', display: 'block', marginBottom: 3,
};

export default function RestrictionModal({
  restriction, activities, types, preselectedActivityId, onSave, onClose,
}: Props) {
  const editing = !!restriction;
  const [description, setDescription] = useState(restriction?.description ?? '');
  const [responsible, setResponsible] = useState(restriction?.responsible ?? '');
  const [typeId, setTypeId] = useState(restriction?.typeId ?? '');
  const [dueDate, setDueDate] = useState(restriction?.dueDate?.slice(0, 10) ?? '');
  const [impactsProgram, setImpactsProgram] = useState(restriction?.impactsProgram ?? true);
  const [status, setStatus] = useState<WeeklyRestriction['status']>(restriction?.status ?? 'PENDENTE');
  const [activityIds, setActivityIds] = useState<string[]>(
    restriction?.activityLinks?.map((l) => l.activityId) ??
      (preselectedActivityId ? [preselectedActivityId] : []),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggleActivity = (id: string, checked: boolean) => {
    setActivityIds((prev) => (checked ? [...prev, id] : prev.filter((a) => a !== id)));
  };

  const handleSave = async () => {
    if (!description.trim()) { setError('Informe a descrição da restrição.'); return; }
    if (!responsible.trim()) { setError('Informe o responsável pela remoção.'); return; }
    setError('');
    setSaving(true);
    try {
      await onSave({
        description: description.trim(),
        responsible: responsible.trim(),
        typeId: typeId || undefined,
        dueDate: dueDate || undefined,
        impactsProgram,
        ...(editing ? { status } : {}),
        activityIds,
      });
      onClose();
    } catch {
      setError('Erro ao salvar a restrição.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={editing ? 'Editar restrição' : 'Nova restrição'}
      onClose={onClose}
      footer={
        <>
          <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Salvar restrição'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
        <div>
          <label style={labelStyle}>Tipo</label>
          <select style={fieldStyle} value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            <option value="">— Sem tipo —</option>
            {types.filter((t) => t.isActive).map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle}>Resp. pela remoção</label>
          <input style={fieldStyle} value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Quem remove a restrição" />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Descrição</label>
          <input style={fieldStyle} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex.: Falta de porcelanato 60×60" />
        </div>
        <div>
          <label style={labelStyle}>Data prevista</label>
          <input style={fieldStyle} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Impacta programação</label>
          <select style={fieldStyle} value={impactsProgram ? '1' : '0'} onChange={(e) => setImpactsProgram(e.target.value === '1')}>
            <option value="1">Sim</option>
            <option value="0">Não</option>
          </select>
        </div>
        {editing && (
          <div>
            <label style={labelStyle}>Status</label>
            <select style={fieldStyle} value={status} onChange={(e) => setStatus(e.target.value as WeeklyRestriction['status'])}>
              <option value="PENDENTE">Pendente</option>
              <option value="RESOLVIDA">Resolvida</option>
            </select>
          </div>
        )}
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Atividades vinculadas ({activityIds.length})</label>
          <div
            style={{
              display: 'flex', flexDirection: 'column', gap: 5, border: '1px solid var(--bd)',
              borderRadius: 'var(--r-md)', padding: '8px 10px', background: 'var(--s1)',
              maxHeight: 150, overflowY: 'auto',
            }}
          >
            {activities.length === 0 && (
              <span style={{ fontSize: 11, color: 'var(--t3)' }}>Nenhuma atividade na programação.</span>
            )}
            {activities.map((a) => (
              <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: 'var(--t2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={activityIds.includes(a.id)}
                  onChange={(e) => toggleActivity(a.id, e.target.checked)}
                  style={{ accentColor: 'var(--blue)' }}
                />
                {a.activityName}
                {a.pavimento && <span style={{ color: 'var(--t4)', fontSize: 10 }}>· {a.pavimento}</span>}
              </label>
            ))}
          </div>
        </div>
        {error && (
          <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--red)' }}>{error}</div>
        )}
      </div>
    </Modal>
  );
}
