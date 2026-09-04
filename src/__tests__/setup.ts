/**
 * @file setup.ts
 * @description Global Vitest test setup and DOM polyfills.
 */

// Polyfill localStorage in-memory store for Node test environments
const memoryStorage: Record<string, string> = {};
const localStoragePolyfill = {
  getItem: (key: string) => (key in memoryStorage ? memoryStorage[key] : null),
  setItem: (key: string, value: string) => {
    memoryStorage[key] = String(value);
  },
  removeItem: (key: string) => {
    delete memoryStorage[key];
  },
  clear: () => {
    for (const key of Object.keys(memoryStorage)) {
      delete memoryStorage[key];
    }
  },
  key: (index: number) => Object.keys(memoryStorage)[index] || null,
  get length() {
    return Object.keys(memoryStorage).length;
  }
};

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: localStoragePolyfill,
    writable: true
  });
}

if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStoragePolyfill,
    writable: true
  });
}

// Polyfill HTMLCanvasElement.getContext for D3 Canvas rendering in JSDOM/Node test environments
if (typeof window !== 'undefined' && typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function (contextType: string) {
    if (contextType === '2d') {
      return {
        fillRect: () => {},
        clearRect: () => {},
        getImageData: () => ({ data: new Array(4) }),
        putImageData: () => {},
        createImageData: () => [],
        setTransform: () => {},
        drawImage: () => {},
        save: () => {},
        fillText: () => {},
        restore: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        closePath: () => {},
        fill: () => {},
        stroke: () => {},
        strokeRect: () => {},
        strokeText: () => {},
        arc: () => {},
        arcTo: () => {},
        ellipse: () => {},
        quadraticCurveTo: () => {},
        bezierCurveTo: () => {},
        scale: () => {},
        rotate: () => {},
        translate: () => {},
        transform: () => {},
        rect: () => {},
        clip: () => {},
        measureText: (text: string) => ({
          width: text.length * 7,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2
        }),
        isPointInPath: () => false,
        isPointInStroke: () => false,
        createLinearGradient: () => ({
          addColorStop: () => {}
        }),
        createRadialGradient: () => ({
          addColorStop: () => {}
        }),
        createPattern: () => null,
        setLineDash: () => {},
        getLineDash: () => [],
        canvas: this,
      } as unknown as CanvasRenderingContext2D;
    }
    return null;
  } as unknown as typeof HTMLCanvasElement.prototype.getContext;
}
