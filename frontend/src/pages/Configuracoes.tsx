import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../store';
import { usersApi, projectsApi, activityTypesApi } from '../services/api';
import type { ActivityType, ProgressCriteria, MeasurementMethod } from '../types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function roleLabel(role: string): string {
  switch (role) {
    case 'ADMIN': return 'Administrador';
    case 'ENGINEER': return 'Engenheiro';
    case 'FOREMAN': return 'Mestre de Obras';
    case 'VIEWER': return 'Visualizador';
    default: return role;
  }
}

function measurementMethodLabel(method: MeasurementMethod): string {
  switch (method) {
    case 'PERCENT': return 'Percentual';
    case 'METRIC': return 'Métrico';
    case 'COUNT': return 'Contagem';
    default: return method;
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: 'America/Sao_Paulo', label: 'America/São Paulo (GMT-3)' },
  { value: 'America/Manaus', label: 'America/Manaus (GMT-4)' },
  { value: 'America/Fortaleza', label: 'America/Fortaleza (GMT-3)' },
  { value: 'America/Belem', label: 'America/Belém (GMT-3)' },
  { value: 'America/Cuiaba', label: 'America/Cuiabá (GMT-4)' },
  { value: 'America/Rio_Branco', label: 'America/Rio Branco (GMT-5)' },
];

const CURRENCIES = [
  { value: 'BRL', label: 'BRL — Real Brasileiro' },
  { value: 'USD', label: 'USD — Dólar Americano' },
  { value: 'EUR', label: 'EUR — Euro' },
];

// ── Activity Type Row ─────────────────────────────────────────────────────────

interface ActivityTypeRowProps {
  actType: ActivityType;
  onSave: (id: string, data: Partial<ActivityType>) => Promise<void>;
}

