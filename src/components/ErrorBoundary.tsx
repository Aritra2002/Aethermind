/**
 * @file ErrorBoundary.tsx
 * @description React Error Boundary component for catching and gracefully handling unhandled runtime errors in AetherMind.
 * Prevents full-application white-screen crashes by displaying a fallback UI with an error message and reload action.
 * @module components/ErrorBoundary
 */

import React from 'react';

/**
 * Props for the {@link ErrorBoundary} component.
 *
 * @interface EBProps
 * @property {React.ReactNode} children - The wrapped component subtree to monitor for rendering/lifecycle errors.
 */
interface EBProps {
  children: React.ReactNode;
}

/**
 * Internal state for the {@link ErrorBoundary} component.
 *
 * @interface EBState
 * @property {boolean} hasError - Indicates whether an unhandled error was caught in the child component tree.
 * @property {Error | null} error - The caught JavaScript Error object, or null if healthy.
 */
interface EBState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors anywhere in their child component tree, logs the errors,
 * and displays a fallback crash UI instead of the component tree that crashed.
 *
 * @class ErrorBoundary
 * @extends {React.Component<EBProps, EBState>}
 */
export class ErrorBoundary extends React.Component<EBProps, EBState> {
  state: EBState = { hasError: false, error: null };

  /**
   * Derives state from caught error to trigger fallback rendering.
   *
   * @static
   * @param {Error} error - The error thrown in child component tree.
   * @returns {EBState} New state with hasError set to true and error details captured.
   */
  static getDerivedStateFromError(error: Error): EBState {
    return { hasError: true, error };
  }

  /**
   * Catches errors from child components and logs diagnostic info.
   *
   * @param {Error} error - The error that was thrown.
   * @param {React.ErrorInfo} info - Component stack trace information.
   */
  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          height: '100vh', background: 'var(--bg-primary, #06071a)', color: 'white', gap: '16px', padding: '24px'
        }}>
          <h2 style={{ color: '#f43f5e', margin: 0 }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', maxWidth: '500px', textAlign: 'center', margin: 0 }}>
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="btn btn-primary"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

