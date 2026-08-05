import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Contractor, WeeklyActivity, WeeklyActivityStatus } from '../../types';
import ColumnFilterPopover from './ColumnFilterPopover';
import {
  activityColumnValue,
  applyColumnFilters,
  type ColumnFilters,
  distinctColumnValues,
  type FilterableColumn,
  ORIGIN_LABEL,
  ORIGIN_SHORT,
  percentForStatus,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_OPTIONS,
  suggestStatusFromPercent,
} from './weekly-logic';

interface Props {
  activities: WeeklyActivity[];
  contractors: Contractor[];
  readOnly: boolean;
  onPatch: (activity: WeeklyActivity, patch: Partial<WeeklyActivity>) => void;
  onRemove: (activity: WeeklyActivity) => void;
  onOpenRestrictions: (activity: WeeklyActivity) => void;
  onQuickCreateContractor: (name: string) => Promise<Contractor | null>;
}

const COLUMNS: Array<{ key: FilterableColumn; label: string }> = [
  { key: 'local', label: 'Local' },
  { key: 'torre', label: 'Torre' },
  { key: 'pavimento', label: 'Pavimento' },
  { key: 'activityName', label: 'Atividade' },
  { key: 'contractor', label: 'Empresa' },
  { key: 'responsible', label: 'Responsável' },
  { key: 'status', label: 'Status' },
];

const PCT_STEPS = [0, 25, 50, 75, 100];

const cellInput: React.CSSProperties = {
  width: '100%', minWidth: 70, fontSize: 11.5, padding: '3px 5px',
  border: '1px solid transparent', borderRadius: 3, background: 'transparent',
  color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none',
};

function FunnelIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <path d="M0 0h10L6 5v4L4 8V5z" />
    </svg>
  );
}

