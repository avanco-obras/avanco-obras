import { useEffect, useState, useRef, useCallback } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { uploadsApi } from '@/services/api';
import { useStore } from '@/store';

/** Extrai a mensagem amigável vinda do backend (Nest) de um erro do axios. */
function friendlyError(err: unknown, fallback: string): string {
  const e = err as { response?: { data?: { message?: string | string[] } }; message?: string };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg.join(' • ');
  return msg || e?.message || fallback;
}

interface FloorPlanViewer2DProps {
  floorId: string | null;
  floorName?: string;
  projectId: string;
  height?: number | string;
  onUploaded?: () => void;
}

type Plan = Awaited<ReturnType<typeof uploadsApi.listFloorPlans>>[number];

export default function FloorPlanViewer2D({
  floorId,
  floorName,
  projectId,
  height = 460,
  onUploaded,
}: FloorPlanViewer2DProps) {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addToast = useStore((s) => s.addToast);

  const loadPlans = useCallback(async () => {
    if (!floorId) {
      setPlans([]);
      setActivePlan(null);
      return;
    }
    setLoading(true);
    try {
      const list = await uploadsApi.listFloorPlans(floorId);
      setPlans(list);
      setActivePlan(list[0] ?? null);
    } catch {
      setPlans([]);
      setActivePlan(null);
    } finally {
      setLoading(false);
    }
  }, [floorId]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !floorId) return;

    // Validação: exclusivamente PDF (por MIME e por extensão, para tolerar
    // navegadores que não preenchem o type).
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      addToast({
        type: 'error',
        title: 'Arquivo inválido',
        description: 'A planta deve ser um arquivo PDF. Selecione um .pdf e tente novamente.',
      });
      if (fileRef.current) fileRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      await uploadsApi.upload(projectId, form, { category: 'FLOOR_PLAN', floorId });
      addToast({ type: 'success', title: 'Planta enviada', description: file.name });
      await loadPlans();
      onUploaded?.();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Falha no upload',
        description: friendlyError(err, 'Não foi possível enviar a planta. Tente novamente.'),
      });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete() {
    if (!activePlan) return;
    if (!window.confirm(`Remover a planta "${activePlan.fileName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }
    setDeleting(true);
    try {
      await uploadsApi.delete(activePlan.id);
      addToast({ type: 'success', title: 'Planta removida', description: activePlan.fileName });
      await loadPlans();
      onUploaded?.();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Falha ao remover',
        description: friendlyError(err, 'Não foi possível remover a planta. Tente novamente.'),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        background: '#0F172A',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--bd)',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: 12,
          left: 12,
          right: 12,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 5,
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(255,255,255,0.92)',
            padding: '6px 12px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            color: '#0F172A',
            pointerEvents: 'auto',
          }}
        >
          {floorName ? `📐 ${floorName}` : '📐 Planta 2D'}
        </div>
        {floorId && (
          <div style={{ display: 'flex', gap: 6, pointerEvents: 'auto' }}>
            {plans.length > 1 && (
              <select
                value={activePlan?.id ?? ''}
                onChange={(e) =>
                  setActivePlan(plans.find((p) => p.id === e.target.value) ?? null)
                }
                style={{
                  fontSize: 11,
                  padding: '5px 8px',
                  borderRadius: 8,
                  border: '1px solid var(--bd)',
                  background: 'rgba(255,255,255,0.92)',
                }}
              >
                {plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fileName}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: '#1B6FE8',
                color: '#fff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                opacity: uploading ? 0.6 : 1,
              }}
            >
              <Upload size={12} /> {uploading ? 'Enviando...' : 'Subir planta'}
            </button>
            {activePlan && (
              <button
                onClick={handleDelete}
                disabled={deleting || uploading}
                title="Remover planta"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#fff',
                  color: '#DC2626',
                  border: '1px solid #FCA5A5',
                  padding: '6px 12px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  opacity: deleting || uploading ? 0.6 : 1,
                }}
              >
                <Trash2 size={12} /> {deleting ? 'Removendo...' : 'Remover'}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleUpload}
              style={{ display: 'none' }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      {!floorId ? (
        <EmptyState message="Selecione um pavimento para ver a planta." />
      ) : loading ? (
        <Centered message="Carregando plantas..." />
      ) : !activePlan ? (
        <EmptyState
          message={`Nenhuma planta carregada para ${floorName ?? 'este pavimento'}.`}
          subtext="Use o botão acima para enviar a planta em PDF."
        />
      ) : (
        <PlanCanvas plan={activePlan} />
      )}
    </div>
  );
}

function PlanCanvas({ plan }: { plan: Plan }) {
  const isPdf = plan.fileType?.includes('pdf') || plan.fileName.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    return (
      <object
        data={plan.url}
        type="application/pdf"
        style={{ width: '100%', height: '100%' }}
      >
        <iframe
          src={plan.url}
          style={{ width: '100%', height: '100%', border: 0 }}
          title={plan.fileName}
        />
      </object>
    );
  }

  return <PanZoomImage src={plan.url} alt={plan.fileName} />;
}

function PanZoomImage({ src, alt }: { src: string; alt: string }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: dragRef.current ? 'grabbing' : 'grab',
        background: '#0F172A',
      }}
      onWheel={(e) => {
        e.preventDefault();
        setScale((s) => Math.max(0.25, Math.min(6, s - e.deltaY * 0.002)));
      }}
      onPointerDown={(e) => {
        dragRef.current = { x: e.clientX, y: e.clientY, sx: offset.x, sy: offset.y };
      }}
      onPointerMove={(e) => {
        if (!dragRef.current) return;
        setOffset({
          x: dragRef.current.sx + (e.clientX - dragRef.current.x),
          y: dragRef.current.sy + (e.clientY - dragRef.current.y),
        });
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerLeave={() => {
        dragRef.current = null;
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          maxWidth: 'none',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          transformOrigin: 'center center',
          transition: dragRef.current ? 'none' : 'transform .15s',
          userSelect: 'none',
        }}
      />
    </div>
  );
}

function EmptyState({ message, subtext }: { message: string; subtext?: string }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#94A3B8',
        gap: 6,
        textAlign: 'center',
        padding: 16,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 500, color: '#CBD5E1' }}>{message}</div>
      {subtext && <div style={{ fontSize: 11 }}>{subtext}</div>}
    </div>
  );
}

function Centered({ message }: { message: string }) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#CBD5E1',
        fontSize: 12,
      }}
    >
      {message}
    </div>
  );
}
