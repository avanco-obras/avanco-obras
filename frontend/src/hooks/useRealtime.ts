import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '@/store';

export interface MeasurementUpdatedEvent {
  projectId: string;
  unitId: string;
  activityTypeId: string;
  percentComplete: number;
  measuredById: string;
  measuredByName?: string;
}

export interface ScheduleUpdatedEvent {
  projectId: string;
  scheduleItemId: string;
  physicalProgress: number;
}

export interface ScheduleChangedEvent {
  projectId: string;
  action: 'created' | 'updated' | 'deleted' | 'imported';
  scheduleItemId?: string;
}

let sharedSocket: Socket | null = null;
let sharedProjectId: string | null = null;
let sharedToken: string | null = null;

function ensureSocket(token: string): Socket {
  if (sharedSocket && sharedToken === token) return sharedSocket;
  if (sharedSocket) {
    sharedSocket.disconnect();
    sharedSocket = null;
  }
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api\/?$/, '');
  sharedToken = token;
  sharedSocket = io(`${base}/realtime`, {
    transports: ['websocket', 'polling'],
    auth: { token },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });
  return sharedSocket;
}

function subscribeProject(socket: Socket, projectId: string) {
  if (sharedProjectId === projectId) return;
  if (sharedProjectId) socket.emit('unsubscribe:project', { projectId: sharedProjectId });
  socket.emit('subscribe:project', { projectId });
  sharedProjectId = projectId;
}

/** Conecta ao gateway e assina o canal do projeto atual. */
export function useRealtime(projectId: string | undefined) {
  const token = useStore((s) => s.token);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!projectId || !token) return;
    const socket = ensureSocket(token);
    socketRef.current = socket;

    const onConnect = () => subscribeProject(socket, projectId);
    if (socket.connected) subscribeProject(socket, projectId);
    socket.on('connect', onConnect);

    return () => {
      socket.off('connect', onConnect);
    };
  }, [projectId, token]);

  return socketRef;
}

/** Subscribe a callback to measurement:updated events. */
export function useMeasurementUpdates(
  projectId: string | undefined,
  callback: (e: MeasurementUpdatedEvent) => void,
) {
  const token = useStore((s) => s.token);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const handler = useCallback((e: MeasurementUpdatedEvent) => {
    if (!projectId || e.projectId !== projectId) return;
    cbRef.current(e);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !token) return;
    const socket = ensureSocket(token);
    socket.on('measurement:updated', handler);
    return () => {
      socket.off('measurement:updated', handler);
    };
  }, [projectId, token, handler]);
}

/** Subscribe a callback to schedule:updated events (physicalProgress changes). */
export function useScheduleUpdates(
  projectId: string | undefined,
  callback: (e: ScheduleUpdatedEvent) => void,
) {
  const token = useStore((s) => s.token);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const handler = useCallback((e: ScheduleUpdatedEvent) => {
    if (!projectId || e.projectId !== projectId) return;
    cbRef.current(e);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !token) return;
    const socket = ensureSocket(token);
    socket.on('schedule:updated', handler);
    return () => {
      socket.off('schedule:updated', handler);
    };
  }, [projectId, token, handler]);
}

/** Subscribe to structural schedule changes (item created/deleted, EAP imported). */
export function useScheduleChanges(
  projectId: string | undefined,
  callback: (e: ScheduleChangedEvent) => void,
) {
  const token = useStore((s) => s.token);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  const handler = useCallback((e: ScheduleChangedEvent) => {
    if (!projectId || e.projectId !== projectId) return;
    cbRef.current(e);
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !token) return;
    const socket = ensureSocket(token);
    socket.on('schedule:changed', handler);
    return () => {
      socket.off('schedule:changed', handler);
    };
  }, [projectId, token, handler]);
}
