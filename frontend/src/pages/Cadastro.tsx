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

  return (
    <div className="ao-app">

      {/* ── Section 1: Dados do empreendimento ──────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <p className="ao-card-title">Dados do empreendimento</p>
          <button
            className="ao-btn ao-btn-primary ao-btn-sm"
            onClick={handleSaveProject}
            disabled={saving}
          >
            {saving ? (
              <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Save size={12} />
            )}
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

          {/* Nome do empreendimento — full width */}
          <div className="ao-fg" style={{ gridColumn: 'span 2' }}>
            <label>Nome do empreendimento</label>
            <input
              value={form.name}
              onChange={(e) => handleFormChange('name', e.target.value)}
              placeholder="Ex.: Residencial Parque das Flores"
            />
          </div>

          {/* Empresa responsável */}
          <div className="ao-fg">
            <label>Empresa responsável</label>
            <input
              value={form.company}
              onChange={(e) => handleFormChange('company', e.target.value)}
              placeholder="Ex.: Construtora ABC Ltda."
            />
          </div>

          {/* Endereço completo — full width */}
          <div className="ao-fg" style={{ gridColumn: 'span 2' }}>
            <label>Endereço completo</label>
            <input
              value={form.address}
              onChange={(e) => handleFormChange('address', e.target.value)}
              placeholder="Rua, número, bairro, cidade - UF"
            />
          </div>

          {/* Número de torres / blocos */}
          <div className="ao-fg">
            <label>Número de torres / blocos</label>
            <input
              type="number"
              min="1"
              value={form.towers}
              onChange={(e) => handleFormChange('towers', e.target.value)}
              placeholder="Ex.: 2"
            />
          </div>

          {/* Número de pavimentos por torre */}
          <div className="ao-fg">
            <label>Número de pavimentos por torre</label>
            <input
              type="number"
              min="1"
              value={form.floorsPerTower}
              onChange={(e) => handleFormChange('floorsPerTower', e.target.value)}
              placeholder="Ex.: 10"
            />
          </div>

          {/* Unidades por pavimento */}
          <div className="ao-fg">
            <label>Unidades por pavimento</label>
            <input
              type="number"
              min="1"
              value={form.unitsPerFloor}
              onChange={(e) => handleFormChange('unitsPerFloor', e.target.value)}
              placeholder="Ex.: 4"
            />
          </div>

          {/* Área total construída */}
          <div className="ao-fg">
            <label>Área total construída (m²)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.totalArea}
              onChange={(e) => handleFormChange('totalArea', e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* Data de início */}
          <div className="ao-fg">
            <label>Data de início</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => handleFormChange('startDate', e.target.value)}
            />
          </div>

          {/* Data prevista de término */}
          <div className="ao-fg">
            <label>Data prevista de término</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => handleFormChange('endDate', e.target.value)}
            />
          </div>

          {/* Custo total orçado */}
          <div className="ao-fg">
            <label>Custo total orçado (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.estimatedCost}
              onChange={(e) => handleFormChange('estimatedCost', e.target.value)}
              placeholder="0,00"
            />
          </div>

          {/* Engenheiro responsável */}
          <div className="ao-fg">
            <label>Engenheiro responsável</label>
            <input
              value={form.engineer}
              onChange={(e) => handleFormChange('engineer', e.target.value)}
              placeholder="Nome do engenheiro"
            />
          </div>

          {/* Contato / Telefone */}
          <div className="ao-fg">
            <label>Contato / Telefone</label>
            <input
              value={form.contact}
              onChange={(e) => handleFormChange('contact', e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>

        </div>
      </div>

      {/* ── Section 2: Two-column grid ──────────────────────────────── */}
      <div className="ao-g2">

        {/* Card: Plantas (PDF) */}
        <div className="ao-card" style={{ margin: 0 }}>
          <div className="ao-card-hdr">
            <p className="ao-card-title">Plantas (PDF)</p>
            <input
              ref={aiFileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={(e) => handleAiFileSelected(e.target.files)}
            />
            <button
              className="ao-btn ao-btn-sm ao-btn-primary"
              onClick={() => aiFileInputRef.current?.click()}
              disabled={aiProcessing || !currentProject}
              title={!currentProject ? 'Salve o empreendimento primeiro' : 'Enviar PDF para análise com IA'}
            >
              {aiProcessing ? (
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Sparkles size={11} />
              )}
              {aiProcessing ? 'Analisando…' : 'Processar com IA'}
            </button>
          </div>

          <div
            style={{
              border: '1px dashed var(--bd2)',
              borderRadius: 'var(--r-md)',
              padding: '1.25rem',
              textAlign: 'center',
            }}
          >
            <FileText
              size={32}
              style={{ color: 'var(--t2)', margin: '0 auto 8px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--t2)' }}>
              Plantas baixas, cortes e fachadas
            </p>
            <p style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px' }}>
              A IA extrai pavimentos, unidades e áreas e sugere EAP
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e.target.files)}
            />

            <button
              className="ao-btn ao-btn-sm"
              style={{ marginTop: '10px' }}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !currentProject}
            >
              {uploading ? (
                <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                <Upload size={11} />
              )}
              {uploading ? 'Enviando…' : 'Selecionar PDFs'}
            </button>

            {/* File list */}
            {loadingUploads && (
              <div style={{ marginTop: '10px', fontSize: '11px', color: 'var(--t3)' }}>
                Carregando…
              </div>
            )}

            {!loadingUploads && uploads.length > 0 && (
              <div style={{ marginTop: '10px', textAlign: 'left' }}>
                {uploads.map((file) => (
                  <div
                    key={file.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 6px',
                      borderRadius: 'var(--r-md)',
                      background: 'var(--bg2)',
                      marginBottom: '4px',
                    }}
                  >
                    <FileText size={12} style={{ color: '#A32D2D', flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '11px',
                        color: 'var(--t1)',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {file.fileName}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--t3)', flexShrink: 0 }}>
                      {formatBytes(file.fileSize)}
                    </span>
                    <button
                      className="ao-btn ao-btn-sm"
                      style={{ padding: '2px 5px', border: 'none', background: 'transparent', color: 'var(--t3)' }}
                      onClick={() => handleDeleteUpload(file.id)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {!currentProject && (
              <p style={{ fontSize: '11px', color: 'var(--amber)', marginTop: '8px' }}>
                Salve o empreendimento antes de enviar arquivos.
              </p>
            )}
          </div>
        </div>

        {/* Card: Modelo 3D */}
        <div className="ao-card" style={{ margin: 0 }}>
          <div className="ao-card-hdr">
            <p className="ao-card-title">Modelo 3D</p>
            <span className="ao-badge ao-bb">Navegação visual</span>
          </div>

          <div
            style={{
              border: '1px dashed var(--bd2)',
              borderRadius: 'var(--r-md)',
              padding: '1.25rem',
              textAlign: 'center',
            }}
          >
            <Box
              size={32}
              style={{ color: 'var(--t2)', margin: '0 auto 8px' }}
            />
            <p style={{ fontSize: '12px', color: 'var(--t2)' }}>
              Modelo 3D do empreendimento
            </p>
            <p style={{ fontSize: '11px', color: 'var(--t3)', marginTop: '3px' }}>
              IFC, OBJ, FBX ou embed Sketchfab/BIM 360
            </p>

            <div
              style={{
                display: 'flex',
                gap: '6px',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginTop: '10px',
              }}
            >
              <button
                className="ao-btn ao-btn-sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.ifc,.obj,.fbx,.glb,.gltf';
                  input.click();
                }}
              >
                <Upload size={11} />
                Arquivo
              </button>
              <button
                className="ao-btn ao-btn-sm"
                onClick={handleSetSketchfab}
              >
                <Link size={11} />
                URL Sketchfab
              </button>
            </div>

            {sketchfabUrl && (
              <div style={{ marginTop: '10px' }}>
                <iframe
                  src={sketchfabUrl}
                  width="100%"
                  height="180"
                  frameBorder="0"
                  allowFullScreen
                  title="Modelo 3D Sketchfab"
                  style={{ borderRadius: 'var(--r-md)' }}
                />
                <p style={{ fontSize: '10px', color: 'var(--t3)', marginTop: '4px' }}>
                  Após vincular, navegue pelo modelo no módulo Medição
                </p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Section 3: Equipe ────────────────────────────────────────── */}
      <div className="ao-card">
        <div className="ao-card-hdr">
          <p className="ao-card-title">Equipe</p>
          <span className="ao-badge ao-bk">{members.length} membros</span>
        </div>

        {/* Add member form */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr auto',
            gap: '8px',
            alignItems: 'flex-end',
            marginBottom: '12px',
          }}
        >
          <div className="ao-fg">
            <label>Nome</label>
            <input
              placeholder="Nome completo"
              value={newMember.name}
              onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div className="ao-fg">
            <label>E-mail</label>
            <input
              type="email"
              placeholder="email@empresa.com.br"
              value={newMember.email}
              onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
            />
          </div>
          <div className="ao-fg">
            <label>Função</label>
            <select
              value={newMember.role}
              onChange={(e) => setNewMember((p) => ({ ...p, role: e.target.value as UserRole }))}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>
          <button
            className="ao-btn ao-btn-sm ao-btn-primary"
            onClick={handleAddMember}
            disabled={addingMember}
          >
            {addingMember ? (
              <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <Plus size={11} />
            )}
            Adicionar
          </button>
        </div>

        {/* Members list */}
        {members.length === 0 ? (
          <p style={{ fontSize: '12px', color: 'var(--t3)', textAlign: 'center', padding: '1rem 0' }}>
            Nenhum membro adicionado ainda.
          </p>
        ) : (
          <div>
            {members.map((member) => (
              <div
                key={member.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '7px 8px',
                  borderRadius: 'var(--r-md)',
                  background: 'var(--bg2)',
                  marginBottom: '4px',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: 'var(--amb-bg)',
                    color: 'var(--amber)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {member.name
                    .split(' ')
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '12px', color: 'var(--t1)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.name || '—'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--t3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {member.email}
                  </p>
                </div>
                <span className="ao-badge ao-bk" style={{ flexShrink: 0 }}>
                  {ROLE_LABELS[member.role]}
                </span>
                <button
                  className="ao-btn ao-btn-sm"
                  style={{ border: 'none', background: 'transparent', color: 'var(--t3)', padding: '3px 5px', flexShrink: 0 }}
                  onClick={() => handleRemoveMember(member.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AI Import Modal ──────────────────────────────────────────── */}
      {aiModalOpen && aiResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setAiModalOpen(false); }}
        >
          <div
            style={{
              background: 'var(--bg1)',
              borderRadius: 'var(--r-lg)',
              border: '0.5px solid var(--bd)',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Modal header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                borderBottom: '0.5px solid var(--bd)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bot size={16} style={{ color: 'var(--amber)' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t1)' }}>
                  Resultado da Análise com IA
                </span>
                <span
                  className={`ao-badge ${aiResult.confidence === 'high' ? 'ao-bg' : aiResult.confidence === 'medium' ? 'ao-ba' : 'ao-br'}`}
                  style={{ marginLeft: '4px' }}
                >
                  {aiResult.confidence === 'high' ? 'Alta confiança' : aiResult.confidence === 'medium' ? 'Média confiança' : 'Baixa confiança'}
                </span>
              </div>
              <button
                className="ao-btn ao-btn-sm"
                style={{ border: 'none', background: 'transparent', color: 'var(--t3)' }}
                onClick={() => setAiModalOpen(false)}
              >
                <X size={14} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ overflow: 'auto', flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

              {/* Resumo da análise */}
              <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                <p style={{ fontSize: '11px', color: 'var(--t2)', lineHeight: '1.5' }}>{aiResult.rawAnalysis}</p>
              </div>

              {/* Info do projeto */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Dados identificados
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                  {[
                    { label: 'Torres / Blocos', value: aiResult.projectInfo.towers },
                    { label: 'Pavimentos / Torre', value: aiResult.projectInfo.floorsPerTower },
                    { label: 'Unidades / Pavimento', value: aiResult.projectInfo.unitsPerFloor },
                    ...(aiResult.projectInfo.totalArea ? [{ label: 'Área total (m²)', value: aiResult.projectInfo.totalArea }] : []),
                    ...(aiResult.projectInfo.estimatedDurationMonths ? [{ label: 'Duração estimada', value: `${aiResult.projectInfo.estimatedDurationMonths} meses` }] : []),
                    ...(aiResult.projectInfo.buildingType ? [{ label: 'Tipo', value: aiResult.projectInfo.buildingType }] : []),
                  ].map((item) => (
                    <div key={item.label} style={{ background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: '8px 10px' }}>
                      <p style={{ fontSize: '10px', color: 'var(--t3)' }}>{item.label}</p>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t1)' }}>{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tipos de atividade */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Tipos de atividade sugeridos ({aiResult.activityTypes.length})
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {aiResult.activityTypes.map((at, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '20px',
                        background: 'var(--amb-bg)',
                        fontSize: '11px',
                        color: 'var(--amb-t)',
                      }}
                    >
                      <CheckCircle size={9} />
                      {at.name} <span style={{ opacity: 0.7 }}>({at.unit})</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* EAP */}
              <div>
                <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--t2)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Cronograma (EAP) sugerido
                </p>
                <div
                  style={{
                    background: 'var(--bg2)',
                    borderRadius: 'var(--r-md)',
                    padding: '10px 12px',
                    maxHeight: '200px',
                    overflow: 'auto',
                  }}
                >
                  {renderScheduleTree(aiResult.schedule)}
                </div>
              </div>

              {/* Warning if low confidence */}
              {aiResult.confidence === 'low' && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                    padding: '10px 12px',
                    background: 'var(--red-bg)',
                    borderRadius: 'var(--r-md)',
                  }}
                >
                  <AlertCircle size={14} style={{ color: 'var(--red)', flexShrink: 0, marginTop: '1px' }} />
                  <p style={{ fontSize: '11px', color: 'var(--red-t)' }}>
                    Confiança baixa: o documento pode não conter plantas claras. Os dados sugeridos são valores padrão para obras residenciais. Revise antes de aplicar.
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div
              style={{
                borderTop: '0.5px solid var(--bd)',
                padding: '12px 16px',
              }}
            >
              {/* Progress feedback */}
              {eapImporting && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    background: 'var(--amb-bg)',
                    borderRadius: 'var(--r-md)',
                    marginBottom: '10px',
                    fontSize: '11px',
                    color: 'var(--amb-t)',
                  }}
                >
                  <Loader2 size={12} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                  <span>{eapImportProgress || 'Importando EAP…'}</span>
                </div>
              )}

              {/* Buttons */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <button className="ao-btn ao-btn-sm" onClick={() => setAiModalOpen(false)} disabled={eapImporting}>
                  Fechar
                </button>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {/* Aplica apenas os dados do cadastro */}
                  <button
                    className="ao-btn ao-btn-sm"
                    onClick={handleApplyAiResult}
                    disabled={eapImporting}
                    title="Preenche os campos de cadastro com os dados identificados pela IA"
                  >
                    <CheckCircle size={11} />
                    Aplicar dados do cadastro
                  </button>
                  {/* Importa EAP e tipos de atividade no banco */}
                  <button
                    className="ao-btn ao-btn-sm ao-btn-primary"
                    onClick={handleImportEap}
                    disabled={eapImporting || !currentProject}
                    title={!currentProject ? 'Salve o empreendimento antes de importar o EAP' : 'Cria os tipos de atividade e o cronograma (EAP) completo no banco de dados'}
                  >
                    {eapImporting ? (
                      <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <Sparkles size={11} />
                    )}
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
