import { useMemo, useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { Tower, Floor, Unit } from '@/types';
import { heatmapColor3D } from '@/lib/measurement-helpers';

const TOWER_SPACING = 18;
const FLOOR_HEIGHT = 3;
const TOWER_FOOTPRINT = { x: 12, z: 10 };

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

interface ProceduralBuildingProps {
  towers: Tower[];
  floors: Floor[];
  unitsByFloor: Record<string, Unit[]>;
  progress: ProgressMaps;
  selection: Selection;
  filterPredicate?: (unit: Unit) => boolean;
  explodeFactor: number; // 0..2
  transparency: boolean;
  onSelectTower: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onSelectUnit: (id: string) => void;
}

export default function ProceduralBuilding({
  towers,
  floors,
  unitsByFloor,
  progress,
  selection,
  filterPredicate,
  explodeFactor,
  transparency,
  onSelectTower,
  onSelectFloor,
  onSelectUnit,
}: ProceduralBuildingProps) {
  const totalWidth = useMemo(() => towers.length * TOWER_SPACING, [towers.length]);
  const offsetX = -totalWidth / 2 + TOWER_SPACING / 2;

  return (
    <group>
      {towers.map((tower, tIdx) => {
        const towerFloors = floors
          .filter((f) => f.towerId === tower.id)
          .sort((a, b) => a.level - b.level);
        const isTowerSelected = selection.towerId === tower.id;
        const baseX = offsetX + tIdx * TOWER_SPACING;
        return (
          <group key={tower.id} position={[baseX, 0, 0]}>
            <TowerLabel name={tower.name} y={towerFloors.length * FLOOR_HEIGHT + 1.5} />
            {towerFloors.map((floor, fIdx) => {
              const isFloorSelected = selection.floorId === floor.id;
              const showUnits = isFloorSelected;
              const units = unitsByFloor[floor.id] ?? [];
              const explode = isTowerSelected ? explodeFactor : 0;
              const y = fIdx * FLOOR_HEIGHT + fIdx * explode * 0.6 + FLOOR_HEIGHT / 2;
              return (
                <group key={floor.id} position={[0, y, 0]}>
                  {showUnits && units.length > 0 ? (
                    <UnitsGrid
                      units={units}
                      unitProgress={progress.unitProgress}
                      selectedUnitId={selection.unitId}
                      filterPredicate={filterPredicate}
                      transparency={transparency}
                      onSelect={onSelectUnit}
                    />
                  ) : (
                    <FloorBlock
                      progress={progress.floorProgress[floor.id] ?? 0}
                      selected={isFloorSelected}
                      transparency={transparency}
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
      <Ground width={Math.max(totalWidth + 12, 30)} />
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
  transparency,
  onSelect,
}: {
  progress: number;
  selected: boolean;
  transparency: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const color = heatmapColor3D(progress);
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
        transparent={transparency}
        opacity={transparency ? 0.55 : 1}
        roughness={0.6}
        metalness={0.1}
        emissive={selected ? new THREE.Color('#1B6FE8') : new THREE.Color('#000000')}
        emissiveIntensity={selected ? 0.25 : 0}
      />
    </mesh>
  );
}

function UnitsGrid({
  units,
  unitProgress,
  selectedUnitId,
  filterPredicate,
  transparency,
  onSelect,
}: {
  units: Unit[];
  unitProgress: Record<string, number>;
  selectedUnitId: string | null;
  filterPredicate?: (unit: Unit) => boolean;
  transparency: boolean;
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
            transparency={transparency}
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
  transparency,
  onSelect,
}: {
  position: [number, number, number];
  size: [number, number, number];
  progress: number;
  matchesFilter: boolean;
  selected: boolean;
  transparency: boolean;
  onSelect: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = matchesFilter ? heatmapColor3D(progress) : '#CBD5E1';
  const op = transparency ? 0.5 : matchesFilter ? 1 : 0.35;
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
        transparent={transparency || !matchesFilter}
        opacity={op}
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
