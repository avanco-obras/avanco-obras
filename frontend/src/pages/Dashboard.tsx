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
  bg1: '#fff',
  bg2: '#f0efe9',
  bg3: '#e6e5df',
  t1: '#1a1a18',
  t2: '#6b6b67',
  t3: '#9a9a96',
  bd: 'rgba(0,0,0,.10)',
  amber: '#BA7517',
  ambBg: '#FAEEDA',
  ambT: '#633806',
  green: '#3B6D11',
  grnBg: '#EAF3DE',
  grnT: '#173404',
  red: '#A32D2D',
  redBg: '#FCEBEB',
  redT: '#501313',
  blue: '#185FA5',
  bluBg: '#E6F1FB',
  bluT: '#042C53',
  chartBlue: '#378ADD',
  chartRed: '#E24B4A',
};

// ── Mock / fallback data ──────────────────────────────────────────────────────
const MOCK_KPIs: DashboardKPIs = {
  physicalProgress: 47.3,
  plannedProgress: 52.1,
  spi: 0.91,
  ppcCurrent: 76,
  ppcForecast: 80,
  delayDays: 14,
  totalActivities: 120,
  completedActivities: 42,
  inProgressActivities: 18,
  delayedActivities: 7,
};

const MOCK_CURVA_S: CurvaSPoint[] = [
  { label: 'In.', planned: 0, actual: 0, date: '' },
  { label: 'Jan', planned: 8, actual: 6, date: '' },
  { label: 'Fev', planned: 14, actual: 11, date: '' },
  { label: 'Mar', planned: 20, actual: 18, date: '' },
  { label: 'Abr', planned: 28, actual: 25, date: '' },
  { label: 'Mai', planned: 36, actual: 33, date: '' },
  { label: 'Jun', planned: 44, actual: 40, date: '' },
  { label: 'Jul', planned: 52, actual: 47, date: '' },
  { label: 'Ago', planned: 60, actual: null as unknown as number, date: '' },
  { label: 'Set', planned: 68, actual: null as unknown as number, date: '' },
  { label: 'Out', planned: 76, actual: null as unknown as number, date: '' },
  { label: 'Nov', planned: 87, actual: null as unknown as number, date: '' },
  { label: 'Dez', planned: 100, actual: null as unknown as number, date: '' },
];

const MOCK_PPC_HISTORY: PPCHistoryPoint[] = [
  { weekLabel: 'S11', weekNumber: 11, year: 2025, ppcActual: 83, ppcTarget: 80 },
  { weekLabel: 'S12', weekNumber: 12, year: 2025, ppcActual: 75, ppcTarget: 80 },
  { weekLabel: 'S13', weekNumber: 13, year: 2025, ppcActual: 91, ppcTarget: 80 },
  { weekLabel: 'S14', weekNumber: 14, year: 2025, ppcActual: 68, ppcTarget: 80 },
  { weekLabel: 'S15', weekNumber: 15, year: 2025, ppcActual: 80, ppcTarget: 80 },
  { weekLabel: 'S16', weekNumber: 16, year: 2025, ppcActual: 85, ppcTarget: 80 },
  { weekLabel: 'S17', weekNumber: 17, year: 2025, ppcActual: 72, ppcTarget: 80 },
  { weekLabel: 'S18', weekNumber: 18, year: 2025, ppcActual: 76, ppcTarget: 80 },
];

const MOCK_DELAYS: DelayedActivity[] = [
  { id: '1', code: '1.3.2', name: 'Estrutura — Laje 8º andar', plannedProgress: 100, actualProgress: 72, deviation: 28, delayDays: 18, criticality: 1 },
  { id: '2', code: '2.1.4', name: 'Alvenaria de vedação — Bloco B', plannedProgress: 85, actualProgress: 61, deviation: 24, delayDays: 12, criticality: 0.6 },
  { id: '3', code: '3.2.1', name: 'Instalações elétricas — Shaft principal', plannedProgress: 60, actualProgress: 44, deviation: 16, delayDays: 8, criticality: 0.4 },
];

const MOCK_RESTRICTIONS: Restriction[] = [
  { id: '1', weeklyPlanId: '', description: 'Aprovação do projeto estrutural pela prefeitura', responsible: 'Eng. Silva', dueDate: '2025-05-20', status: 'PENDING' },
  { id: '2', weeklyPlanId: '', description: 'Fornecimento de vergalhão CA-50 — pedido em atraso', responsible: 'Compras', dueDate: '2025-05-15', status: 'IN_ANALYSIS' },
  { id: '3', weeklyPlanId: '', description: 'Liberação de acesso à área de escavação', responsible: 'Segurança', dueDate: '2025-05-10', status: 'RELEASED' },
];

