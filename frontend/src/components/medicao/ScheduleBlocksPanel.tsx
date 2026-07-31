import { useMemo, useState, useCallback } from 'react';
import { Save, History, Check, CornerDownRight, AlertTriangle } from 'lucide-react';
import type { GanttTask } from '@/types';
import { buildForest, indexNodes, subtreeProgress, leafStats, FLOOR_PATTERN, type WbsNode } from '@/lib/wbs-tree';
import { statusLabel, statusBadgeClass, STATUS_COLORS, inferDiscipline, DISCIPLINE_ORDER, type Discipline } from '@/lib/measurement-helpers';
import { Toolbar, ToolbarButton } from '@/components/Toolbar';

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
  /** Hover em um bloco de navegação → sincroniza realce no 3D (via taskId). */
  onHoverNode?: (taskId: string | null) => void;
}

export default function ScheduleBlocksPanel({
  tasks, navPath, onNavPathChange, canteiroMode,
  onCommitLeaf, saving, onSaveReport, onOpenHistory, lastReportLabel, onHoverNode,
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
        <Toolbar>
          {childrenAreLeaves && (
            <ToolbarButton
              icon={<Check />}
              label="Tudo concluído"
              onClick={markAllDone}
              disabled={saving}
              title="Marcar todas as atividades como concluídas"
              style={{ background: 'var(--grn-bg)', color: 'var(--grn-t)', borderColor: 'var(--grn-bd)' }}
            />
          )}
          <ToolbarButton
            icon={<Save />}
            label={saving ? 'Gravando…' : 'Gravar Report'}
            variant="primary"
            onClick={onSaveReport}
            disabled={saving}
            title="Gravar Report — consolida o avanço físico no cronograma"
          />
          <ToolbarButton
            icon={<History />}
            label="Histórico"
            onClick={onOpenHistory}
            title="Histórico de Reports"
          />
        </Toolbar>
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
          {groupByDiscipline(children).map(([discipline, group]) => (
            <div key={discipline} style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '1px',
                padding: '4px 4px 6px', display: 'flex', alignItems: 'center', gap: 6,
              }}>
                {discipline}
                <span style={{ fontFamily: 'var(--mono)', color: 'var(--t4)', fontWeight: 600 }}>· {group.length}</span>
              </div>
              {group.map((c) => (
                <ActivityInputRow key={c.task.id} task={c.task} onCommit={onCommitLeaf} unlocated={c.unlocated} />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 8, overflowY: 'auto', maxHeight: '58vh', padding: 2 }}>
          {children.map((c) => (
            <NavBlock
              key={c.task.id}
              node={c}
              progress={subtreeProgress(c)}
              onClick={() => drill(c)}
              onHover={onHoverNode ? (h) => onHoverNode(h ? c.task.id : null) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const empty: React.CSSProperties = { padding: '32px 0', textAlign: 'center', fontSize: 12, color: 'var(--t3)' };

// ── Bloco de navegação (pavimento, apartamento, …) ─────────────────────────────
function NavBlock({ node, progress, onClick, onHover }: { node: WbsNode; progress: number; onClick: () => void; onHover?: (hovering: boolean) => void }) {
  const stats = leafStats(node);
  // Status dominante define a cor da borda esquerda (severidade em caso de empate).
  const dominant = dominantStatus(stats);
  const accent = STATUS_COLORS[dominant];
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: 'left', cursor: 'pointer', borderRadius: 10, padding: 10,
        border: `1px solid var(--bd)`, borderLeft: `3px solid ${accent}`,
        background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)',
        display: 'flex', flexDirection: 'column', gap: 8, minHeight: 84, transition: 'all .12s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,.12)'; onHover?.(true); }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; onHover?.(false); }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.task.name}</span>
        <CornerDownRight size={12} color="var(--t3)" style={{ flexShrink: 0 }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'var(--mono)', color: accent, lineHeight: 1 }}>{Math.round(progress)}%</span>
        <span style={{ fontSize: 9, color: 'var(--t3)' }}>{stats.total} {node.children.every((c) => c.isLeaf) ? 'ativ.' : 'subitens'}</span>
      </div>

      {/* Barra segmentada por status */}
      <SegmentedBar stats={stats} />

      {/* Linha de resumo */}
      {stats.delayed > 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: STATUS_COLORS.delayed }}>
          <AlertTriangle size={11} /> {stats.delayed} ativ. atrasada{stats.delayed > 1 ? 's' : ''}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>
          {summaryText(stats)}
        </div>
      )}
    </button>
  );
}

