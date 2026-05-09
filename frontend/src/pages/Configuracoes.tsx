import { useState, useEffect, useCallback } from 'react';
import { User, Settings, BarChart2, Bell, Loader2, Check, AlertTriangle, Save } from 'lucide-react';
import { useStore } from '../store';
import { usersApi, projectsApi, activityTypesApi } from '../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import type { ActivityType, ProgressCriteria, MeasurementMethod } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────────

type Section = 'conta' | 'projeto' | 'criterio' | 'notificacoes';

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleLabel(role: string): string {
  switch (role) {
    case 'ADMIN': return 'Administrador';
    case 'ENGINEER': return 'Engenheiro';
    case 'FOREMAN': return 'Mestre de Obras';
    case 'VIEWER': return 'Visualizador';
    default: return role;
  }
}

function roleBadgeVariant(role: string): 'default' | 'secondary' | 'warning' | 'outline' {
  switch (role) {
    case 'ADMIN': return 'default';
    case 'ENGINEER': return 'secondary';
    case 'FOREMAN': return 'warning';
    default: return 'outline';
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

function measurementMethodLabel(method: MeasurementMethod): string {
  switch (method) {
    case 'PERCENT': return 'Percentual';
    case 'METRIC': return 'Métrico';
    case 'COUNT': return 'Contagem';
    default: return method;
  }
}

// ── Section Nav ───────────────────────────────────────────────────────────────

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'conta', label: 'Conta', icon: <User className="h-4 w-4" /> },
  { id: 'projeto', label: 'Projeto', icon: <Settings className="h-4 w-4" /> },
  { id: 'criterio', label: 'Critério de Avanço', icon: <BarChart2 className="h-4 w-4" /> },
  { id: 'notificacoes', label: 'Notificações', icon: <Bell className="h-4 w-4" /> },
];

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

// ── Section: Conta ────────────────────────────────────────────────────────────

