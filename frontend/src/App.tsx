import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { Toaster } from './components/ui/toaster';
import { ConfirmProvider } from './components/ConfirmDialog';

export default function App() {
  return (
    <BrowserRouter>
      <ConfirmProvider>
        <AppRoutes />
      </ConfirmProvider>
      <Toaster />
    </BrowserRouter>
  );
}
