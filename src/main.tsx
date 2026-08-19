/**
 * @file main.tsx
 * @description Application entry point for AetherMind.
 * Bootstraps the React root component into the DOM and configures essential top-level wrappers:
 * - `StrictMode`: Enables React runtime checks and warnings during development.
 * - `ErrorBoundary`: Prevents uncaught UI render errors from crashing the entire app shell.
 * - `ToastProvider`: Exposes global notification dispatch mechanisms across all components.
 * - `index.css`: Injects Tailwind CSS styles, custom scrollbars, animations, and typography.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ToastProvider } from './components/ToastContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

// Initialize and mount the React application root into the DOM container #root
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Global error boundary catching unexpected React rendering exceptions */}
    <ErrorBoundary>
      {/* Toast provider managing transient notification alerts */}
      <ToastProvider>
        {/* Main application UI and state orchestrator */}
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>
);

