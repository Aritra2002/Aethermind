/**
 * @file ToastContext.tsx
 * @description Global notification context and provider for AetherMind.
 * Supplies an accessible toast notification system with automatic 3-second dismissal, mobile viewport offset awareness,
 * and clean timeout management to prevent memory leaks.
 * @module components/ToastContext
 */

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * Toast severity / visual theme classification.
 * @typedef {'success' | 'error' | 'info'} ToastType
 */
export type ToastType = 'success' | 'error' | 'info';

/**
 * Internal representation of an active toast notification item.
 *
 * @interface Toast
 * @property {number} id - Unique timestamp-based identifier for the toast.
 * @property {string} message - User-facing text message to display.
 * @property {ToastType} type - Visual style category for the toast.
 */
interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

/**
 * Interface contract provided by {@link ToastContext}.
 *
 * @interface ToastContextType
 * @property {(message: string, type?: ToastType) => void} showToast - Function to trigger a new transient toast notification.
 */
interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

/**
 * Helper to check if current window width is under the mobile breakpoint (<768px).
 *
 * @returns {boolean} True if viewport width is less than 768px.
 */
function getIsMobile() {
  return window.innerWidth < 768;
}

/**
 * ToastProvider Component
 *
 * Wraps the application component tree and injects the global `showToast` method.
 * Renders an accessible floating toast message container positioned above mobile bars.
 *
 * @component
 * @param {{ children: ReactNode }} props - React children to wrap.
 * @returns {React.ReactElement} The Context Provider with active toast overlay markup.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  /** Active queue of visible toast notifications. */
  const [toasts, setToasts] = useState<Toast[]>([]);

  /** Tracks viewport size for mobile bottom offset calculation. */
  const [isMobile, setIsMobile] = useState(getIsMobile);

  // Listen to window resizing with debouncing
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setIsMobile(getIsMobile()), 150);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (timer) clearTimeout(timer);
    };
  }, []);

  /** Ref map maintaining active dismissal timers for each toast to prevent memory leaks on unmount. */
  const toastTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  /**
   * Displays a toast notification that automatically dismisses after 3 seconds.
   *
   * @param {string} message - Notification text.
   * @param {ToastType} [type='info'] - Severity level ('success' | 'error' | 'info').
   */
  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      toastTimersRef.current.delete(id);
    }, 3000);
    toastTimersRef.current.set(id, timer);
  }, []);

  // Cleanup all pending toast timers when provider unmounts
  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Accessible Live Region Container for Floating Toasts */}
      <div 
        className="toast-container" 
        aria-live="polite" 
        aria-atomic="true" 
        style={{ 
          bottom: isMobile ? 'calc(var(--mobile-nav-height, 60px) + var(--safe-bottom, env(safe-area-inset-bottom, 0px)) + 16px)' : '16px', 
          zIndex: 9999 
        }}
      >
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-message toast-${toast.type}`}>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Custom hook to access the application toast notification dispatcher.
 *
 * @returns {ToastContextType} The toast context containing the `showToast` method.
 * @throws {Error} If called outside of a `<ToastProvider>`.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
