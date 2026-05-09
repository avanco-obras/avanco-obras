import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Check, Save, Loader2, ChevronRight } from 'lucide-react';
import { useStore } from '@/store';
import { towersApi, measurementsApi, activityTypesApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import type { Tower, Floor, Unit, ActivityType, Measurement } from '@/types';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  activityTypeId: string;
  name: string;
  measurementMethod: 'PERCENT' | 'METRIC' | 'COUNT';
  unit: string;
  defaultQuantity: number;
  // edit state
  mode: 'PERCENT' | 'METRIC';
  percentValue: number; // 0-100
  executedQty: number;
  totalQty: number;
  // computed
  computed: number; // final 0-100
  isDirty: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function progressColor(p: number): string {
  if (p === 0) return '#94a3b8'; // slate-400
  if (p < 100) return '#f59e0b'; // amber-400
  return '#22c55e'; // green-500
}

function unitBgClass(p: number): string {
  if (p === 0) return 'bg-slate-100 border-slate-200';
  if (p < 100) return 'bg-amber-50 border-amber-300';
  return 'bg-green-50 border-green-400';
}

function floorBandColor(avg: number): string {
  if (avg === 0) return '#cbd5e1'; // slate-300
  if (avg < 100) return '#fbbf24'; // amber-400
  return '#22c55e'; // green-500
}

function calcFromMetric(executed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((executed / total) * 10000) / 100);
}

function calcOverallProgress(entries: ActivityEntry[]): number {
  if (entries.length === 0) return 0;
  const sum = entries.reduce((acc, e) => acc + e.computed, 0);
  return Math.round(sum / entries.length);
}

function methodLabel(method: 'PERCENT' | 'METRIC' | 'COUNT'): string {
  if (method === 'PERCENT') return '%';
  if (method === 'METRIC') return 'm²';
  return 'un';
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-slate-200 p-3 animate-pulse space-y-2">
      <div className="h-3 bg-slate-200 rounded w-3/4" />
      <div className="h-2 bg-slate-100 rounded w-1/2" />
      <div className="h-1.5 bg-slate-100 rounded w-full mt-2" />
    </div>
  );
}

// ── Building SVG Panel ────────────────────────────────────────────────────────

interface BuildingPanelProps {
  floors: Floor[];
  units: Record<string, Unit[]>; // floorId → units
  selectedFloorId: string | null;
  onSelectFloor: (floorId: string) => void;
}

