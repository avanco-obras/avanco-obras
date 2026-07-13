import { useMemo, useState, useCallback } from 'react';
import { Save, History, Check, CornerDownRight } from 'lucide-react';
import type { GanttTask } from '@/types';
import { buildForest, indexNodes, subtreeProgress, FLOOR_PATTERN, type WbsNode } from '@/lib/wbs-tree';
import { heatmapColor, rowStatusStyle, statusLabel, statusBadgeClass } from '@/lib/measurement-helpers';

export interface ScheduleBlocksPanelProps {
  tasks: GanttTask[];
  /** Caminho de navegação (ids de containers, da raiz para baixo). */
  navPath: string[];
  onNavPathChange: (path: string[]) => void;
  /** Mostrar apenas ramos sem local (Canteiro) no nível raiz. */
  canteiroMode: boolean;
  onCommitLeaf: (taskId: string, value: number) => void | Promise<void>;
  saving: boolean;
  onSaveReport: () => void;
  onOpenHistory: () => void;
  lastReportLabel?: string | null;
}

export default function ScheduleBlocksPanel({
  tasks, navPath, onNavPathChange, canteiroMode,
  onCommitLeaf, saving, onSaveReport, onOpenHistory, lastReportLabel,
}: ScheduleBlocksPanelProps) {
  const forest = useMemo(() => buildForest(tasks), [tasks]);
  const nodeById = useMemo(() => indexNodes(forest), [forest]);
  const root = forest[0] ?? null;

  // Nó "container" atual: último do navPath, ou a raiz (mostra seus filhos = nível 1).
  const current: WbsNode | null = navPath.length > 0 ? nodeById.get(navPath[navPath.length - 1]) ?? root : root;

  // Filhos a exibir
  let children: WbsNode[] = current?.children ?? [];
  if (navPath.length === 0 && canteiroMode) {
    children = children.filter((c) => !FLOOR_PATTERN.test(c.task.name));
  }

  const childrenAreLeaves = children.length > 0 && children.every((c) => c.isLeaf);

  // Breadcrumb da navegação
  const crumbs = useMemo(() => {
    const arr: { id: string | null; label: string }[] = [{ id: null, label: canteiroMode ? 'Canteiro' : 'Obra' }];
    for (const id of navPath) {
      const n = nodeById.get(id);
      if (n) arr.push({ id, label: n.task.name });
    }
    return arr;
  }, [navPath, nodeById, canteiroMode]);

  const goTo = useCallback((index: number) => {
    onNavPathChange(navPath.slice(0, index)); // index 0 = raiz (slice(0,0)=[])
  }, [navPath, onNavPathChange]);

  const drill = useCallback((node: WbsNode) => {
    onNavPathChange([...navPath, node.task.id]);
  }, [navPath, onNavPathChange]);

  const markAllDone = useCallback(() => {
    children.forEach((c) => { if (c.isLeaf && (c.task.physicalProgress || 0) < 100) onCommitLeaf(c.task.id, 100); });
  }, [children, onCommitLeaf]);

  const currentProgress = current ? subtreeProgress(current) : 0;

  return (
    <div className="ao-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header: título + Report */}
      <div className="ao-card-hdr" style={{ marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <span className="ao-card-title">Atividades {canteiroMode && <span style={{ fontSize: 10, color: 'var(--amber)' }}>· Canteiro</span>}</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {childrenAreLeaves && (
            <button className="ao-btn ao-btn-sm ao-btn-ok" onClick={markAllDone} disabled={saving} title="Marcar todas as atividades como concluídas">
              <Check size={12} /> Tudo concluído
            </button>
          )}
          <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={onSaveReport} disabled={saving}
            title="Gravar Report — consolida o avanço físico no cronograma"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}>
            <Save size={12} /> {saving ? 'Gravando…' : 'Gravar Report'}
          </button>
          <button className="ao-btn ao-btn-sm" onClick={onOpenHistory} title="Histórico de Reports"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}>
            <History size={12} /> Histórico
          </button>
        </div>
      </div>

      {/* Breadcrumb de navegação */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', fontSize: 11, marginBottom: 10 }}>
        {crumbs.map((c, i) => (
          <span key={c.id ?? 'root'} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {i > 0 && <span style={{ color: 'var(--t3)' }}>›</span>}
            <button
              onClick={() => goTo(i)}
              disabled={i === crumbs.length - 1}
              style={{
                border: 'none', background: 'transparent', cursor: i === crumbs.length - 1 ? 'default' : 'pointer',
                color: i === crumbs.length - 1 ? 'var(--t1)' : 'var(--blue)',
                fontWeight: i === crumbs.length - 1 ? 600 : 500, padding: '2px 4px', fontFamily: 'var(--font)', fontSize: 11,
              }}
            >
              {c.label}
            </button>
          </span>
        ))}
        {current && (
          <span className={statusBadgeClass(currentProgress)} style={{ marginLeft: 'auto', fontSize: 9 }}>
            {Math.round(currentProgress)}% {statusLabel(currentProgress)}
          </span>
        )}
      </div>

      {lastReportLabel && <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 8 }}>{lastReportLabel}</div>}

      {/* Conteúdo: blocos de navegação OU lista de atividades para input */}
      {tasks.length === 0 ? (
        <div style={empty}>Nenhuma atividade no cronograma. Importe um cronograma para começar.</div>
      ) : children.length === 0 ? (
        <div style={empty}>Sem subitens neste nível.</div>
      ) : childrenAreLeaves ? (
        <div style={{ overflowY: 'auto', maxHeight: '58vh', margin: '0 -2px' }}>
          {children.map((c) => (
            <ActivityInputRow key={c.task.id} task={c.task} onCommit={onCommitLeaf} unlocated={c.unlocated} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, overflowY: 'auto', maxHeight: '58vh', padding: 2 }}>
          {children.map((c) => (
            <NavBlock key={c.task.id} node={c} progress={subtreeProgress(c)} onClick={() => drill(c)} />
          ))}
        </div>
      )}
    </div>
  );
}

