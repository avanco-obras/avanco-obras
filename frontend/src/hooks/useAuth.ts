import { useCallback } from 'react';
import { useStore } from '../store';
import { authApi } from '../services/api';

export function useAuth() {
  const { user, token, isAuthenticated, setAuth, clearAuth } = useStore();

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setAuth(response.user, response.accessToken);
    return response;
  }, [setAuth]);

  const register = useCallback(async (data: Parameters<typeof authApi.register>[0]) => {
    const response = await authApi.register(data);
    setAuth(response.user, response.accessToken);
    return response;
  }, [setAuth]);

  const logout = useCallback(() => {
    clearAuth();
  }, [clearAuth]);

  return { user, token, isAuthenticated, login, register, logout };
}
