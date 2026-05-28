import { Suspense, useMemo, useState, useEffect, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows, Grid } from '@react-three/drei';
import * as THREE from 'three';
import type { Tower, Floor, Unit } from '@/types';
import ProceduralBuilding from './ProceduralBuilding';
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
  filterPredicate?: (unit: Unit) => boolean;
  onSelectTower: (id: string) => void;
  onSelectFloor: (id: string) => void;
  onSelectUnit: (id: string) => void;
  height?: number | string;
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
    filterPredicate,
    onSelectTower,
    onSelectFloor,
    onSelectUnit,
    height = 460,
  } = props;

  const [explode, setExplode] = useState(0);
  const [transparency, setTransparency] = useState(false);

  // Camera target — frame the towers
  const cameraTarget = useMemo<[number, number, number]>(() => [0, 8, 0], []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: 'linear-gradient(180deg, #EFF6FF 0%, #F8FAFC 100%)',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--bd)',
      }}
    >
      <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, preserveDrawingBuffer: false }}>
        <color attach="background" args={['transparent']} />
        <fog attach="fog" args={['#EFF6FF', 30, 90]} />
        <PerspectiveCamera makeDefault position={[30, 22, 30]} fov={42} near={0.1} far={500} />
        <OrbitControls
          target={cameraTarget}
          enableDamping
          dampingFactor={0.08}
          minDistance={8}
          maxDistance={120}
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
          fadeDistance={70}
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
              transparency={transparency}
            />
          </Suspense>
        ) : (
          <ProceduralBuilding
            towers={towers}
            floors={floors}
            unitsByFloor={unitsByFloor}
            progress={{ unitProgress, floorProgress, towerProgress }}
            selection={selection}
            filterPredicate={filterPredicate}
            explodeFactor={explode}
            transparency={transparency}
            onSelectTower={onSelectTower}
            onSelectFloor={onSelectFloor}
            onSelectUnit={onSelectUnit}
          />
        )}
      </Canvas>

      {/* Floating controls */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(8px)',
          padding: '10px 12px',
          borderRadius: 10,
          boxShadow: '0 2px 12px rgba(15,23,42,0.12)',
          fontSize: 11,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          minWidth: 180,
          border: '1px solid rgba(15,23,42,0.06)',
          zIndex: 5,
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 10, color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Visualização
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 10, color: '#475569' }}>Explosão (pavtos)</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={explode}
            onChange={(e) => setExplode(parseFloat(e.target.value))}
            disabled={mode === 'ifc'}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <input
            type="checkbox"
            checked={transparency}
            onChange={(e) => setTransparency(e.target.checked)}
          />
          Transparência
        </label>
      </div>
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
