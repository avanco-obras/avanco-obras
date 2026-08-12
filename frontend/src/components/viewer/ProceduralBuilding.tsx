import { useMemo, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Tower, Floor, Unit } from '@/types';
import { heatmapColor3D } from '@/lib/measurement-helpers';

export const TOWER_SPACING = 18;
export const FLOOR_HEIGHT = 3;
const TOWER_FOOTPRINT = { x: 12, z: 10 };

/**
 * Empilhamento CONTÍGUO dos pavimentos (na ordem da EAP), sem vãos entre eles.
 * Usa a sequência dos níveis — não o valor absoluto — para que um "level" com salto
 * (ex.: cobertura=20 num prédio de 8 pavtos) não crie um espaço enorme. Subsolos
 * (level < 0) ficam abaixo do plano (y negativo); Térreo/primeiro nível ≥ 0 na base.
 */
export function towerStack(towerFloors: Floor[]): {
  yById: Map<string, number>;
  minStack: number;
  maxStack: number;
} {
  const sorted = [...towerFloors].sort((a, b) => a.level - b.level);
  const groundCount = sorted.filter((f) => f.level < 0).length;
  const yById = new Map<string, number>();
  sorted.forEach((f, i) => {
    const stackPos = i - groundCount;
    yById.set(f.id, stackPos * FLOOR_HEIGHT + FLOOR_HEIGHT / 2);
  });
  return { yById, minStack: -groundCount, maxStack: sorted.length - 1 - groundCount };
}

/** Extensão vertical (em posições de pilha) considerando todas as torres. */
export function stackExtentAll(floors: Floor[]): { minStack: number; maxStack: number } {
  const byTower = new Map<string, Floor[]>();
  for (const f of floors) {
    const a = byTower.get(f.towerId);
    if (a) a.push(f); else byTower.set(f.towerId, [f]);
  }
  let minStack = 0, maxStack = 0;
  for (const arr of byTower.values()) {
    const s = towerStack(arr);
    minStack = Math.min(minStack, s.minStack);
    maxStack = Math.max(maxStack, s.maxStack);
  }
  return { minStack, maxStack };
}

interface ProgressMaps {
  /** Average progress percent per unit (0-100). */
  unitProgress: Record<string, number>;
  /** Average progress percent per floor (0-100). */
  floorProgress: Record<string, number>;
  /** Average progress percent per tower (0-100). */
  towerProgress: Record<string, number>;
}

interface Selection {
  towerId: string | null;
  floorId: string | null;
  unitId: string | null;
}

/** Canteiro de obras: agrupa atividades sem local (Mobilização, Entrega, etc.). */
export interface SiteworkInfo {
  progress: number;
  count: number;
  selected: boolean;
  onSelect: () => void;
}

interface ProceduralBuildingProps {
  towers: Tower[];
  floors: Floor[];
  unitsByFloor: Record<string, Unit[]>;
  progress: ProgressMaps;
  selection: Selection;
  /** Pavimento sob hover no painel direito — realçado (sync com a lista). */
  hoveredFloorId?: string | null;
  filterPredicate?: (unit: Unit) => boolean;
  onSelectTower: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onSelectUnit: (id: string) => void;
  sitework?: SiteworkInfo | null;
}