function BuildingPanel({ floors, units, selectedFloorId, onSelectFloor }: BuildingPanelProps) {
  const BAND_HEIGHT = 28;
  const UNIT_W = 18;
  const UNIT_H = 20;
  const UNIT_GAP = 3;
  const LEFT_LABEL_W = 36;
  const SVG_W = 240;

  const sorted = [...floors].sort((a, b) => b.level - a.level); // top = highest level

  function avgProgress(floorId: string): number {
    const us = units[floorId] ?? [];
    if (us.length === 0) return 0;
    const sum = us.reduce((acc, u) => acc + (u.progressPercent ?? 0), 0);
    return sum / us.length;
  }

  const svgHeight = Math.max(80, sorted.length * (BAND_HEIGHT + 4) + 20);

  return (
    <div className="flex flex-col items-center gap-1">
      <p className="text-xs font-semibold text-slate-500 self-start mb-1">Vista do Edifício</p>
      <svg
        width={SVG_W}
        height={svgHeight}
        className="rounded border border-slate-200 bg-slate-50"
        viewBox={`0 0 ${SVG_W} ${svgHeight}`}
      >
        {sorted.map((floor, idx) => {
          const y = 10 + idx * (BAND_HEIGHT + 4);
          const floorUnits = units[floor.id] ?? [];
          const avg = avgProgress(floor.id);
          const isSelected = floor.id === selectedFloorId;

          return (
            <g
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              style={{ cursor: 'pointer' }}
            >
              {/* Band background */}
              <rect
                x={LEFT_LABEL_W}
                y={y}
                width={SVG_W - LEFT_LABEL_W - 8}
                height={BAND_HEIGHT}
                rx={4}
                fill={isSelected ? '#e0e7ff' : '#f1f5f9'}
                stroke={isSelected ? '#6366f1' : '#cbd5e1'}
                strokeWidth={isSelected ? 2 : 1}
              />
              {/* Floor label */}
              <text
                x={LEFT_LABEL_W - 4}
                y={y + BAND_HEIGHT / 2 + 4}
                textAnchor="end"
                fontSize={9}
                fill="#64748b"
                fontFamily="monospace"
              >
                {floor.name}
              </text>
              {/* Unit rects */}
              {floorUnits.slice(0, Math.floor((SVG_W - LEFT_LABEL_W - 16) / (UNIT_W + UNIT_GAP))).map((unit, ui) => {
                const ux = LEFT_LABEL_W + 6 + ui * (UNIT_W + UNIT_GAP);
                const uy = y + (BAND_HEIGHT - UNIT_H) / 2;
                const p = unit.progressPercent ?? 0;
                return (
                  <rect
                    key={unit.id}
                    x={ux}
                    y={uy}
                    width={UNIT_W}
                    height={UNIT_H}
                    rx={2}
                    fill={progressColor(p)}
                    opacity={0.75}
                  />
                );
              })}
              {/* If no units, show avg color band */}
              {floorUnits.length === 0 && (
                <rect
                  x={LEFT_LABEL_W + 6}
                  y={y + 6}
                  width={SVG_W - LEFT_LABEL_W - 20}
                  height={BAND_HEIGHT - 12}
                  rx={3}
                  fill={floorBandColor(avg)}
                  opacity={0.5}
                />
              )}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1">
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-slate-300" /> 0%</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-400" /> Em andamento</span>
        <span className="flex items-center gap-1"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500" /> 100%</span>
      </div>
    </div>
  );
}

// ── Activity Row ──────────────────────────────────────────────────────────────

interface ActivityRowProps {
  entry: ActivityEntry;
  onChange: (updated: Partial<ActivityEntry>) => void;
  onMarkDone: () => void;
}

function ActivityRow({ entry, onChange, onMarkDone }: ActivityRowProps) {
  const isMetric = entry.mode === 'METRIC' && entry.measurementMethod !== 'PERCENT';
  const computed = entry.computed;

  function handlePercentChange(val: string) {
    const n = Math.min(100, Math.max(0, parseFloat(val) || 0));
    onChange({ percentValue: n, computed: n, isDirty: true });
  }

  function handleExecutedChange(val: string) {
    const executed = parseFloat(val) || 0;
    const computed = calcFromMetric(executed, entry.totalQty);
    onChange({ executedQty: executed, computed, isDirty: true });
  }

  function handleTotalChange(val: string) {
    const total = parseFloat(val) || 0;
    const computed = calcFromMetric(entry.executedQty, total);
    onChange({ totalQty: total, computed, isDirty: true });
  }

  return (
    <div className={`rounded-md border p-3 space-y-2 transition-colors ${entry.isDirty ? 'border-blue-300 bg-blue-50/40' : 'border-border bg-background'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-medium text-foreground truncate">{entry.name}</span>
          <Badge variant="outline" className="shrink-0 text-[10px] px-1 py-0">
            {methodLabel(entry.measurementMethod)}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* Mode toggle — only show if metric is possible */}
          {entry.measurementMethod !== 'PERCENT' && (
            <div className="flex rounded-md border border-input overflow-hidden text-[10px]">
              <button
                onClick={() => onChange({ mode: 'PERCENT', isDirty: true })}
                className={`px-2 py-0.5 transition-colors ${!isMetric ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                % Manual
              </button>
              <button
                onClick={() => onChange({ mode: 'METRIC', isDirty: true })}
                className={`px-2 py-0.5 transition-colors ${isMetric ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              >
                Métrica
              </button>
            </div>
          )}

          {/* Mark 100% */}
          <button
            onClick={onMarkDone}
            title="Marcar 100%"
            className="w-6 h-6 rounded-full border border-green-400 text-green-600 flex items-center justify-center hover:bg-green-50 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Inputs */}
      {isMetric ? (
        <div className="flex items-center gap-2 text-xs">
          <Input
            type="number"
            min={0}
            value={entry.executedQty}
            onChange={(e) => handleExecutedChange(e.target.value)}
            className="h-7 w-20 text-xs px-2"
            placeholder="Exec."
          />
          <span className="text-muted-foreground">/</span>
          <Input
            type="number"
            min={0}
            value={entry.totalQty}
            onChange={(e) => handleTotalChange(e.target.value)}
            className="h-7 w-20 text-xs px-2"
            placeholder="Total"
          />
          <span className="text-muted-foreground">{entry.unit}</span>
          <span className="ml-auto font-semibold text-sm" style={{ color: progressColor(computed) }}>
            {computed.toFixed(1)}%
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            value={entry.percentValue}
            onChange={(e) => handlePercentChange(e.target.value)}
            className="h-7 w-24 text-xs px-2"
            placeholder="0–100"
          />
          <span className="text-xs text-muted-foreground">%</span>
          <span className="ml-auto font-semibold text-sm" style={{ color: progressColor(computed) }}>
            {computed.toFixed(1)}%
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${computed}%`, backgroundColor: progressColor(computed) }}
        />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Medicao() {
  const { currentProject, addToast } = useStore();
  const projectId = currentProject?.id;

  // Data
  const [towers, setTowers] = useState<Tower[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);

  // Selection
  const [selectedTowerId, setSelectedTowerId] = useState<string | null>(null);
  const [selectedFloorId, setSelectedFloorId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // Unit progress cache (floorId → units with progressPercent)
  const [floorUnitsCache, setFloorUnitsCache] = useState<Record<string, Unit[]>>({});

  // Loading states
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingFloors, setLoadingFloors] = useState(false);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);
  const [saving, setSaving] = useState(false);

  // Activity entries (editable state for right panel)
  const [entries, setEntries] = useState<ActivityEntry[]>([]);

  // ── Load towers + activity types ─────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    setLoadingTowers(true);
    Promise.all([
      towersApi.list(projectId),
      activityTypesApi.list(projectId),
    ])
      .then(([t, at]) => {
        setTowers(t);
        setActivityTypes(at);
        if (t.length > 0) setSelectedTowerId(t[0].id);
      })
      .catch(() => {
        addToast({ type: 'error', title: 'Erro ao carregar dados', description: 'Não foi possível carregar as torres.' });
      })
      .finally(() => setLoadingTowers(false));
  }, [projectId]);

  // ── Load floors when tower changes ───────────────────────────────────────

  useEffect(() => {
    if (!projectId || !selectedTowerId) { setFloors([]); return; }
    setLoadingFloors(true);
    setSelectedFloorId(null);
    setFloorUnitsCache({});
    towersApi
      .listFloors(projectId, selectedTowerId)
      .then((f) => {
        setFloors(f);
        if (f.length > 0) setSelectedFloorId(f[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingFloors(false));
  }, [selectedTowerId, projectId]);

  // ── Load units when floor changes ────────────────────────────────────────

  useEffect(() => {
    if (!selectedFloorId) { setUnits([]); return; }
    setLoadingUnits(true);
    setSelectedUnitId(null);
    towersApi
      .listUnits(selectedFloorId)
      .then((u) => {
        setUnits(u);
        setFloorUnitsCache((prev) => ({ ...prev, [selectedFloorId]: u }));
      })
      .catch(() => {})
      .finally(() => setLoadingUnits(false));
  }, [selectedFloorId]);

  // ── Load measurements when unit changes ──────────────────────────────────

  const buildEntries = useCallback(
    (meas: Measurement[], types: ActivityType[]): ActivityEntry[] => {
      return types.map((at) => {
        const existing = meas.find((m) => m.activityTypeId === at.id);
        const percent = existing?.percentComplete ?? 0;
        const execQty = existing?.executedQty ?? 0;
        const totalQty = existing?.totalQty ?? at.defaultQuantity;
        const mode: 'PERCENT' | 'METRIC' = at.measurementMethod !== 'PERCENT' && totalQty > 0 ? 'METRIC' : 'PERCENT';
        const computed =
          mode === 'METRIC' ? calcFromMetric(execQty, totalQty) : percent;
        return {
          activityTypeId: at.id,
          name: at.name,
          measurementMethod: at.measurementMethod as 'PERCENT' | 'METRIC' | 'COUNT',
          unit: at.unit,
          defaultQuantity: at.defaultQuantity,
          mode,
          percentValue: percent,
          executedQty: execQty,
          totalQty,
          computed,
          isDirty: false,
        };
      });
    },
    [],
  );

  useEffect(() => {
    if (!selectedUnitId) { setEntries([]); return; }
    setLoadingMeasurements(true);
    measurementsApi
      .list(selectedUnitId)
      .then((meas) => {
        setMeasurements(meas);
        setEntries(buildEntries(meas, activityTypes));
      })
      .catch(() => {
        setEntries(buildEntries([], activityTypes));
      })
      .finally(() => setLoadingMeasurements(false));
  }, [selectedUnitId, activityTypes, buildEntries]);

  // ── Computed overall progress ─────────────────────────────────────────────

  const overallProgress = useMemo(() => calcOverallProgress(entries), [entries]);

  const selectedUnit = useMemo(
    () => units.find((u) => u.id === selectedUnitId) ?? null,
    [units, selectedUnitId],
  );

  const selectedFloor = useMemo(
    () => floors.find((f) => f.id === selectedFloorId) ?? null,
    [floors, selectedFloorId],
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleEntryChange(idx: number, updated: Partial<ActivityEntry>) {
    setEntries((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...updated };
      return next;
    });
  }

  function handleMarkDone(idx: number) {
    handleEntryChange(idx, { computed: 100, percentValue: 100, isDirty: true });
  }

  function handleAllDone() {
    setEntries((prev) =>
      prev.map((e) => ({ ...e, computed: 100, percentValue: 100, isDirty: true })),
    );
  }

  async function handleSave() {
    if (!selectedUnitId) return;
    const dirty = entries.filter((e) => e.isDirty);
    if (dirty.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(
        dirty.map((e) =>
          measurementsApi.create(selectedUnitId, {
            activityTypeId: e.activityTypeId,
            percentComplete: e.computed,
            executedQty: e.mode === 'METRIC' ? e.executedQty : undefined,
            totalQty: e.mode === 'METRIC' ? e.totalQty : undefined,
          }),
        ),
      );
      setEntries((prev) => prev.map((e) => ({ ...e, isDirty: false })));
      // Update unit progress in cache
      setFloorUnitsCache((prev) => {
        if (!selectedFloorId) return prev;
        const floorUnits = (prev[selectedFloorId] ?? []).map((u) =>
          u.id === selectedUnitId ? { ...u, progressPercent: overallProgress } : u,
        );
        return { ...prev, [selectedFloorId]: floorUnits };
      });
      addToast({ type: 'success', title: 'Salvo com sucesso', description: `Medição da unidade salva.` });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar', description: 'Tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  // ── No project guard ──────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <AlertTriangle className="h-14 w-14 text-muted-foreground/40" />
        <div>
          <h2 className="text-xl font-semibold text-foreground mb-1">Selecione um projeto</h2>
          <p className="text-muted-foreground text-sm">
            Escolha um projeto no seletor acima para registrar medições.
          </p>
        </div>
      </div>
    );
  }

  // ── Layout ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">
      {/* ── Panel 1: Building SVG ── */}
      <div className="w-[260px] shrink-0 flex flex-col border-r border-border bg-background overflow-y-auto p-4 gap-4">
        <h2 className="text-base font-bold text-foreground">Medição</h2>

        {/* Tower selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Torre</label>
          {loadingTowers ? (
            <div className="h-9 bg-muted animate-pulse rounded-md" />
          ) : (
            <select
              value={selectedTowerId ?? ''}
              onChange={(e) => setSelectedTowerId(e.target.value || null)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Selecione a torre</option>
              {towers.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Building SVG */}
        {loadingFloors ? (
          <div className="h-48 bg-muted animate-pulse rounded-md" />
        ) : floors.length > 0 ? (
          <BuildingPanel
            floors={floors}
            units={floorUnitsCache}
            selectedFloorId={selectedFloorId}
            onSelectFloor={setSelectedFloorId}
          />
        ) : (
          <div className="h-32 flex items-center justify-center text-sm text-muted-foreground border border-dashed border-border rounded-md">
            Nenhum andar
          </div>
        )}

        {/* Floor selector */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Andar</label>
          <select
            value={selectedFloorId ?? ''}
            onChange={(e) => setSelectedFloorId(e.target.value || null)}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            disabled={floors.length === 0}
          >
            <option value="">Selecione o andar</option>
            {floors.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Progress summary */}
        {selectedFloor && (
          <div className="text-xs text-muted-foreground border-t pt-3 space-y-1">
            <p className="font-medium text-foreground">{selectedFloor.name}</p>
            <p>{units.length} unidades</p>
            <p>
              {units.filter((u) => (u.progressPercent ?? 0) === 100).length} concluídas
            </p>
          </div>
        )}
      </div>

      {/* ── Panel 2: Unit Grid ── */}
      <div className="w-[260px] shrink-0 flex flex-col border-r border-border bg-slate-50 overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-background shrink-0">
          <p className="text-sm font-semibold text-foreground">Unidades</p>
          {selectedFloor && (
            <p className="text-xs text-muted-foreground">{selectedFloor.name}</p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {loadingUnits ? (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : units.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-sm text-muted-foreground">
              <ChevronRight className="h-8 w-8 opacity-30" />
              <p>Selecione um andar</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {units.map((unit) => {
                const p = unit.progressPercent ?? 0;
                const isSelected = unit.id === selectedUnitId;
                return (
                  <button
                    key={unit.id}
                    onClick={() => setSelectedUnitId(unit.id)}
                    className={`rounded-lg border p-3 text-left transition-all hover:shadow-sm ${unitBgClass(p)} ${isSelected ? 'ring-2 ring-primary ring-offset-1' : ''}`}
                  >
                    <p className="text-xs font-semibold text-foreground truncate">{unit.name}</p>
                    <p className="text-lg font-bold mt-0.5" style={{ color: progressColor(p) }}>
                      {p.toFixed(0)}%
                    </p>
                    <div className="w-full bg-white/60 rounded-full h-1 mt-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${p}%`, backgroundColor: progressColor(p) }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Panel 3: Activity Details ── */}
      <div className="flex-1 flex flex-col bg-background overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-border shrink-0 flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold text-foreground">
              {selectedUnit ? selectedUnit.name : 'Selecione uma unidade'}
            </p>
            {selectedUnit && (
              <div className="flex items-center gap-2 mt-0.5">
                <div
                  className="text-sm font-semibold"
                  style={{ color: progressColor(overallProgress) }}
                >
                  {overallProgress}% concluído
                </div>
                <div className="flex-1 max-w-[160px] bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${overallProgress}%`, backgroundColor: progressColor(overallProgress) }}
                  />
                </div>
              </div>
            )}
          </div>

          {selectedUnit && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAllDone}
                className="gap-1"
                disabled={saving}
              >
                <Check className="h-3.5 w-3.5" />
                Tudo Concluído
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || entries.every((e) => !e.isDirty)}
                className="gap-1"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Salvar
              </Button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {!selectedUnitId ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <ChevronRight className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground text-sm">
                Selecione uma unidade para registrar medições
              </p>
            </div>
          ) : loadingMeasurements ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-sm text-muted-foreground">
              <AlertTriangle className="h-8 w-8 opacity-30" />
              <p>Nenhum tipo de atividade cadastrado para este projeto.</p>
            </div>
          ) : (
            <div className="space-y-3 max-w-2xl">
              {entries.map((entry, idx) => (
                <ActivityRow
                  key={entry.activityTypeId}
                  entry={entry}
                  onChange={(updated) => handleEntryChange(idx, updated)}
                  onMarkDone={() => handleMarkDone(idx)}
                />
              ))}

              {/* Footer save button for convenience */}
              <div className="pt-4 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={handleAllDone}
                  disabled={saving}
                  className="gap-1"
                >
                  <Check className="h-4 w-4" />
                  Tudo Concluído
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || entries.every((e) => !e.isDirty)}
                  className="gap-1"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Salvar Medição
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
