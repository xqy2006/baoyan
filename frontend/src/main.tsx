import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import 'element-plus/dist/index.css'; // Element Plus 样式
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationProvider';
import { ErrorBoundary } from './components/ErrorBoundary';

createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <AuthProvider>
      <NotificationProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </NotificationProvider>
    </AuthProvider>
  </BrowserRouter>
);
