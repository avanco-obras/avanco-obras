import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from '../store';
import { AppLayout } from '../layouts/AppLayout';
import Login from '../pages/Login';
import Cadastro from '../pages/Cadastro';
import Dashboard from '../pages/Dashboard';
import Cronograma from '../pages/Cronograma';
import Medicao from '../pages/Medicao';
import ProgramacaoSemanal from '../pages/ProgramacaoSemanal';
import Configuracoes from '../pages/Configuracoes';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

export function AppRoutes() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/cadastro" replace />} />
        <Route path="cadastro" element={<Cadastro />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="cronograma" element={<Cronograma />} />
        <Route path="medicao" element={<Medicao />} />
        <Route path="programacao-semanal" element={<ProgramacaoSemanal />} />
        <Route path="configuracoes" element={<Configuracoes />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
