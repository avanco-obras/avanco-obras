import React, { useState } from 'react';
import { useStore } from '../store';
import { usersApi, projectsApi } from '../services/api';
import { ContractorsCard, RestrictionTypesCard } from '../components/weekly/ConfigCards';
import { WEEK_DAYS } from '../components/weekly/weekly-logic';

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

// ── Main Component ────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const { user, setAuth, token, currentProject, setCurrentProject, addToast } = useStore();

  // ── Conta state ───────────────────────────────────────────────────────────
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [crea, setCrea] = useState(user?.crea ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [savingConta, setSavingConta] = useState(false);
  const [contaMsg, setContaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // ── Preferências de notificação (in-app) ──────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<{ delayedActivities: boolean; overdueRestrictions: boolean }>(() => ({
    delayedActivities: user?.notificationPreferences?.delayedActivities ?? true,
    overdueRestrictions: user?.notificationPreferences?.overdueRestrictions ?? true,
  }));
  const [savingNotif, setSavingNotif] = useState(false);

  const toggleNotif = async (key: 'delayedActivities' | 'overdueRestrictions') => {
    if (!user) return;
    const prev = notifPrefs;
    const next = { ...notifPrefs, [key]: !notifPrefs[key] };
    setNotifPrefs(next);
    setSavingNotif(true);
    try {
      const updated = await usersApi.update(user.id, { notificationPreferences: next });
      if (token) setAuth(updated, token);
    } catch {
      setNotifPrefs(prev); // reverte
      addToast({ type: 'error', title: 'Erro ao salvar a preferência de notificação.' });
    } finally {
      setSavingNotif(false);
    }
  };

  const handleSaveConta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validação da troca de senha (opcional): só ocorre se o usuário digitou uma nova senha.
    const wantsPasswordChange = newPassword.trim().length > 0;
    if (wantsPasswordChange) {
      if (newPassword.trim().length < 6) {
        setContaMsg({ type: 'err', text: 'A nova senha deve ter ao menos 6 caracteres.' });
        return;
      }
      if (!currentPassword.trim()) {
        setContaMsg({ type: 'err', text: 'Informe a senha atual para alterar a senha.' });
        return;
      }
    }

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
      if (wantsPasswordChange) {
        await usersApi.changePassword(user.id, {
          currentPassword: currentPassword.trim(),
          newPassword: newPassword.trim(),
        });
      }
      setCurrentPassword('');
      setNewPassword('');
      setContaMsg({ type: 'ok', text: 'Alterações salvas com sucesso!' });
      setTimeout(() => setContaMsg(null), 3000);
    } catch (err) {
      // Mensagem específica do backend (ex.: "Senha atual incorreta").
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setContaMsg({ type: 'err', text: typeof msg === 'string' ? msg : 'Não foi possível salvar as alterações.' });
    } finally {
      setSavingConta(false);
    }
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
  const [weekStartDay, setWeekStartDay] = useState(
    currentProject?.weekStartDay?.toString() ?? '1'
  );
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
        weekStartDay: parseInt(weekStartDay, 10),
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
        title: 'Empreendimento deletado com sucesso! 🎉',
        description: 'Todos os dados (torres, pavimentos, medições, cronograma e restrições) foram removidos permanentemente.',
      });
    } catch (error: unknown) {
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
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>O e-mail não pode ser alterado.</span>
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
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>Definido pelo administrador do projeto.</span>
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>CREA / CAU</label>
                    <input style={inStyle} value={crea} onChange={(e) => setCrea(e.target.value)} placeholder="SP-123456" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={fgStyle}>
                    <label style={labelStyle}>Senha atual</label>
                    <input style={inStyle} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Necessária para alterar a senha" />
                  </div>
                  <div style={fgStyle}>
                    <label style={labelStyle}>Nova senha</label>
                    <input style={inStyle} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Deixe em branco para não alterar" />
                  </div>
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
              {/* Toggles reais — controlam o que aparece no sino */}
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: savingNotif ? 'wait' : 'pointer', padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                <input type="checkbox" checked={notifPrefs.delayedActivities} disabled={savingNotif} onChange={() => toggleNotif('delayedActivities')} style={{ marginTop: 2, accentColor: 'var(--blue)', cursor: 'inherit', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Alertas de atividades atrasadas</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>Mostra no sino as atividades abaixo do previsto</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: savingNotif ? 'wait' : 'pointer', padding: '10px 0', borderBottom: '1px solid var(--bd)' }}>
                <input type="checkbox" checked={notifPrefs.overdueRestrictions} disabled={savingNotif} onChange={() => toggleNotif('overdueRestrictions')} style={{ marginTop: 2, accentColor: 'var(--blue)', cursor: 'inherit', flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Restrições vencidas sem resolução</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>Mostra no sino as restrições pendentes já vencidas</div>
                </div>
              </label>

              {/* Entrega por e-mail — ainda não implementada */}
              {[
                { label: 'Lembrete de lançamento semanal', sub: 'Envio por e-mail' },
                { label: 'Relatório PDF automático semanal', sub: 'Envio por e-mail' },
              ].map((n, i) => (
                <div key={n.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: i < 1 ? '1px solid var(--bd)' : 'none', opacity: 0.6 }}>
                  <input type="checkbox" checked={false} disabled readOnly style={{ marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      {n.label}
                      <span className="ao-badge ao-bk">em breve</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>{n.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── RIGHT COLUMN ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

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
                    <div style={{ ...fgStyle, gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Dia de início da semana (Prog. Semanal)</label>
                      <select style={inStyle} value={weekStartDay} onChange={(e) => setWeekStartDay(e.target.value)}>
                        {WEEK_DAYS.map((day, i) => <option key={day} value={i}>{day}</option>)}
                      </select>
                      <span style={{ fontSize: 10.5, color: 'var(--t3)' }}>
                        Semana de 7 dias: {WEEK_DAYS[parseInt(weekStartDay, 10)]} → {WEEK_DAYS[(parseInt(weekStartDay, 10) + 6) % 7]}.
                        Reunião semanal: {WEEK_DAYS[parseInt(weekStartDay, 10)]} seguinte.
                      </span>
                    </div>
                  </div>
                  <button type="submit" className="ao-btn ao-btn-primary ao-btn-sm" disabled={savingProjeto}>
                    {savingProjeto ? 'Salvando…' : 'Salvar parâmetros'}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Cards: Programação Semanal */}
          <ContractorsCard />
          <RestrictionTypesCard />

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
