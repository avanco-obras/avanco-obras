import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { useStore } from '@/store';
import { dashboardApi, scheduleApi, weeklyPlanningApi } from '@/services/api';
import { formatDate } from '@/utils/calculations';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  LabelList,
} from 'recharts';
import type {
  DashboardKPIs,
  DelayedActivity,
  Restriction,
  CurvaSPoint,
  PPCHistoryPoint,
  ScheduleItem,
} from '@/types';

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg1: '#ffffff',
  bg2: '#F8FAFC',
  bg3: '#E2E8F0',
  t1: '#0D1829',
  t2: '#2D3D52',
  t3: '#5A6A7E',
  bd: '#E2E8F0',
  amber: '#D97706',
  ambBg: '#FFFBEB',
  ambT: '#78350F',
  green: '#16A34A',
  grnBg: '#F0FDF4',
  grnT: '#14532D',
  red: '#DC2626',
  redBg: '#FEF2F2',
  redT: '#7F1D1D',
  blue: '#1D4ED8',
  bluBg: '#EFF6FF',
  bluT: '#1E3A8A',
  chartBlue: '#2563EB',
  chartRed: '#DC2626',
};


// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w, h, radius = 2 }: { w: string | number; h: string | number; radius?: number }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: radius,
        background: C.bg3, animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function AoCard({ children, style, accent }: { children: React.ReactNode; style?: React.CSSProperties; accent?: string }) {
  return (
    <div
      className="ao-card"
      style={{ borderLeftColor: accent, ...style }}
    >
      {children}
    </div>
  );
}

function CardHdr({ children }: { children: React.ReactNode }) {
  return (
    <div className="ao-card-hdr">
      <span className="ao-card-title">{children}</span>
    </div>
  );
}

// ── Enterprise Metric Block (replaces KPI Ring) ───────────────────────────────
function AoMetric({
  label, value, meta, barPct, color, loading,
}: {
  label: string; value: string; meta: string;
  barPct: number; color: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="ao-card" style={{ borderLeftColor: color }}>
        <div className="ao-metric">
          <Skeleton w={80} h={9} />
          <div style={{ marginTop: 8 }}><Skeleton w={100} h={32} /></div>
          <div style={{ marginTop: 6 }}><Skeleton w={120} h={9} /></div>
          <div style={{ marginTop: 10 }}><Skeleton w="100%" h={2} /></div>
        </div>
      </div>
    );
  }
  return (
    <div className="ao-card" style={{ borderLeftColor: color }}>
      <div className="ao-metric">
        <div className="ao-metric-lbl">{label}</div>
        <div className="ao-metric-val" style={{ color }}>{value}</div>
        <div className="ao-metric-meta">{meta}</div>
        <div className="ao-metric-bar">
          <div className="ao-metric-fill" style={{ width: `${Math.min(100, Math.max(0, barPct))}%`, background: color }} />
        </div>
      </div>
    </div>
  );
}

// ── SPI color helpers ─────────────────────────────────────────────────────────
function spiColor(spi: number) {
  if (spi >= 1.0) return C.green;
  if (spi >= 0.9) return C.amber;
  return C.chartRed;
}

function spiLabel(spi: number) {
  if (spi >= 1.05) return 'Adiantado';
  if (spi >= 1.0) return 'No prazo';
  if (spi >= 0.9) return 'Atenção';
  return 'Atrasado';
}

// ── PPC bar color ─────────────────────────────────────────────────────────────
function ppcBarColor(v: number) {
  if (v >= 80) return C.green;
  if (v >= 70) return C.amber;
  return C.chartRed;
}

