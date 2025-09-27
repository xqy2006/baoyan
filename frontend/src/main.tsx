import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Toaster } from 'sonner';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Toaster position="top-center" richColors closeButton />
    </AuthProvider>
  </BrowserRouter>
);
