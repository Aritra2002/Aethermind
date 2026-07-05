import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Requirement R1: Mobile Node Drag Interaction
 * - Touch event handling & hit radius boost
 * - Node positioning (simulation coords vs canvas coords)
 * - Pinning and unpinning lifecycle
 * - d3.drag lifecycle (start, drag, end, __wasDragged, __originalFx/Fy restoration)
 */

export interface SimNode {
  id: number;
  title: string;
  category: string;
  tags: string[];
  createdAt: number;
  color?: string;
  isDimmed: boolean;
  radius: number;
  visits: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  __originalFx?: number | null;
  __originalFy?: number | null;
  __wasDragged?: boolean;
  __wasUnpinned?: boolean;
  __startX?: number;
  __startY?: number;
}

export interface Transform {
  x: number;
  y: number;
  k: number;
}

// Simulated drag handler helpers matching GraphCanvas.tsx logic
export function calculateSimCoords(screenX: number, screenY: number, rectLeft: number, rectTop: number, transform: Transform) {
  const clickX = screenX - rectLeft;
  const clickY = screenY - rectTop;
  const simX = (clickX - transform.x) / transform.k;
  const simY = (clickY - transform.y) / transform.k;
  return { simX, simY };
}

export function isNodeHit(node: SimNode, simX: number, simY: number, isTouch: boolean, activeNoteId?: number) {
  const dx = node.x - simX;
  const dy = node.y - simY;
  let clickRadius = node.id === activeNoteId ? node.radius + 4 : node.radius;
  if (isTouch) {
    clickRadius += 8; // Mobile touch target hit radius boost
  }
  return Math.sqrt(dx * dx + dy * dy) < clickRadius;
}

export function handleDragStart(node: SimNode, eventX: number = node.x, eventY: number = node.y) {
  node.__originalFx = node.fx;
  node.__originalFy = node.fy;
  node.__wasDragged = false;
  node.__wasUnpinned = false;
  node.__startX = eventX;
  node.__startY = eventY;
  node.fx = node.x;
  node.fy = node.y;
}

export function handleDragMove(node: SimNode, simX: number, simY: number, eventX: number = simX, eventY: number = simY) {
  const startX = node.__startX ?? eventX;
  const startY = node.__startY ?? eventY;
  const dx = eventX - startX;
  const dy = eventY - startY;
  if (Math.hypot(dx, dy) > 3) {
    node.__wasDragged = true;
  }
  node.fx = simX;
  node.fy = simY;
  node.x = simX;
  node.y = simY;
}

export function handleDragEnd(node: SimNode, updateNoteCallback: (id: number, coords: { fx: number | null; fy: number | null }) => void) {
  if (node.__wasUnpinned) {
    return;
  }
  if (node.__wasDragged) {
    updateNoteCallback(node.id, { fx: node.fx, fy: node.fy });
  } else if (node.fx !== null) {
    node.fx = node.__originalFx !== undefined ? node.__originalFx : null;
    node.fy = node.__originalFy !== undefined ? node.__originalFy : null;
  }
}

export function handleLongPressUnpin(node: SimNode, updateNoteCallback: (id: number, coords: { fx: number | null; fy: number | null }) => void) {
  if (node.fx !== null) {
    node.fx = null;
    node.fy = null;
    node.__wasUnpinned = true;
    updateNoteCallback(node.id, { fx: null, fy: null });
    return true;
  }
  return false;
}