// ── Etapa bar color ───────────────────────────────────────────────────────────
function etapaColor(actual: number, planned: number) {
  const diff = planned - actual;
  if (diff <= 2) return C.green;
  if (diff <= 10) return C.amber;
  return C.chartRed;
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function PBar({ value, color, height = 5 }: { value: number; color?: string; height?: number }) {
  return (
    <div
      style={{
        background: C.bg3,
        borderRadius: 1,
        height,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          height: '100%',
          width: `${Math.min(100, Math.max(0, value))}%`,
          background: color ?? C.amber,
          borderRadius: 1,
          transition: 'width .4s',
        }}
      />
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({
  children,
  bg,
  color,
}: {
  children: React.ReactNode;
  bg: string;
  color: string;
}) {
  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: 4,
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function restrictionBadge(status: Restriction['status']) {
  switch (status) {
    case 'RELEASED':
      return <Badge bg={C.grnBg} color={C.grnT}>Liberada</Badge>;
    case 'IN_ANALYSIS':
      return <Badge bg={C.ambBg} color={C.ambT}>Em Análise</Badge>;
    case 'PENDING':
      return <Badge bg={C.redBg} color={C.redT}>Pendente</Badge>;
    case 'EXPIRED':
      return <Badge bg={C.bg3} color={C.t2}>Expirada</Badge>;
    default:
      return <Badge bg={C.bg3} color={C.t2}>{status}</Badge>;
  }
}

// ── Curva S custom dot (show label every 3 points) ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CurvaSLabel(props: any) {
  const { x, y, value, index, color } = props;
  if (value == null || index % 3 !== 0) return null;
  return (
    <text x={x} y={y - 6} textAnchor="middle" fontSize={9} fill={color ?? C.t2}>
      {`${value}%`}
    </text>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { currentProject } = useStore();

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [delays, setDelays] = useState<DelayedActivity[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [curvaS, setCurvaS] = useState<CurvaSPoint[]>([]);
  const [ppcHistory, setPpcHistory] = useState<PPCHistoryPoint[]>([]);
  const [etapas, setEtapas] = useState<{ name: string; actual: number; planned: number }[]>([]);

  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCurvaS, setLoadingCurvaS] = useState(true);
  const [loadingPpc, setLoadingPpc] = useState(true);
  const [loadingDelays, setLoadingDelays] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const projectId = currentProject?.id;

  const loadAll = useCallback(() => {
    if (!projectId) return;

    setLoadingKpis(true);
    dashboardApi
      .kpis(projectId)
      .then((raw: DashboardKPIs & { overallProgress?: number }) => {
        if (!raw) { setKpis(null); return; }
        setKpis({
          physicalProgress: Number(raw.overallProgress ?? raw.physicalProgress ?? 0),
          plannedProgress:  Number(raw.plannedProgress  ?? 0),
          spi:              Number(raw.spi              ?? 1),
          ppcCurrent:       raw.ppcCurrent  != null ? Number(raw.ppcCurrent)  : 0,
          ppcForecast:      raw.ppcForecast != null ? Number(raw.ppcForecast) : 0,
          delayDays:        Number(raw.delayDays ?? 0),
          totalActivities:  Number(raw.totalActivities  ?? 0),
          completedActivities: Number(raw.completedActivities ?? 0),
          inProgressActivities: Number(raw.inProgressActivities ?? 0),
          delayedActivities: Number(raw.delayedActivities ?? 0),
        });
      })
      .catch(() => setKpis(null))
      .finally(() => setLoadingKpis(false));

    setLoadingDelays(true);
    Promise.all([
      dashboardApi.delays(projectId),
      dashboardApi.restrictions(projectId),
    ])
      .then(([d, r]) => {
        setDelays(d ?? []);
        setRestrictions(r ?? []);
      })
      .catch(() => {
        setDelays([]);
        setRestrictions([]);
      })
      .finally(() => setLoadingDelays(false));

    setLoadingCurvaS(true);
    scheduleApi
      .curvaS(projectId)
      .then((data) => setCurvaS(data ?? []))
      .catch(() => setCurvaS([]))
      .finally(() => setLoadingCurvaS(false));

    setLoadingPpc(true);
    weeklyPlanningApi
      .ppcHistory(projectId)
      .then((data) => setPpcHistory(data?.length ? data.slice(-8) : []))
      .catch(() => setPpcHistory([]))
      .finally(() => setLoadingPpc(false));

    setLoadingSchedule(true);
    scheduleApi
      .list(projectId)
      .then((items: ScheduleItem[]) => {
        const top = items.filter((i) => i.level === 0);
        setEtapas(
          top.map((i) => ({
            name: i.name,
            actual: Number(i.actualProgress),
            planned: Number(i.plannedProgress),
          }))
        );
      })
      .catch(() => setEtapas([]))
      .finally(() => setLoadingSchedule(false));
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── No project selected ───────────────────────────────────────────────────
  if (!currentProject) {
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
        <AlertTriangle size={56} color={C.t3} />
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: C.t1, marginBottom: 4 }}>
            Selecione um empreendimento
          </h2>
          <p style={{ fontSize: 14, color: C.t2 }}>
            Escolha um projeto no seletor acima para visualizar o dashboard.
          </p>
        </div>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const physicalProgress = kpis?.physicalProgress ?? 0;
  const plannedProgress = kpis?.plannedProgress ?? 0;
  const spi = kpis?.spi ?? 1;
  const ppcCurrent = kpis?.ppcCurrent ?? 0;
  const delayDays = kpis?.delayDays ?? 0;

  const ppcAvg8 =
    ppcHistory.length > 0
      ? Math.round(ppcHistory.reduce((s, p) => s + p.ppcActual, 0) / ppcHistory.length)
      : 0;

  const totalDeviationDays = delays.reduce((s, d) => s + d.delayDays, 0);

  // ── Layout helpers ────────────────────────────────────────────────────────
  const g3: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 10,
  };
  const g2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        minHeight: '100%',
      }}
    >

      {/* ── ROW 1: Enterprise Metric Blocks ──────────────────────────── */}
      <div style={g3}>
        <AoMetric
          label="Avanço Físico"
          value={`${physicalProgress.toFixed(1).replace('.', ',')}%`}
          meta={`Planejado ${plannedProgress.toFixed(1).replace('.', ',')}%  ·  desvio ${(physicalProgress - plannedProgress).toFixed(1).replace('.', ',')}pp`}
          barPct={physicalProgress}
          color={C.blue}
          loading={loadingKpis}
        />
        <AoMetric
          label="SPI — Índice de Prazo"
          value={spi.toFixed(2)}
          meta={`${spiLabel(spi)}${delayDays > 0 ? `  ·  −${delayDays} dias` : ''}`}
          barPct={Math.min(100, spi * 100)}
          color={spiColor(spi)}
          loading={loadingKpis}
        />
        <AoMetric
          label="PPC — Semana Atual"
          value={`${ppcCurrent.toFixed(0)}%`}
          meta={`Média 8 semanas: ${ppcAvg8}%  ·  meta 80%`}
          barPct={ppcCurrent}
          color={ppcBarColor(ppcCurrent)}
          loading={loadingKpis}
        />
      </div>

      {/* ── ROW 2: Curva S + Etapas ────────────────────────────────── */}
      <div style={g2}>

        {/* Curva S */}
        <AoCard accent={C.blue}>
          <CardHdr>Curva S — Evolução do Avanço</CardHdr>
          <div className="ao-card-body">
            <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
              {[{ color: C.bg3, label: 'Planejado' }, { color: C.blue, label: 'Realizado' }].map((l) => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 18, height: 2, background: l.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 9, color: C.t3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{l.label}</span>
                </div>
              ))}
            </div>
            {loadingCurvaS ? (
              <Skeleton w="100%" h={210} />
            ) : curvaS.length === 0 ? (
              <div style={{ height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 12, color: C.t3 }}>Nenhum dado de cronograma cadastrado</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={curvaS} margin={{ top: 14, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 3" stroke={C.bg3} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.t3 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.t3 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                  <Tooltip contentStyle={{ fontSize: 11, border: `1px solid ${C.bd}`, borderRadius: 2, background: C.bg1 }} formatter={(v: number) => [`${v}%`]} />
                  <Line type="monotone" dataKey="planned" name="Planejado" stroke={C.bg3} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls>
                    <LabelList dataKey="planned" content={(props) => <CurvaSLabel {...props} color={C.t3} />} />
                  </Line>
                  <Line type="monotone" dataKey="actual" name="Realizado" stroke={C.blue} strokeWidth={2} dot={false} connectNulls={false}>
                    <LabelList dataKey="actual" content={(props) => <CurvaSLabel {...props} color={C.blue} />} />
                  </Line>
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </AoCard>

        {/* Etapas */}
        <AoCard>
          <CardHdr>Avanço por Etapa — real × planejado</CardHdr>
          <div className="ao-card-body">
            {loadingSchedule ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} w="100%" h={20} />)}
              </div>
            ) : etapas.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120 }}>
                <p style={{ fontSize: 12, color: C.t3 }}>Nenhuma etapa no cronograma</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {etapas.map((e) => {
                  const color = etapaColor(e.actual, e.planned);
                  return (
                    <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 112, fontSize: 11, color: C.t1, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.name}
                      </span>
                      <div style={{ flex: 1, position: 'relative', height: 6 }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, e.planned)}%`, background: C.bg3, borderRadius: 1 }} />
                        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.min(100, e.actual)}%`, background: color, borderRadius: 1 }} />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color, width: 34, textAlign: 'right', flexShrink: 0, fontFamily: 'var(--mono)' }}>
                        {e.actual.toFixed(0)}%
                      </span>
                      <span style={{ fontSize: 9, color: C.t3, width: 40, flexShrink: 0, fontFamily: 'var(--mono)' }}>
                        /{e.planned.toFixed(0)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </AoCard>
      </div>

      {/* ── ROW 3: PPC history + Delays + Restrictions ───────────────── */}
      <div style={g3}>

        {/* PPC History */}
        <AoCard>
          <CardHdr>Histórico PPC — Últimas 8 Semanas</CardHdr>
          <div className="ao-card-body">
            {loadingPpc ? (
              <Skeleton w="100%" h={140} />
            ) : ppcHistory.length === 0 ? (
              <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <p style={{ fontSize: 12, color: C.t3 }}>Nenhum registro de PPC ainda</p>
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={ppcHistory} margin={{ top: 14, right: 4, left: -28, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="2 3" stroke={C.bg3} vertical={false} />
                    <XAxis dataKey="weekLabel" tick={{ fontSize: 9, fill: C.t2 }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: C.t2 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, border: `1px solid ${C.bd}`, borderRadius: 2 }} formatter={(v: number) => [`${v}%`, 'PPC']} />
                    <Bar dataKey="ppcActual" radius={[1, 1, 0, 0]}>
                      <LabelList dataKey="ppcActual" position="top" style={{ fontSize: 9, fill: C.t2 }} formatter={(v: number) => `${v}%`} />
                      {ppcHistory.map((entry, index) => <Cell key={index} fill={ppcBarColor(entry.ppcActual)} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: C.t2, fontFamily: 'var(--mono)' }}>
                  <span>Prev. S{(ppcHistory[ppcHistory.length - 1]?.weekNumber ?? 0) + 1}: <strong style={{ color: C.t1 }}>{kpis?.ppcForecast?.toFixed(0) ?? '--'}%</strong></span>
                  <span>Média 8s: <strong style={{ color: C.t1 }}>{ppcAvg8}%</strong></span>
                </div>
              </>
            )}
          </div>
        </AoCard>

        {/* Delays */}
        <AoCard accent={C.red}>
          <CardHdr>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={13} color={C.red} />
              Atividades em Atraso
            </span>
          </CardHdr>
          <div className="ao-card-body">
            {loadingDelays ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} w="100%" h={36} />)}
              </div>
            ) : delays.length === 0 ? (
              <p style={{ fontSize: 12, color: C.t2, textAlign: 'center', padding: '24px 0' }}>Nenhuma atividade em atraso</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                  {delays.map((d) => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: C.t1, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {d.name}
                      </span>
                      <div style={{ width: 40, height: 3, background: C.bg3, borderRadius: 1, flexShrink: 0, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (d.delayDays / 25) * 100)}%`, background: d.criticality >= 0.8 ? C.red : C.amber, borderRadius: 1 }} />
                      </div>
                      <Badge bg={d.criticality >= 0.8 ? C.redBg : C.ambBg} color={d.criticality >= 0.8 ? C.redT : C.ambT}>
                        −{d.delayDays}d
                      </Badge>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.bg3}`, fontSize: 10, color: C.t2, fontFamily: 'var(--mono)' }}>
                  Desvio total: <strong style={{ color: C.red }}>−{totalDeviationDays} dias</strong>
                  {kpis && currentProject.endDate && (
                    <> · Prev. conclusão: <strong style={{ color: C.t1 }}>{formatDate(new Date(new Date(currentProject.endDate).getTime() + delayDays * 86400000))}</strong></>
                  )}
                </div>
              </>
            )}
          </div>
        </AoCard>

        {/* Restrictions */}
        <AoCard accent={C.amber}>
          <CardHdr>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={13} color={C.amber} />
              Restrições Pendentes
            </span>
          </CardHdr>
          <div className="ao-card-body">
            {loadingDelays ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map((i) => <Skeleton key={i} w="100%" h={36} />)}
              </div>
            ) : restrictions.length === 0 ? (
              <p style={{ fontSize: 12, color: C.t2, textAlign: 'center', padding: '24px 0' }}>Nenhuma restrição pendente</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 180, overflowY: 'auto' }}>
                {restrictions.map((r) => (
                  <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11, color: C.t1, lineHeight: 1.3, flex: 1, minWidth: 0 }}>{r.description}</span>
                      {restrictionBadge(r.status)}
                    </div>
                    <span style={{ fontSize: 10, color: C.t3, fontFamily: 'var(--mono)' }}>{r.responsible} · {formatDate(r.dueDate)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </AoCard>
      </div>

      {/* keyframe for skeleton pulse */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}