const empty: React.CSSProperties = { padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' };

// ── Bloco de navegação (pavimento, apartamento, …) ─────────────────────────────
function NavBlock({ node, progress, onClick }: { node: WbsNode; progress: number; onClick: () => void }) {
  const st = rowStatusStyle(progress);
  const childCount = node.children.length;
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', borderRadius: 10, padding: 10,
        border: `1px solid var(--bd)`, borderLeft: `4px solid ${st.accent}`,
        background: st.bg, color: 'var(--t1)', fontFamily: 'var(--font)',
        display: 'flex', flexDirection: 'column', gap: 6, minHeight: 78, transition: 'all .12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,.12)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.task.name}</span>
        <CornerDownRight size={12} color="var(--t3)" style={{ flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--mono)', color: st.text }}>{Math.round(progress)}%</span>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>{childCount} {node.children.every((c) => c.isLeaf) ? 'atividade(s)' : 'subitem(ns)'}</span>
      </div>
      <div className="ao-pbar" style={{ minHeight: 5 }}>
        <div className="ao-pfill" style={{ width: `${progress}%`, background: heatmapColor(progress), borderRadius: 3 }} />
      </div>
    </button>
  );
}

// ── Linha de input de atividade (folha) ────────────────────────────────────────
function ActivityInputRow({ task, onCommit, unlocated }: { task: GanttTask; onCommit: (id: string, v: number) => void | Promise<void>; unlocated: boolean }) {
  const p = task.physicalProgress || 0;
  const st = rowStatusStyle(p);
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const n = Math.min(100, Math.max(0, parseFloat(raw.replace(',', '.')) || 0));
    setDraft(null);
    if (Math.abs(n - p) > 0.001) onCommit(task.id, n);
  };

  return (
    <div style={{
      padding: '8px 8px', borderBottom: '0.5px solid var(--bd)', borderLeft: `3px solid ${st.accent}`,
      background: st.bg, borderRadius: 6, marginBottom: 5,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {task.name}
          {unlocated && <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--amber)', fontWeight: 700 }}>SEM LOCAL</span>}
        </span>
        <span className={statusBadgeClass(p)} style={{ flexShrink: 0, fontSize: 9, minWidth: 66, justifyContent: 'center' }}>{statusLabel(p)}</span>
        <button
          onClick={() => onCommit(task.id, 100)} title="Marcar 100%"
          className="ao-btn ao-btn-sm ao-btn-ok"
          style={{ flexShrink: 0, borderRadius: '50%', width: 22, height: 22, padding: 0 }}
        >✓</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="ao-pbar" style={{ flex: 1, minHeight: 6 }}>
          <div className="ao-pfill" style={{ width: `${p}%`, background: heatmapColor(p), borderRadius: 3 }} />
        </div>
        <input
          type="number" min={0} max={100}
          value={draft ?? String(Math.round(p * 100) / 100)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => { setDraft(String(Math.round(p * 100) / 100)); e.target.select(); }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
          style={{ width: 64, padding: '4px 6px', fontSize: 11, textAlign: 'right', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: st.text, fontFamily: 'var(--mono)', fontWeight: 600 }}
        />
        <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 500 }}>%</span>
      </div>
    </div>
  );
}