function ContaSection() {
  const { user, setAuth, token } = useStore();

  // Profile form
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [username, setUsername] = useState(user?.username ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [crea, setCrea] = useState(user?.crea ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);
    try {
      const updated = await usersApi.update(user.id, {
        fullName: fullName.trim(),
        username: username.trim(),
        phone: phone.trim() || undefined,
        crea: crea.trim() || undefined,
      });
      if (token) setAuth(updated, token);
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch {
      setProfileError('Não foi possível salvar as alterações.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmNewPassword) {
      setPasswordError('A nova senha e a confirmação não coincidem.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    setSavingPassword(true);
    try {
      await usersApi.changePassword(user.id, { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError('Senha atual incorreta ou erro ao alterar senha.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (!user) return null;

  const initials = getInitials(user.fullName || user.username);

  return (
    <div className="space-y-6">
      {/* Profile form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Informações da Conta</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold shrink-0">
                {initials}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{user.fullName}</p>
                <p className="text-xs text-muted-foreground">@{user.username}</p>
                <div className="mt-1.5">
                  <Badge variant={roleBadgeVariant(user.role)}>{roleLabel(user.role)}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName">Nome completo</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="username">Nome de usuário</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="@usuario"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                  className="cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="crea">CREA / CAU</Label>
                <Input
                  id="crea"
                  value={crea}
                  onChange={(e) => setCrea(e.target.value)}
                  placeholder="Número do registro"
                />
              </div>
            </div>

            {profileError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                Alterações salvas com sucesso!
              </p>
            )}

            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" />Salvar alterações</>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Separator */}
      <div className="border-t border-border" />

      {/* Password form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Alterar Senha</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPassword">Senha atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nova senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmNewPassword">Confirmar nova senha</Label>
                <Input
                  id="confirmNewPassword"
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {passwordError && (
              <p className="text-sm text-destructive flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1.5">
                <Check className="h-4 w-4" />
                Senha alterada com sucesso!
              </p>
            )}

            <Button type="submit" variant="outline" disabled={savingPassword}>
              {savingPassword ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Alterando...</>
              ) : (
                'Alterar Senha'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Section: Projeto ──────────────────────────────────────────────────────────

function ProjetoSection() {
  const { currentProject, setCurrentProject } = useStore();

  const [workdaysPerWeek, setWorkdaysPerWeek] = useState(
    currentProject?.workdaysPerWeek?.toString() ?? '5'
  );
  const [hoursPerDay, setHoursPerDay] = useState(
    currentProject?.hoursPerDay?.toString() ?? '8'
  );
  const [timezone, setTimezone] = useState(currentProject?.timezone ?? 'America/Sao_Paulo');
  const [currency, setCurrency] = useState(currentProject?.currency ?? 'BRL');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    const wdays = parseInt(workdaysPerWeek, 10);
    const hpd = parseInt(hoursPerDay, 10);

    if (isNaN(wdays) || wdays < 1 || wdays > 7) {
      setError('Dias úteis por semana deve estar entre 1 e 7.');
      setSaving(false);
      return;
    }
    if (isNaN(hpd) || hpd < 1 || hpd > 24) {
      setError('Horas por dia deve estar entre 1 e 24.');
      setSaving(false);
      return;
    }

    try {
      const updated = await projectsApi.update(currentProject.id, {
        workdaysPerWeek: wdays,
        hoursPerDay: hpd,
        timezone,
        currency,
      });
      setCurrentProject(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Não foi possível salvar as configurações do projeto.');
    } finally {
      setSaving(false);
    }
  };

  if (!currentProject) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Selecione um projeto para configurar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Configurações do Projeto</CardTitle>
        <p className="text-sm text-muted-foreground">{currentProject.name}</p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="workdays">Dias úteis por semana</Label>
              <Input
                id="workdays"
                type="number"
                min={1}
                max={7}
                value={workdaysPerWeek}
                onChange={(e) => setWorkdaysPerWeek(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hours">Horas por dia</Label>
              <Input
                id="hours"
                type="number"
                min={1}
                max={24}
                value={hoursPerDay}
                onChange={(e) => setHoursPerDay(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="timezone">Fuso horário</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger id="timezone">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="currency">Moeda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </p>
          )}
          {success && (
            <p className="text-sm text-green-600 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              Configurações salvas com sucesso!
            </p>
          )}

          <Button type="submit" disabled={saving}>
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Salvar</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Section: Critério de Avanço ───────────────────────────────────────────────

const CRITERIA_INFO: Record<ProgressCriteria, { label: string; formula: string }> = {
  COST: {
    label: 'Custo',
    formula: 'Avanço = Σ(custo_atividade × % executado) / custo_total',
  },
  QUANTITY: {
    label: 'Quantidade',
    formula: 'Avanço = Σ(qtd_executada / qtd_total) / n_atividades',
  },
  HYBRID: {
    label: 'Híbrido',
    formula: 'Média ponderada entre custo e quantidade',
  },
};

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

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[1fr_160px_120px_80px_80px] gap-2 items-center rounded-md border border-border p-3 bg-background">
      <p className="text-sm font-medium text-foreground">{actType.name}</p>

      <Select
        value={measurementMethod}
        onValueChange={(v) => setMeasurementMethod(v as MeasurementMethod)}
      >
        <SelectTrigger className="h-8 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="PERCENT">Percentual</SelectItem>
          <SelectItem value="METRIC">Métrico</SelectItem>
          <SelectItem value="COUNT">Contagem</SelectItem>
        </SelectContent>
      </Select>

      <Input
        className="h-8 text-xs"
        placeholder="Unidade"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      />

      <Input
        className="h-8 text-xs"
        type="number"
        min={0}
        placeholder="Qtd."
        value={defaultQuantity}
        onChange={(e) => setDefaultQuantity(e.target.value)}
      />

      <Button
        size="sm"
        variant={saved ? 'secondary' : 'outline'}
        className="h-8 text-xs"
        onClick={handleSave}
        disabled={saving || !isDirty}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : saved ? (
          <Check className="h-3.5 w-3.5 text-green-600" />
        ) : (
          'Salvar'
        )}
      </Button>
    </div>
  );
}

function CriterioSection() {
  const { currentProject, setCurrentProject } = useStore();

  const [criteria, setCriteria] = useState<ProgressCriteria>(
    currentProject?.progressCriteria ?? 'QUANTITY'
  );
  const [activityTypes, setActivityTypes] = useState<ActivityType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [criteriaSuccess, setCriteriaSuccess] = useState(false);
  const [criteriaError, setCriteriaError] = useState<string | null>(null);

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

  const handleSaveCriteria = async () => {
    if (!currentProject) return;
    setSavingCriteria(true);
    setCriteriaError(null);
    setCriteriaSuccess(false);
    try {
      const updated = await projectsApi.update(currentProject.id, { progressCriteria: criteria });
      setCurrentProject(updated);
      setCriteriaSuccess(true);
      setTimeout(() => setCriteriaSuccess(false), 3000);
    } catch {
      setCriteriaError('Não foi possível salvar o critério de avanço.');
    } finally {
      setSavingCriteria(false);
    }
  };

  const handleSaveActivityType = async (id: string, data: Partial<ActivityType>) => {
    await activityTypesApi.update(id, data);
    setActivityTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  };

  if (!currentProject) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center gap-2">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Selecione um projeto para configurar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Criteria radio */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Critério de Medição de Avanço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(Object.keys(CRITERIA_INFO) as ProgressCriteria[]).map((key) => {
              const info = CRITERIA_INFO[key];
              const isSelected = criteria === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCriteria(key)}
                  className={`rounded-md border-2 p-4 text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:border-muted-foreground/40'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-primary' : 'border-muted-foreground/40'
                      }`}
                    >
                      {isSelected && (
                        <div className="h-2 w-2 rounded-full bg-primary" />
                      )}
                    </div>
                    <span className={`text-sm font-semibold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                      {info.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                    {info.formula}
                  </p>
                </button>
              );
            })}
          </div>

          {criteriaError && (
            <p className="text-sm text-destructive flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              {criteriaError}
            </p>
          )}
          {criteriaSuccess && (
            <p className="text-sm text-green-600 flex items-center gap-1.5">
              <Check className="h-4 w-4" />
              Critério salvo com sucesso!
            </p>
          )}

          <Button onClick={handleSaveCriteria} disabled={savingCriteria || criteria === currentProject.progressCriteria}>
            {savingCriteria ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Salvar</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Activity types table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipos de Atividade</CardTitle>
          <p className="text-xs text-muted-foreground">
            Edite o método de medição, unidade e quantidade padrão por tipo.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Column headers */}
          {activityTypes.length > 0 && (
            <div className="hidden sm:grid grid-cols-[1fr_160px_120px_80px_80px] gap-2 px-3 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Método</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Unidade</p>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Qtd. Padrão</p>
              <span />
            </div>
          )}

          {loadingTypes ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-muted" />
              ))}
            </div>
          ) : activityTypes.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2">
              <BarChart2 className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhum tipo de atividade cadastrado.</p>
            </div>
          ) : (
            activityTypes.map((at) => (
              <ActivityTypeRow key={at.id} actType={at} onSave={handleSaveActivityType} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Section: Notificações ─────────────────────────────────────────────────────

interface NotifToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

function NotifToggle({ label, description, value, onChange }: NotifToggleProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
          value ? 'bg-primary' : 'bg-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function NotificacoesSection() {
  const { addToast } = useStore();
  const [alertasAtraso, setAlertasAtraso] = useState(true);
  const [lembreteWeekly, setLembreteWeekly] = useState(true);
  const [relatorioAuto, setRelatorioAuto] = useState(false);
  const [restricoesVencidas, setRestricoesVencidas] = useState(true);

  const handleSave = () => {
    addToast({ type: 'success', title: 'Salvo com sucesso!' });
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Preferências de Notificações</CardTitle>
        <p className="text-xs text-muted-foreground">
          Controle quais alertas e lembretes você deseja receber.
        </p>
      </CardHeader>
      <CardContent className="space-y-0">
        <NotifToggle
          label="Alertas de atraso"
          description="Receba alertas quando atividades estiverem atrasadas."
          value={alertasAtraso}
          onChange={setAlertasAtraso}
        />
        <NotifToggle
          label="Lembrete de programação semanal"
          description="Lembrete para preencher a programação semanal toda segunda-feira."
          value={lembreteWeekly}
          onChange={setLembreteWeekly}
        />
        <NotifToggle
          label="Relatório automático semanal"
          description="Receba um relatório de progresso automático toda sexta-feira."
          value={relatorioAuto}
          onChange={setRelatorioAuto}
        />
        <NotifToggle
          label="Restrições vencidas"
          description="Alertas quando restrições passarem do prazo sem resolução."
          value={restricoesVencidas}
          onChange={setRestricoesVencidas}
        />
        <div className="pt-4">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar preferências
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Configuracoes() {
  const [activeSection, setActiveSection] = useState<Section>('conta');

  return (
    <div className="p-4 md:p-6">
      {/* Page title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Gerencie sua conta e as configurações do projeto.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar nav */}
        <aside className="md:w-56 shrink-0">
          <nav className="space-y-1">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors text-left ${
                  activeSection === section.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {section.icon}
                {section.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">
          {activeSection === 'conta' && <ContaSection />}
          {activeSection === 'projeto' && <ProjetoSection />}
          {activeSection === 'criterio' && <CriterioSection />}
          {activeSection === 'notificacoes' && <NotificacoesSection />}
        </main>
      </div>
    </div>
  );
}
