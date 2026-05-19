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
  bg2: '#F7F8FA',
  bg3: '#E2E4E8',
  t1: '#131720',
  t2: '#5A6275',
  t3: '#9AA0AD',
  bd: '#E0E2E6',
  amber: '#C47D0F',
  ambBg: '#FEF3DC',
  ambT: '#7A4D07',
  green: '#16803C',
  grnBg: '#E8F5EE',
  grnT: '#0C4E25',
  red: '#C9312F',
  redBg: '#FDECEC',
  redT: '#7A1A19',
  blue: '#1B6FE8',
  bluBg: '#EBF2FD',
  bluT: '#0A3880',
  chartBlue: '#1B6FE8',
  chartRed: '#C9312F',
};


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
      className="ao-card"
      style={{
        padding: '14px 16px',
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
        fontSize: 12,
        fontWeight: 600,
        color: C.t1,
        marginBottom: 10,
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

      {/* ── ROW 1: KPI Rings ─────────────────────────────────────────── */}
      <div style={g3}>

        {/* KPI 1 — Avanço Físico */}
        <AoCard>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {loadingKpis ? (
              <Skeleton w={80} h={80} radius={99} />
            ) : (
              <KpiRing value={physicalProgress} color={C.blue} />
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
                  <p style={{ fontSize: 20, fontWeight: 700, color: C.blue, margin: '2px 0 0' }}>
                    {physicalProgress.toFixed(1).replace('.', ',')}%
                  </p>
                  <p style={{ fontSize: 10, color: C.t3, margin: '2px 0 4px' }}>
                    Planejado: {plannedProgress.toFixed(1).replace('.', ',')}%
                  </p>
                  <PBar value={physicalProgress} color={C.blue} />
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
              { color: C.bg3, label: 'Planejado' },
              { color: C.blue, label: 'Realizado' },
            ].map((l) => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 18, height: 3, background: l.color, borderRadius: 99 }} />
                <span style={{ fontSize: 10, color: C.t2 }}>{l.label}</span>
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
              <LineChart
                data={curvaS}
                margin={{ top: 14, right: 8, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="fillBlue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.chartBlue} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={C.chartBlue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fillBlue2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={C.blue} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.bg3} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: C.t3 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 9, fill: C.t3 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, border: `1px solid ${C.bd}`, borderRadius: 6, background: C.bg1 }}
                  formatter={(v: number) => [`${v}%`]}
                />
                <Line
                  type="monotone"
                  dataKey="planned"
                  name="Planejado"
                  stroke={C.bg3}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                  connectNulls
                >
                  <LabelList
                    dataKey="planned"
                    content={(props) => (
                      <CurvaSLabel {...props} color={C.t3} />
                    )}
                  />
                </Line>
                <Line
                  type="monotone"
                  dataKey="actual"
                  name="Realizado"
                  stroke={C.blue}
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                >
                  <LabelList
                    dataKey="actual"
                    content={(props) => (
                      <CurvaSLabel {...props} color={C.blue} />
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
          ) : ppcHistory.length === 0 ? (
            <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ fontSize: 12, color: C.t3 }}>Nenhum registro de PPC ainda</p>
            </div>
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
