import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import { projectsApi, uploadsApi, aiImportApi, activityTypesApi, scheduleApi } from '@/services/api';
import {
  FileText,
  Box,
  Upload,
  Link,
  Bot,
  Save,
  Trash2,
  Plus,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { Project, Upload as UploadType, UserRole } from '@/types';

// ── AI Import types ────────────────────────────────────────────────

interface AiActivityType {
  name: string;
  unit: string;
  measurementMethod: 'PERCENT' | 'METRIC' | 'COUNT';
  weight: number;
}

interface AiScheduleItem {
  code: string;
  name: string;
  level: number;
  startDayOffset?: number;
  durationDays: number;
  weight: number;
  isCriticalPath: boolean;
  activityTypeName?: string | null;
  children?: AiScheduleItem[];
}

interface AiProjectInfo {
  name?: string;
  totalArea?: number;
  towers: number;
  floorsPerTower: number;
  unitsPerFloor: number;
  estimatedDurationMonths?: number;
  buildingType?: string;
}

interface AiImportResult {
  projectInfo: AiProjectInfo;
  activityTypes: AiActivityType[];
  schedule: AiScheduleItem[];
  rawAnalysis: string;
  confidence: 'high' | 'medium' | 'low';
}

// ── Form types ────────────────────────────────────────────────────────────────

interface ProjectFormData {
  name: string;
  company: string;
  address: string;
  status: Project['status'];
  startDate: string;
  endDate: string;
  estimatedCost: string;
  currency: string;
  totalArea: string;
  workdaysPerWeek: string;
  hoursPerDay: string;
  timezone: string;
  towers: string;
  floorsPerTower: string;
  unitsPerFloor: string;
  engineer: string;
  contact: string;
}

interface TeamMemberEntry {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

const DEFAULT_FORM: ProjectFormData = {
  name: '',
  company: '',
  address: '',
  status: 'PLANNING',
  startDate: '',
  endDate: '',
  estimatedCost: '',
  currency: 'BRL',
  totalArea: '',
  workdaysPerWeek: '5',
  hoursPerDay: '8',
  timezone: 'America/Sao_Paulo',
  towers: '',
  floorsPerTower: '',
  unitsPerFloor: '',
  engineer: '',
  contact: '',
};

const ROLE_OPTIONS: UserRole[] = ['ADMIN', 'ENGINEER', 'FOREMAN', 'VIEWER'];
const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  ENGINEER: 'Engenheiro',
  FOREMAN: 'Mestre / Encarregado',
  VIEWER: 'Visualizador',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function sketchfabEmbedUrl(url: string): string {
  const match = url.match(/sketchfab\.com\/3d-models\/[^/]+-([a-zA-Z0-9]+)/);
  if (match) return `https://sketchfab.com/models/${match[1]}/embed`;
  return url;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Cadastro() {
  const { currentProject, setCurrentProject, addToast } = useStore();

  const [form, setForm] = useState<ProjectFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Plantas state
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Import state
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<AiImportResult | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [eapImporting, setEapImporting] = useState(false);
  const [eapImportProgress, setEapImportProgress] = useState('');
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // Modelo 3D state
  const [sketchfabUrl, setSketchfabUrl] = useState('');

  // Equipe state
  const [members, setMembers] = useState<TeamMemberEntry[]>([]);
  const [newMember, setNewMember] = useState<TeamMemberEntry>({
    id: '',
    name: '',
    email: '',
    role: 'VIEWER',
  });
  const [addingMember, setAddingMember] = useState(false);

  // Pre-fill from currentProject
  useEffect(() => {
    if (currentProject) {
      setForm({
        name: currentProject.name ?? '',
        company: currentProject.company ?? '',
        address: currentProject.address ?? '',
        status: currentProject.status ?? 'PLANNING',
        startDate: currentProject.startDate ? currentProject.startDate.slice(0, 10) : '',
        endDate: currentProject.endDate ? currentProject.endDate.slice(0, 10) : '',
        estimatedCost: currentProject.estimatedCost?.toString() ?? '',
        currency: currentProject.currency ?? 'BRL',
        totalArea: currentProject.totalArea?.toString() ?? '',
        workdaysPerWeek: currentProject.workdaysPerWeek?.toString() ?? '5',
        hoursPerDay: currentProject.hoursPerDay?.toString() ?? '8',
        timezone: currentProject.timezone ?? 'America/Sao_Paulo',
        towers: '',
        floorsPerTower: '',
        unitsPerFloor: '',
        engineer: '',
        contact: '',
      });

      if (currentProject.members) {
        setMembers(
          currentProject.members.map((m) => ({
            id: m.id,
            name: m.user?.fullName ?? m.user?.username ?? '',
            email: m.user?.email ?? '',
            role: m.role,
          })),
        );
      }
    }
  }, [currentProject]);

  // Load uploads on mount when project exists
  useEffect(() => {
    if (currentProject) {
      setLoadingUploads(true);
      uploadsApi
        .list(currentProject.id)
        .then((data) => setUploads(data.filter((u) => u.category === 'PLANT')))
        .catch(() => {})
        .finally(() => setLoadingUploads(false));
    }
  }, [currentProject]);

  function handleFormChange(field: keyof ProjectFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSaveProject() {
    if (!form.name.trim()) {
      addToast({ type: 'error', title: 'Nome obrigatório', description: 'Informe o nome do empreendimento.' });
      return;
    }

    const payload: Partial<Project> = {
      name: form.name.trim(),
      company: form.company.trim(),
      address: form.address.trim(),
      status: form.status,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      estimatedCost: form.estimatedCost ? parseFloat(form.estimatedCost) : undefined,
      currency: form.currency,
      totalArea: form.totalArea ? parseFloat(form.totalArea) : undefined,
      workdaysPerWeek: parseInt(form.workdaysPerWeek) || 5,
      hoursPerDay: parseInt(form.hoursPerDay) || 8,
      timezone: form.timezone,
    };

    setSaving(true);
    try {
      let saved: Project;
      if (currentProject) {
        saved = await projectsApi.update(currentProject.id, payload);
        addToast({ type: 'success', title: 'Empreendimento atualizado!', description: saved.name });
      } else {
        saved = await projectsApi.create(payload);
        addToast({ type: 'success', title: 'Empreendimento criado!', description: saved.name });
      }
      setCurrentProject(saved);
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar', description: 'Verifique os dados e tente novamente.' });
    } finally {
      setSaving(false);
    }
  }

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !currentProject) return;
      const validFiles = Array.from(files).filter(
        (f) => f.type === 'application/pdf' || f.name.endsWith('.pdf'),
      );
      if (validFiles.length === 0) {
        addToast({ type: 'warning', title: 'Apenas PDFs são aceitos' });
        return;
      }

      setUploading(true);
      for (const file of validFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('category', 'PLANT');
        try {
          const uploaded = await uploadsApi.upload(currentProject.id, fd);
          setUploads((prev) => [uploaded, ...prev]);
        } catch {
          addToast({ type: 'error', title: `Erro ao enviar ${file.name}` });
        }
      }
      setUploading(false);
    },
    [currentProject, addToast],
  );

  async function handleDeleteUpload(id: string) {
    try {
      await uploadsApi.delete(id);
      setUploads((prev) => prev.filter((u) => u.id !== id));
      addToast({ type: 'success', title: 'Arquivo removido' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao remover arquivo' });
    }
  }

  async function handleAiFileSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const file = files[0];
    if (!currentProject) {
      addToast({ type: 'warning', title: 'Salve o empreendimento antes de processar com IA' });
      return;
    }

    setAiProcessing(true);
    try {
      const result = await aiImportApi.analyzePdf(currentProject.id, file) as AiImportResult;
      setAiResult(result);
      setAiModalOpen(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({
        type: 'error',
        title: 'Erro ao processar PDF',
        description: msg || 'Verifique se a GEMINI_API_KEY está configurada no servidor.',
      });
    } finally {
      setAiProcessing(false);
      if (aiFileInputRef.current) aiFileInputRef.current.value = '';
    }
  }

  function handleApplyAiResult() {
    if (!aiResult) return;
    const info = aiResult.projectInfo;

    // Calcula data de término a partir da data de início + duração estimada
    let computedEndDate = '';
    if (info.estimatedDurationMonths) {
      const base = form.startDate ? new Date(form.startDate) : new Date();
      base.setMonth(base.getMonth() + info.estimatedDurationMonths);
      computedEndDate = base.toISOString().slice(0, 10);
    }

    setForm((prev) => ({
      ...prev,
      // Dados de identificação
      ...(info.name ? { name: info.name } : {}),
      // Tipo de edificação → campo company pode receber contexto se vazio
      ...(info.buildingType && !prev.company ? { company: `Obra ${info.buildingType.charAt(0) + info.buildingType.slice(1).toLowerCase()}` } : {}),
      // Dimensões
      ...(info.totalArea ? { totalArea: String(info.totalArea) } : {}),
      ...(info.towers ? { towers: String(info.towers) } : {}),
      ...(info.floorsPerTower ? { floorsPerTower: String(info.floorsPerTower) } : {}),
      ...(info.unitsPerFloor ? { unitsPerFloor: String(info.unitsPerFloor) } : {}),
      // Datas — preenche apenas se ainda não definidas
      ...(!prev.startDate ? { startDate: new Date().toISOString().slice(0, 10) } : {}),
      ...(!prev.endDate && computedEndDate ? { endDate: computedEndDate } : {}),
    }));

    const appliedFields: string[] = [];
    if (info.name) appliedFields.push('nome');
    if (info.totalArea) appliedFields.push('área');
    if (info.towers) appliedFields.push('torres');
    if (info.floorsPerTower) appliedFields.push('pavimentos');
    if (info.unitsPerFloor) appliedFields.push('unidades/pav.');
    if (computedEndDate) appliedFields.push('prazo estimado');

    addToast({
      type: 'success',
      title: 'Dados do cadastro aplicados!',
      description: `Campos preenchidos: ${appliedFields.join(', ')}. Revise e salve.`,
    });
  }

  async function handleImportEap() {
    if (!aiResult || !currentProject) {
      addToast({ type: 'warning', title: 'Salve o empreendimento antes de importar o EAP' });
      return;
    }

    setEapImporting(true);
    setEapImportProgress('Criando tipos de atividade…');

    const projectId = currentProject.id; // captura antes do try para preservar narrowing

    try {
      // 1. Criar tipos de atividade sugeridos
      const createdTypes: Record<string, string> = {}; // name → id

      for (const at of aiResult.activityTypes) {
        try {
          const created = await activityTypesApi.create(projectId, {
            name: at.name,
            unit: at.unit,
            measurementMethod: at.measurementMethod,
            weight: at.weight,
          });
          createdTypes[at.name] = created.id;
        } catch {
          // Ignora se já existir
        }
      }

      // 2. Importar EAP usando startDayOffset por item (permite paralelismo real)
      const projectStartDate = form.startDate || new Date().toISOString().slice(0, 10);
      let order = 0;

      // Resolve activityTypeId by name from the types we just created
      function resolveActivityTypeId(activityTypeName?: string | null): string | undefined {
        if (!activityTypeName) return undefined;
        const id = createdTypes[activityTypeName];
        if (id) return id;
        // Fuzzy match: find a key that contains the name or vice versa
        const lower = activityTypeName.toLowerCase();
        const match = Object.keys(createdTypes).find(
          k => k.toLowerCase().includes(lower) || lower.includes(k.toLowerCase()),
        );
        return match ? createdTypes[match] : undefined;
      }

      async function importItem(
        item: AiScheduleItem,
        parentId: string | undefined,
        parentStartOffset: number,
      ): Promise<void> {
        // Use item's own startDayOffset if provided, otherwise fall back to sequential (legacy)
        const itemOffset = item.startDayOffset ?? parentStartOffset;

        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() + itemOffset);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + item.durationDays);

        setEapImportProgress(`Importando: ${item.code} — ${item.name}`);

        const created = await scheduleApi.create(projectId, {
          code: item.code,
          name: item.name,
          level: item.level,
          durationDays: item.durationDays,
          plannedProgress: 0,
          actualProgress: 0,
          weight: item.weight,
          isCriticalPath: item.isCriticalPath,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          order: order++,
          activityTypeId: resolveActivityTypeId(item.activityTypeName),
          ...(parentId ? { parentId } : {}),
        });

        if (item.children?.length) {
          for (const child of item.children) {
            await importItem(child, created.id, itemOffset);
          }
        }
      }

      setEapImportProgress('Importando EAP…');
      for (const rootItem of aiResult.schedule) {
        await importItem(rootItem, undefined, 0);
      }

      setAiModalOpen(false);
      addToast({
        type: 'success',
        title: 'EAP importado com sucesso!',
        description: `${aiResult.activityTypes.length} tipos de atividade e ${aiResult.schedule.length} grupos do cronograma criados. Acesse a aba Cronograma para visualizar.`,
      });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      addToast({
        type: 'error',
        title: 'Erro ao importar EAP',
        description: msg || 'Verifique se o projeto foi salvo e tente novamente.',
      });
    } finally {
      setEapImporting(false);
      setEapImportProgress('');
    }
  }

  function renderScheduleTree(items: AiScheduleItem[], depth = 0): React.ReactNode {
    return items.map((item) => (
      <div key={item.code}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '3px 0',
            paddingLeft: `${depth * 16}px`,
            fontSize: '11px',
            color: depth === 0 ? 'var(--t1)' : depth === 1 ? 'var(--t2)' : 'var(--t3)',
            fontWeight: depth < 2 ? 500 : 400,
          }}
        >
          <ChevronRight size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
          <span style={{ fontFamily: 'var(--mono)', color: 'var(--amber)', minWidth: '40px' }}>{item.code}</span>
          <span style={{ flex: 1 }}>{item.name}</span>
          <span style={{ color: 'var(--t3)', whiteSpace: 'nowrap' }}>{item.durationDays}d</span>
        </div>
        {item.children && renderScheduleTree(item.children, depth + 1)}
      </div>
    ));
  }

  function handleSetSketchfab() {
    const url = window.prompt('Cole a URL do modelo Sketchfab ou embed:');
    if (url && url.trim()) {
      setSketchfabUrl(sketchfabEmbedUrl(url.trim()));
    }
  }

  async function handleAddMember() {
    if (!newMember.name.trim() || !newMember.email.trim()) {
      addToast({ type: 'warning', title: 'Preencha nome e e-mail do membro' });
      return;
    }
    if (!currentProject) {
      addToast({ type: 'warning', title: 'Salve o empreendimento antes de adicionar membros' });
      return;
    }
    setAddingMember(true);
    try {
      await projectsApi.addMember(currentProject.id, {
        email: newMember.email,
        role: newMember.role,
      });
      setMembers((prev) => [
        ...prev,
        { ...newMember, id: Math.random().toString(36).slice(2) },
      ]);
      setNewMember({ id: '', name: '', email: '', role: 'VIEWER' });
      addToast({ type: 'success', title: 'Membro adicionado' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao adicionar membro', description: 'Verifique o e-mail informado.' });
    } finally {
      setAddingMember(false);
    }
  }

  function handleRemoveMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  // ── inline styles ─────────────────────────────────────────────────────────
  const fgStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
  const labelStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.7px' };
  const inputStyle: React.CSSProperties = { padding: '6px 9px', fontSize: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--bd)', background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)', outline: 'none', transition: 'border-color .1s, box-shadow .1s', width: '100%' };
  const sectionLabel: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 };

  function SectionRule() {
    return <div style={{ ...sectionLabel }}><span style={{ whiteSpace: 'nowrap' }}>{'──'}</span><div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Card 1: Dados do empreendimento ───────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <span className="ao-card-title">Empreendimento</span>
          <button className="ao-btn ao-btn-primary ao-btn-sm" onClick={handleSaveProject} disabled={saving}>
            {saving ? <Loader2 size={12} className="ao-spin" /> : <Save size={12} />}
            {saving ? 'Salvando…' : currentProject ? 'Salvar alterações' : 'Criar empreendimento'}
          </button>
        </div>

        <div className="ao-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Identificação ── */}
          <div>
            <div style={{ ...sectionLabel }}>Identificação<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ ...fgStyle, gridColumn: 'span 2' }}>
                <label style={labelStyle}>Nome do empreendimento *</label>
                <input style={inputStyle} value={form.name} onChange={(e) => handleFormChange('name', e.target.value)} placeholder="Ex.: Residencial Parque das Flores" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Empresa responsável</label>
                <input style={inputStyle} value={form.company} onChange={(e) => handleFormChange('company', e.target.value)} placeholder="Construtora ABC Ltda." />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Status</label>
                <select style={inputStyle} value={form.status} onChange={(e) => handleFormChange('status', e.target.value)}>
                  <option value="PLANNING">Planejamento</option>
                  <option value="IN_PROGRESS">Em execução</option>
                  <option value="ON_HOLD">Suspenso</option>
                  <option value="COMPLETED">Concluído</option>
                </select>
              </div>
              <div style={{ ...fgStyle, gridColumn: 'span 2' }}>
                <label style={labelStyle}>Endereço</label>
                <input style={inputStyle} value={form.address} onChange={(e) => handleFormChange('address', e.target.value)} placeholder="Rua, número, bairro, cidade - UF" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Engenheiro responsável</label>
                <input style={inputStyle} value={form.engineer} onChange={(e) => handleFormChange('engineer', e.target.value)} placeholder="Nome do engenheiro" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Contato / Telefone</label>
                <input style={inputStyle} value={form.contact} onChange={(e) => handleFormChange('contact', e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>
          </div>

          {/* ── Estrutura ── */}
          <div>
            <div style={{ ...sectionLabel }}>Estrutura construtiva<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div style={fgStyle}>
                <label style={labelStyle}>Torres / Blocos</label>
                <input style={inputStyle} type="number" min="1" value={form.towers} onChange={(e) => handleFormChange('towers', e.target.value)} placeholder="2" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Pavimentos / Torre</label>
                <input style={inputStyle} type="number" min="1" value={form.floorsPerTower} onChange={(e) => handleFormChange('floorsPerTower', e.target.value)} placeholder="10" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Unidades / Pavimento</label>
                <input style={inputStyle} type="number" min="1" value={form.unitsPerFloor} onChange={(e) => handleFormChange('unitsPerFloor', e.target.value)} placeholder="4" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Área total (m²)</label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={form.totalArea} onChange={(e) => handleFormChange('totalArea', e.target.value)} placeholder="0,00" />
              </div>
            </div>
          </div>

          {/* ── Prazo e custo ── */}
          <div>
            <div style={{ ...sectionLabel }}>Prazo e custo<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              <div style={fgStyle}>
                <label style={labelStyle}>Data de início</label>
                <input style={inputStyle} type="date" value={form.startDate} onChange={(e) => handleFormChange('startDate', e.target.value)} />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Término previsto</label>
                <input style={inputStyle} type="date" value={form.endDate} onChange={(e) => handleFormChange('endDate', e.target.value)} />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Custo orçado (R$)</label>
                <input style={inputStyle} type="number" min="0" step="0.01" value={form.estimatedCost} onChange={(e) => handleFormChange('estimatedCost', e.target.value)} placeholder="0,00" />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Moeda</label>
                <select style={inputStyle} value={form.currency} onChange={(e) => handleFormChange('currency', e.target.value)}>
                  <option value="BRL">BRL — Real</option>
                  <option value="USD">USD — Dólar</option>
                  <option value="EUR">EUR — Euro</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── Parâmetros operacionais ── */}
          <div>
            <div style={{ ...sectionLabel }}>Parâmetros operacionais<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              <div style={fgStyle}>
                <label style={labelStyle}>Dias úteis / semana</label>
                <input style={inputStyle} type="number" min="1" max="7" value={form.workdaysPerWeek} onChange={(e) => handleFormChange('workdaysPerWeek', e.target.value)} />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Horas / dia</label>
                <input style={inputStyle} type="number" min="1" max="24" value={form.hoursPerDay} onChange={(e) => handleFormChange('hoursPerDay', e.target.value)} />
              </div>
              <div style={fgStyle}>
                <label style={labelStyle}>Fuso horário</label>
                <select style={inputStyle} value={form.timezone} onChange={(e) => handleFormChange('timezone', e.target.value)}>
                  <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
                  <option value="America/Manaus">Manaus (GMT-4)</option>
                  <option value="America/Fortaleza">Fortaleza (GMT-3)</option>
                  <option value="America/Belem">Belém (GMT-3)</option>
                  <option value="America/Cuiaba">Cuiabá (GMT-4)</option>
                  <option value="America/Rio_Branco">Rio Branco (GMT-5)</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Row 2: Plantas + Modelo 3D ──────────────────────────────── */}
      <div className="ao-g2">

        {/* Card: Plantas (PDF) */}
        <div className="ao-card">
          <div className="ao-card-hdr">
            <span className="ao-card-title">Plantas do projeto</span>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input ref={aiFileInputRef} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={(e) => handleAiFileSelected(e.target.files)} />
              <button
                className="ao-btn ao-btn-sm ao-btn-primary"
                onClick={() => aiFileInputRef.current?.click()}
                disabled={aiProcessing || !currentProject}
                title={!currentProject ? 'Salve o empreendimento primeiro' : 'Processar PDF com IA para extrair EAP'}
              >
                {aiProcessing ? <Loader2 size={11} className="ao-spin" /> : <Sparkles size={11} />}
                {aiProcessing ? 'Analisando…' : 'Processar com IA'}
              </button>
            </div>
          </div>
          <div className="ao-card-body">
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" multiple style={{ display: 'none' }} onChange={(e) => handleFileUpload(e.target.files)} />

            {/* Drop zone */}
            <div
              onClick={() => currentProject && fileInputRef.current?.click()}
              style={{
                border: '1px dashed var(--bd2)',
                borderRadius: 'var(--r-md)',
                padding: '20px 16px',
                textAlign: 'center',
                background: 'var(--s1)',
                cursor: currentProject ? 'pointer' : 'default',
                transition: 'background 0.1s',
                marginBottom: uploads.length > 0 ? 12 : 0,
              }}
            >
              <div style={{ width: 36, height: 36, background: 'var(--s2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                {uploading
                  ? <Loader2 size={18} style={{ color: 'var(--blue)' }} className="ao-spin" />
                  : <Upload size={18} style={{ color: 'var(--t3)' }} />}
              </div>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 3 }}>
                {uploading ? 'Enviando arquivos…' : 'Arraste PDFs ou clique para selecionar'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--t3)' }}>
                Plantas baixas, cortes e fachadas · A IA extrai o EAP automaticamente
              </p>
              {!currentProject && (
                <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 8, fontWeight: 500 }}>
                  Salve o empreendimento antes de enviar arquivos.
                </p>
              )}
            </div>

            {/* File list */}
            {loadingUploads && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--t3)', padding: '6px 0' }}>
                <Loader2 size={12} className="ao-spin" /> Carregando…
              </div>
            )}

            {!loadingUploads && uploads.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {uploads.map((file) => (
                  <div key={file.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 'var(--r-md)', background: 'var(--s1)', border: '1px solid var(--bd)' }}>
                    <FileText size={13} style={{ color: 'var(--red)', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.fileName}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--t3)', flexShrink: 0, fontFamily: 'var(--mono)' }}>
                      {formatBytes(file.fileSize)}
                    </span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', alignItems: 'center', padding: '2px 4px', borderRadius: 3, flexShrink: 0 }}
                      onClick={() => handleDeleteUpload(file.id)}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card: Modelo 3D */}
        <div className="ao-card">
          <div className="ao-card-hdr">
            <span className="ao-card-title">Modelo 3D</span>
            <span className="ao-badge ao-bb">BIM · IFC</span>
          </div>
          <div className="ao-card-body">
            {sketchfabUrl ? (
              <div>
                <iframe
                  src={sketchfabUrl}
                  width="100%"
                  height="220"
                  frameBorder="0"
                  allowFullScreen
                  title="Modelo 3D"
                  style={{ borderRadius: 'var(--r-md)', display: 'block' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                  <p style={{ fontSize: 11, color: 'var(--t3)' }}>Visualização via Sketchfab</p>
                  <button className="ao-btn ao-btn-sm" onClick={() => setSketchfabUrl('')}>
                    <X size={11} /> Remover
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ border: '1px dashed var(--bd2)', borderRadius: 'var(--r-md)', padding: '24px 16px', textAlign: 'center', background: 'var(--s1)' }}>
                <div style={{ width: 36, height: 36, background: 'var(--s2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 10px' }}>
                  <Box size={18} style={{ color: 'var(--t3)' }} />
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)', marginBottom: 3 }}>Nenhum modelo vinculado</p>
                <p style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 14 }}>
                  Suporte a IFC, OBJ, FBX, GLB e embed Sketchfab / Autodesk BIM 360
                </p>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    className="ao-btn ao-btn-sm"
                    onClick={() => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.ifc,.obj,.fbx,.glb,.gltf'; i.click(); }}
                  >
                    <Upload size={11} /> Arquivo local
                  </button>
                  <button className="ao-btn ao-btn-sm" onClick={handleSetSketchfab}>
                    <Link size={11} /> URL Sketchfab
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Card 3: Equipe ───────────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <span className="ao-card-title">Equipe do projeto</span>
          <span className="ao-badge ao-bk">{members.length} {members.length === 1 ? 'membro' : 'membros'}</span>
        </div>

        {/* Add member form */}
        <div className="ao-card-body" style={{ borderBottom: '1px solid var(--bd)' }}>
          <div style={{ ...sectionLabel }}>Adicionar membro<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 200px auto', gap: 8, alignItems: 'flex-end' }}>
            <div style={fgStyle}>
              <label style={labelStyle}>Nome completo</label>
              <input style={inputStyle} placeholder="Carlos Silva" value={newMember.name} onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div style={fgStyle}>
              <label style={labelStyle}>E-mail</label>
              <input style={inputStyle} type="email" placeholder="carlos@empresa.com.br" value={newMember.email} onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div style={fgStyle}>
              <label style={labelStyle}>Função</label>
              <select style={inputStyle} value={newMember.role} onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value as UserRole }))}>
                {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
            <button className="ao-btn ao-btn-sm ao-btn-primary" onClick={handleAddMember} disabled={addingMember}>
              {addingMember ? <Loader2 size={11} className="ao-spin" /> : <Plus size={11} />}
              Adicionar
            </button>
          </div>
        </div>

        {/* Members table */}
        {members.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
            Nenhum membro adicionado. Use o formulário acima para convidar a equipe.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ao-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}></th>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Função</th>
                  <th style={{ width: 44 }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const initials = member.name.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase() || '?';
                  return (
                    <tr key={member.id}>
                      <td>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--blu-bg)', color: 'var(--blu-t)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                          {initials}
                        </div>
                      </td>
                      <td style={{ fontWeight: 500 }}>{member.name || '—'}</td>
                      <td className="mono">{member.email}</td>
                      <td><span className="ao-badge ao-bk">{ROLE_LABELS[member.role]}</span></td>
                      <td>
                        <button
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t4)', display: 'flex', alignItems: 'center', padding: '3px 6px', borderRadius: 3 }}
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── AI Import Modal ──────────────────────────────────────────── */}
      {aiModalOpen && aiResult && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(13,22,41,0.55)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget) setAiModalOpen(false); }}
        >
          <div style={{ background: 'var(--s0)', borderRadius: 8, border: '1px solid var(--bd2)', width: '100%', maxWidth: 680, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)' }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--bd)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, background: 'var(--amb-bg)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Bot size={15} style={{ color: 'var(--amber)' }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>Análise com IA — Resultado</div>
                  <div style={{ fontSize: 10, color: 'var(--t3)' }}>Revise os dados antes de aplicar</div>
                </div>
                <span className={`ao-badge ${aiResult.confidence === 'high' ? 'ao-bg' : aiResult.confidence === 'medium' ? 'ao-ba' : 'ao-br'}`}>
                  {aiResult.confidence === 'high' ? 'Alta confiança' : aiResult.confidence === 'medium' ? 'Média' : 'Baixa confiança'}
                </span>
              </div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', display: 'flex', alignItems: 'center' }} onClick={() => setAiModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div style={{ overflow: 'auto', flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Análise em texto */}
              <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                <p style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6 }}>{aiResult.rawAnalysis}</p>
              </div>

              {/* Dados identificados */}
              <div>
                <div style={{ ...sectionLabel }}>Dados identificados<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {[
                    { label: 'Torres / Blocos', value: aiResult.projectInfo.towers },
                    { label: 'Pavimentos / Torre', value: aiResult.projectInfo.floorsPerTower },
                    { label: 'Unidades / Pav.', value: aiResult.projectInfo.unitsPerFloor },
                    ...(aiResult.projectInfo.totalArea ? [{ label: 'Área total (m²)', value: aiResult.projectInfo.totalArea }] : []),
                    ...(aiResult.projectInfo.estimatedDurationMonths ? [{ label: 'Duração estimada', value: `${aiResult.projectInfo.estimatedDurationMonths} meses` }] : []),
                    ...(aiResult.projectInfo.buildingType ? [{ label: 'Tipo de edificação', value: aiResult.projectInfo.buildingType }] : []),
                  ].map((item) => (
                    <div key={item.label} style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--mono)' }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipos de atividade */}
              <div>
                <div style={{ ...sectionLabel }}>Tipos de atividade sugeridos ({aiResult.activityTypes.length})<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {aiResult.activityTypes.map((at, i) => (
                    <div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 'var(--r-sm)', background: 'var(--grn-bg)', border: '1px solid var(--grn-bd)', fontSize: 10, color: 'var(--grn-t)', fontWeight: 600 }}>
                      <CheckCircle size={9} />
                      {at.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>· {at.unit}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* EAP */}
              <div>
                <div style={{ ...sectionLabel }}>Cronograma EAP sugerido<div style={{ flex: 1, height: 1, background: 'var(--bd)' }} /></div>
                <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', padding: '10px 12px', maxHeight: 200, overflow: 'auto' }}>
                  {renderScheduleTree(aiResult.schedule)}
                </div>
              </div>

              {/* Aviso baixa confiança */}
              {aiResult.confidence === 'low' && (
                <div className="ao-alert ao-alert-danger">
                  <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>Confiança baixa — o documento pode não conter plantas claras. Os dados são valores padrão para obras residenciais. Revise antes de aplicar.</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ borderTop: '1px solid var(--bd)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {eapImporting && (
                <div className="ao-alert ao-alert-warn" style={{ padding: '8px 12px' }}>
                  <Loader2 size={12} className="ao-spin" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: 11 }}>{eapImportProgress || 'Importando EAP…'}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button className="ao-btn ao-btn-sm" onClick={() => setAiModalOpen(false)} disabled={eapImporting}>Fechar</button>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="ao-btn ao-btn-sm" onClick={handleApplyAiResult} disabled={eapImporting} title="Preenche os campos do formulário com os dados da IA">
                    <CheckCircle size={11} /> Aplicar ao cadastro
                  </button>
                  <button
                    className="ao-btn ao-btn-sm ao-btn-primary"
                    onClick={handleImportEap}
                    disabled={eapImporting || !currentProject}
                    title={!currentProject ? 'Salve o empreendimento antes de importar' : 'Cria tipos de atividade e EAP no banco'}
                  >
                    {eapImporting ? <Loader2 size={11} className="ao-spin" /> : <Sparkles size={11} />}
                    {eapImporting ? 'Importando…' : 'Importar EAP + Atividades'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