export default function ProceduralBuilding({
  towers,
  floors,
  unitsByFloor,
  progress,
  selection,
  hoveredFloorId,
  filterPredicate,
  onSelectTower,
  onSelectFloor,
  onSelectUnit,
  sitework,
}: ProceduralBuildingProps) {
  const totalWidth = useMemo(() => towers.length * TOWER_SPACING, [towers.length]);
  const offsetX = -totalWidth / 2 + TOWER_SPACING / 2;
  const siteX = totalWidth / 2 + 6;

  return (
    <group>
      {towers.map((tower, tIdx) => {
        const towerFloors = floors
          .filter((f) => f.towerId === tower.id)
          .sort((a, b) => a.level - b.level);
        const baseX = offsetX + tIdx * TOWER_SPACING;
        // Posições contíguas (sem vãos): a cobertura fica logo acima do último pavto.
        const { yById, maxStack } = towerStack(towerFloors);
        return (
          <group key={tower.id} position={[baseX, 0, 0]}>
            <TowerLabel name={tower.name} y={(maxStack + 1) * FLOOR_HEIGHT + 1.5} />
            {towerFloors.map((floor) => {
              const isFloorSelected = selection.floorId === floor.id;
              const isFloorHovered = hoveredFloorId === floor.id;
              const showUnits = isFloorSelected;
              const units = unitsByFloor[floor.id] ?? [];
              const y = yById.get(floor.id) ?? FLOOR_HEIGHT / 2;
              return (
                <group key={floor.id} position={[0, y, 0]}>
                  {showUnits && units.length > 0 ? (
                    <UnitsGrid
                      units={units}
                      unitProgress={progress.unitProgress}
                      selectedUnitId={selection.unitId}
                      filterPredicate={filterPredicate}
                      onSelect={onSelectUnit}
                    />
                  ) : (
                    <FloorBlock
                      progress={progress.floorProgress[floor.id] ?? 0}
                      selected={isFloorSelected}
                      hovered={isFloorHovered}
                      onSelect={(e) => {
                        e.stopPropagation();
                        onSelectTower(tower.id);
                        onSelectFloor(floor.id);
                      }}
                    />
                  )}
                  <FloorLabel name={floor.name} progress={progress.floorProgress[floor.id] ?? 0} />
                </group>
              );
            })}
          </group>
        );
      })}
      {sitework && (
        <SiteContainer
          x={siteX}
          progress={sitework.progress}
          count={sitework.count}
          selected={sitework.selected}
          onSelect={sitework.onSelect}
        />
      )}
      <Ground width={Math.max(totalWidth + (sitework ? 24 : 12), 30)} />
    </group>
  );
}

/** Container/canteiro de obra ao lado do empreendimento (atividades sem local). */
function SiteContainer({
  x,
  progress,
  count,
  selected,
  onSelect,
}: {
  x: number;
  progress: number;
  count: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const color = heatmapColor3D(progress);
  const W = 6, H = 2.6, D = 3;
  return (
    <group position={[x, 0, 0]}>
      {/* corpo do container */}
      <mesh
        castShadow
        receiveShadow
        position={[0, H / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'default'; }}
      >
        <boxGeometry args={[W, H, D]} />
        <meshStandardMaterial
          color={color}
          roughness={0.7}
          metalness={0.25}
          emissive={selected ? new THREE.Color('#1B6FE8') : new THREE.Color('#000000')}
          emissiveIntensity={selected ? 0.4 : 0}
        />
      </mesh>
      {/* nervuras do container (faixas) */}
      <mesh position={[0, H / 2, D / 2 + 0.01]}>
        <planeGeometry args={[W * 0.96, H * 0.9]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.06} />
      </mesh>
      <group position={[0, H + 0.6, 0]}>
        <TextLabel text={`Canteiro de Obras • ${Math.round(progress)}%`} fontSize={0.42} color="#0F172A" />
      </group>
      <group position={[0, H + 1.4, 0]}>
        <TextLabel text={`${count} atividade(s) sem local`} fontSize={0.3} color="#64748B" />
      </group>
    </group>
  );
}

function Ground({ width }: { width: number }) {
  return (
    <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[width, 30]} />
      <meshStandardMaterial color="#E5E7EB" roughness={1} />
    </mesh>
  );
}