const MOCK_ETAPAS = [
  { name: 'Fundações', actual: 100, planned: 100 },
  { name: 'Estrutura', actual: 68, planned: 85 },
  { name: 'Alvenaria', actual: 52, planned: 63 },
  { name: 'Cobertura', actual: 30, planned: 40 },
  { name: 'Instalações', actual: 44, planned: 55 },
  { name: 'Acabamentos', actual: 12, planned: 20 },
];

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ w, h, radius = 6 }: { w: string | number; h: string | number; radius?: number }) {
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        background: C.bg3,
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    />
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function AoCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.bg1,
        border: `1px solid ${C.bd}`,
        borderRadius: 10,
        padding: '16px 18px',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function CardHdr({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 13,
        fontWeight: 600,
        color: C.t1,
        marginBottom: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </div>
  );
}

// ── KPI Ring ──────────────────────────────────────────────────────────────────
const RING_CIRC = 201.1; // 2 * π * 32

function KpiRing({
  value,
  color,
  sublabel,
  formatter,
}: {
  value: number;
  color: string;
  label?: string;
  sublabel?: string;
  formatter?: (v: number) => string;
}) {
  const offset = RING_CIRC * (1 - Math.min(100, Math.max(0, value)) / 100);
  const displayVal = formatter ? formatter(value) : `${value.toFixed(1).replace('.', ',')}%`;

  return (
    <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
      <svg viewBox="0 0 80 80" width="80" height="80">
        <circle cx="40" cy="40" r="32" fill="none" stroke={C.bg3} strokeWidth="8" />
        <circle
          cx="40"
          cy="40"
          r="32"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={RING_CIRC}
          strokeDashoffset={offset}
          transform="rotate(-90 40 40)"
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          lineHeight: 1.1,
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: color }}>{displayVal}</span>
        {sublabel && (
          <span style={{ fontSize: 8, color: C.t3, marginTop: 1 }}>{sublabel}</span>
        )}
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
        borderRadius: 99,
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
          borderRadius: 99,
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
        if (!raw) { setKpis(MOCK_KPIs); return; }
        // backend returns overallProgress; map to physicalProgress
        setKpis({
          physicalProgress: Number(raw.overallProgress ?? raw.physicalProgress ?? MOCK_KPIs.physicalProgress),
          plannedProgress:  Number(raw.plannedProgress  ?? MOCK_KPIs.plannedProgress),
          spi:              Number(raw.spi              ?? MOCK_KPIs.spi),
          ppcCurrent:       raw.ppcCurrent  != null ? Number(raw.ppcCurrent)  : MOCK_KPIs.ppcCurrent,
          ppcForecast:      raw.ppcForecast != null ? Number(raw.ppcForecast) : MOCK_KPIs.ppcForecast,
          delayDays:        Number(raw.delayDays ?? 0),
          totalActivities:  Number(raw.totalActivities  ?? MOCK_KPIs.totalActivities),
          completedActivities: Number(raw.completedActivities ?? MOCK_KPIs.completedActivities),
          inProgressActivities: Number(raw.inProgressActivities ?? 0),
          delayedActivities: Number(raw.delayedActivities ?? MOCK_KPIs.delayedActivities),
        });
      })
      .catch(() => setKpis(MOCK_KPIs))
      .finally(() => setLoadingKpis(false));

    setLoadingDelays(true);
    Promise.all([
      dashboardApi.delays(projectId),
      dashboardApi.restrictions(projectId),
    ])
      .then(([d, r]) => {
        setDelays(d?.length ? d : MOCK_DELAYS);
        setRestrictions(r?.length ? r : MOCK_RESTRICTIONS);
      })
      .catch(() => {
        setDelays(MOCK_DELAYS);
        setRestrictions(MOCK_RESTRICTIONS);
      })
      .finally(() => setLoadingDelays(false));

    setLoadingCurvaS(true);
    scheduleApi
      .curvaS(projectId)
      .then((data) => setCurvaS(data?.length ? data : MOCK_CURVA_S))
      .catch(() => setCurvaS(MOCK_CURVA_S))
      .finally(() => setLoadingCurvaS(false));

    setLoadingPpc(true);
    weeklyPlanningApi
      .ppcHistory(projectId)
      .then((data) => setPpcHistory(data?.length ? data.slice(-8) : MOCK_PPC_HISTORY))
      .catch(() => setPpcHistory(MOCK_PPC_HISTORY))
      .finally(() => setLoadingPpc(false));

    setLoadingSchedule(true);
    scheduleApi
      .list(projectId)
      .then((items: ScheduleItem[]) => {
        const top = items.filter((i) => i.level === 0);
        if (top.length) {
          setEtapas(
            top.map((i) => ({
              name: i.name,
              actual: Number(i.actualProgress),
              planned: Number(i.plannedProgress),
            }))
          );
        } else {
          setEtapas(MOCK_ETAPAS);
        }
      })
      .catch(() => setEtapas(MOCK_ETAPAS))
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
  const physicalProgress = kpis?.physicalProgress ?? MOCK_KPIs.physicalProgress;
  const plannedProgress = kpis?.plannedProgress ?? MOCK_KPIs.plannedProgress;
  const spi = kpis?.spi ?? MOCK_KPIs.spi;
  const ppcCurrent = kpis?.ppcCurrent ?? MOCK_KPIs.ppcCurrent ?? 0;
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
    gap: 14,
  };
  const g2: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 14,
  };

  return (
    <div
      style={{
        padding: '20px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        background: C.bg2,
        minHeight: '100%',
      }}
    >
      {/* ── Page header ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: C.t1, margin: 0 }}>Dashboard</h1>
          <p style={{ fontSize: 12, color: C.t2, marginTop: 2 }}>{currentProject.name}</p>
        </div>
        <span style={{ fontSize: 11, color: C.t3 }}>
          Atualizado em {formatDate(new Date())}
        </span>
      </div>

      {/* ── ROW 1: KPI Rings ─────────────────────────────────────────── */}
      <div style={g3}>

        {/* KPI 1 — Avanço Físico */}
        <AoCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {loadingKpis ? (
              <Skeleton w={80} h={80} radius={99} />
            ) : (
              <KpiRing value={physicalProgress} color={C.amber} />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 11, color: C.t2, margin: 0, fontWeight: 500 }}>Avanço físico</p>
              {loadingKpis ? (
                <>
                  <Skeleton w={60} h={18} radius={4} />
                  <div style={{ marginTop: 4 }}><Skeleton w={80} h={10} radius={4} /></div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 20, fontWeight: 700, color: C.amber, margin: '2px 0 0' }}>
                    {physicalProgress.toFixed(1).replace('.', ',')}%
                  </p>
                  <p style={{ fontSize: 10, color: C.t3, margin: '2px 0 4px' }}>
                    Planejado: {plannedProgress.toFixed(1).replace('.', ',')}%
                  </p>
                  <PBar value={physicalProgress} color={C.amber} />
                </>
              )}
            </div>
          </div>
        </AoCard>

        {/* KPI 2 — SPI */}
        <AoCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {loadingKpis ? (
              <Skeleton w={80} h={80} radius={99} />
            ) : (
              <KpiRing
                value={Math.min(100, spi * 100)}
                color={spiColor(spi)}
                formatter={(v) => (v / 100).toFixed(2)}
              />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 11, color: C.t2, margin: 0, fontWeight: 500 }}>SPI (Prazo)</p>
              {loadingKpis ? (
                <>
                  <Skeleton w={60} h={18} radius={4} />
                  <div style={{ marginTop: 4 }}><Skeleton w={80} h={10} radius={4} /></div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 20, fontWeight: 700, color: spiColor(spi), margin: '2px 0 0' }}>
                    {spi.toFixed(2)}
                  </p>
                  <p style={{ fontSize: 10, color: C.t3, margin: '2px 0 4px' }}>
                    {spiLabel(spi)}{delayDays > 0 ? ` · −${delayDays}d` : ''}
                  </p>
                  <PBar value={Math.min(100, spi * 100)} color={spiColor(spi)} />
                </>
              )}
            </div>
          </div>
        </AoCard>

        {/* KPI 3 — PPC */}
        <AoCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {loadingKpis ? (
              <Skeleton w={80} h={80} radius={99} />
            ) : (
              <KpiRing value={ppcCurrent} color={ppcBarColor(ppcCurrent)} sublabel="meta 80%" />
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 11, color: C.t2, margin: 0, fontWeight: 500 }}>PPC Semana</p>
              {loadingKpis ? (
                <>
                  <Skeleton w={60} h={18} radius={4} />
                  <div style={{ marginTop: 4 }}><Skeleton w={80} h={10} radius={4} /></div>
                  <div style={{ marginTop: 6 }}>
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} w={`${20 + i * 8}%`} h={5} radius={99} />
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 20, fontWeight: 700, color: ppcBarColor(ppcCurrent), margin: '2px 0 0' }}>
                    {ppcCurrent.toFixed(0)}%
                  </p>
                  <p style={{ fontSize: 10, color: C.t3, margin: '2px 0 4px' }}>
                    Média 8 sem.: {ppcAvg8}%
                  </p>
                  {/* mini history bars */}
                  <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 22 }}>
                    {ppcHistory.map((p, i) => (
                      <div
                        key={i}
                        title={`${p.weekLabel}: ${p.ppcActual}%`}
                        style={{
                          flex: 1,
                          height: `${Math.max(8, (p.ppcActual / 100) * 22)}px`,
                          background: ppcBarColor(p.ppcActual),
                          borderRadius: 2,
                          opacity: 0.75,
                        }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </AoCard>
      </div>

      {/* ── ROW 2: Curva S + Etapas ────────────────────────────────── */}
      <div style={g2}>

        {/* Curva S */}
        <AoCard>
          <CardHdr>Curva S — Evolução do Avanço</CardHdr>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
            {[
              { color: C.chartBlue, label: 'Planejado' },
              { color: C.amber, label: 'Realizado' },
            ].map((l) => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 3, background: l.color, borderRadius: 99 }} />
                <span style={{ fontSize: 10, color: C.t2 }}>{l.label}</span>
              </div>
            ))}
          </div>
          {loadingCurvaS ? (
            <Skeleton w="100%" h={210} />
          ) : (
            <ResponsiveContainer width="100%" height={210}>
              <LineChart
                data={curvaS}
                margin={{ top: 14, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.chartBlue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.chartBlue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillAmber" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.amber} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bg3} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: C.t2 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: C.t2 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: `1px solid ${C.bd}`, borderRadius: 6 }}
                  formatter={(v: number) => [`${v}%`]}
                />
                <Line
                  type="monotone"
                  dataKey="planned"
                  name="Planejado"
                  stroke={C.chartBlue}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                >
                  <LabelList
                    dataKey="planned"
                    content={(props) => (
                      <CurvaSLabel {...props} color={C.chartBlue} />
                    )}
                  />
                </Line>
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Realizado"
                  stroke={C.amber}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                >
                  <LabelList
                    dataKey="actual"
                    content={(props) => (
                      <CurvaSLabel {...props} color={C.amber} />
                    )}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          )}
        </AoCard>

        {/* Etapas */}
        <AoCard>
          <CardHdr>
            Avanço por etapa{' '}
            <span style={{ fontSize: 10, color: C.t2, fontWeight: 400 }}>(real × planejado)</span>
          </CardHdr>
          {loadingSchedule ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} w="100%" h={24} radius={4} />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {etapas.map((e) => {
                const color = etapaColor(e.actual, e.planned);
                return (
                  <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 112,
                        fontSize: 11,
                        color: C.t1,
                        flexShrink: 0,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {e.name}
                    </span>
                    <div style={{ flex: 1, position: 'relative' }}>
                      {/* Planned ghost bar */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          height: '100%',
                          width: `${Math.min(100, e.planned)}%`,
                          background: C.bg3,
                          borderRadius: 99,
                        }}
                      />
                      {/* Actual bar */}
                      <div
                        style={{
                          position: 'relative',
                          height: 8,
                          borderRadius: 99,
                          background: 'transparent',
                          overflow: 'visible',
                        }}
                      >
                        <div
                          style={{
                            height: 8,
                            width: `${Math.min(100, e.actual)}%`,
                            background: color,
                            borderRadius: 99,
                          }}
                        />
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color, width: 34, textAlign: 'right', flexShrink: 0 }}>
                      {e.actual.toFixed(0)}%
                    </span>
                    <span style={{ fontSize: 10, color: C.t3, width: 40, flexShrink: 0 }}>
                      ({e.planned.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </AoCard>
      </div>

      {/* ── ROW 3: PPC history + Delays + Restrictions ───────────────── */}
      <div style={g3}>

        {/* PPC History bar chart */}
        <AoCard>
          <CardHdr>Histórico PPC</CardHdr>
          {loadingPpc ? (
            <Skeleton w="100%" h={140} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={ppcHistory}
                  margin={{ top: 14, right: 4, left: -28, bottom: 0 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={C.bg3} vertical={false} />
                  <XAxis
                    dataKey="weekLabel"
                    tick={{ fontSize: 10, fill: C.t2 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 10, fill: C.t2 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, border: `1px solid ${C.bd}`, borderRadius: 6 }}
                    formatter={(v: number) => [`${v}%`, 'PPC']}
                  />
                  <Bar dataKey="ppcActual" radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="ppcActual"
                      position="top"
                      style={{ fontSize: 9, fill: C.t2 }}
                      formatter={(v: number) => `${v}%`}
                    />
                    {ppcHistory.map((entry, index) => (
                      <Cell key={index} fill={ppcBarColor(entry.ppcActual)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: C.t2 }}>
                <span>
                  Previsão S{(ppcHistory[ppcHistory.length - 1]?.weekNumber ?? 0) + 1}:{' '}
                  <strong style={{ color: C.t1 }}>
                    {kpis?.ppcForecast?.toFixed(0) ?? '--'}%
                  </strong>
                </span>
                <span>
                  Média 8 sem.:{' '}
                  <strong style={{ color: C.t1 }}>{ppcAvg8}%</strong>
                </span>
              </div>
            </>
          )}
        </AoCard>

        {/* Delays */}
        <AoCard>
          <CardHdr>
            <span style={{ color: C.red, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={14} color={C.red} />
              Atividades em atraso
            </span>
          </CardHdr>
          {loadingDelays ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} w="100%" h={36} radius={4} />)}
            </div>
          ) : delays.length === 0 ? (
            <p style={{ fontSize: 12, color: C.t2, textAlign: 'center', padding: '24px 0' }}>
              Nenhuma atividade em atraso
            </p>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                {delays.map((d) => (
                  <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.t1,
                        flex: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        minWidth: 0,
                      }}
                    >
                      {d.name}
                    </span>
                    {/* criticality bar */}
                    <div
                      style={{
                        width: 48,
                        height: 5,
                        background: C.bg3,
                        borderRadius: 99,
                        flexShrink: 0,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${Math.min(100, (d.delayDays / 25) * 100)}%`,
                          background: d.criticality >= 0.8 ? C.red : C.amber,
                          borderRadius: 99,
                        }}
                      />
                    </div>
                    <Badge
                      bg={d.criticality >= 0.8 ? C.redBg : C.ambBg}
                      color={d.criticality >= 0.8 ? C.redT : C.ambT}
                    >
                      −{d.delayDays}d
                    </Badge>
                  </div>
                ))}
              </div>
              <div
                style={{
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: `1px solid ${C.bg3}`,
                  fontSize: 10,
                  color: C.t2,
                }}
              >
                Desvio total: <strong style={{ color: C.red }}>−{totalDeviationDays} dias</strong>
                {kpis && currentProject.endDate && (
                  <>
                    {' · '}Previsão conclusão:{' '}
                    <strong style={{ color: C.t1 }}>
                      {formatDate(
                        new Date(
                          new Date(currentProject.endDate).getTime() +
                            delayDays * 24 * 60 * 60 * 1000
                        )
                      )}
                    </strong>
                  </>
                )}
              </div>
            </>
          )}
        </AoCard>

        {/* Restrictions */}
        <AoCard>
          <CardHdr>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={14} color={C.amber} />
              Restrições pendentes
            </span>
          </CardHdr>
          {loadingDelays ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} w="100%" h={36} radius={4} />)}
            </div>
          ) : restrictions.length === 0 ? (
            <p style={{ fontSize: 12, color: C.t2, textAlign: 'center', padding: '24px 0' }}>
              Nenhuma restrição pendente
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9, maxHeight: 180, overflowY: 'auto' }}>
              {restrictions.map((r) => (
                <div key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                    <span
                      style={{
                        fontSize: 11,
                        color: C.t1,
                        lineHeight: 1.3,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {r.description}
                    </span>
                    {restrictionBadge(r.status)}
                  </div>
                  <span style={{ fontSize: 10, color: C.t3 }}>
                    {r.responsible} · {formatDate(r.dueDate)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </AoCard>
      </div>

      {/* keyframe for skeleton pulse */}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
    </div>
  );
}
