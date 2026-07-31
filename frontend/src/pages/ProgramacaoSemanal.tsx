import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RefreshCw, Plus, FileText, Download, CheckCircle2, ChevronLeft, ChevronRight, History, Trash2,
} from 'lucide-react';
import { useStore } from '../store';
import { contractorsApi, restrictionTypesApi, weeklyPlanningApi } from '../services/api';
import type {
  Contractor, RestrictionType, WeeklyActivity, WeeklyProgram, WeeklyRestriction, WeeklySnapshotMeta,
} from '../types';
import ActivityTable from '../components/weekly/ActivityTable';
import RestrictionModal from '../components/weekly/RestrictionModal';
import Modal from '../components/weekly/Modal';
import { exportToExcel, exportToPdf } from '../components/weekly/weekly-export';
import {
  calcPPC, PROGRAM_STATUS_BADGE, PROGRAM_STATUS_LABEL, STATUS_BADGE, STATUS_LABEL,
} from '../components/weekly/weekly-logic';

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

// ── Menu suspenso simples ─────────────────────────────────────────────────────
function DropMenu({ label, icon, items, disabled }: {
  label: string;
  icon: React.ReactNode;
  items: Array<{ label: string; onClick: () => void }>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Posiciona o menu (fixed) a partir do retângulo do botão. Renderizado em portal
  // p/ escapar do overflow:hidden do card e do scroll de .ao-content.
  const place = useCallback(() => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = () => place();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('mousedown', onDoc);
    };
  }, [open, place]);

  return (
    <>
      <button ref={btnRef} className="ao-btn ao-btn-sm" onClick={() => setOpen((o) => !o)} disabled={disabled}>
        {icon} {label} <span style={{ fontSize: 8, opacity: 0.7 }}>▾</span>
      </button>
      {open && pos && createPortal(
        <div
          ref={menuRef}
          style={{
            position: 'fixed', top: pos.top, right: pos.right, zIndex: 1000, minWidth: 170,
            background: 'var(--s0)', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)',
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => { setOpen(false); item.onClick(); }}
              style={{
                display: 'block', width: '100%', textAlign: 'left', fontSize: 11.5, fontWeight: 500,
                padding: '8px 12px', border: 'none', background: 'none', color: 'var(--t2)',
                cursor: 'pointer', fontFamily: 'var(--font)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--s1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────
export default function ProgramacaoSemanal() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  const [programs, setPrograms] = useState<WeeklyProgram[]>([]);
  const [programIndex, setProgramIndex] = useState(0);
  const [program, setProgram] = useState<WeeklyProgram | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [types, setTypes] = useState<RestrictionType[]>([]);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // modais
  const [showNewActivity, setShowNewActivity] = useState(false);
  const [restrictionModal, setRestrictionModal] = useState<{
    restriction?: WeeklyRestriction | null;
    preselectedActivityId?: string;
  } | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<WeeklySnapshotMeta[]>([]);
  const [snapshotView, setSnapshotView] = useState<Awaited<ReturnType<typeof weeklyPlanningApi.snapshot>> | null>(null);

  const activities = program?.activities ?? [];
  const restrictions = program?.restrictions ?? [];
  const readOnly = program?.status === 'FECHADA';
  const ppc = calcPPC(activities);

  // ── Carregamento ──────────────────────────────────────────────────────────
  const loadPrograms = useCallback(async (selectId?: string) => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [list, contractorsList, typesList] = await Promise.all([
        weeklyPlanningApi.list(projectId),
        contractorsApi.list(projectId),
        restrictionTypesApi.list(projectId),
      ]);
      setPrograms(list);
      setContractors(contractorsList);
      setTypes(typesList);
      if (list.length > 0) {
        let idx = -1;
        if (selectId) idx = list.findIndex((p) => p.id === selectId);
        if (idx < 0) {
          const today = new Date().toISOString().slice(0, 10);
          idx = list.findIndex((p) => p.startDate.slice(0, 10) <= today && today <= p.endDate.slice(0, 10));
        }
        setProgramIndex(idx >= 0 ? idx : list.length - 1);
      }
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar programações semanais.' });
    } finally {
      setLoading(false);
    }
  }, [projectId, addToast]);

  useEffect(() => { loadPrograms(); }, [loadPrograms]);

  const loadProgram = useCallback(async (id: string) => {
    try {
      setProgram(await weeklyPlanningApi.get(id));
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar a programação.' });
    }
  }, [addToast]);

  useEffect(() => {
    const meta = programs[programIndex];
    if (meta) loadProgram(meta.id);
    else setProgram(null);
  }, [programs, programIndex, loadProgram]);

  // ── Ações da semana ───────────────────────────────────────────────────────
  const handleCreateWeek = async () => {
    if (!projectId) return;
    setBusy('create');
    try {
      const created = await weeklyPlanningApi.create(projectId);
      addToast({ type: 'success', title: `Semana ${created.weekNumber}/${created.year} criada.` });
      await loadPrograms(created.id);
    } catch {
      addToast({ type: 'error', title: 'Erro ao criar a programação da semana.' });
    } finally {
      setBusy(null);
    }
  };

  const handleRefresh = async () => {
    if (!program) return;
    setBusy('refresh');
    try {
      const result = await weeklyPlanningApi.refresh(program.id);
      setProgram(result.program);
      addToast({
        type: 'success',
        title: `Programação atualizada: ${result.imported} importada(s) do cronograma, ${result.carried} reprogramada(s).`,
      });
    } catch {
      addToast({ type: 'error', title: 'Erro ao atualizar a programação.' });
    } finally {
      setBusy(null);
    }
  };

  const handlePublish = async () => {
    if (!program) return;
    if (!window.confirm('Publicar a programação desta semana? O conjunto publicado passa a ser a base do PPC.')) return;
    setBusy('publish');
    try {
      await weeklyPlanningApi.publish(program.id);
      await loadProgram(program.id);
      addToast({ type: 'success', title: 'Programação publicada.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao publicar a programação.' });
    } finally {
      setBusy(null);
    }
  };

  const handleClose = async () => {
    if (!program) return;
    if (!window.confirm(
      'Publicar o fechamento da semana?\n\nIsso congela a semana (somente leitura), grava os indicadores e cria automaticamente a próxima programação com as atividades não concluídas.',
    )) return;
    setBusy('close');
    try {
      const result = await weeklyPlanningApi.close(program.id);
      addToast({ type: 'success', title: `Semana fechada — PPC ${result.closed.indicators.ppc}%. Próxima semana criada.` });
      await loadPrograms(result.nextProgramId);
    } catch {
      addToast({ type: 'error', title: 'Erro ao fechar a semana.' });
    } finally {
      setBusy(null);
    }
  };

  const handleReport = async () => {
    if (!program) return;
    setBusy('report');
    try {
      await weeklyPlanningApi.report(program.id);
      addToast({ type: 'success', title: 'Report gravado no histórico.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao gravar o report.' });
    } finally {
      setBusy(null);
    }
  };

  const openHistory = async () => {
    if (!program) return;
    try {
      setSnapshots(await weeklyPlanningApi.snapshots(program.id));
      setHistoryOpen(true);
    } catch {
      addToast({ type: 'error', title: 'Erro ao carregar o histórico.' });
    }
  };

  // ── Atividades ────────────────────────────────────────────────────────────
  const patchActivity = async (activity: WeeklyActivity, patch: Partial<WeeklyActivity>) => {
    if (!program) return;
    // otimista
    setProgram((prev) => prev && {
      ...prev,
      activities: prev.activities?.map((a) => (a.id === activity.id ? { ...a, ...patch } : a)),
    });
    try {
      const updated = await weeklyPlanningApi.updateActivity(activity.id, patch);
      setProgram((prev) => prev && {
        ...prev,
        activities: prev.activities?.map((a) => (a.id === activity.id ? updated : a)),
      });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar a atividade.' });
      loadProgram(program.id);
    }
  };

  const removeActivity = async (activity: WeeklyActivity) => {
    if (!program) return;
    if (!window.confirm(`Remover a atividade "${activity.activityName}" da programação?`)) return;
    try {
      await weeklyPlanningApi.removeActivity(activity.id);
      setProgram((prev) => prev && {
        ...prev,
        activities: prev.activities?.filter((a) => a.id !== activity.id),
      });
      addToast({ type: 'success', title: 'Atividade removida.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao remover a atividade.' });
    }
  };

  const quickCreateContractor = async (name: string): Promise<Contractor | null> => {
    if (!projectId) return null;
    try {
      const created = await contractorsApi.create(projectId, name);
      setContractors((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')));
      return created;
    } catch {
      addToast({ type: 'error', title: 'Erro ao cadastrar a empreiteira (nome duplicado?).' });
      return null;
    }
  };

  // ── Restrições ────────────────────────────────────────────────────────────
  const openRestrictionsForActivity = (activity: WeeklyActivity) => {
    if (readOnly) return;
    const linked = restrictions.find((r) => r.activityLinks?.some((l) => l.activityId === activity.id));
    setRestrictionModal(linked ? { restriction: linked } : { preselectedActivityId: activity.id });
  };

  const saveRestriction = async (data: Parameters<React.ComponentProps<typeof RestrictionModal>['onSave']>[0]) => {
    if (!program) return;
    if (restrictionModal?.restriction) {
      await weeklyPlanningApi.updateRestriction(restrictionModal.restriction.id, data);
    } else {
      await weeklyPlanningApi.addRestriction(program.id, data);
    }
    await loadProgram(program.id);
    addToast({ type: 'success', title: 'Restrição salva.' });
  };

  const removeRestriction = async (restriction: WeeklyRestriction) => {
    if (!program) return;
    if (!window.confirm(`Remover a restrição "${restriction.description}"?`)) return;
    try {
      await weeklyPlanningApi.removeRestriction(restriction.id);
      await loadProgram(program.id);
      addToast({ type: 'success', title: 'Restrição removida.' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao remover a restrição.' });
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────
  if (!currentProject) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--t2)' }}>
        <p style={{ fontSize: 14 }}>Selecione um empreendimento para visualizar a programação semanal.</p>
      </div>
    );
  }

  const meta = programs[programIndex];
  const ppcColor = ppc >= 80 ? 'var(--green)' : ppc >= 60 ? 'var(--amber)' : 'var(--red)';
  const pendingRestrictions = restrictions.filter((r) => r.status === 'PENDENTE').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Cabeçalho ─────────────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr" style={{ minHeight: 52, flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button className="ao-btn ao-btn-sm" onClick={() => setProgramIndex((i) => Math.max(0, i - 1))} disabled={programIndex <= 0 || loading} aria-label="Semana anterior">
              <ChevronLeft size={13} />
            </button>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)', lineHeight: 1.2 }}>
                {loading ? 'Carregando…' : meta
                  ? `Semana ${meta.weekNumber} · ${fmtDate(meta.startDate)} – ${fmtDate(meta.endDate)}`
                  : 'Nenhuma programação'}
              </div>
              {meta && (
                <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>
                  {meta.year} · {currentProject.name}
                </div>
              )}
            </div>
            <button className="ao-btn ao-btn-sm" onClick={() => setProgramIndex((i) => Math.min(programs.length - 1, i + 1))} disabled={programIndex >= programs.length - 1 || loading} aria-label="Próxima semana">
              <ChevronRight size={13} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            {program && (
              <>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Status</div>
                  <span className={PROGRAM_STATUS_BADGE[program.status]}>● {PROGRAM_STATUS_LABEL[program.status]}</span>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Reunião semanal</div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t2)', fontFamily: 'var(--mono)' }}>{fmtDate(program.meetingDate)}</span>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Última atualização</div>
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--t2)', fontFamily: 'var(--mono)' }}>{fmtDateTime(program.updatedAt)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)' }}>
                  <div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      PPC {program.status === 'FECHADA' ? 'final' : 'parcial'}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'var(--mono)', color: ppcColor, lineHeight: 1.1 }}>{ppc}%</div>
                  </div>
                  <div style={{ width: 42, height: 42, position: 'relative', flexShrink: 0 }}>
                    <svg viewBox="0 0 44 44" width="42" height="42">
                      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--s3)" strokeWidth="5" />
                      <circle cx="22" cy="22" r="18" fill="none" stroke={ppcColor} strokeWidth="5"
                        strokeLinecap="round" strokeDasharray="113.1"
                        strokeDashoffset={113.1 * (1 - ppc / 100)}
                        transform="rotate(-90 22 22)" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: 'var(--t3)' }}>
                      80%
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', flexWrap: 'wrap' }}>
          {!meta && !loading && (
            <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleCreateWeek} disabled={busy !== null}>
              <Plus size={12} /> {busy === 'create' ? 'Criando…' : 'Criar programação da semana'}
            </button>
          )}
          {program && (
            <>
              <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleRefresh} disabled={busy !== null || readOnly}>
                <RefreshCw size={12} /> {busy === 'refresh' ? 'Atualizando…' : 'Atualizar Programação'}
              </button>
              <button className="ao-btn ao-btn-sm" onClick={() => setShowNewActivity(true)} disabled={busy !== null || readOnly}>
                <Plus size={12} /> Nova Atividade
              </button>
              <DropMenu
                label="Report"
                icon={<FileText size={12} />}
                disabled={busy !== null}
                items={[
                  { label: 'Gravar Report', onClick: handleReport },
                  { label: 'Histórico Report', onClick: openHistory },
                ]}
              />
              <DropMenu
                label="Exportar"
                icon={<Download size={12} />}
                disabled={busy !== null || activities.length === 0}
                items={[
                  { label: 'Excel (.xlsx)', onClick: () => exportToExcel(program, activities, restrictions) },
                  { label: 'PDF', onClick: () => exportToPdf(program, activities, restrictions) },
                ]}
              />
              <div style={{ flex: 1 }} />
              <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>
                {activities.length} atividade(s) · {pendingRestrictions} restrição(ões) pendente(s)
              </span>
              {program.status === 'RASCUNHO' && (
                <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handlePublish} disabled={busy !== null || activities.length === 0}>
                  <CheckCircle2 size={12} /> {busy === 'publish' ? 'Publicando…' : 'Publicar Programação'}
                </button>
              )}
              {program.status === 'PUBLICADA' && (
                <button
                  className="ao-btn ao-btn-sm"
                  onClick={handleClose}
                  disabled={busy !== null}
                  style={{ background: 'var(--green)', borderColor: 'var(--green)', color: '#fff' }}
                >
                  <CheckCircle2 size={12} /> {busy === 'close' ? 'Fechando…' : 'Publicar Fechamento'}
                </button>
              )}
              {readOnly && (
                <span className="ao-badge ao-bg">Semana fechada — somente leitura</span>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Tabela ────────────────────────────────────────────────── */}
      {program && (
        <div className="ao-card">
          <ActivityTable
            activities={activities}
            contractors={contractors}
            readOnly={!!readOnly}
            onPatch={patchActivity}
            onRemove={removeActivity}
            onOpenRestrictions={openRestrictionsForActivity}
            onQuickCreateContractor={quickCreateContractor}
          />
        </div>
      )}

      {/* ── Restrições ────────────────────────────────────────────── */}
      {program && (
        <div className="ao-card">
          <div className="ao-card-hdr">
            <span className="ao-card-title">Restrições da semana</span>
            {pendingRestrictions > 0 && <span className="ao-badge ao-br">{pendingRestrictions} pendente(s)</span>}
            <div style={{ flex: 1 }} />
            {!readOnly && (
              <button className="ao-btn ao-btn-sm" onClick={() => setRestrictionModal({})}>
                <Plus size={12} /> Nova restrição
              </button>
            )}
          </div>
          {restrictions.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              Nenhuma restrição registrada nesta semana.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ao-table" style={{ minWidth: 960 }}>
                <thead>
                  <tr>
                    <th>Tipo</th><th>Descrição</th><th>Resp. remoção</th><th>Prevista</th>
                    <th>Resolvida</th><th>Impacta</th><th>Status</th><th>Atividades vinculadas</th>
                    <th style={{ width: 36 }} />
                  </tr>
                </thead>
                <tbody>
                  {restrictions.map((r) => {
                    const linkedNames = (r.activityLinks ?? [])
                      .map((l) => activities.find((a) => a.id === l.activityId)?.activityName)
                      .filter(Boolean) as string[];
                    return (
                      <tr key={r.id} style={{ cursor: readOnly ? 'default' : 'pointer' }}
                          onClick={() => !readOnly && setRestrictionModal({ restriction: r })}>
                        <td><span className="ao-badge ao-bb">{r.type?.name ?? '—'}</span></td>
                        <td style={{ fontWeight: 600 }}>{r.description}</td>
                        <td className="muted">{r.responsible}</td>
                        <td className="mono">{fmtDate(r.dueDate)}</td>
                        <td className="mono">{fmtDate(r.resolvedAt)}</td>
                        <td>
                          <span className={`ao-badge ${r.impactsProgram ? 'ao-br' : 'ao-bk'}`}>
                            {r.impactsProgram ? 'Sim' : 'Não'}
                          </span>
                        </td>
                        <td>
                          <span className={`ao-badge ${r.status === 'RESOLVIDA' ? 'ao-bg' : 'ao-ba'}`}>
                            {r.status === 'RESOLVIDA' ? 'Resolvida' : 'Pendente'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {linkedNames.length === 0 && <span className="muted">—</span>}
                            {linkedNames.map((name) => (
                              <span key={name} style={{
                                fontSize: 9.5, fontWeight: 600, padding: '1.5px 7px', borderRadius: 999,
                                background: 'var(--s2)', color: 'var(--t2)', border: '1px solid var(--bd2)',
                              }}>
                                {name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => removeRestriction(r)}
                              title="Remover restrição"
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
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modais ────────────────────────────────────────────────── */}
      {showNewActivity && program && (
        <NewActivityModal
          contractors={contractors}
          onClose={() => setShowNewActivity(false)}
          onSave={async (data) => {
            const created = await weeklyPlanningApi.addActivity(program.id, data);
            setProgram((prev) => prev && { ...prev, activities: [...(prev.activities ?? []), created] });
            addToast({ type: 'success', title: 'Atividade adicionada.' });
          }}
        />
      )}

      {restrictionModal && program && (
        <RestrictionModal
          restriction={restrictionModal.restriction}
          preselectedActivityId={restrictionModal.preselectedActivityId}
          activities={activities}
          types={types}
          onSave={saveRestriction}
          onClose={() => setRestrictionModal(null)}
        />
      )}

      {historyOpen && program && (
        <Modal title={`Histórico — Semana ${program.weekNumber}/${program.year}`} onClose={() => setHistoryOpen(false)} width={560}>
          {snapshots.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '16px 0' }}>
              Nenhum snapshot ainda. Publicações, reports e fechamentos aparecem aqui.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {snapshots.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={async () => {
                    try {
                      setSnapshotView(await weeklyPlanningApi.snapshot(s.id));
                    } catch {
                      addToast({ type: 'error', title: 'Erro ao abrir o snapshot.' });
                    }
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', background: 'var(--s1)',
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font)',
                  }}
                >
                  <History size={13} color="var(--t3)" />
                  <span className={`ao-badge ${s.kind === 'FECHAMENTO' ? 'ao-bg' : s.kind === 'PUBLICACAO' ? 'ao-bb' : 'ao-ba'}`}>
                    {s.kind === 'FECHAMENTO' ? 'Fechamento' : s.kind === 'PUBLICACAO' ? 'Publicação' : 'Report'}
                  </span>
                  <span style={{ fontSize: 11.5, color: 'var(--t2)', flex: 1 }}>{fmtDateTime(s.createdAt)}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>{s.createdBy.fullName}</span>
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}

      {snapshotView && (
        <Modal
          title={`Snapshot — ${fmtDateTime(snapshotView.createdAt)} (${snapshotView.createdBy.fullName})`}
          onClose={() => setSnapshotView(null)}
          width={880}
        >
          <SnapshotContent payload={snapshotView.payload} />
        </Modal>
      )}
    </div>
  );
}

// ── Modal de nova atividade ───────────────────────────────────────────────────
function NewActivityModal({ contractors, onSave, onClose }: {
  contractors: Contractor[];
  onSave: (data: Partial<WeeklyActivity>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ activityName: '', local: '', torre: '', pavimento: '', contractorId: '', responsible: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSave = async () => {
    if (!form.activityName.trim()) { setError('Informe o nome da atividade.'); return; }
    setSaving(true);
    try {
      await onSave({
        activityName: form.activityName.trim(),
        local: form.local.trim(),
        torre: form.torre.trim(),
        pavimento: form.pavimento.trim(),
        contractorId: form.contractorId || undefined,
        responsible: form.responsible.trim() || undefined,
      });
      onClose();
    } catch {
      setError('Erro ao adicionar a atividade.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Nova atividade (extra)"
      onClose={onClose}
      footer={
        <>
          <button className="ao-btn ao-btn-sm" onClick={onClose} disabled={saving}>Cancelar</button>
          <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando…' : 'Adicionar'}
          </button>
        </>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Atividade</label>
          <input style={fieldStyle} value={form.activityName} onChange={set('activityName')} placeholder="Ex.: Regularização do hall de entrada" />
        </div>
        <div>
          <label style={labelStyle}>Local</label>
          <input style={fieldStyle} value={form.local} onChange={set('local')} />
        </div>
        <div>
          <label style={labelStyle}>Torre</label>
          <input style={fieldStyle} value={form.torre} onChange={set('torre')} />
        </div>
        <div>
          <label style={labelStyle}>Pavimento</label>
          <input style={fieldStyle} value={form.pavimento} onChange={set('pavimento')} />
        </div>
        <div>
          <label style={labelStyle}>Empresa</label>
          <select style={fieldStyle} value={form.contractorId} onChange={set('contractorId')}>
            <option value="">— Sem empresa —</option>
            {contractors.filter((c) => c.isActive).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Responsável</label>
          <input style={fieldStyle} value={form.responsible} onChange={set('responsible')} />
        </div>
        {error && <div style={{ gridColumn: '1 / -1', fontSize: 11, color: 'var(--red)' }}>{error}</div>}
      </div>
      <p style={{ fontSize: 10.5, color: 'var(--t3)', marginTop: 10 }}>
        Atividades extras entram no PPC e no histórico da semana, sem alterar o cronograma mestre.
      </p>
    </Modal>
  );
}

// ── Visualização read-only de snapshot ────────────────────────────────────────
function SnapshotContent({ payload }: { payload: { program: WeeklyProgram; indicators: { ppc: number; reprogrammedPct: number; restrictionsCount: number } } }) {
  const program = payload.program;
  const acts = program.activities ?? [];
  const ind = payload.indicators;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11.5, color: 'var(--t2)' }}>
        <span>PPC: <strong style={{ fontFamily: 'var(--mono)' }}>{ind?.ppc ?? '—'}%</strong></span>
        <span>Reprogramadas: <strong style={{ fontFamily: 'var(--mono)' }}>{ind?.reprogrammedPct ?? '—'}%</strong></span>
        <span>Restrições: <strong style={{ fontFamily: 'var(--mono)' }}>{ind?.restrictionsCount ?? 0}</strong></span>
        <span>Status na foto: <strong>{PROGRAM_STATUS_LABEL[program.status]}</strong></span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="ao-table" style={{ minWidth: 700 }}>
          <thead>
            <tr><th>Local</th><th>Torre</th><th>Pavimento</th><th>Atividade</th><th>Empresa</th><th>Responsável</th><th>Status</th><th>%</th></tr>
          </thead>
          <tbody>
            {acts.map((a) => (
              <tr key={a.id}>
                <td className="muted">{a.local || '—'}</td>
                <td className="muted">{a.torre || '—'}</td>
                <td className="muted">{a.pavimento || '—'}</td>
                <td style={{ fontWeight: 600 }}>{a.activityName}</td>
                <td className="muted">{a.contractor?.name ?? '—'}</td>
                <td className="muted">{a.responsible || '—'}</td>
                <td><span className={STATUS_BADGE[a.status]}>{STATUS_LABEL[a.status]}</span></td>
                <td className="mono">{a.status === 'CANCELADA' ? '—' : `${a.percentExecuted}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