/** Determina o status dominante por contagem, com desempate por severidade. */
function dominantStatus(s: { done: number; inProgress: number; delayed: number; notStarted: number }): keyof typeof STATUS_COLORS {
  const order: (keyof typeof STATUS_COLORS)[] = ['delayed', 'inProgress', 'done', 'notStarted'];
  let best: keyof typeof STATUS_COLORS = 'notStarted';
  let bestN = -1;
  for (const k of order) {
    if (s[k] > bestN) { bestN = s[k]; best = k; }
  }
  return best;
}

function summaryText(s: { done: number; inProgress: number; notStarted: number }): string {
  const parts: string[] = [];
  if (s.done > 0) parts.push(`${s.done} concl`);
  if (s.inProgress > 0) parts.push(`${s.inProgress} andam`);
  if (s.notStarted > 0) parts.push(`${s.notStarted} não inic`);
  return parts.length ? parts.join(' · ') : 'sem atividades';
}

function SegmentedBar({ stats }: { stats: { done: number; inProgress: number; delayed: number; notStarted: number; total: number } }) {
  const total = Math.max(stats.total, 1);
  const w = (n: number) => `${(n / total) * 100}%`;
  return (
    <div style={{ display: 'flex', width: '100%', height: 6, borderRadius: 3, overflow: 'hidden', background: 'var(--s2)' }}>
      <div style={{ width: w(stats.done), background: STATUS_COLORS.done }} />
      <div style={{ width: w(stats.inProgress), background: STATUS_COLORS.inProgress }} />
      <div style={{ width: w(stats.delayed), background: STATUS_COLORS.delayed }} />
      <div style={{ width: w(stats.notStarted), background: STATUS_COLORS.notStarted }} />
    </div>
  );
}

// Agrupa as folhas por disciplina (inferida do nome), na ordem fixa e sem grupos vazios.
function groupByDiscipline(children: WbsNode[]): [Discipline, WbsNode[]][] {
  const map = new Map<Discipline, WbsNode[]>();
  for (const c of children) {
    const d = inferDiscipline(c.task.name);
    const arr = map.get(d);
    if (arr) arr.push(c); else map.set(d, [c]);
  }
  return DISCIPLINE_ORDER.filter((d) => map.has(d)).map((d) => [d, map.get(d)!] as [Discipline, WbsNode[]]);
}

const PRESETS = [25, 50, 75, 100];

// ── Linha de input de atividade (folha) ────────────────────────────────────────
function ActivityInputRow({ task, onCommit, unlocated }: { task: GanttTask; onCommit: (id: string, v: number) => void | Promise<void>; unlocated: boolean }) {
  const p = task.physicalProgress || 0;
  const accent = p >= 100 ? STATUS_COLORS.done : p > 0 ? STATUS_COLORS.inProgress : STATUS_COLORS.notStarted;
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    const n = Math.min(100, Math.max(0, parseFloat(raw.replace(',', '.')) || 0));
    setDraft(null);
    if (Math.abs(n - p) > 0.001) onCommit(task.id, n);
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      padding: '7px 8px', borderBottom: '0.5px solid var(--bd)', borderLeft: `3px solid ${accent}`,
      background: 'var(--s0)', borderRadius: 6, marginBottom: 4,
    }}>
      <span style={{ flex: '1 1 120px', minWidth: 0, fontSize: 12, fontWeight: 500, color: 'var(--t1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {task.name}
        {unlocated && <span style={{ marginLeft: 6, fontSize: 8, color: 'var(--amber)', fontWeight: 700 }}>SEM LOCAL</span>}
      </span>

      <span className={statusBadgeClass(p)} style={{ flexShrink: 0, fontSize: 9, minWidth: 66, justifyContent: 'center' }}>{statusLabel(p)}</span>

      {/* Presets: 1 clique lança o valor */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
        {PRESETS.map((v) => {
          const active = Math.abs(p - v) < 0.001;
          return (
            <button
              key={v}
              onClick={() => { setDraft(String(v)); commit(String(v)); }}
              title={`Lançar ${v}%`}
              style={{
                fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)', padding: '3px 6px', borderRadius: 5,
                cursor: 'pointer', border: `1px solid ${active ? accent : 'var(--bd)'}`,
                background: active ? accent : 'var(--s1)', color: active ? '#fff' : 'var(--t2)',
              }}
            >{v}</button>
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <input
          type="number" min={0} max={100}
          value={draft ?? String(Math.round(p * 100) / 100)}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={(e) => { setDraft(String(Math.round(p * 100) / 100)); e.target.select(); }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur(); } }}
          style={{ width: 54, padding: '4px 6px', fontSize: 11, textAlign: 'right', border: '1px solid var(--bd)', borderRadius: 4, background: 'var(--s0)', color: accent, fontFamily: 'var(--mono)', fontWeight: 600 }}
        />
        <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 500 }}>%</span>
      </div>
    </div>
  );
}
