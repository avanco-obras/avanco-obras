import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/store';
import { projectsApi, uploadsApi } from '@/services/api';
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
} from 'lucide-react';
import type { Project, Upload as UploadType, UserRole } from '@/types';

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
            <button className="ao-btn ao-btn-sm">
              <Bot size={11} />
              Processar com IA
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

    </div>
  );
}