export default function ActivityTable({
  activities, contractors, readOnly, onPatch, onRemove, onOpenRestrictions, onQuickCreateContractor,
}: Props) {
  const [filters, setFilters] = useState<ColumnFilters>({});
  const [openFilter, setOpenFilter] = useState<{ column: FilterableColumn; anchor: { top: number; left: number } } | null>(null);

  const visible = useMemo(() => applyColumnFilters(activities, filters), [activities, filters]);

  const handleStatusChange = (activity: WeeklyActivity, status: WeeklyActivityStatus) => {
    onPatch(activity, { status, percentExecuted: percentForStatus(status, activity.percentExecuted) });
  };

  const handlePercent = (activity: WeeklyActivity, raw: number) => {
    const percent = Math.max(0, Math.min(100, Math.round(raw) || 0));
    const status = suggestStatusFromPercent(activity.status, percent);
    onPatch(activity, { percentExecuted: percentForStatus(status, percent), status });
  };

  const handleContractorSelect = async (activity: WeeklyActivity, value: string) => {
    if (value === '__new__') {
      const name = window.prompt('Nome da nova empreiteira:')?.trim();
      if (!name) return;
      const created = await onQuickCreateContractor(name);
      if (created) onPatch(activity, { contractorId: created.id });
      return;
    }
    onPatch(activity, { contractorId: value || null });
  };

  const textCell = (activity: WeeklyActivity, field: 'local' | 'torre' | 'pavimento' | 'activityName' | 'responsible') => {
    const value = (activity[field] ?? '') as string;
    if (readOnly) {
      return <span style={{ fontSize: 11.5 }}>{value || '—'}</span>;
    }
    return (
      <input
        key={`${activity.id}-${field}-${value}`}
        style={{ ...cellInput, fontWeight: field === 'activityName' ? 600 : 400 }}
        defaultValue={value}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--bd2)'; e.currentTarget.style.background = 'var(--s0)'; }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'transparent';
          e.currentTarget.style.background = 'transparent';
          const next = e.currentTarget.value.trim();
          if (next !== value) onPatch(activity, { [field]: next } as Partial<WeeklyActivity>);
        }}
      />
    );
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="ao-table" style={{ minWidth: 1080 }}>
        <thead>
          <tr>
            <th style={{ width: 28 }} title="Origem" />
            {COLUMNS.map((col) => (
              <th key={col.key} style={col.key === 'activityName' ? { minWidth: 200 } : undefined}>
                {col.label}
                <button
                  type="button"
                  aria-label={`Filtrar ${col.label}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setOpenFilter((prev) =>
                      prev?.column === col.key ? null : { column: col.key, anchor: { top: rect.bottom, left: rect.left } },
                    );
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 16, height: 16, marginLeft: 5, verticalAlign: '-3px',
                    border: 'none', borderRadius: 3, cursor: 'pointer', padding: 0,
                    background: filters[col.key] ? 'var(--blue)' : 'none',
                    color: filters[col.key] ? '#fff' : 'var(--t4)',
                  }}
                >
                  <FunnelIcon />
                </button>
              </th>
            ))}
            <th style={{ minWidth: 218 }}>% Executado</th>
            <th>Restrições</th>
            <th style={{ width: 36 }} />
          </tr>
        </thead>
        <tbody>
          {visible.map((activity) => {
            const cancelled = activity.status === 'CANCELADA';
            const restrictionCount = activity.restrictionLinks?.length ?? 0;
            return (
              <tr key={activity.id} style={cancelled ? { opacity: 0.55 } : undefined}>
                <td style={{ textAlign: 'center' }}>
                  <span
                    title={ORIGIN_LABEL[activity.origin]}
                    className={`ao-badge ${activity.origin === 'CRONOGRAMA' ? 'ao-bb' : activity.origin === 'MANUAL' ? 'ao-bk' : 'ao-ba'}`}
                    style={{ padding: '1px 5px' }}
                  >
                    {ORIGIN_SHORT[activity.origin]}
                  </span>
                </td>
                <td>{textCell(activity, 'local')}</td>
                <td>{textCell(activity, 'torre')}</td>
                <td>{textCell(activity, 'pavimento')}</td>
                <td style={cancelled ? { textDecoration: 'line-through' } : undefined}>
                  {textCell(activity, 'activityName')}
                </td>
                <td>
                  {readOnly ? (
                    <span className="muted" style={{ fontSize: 11.5 }}>{activity.contractor?.name ?? '—'}</span>
                  ) : (
                    <select
                      value={activity.contractorId ?? ''}
                      onChange={(e) => handleContractorSelect(activity, e.target.value)}
                      style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 5px', maxWidth: 150,
                        borderRadius: 'var(--r-md)', border: '1px solid var(--bd2)',
                        background: 'var(--s0)', color: 'var(--t2)', fontFamily: 'var(--font)',
                      }}
                    >
                      <option value="">— Sem empresa —</option>
                      {contractors.filter((c) => c.isActive || c.id === activity.contractorId).map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                      <option value="__new__">+ Nova empreiteira…</option>
                    </select>
                  )}
                </td>
                <td>{textCell(activity, 'responsible')}</td>
                <td>
                  {readOnly ? (
                    <span className={STATUS_BADGE[activity.status]}>{STATUS_LABEL[activity.status]}</span>
                  ) : (
                    <select
                      value={activity.status}
                      onChange={(e) => handleStatusChange(activity, e.target.value as WeeklyActivityStatus)}
                      className={STATUS_BADGE[activity.status]}
                      style={{ cursor: 'pointer', fontFamily: 'var(--font)', paddingRight: 4 }}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                  )}
                </td>
                <td>
                  {cancelled ? (
                    <span style={{ fontSize: 10.5, color: 'var(--t4)' }}>0% — fora do PPC (sem KPI)</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        {PCT_STEPS.map((step) => {
                          const on = activity.percentExecuted === step;
                          return (
                            <button
                              key={step}
                              type="button"
                              disabled={readOnly}
                              onClick={() => handlePercent(activity, step)}
                              style={{
                                fontFamily: 'var(--mono)', fontSize: 9.5, fontWeight: 600,
                                padding: '2.5px 5px', borderRadius: 3, minWidth: 26, textAlign: 'center',
                                border: `1px solid ${on ? 'var(--blue)' : 'var(--bd2)'}`,
                                background: on ? 'var(--blue)' : 'var(--s0)',
                                color: on ? '#fff' : 'var(--t3)',
                                cursor: readOnly ? 'default' : 'pointer',
                              }}
                            >
                              {step}
                            </button>
                          );
                        })}
                        <input
                          key={`${activity.id}-pct-${activity.percentExecuted}`}
                          type="number"
                          min={0}
                          max={100}
                          defaultValue={activity.percentExecuted}
                          disabled={readOnly}
                          onBlur={(e) => {
                            const v = parseInt(e.currentTarget.value, 10);
                            if (!Number.isNaN(v) && v !== activity.percentExecuted) handlePercent(activity, v);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                          style={{
                            width: 46, fontFamily: 'var(--mono)', fontSize: 11, padding: '3px 4px',
                            borderRadius: 'var(--r-md)', border: '1px solid var(--bd2)',
                            background: 'var(--s0)', color: 'var(--t1)', textAlign: 'right',
                          }}
                        />
                        <span style={{ fontSize: 10, color: 'var(--t3)' }}>%</span>
                      </div>
                      <div style={{ height: 3, background: 'var(--s3)', borderRadius: 2, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%', width: `${activity.percentExecuted}%`, borderRadius: 2,
                            background: activity.status === 'CONCLUIDA' ? 'var(--green)' : 'var(--blue-l)',
                          }}
                        />
                      </div>
                    </div>
                  )}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onOpenRestrictions(activity)}
                    title={restrictionCount > 0 ? `${restrictionCount} restrição(ões) vinculada(s)` : 'Adicionar restrição'}
                    className={restrictionCount > 0 ? 'ao-badge ao-br' : undefined}
                    style={
                      restrictionCount > 0
                        ? { cursor: 'pointer', border: '1px solid var(--red-bd)' }
                        : { border: 'none', background: 'none', color: 'var(--t4)', fontSize: 14, cursor: 'pointer', padding: '0 4px' }
                    }
                  >
                    {restrictionCount > 0 ? `⚑ ${restrictionCount}` : '+'}
                  </button>
                </td>
                <td style={{ textAlign: 'center' }}>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemove(activity)}
                      title="Remover atividade"
                      style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 22, height: 22, border: 'none', background: 'none',
                        borderRadius: 'var(--r-md)', color: 'var(--t4)', cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--red)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--t4)'; }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
          {visible.length === 0 && (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--t3)', fontSize: 12 }}>
                {activities.length === 0
                  ? 'Nenhuma atividade nesta semana. Use "Atualizar Programação" ou "Nova Atividade".'
                  : 'Nenhuma atividade corresponde aos filtros aplicados.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {openFilter && (
        <ColumnFilterPopover
          values={distinctColumnValues(activities, openFilter.column)}
          selected={filters[openFilter.column]}
          anchor={openFilter.anchor}
          onClose={() => setOpenFilter(null)}
          onChange={(selected) =>
            setFilters((prev) => {
              const next = { ...prev };
              if (selected === undefined) delete next[openFilter.column];
              else next[openFilter.column] = selected;
              return next;
            })
          }
        />
      )}
    </div>
  );
}

export { activityColumnValue };
