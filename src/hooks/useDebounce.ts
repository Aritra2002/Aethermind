/**
 * @file useDebounce.ts
 * @description Custom React hook providing debounced execution for arbitrary functions.
 * Delays invoking the supplied callback until a specified quiet period (delay in milliseconds)
 * has passed since the last invocation. Supports both synchronous callbacks and asynchronous
 * promise-returning functions, with robust error catching and component unmount cleanup.
 */

import { useEffect, useRef, useCallback } from 'react';

/**
 * Creates a debounced version of a callback function that delays execution until `delay` milliseconds
 * have elapsed since the last time it was called.
 *
 * Stale closure avoidance is guaranteed by keeping an internal mutable `useRef` pointing to the
 * latest `callback` implementation.
 *
 * @template Args - The tuple type representing the parameter list of the callback function.
 * @template Return - The return type of the callback function (synchronous value or Promise).
 *
 * @param callback - The function to debounce. Can be synchronous or return a Promise.
 * @param delay - The debounce delay duration in milliseconds.
 * @param onError - Optional custom error handler invoked if the callback throws or rejects.
 *
 * @returns A stable debounced memoized function that accepts the same arguments as `callback`.
 *
 * @example
 * ```tsx
 * const debouncedSave = useDebounce((content: string) => {
 *   saveNoteToDatabase(noteId, content);
 * }, 500);
 *
 * return <textarea onChange={(e) => debouncedSave(e.target.value)} />;
 * ```
 */
export function useDebounce<Args extends unknown[], Return>(
  callback: (...args: Args) => Return,
  delay: number,
  onError?: (err: unknown) => void
) {
  // Store the latest callback reference to avoid re-triggering debounce on callback re-creation
  const callbackRef = useRef(callback);
  // Store active timer ID for cancellation
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronize ref whenever the caller updates the callback implementation
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Clean up any pending timer on component unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Return a stable debounced trigger callback
  const debouncedFunction = useCallback((...args: Args) => {
    // Clear any previously scheduled timer for preceding calls
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule execution after the specified delay
    timeoutRef.current = setTimeout(async () => {
      try {
        const result = callbackRef.current(...args);
        // If the callback returns a promise, await it to catch async rejections
        if (result instanceof Promise) {
          await result.catch(err => {
            if (onError) onError(err);
            else if (import.meta.env.DEV) console.error('Debounced function failed:', err);
          });
        }
      } catch (e) {
        // Handle synchronous exceptions thrown during callback execution
        if (onError) onError(e);
        else if (import.meta.env.DEV) console.error(e);
      }
    }, delay);
  }, [delay, onError]);

  return debouncedFunction;
}

