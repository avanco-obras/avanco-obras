import { useCallback, useEffect, useMemo, useState } from 'react';
import { dashboardApi } from '@/services/api';

export interface AppNotification {
  id: string;
  kind: 'delay' | 'restriction';
  title: string;
  detail: string;
  to: string;
}

/** Preferências que ligam/desligam cada fonte de alerta in-app. */
const DEFAULT_PREFS = { delayedActivities: true, overdueRestrictions: true };

const LS_KEY = 'ao-notif-read';

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore */
  }
}

/**
 * Deriva alertas in-app dos dados que já existem (atrasos e restrições vencidas)
 * do projeto atual, respeitando as preferências do usuário. O estado "lido"
 * fica no cliente (localStorage), pois os alertas são derivados ao vivo.
 */
export function useNotifications(
  projectId: string | undefined,
  prefs?: Record<string, boolean> | null,
) {
  const [alerts, setAlerts] = useState<AppNotification[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(loadReadIds);

  const delayedOn = prefs?.delayedActivities ?? DEFAULT_PREFS.delayedActivities;
  const overdueOn = prefs?.overdueRestrictions ?? DEFAULT_PREFS.overdueRestrictions;

  const load = useCallback(async () => {
    if (!projectId) {
      setAlerts([]);
      return;
    }
    const out: AppNotification[] = [];

    if (delayedOn) {
      const delays = await dashboardApi.delays(projectId).catch(() => []);
      for (const d of delays) {
        out.push({
          id: `delay:${d.id}`,
          kind: 'delay',
          title: d.name,
          detail: `Atrasada em ${d.delayDays} dia(s)`,
          to: '/cronograma',
        });
      }
    }

    if (overdueOn) {
      const restrictions = await dashboardApi.restrictions(projectId).catch(() => []);
      const now = Date.now();
      for (const r of restrictions) {
        if (r.status !== 'RESOLVIDA' && r.dueDate && new Date(r.dueDate).getTime() < now) {
          out.push({
            id: `restr:${r.id}`,
            kind: 'restriction',
            title: r.description,
            detail: `Restrição vencida${r.responsible ? ` · ${r.responsible}` : ''}`,
            to: '/programacao-semanal',
          });
        }
      }
    }

    setAlerts(out);
  }, [projectId, delayedOn, overdueOn]);

  useEffect(() => {
    load();
  }, [load]);

  const unreadCount = useMemo(
    () => alerts.filter((a) => !readIds.has(a.id)).length,
    [alerts, readIds],
  );

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      saveReadIds(next);
      return next;
    });
  }, [alerts]);

  return { alerts, unreadCount, readIds, markRead, markAllRead, reload: load };
}