function ActivityTypeRow({ actType, onSave }: ActivityTypeRowProps) {
  const [measurementMethod, setMeasurementMethod] = useState<MeasurementMethod>(actType.measurementMethod);
  const [unit, setUnit] = useState(actType.unit);
  const [defaultQuantity, setDefaultQuantity] = useState(actType.defaultQuantity.toString());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const isDirty =
    measurementMethod !== actType.measurementMethod ||
    unit !== actType.unit ||
    defaultQuantity !== actType.defaultQuantity.toString();

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(actType.id, {
        measurementMethod,
        unit: unit.trim(),
        defaultQuantity: parseFloat(defaultQuantity) || 0,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '5px 7px',
    fontSize: 11,
    borderRadius: 'var(--r-md)',
    border: '1px solid var(--bd)',
    background: 'var(--s0)',
    color: 'var(--t1)',
    fontFamily: 'var(--font)',
    width: '100%',
    outline: 'none',
  };

  return (
    <tr>
      <td>{actType.name}</td>
      <td>
        <select
          value={measurementMethod}
          onChange={(e) => setMeasurementMethod(e.target.value as MeasurementMethod)}
          style={inputStyle}
        >
          <option value="PERCENT">Percentual</option>
          <option value="METRIC">Métrico</option>
          <option value="COUNT">Contagem</option>
        </select>
      </td>
      <td>
        <input
          style={inputStyle}
          placeholder="Unidade"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
      </td>
      <td>
        <input
          style={inputStyle}
          type="number"
          min={0}
          placeholder="Qtd."
          value={defaultQuantity}
          onChange={(e) => setDefaultQuantity(e.target.value)}
        />
      </td>
      <td>
        <button
          className={`ao-btn ao-btn-sm${saved ? ' ao-btn-ok' : ''}`}
          onClick={handleSave}
          disabled={saving || !isDirty}
        >
          {saving ? 'Salvando...' : saved ? '✓' : 'Salvar'}
        </button>
      </td>
    </tr>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const { user, setAuth, token, currentProject, setCurrentProject, addToast } = useStore();

  // ── Conta state ───────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [crea, setCrea] = useState(user?.crea ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [savingConta, setSavingConta] = useState(false);
  const [contaMsg, setContaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const handleSaveConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingConta(true);
    setContaMsg(null);
    try {
      const updated = await usersApi.update(user.id, {
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim() || undefined,
        crea: crea.trim() || undefined,
      });
      if (token) setAuth(updated, token);
      if (newPassword.trim().length >= 6) {
        await usersApi.changePassword(user.id, { currentPassword: '', newPassword: newPassword.trim() });
      }
      setNewPassword('');
      setContaMsg({ type: 'ok', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setContaMsg(null), 3000);
    } catch {
      setContaMsg({ type: 'err', text: 'Não foi possível salvar as alterações.' });
    } finally {
      setSavingConta(false);
    }
  };

  // ── Critério state ────────────────────────────────────────────────────────
  const [criteria, setCriteria] = useState<ProgressCriteria>(
    currentProject?.progressCriteria ?? 'QUANTITY'
  );
  const [savingCriteria, setSavingCriteria] = useState(false);

  const handleSaveCriteria = async () => {
    if (!currentProject) return;
    setSavingCriteria(true);
    try {
      const updated = await projectsApi.update(currentProject.id, { progressCriteria: criteria });
      setCurrentProject(updated);
      addToast({ type: 'success', title: 'Critério salvo com sucesso!' });
    } catch {
      addToast({ type: 'error', title: 'Não foi possível salvar o critério.' });
    } finally {
      setSavingCriteria(false);
    }
  };

  // ── Activity types state ──────────────────────────────────────────────────
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);

  const loadActivityTypes = useCallback(async () => {
    if (!currentProject) return;
    setLoadingTypes(true);
    try {
      const data = await activityTypesApi.list(currentProject.id);
      setActivityTypes(data);
    } catch {
      // silently fail
    } finally {
      setLoadingTypes(false);
    }
  }, [currentProject]);

  useEffect(() => {
    loadActivityTypes();
  }, [loadActivityTypes]);

  const handleSaveActivityType = async (id: string, data: Partial<ActivityType>) => {
    await activityTypesApi.update(id, data);
    setActivityTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  };

  // ── Projeto state ─────────────────────────────────────────────────────────
  const [workdaysPerWeek, setWorkdaysPerWeek] = useState(
    currentProject?.workdaysPerWeek?.toString() ?? '5'
  );
  const [hoursPerDay, setHoursPerDay] = useState(
    currentProject?.hoursPerDay?.toString() ?? '8'
  );
  const [timezone, setTimezone] = useState(currentProject?.timezone ?? 'America/Sao_Paulo');
  const [currency, setCurrency] = useState(currentProject?.currency ?? 'BRL');
  const [savingProjeto, setSavingProjeto] = useState(false);

  // ── Delete empreendimento state ────────────────────────────────────────
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEmpreendimento, setDeletingEmpreendimento] = useState(false);

  const handleSaveProjeto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    setSavingProjeto(true);
    try {
      const updated = await projectsApi.update(currentProject.id, {
        workdaysPerWeek: parseInt(workdaysPerWeek, 10),
        hoursPerDay: parseInt(hoursPerDay, 10),
        timezone,
        currency,
      });
      setCurrentProject(updated);
      addToast({ type: 'success', title: 'Configurações do projeto salvas!' });
    } catch {
      addToast({ type: 'error', title: 'Erro ao salvar configurações do projeto.' });
    } finally {
      setSavingProjeto(false);
    }
  };

  const handleDeleteEmpreendimento = async () => {
    if (!currentProject) return;
    setDeletingEmpreendimento(true);
    try {
      console.log(`Deletando empreendimento: ${currentProject.id}`);
      await projectsApi.delete(currentProject.id);
      setCurrentProject(null);
      setShowDeleteConfirm(false);
      addToast({
        type: 'success',
        title: 'Empreendimento deletado com sucesso! 🎉',
        description: 'Todos os dados (torres, pavimentos, medições, cronograma e restrições) foram removidos permanentemente.',
      });
    } catch (error: unknown) {
      console.error('Erro ao deletar empreendimento:', error);
      const errorMsg =
        error instanceof Error
          ? error.message
          : (error && typeof error === 'object' && 'message' in error
              ? String((error as any).message)
              : 'Não foi possível deletar o empreendimento. Tente novamente.');
      addToast({
        type: 'error',
        title: 'Erro ao deletar empreendimento',
        description: errorMsg,
      });
    } finally {
      setDeletingEmpreendimento(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!user) return null;

  const initials = getInitials(user.fullName || user.username);

  const fgStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
  const labelStyle: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.7px' };
  const inStyle: React.CSSProperties = { padding: '6px 9px', fontSize: 12, borderRadius: 'var(--r-md)', border: '1px solid var(--bd)', background: 'var(--s0)', color: 'var(--t1)', fontFamily: 'var(--font)', width: '100%', outline: 'none' };
  const sectionTitle: React.CSSProperties = { fontSize: 9, fontWeight: 800, color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="ao-g2" style={{ alignItems: 'flex-start' }}>

        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Card: Conta */}
          <div className="ao-card">
            <div className="ao-card-hdr">
              <span className="ao-card-title">Minha conta</span>
              <span className="ao-badge ao-bb">{roleLabel(user.role)}</span>
            </div>
            <div className="ao-card-body">

              {/* Avatar row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0 16px', borderBottom: '1px solid var(--bd)', marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--blu-bg)', color: 'var(--blu-t)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, flexShrink: 0, border: '2px solid var(--blu-mid)' }}>
                  {initials}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>{user.fullName || user.username}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2, fontFamily: 'var(--mono)' }}>{user.email}</div>
                </div>
              </div>

              <form onSubmit={handleSaveConta}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div style={fgStyle}>
                    <label style={labelStyle}>Nome completo</label>
                    <input style={inStyle} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>Nome de usuário</label>
                    <input style={inStyle} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="usuario" />
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>E-mail</label>
                    <input style={{ ...inStyle, opacity: 0.55, cursor: 'not-allowed' }} type="email" value={user.email} readOnly disabled />
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>Telefone</label>
                    <input style={inStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>Perfil de acesso</label>
                    <select style={{ ...inStyle, opacity: 0.55, cursor: 'not-allowed' }} defaultValue={user.role} disabled>
                      <option value="ADMIN">Administrador</option>
                      <option value="ENGINEER">Engenheiro</option>
                      <option value="FOREMAN">Mestre de Obras</option>
                      <option value="VIEWER">Visualizador</option>
                    </select>
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>CREA / CAU</label>
                    <input style={inStyle} value={crea} onChange={(e) => setCrea(e.target.value)} placeholder="SP-123456" />
                  </div>
                </div>

                <div style={fgStyle}>
                  <label style={labelStyle}>Nova senha</label>
                  <input style={inStyle} type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Deixe em branco para não alterar" />
                </div>

                {contaMsg && (
                  <div className={`ao-alert ${contaMsg.type === 'ok' ? 'ao-alert-success' : 'ao-alert-danger'}`} style={{ marginTop: 10, padding: '7px 12px', fontSize: 11 }}>
                    {contaMsg.text}
                  </div>
                )}

                <div style={{ marginTop: 14 }}>
                  <button type="submit" className="ao-btn ao-btn-primary ao-btn-sm" disabled={savingConta}>
                    {savingConta ? 'Salvando…' : 'Salvar alterações'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Card: Notificações */}
          <div className="ao-card">
            <div className="ao-card-hdr"><span className="ao-card-title">Notificações</span></div>
            <div className="ao-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { label: 'Alertas de atividades atrasadas', sub: 'Notificado quando SPI cair abaixo de 0.90', checked: true },
                { label: 'Lembrete de lançamento semanal', sub: 'Segunda-feira às 8h', checked: true },
                { label: 'Relatório PDF automático semanal', sub: 'Enviado todo domingo às 20h', checked: false },
                { label: 'Restrições vencidas sem resolução', sub: 'Notificado no vencimento', checked: true },
              ].map((n, i) => (
                <label key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 0', borderBottom: i < 3 ? '1px solid var(--bd)' : 'none' }}>
                  <input type="checkbox" defaultChecked={n.checked} style={{ marginTop: 2, accentColor: 'var(--blue)', cursor: 'pointer', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{n.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{n.sub}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Card: Critério de avanço */}
          <div className="ao-card">
            <div className="ao-card-hdr"><span className="ao-card-title">Critério de avanço físico</span></div>
            <div className="ao-card-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 14 }}>
                {[
                  { value: 'COST', label: 'Peso por custo', sub: 'Ponderado pelo valor orçado (R$)' },
                  { value: 'QUANTITY', label: 'Peso por quantidade', sub: 'Ponderado por m², m³ ou unidades' },
                  { value: 'HYBRID', label: 'Híbrido', sub: 'Combinação de custo + quantidade' },
                ].map((opt, i) => (
                  <label key={opt.value} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 0', borderBottom: i < 2 ? '1px solid var(--bd)' : 'none' }}>
                    <input type="radio" name="crit" checked={criteria === opt.value as ProgressCriteria} onChange={() => setCriteria(opt.value as ProgressCriteria)} style={{ marginTop: 3, accentColor: 'var(--blue)', cursor: 'pointer', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{opt.label}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{opt.sub}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ background: 'var(--s1)', border: '1px solid var(--bd)', borderRadius: 'var(--r-md)', padding: '10px 12px', marginBottom: 14 }}>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.7px', marginBottom: 4 }}>Fórmula</div>
                <div style={{ fontSize: 12, fontFamily: 'var(--mono)', color: 'var(--t2)' }}>Avanço (%) = Σ(Peso × % exec.) / Σ(Pesos)</div>
              </div>

              {currentProject && (
                <button className="ao-btn ao-btn-primary ao-btn-sm" onClick={handleSaveCriteria} disabled={savingCriteria || criteria === currentProject.progressCriteria}>
                  {savingCriteria ? 'Salvando…' : 'Salvar critério'}
                </button>
              )}
            </div>
          </div>

          {/* Card: Tipos de atividade */}
          <div className="ao-card">
            <div className="ao-card-hdr">
              <span className="ao-card-title">Tipos de atividade</span>
              {activityTypes.length > 0 && <span className="ao-badge ao-bk">{activityTypes.length} tipos</span>}
            </div>
            {loadingTypes ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Carregando…</div>
            ) : activityTypes.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Nenhum tipo de atividade cadastrado.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="ao-table">
                  <thead>
                    <tr>
                      <th>Atividade</th>
                      <th>Método</th>
                      <th>Unidade</th>
                      <th>Qtd. padrão</th>
                      <th style={{ width: 70 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityTypes.map((at) => (
                      <ActivityTypeRow key={at.id} actType={at} onSave={handleSaveActivityType} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Card: Parâmetros do projeto */}
          <div className="ao-card">
            <div className="ao-card-hdr"><span className="ao-card-title">Parâmetros do projeto</span></div>
            <div className="ao-card-body">
              {!currentProject ? (
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>Selecione um projeto para configurar.</div>
              ) : (
                <form onSubmit={handleSaveProjeto}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                    <div style={fgStyle}>
                      <label style={labelStyle}>Dias úteis / semana</label>
                      <select style={inStyle} value={workdaysPerWeek} onChange={(e) => setWorkdaysPerWeek(e.target.value)}>
                        {[5, 6, 7].map((d) => <option key={d} value={d}>{d} dias úteis</option>)}
                      </select>
                    </div>
                    <div style={fgStyle}>
                      <label style={labelStyle}>Horas / dia</label>
                      <input style={inStyle} type="number" min={1} max={24} value={hoursPerDay} onChange={(e) => setHoursPerDay(e.target.value)} />
                    </div>
                    <div style={fgStyle}>
                      <label style={labelStyle}>Fuso horário</label>
                      <select style={inStyle} value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                        {TIMEZONES.map((tz) => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
                      </select>
                    </div>
                    <div style={fgStyle}>
                      <label style={labelStyle}>Moeda</label>
                      <select style={inStyle} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="ao-btn ao-btn-primary ao-btn-sm" disabled={savingProjeto}>
                    {savingProjeto ? 'Salvando…' : 'Salvar parâmetros'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Card: Zona de perigo */}
          <div className="ao-card" style={{ borderTop: '3px solid var(--red)' }}>
            <div className="ao-card-hdr">
              <span className="ao-card-title" style={{ color: 'var(--red-t)' }}>Zona de perigo</span>
            </div>
            <div className="ao-card-body">
              {!currentProject ? (
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>Nenhum empreendimento selecionado.</div>
              ) : (
                <>
                  <p style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 14 }}>
                    Ao deletar este empreendimento, todos os dados serão removidos permanentemente: torres, pavimentos, unidades, medições, cronograma e restrições. Esta ação não pode ser desfeita.
                  </p>

                  {showDeleteConfirm ? (
                    <div className="ao-alert ao-alert-danger" style={{ flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, marginBottom: 4 }}>Confirmar exclusão permanente</div>
                        <div style={{ fontSize: 11 }}>Deletar "{currentProject.name}" e todos os seus dados?</div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="ao-btn ao-btn-sm ao-btn-danger"
                          onClick={handleDeleteEmpreendimento}
                          disabled={deletingEmpreendimento}
                        >
                          {deletingEmpreendimento ? 'Deletando…' : 'Confirmar exclusão'}
                        </button>
                        <button className="ao-btn ao-btn-sm" onClick={() => setShowDeleteConfirm(false)} disabled={deletingEmpreendimento}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button className="ao-btn ao-btn-sm ao-btn-danger" onClick={() => setShowDeleteConfirm(true)}>
                      Deletar empreendimento
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