function FloorBlock({
  progress,
  selected,
  hovered,
  onSelect,
}: {
  progress: number;
  selected: boolean;
  hovered: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const color = heatmapColor3D(progress);
  const emphasis = selected || hovered;
  return (
    <mesh
      castShadow
      receiveShadow
      onClick={onSelect}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <boxGeometry args={[TOWER_FOOTPRINT.x, FLOOR_HEIGHT * 0.95, TOWER_FOOTPRINT.z]} />
      <meshStandardMaterial
        color={color}
        roughness={0.6}
        metalness={0.1}
        emissive={emphasis ? new THREE.Color('#1B6FE8') : new THREE.Color('#000000')}
        emissiveIntensity={selected ? 0.28 : hovered ? 0.16 : 0}
      />
    </mesh>
  );
}

function UnitsGrid({
  units,
  unitProgress,
  selectedUnitId,
  filterPredicate,
  onSelect,
}: {
  units: Unit[];
  unitProgress: Record<string, number>;
  selectedUnitId: string | null;
  filterPredicate?: (unit: Unit) => boolean;
  onSelect: (id: string) => void;
}) {
  const cols = Math.ceil(Math.sqrt(units.length));
  const rows = Math.ceil(units.length / cols);
  const cellW = TOWER_FOOTPRINT.x / cols;
  const cellD = TOWER_FOOTPRINT.z / rows;
  const gap = 0.15;

  return (
    <group>
      {units.map((unit, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = -TOWER_FOOTPRINT.x / 2 + cellW / 2 + col * cellW;
        const z = -TOWER_FOOTPRINT.z / 2 + cellD / 2 + row * cellD;
        const p = unitProgress[unit.id] ?? 0;
        const matches = filterPredicate ? filterPredicate(unit) : true;
        const isSelected = selectedUnitId === unit.id;
        return (
          <UnitBox
            key={unit.id}
            position={[x, 0, z]}
            size={[cellW - gap, FLOOR_HEIGHT * 0.92, cellD - gap]}
            progress={p}
            matchesFilter={matches}
            selected={isSelected}
            onSelect={(e) => {
              e.stopPropagation();
              onSelect(unit.id);
            }}
          />
        );
      })}
    </group>
  );
}

function UnitBox({
  position,
  size,
  progress,
  matchesFilter,
  selected,
  onSelect,
}: {
  position: [number, number, number];
  size: [number, number, number];
  progress: number;
  matchesFilter: boolean;
  selected: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = matchesFilter ? heatmapColor3D(progress) : '#CBD5E1';
  return (
    <mesh
      ref={meshRef}
      castShadow
      receiveShadow
      position={position}
      onClick={onSelect}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        transparent={!matchesFilter}
        opacity={matchesFilter ? 1 : 0.35}
        roughness={0.55}
        metalness={0.15}
        emissive={selected ? new THREE.Color('#1B6FE8') : new THREE.Color('#000000')}
        emissiveIntensity={selected ? 0.45 : 0}
      />
    </mesh>
  );
}

function TowerLabel({ name, y }: { name: string; y: number }) {
  // simple html-less label using sprite-like billboard
  return (
    <group position={[0, y, 0]}>
      <mesh>
        <planeGeometry args={[5, 1]} />
        <meshBasicMaterial color="#1B6FE8" transparent opacity={0} />
      </mesh>
      <TextLabel text={name} fontSize={0.6} color="#1B6FE8" />
    </group>
  );
}

function FloorLabel({ name, progress }: { name: string; progress: number }) {
  return (
    <group position={[TOWER_FOOTPRINT.x / 2 + 0.5, 0, 0]}>
      <TextLabel text={`${name} • ${Math.round(progress)}%`} fontSize={0.35} color="#0F172A" anchor="left" />
    </group>
  );
}

/** Minimal "billboard" text via canvas texture; avoids needing fonts asset. */
function TextLabel({
  text,
  fontSize = 0.5,
  color = '#0F172A',
  anchor = 'center',
}: {
  text: string;
  fontSize?: number;
  color?: string;
  anchor?: 'center' | 'left';
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    const dpr = 2;
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.font = '600 36px Inter, system-ui, sans-serif';
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = anchor === 'left' ? 'left' : 'center';
    ctx.fillText(text, anchor === 'left' ? 8 : 256 / 2, 64 / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }, [text, color, anchor]);

  return (
    <sprite scale={[fontSize * 8, fontSize * 2, 1]}>
      <spriteMaterial map={texture} transparent depthTest={false} />
    </sprite>
  );
}