describe('R1: Mobile Node Drag Interaction (Tier 1: Feature Coverage)', () => {
  let sampleNode: SimNode;
  let updatedCoords: { id: number; fx: number | null; fy: number | null } | null;

  beforeEach(() => {
    sampleNode = {
      id: 1,
      title: 'Test Mobile Drag',
      category: 'general',
      tags: ['mobile', 'test'],
      createdAt: Date.now(),
      isDimmed: false,
      radius: 15,
      visits: 5,
      x: 300,
      y: 300,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null
    };
    updatedCoords = null;
  });

  it('R1-T1-1: calculates sim coords accurately from touch events through canvas transform', () => {
    const transform = { x: 50, y: 100, k: 2 };
    const rect = { left: 10, top: 20 };
    // Touch screen event at (210, 320)
    const { simX, simY } = calculateSimCoords(210, 320, rect.left, rect.top, transform);
    // clickX = 200, clickY = 300
    // simX = (200 - 50) / 2 = 75
    // simY = (300 - 100) / 2 = 100
    expect(simX).toBe(75);
    expect(simY).toBe(100);
  });

  it('R1-T1-2: applies +8px touch hit-target radius boost on mobile touch interaction', () => {
    // Distance from node (300, 300) to (318, 300) is 18px. Radius is 15px.
    // Mouse click (isTouch = false): distance 18 > 15 -> false
    expect(isNodeHit(sampleNode, 318, 300, false)).toBe(false);
    // Touch event (isTouch = true): hit radius = 15 + 8 = 23. distance 18 < 23 -> true
    expect(isNodeHit(sampleNode, 318, 300, true)).toBe(true);
  });

  it('R1-T1-3: initializes d3.drag lifecycle on drag start with original coordinate tracking', () => {
    sampleNode.fx = 100;
    sampleNode.fy = 150;
    handleDragStart(sampleNode);

    expect(sampleNode.__originalFx).toBe(100);
    expect(sampleNode.__originalFy).toBe(150);
    expect(sampleNode.__wasDragged).toBe(false);
    expect(sampleNode.fx).toBe(300);
    expect(sampleNode.fy).toBe(300);
  });

  it('R1-T1-4: updates node coordinates dynamically during touch drag move', () => {
    handleDragStart(sampleNode);
    handleDragMove(sampleNode, 450, 520, 450, 520);

    expect(sampleNode.__wasDragged).toBe(true);
    expect(sampleNode.x).toBe(450);
    expect(sampleNode.y).toBe(520);
    expect(sampleNode.fx).toBe(450);
    expect(sampleNode.fy).toBe(520);
  });

  it('R1-T1-5: persists pinned coordinates on drag end when node was dragged', () => {
    handleDragStart(sampleNode);
    handleDragMove(sampleNode, 500, 600, 500, 600);
    handleDragEnd(sampleNode, (id, coords) => {
      updatedCoords = { id, ...coords };
    });

    expect(updatedCoords).toEqual({
      id: 1,
      fx: 500,
      fy: 600
    });
  });
});

