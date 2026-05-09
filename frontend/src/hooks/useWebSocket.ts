import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

export function useWebSocket(projectId: string | undefined) {
  const wsRef = useRef<WebSocket | null>(null);
  const { token } = useStore();

  const connect = useCallback(() => {
    if (!projectId || !token) return;
    const wsUrl = (import.meta.env.VITE_WS_URL || 'ws://localhost:3001').replace(/^http/, 'ws');
    try {
      const ws = new WebSocket(`${wsUrl}/ws?projectId=${projectId}&token=${token}`);
      ws.onopen = () => console.log('WS connected');
      ws.onclose = () => console.log('WS disconnected');
      ws.onerror = (e) => console.error('WS error', e);
      wsRef.current = ws;
    } catch (e) {
      console.warn('WebSocket unavailable', e);
    }
  }, [projectId, token]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
