import { Suspense, useMemo, useState, useEffect, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { Tower, Floor, Unit } from '@/types';
import ProceduralBuilding, { type SiteworkInfo, FLOOR_HEIGHT, TOWER_SPACING, stackExtentAll } from './ProceduralBuilding';
import ViewerLegend from './ViewerLegend';

const IfcModel = lazy(() => import('./IfcModel'));

export interface BuildingViewer3DProps {
  mode: 'procedural' | 'ifc';
  ifcUrl?: string | null;
  towers: Tower[];
  floors: Floor[];
  unitsByFloor: Record<string, Unit[]>;
  unitProgress: Record<string, number>;
  floorProgress: Record<string, number>;
  towerProgress: Record<string, number>;
  selection: {
    towerId: string | null;
    floorId: string | null;
    unitId: string | null;
  };
  /** Pavimento sob hover no painel direito — realçado no 3D (sync). */
  hoveredFloorId?: string | null;
  filterPredicate?: (unit: Unit) => boolean;
  onSelectTower: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onSelectUnit: (id: string) => void;
  height?: number | string;
  sitework?: SiteworkInfo | null;
}

export default function BuildingViewer3D(props: BuildingViewer3DProps) {
  const {
    mode,
    ifcUrl,
    towers,
    floors,
    unitsByFloor,
    unitProgress,
    floorProgress,
    towerProgress,
    selection,
    hoveredFloorId,
    filterPredicate,
    onSelectTower,
    onSelectFloor,
    onSelectUnit,
    height = '100%',
    sitework,
  } = props;

  // Enquadramento: alvo no centro do edifício e distância p/ preencher ~80% do viewport.
  const { cameraTarget, cameraPosition, minDistance, maxDistance, fogNear, fogFar } = useMemo(() => {
    // Extensão vertical pela pilha CONTÍGUA (espelha o render) — imune a saltos de "level".
    const { minStack, maxStack } = stackExtentAll(floors);
    const buildingH = Math.max((maxStack - minStack + 1) * FLOOR_HEIGHT, FLOOR_HEIGHT);
    const buildingW = Math.max(towers.length, 1) * TOWER_SPACING + (sitework ? 12 : 0);
    const midY = ((minStack + maxStack) / 2) * FLOOR_HEIGHT + FLOOR_HEIGHT / 2;
    const maxDim = Math.max(buildingW, buildingH, 12);

    // Distância que enquadra tanto a altura quanto a largura, com margem (~82% de preenchimento).
    const fovRad = (42 * Math.PI) / 180;
    const t = Math.tan(fovRad / 2);
    const aspect = 1.4; // coluna do viewer é mais larga que alta
    const vFit = buildingH / 2 / t;
    const hFit = buildingW / 2 / (t * aspect);
    const dist = Math.max(vFit, hFit, 14) * 1.12;

    // Câmera orbita o centro do edifício (target + direção * distância).
    const dir = new THREE.Vector3(0.85, 0.55, 1).normalize();
    return {
      cameraTarget: [0, midY, 0] as [number, number, number],
      cameraPosition: [
        dir.x * dist + (sitework ? 3 : 0),
        midY + dir.y * dist,
        dir.z * dist,
      ] as [number, number, number],
      minDistance: Math.max(dist * 0.35, 8),
      maxDistance: dist * 3,
      fogNear: dist + maxDim * 0.4,
      fogFar: dist + maxDim * 2.4,
    };
  }, [floors, towers.length, sitework]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        minHeight: 460,
        background: 'linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 100%)',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--bd)',
      }}
    >
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: false }}>
        <color attach="background" args={['transparent']} />
        <fog attach="fog" args={['#EFF6FF', fogNear, fogFar]} />
        <PerspectiveCamera makeDefault position={cameraPosition} fov={42} near={0.1} far={2000} />
        <OrbitControls
          target={cameraTarget}
          enableDamping
          dampingFactor={0.08}
          minDistance={minDistance}
          maxDistance={maxDistance}
          maxPolarAngle={Math.PI / 2.1}
        />
        <hemisphereLight args={[new THREE.Color('#ffffff'), new THREE.Color('#cbd5e1'), 0.55]} />
        <directionalLight
          castShadow
          position={[20, 30, 20]}
          intensity={0.95}
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <Suspense fallback={null}>
          <Environment preset="city" />
        </Suspense>
        <Grid
          args={[80, 80]}
          cellSize={2}
          cellThickness={0.5}
          cellColor="#cbd5e1"
          sectionSize={10}
          sectionColor="#94a3b8"
          fadeDistance={90}
          fadeStrength={1}
          infiniteGrid
        />
        <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={60} blur={2.5} far={20} />

        {mode === 'ifc' && ifcUrl ? (
          <Suspense fallback={null}>
            <IfcModel
              url={ifcUrl}
              unitProgress={unitProgress}
              onSelectUnit={onSelectUnit}
              selectedUnitId={selection.unitId}
            />
          </Suspense>
        ) : (
          <ProceduralBuilding
            towers={towers}
            floors={floors}
            unitsByFloor={unitsByFloor}
            progress={{ unitProgress, floorProgress, towerProgress }}
            selection={selection}
            hoveredFloorId={hoveredFloorId}
            filterPredicate={filterPredicate}
            onSelectTower={onSelectTower}
            onSelectFloor={onSelectFloor}
            onSelectUnit={onSelectUnit}
            sitework={sitework}
          />
        )}
      </Canvas>

      <ViewerLegend />
      <ModeBadge mode={mode} hasIfc={!!ifcUrl} />
    </div>
  );
}

function ModeBadge({ mode, hasIfc }: { mode: 'procedural' | 'ifc'; hasIfc: boolean }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(t);
  }, [mode]);
  if (!visible) return null;
  const label =
    mode === 'ifc' && hasIfc
      ? '🏗️ Modelo IFC carregado'
      : mode === 'ifc'
        ? '⚠️ IFC ausente — usando procedural'
        : '🧱 Modelo procedural (gerado da EAP)';
  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        background: 'rgba(15,23,42,0.85)',
        color: '#fff',
        padding: '6px 12px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 500,
        zIndex: 5,
      }}
    >
      {label}
    </div>
  );
}
