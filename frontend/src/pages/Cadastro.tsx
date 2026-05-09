import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import { projectsApi, uploadsApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Upload,
  Users,
  Boxes,
  Plus,
  Trash2,
  Save,
  RefreshCw,
  FileText,
  X,
  Loader2,
  Link2,
} from 'lucide-react';
import type { Project, Upload as UploadType, UserRole } from '@/types';

// ── Tabs ─────────────────────────────────────────────────────────────────────

type Tab = 'empreendimento' | 'plantas' | 'modelo3d' | 'equipe';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'empreendimento', label: 'Empreendimento', icon: Building2 },
  { id: 'plantas', label: 'Plantas', icon: Upload },
  { id: 'modelo3d', label: 'Modelo 3D', icon: Boxes },
  { id: 'equipe', label: 'Equipe', icon: Users },
];

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
};

const STATUS_OPTIONS: { value: Project['status']; label: string }[] = [
  { value: 'PLANNING', label: 'Planejamento' },
  { value: 'IN_PROGRESS', label: 'Em Execução' },
  { value: 'ON_HOLD', label: 'Pausado' },
  { value: 'COMPLETED', label: 'Concluído' },
];

const CURRENCY_OPTIONS = ['BRL', 'USD', 'EUR'];
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function Cadastro() {
  const { currentProject, setCurrentProject, addToast } = useStore();

  const [activeTab, setActiveTab] = useState<Tab>('empreendimento');
  const [form, setForm] = useState<ProjectFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Plantas tab
  const [uploads, setUploads] = useState<UploadType[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modelo 3D tab
  const [modelUrl, setModelUrl] = useState('');
  const [modelUrlInput, setModelUrlInput] = useState('');

  // Equipe tab
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
      });

      // Load members
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

  // Load uploads when tab becomes active
  useEffect(() => {
    if (activeTab === 'plantas' && currentProject) {
      setLoadingUploads(true);
      uploadsApi
        .list(currentProject.id)
        .then((data) => setUploads(data.filter((u) => u.category === 'PLANT')))
        .catch(() => {})
        .finally(() => setLoadingUploads(false));
    }
  }, [activeTab, currentProject]);

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

  function handleApplyModelUrl() {
    setModelUrl(modelUrlInput.trim());
  }

  function sketchfabEmbedUrl(url: string): string {
    // Convert model page URL → embed URL if needed
    const match = url.match(/sketchfab\.com\/3d-models\/[^/]+-([a-zA-Z0-9]+)/);
    if (match) return `https://sketchfab.com/models/${match[1]}/embed`;
    return url;
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
        userId: newMember.email,
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
    <div className="p-4 md:p-6 space-y-4">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {currentProject ? 'Editar Empreendimento' : 'Novo Empreendimento'}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {currentProject
            ? `Configurações de ${currentProject.name}`
            : 'Preencha os dados para cadastrar um novo projeto.'}
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-border overflow-x-auto scrollbar-none">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Empreendimento ─────────────────────────────────────── */}
      {activeTab === 'empreendimento' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Dados Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Row: Name + Company */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do Empreendimento *</Label>
                <Input
                  id="name"
                  placeholder="Ex.: Residencial Parque das Flores"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company">Empresa / Construtora</Label>
                <Input
                  id="company"
                  placeholder="Ex.: Construtora ABC Ltda."
                  value={form.company}
                  onChange={(e) => handleFormChange('company', e.target.value)}
                />
              </div>
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <Label htmlFor="address">Endereço da Obra</Label>
              <Input
                id="address"
                placeholder="Rua, número, bairro, cidade - UF"
                value={form.address}
                onChange={(e) => handleFormChange('address', e.target.value)}
              />
            </div>

            {/* Status + Currency */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  value={form.status}
                  onChange={(e) => handleFormChange('status', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="currency">Moeda</Label>
                <select
                  id="currency"
                  value={form.currency}
                  onChange={(e) => handleFormChange('currency', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="timezone">Fuso Horário</Label>
                <select
                  id="timezone"
                  value={form.timezone}
                  onChange={(e) => handleFormChange('timezone', e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="America/Sao_Paulo">América/São Paulo (BRT)</option>
                  <option value="America/Manaus">América/Manaus (AMT)</option>
                  <option value="America/Fortaleza">América/Fortaleza (BRT)</option>
                  <option value="America/Belem">América/Belém (BRT)</option>
                  <option value="America/Noronha">América/Noronha (FNT)</option>
                  <option value="America/New_York">América/New York (EST)</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Data de Início</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleFormChange('startDate', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endDate">Data de Término Prevista</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => handleFormChange('endDate', e.target.value)}
                />
              </div>
            </div>

            {/* Costs + Area */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="estimatedCost">Custo Estimado ({form.currency})</Label>
                <Input
                  id="estimatedCost"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.estimatedCost}
                  onChange={(e) => handleFormChange('estimatedCost', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="totalArea">
                  Área Total (m²)
                </Label>
                <Input
                  id="totalArea"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0,00"
                  value={form.totalArea}
                  onChange={(e) => handleFormChange('totalArea', e.target.value)}
                />
              </div>
            </div>

            {/* Work calendar */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="workdaysPerWeek">Dias Úteis / Semana</Label>
                <Input
                  id="workdaysPerWeek"
                  type="number"
                  min="1"
                  max="7"
                  value={form.workdaysPerWeek}
                  onChange={(e) => handleFormChange('workdaysPerWeek', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hoursPerDay">Horas de Trabalho / Dia</Label>
                <Input
                  id="hoursPerDay"
                  type="number"
                  min="1"
                  max="24"
                  value={form.hoursPerDay}
                  onChange={(e) => handleFormChange('hoursPerDay', e.target.value)}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveProject} disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Salvando…' : currentProject ? 'Salvar Alterações' : 'Criar Empreendimento'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (currentProject) {
                    setForm({
                      name: currentProject.name ?? '',
                      company: currentProject.company ?? '',
                      address: currentProject.address ?? '',
                      status: currentProject.status ?? 'PLANNING',
                      startDate: currentProject.startDate?.slice(0, 10) ?? '',
                      endDate: currentProject.endDate?.slice(0, 10) ?? '',
                      estimatedCost: currentProject.estimatedCost?.toString() ?? '',
                      currency: currentProject.currency ?? 'BRL',
                      totalArea: currentProject.totalArea?.toString() ?? '',
                      workdaysPerWeek: currentProject.workdaysPerWeek?.toString() ?? '5',
                      hoursPerDay: currentProject.hoursPerDay?.toString() ?? '8',
                      timezone: currentProject.timezone ?? 'America/Sao_Paulo',
                    });
                  } else {
                    setForm(DEFAULT_FORM);
                  }
                }}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Restaurar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Plantas ───────────────────────────────────────────── */}
      {activeTab === 'plantas' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Plantas e Documentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!currentProject && (
              <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                Salve o empreendimento antes de enviar arquivos.
              </p>
            )}

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-accent/50'
              } ${!currentProject ? 'pointer-events-none opacity-50' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                handleFileUpload(e.dataTransfer.files);
              }}
            >
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                {uploading ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">
                  {uploading ? 'Enviando…' : 'Arraste PDFs ou clique para selecionar'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Somente arquivos PDF são aceitos
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
            </div>

            {/* File list */}
            {loadingUploads ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse h-12 rounded-md bg-muted" />
                ))}
              </div>
            ) : uploads.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                Nenhum arquivo enviado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {uploads.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30"
                  >
                    <FileText className="h-5 w-5 text-red-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {file.fileName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatBytes(file.fileSize)} — enviado em{' '}
                        {new Date(file.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteUpload(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Modelo 3D ─────────────────────────────────────────── */}
      {activeTab === 'modelo3d' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Modelo 3D</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* URL input */}
            <div className="space-y-1.5">
              <Label htmlFor="modelUrl">URL do Modelo Sketchfab</Label>
              <div className="flex gap-2">
                <Input
                  id="modelUrl"
                  placeholder="https://sketchfab.com/3d-models/..."
                  value={modelUrlInput}
                  onChange={(e) => setModelUrlInput(e.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleApplyModelUrl}
                  className="gap-2 shrink-0"
                >
                  <Link2 className="h-4 w-4" />
                  Carregar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Cole o link da página do modelo no Sketchfab. O embed será gerado automaticamente.
              </p>
            </div>

            {/* IFC/OBJ upload */}
            <div className="space-y-1.5">
              <Label>Upload de Arquivo (IFC / OBJ)</Label>
              <div
                className="border-2 border-dashed rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.ifc,.obj,.glb,.gltf';
                  input.click();
                }}
              >
                <Boxes className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Arraste ou clique para enviar um arquivo IFC, OBJ, GLB ou GLTF
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                Formatos suportados: .ifc, .obj, .glb, .gltf
              </p>
            </div>

            {/* Embed preview */}
            {modelUrl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Pré-visualização</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setModelUrl('');
                      setModelUrlInput('');
                    }}
                    className="gap-1 text-destructive hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                    Remover
                  </Button>
                </div>
                <div className="rounded-lg overflow-hidden border border-border aspect-video bg-muted">
                  <iframe
                    title="Modelo 3D"
                    className="w-full h-full"
                    src={sketchfabEmbedUrl(modelUrl)}
                    frameBorder="0"
                    allow="autoplay; fullscreen; xr-spatial-tracking"
                    allowFullScreen
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Tab: Equipe ────────────────────────────────────────────── */}
      {activeTab === 'equipe' && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Membros da Equipe</span>
              <Badge variant="outline">{members.length} membros</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add member form */}
            <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Adicionar Membro</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="memberName" className="text-xs">Nome</Label>
                  <Input
                    id="memberName"
                    placeholder="Nome completo"
                    value={newMember.name}
                    onChange={(e) => setNewMember((p) => ({ ...p, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="memberEmail" className="text-xs">E-mail</Label>
                  <Input
                    id="memberEmail"
                    type="email"
                    placeholder="email@empresa.com.br"
                    value={newMember.email}
                    onChange={(e) => setNewMember((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="memberRole" className="text-xs">Função</Label>
                  <select
                    id="memberRole"
                    value={newMember.role}
                    onChange={(e) =>
                      setNewMember((p) => ({ ...p, role: e.target.value as UserRole }))
                    }
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                onClick={handleAddMember}
                disabled={addingMember}
                size="sm"
                className="gap-2"
              >
                {addingMember ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Adicionar Membro
              </Button>
            </div>

            {/* Members list */}
            {members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                Nenhum membro adicionado ainda.
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-md border border-border"
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {member.name
                          .split(' ')
                          .slice(0, 2)
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {member.name || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {ROLE_LABELS[member.role]}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveMember(member.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
