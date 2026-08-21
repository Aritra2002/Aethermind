/**
 * @file aiStopManager.ts
 * @description Centralized AI cancellation and execution controller for AetherMind.
 * Tracks all active in-flight AI requests and streaming operations, providing immediate
 * 1-click cancellation to halt AI actions and prevent unwanted mutations.
 */

type Listener = (activeCount: number) => void;

class AiStopManager {
  private activeControllers = new Set<AbortController>();
  private listeners = new Set<Listener>();

  /**
   * Registers an active AbortController for a running AI operation.
   *
   * @param controller - The AbortController for the in-flight AI task.
   * @returns Cleanup function to unregister the controller upon completion.
   */
  public register(controller: AbortController): () => void {
    this.activeControllers.add(controller);
    this.notify();

    return () => {
      this.activeControllers.delete(controller);
      this.notify();
    };
  }

  /**
   * Immediately aborts all active in-flight AI requests across the entire application.
   *
   * @returns Total number of aborted AI operations.
   */
  public stopAll(): number {
    const count = this.activeControllers.size;
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch (err) {
        console.warn('Error aborting AI controller:', err);
      }
    }
    this.activeControllers.clear();
    this.notify();
    return count;
  }

  /**
   * Returns whether any AI operation is currently active.
   */
  public isAiActive(): boolean {
    return this.activeControllers.size > 0;
  }

  /**
   * Returns current count of in-flight AI operations.
   */
  public getActiveCount(): number {
    return this.activeControllers.size;
  }

  /**
   * Subscribes to AI activity changes.
   */
  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.activeControllers.size);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const count = this.activeControllers.size;
    for (const listener of this.listeners) {
      try {
        listener(count);
      } catch (err) {
        console.error('Error in AiStopManager listener:', err);
      }
    }
  }
}

export const aiStopManager = new AiStopManager();
