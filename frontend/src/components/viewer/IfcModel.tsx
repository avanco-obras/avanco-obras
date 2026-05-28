import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { heatmapColor3D } from '@/lib/measurement-helpers';

interface IfcModelProps {
  url: string;
  unitProgress: Record<string, number>;
  selectedUnitId: string | null;
  transparency: boolean;
  onSelectUnit: (id: string) => void;
}

interface IfcLoadState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  message?: string;
  mesh?: THREE.Object3D;
}

/**
 * Carrega um IFC client-side via web-ifc. WASM é importado dinamicamente para
 * não inflar o bundle inicial. O modelo é exibido apenas como geometria — o
 * mapeamento IfcSpace ↔ Unit é heurístico (por nome) e fica como melhoria futura.
 */
export default function IfcModel({
  url,
  transparency,
}: IfcModelProps) {
  const [state, setState] = useState<IfcLoadState>({ status: 'idle' });

  useEffect(() => {
    let cancelled = false;
    let scene: THREE.Object3D | null = null;

    async function load() {
      setState({ status: 'loading', message: 'Baixando IFC...' });
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = new Uint8Array(await res.arrayBuffer());
        if (cancelled) return;

        setState({ status: 'loading', message: 'Carregando WASM web-ifc...' });
        const webIfcMod = await import('web-ifc');
        const IfcAPI = (webIfcMod as { IfcAPI: new () => unknown }).IfcAPI;
        const api = new IfcAPI() as {
          SetWasmPath: (path: string) => void;
          Init: () => Promise<void>;
          OpenModel: (data: Uint8Array) => number;
          CloseModel: (modelId: number) => void;
          GetGeometry: (modelId: number, geomId: number) => { GetVertexData: () => number; GetVertexDataSize: () => number; GetIndexData: () => number; GetIndexDataSize: () => number };
          GetVertexArray: (ptr: number, size: number) => Float32Array;
          GetIndexArray: (ptr: number, size: number) => Uint32Array;
          StreamAllMeshes: (modelId: number, cb: (mesh: { geometries: { size: () => number; get: (i: number) => { geometryExpressID: number; color: { x: number; y: number; z: number; w: number }; flatTransformation: number[] } } }) => void) => void;
        };
        api.SetWasmPath('https://unpkg.com/web-ifc@0.0.55/');
        await api.Init();

        if (cancelled) return;
        setState({ status: 'loading', message: 'Parsando geometria IFC...' });
        const modelId = api.OpenModel(buf);

        const group = new THREE.Group();
        group.name = 'IfcModel';

        api.StreamAllMeshes(modelId, (mesh) => {
          const geomSize = mesh.geometries.size();
          for (let i = 0; i < geomSize; i++) {
            const placedGeom = mesh.geometries.get(i);
            const geometry = api.GetGeometry(modelId, placedGeom.geometryExpressID);
            const vertsPtr = geometry.GetVertexData();
            const vertsSize = geometry.GetVertexDataSize();
            const indicesPtr = geometry.GetIndexData();
            const indicesSize = geometry.GetIndexDataSize();
            const verts = api.GetVertexArray(vertsPtr, vertsSize);
            const indices = api.GetIndexArray(indicesPtr, indicesSize);

            // verts: x,y,z,nx,ny,nz repeating
            const positions = new Float32Array(verts.length / 2);
            const normals = new Float32Array(verts.length / 2);
            for (let v = 0, p = 0; v < verts.length; v += 6, p += 3) {
              positions[p] = verts[v];
              positions[p + 1] = verts[v + 1];
              positions[p + 2] = verts[v + 2];
              normals[p] = verts[v + 3];
              normals[p + 1] = verts[v + 4];
              normals[p + 2] = verts[v + 5];
            }

            const buffGeom = new THREE.BufferGeometry();
            buffGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            buffGeom.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            buffGeom.setIndex(new THREE.BufferAttribute(indices, 1));

            const color = new THREE.Color(
              placedGeom.color.x,
              placedGeom.color.y,
              placedGeom.color.z,
            );
            const alpha = placedGeom.color.w;
            const material = new THREE.MeshStandardMaterial({
              color,
              transparent: transparency || alpha < 1,
              opacity: transparency ? Math.min(0.55, alpha) : alpha,
              roughness: 0.7,
              metalness: 0.1,
            });

            const m = new THREE.Mesh(buffGeom, material);
            const t = placedGeom.flatTransformation;
            const matrix = new THREE.Matrix4();
            matrix.fromArray(t);
            m.applyMatrix4(matrix);
            m.castShadow = true;
            m.receiveShadow = true;
            group.add(m);
          }
        });

        api.CloseModel(modelId);

        if (cancelled) {
          group.traverse((o) => {
            if ((o as THREE.Mesh).geometry) (o as THREE.Mesh).geometry.dispose();
          });
          return;
        }

        // Re-center model
        const box = new THREE.Box3().setFromObject(group);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        group.position.sub(center);
        group.position.y += size.y / 2;
        // simple coloring via progress is left to future ambient post-processing

        scene = group;
        setState({ status: 'ready', mesh: group });
      } catch (err) {
        if (cancelled) return;
        setState({ status: 'error', message: (err as Error).message });
      }
    }

    void load();

    return () => {
      cancelled = true;
      if (scene) {
        scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.geometry) mesh.geometry.dispose();
          if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => m.dispose());
          }
        });
      }
    };
  }, [url, transparency]);

  if (state.status === 'loading' || state.status === 'idle') {
    return (
      <Html center>
        <div
          style={{
            background: 'rgba(15,23,42,0.85)',
            color: '#fff',
            padding: '12px 18px',
            borderRadius: 10,
            fontSize: 13,
            fontFamily: 'Inter, system-ui, sans-serif',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          {state.message ?? 'Carregando IFC...'}
        </div>
      </Html>
    );
  }

  if (state.status === 'error') {
    return (
      <Html center>
        <div
          style={{
            background: '#FEF2F2',
            color: '#991B1B',
            padding: '12px 18px',
            borderRadius: 10,
            fontSize: 12,
            border: '1px solid #FCA5A5',
            maxWidth: 320,
            textAlign: 'center',
          }}
        >
          Falha ao carregar IFC: {state.message}
        </div>
      </Html>
    );
  }

  if (!state.mesh) return null;
  return <primitive object={state.mesh} />;
}
