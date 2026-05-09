import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { useStore } from '@/store';
import { dashboardApi, scheduleApi, weeklyPlanningApi } from '@/services/api';
import { ProgressRing } from '@/components/ProgressRing';
import { CurvaS } from '@/components/CurvaS';
import { PPCChart } from '@/components/PPCChart';
import { ActivityMetrics } from '@/components/ActivityMetrics';
import { getSPIColor, getPPCColor, getProgressColor, formatDate } from '@/utils/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type {
  DashboardKPIs,
  DelayedActivity,
  Restriction,
  CurvaSPoint,
  PPCHistoryPoint,
  ScheduleItem,
} from '@/types';

// ── Skeleton helpers ─────────────────────────────────────────────────────────

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-muted ${className ?? ''}`}
    />
  );
}

function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6 flex flex-col items-center gap-3">
        <SkeletonBlock className="w-[120px] h-[120px] rounded-full" />
        <SkeletonBlock className="w-24 h-4" />
        <SkeletonBlock className="w-16 h-3" />
      </CardContent>
    </Card>
  );
}

// ── Restriction status badge ─────────────────────────────────────────────────

function restrictionBadge(status: Restriction['status']) {
  switch (status) {
    case 'PENDING':
      return <Badge variant="warning">Pendente</Badge>;
    case 'IN_ANALYSIS':
      return <Badge variant="secondary">Em Análise</Badge>;
    case 'RELEASED':
      return <Badge variant="success">Liberada</Badge>;
    case 'EXPIRED':
      return <Badge variant="destructive">Expirada</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ── SPI helpers ──────────────────────────────────────────────────────────────

function spiLabel(spi: number): string {
  if (spi >= 1.05) return 'Adiantado';
  if (spi >= 1) return 'No prazo';
  if (spi >= 0.85) return 'Atenção';
  return 'Atrasado';
}

function SpiIcon({ spi }: { spi: number }) {
  if (spi >= 1.05) return <TrendingUp className="h-4 w-4" style={{ color: '#22c55e' }} />;
  if (spi >= 1) return <Minus className="h-4 w-4" style={{ color: '#22c55e' }} />;
  if (spi >= 0.85) return <TrendingDown className="h-4 w-4" style={{ color: '#f59e0b' }} />;
  return <TrendingDown className="h-4 w-4" style={{ color: '#ef4444' }} />;
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const { currentProject } = useStore();

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [delays, setDelays] = useState<DelayedActivity[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [curvaS, setCurvaS] = useState<CurvaSPoint[]>([]);
  const [ppcHistory, setPpcHistory] = useState<PPCHistoryPoint[]>([]);
  const [scheduleItems, setScheduleItems] = useState<ScheduleItem[]>([]);

  const [loadingKpis, setLoadingKpis] = useState(true);
  const [loadingCurvaS, setLoadingCurvaS] = useState(true);
  const [loadingPpc, setLoadingPpc] = useState(true);
  const [loadingDelays, setLoadingDelays] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const [errorKpis, setErrorKpis] = useState<string | null>(null);

  const projectId = currentProject?.id;

  const loadAll = useCallback(() => {
    if (!projectId) return;

    setLoadingKpis(true);
    setErrorKpis(null);
    dashboardApi
      .kpis(projectId)
      .then(setKpis)
      .catch(() => setErrorKpis('Não foi possível carregar os KPIs.'))
      .finally(() => setLoadingKpis(false));

    setLoadingDelays(true);
    Promise.all([
      dashboardApi.delays(projectId),
      dashboardApi.restrictions(projectId),
    ])
      .then(([d, r]) => {
        setDelays(d);
        setRestrictions(r);
      })
      .catch(() => {})
      .finally(() => setLoadingDelays(false));

    setLoadingCurvaS(true);
    scheduleApi
      .curvaS(projectId)
      .then(setCurvaS)
      .catch(() => {})
      .finally(() => setLoadingCurvaS(false));

    setLoadingPpc(true);
    weeklyPlanningApi
      .ppcHistory(projectId)
      .then((data) => setPpcHistory(data.slice(-8)))
      .catch(() => {})
      .finally(() => setLoadingPpc(false));

    setLoadingSchedule(true);
    scheduleApi
      .list(projectId)
      .then((items) => setScheduleItems(items.filter((i) => i.level === 0)))
      .catch(() => {})
      .finally(() => setLoadingSchedule(false));
  }, [projectId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <AlertTriangle className="h-14 w-14 text-muted-foreground/40" />
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">
            Selecione um empreendimento
          </h2>
          <p className="text-muted-foreground text-sm">
            Escolha um projeto no seletor acima para visualizar o dashboard.
          </p>
        </div>
      </div>
    );
  }

  // Derived metrics
  const physicalProgress = kpis?.physicalProgress ?? 0;
  const spi = kpis?.spi ?? 1;
  const ppcCurrent = kpis?.ppcCurrent ?? 0;
  const ppcForecast = kpis?.ppcForecast;

  const activityMetricsItems = scheduleItems.map((item) => ({
    name: item.name,
    planned: item.plannedProgress,
    actual: item.actualProgress,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Page title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {currentProject.name}
          </p>
        </div>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Atualizado em {formatDate(new Date())}
        </p>
      </div>

      {/* ── Row 1: KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Avanço Físico */}
        {loadingKpis ? (
          <KpiCardSkeleton />
        ) : (
          <Card>
            <CardHeader className="pb-2 pt-4 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                Avanço Físico
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2 pb-5">
              <ProgressRing
                value={physicalProgress}
                size={120}
                color={getProgressColor(physicalProgress)}
                label="Progresso Geral"
                sublabel={
                  kpis
                    ? `${kpis.completedActivities}/${kpis.totalActivities} atividades`
                    : undefined
                }
              />
              {kpis && (
                <div className="flex gap-3 text-xs text-muted-foreground mt-1">
                  <span>
                    <span className="font-medium text-blue-500">{kpis.inProgressActivities}</span>{' '}
                    em andamento
                  </span>
                  <span>
                    <span className="font-medium text-amber-500">{kpis.delayedActivities}</span>{' '}
                    atrasadas
                  </span>
                </div>
              )}
              {errorKpis && (
                <p className="text-xs text-destructive">{errorKpis}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* SPI */}
        {loadingKpis ? (
          <KpiCardSkeleton />
        ) : (
          <Card>
            <CardHeader className="pb-2 pt-4 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                Índice de Desempenho de Prazo
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2 pb-5">
              <ProgressRing
                value={Math.min(100, spi * 100)}
                size={120}
                color={getSPIColor(spi)}
                formatter={() => spi.toFixed(2)}
                label="SPI"
                sublabel={spiLabel(spi)}
              />
              <div className="flex items-center gap-1.5 text-xs font-medium mt-1">
                <SpiIcon spi={spi} />
                <span style={{ color: getSPIColor(spi) }}>{spiLabel(spi)}</span>
              </div>
              {kpis && kpis.delayDays > 0 && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {kpis.delayDays} dias de atraso
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* PPC */}
        {loadingKpis ? (
          <KpiCardSkeleton />
        ) : (
          <Card>
            <CardHeader className="pb-2 pt-4 px-6">
              <CardTitle className="text-sm font-medium text-muted-foreground text-center">
                Percentual de Planos Concluídos
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-2 pb-5">
              <ProgressRing
                value={ppcCurrent}
                size={120}
                color={getPPCColor(ppcCurrent)}
                label="PPC Semana Atual"
                sublabel={
                  ppcForecast !== undefined
                    ? `Previsão: ${ppcForecast.toFixed(1)}%`
                    : undefined
                }
              />
              <div className="flex items-center gap-2 text-xs mt-1">
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: getPPCColor(ppcCurrent) }}
                />
                <span className="text-muted-foreground">
                  Meta: <span className="font-medium text-foreground">80%</span>
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Row 2: Curva S ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Curva S — Evolução do Avanço</CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          {loadingCurvaS ? (
            <SkeletonBlock className="w-full h-80 rounded-md" />
          ) : (
            <CurvaS data={curvaS} height={320} />
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: Activity Metrics + PPC Chart ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Progresso por Fase</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {loadingSchedule ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <SkeletonBlock key={i} className="w-full h-5 rounded" />
                ))}
              </div>
            ) : (
              <ActivityMetrics items={activityMetricsItems} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Histórico de PPC</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {loadingPpc ? (
              <SkeletonBlock className="w-full h-48 rounded-md" />
            ) : (
              <PPCChart data={ppcHistory} height={200} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Delays + Restrictions ─────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Delayed Activities */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Atividades em Atraso
              {delays.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {delays.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {loadingDelays ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="w-full h-14 rounded" />
                ))}
              </div>
            ) : delays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma atividade em atraso</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {delays.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-md border border-border p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-muted-foreground">
                          {activity.code}
                        </p>
                        <p className="text-sm font-medium text-foreground truncate leading-tight">
                          {activity.name}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <Badge variant="destructive" className="text-xs">
                          -{activity.deviation.toFixed(1)}%
                        </Badge>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {activity.delayDays}d atraso
                        </span>
                      </div>
                    </div>

                    {/* Progress bars */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-muted-foreground shrink-0">Planejado</span>
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-blue-400 rounded-full"
                            style={{ width: `${activity.plannedProgress}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-medium shrink-0">
                          {activity.plannedProgress.toFixed(0)}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="w-16 text-muted-foreground shrink-0">Realizado</span>
                        <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${activity.actualProgress}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-medium shrink-0">
                          {activity.actualProgress.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Restrictions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Restrições Pendentes
              {restrictions.filter((r) => r.status === 'PENDING' || r.status === 'IN_ANALYSIS').length > 0 && (
                <Badge variant="warning" className="ml-auto">
                  {restrictions.filter((r) => r.status === 'PENDING' || r.status === 'IN_ANALYSIS').length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            {loadingDelays ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <SkeletonBlock key={i} className="w-full h-14 rounded" />
                ))}
              </div>
            ) : restrictions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm text-muted-foreground">Nenhuma restrição pendente</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {restrictions.map((restriction) => (
                  <div
                    key={restriction.id}
                    className="rounded-md border border-border p-3 space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground flex-1 leading-snug">
                        {restriction.description}
                      </p>
                      {restrictionBadge(restriction.status)}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="font-medium text-foreground">Resp.:</span>
                        {restriction.responsible}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(restriction.dueDate)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
