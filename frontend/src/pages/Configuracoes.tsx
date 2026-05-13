import { useState, useEffect, useCallback } from 'react';
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
    border: '0.5px solid var(--bd2)',
    background: 'var(--bg1)',
    color: 'var(--t1)',
    fontFamily: 'var(--font)',
    width: '100%',
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
      await projectsApi.delete(currentProject.id);
      setCurrentProject(null);
      setShowDeleteConfirm(false);
      addToast({
        type: 'success',
        title: 'Empreendimento deletado',
        description: 'Todos os dados foram removidos. Você voltou ao estado inicial.',
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Erro ao deletar',
        description: 'Não foi possível deletar o empreendimento.',
      });
    } finally {
      setDeletingEmpreendimento(false);
    }
  };

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!user) return null;

  const initials = getInitials(user.fullName || user.username);

  const inputStyle: React.CSSProperties = {
    padding: '7px 9px',
    fontSize: 12,
    borderRadius: 'var(--r-md)',
    border: '0.5px solid var(--bd2)',
    background: 'var(--bg1)',
    color: 'var(--t1)',
    fontFamily: 'var(--font)',
    width: '100%',
  };

  const selectStyle: React.CSSProperties = { ...inputStyle };

  return (
    <div>
      <div className="ao-g2">

        {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
        <div>

          {/* Card: Conta */}
          <div className="ao-card">
            <div className="ao-sec-title">Conta</div>

            {/* Avatar + name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: '1rem' }}>
              <div style={{
                width: 54,
                height: 54,
                borderRadius: '50%',
                background: 'var(--amb-bg)',
                color: 'var(--amb-t)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                fontWeight: 500,
                flexShrink: 0,
              }}>
                {initials}
              </div>
              <div>
                <p style={{ fontWeight: 500 }}>{user.fullName}</p>
                <p style={{ fontSize: 11, color: 'var(--t2)' }}>{roleLabel(user.role)} · @{user.username}</p>
              </div>
            </div>

            {/* Form fields */}
            <form onSubmit={handleSaveConta}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div className="ao-fg">
                  <label>Nome</label>
                  <input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="ao-fg">
                  <label>Usuário</label>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="@usuario"
                  />
                </div>
                <div className="ao-fg">
                  <label>E-mail</label>
                  <input
                    type="email"
                    value={user.email}
                    readOnly
                    disabled
                    style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }}
                  />
                </div>
                <div className="ao-fg">
                  <label>Telefone</label>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="ao-fg">
                  <label>Perfil</label>
                  <select defaultValue={user.role} disabled style={{ ...selectStyle, opacity: 0.6 }}>
                    <option value="ADMIN">Administrador</option>
                    <option value="ENGINEER">Engenheiro</option>
                    <option value="FOREMAN">Mestre de Obras</option>
                    <option value="VIEWER">Visualizador</option>
                  </select>
                </div>
                <div className="ao-fg">
                  <label>CREA / CAU</label>
                  <input
                    value={crea}
                    onChange={(e) => setCrea(e.target.value)}
                    placeholder="Número do registro"
                  />
                </div>
              </div>

              {/* Nova senha — full width */}
              <div className="ao-fg" style={{ marginBottom: 8 }}>
                <label>Nova senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Deixe em branco para não alterar"
                />
              </div>

              {contaMsg && (
                <p style={{ fontSize: 11, color: contaMsg.type === 'ok' ? 'var(--green)' : 'var(--red)', marginBottom: 6 }}>
                  {contaMsg.text}
                </p>
              )}

              <button
                type="submit"
                className="ao-btn ao-btn-primary ao-btn-sm"
                style={{ marginTop: 12 }}
                disabled={savingConta}
              >
                {savingConta ? 'Salvando...' : '💾 Salvar conta'}
              </button>
            </form>
          </div>

          {/* Card: Notificações */}
          <div className="ao-card" style={{ margin: 0 }}>
            <div className="ao-sec-title">Notificações</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> Alertas de atividades atrasadas
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> Lembrete de lançamento semanal
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" /> Relatório PDF automático todo domingo
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" defaultChecked /> Notificação de restrições vencidas
              </label>
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div>

          {/* Card: Critério de avanço físico */}
          <div className="ao-card">
            <div className="ao-sec-title">Critério de avanço físico</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="crit"
                  checked={criteria === 'COST'}
                  onChange={() => setCriteria('COST')}
                /> Peso por custo (R$)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="crit"
                  checked={criteria === 'QUANTITY'}
                  onChange={() => setCriteria('QUANTITY')}
                /> Peso por quantidade (m², m³, unidade)
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="crit"
                  checked={criteria === 'HYBRID'}
                  onChange={() => setCriteria('HYBRID')}
                /> Híbrido (custo + quantidade)
              </label>
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 'var(--r-md)', padding: '.875rem', marginBottom: '1rem' }}>
              <p style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 5 }}>Fórmula aplicada</p>
              <p style={{ fontSize: 12, fontFamily: 'var(--mono)' }}>
                Avanço (%) = Σ(Peso × % exec.) / Σ(Pesos)
              </p>
            </div>

            {currentProject && (
              <button
                className="ao-btn ao-btn-primary ao-btn-sm"
                onClick={handleSaveCriteria}
                disabled={savingCriteria || criteria === currentProject.progressCriteria}
              >
                {savingCriteria ? 'Salvando...' : '💾 Salvar critério'}
              </button>
            )}
          </div>

          {/* Card: Método de medição */}
          <div className="ao-card">
            <div className="ao-sec-title">Método de medição</div>
            {loadingTypes ? (
              <p style={{ fontSize: 12, color: 'var(--t2)' }}>Carregando tipos de atividade...</p>
            ) : activityTypes.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--t2)' }}>Nenhum tipo de atividade cadastrado.</p>
            ) : (
              <table className="ao-table">
                <thead>
                  <tr>
                    <th>Atividade</th>
                    <th>Método</th>
                    <th>Unidade</th>
                    <th>Qtd. padrão</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activityTypes.map((at) => (
                    <ActivityTypeRow key={at.id} actType={at} onSave={handleSaveActivityType} />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Card: Configurações do projeto */}
          <div className="ao-card">
            <div className="ao-sec-title">Configurações do projeto</div>
            {!currentProject ? (
              <p style={{ fontSize: 12, color: 'var(--t2)' }}>Selecione um projeto para configurar.</p>
            ) : (
              <form onSubmit={handleSaveProjeto}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                  <div className="ao-fg">
                    <label>Semana padrão</label>
                    <select
                      value={workdaysPerWeek}
                      onChange={(e) => setWorkdaysPerWeek(e.target.value)}
                    >
                      {[5, 6, 7].map((d) => (
                        <option key={d} value={d}>{d} dias úteis</option>
                      ))}
                    </select>
                  </div>
                  <div className="ao-fg">
                    <label>Horas por dia</label>
                    <input
                      type="number"
                      min={1}
                      max={24}
                      value={hoursPerDay}
                      onChange={(e) => setHoursPerDay(e.target.value)}
                    />
                  </div>
                  <div className="ao-fg">
                    <label>Fuso horário</label>
                    <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {TIMEZONES.map((tz) => (
                        <option key={tz.value} value={tz.value}>{tz.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ao-fg">
                    <label>Moeda</label>
                    <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="ao-btn ao-btn-primary ao-btn-sm"
                  disabled={savingProjeto}
                >
                  {savingProjeto ? 'Salvando...' : '💾 Salvar projeto'}
                </button>
              </form>
            )}
          </div>

          {/* Card: Deletar empreendimento */}
          <div className="ao-card" style={{ margin: 0, borderColor: 'var(--red)', borderWidth: '1px' }}>
            <div className="ao-sec-title" style={{ color: 'var(--red)' }}>⚠️ Deletar empreendimento</div>
            {!currentProject ? (
              <p style={{ fontSize: 12, color: 'var(--t2)' }}>Nenhum empreendimento selecionado.</p>
            ) : (
              <>
                <p style={{ fontSize: 12, color: 'var(--t2)', marginBottom: '1rem' }}>
                  Ao deletar este empreendimento, todos os dados serão removidos permanentemente:
                  torres, pavimentos, unidades, atividades, medições, cronograma e restrições.
                  Você voltará ao estado inicial como um novo usuário.
                </p>

                {showDeleteConfirm ? (
                  <div style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid var(--red)',
                    borderRadius: 'var(--r-md)',
                    padding: '.875rem',
                    marginBottom: '1rem',
                  }}>
                    <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)', marginBottom: '0.75rem' }}>
                      ⚠️ Esta ação é irreversível!
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--t1)', marginBottom: '1rem' }}>
                      Você tem certeza que deseja deletar "{currentProject.name}" e todos os seus dados?
                    </p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={handleDeleteEmpreendimento}
                        disabled={deletingEmpreendimento}
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 500,
                          borderRadius: 'var(--r-md)',
                          border: 'none',
                          background: 'var(--red)',
                          color: '#fff',
                          cursor: deletingEmpreendimento ? 'not-allowed' : 'pointer',
                          opacity: deletingEmpreendimento ? 0.7 : 1,
                          fontFamily: 'var(--font)',
                        }}
                      >
                        {deletingEmpreendimento ? 'Deletando...' : '🗑️ Deletar agora'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={deletingEmpreendimento}
                        style={{
                          padding: '6px 12px',
                          fontSize: 11,
                          fontWeight: 500,
                          borderRadius: 'var(--r-md)',
                          border: '1px solid var(--bd)',
                          background: 'var(--bg1)',
                          color: 'var(--t1)',
                          cursor: 'pointer',
                          fontFamily: 'var(--font)',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{
                      padding: '6px 12px',
                      fontSize: 11,
                      fontWeight: 500,
                      borderRadius: 'var(--r-md)',
                      border: 'none',
                      background: 'var(--red)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'var(--font)',
                    }}
                  >
                    🗑️ Deletar empreendimento
                  </button>
                )}
              </>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