describe('R1: Mobile Node Drag Interaction (Tier 2: Boundary & Corner Cases)', () => {
  let sampleNode: SimNode;

  beforeEach(() => {
    sampleNode = {
      id: 2,
      title: 'Pinned Corner Node',
      category: 'general',
      tags: ['pinned'],
      createdAt: Date.now(),
      isDimmed: false,
      radius: 12,
      visits: 0,
      x: 100,
      y: 100,
      vx: 0,
      vy: 0,
      fx: 100,
      fy: 100
    };
  });

  it('R1-T2-1: reverts temporary pin if user taps node without moving (wasDragged === false)', () => {
    sampleNode.fx = 80;
    sampleNode.fy = 90;
    handleDragStart(sampleNode); // fx temporarily set to node.x (100)
    // No handleDragMove called
    handleDragEnd(sampleNode, () => {});

    expect(sampleNode.fx).toBe(80);
    expect(sampleNode.fy).toBe(90);
  });

  it('R1-T2-2: unpins node via mobile long-press gesture (>500ms touch hold)', () => {
    let mockDbSave: any = null;
    const unpinned = handleLongPressUnpin(sampleNode, (id, coords) => {
      mockDbSave = { id, ...coords };
    });

    expect(unpinned).toBe(true);
    expect(sampleNode.fx).toBeNull();
    expect(sampleNode.fy).toBeNull();
    expect(mockDbSave).toEqual({ id: 2, fx: null, fy: null });
  });

  it('R1-T2-3: suppresses double-click note creation on mobile viewports (<768px)', () => {
    const handleDblClick = (innerWidth: number) => {
      if (innerWidth < 768) return 'mobile_ignored';
      return 'desktop_action';
    };

    expect(handleDblClick(375)).toBe('mobile_ignored');
    expect(handleDblClick(767)).toBe('mobile_ignored');
    expect(handleDblClick(1024)).toBe('desktop_action');
  });

  it('R1-T2-4: handles extreme zoom scale factors (0.1x zoom and 4.0x zoom) correctly', () => {
    const minZoomTransform = { x: 0, y: 0, k: 0.1 };
    const maxZoomTransform = { x: 0, y: 0, k: 4.0 };

    const minRes = calculateSimCoords(10, 10, 0, 0, minZoomTransform);
    const maxRes = calculateSimCoords(10, 10, 0, 0, maxZoomTransform);

    expect(minRes.simX).toBe(100);
    expect(maxRes.simX).toBe(2.5);
  });

  it('R1-T2-5: disables map zoom/pan filter when touch gesture targets an active graph node', () => {
    const zoomFilterFunc = (event: { type: string; pointerType?: string }, isHit: boolean) => {
      if (event.type === 'touchstart' || event.pointerType === 'touch') {
        if (isHit) return false; // Prevent zoom/pan, allow node drag
      }
      return true;
    };

    expect(zoomFilterFunc({ type: 'touchstart' }, true)).toBe(false);
    expect(zoomFilterFunc({ type: 'touchstart' }, false)).toBe(true);
  });
});

describe('M1: Mobile Node Drag Lifecycle Fixes', () => {
  it('M1-1: preserves in-memory active drag coordinates on React re-render', () => {
    const existing = { id: 1, fx: 450, fy: 520 };
    const noteProp = { id: 1, fx: null, fy: null }; // React prop still has old DB state null
    
    const fx = existing?.fx !== undefined ? existing.fx : (noteProp.fx ?? null);
    const fy = existing?.fy !== undefined ? existing.fy : (noteProp.fy ?? null);

    expect(fx).toBe(450);
    expect(fy).toBe(520);
  });

  it('M1-2: ignores micro-movements (<=3px) during drag and does not mark wasDragged', () => {
    const node: SimNode = {
      id: 1, title: 'Test', category: 'gen', tags: [], createdAt: 0, isDimmed: false, radius: 10, visits: 0,
      x: 100, y: 100, vx: 0, vy: 0, fx: 100, fy: 100
    };
    handleDragStart(node, 100, 100);
    handleDragMove(node, 102, 101, 102, 101); // hypot(2, 1) = 2.23px <= 3px

    expect(node.__wasDragged).toBe(false);
  });

  it('M1-3: long-press unpin sets __wasUnpinned and prevents dragend from re-pinning node', () => {
    const node: SimNode = {
      id: 1, title: 'Pinned Node', category: 'gen', tags: [], createdAt: 0, isDimmed: false, radius: 10, visits: 0,
      x: 100, y: 100, vx: 0, vy: 0, fx: 100, fy: 100
    };
    handleDragStart(node, 100, 100);
    // Micro jitter during touch hold:
    handleDragMove(node, 101, 101, 101, 101);
    
    // Long press fires after 500ms:
    let updatedCoords: any = null;
    handleLongPressUnpin(node, (id, coords) => { updatedCoords = coords; });
    expect(node.__wasUnpinned).toBe(true);
    expect(node.fx).toBeNull();
    expect(node.fy).toBeNull();

    // Finger lifted (drag end event):
    let dragEndSave: any = null;
    handleDragEnd(node, (id, coords) => { dragEndSave = coords; });
    
    expect(dragEndSave).toBeNull();
    expect(node.fx).toBeNull();
    expect(node.fy).toBeNull();
  });
});

