/**
 * @file ai-stop-manager.test.ts
 * @description Unit tests for centralized AI Stop & Cancellation capability.
 * Tests registration, notification listeners, bulk abort, and zero-leak cleanup.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { aiStopManager } from '../utils/aiStopManager';

describe('AI Stop & Cancellation Manager', () => {
  beforeEach(() => {
    aiStopManager.stopAll();
  });

  it('registers and unregisters controllers accurately', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    expect(aiStopManager.isAiActive()).toBe(false);
    expect(aiStopManager.getActiveCount()).toBe(0);

    const unregister1 = aiStopManager.register(controller1);
    expect(aiStopManager.isAiActive()).toBe(true);
    expect(aiStopManager.getActiveCount()).toBe(1);

    const unregister2 = aiStopManager.register(controller2);
    expect(aiStopManager.getActiveCount()).toBe(2);

    unregister1();
    expect(aiStopManager.getActiveCount()).toBe(1);

    unregister2();
    expect(aiStopManager.isAiActive()).toBe(false);
    expect(aiStopManager.getActiveCount()).toBe(0);
  });

  it('notifies subscribers of active count changes', () => {
    const listener = vi.fn();
    const unsubscribe = aiStopManager.subscribe(listener);

    expect(listener).toHaveBeenCalledWith(0);

    const controller = new AbortController();
    const unregister = aiStopManager.register(controller);
    expect(listener).toHaveBeenCalledWith(1);

    unregister();
    expect(listener).toHaveBeenCalledWith(0);

    unsubscribe();
  });

  it('aborts all registered controllers on stopAll()', () => {
    const controller1 = new AbortController();
    const controller2 = new AbortController();

    expect(controller1.signal.aborted).toBe(false);
    expect(controller2.signal.aborted).toBe(false);

    aiStopManager.register(controller1);
    aiStopManager.register(controller2);

    const stoppedCount = aiStopManager.stopAll();
    expect(stoppedCount).toBe(2);
    expect(controller1.signal.aborted).toBe(true);
    expect(controller2.signal.aborted).toBe(true);
    expect(aiStopManager.getActiveCount()).toBe(0);
  });
});
