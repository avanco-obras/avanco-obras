import { heatmapColor3D, LEGEND_ITEMS } from '@/lib/measurement-helpers';

export interface HeatCell {
  /** id do nó (pavimento ou unidade) no cronograma — usado p/ abrir atividades. */
  nodeId: string;
  label: string;
  progress: number;
}
export interface HeatRow {
  floorId: string;
  floorName: string;
  floorProgress: number;
  /** Células de unidade (Áreas comuns, Ap 1..N). Vazio → linha usa a própria célula do pavimento. */
  cells: HeatCell[];
}

export interface HeatmapMatrixProps {
  rows: HeatRow[];
  selectedFloorId: string | null;
  /** Clique numa célula de unidade → abre as atividades daquela unidade. */
  onSelectUnit: (floorId: string, nodeId: string) => void;
  /** Clique no rótulo/célula do pavimento → seleciona o pavimento. */
  onSelectFloor: (floorId: string) => void;
  onHoverFloor?: (floorId: string | null) => void;
  height?: number | string;
}

const LABEL_W = 116;

export default function HeatmapMatrix({
  rows, selectedFloorId, onSelectUnit, onSelectFloor, onHoverFloor, height = '100%',
}: HeatmapMatrixProps) {
  const maxCols = rows.reduce((m, r) => Math.max(m, r.cells.length), 0);

  return (
    <div
      style={{
        width: '100%', height, minHeight: 460, display: 'flex', flexDirection: 'column',
        background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 12, padding: 14, gap: 10,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Mapa de calor · pavimento × unidade
      </div>

      {rows.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 12 }}>
          Selecione uma torre com pavimentos para ver o mapa de calor.
        </div>
      ) : (
        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {rows.map((row) => {
            const isSel = row.floorId === selectedFloorId;
            return (
              <div
                key={row.floorId}
                onMouseEnter={() => onHoverFloor?.(row.floorId)}
                onMouseLeave={() => onHoverFloor?.(null)}
                style={{
                  display: 'flex', alignItems: 'stretch', gap: 4, borderRadius: 8,
                  outline: isSel ? '2px solid var(--blue)' : '2px solid transparent',
                  outlineOffset: 1,
                }}
              >
                {/* Rótulo do pavimento (clicável) */}
                <button
                  onClick={() => onSelectFloor(row.floorId)}
                  title={`${row.floorName} · ${Math.round(row.floorProgress)}%`}
                  style={{
                    width: LABEL_W, flexShrink: 0, textAlign: 'left', cursor: 'pointer',
                    border: 'none', background: 'transparent', color: isSel ? 'var(--blue)' : 'var(--t2)',
                    fontFamily: 'var(--font)', fontSize: 11, fontWeight: isSel ? 700 : 500,
                    padding: '0 8px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.floorName}</span>
                  <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--mono)' }}>{Math.round(row.floorProgress)}%</span>
                </button>

                {/* Células de unidade */}
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${Math.max(maxCols, 1)}, minmax(0, 1fr))`, gap: 4 }}>
                  {row.cells.length > 0 ? (
                    row.cells.map((cell) => <HeatCellView key={cell.nodeId} cell={cell} onClick={() => onSelectUnit(row.floorId, cell.nodeId)} />)
                  ) : (
                    <button
                      onClick={() => onSelectFloor(row.floorId)}
                      title={`${row.floorName} · ${Math.round(row.floorProgress)}%`}
                      style={{
                        gridColumn: `1 / span ${Math.max(maxCols, 1)}`, minHeight: 30, borderRadius: 6, cursor: 'pointer',
                        border: '1px solid rgba(15,23,42,0.06)', background: heatmapColor3D(row.floorProgress),
                        color: '#0F172A', fontSize: 10, fontWeight: 600, fontFamily: 'var(--font)',
                      }}
                    >
                      {Math.round(row.floorProgress)}%
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legenda de cores */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', paddingTop: 8, borderTop: '1px solid var(--bd)' }}>
        {LEGEND_ITEMS.map((it) => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--t2)' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: it.color, border: '1px solid rgba(15,23,42,0.12)' }} />
            {it.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeatCellView({ cell, onClick }: { cell: HeatCell; onClick: () => void }) {
  const color = heatmapColor3D(cell.progress);
  return (
    <button
      onClick={onClick}
      title={`${cell.label} · ${Math.round(cell.progress)}%`}
      style={{
        minHeight: 30, borderRadius: 6, cursor: 'pointer', border: '1px solid rgba(15,23,42,0.06)',
        background: color, color: '#0F172A', fontFamily: 'var(--font)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '2px 4px', overflow: 'hidden', transition: 'transform .1s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.04)'; e.currentTarget.style.zIndex = '2'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.zIndex = '1'; }}
    >
      <span style={{ fontSize: 9, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cell.label}</span>
      <span style={{ fontSize: 10, fontWeight: 700, fontFamily: 'var(--mono)' }}>{Math.round(cell.progress)}%</span>
    </button>
  );
}
