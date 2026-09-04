/**
 * @file Skeleton.tsx
 * @description Advanced Shimmer Skeleton Loaders for AetherMind.
 * Inspired by Particles Casberry, DaisyUI, and HorizonX design standards.
 * Features:
 * - Skeleton.GraphCanvas: Constellation particle canvas skeleton with synaptic hairlines
 * - Skeleton.Editor: Note workspace shimmer skeleton matching actual editor layout
 * - Skeleton.AiSummary: Cognitive card shimmer for AI generation states
 * - Skeleton.Block / Skeleton.Pill: General purpose shimmer primitives
 */

import React from 'react';
import { Sparkles } from 'lucide-react';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export const SkeletonBlock: React.FC<SkeletonProps & { width?: string | number; height?: string | number; radius?: string | number }> = ({
  className = '',
  style = {},
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-sm)'
}) => (
  <div
    className={`aether-skeleton ${className}`}
    style={{
      width,
      height,
      borderRadius: radius,
      ...style
    }}
  />
);

export const SkeletonPill: React.FC<SkeletonProps & { width?: string | number; height?: string | number }> = ({
  className = '',
  style = {},
  width = '70px',
  height = '24px'
}) => (
  <div
    className={`aether-skeleton aether-skeleton-pill ${className}`}
    style={{
      width,
      height,
      borderRadius: 'var(--radius-pill)',
      ...style
    }}
  />
);

/**
 * Constellation Graph Canvas Skeleton (Particles Casberry inspired)
 */
export const SkeletonGraphCanvas: React.FC = () => {
  return (
    <div
      className="w-100 h-100 d-flex flex-column align-items-center justify-content-center position-relative overflow-hidden"
      style={{
        background: 'var(--bg-primary)',
        backgroundImage: 'radial-gradient(var(--dot-grid-color, rgba(255, 255, 255, 0.05)) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }}
    >
      <svg
        className="w-100 h-100 position-absolute"
        style={{ opacity: 0.85 }}
        viewBox="0 0 800 600"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="linkShimmer" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.1" />
            <stop offset="50%" stopColor="var(--accent-secondary)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Constellation Synaptic Link Lines */}
        <g stroke="url(#linkShimmer)" strokeWidth="1.5" strokeDasharray="3 3">
          <line x1="400" y1="300" x2="310" y2="210" className="aether-pulse-line" />
          <line x1="400" y1="300" x2="520" y2="240" className="aether-pulse-line" />
          <line x1="400" y1="300" x2="480" y2="390" className="aether-pulse-line" />
          <line x1="400" y1="300" x2="330" y2="380" className="aether-pulse-line" />
          <line x1="310" y1="210" x2="230" y2="280" className="aether-pulse-line" />
          <line x1="520" y1="240" x2="610" y2="310" className="aether-pulse-line" />
          <line x1="480" y1="390" x2="560" y2="440" className="aether-pulse-line" />
          <line x1="330" y1="380" x2="260" y2="430" className="aether-pulse-line" />
        </g>

        {/* Floating Glowing Particle Nodes */}
        <g>
          {/* Central Hub Node */}
          <circle cx="400" cy="300" r="18" fill="url(#nodeGlow)" />
          <circle cx="400" cy="300" r="8" fill="var(--accent-primary)" className="aether-node-pulse" />

          {/* Orbiting Satellite Nodes */}
          <circle cx="310" cy="210" r="6" fill="var(--accent-secondary)" className="aether-node-pulse" />
          <circle cx="520" cy="240" r="6.5" fill="var(--accent-gold, #f59e0b)" className="aether-node-pulse" />
          <circle cx="480" cy="390" r="5.5" fill="var(--accent-primary)" className="aether-node-pulse" />
          <circle cx="330" cy="380" r="6" fill="var(--node-emerald, #10b981)" className="aether-node-pulse" />
          <circle cx="230" cy="280" r="4.5" fill="var(--text-muted)" className="aether-node-pulse" />
          <circle cx="610" cy="310" r="5" fill="var(--accent-secondary)" className="aether-node-pulse" />
          <circle cx="560" cy="440" r="4" fill="var(--accent-primary)" className="aether-node-pulse" />
          <circle cx="260" cy="430" r="4.5" fill="var(--accent-gold, #f59e0b)" className="aether-node-pulse" />
        </g>
      </svg>

      {/* Ambient Status Label */}
      <div
        className="d-flex align-items-center gap-2 px-3 py-1 rounded-pill"
        style={{
          zIndex: 2,
          background: 'var(--surface-hud)',
          border: '1px solid var(--border-color)',
          backdropFilter: 'blur(16px)',
          boxShadow: 'var(--shadow-md)',
          color: 'var(--text-secondary)',
          fontSize: '0.8rem',
          fontWeight: 500,
          marginTop: '180px'
        }}
      >
        <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} className="aether-spin-slow" />
        <span>Synthesizing Knowledge Graph�</span>
      </div>
    </div>
  );
};

/**
 * Note Editor Shimmer Skeleton
 */
export const SkeletonEditor: React.FC = () => {
  return (
    <div className="w-100 h-100 d-flex flex-column p-4" style={{ background: 'var(--surface-card)', gap: '16px' }}>
      {/* Title placeholder */}
      <SkeletonBlock width="55%" height="32px" radius="6px" />

      {/* Metadata pills placeholder */}
      <div className="d-flex gap-2 align-items-center">
        <SkeletonPill width="80px" height="26px" />
        <SkeletonPill width="65px" height="26px" />
        <SkeletonPill width="110px" height="26px" />
      </div>

      <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 0' }} />

      {/* Note Content lines */}
      <div className="d-flex flex-column gap-2 pt-2">
        <SkeletonBlock width="92%" height="16px" />
        <SkeletonBlock width="84%" height="16px" />
        <SkeletonBlock width="96%" height="16px" />
        <SkeletonBlock width="60%" height="16px" />
        <div style={{ height: '12px' }} />
        <SkeletonBlock width="88%" height="16px" />
        <SkeletonBlock width="78%" height="16px" />
        <SkeletonBlock width="94%" height="16px" />
        <SkeletonBlock width="45%" height="16px" />
      </div>
    </div>
  );
};

/**
 * AI Cognitive Card Shimmer Skeleton
 */
export const SkeletonAiSummary: React.FC = () => {
  return (
    <div
      className="p-3 rounded-3 d-flex flex-column gap-2"
      style={{
        background: 'var(--surface-pill-bg)',
        border: '1px solid var(--border-color)'
      }}
    >
      <div className="d-flex align-items-center justify-content-between mb-1">
        <div className="d-flex align-items-center gap-2">
          <Sparkles size={14} style={{ color: 'var(--accent-primary)' }} className="aether-spin-slow" />
          <SkeletonBlock width="130px" height="14px" />
        </div>
        <SkeletonPill width="50px" height="18px" />
      </div>
      <SkeletonBlock width="95%" height="13px" />
      <SkeletonBlock width="88%" height="13px" />
      <SkeletonBlock width="60%" height="13px" />
    </div>
  );
};

export const Skeleton = (props: SkeletonProps & { width?: string | number; height?: string | number; radius?: string | number }) => <SkeletonBlock {...props} />;
Skeleton.Block = SkeletonBlock;
Skeleton.Pill = SkeletonPill;
Skeleton.GraphCanvas = SkeletonGraphCanvas;
Skeleton.Editor = SkeletonEditor;
Skeleton.AiSummary = SkeletonAiSummary;
