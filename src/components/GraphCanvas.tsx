/**
 * @file GraphCanvas.tsx
 * @description High-performance interactive HTML5 Canvas & D3 force-directed knowledge graph visualization for AetherMind.
 * Features hardware-accelerated 60fps rendering, physics simulation (link force, charge repulsion, collision avoidance),
 * NLP embedding clustering, smooth zoom/pan navigation, mouse and pointer-captured touch dragging, animated flow connections,
 * heatmap node visit glows, edge explanation tooltips with AI reasoning, and SVG/PNG/ZIP export utilities.
 * @module components/GraphCanvas
 */

import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { db, type Note, type Link, type Category } from '../db';
import { updateNote } from '../db/helpers';
import { HelpCircle, PanelLeft, Download, Search } from 'lucide-react';
import { cosineSimilarity } from '../utils/vectorSearch';
import { callAI } from '../utils/aiClient';

/**
 * Props for the {@link GraphCanvas} component.
 *
 * @interface GraphCanvasProps
 * @property {Note[]} notes - List of note entities to render as graph nodes.
 * @property {Link[]} links - List of directional/undirected graph link connections.
 * @property {Category[]} categories - Available categories for color assignments.
 * @property {Note | null} activeNote - Currently selected note in the editor, if any.
 * @property {(note: Note | null) => void} onSelectNote - Callback invoked when a node is clicked or background is deselected.
 * @property {(x: number, y: number) => void} onCreateNote - Callback invoked when empty canvas space is double-clicked.
 * @property {string} searchQuery - Active text query string for dimming unmatched nodes.
 * @property {string[]} selectedTags - Active tags for filtering visible graph nodes.
 * @property {[number, number] | null} dateRange - Active timestamp range for chronological filtering.
 * @property {{ linkDistance: number; chargeStrength: number }} physicsConfig - Configurable D3 physics parameters.
 * @property {boolean} isSidebarOpen - Whether the note editor sidebar is currently visible.
 * @property {() => void} onOpenSidebar - Callback to open the editor sidebar.
 * @property {() => void} [onOpenSearch] - Callback to toggle the search filter overlay.
 * @property {() => void} [onCloseSearch] - Callback to dismiss the search filter overlay.
 * @property {boolean} [nlpClustering] - Whether to synthesize soft gravitational forces between semantically similar embeddings.
 * @property {string} [pageTitle] - Title of the active page for export naming.
 */
interface GraphCanvasProps {
  notes: Note[];
  links: Link[];
  categories: Category[];
  activeNote: Note | null;
  onSelectNote: (note: Note | null) => void;
  onCreateNote: (x: number, y: number) => void;
  searchQuery: string;
  selectedTags: string[];
  dateRange: [number, number] | null;
  physicsConfig: { linkDistance: number; chargeStrength: number };
  isSidebarOpen: boolean;
  onOpenSidebar: () => void;
  onOpenSearch?: () => void;
  onCloseSearch?: () => void;
  nlpClustering?: boolean;
  pageTitle?: string;
}

/**
 * D3 simulation node datum extending base node properties with physics simulation state.
 *
 * @interface SimNode
 * @extends {d3.SimulationNodeDatum}
 * @property {number} id - Unique note ID.
 * @property {string} title - Note headline.
 * @property {string} category - Category identifier.
 * @property {string[]} tags - Associated metadata tags.
 * @property {number} createdAt - Creation timestamp.
 * @property {string} [color] - Optional custom node color override.
 * @property {boolean} isDimmed - Whether the node is grayed out due to search/tag/history filters.
 * @property {number} radius - Computed visual circle radius based on graph degree.
 * @property {number} visits - Number of times the note has been opened (powers heatmap glow).
 * @property {number | null} [__originalFx] - Pre-drag fixed X position.
 * @property {number | null} [__originalFy] - Pre-drag fixed Y position.
 * @property {boolean} [__wasDragged] - Distinguishes actual movement drag from quick clicks.
 * @property {boolean} [__wasUnpinned] - Flags long-press unpinning action.
 * @property {number} [__startX] - Starting screen X coordinate for drag thresholding.
 * @property {number} [__startY] - Starting screen Y coordinate for drag thresholding.
 */
interface SimNode extends d3.SimulationNodeDatum {
  id: number;
  title: string;
  category: string;
  tags: string[];
  createdAt: number;
  color?: string;
  isDimmed: boolean;
  radius: number;
  visits: number;
  __originalFx?: number | null;
  __originalFy?: number | null;
  __wasDragged?: boolean;
  __wasUnpinned?: boolean;
  __startX?: number;
  __startY?: number;
}

/**
 * GraphCanvas Component
 *
 * Renders the primary 2D force-directed knowledge graph on an HTML5 `<canvas>`.
 * Manages simulation forces, responsive canvas resizing, gesture transformations,
 * and high-performance canvas batch drawing.
 *
 * @component
 * @param {GraphCanvasProps} props - Component properties.
 * @returns {React.ReactElement} The rendered canvas container and control overlay.
 */
export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  notes,
  links,
  categories,
  activeNote,
  onSelectNote,
  onCreateNote,
  searchQuery,
  selectedTags,
  dateRange,
  physicsConfig,
  isSidebarOpen,
  onOpenSidebar,
  onOpenSearch,
  onCloseSearch,
  nlpClustering,
  pageTitle
}) => {
  /** Tracks mobile breakpoint for touch-specific UI adaptations. */
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  /** Container DOM ref for observing layout dimensions. */
  const containerRef = useRef<HTMLDivElement>(null);

  /** Primary HTML5 Canvas DOM ref. */
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /** Responsive pixel dimensions for the canvas element. */
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });

  /** Current D3 Zoom & Pan transform state. */
  const [transform, setTransform] = useState(d3.zoomIdentity);

  /** Ref flag to coordinate between D3 Zoom behavior and custom node dragging. */
  const isNodeDraggingRef = useRef(false);

  /**
   * Cached Theme Colors ref to prevent style recalculation layout thrashing during the 60fps render loop.
   */
  const themeColorsRef = useRef({
    bgPrimary: '#06071a',
    textPrimary: '#ffffff',
    textSecondary: '#d1d5db',
    linkColor: 'rgba(255, 255, 255, 0.25)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    activeRing: 'rgba(255, 255, 255, 0.4)',
    pinnedRing: '#ffffff'
  });

  /**
   * Observes theme changes and updates cached color values for canvas drawing.
   */
  useEffect(() => {
    const updateThemeColors = () => {
      const styles = getComputedStyle(document.documentElement);
      
      const bgPrimary = styles.getPropertyValue('--bg-primary').trim() || '#06071a';
      const textPrimary = styles.getPropertyValue('--text-primary').trim() || '#ffffff';
      const textSecondary = styles.getPropertyValue('--text-secondary').trim() || '#d1d5db';
      const linkColor = styles.getPropertyValue('--link-color').trim() || 'rgba(255, 255, 255, 0.25)';
      const borderColor = styles.getPropertyValue('--border-color').trim() || 'rgba(255, 255, 255, 0.08)';
      
      /** Computes luminance from hex string to adapt active rings for light vs dark palettes. */
      const getLuminance = (hex: string) => {
        const c = hex.replace('#', '').trim();
        if (c.length === 3) {
          const r = parseInt(c[0] + c[0], 16);
          const g = parseInt(c[1] + c[1], 16);
          const b = parseInt(c[2] + c[2], 16);
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        }
        if (c.length === 6) {
          const r = parseInt(c.substring(0, 2), 16);
          const g = parseInt(c.substring(2, 4), 16);
          const b = parseInt(c.substring(4, 6), 16);
          return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        }
        return 0;
      };

      const isLightBg = getLuminance(bgPrimary) > 0.5 || textPrimary === '#0f172a' || textPrimary === '#5c4033' || styles.getPropertyValue('color-scheme').trim() === 'light';
      const activeRing = isLightBg ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.4)';
      const pinnedRing = isLightBg ? '#000000' : '#ffffff';

      themeColorsRef.current = {
        bgPrimary,
        textPrimary,
        textSecondary,
        linkColor,
        borderColor,
        activeRing,
        pinnedRing
      };
    };

    let rafId: number | null = null;
    const scheduleUpdate = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateThemeColors();
        rafId = null;
      });
    };

    updateThemeColors();

    const observer = new MutationObserver(() => {
      scheduleUpdate();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'style']
    });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  /** Visibility state for keyboard shortcuts / canvas syntax modal. */
  const [showHelp, setShowHelp] = useState(false);

  /** Tooltip state for displaying AI link explanations on edge hover. */
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    loading: boolean;
    text: string;
    linkId?: number;
  }>({ visible: false, x: 0, y: 0, loading: false, text: '' });

  /**
   * Exports graph data into SVG vector graphic, PNG image raster, or full ZIP archive with Markdown notes.
   *
   * @param {'svg' | 'png' | 'zip'} format - Target file export format.
   */
  const handleExport = async (format: 'svg' | 'png' | 'zip') => {
    if (format === 'zip') {
      try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        // Save structured graph schema
        zip.file('graph_data.json', JSON.stringify({ notes, links }, null, 2));
        
        // Save individual markdown files
        const notesFolder = zip.folder('notes');
        notes.forEach(note => {
          const safeTitle = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          notesFolder?.file(`${safeTitle}.md`, `# ${note.title}\n\n${note.content}`);
        });
        
        // Render canvas snapshot as PNG attachment
        const canvas = canvasRef.current;
        if (canvas) {
          const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve));
          if (blob) {
            zip.file('graph.png', blob);
          }
        }
        
        const content = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(content);
        const a = document.createElement('a');
        a.href = url;
        const safePageName = pageTitle ? pageTitle.replace(/[^a-z0-9-]/gi, '-').toLowerCase() : 'graph';
        a.download = `aethermind-${safePageName}.zip`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Export zip failed", err);
      }
      return;
    }
    
    if (format === 'png') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        // Paint solid background color from active theme
        tempCtx.fillStyle = themeColorsRef.current.bgPrimary;
        tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
        
        // Render simulation canvas content on top
        tempCtx.drawImage(canvas, 0, 0);
        
        tempCanvas.toBlob(blob => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'aethermind-graph.png';
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    } else {
      // Export standalone SVG string with embedded transform and styling
      const sim = simulationRef.current;
      if (!sim) return;
      const currentNodes = nodesRef.current;
      const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      const currentLinks = linkForce ? (linkForce.links() as { source: SimNode; target: SimNode }[]) : [];
      
      const colors = themeColorsRef.current;
      let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" style="background-color: ${colors.bgPrimary};">`;
      svgStr += `<g transform="translate(${transform.x}, ${transform.y}) scale(${transform.k})">`;
      
      currentLinks.forEach(link => {
        const source = link.source;
        const target = link.target;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;
        svgStr += `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="${colors.linkColor}" stroke-width="1.5" />`;
      });
      
      currentNodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;
        const categoryObj = categories.find(c => c.id === node.category);
        const color = node.color || categoryObj?.color || '#818cf8';
        svgStr += `<circle cx="${node.x}" cy="${node.y}" r="${node.radius}" fill="${color}" />`;
        svgStr += `<text x="${node.x}" y="${node.y + 16}" fill="${colors.textSecondary}" font-family="Inter" font-size="12" font-weight="500" text-anchor="middle" dominant-baseline="hanging">${node.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
      });
      
      svgStr += `</g></svg>`;
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'aethermind-graph.svg';
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  /** Reference holding array of simulation nodes across render cycles. */
  const nodesRef = useRef<SimNode[]>([]);

  /** Reference holding active D3 ForceSimulation instance. */
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);

  /** Tracks previous graph topology signature to prevent redundant simulation resets. */
  const prevTopology = useRef({ nodes: "", links: "", linkDist: 0, charge: 0 });

  /** AbortController ref for in-flight tooltip AI reasoning calls. */
  const tooltipAbortRef = useRef<AbortController | null>(null);

  /** Monotonically increasing ID to prevent stale tooltip responses. */
  const tooltipGenId = useRef(0);

  /**
   * Observe container element bounds and update canvas pixel dimensions accordingly.
   */
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  /**
   * Initializes or updates D3 physics forces (link distance, charge strength, centering, collision).
   */
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    if (!simulationRef.current) {
      const sim = d3.forceSimulation<SimNode>()
        .force('link', d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>().id(d => d.id).distance(physicsConfig.linkDistance).strength(0.05))
        .force('nlpLink', d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>().id(d => d.id).distance(physicsConfig.linkDistance * 1.5).strength(0.01))
        .force('charge', d3.forceManyBody().strength(physicsConfig.chargeStrength))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force('collision', d3.forceCollide().radius(45));
      simulationRef.current = sim;
    } else {
      const sim = simulationRef.current;
      const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      if (linkForce) linkForce.distance(physicsConfig.linkDistance);
      const chargeForce = sim.force('charge') as d3.ForceManyBody<SimNode>;
      if (chargeForce) chargeForce.strength(physicsConfig.chargeStrength);
    }

    simulationRef.current.force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2));
  }, [dimensions, physicsConfig.linkDistance, physicsConfig.chargeStrength]);

  /**
   * Synchronizes database notes and links into SimNodes, applies search/tag/date filters,
   * calculates NLP embedding gravity links, and restarts simulation when graph topology changes.
   */
  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;

    const lowerQuery = searchQuery.toLowerCase().trim();
    
    const linkCounts: Record<number, number> = {};
    const neighborhood = new Set<number>();
    
    if (activeNote) {
      neighborhood.add(activeNote.id!);
    }

    links.forEach(l => {
      linkCounts[l.targetId] = (linkCounts[l.targetId] || 0) + 1;
      linkCounts[l.sourceId] = (linkCounts[l.sourceId] || 0) + 1;
      
      if (activeNote) {
        if (l.sourceId === activeNote.id) neighborhood.add(l.targetId);
        if (l.targetId === activeNote.id) neighborhood.add(l.sourceId);
      }
    });

    const processedNodes: SimNode[] = notes.map((note) => {
      const existing = nodesRef.current.find(n => n.id === note.id);
      
      const searchMatch = !lowerQuery || 
        note.title.toLowerCase().includes(lowerQuery) || 
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some(t => t.toLowerCase().includes(lowerQuery));

      const tagMatch = selectedTags.length === 0 || 
        selectedTags.every(t => note.tags.includes(t));

      const dateMatch = !dateRange || 
        (note.createdAt >= dateRange[0] && note.createdAt <= dateRange[1]);

      let isDimmed = !(searchMatch && tagMatch && dateMatch);
      if (activeNote && !neighborhood.has(note.id!)) {
        isDimmed = true;
      }

      const degree = linkCounts[note.id!] || 0;
      const radius = 10 + Math.min(20, degree * 1.5);

      return {
        id: note.id!,
        title: note.title,
        category: note.category,
        tags: note.tags,
        createdAt: note.createdAt,
        color: note.color,
        isDimmed,
        radius,
        visits: note.visits || 0,
        x: existing?.x ?? note.fx ?? (dimensions.width / 2 + (Math.random() - 0.5) * 50),
        y: existing?.y ?? note.fy ?? (dimensions.height / 2 + (Math.random() - 0.5) * 50),
        vx: existing?.vx ?? 0,
        vy: existing?.vy ?? 0,
        fx: existing?.fx !== undefined ? existing.fx : (note.fx ?? null),
        fy: existing?.fy !== undefined ? existing.fy : (note.fy ?? null)
      };
    });

    nodesRef.current = processedNodes;
    sim.nodes(processedNodes);

    const validLinks = links
      .map(l => {
        const sourceNode = processedNodes.find(n => n.id === l.sourceId);
        const targetNode = processedNodes.find(n => n.id === l.targetId);
        if (sourceNode && targetNode) {
          return { id: l.id, source: sourceNode, target: targetNode };
        }
        return null;
      })
      .filter((l): l is { id: number | undefined; source: SimNode; target: SimNode } => l !== null);

    // Compute semantic cosine similarity clustering forces if enabled
    if (nlpClustering) {
      const notesWithEmbeddings = notes.filter(n => n.embedding);
      const nlpLinks: { source: SimNode; target: SimNode }[] = [];
      for (let i = 0; i < notesWithEmbeddings.length; i++) {
        for (let j = i + 1; j < notesWithEmbeddings.length; j++) {
          const a = notesWithEmbeddings[i];
          const b = notesWithEmbeddings[j];
          if (!a.embedding || !b.embedding) continue;
          const score = cosineSimilarity(a.embedding, b.embedding);
          if (score > 0.65) {
            const sourceNode = processedNodes.find(n => n.id === a.id);
            const targetNode = processedNodes.find(n => n.id === b.id);
            if (sourceNode && targetNode && !validLinks.some(l => l.source.id === a.id && l.target.id === b.id || l.source.id === b.id && l.target.id === a.id)) {
              nlpLinks.push({ source: sourceNode, target: targetNode });
            }
          }
        }
      }
      const nlpLinkForce = sim.force('nlpLink') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      if (nlpLinkForce) nlpLinkForce.links(nlpLinks);
    } else {
      const nlpLinkForce = sim.force('nlpLink') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      if (nlpLinkForce) nlpLinkForce.links([]);
    }

    const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
    if (linkForce) linkForce.links(validLinks);

    const currentTopology = {
      nodes: notes.map(n => n.id).sort().join(','),
      links: links.map(l => l.id).sort().join(','),
      linkDist: physicsConfig.linkDistance,
      charge: physicsConfig.chargeStrength
    };

    const shouldRestart = 
      prevTopology.current.nodes !== currentTopology.nodes ||
      prevTopology.current.links !== currentTopology.links ||
      prevTopology.current.linkDist !== currentTopology.linkDist ||
      prevTopology.current.charge !== currentTopology.charge;

    if (shouldRestart) {
      sim.alpha(0.2).restart();
      prevTopology.current = currentTopology;
    }
  }, [notes, links, dimensions, searchQuery, selectedTags, dateRange, activeNote, categories, nlpClustering, physicsConfig.linkDistance, physicsConfig.chargeStrength]);

  /**
   * Main 60fps Canvas 2D Rendering Loop
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const draw = () => {
      ctx.clearRect(0, 0, dimensions.width, dimensions.height);
      ctx.save();

      // Apply zoom & pan transformations
      ctx.translate(transform.x, transform.y);
      ctx.scale(transform.k, transform.k);

      const sim = simulationRef.current;
      if (!sim) {
        ctx.restore();
        return;
      }

      const activeNodeId = activeNote?.id;
      const currentNodes = nodesRef.current;
      const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      const currentLinks = linkForce ? (linkForce.links() as { source: SimNode; target: SimNode }[]) : [];

      // 1. Draw Links
      currentLinks.forEach((link) => {
        const source = link.source;
        const target = link.target;

        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;

        const isSourceActive = source.id === activeNodeId;
        const isTargetActive = target.id === activeNodeId;
        const isConnectionActive = isSourceActive || isTargetActive;

        ctx.beginPath();
        ctx.moveTo(source.x, source.y);
        ctx.lineTo(target.x, target.y);

        // Link appearance and flow styling
        if (source.isDimmed || target.isDimmed) {
          ctx.strokeStyle = themeColorsRef.current.linkColor;
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
          ctx.globalAlpha = 0.1;
        } else if (isConnectionActive) {
          ctx.globalAlpha = 1.0;
          // Glow highlighting for connected notes
          const activeColor = activeNote?.color || categories.find(c => c.id === activeNote?.category)?.color || '#818cf8';
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 2;
          // Dashed animated offset for active graph flow
          const dashOffset = (Date.now() / 80) % 20;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = -dashOffset;
        } else {
          ctx.globalAlpha = 0.6;
          ctx.strokeStyle = themeColorsRef.current.linkColor;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.globalAlpha = 1.0;
      });

      // Reset dash before drawing nodes
      ctx.setLineDash([]);

      // 2. Draw Nodes
      currentNodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;

        const isActive = node.id === activeNodeId;
        const opacity = node.isDimmed ? 0.15 : 1.0;

        ctx.save();
        ctx.globalAlpha = opacity;

        // Choose color based on category or node.color override
        const categoryObj = categories.find(c => c.id === node.category);
        let color = categoryObj?.color || '#818cf8';
        if (node.color) color = node.color;

        // Render glow bloom
        if (!node.isDimmed) {
          // Heatmap effect: more visits = brighter glow
          const heatmapIntensity = Math.min(20, node.visits * 2);
          
          // Animated breathing pulse
          const time = Date.now() / 1000;
          const pulsingBloom = Math.sin(time * 2 + node.id) * 6;
          
          ctx.shadowBlur = isActive ? 24 + pulsingBloom + heatmapIntensity : 12 + (pulsingBloom/2) + heatmapIntensity;
          ctx.shadowColor = color;
          ctx.globalCompositeOperation = 'lighter';
        }

        // Draw Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, isActive ? node.radius + 4 : node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();
        
        ctx.globalCompositeOperation = 'source-over';

        // Draw pinned ring if node is locked in place
        if (node.fx !== null && node.fx !== undefined) {
          ctx.strokeStyle = themeColorsRef.current.pinnedRing;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isActive ? node.radius + 8 : node.radius + 4, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Draw Active Ring highlight
        if (isActive) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = themeColorsRef.current.activeRing;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 10, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // 3. Draw Labels with background stroke for readability
        ctx.shadowBlur = 0;
        ctx.shadowColor = 'transparent';
        ctx.font = '500 12px ' + getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'Inter';
        ctx.fillStyle = isActive ? themeColorsRef.current.textPrimary : themeColorsRef.current.textSecondary;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        ctx.strokeStyle = themeColorsRef.current.bgPrimary;
        ctx.lineWidth = 3;
        ctx.strokeText(node.title, node.x, node.y + (isActive ? 24 : 16));
        ctx.fillText(node.title, node.x, node.y + (isActive ? 24 : 16));

        ctx.restore();
      });

      ctx.restore();
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [dimensions, transform, activeNote, searchQuery, selectedTags, dateRange, categories]);

  /** State ref ensuring event listeners access latest state without re-attaching listeners */
  const stateRef = useRef({ transform, notes, links, activeNote, onCreateNote, onSelectNote });
  useEffect(() => {
    stateRef.current = { transform, notes, links, activeNote, onCreateNote, onSelectNote };
  });

  /**
   * Binds D3 Drag, Zoom, Pointer capture, and click/double-click listeners to the canvas element.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Zoom and pan setup
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        if (event.ctrlKey || event.button) return false;
        
        // If node is currently being dragged, ignore zoom
        if (isNodeDraggingRef.current) return false;
        
        if (event.type === 'mousedown' || event.type === 'touchstart' || event.type === 'pointerdown') {
          const [clickX, clickY] = d3.pointer(event, canvas);
          
          const currentTransform = d3.zoomTransform(canvas);
          const simX = (clickX - currentTransform.x) / currentTransform.k;
          const simY = (clickY - currentTransform.y) / currentTransform.k;
          
          const state = stateRef.current;
          for (let i = nodesRef.current.length - 1; i >= 0; i--) {
            const node = nodesRef.current[i];
            if (node.x === undefined || node.y === undefined) continue;
            const dx = node.x - simX;
            const dy = node.y - simY;
            const isTouch = event.type === 'touchstart' || (event as PointerEvent).pointerType === 'touch';
            let clickRadius = node.id === state.activeNote?.id ? node.radius + 4 : node.radius;
            if (isTouch || window.matchMedia('(pointer: coarse)').matches) {
              clickRadius = node.radius + 20; // Expanded hit target for touch
            }
            if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
              return false; // Prevent zoom/pan, permit drag
            }
          }
        }
        
        return true;
      })
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    // Pointer variables for distinguishing clicks vs drags vs long-press unpins
    let pointerStartX = 0;
    let pointerStartY = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;

    /** Handles pointer down and sets up long-press timer for touch unpinning */
    const handlePointerDown = (event: PointerEvent) => {
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      isLongPress = false;

      if (event.pointerType === 'touch' || window.innerWidth < 768) {
        longPressTimer = setTimeout(() => {
          isLongPress = true;
          const rect = canvas.getBoundingClientRect();
          const clickX = pointerStartX - rect.left;
          const clickY = pointerStartY - rect.top;
          const currentTransform = d3.zoomTransform(canvas);
          const simX = (clickX - currentTransform.x) / currentTransform.k;
          const simY = (clickY - currentTransform.y) / currentTransform.k;
          
          const clickedNode = nodesRef.current.find((node) => {
            if (node.x === undefined || node.y === undefined) return false;
            const dx = node.x - simX;
            const dy = node.y - simY;
            return Math.sqrt(dx * dx + dy * dy) < node.radius + 15;
          });

          // If long-pressed pinned node: unpin it
          if (clickedNode && clickedNode.fx !== null) {
            clickedNode.fx = null;
            clickedNode.fy = null;
            clickedNode.__wasUnpinned = true;
            updateNote(clickedNode.id, { fx: null, fy: null });
            if (simulationRef.current) {
              simulationRef.current.alpha(0.3).restart();
            }
            if (navigator.vibrate) navigator.vibrate(50);
          }
        }, 500);
      }
    };

    /** Handles clicking nodes or background */
    const handlePointerClick = (clickX: number, clickY: number, isTouch: boolean) => {
      const currentTransform = d3.zoomTransform(canvas);
      const simX = (clickX - currentTransform.x) / currentTransform.k;
      const simY = (clickY - currentTransform.y) / currentTransform.k;

      const state = stateRef.current;
      const clickedNode = nodesRef.current.find((node) => {
        if (node.x === undefined || node.y === undefined) return false;
        const dx = node.x - simX;
        const dy = node.y - simY;
        let clickRadius = node.id === state.activeNote?.id ? node.radius + 4 : node.radius;
        if (isTouch || window.matchMedia('(pointer: coarse)').matches) {
          clickRadius += 8;
        }
        return Math.sqrt(dx * dx + dy * dy) < clickRadius;
      });

      if (clickedNode) {
        const note = state.notes.find(n => n.id === clickedNode.id);
        if (note) setTimeout(() => state.onSelectNote(note), 0);
      } else {
        setTimeout(() => state.onSelectNote(null), 0);
      }
    };

    /** Handles pointer up to verify click thresholds */
    const handlePointerUp = (event: PointerEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (isLongPress) return;

      const deltaX = event.clientX - pointerStartX;
      const deltaY = event.clientY - pointerStartY;
      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) < 10) {
        const rect = canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        const isTouch = event.pointerType === 'touch';
        handlePointerClick(clickX, clickY, isTouch);
      }
    };

    /** Handles hovering over edges to calculate nearest link and trigger AI explanation tooltip */
    const handlePointerMove = (event: PointerEvent) => {
      if (longPressTimer) {
        const deltaX = event.clientX - pointerStartX;
        const deltaY = event.clientY - pointerStartY;
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 10) {
          clearTimeout(longPressTimer);
          longPressTimer = null;
        }
      }
      if (event.buttons > 0) return;
      const rect = canvas.getBoundingClientRect();
      const clientX = event.clientX - rect.left;
      const clientY = event.clientY - rect.top;

      const currentTransform = d3.zoomTransform(canvas);
      const simX = (clientX - currentTransform.x) / currentTransform.k;
      const simY = (clientY - currentTransform.y) / currentTransform.k;

      // Ignore links when hovering directly over nodes
      const isOverNode = nodesRef.current.some(node => {
        if (node.x === undefined || node.y === undefined) return false;
        const dx = node.x - simX;
        const dy = node.y - simY;
        return Math.sqrt(dx * dx + dy * dy) < node.radius + 5;
      });

      if (isOverNode) {
        setTooltip(prev => prev.visible ? { ...prev, visible: false, linkId: undefined } : prev);
        return;
      }

      const sim = simulationRef.current;
      if (!sim) return;
      const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      const currentLinks = linkForce ? (linkForce.links() as { id: number, source: SimNode; target: SimNode }[]) : [];

      let closestLink: { id: number, source: SimNode; target: SimNode } | null = null;
      let minDistance = 10 / currentTransform.k;

      // Vector point-to-segment distance algorithm
      for (const link of currentLinks) {
        if (link.source.x === undefined || link.source.y === undefined || link.target.x === undefined || link.target.y === undefined) continue;
        
        const A = simX - link.source.x;
        const B = simY - link.source.y;
        const C = link.target.x - link.source.x;
        const D = link.target.y - link.source.y;
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        if (len_sq !== 0) param = dot / len_sq;
        let xx, yy;
        if (param < 0) {
          xx = link.source.x;
          yy = link.source.y;
        } else if (param > 1) {
          xx = link.target.x;
          yy = link.target.y;
        } else {
          xx = link.source.x + param * C;
          yy = link.source.y + param * D;
        }
        const dx = simX - xx;
        const dy = simY - yy;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < minDistance) {
          minDistance = distance;
          closestLink = link;
        }
      }

      if (closestLink) {
        setTooltip(prev => {
          if (prev.visible && prev.linkId === closestLink!.id) {
            return prev;
          }
          const linkId = closestLink!.id;
          const sourceNode = closestLink!.source;
          const targetNode = closestLink!.target;
          
          setTimeout(async () => {
            const linkRecord = stateRef.current.links.find(l => l.id === linkId);
            if (!linkRecord) return;

            if (linkRecord.explanation) {
              setTooltip(curr => curr.linkId === linkId ? { ...curr, loading: false, text: linkRecord.explanation! } : curr);
              return;
            }

            tooltipGenId.current += 1;
            const currentGen = tooltipGenId.current;
            tooltipAbortRef.current?.abort();
            tooltipAbortRef.current = new AbortController();
            try {
              const systemPrompt = "You are a helpful assistant. Provide a single sentence explanation.";
              const userPrompt = `Based on their titles, why are the notes "${sourceNode.title}" and "${targetNode.title}" linked?`;
              const result = await callAI(systemPrompt, userPrompt, undefined, tooltipAbortRef.current.signal);
              if (currentGen !== tooltipGenId.current) return;
              
              await db.links.update(linkId, { explanation: result });
              
              setTooltip(curr => curr.linkId === linkId ? { ...curr, loading: false, text: result } : curr);
            } catch {
              setTooltip(curr => curr.linkId === linkId ? { ...curr, loading: false, text: "Error generating explanation." } : curr);
            }
          }, 0);

          return { visible: true, x: event.clientX, y: event.clientY, loading: true, text: '', linkId: closestLink!.id };
        });
      } else {
        setTooltip(prev => prev.visible ? { ...prev, visible: false, linkId: undefined } : prev);
      }
    };

    /** Double click to create note or unpin existing node */
    const handleCanvasDblClick = (event: MouseEvent) => {
      if (window.innerWidth < 768) return; // Disable on mobile
      const rect = canvas.getBoundingClientRect();
      const clickX = event.clientX - rect.left;
      const clickY = event.clientY - rect.top;

      const currentTransform = d3.zoomTransform(canvas);
      const simX = (clickX - currentTransform.x) / currentTransform.k;
      const simY = (clickY - currentTransform.y) / currentTransform.k;

      const clickedNode = nodesRef.current.find((node) => {
        if (node.x === undefined || node.y === undefined) return false;
        const dx = node.x - simX;
        const dy = node.y - simY;
        return Math.sqrt(dx * dx + dy * dy) < node.radius + 5;
      });

      if (clickedNode) {
        // Unpin node
        if (clickedNode.fx !== null) {
          updateNote(clickedNode.id, { fx: null, fy: null });
        }
      } else {
        // Create Note at coordinates
        stateRef.current.onCreateNote(simX, simY);
      }
    };

    // Desktop Mouse Drag behavior via D3 Drag
    const dragBehavior = d3.drag<HTMLCanvasElement, unknown>()
      .filter((event) => {
        return event.type !== 'touchstart' && (event as PointerEvent).pointerType !== 'touch';
      })
      .subject((event) => {
        if (!canvasRef.current) return undefined;
        const [mouseX, mouseY] = d3.pointer(event, canvasRef.current);
        const currentTransform = d3.zoomTransform(canvasRef.current);
        const simX = (mouseX - currentTransform.x) / currentTransform.k;
        const simY = (mouseY - currentTransform.y) / currentTransform.k;
        
        const state = stateRef.current;
        const foundNode = nodesRef.current.find((node) => {
          if (node.x === undefined || node.y === undefined) return false;
          const dx = node.x - simX;
          const dy = node.y - simY;
          const clickRadius = node.id === state.activeNote?.id ? node.radius + 4 : node.radius;
          return Math.sqrt(dx * dx + dy * dy) < clickRadius;
        });

        if (foundNode && foundNode.x !== undefined && foundNode.y !== undefined) {
          return {
            x: foundNode.x * currentTransform.k + currentTransform.x,
            y: foundNode.y * currentTransform.k + currentTransform.y,
            node: foundNode
          };
        }
        return undefined;
      })
      .on('start', (event) => {
        if (!simulationRef.current) return;
        if (!event.active) simulationRef.current.alphaTarget(0.3).restart();
        event.subject.node.__originalFx = event.subject.node.fx;
        event.subject.node.__originalFy = event.subject.node.fy;
        event.subject.node.__wasDragged = false;
        event.subject.node.__startX = event.x;
        event.subject.node.__startY = event.y;
        event.subject.node.fx = event.subject.node.x;
        event.subject.node.fy = event.subject.node.y;
      })
      .on('drag', (event) => {
        if (!canvasRef.current) return;
        const startX = event.subject.node.__startX ?? event.x;
        const startY = event.subject.node.__startY ?? event.y;
        if (Math.hypot(event.x - startX, event.y - startY) > 3) {
          event.subject.node.__wasDragged = true;
        }
        const currentTransform = d3.zoomTransform(canvasRef.current);
        const simX = (event.x - currentTransform.x) / currentTransform.k;
        const simY = (event.y - currentTransform.y) / currentTransform.k;
        event.subject.node.fx = simX;
        event.subject.node.fy = simY;
        event.subject.node.x = simX;
        event.subject.node.y = simY;
      })
      .on('end', async (event) => {
        if (!simulationRef.current) return;
        if (!event.active) simulationRef.current.alphaTarget(0);
        if (event.subject.node.__wasDragged) {
          await updateNote(event.subject.node.id, {
            fx: event.subject.node.fx,
            fy: event.subject.node.fy
          });
        } else {
          // Revert pin if it was merely a tap
          event.subject.node.fx = event.subject.node.__originalFx !== undefined ? event.subject.node.__originalFx : null;
          event.subject.node.fy = event.subject.node.__originalFy !== undefined ? event.subject.node.__originalFy : null;
        }
      });

    // Mobile Touch Drag via Pointer Capture
    let touchDragNode: SimNode | null = null;
    let touchDragPointerId: number | null = null;

    const handleTouchDragStart = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (isLongPress) return;

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      const currentTransform = d3.zoomTransform(canvas);
      const simX = (canvasX - currentTransform.x) / currentTransform.k;
      const simY = (canvasY - currentTransform.y) / currentTransform.k;

      const found = nodesRef.current.find((node) => {
        if (node.x === undefined || node.y === undefined) return false;
        const dx = node.x - simX;
        const dy = node.y - simY;
        return Math.sqrt(dx * dx + dy * dy) < node.radius + 20;
      });

      if (found) {
        touchDragNode = found;
        touchDragPointerId = event.pointerId;
        found.__originalFx = found.fx;
        found.__originalFy = found.fy;
        found.__wasDragged = false;
        found.__startX = canvasX;
        found.__startY = canvasY;
        found.fx = found.x;
        found.fy = found.y;
        isNodeDraggingRef.current = true;
        canvas.setPointerCapture(event.pointerId);
        if (simulationRef.current) simulationRef.current.alphaTarget(0.3).restart();
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };

    const handleTouchDragMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (!touchDragNode || event.pointerId !== touchDragPointerId) return;

      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }

      const rect = canvas.getBoundingClientRect();
      const canvasX = event.clientX - rect.left;
      const canvasY = event.clientY - rect.top;
      const currentTransform = d3.zoomTransform(canvas);
      const simX = (canvasX - currentTransform.x) / currentTransform.k;
      const simY = (canvasY - currentTransform.y) / currentTransform.k;

      const startX = touchDragNode.__startX ?? canvasX;
      const startY = touchDragNode.__startY ?? canvasY;
      if (Math.hypot(canvasX - startX, canvasY - startY) > 6) {
        touchDragNode.__wasDragged = true;
      }

      touchDragNode.fx = simX;
      touchDragNode.fy = simY;
      touchDragNode.x = simX;
      touchDragNode.y = simY;
      event.preventDefault();
    };

    const handleTouchDragEnd = async (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (!touchDragNode || event.pointerId !== touchDragPointerId) return;

      const node = touchDragNode;
      touchDragNode = null;
      touchDragPointerId = null;
      isNodeDraggingRef.current = false;

      if (simulationRef.current) simulationRef.current.alphaTarget(0);

      if (node.__wasDragged) {
        await updateNote(node.id, { fx: node.fx, fy: node.fy });
      } else {
        node.fx = node.__originalFx !== undefined ? node.__originalFx : null;
        node.fy = node.__originalFy !== undefined ? node.__originalFy : null;
      }
    };

    // Attach drag & zoom behaviors
    d3.select(canvas).call(dragBehavior as unknown as never);

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointerdown', handleTouchDragStart, { passive: false });
    d3.select(canvas).call(zoomBehavior);

    canvas.addEventListener('pointermove', handleTouchDragMove, { passive: false });
    canvas.addEventListener('pointerup', handleTouchDragEnd);
    canvas.addEventListener('pointercancel', handleTouchDragEnd);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('dblclick', handleCanvasDblClick);
    canvas.addEventListener('pointermove', handlePointerMove);

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointerdown', handleTouchDragStart);
      canvas.removeEventListener('pointermove', handleTouchDragMove);
      canvas.removeEventListener('pointerup', handleTouchDragEnd);
      canvas.removeEventListener('pointercancel', handleTouchDragEnd);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('dblclick', handleCanvasDblClick);
      canvas.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return (
    <div className="graph-container" ref={containerRef} id="graph-container-root">
      {/* Primary Canvas Element */}
      <canvas 
        ref={canvasRef} 
        width={dimensions.width}
        height={dimensions.height}
        className="graph-canvas" 
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
      />

      {/* Floating Canvas Controls Island */}
      <div className="canvas-controls">
        <div className="glass-pill" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 6px', boxShadow: 'var(--shadow-md)' }}>
          {!isSidebarOpen && !isMobile && (
            <button
              className="canvas-btn"
              onClick={onOpenSidebar}
              title="Open Note Editor"
              aria-label="Open Sidebar"
              style={{ borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent' }}
            >
              <PanelLeft size={15} /> <span>Editor</span>
            </button>
          )}
          {onOpenSearch && (
            <button
              className="canvas-btn"
              onClick={() => {
                if (onOpenSearch) onOpenSearch();
                setShowHelp(false);
              }}
              title="Filter and search notes"
              aria-label="Search"
              style={{ borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent' }}
            >
              <Search size={15} /> <span>{isMobile ? '' : 'Filter'}</span>
            </button>
          )}
          <button
            className="canvas-btn"
            onClick={() => {
              handleExport('zip');
              setShowHelp(false);
              if (onCloseSearch) onCloseSearch();
            }}
            title="Export graph as ZIP"
            style={{ borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent' }}
          >
            <Download size={15} /> <span>{isMobile ? '' : 'Export'}</span>
          </button>
          <button
            className="canvas-btn"
            onClick={() => {
              setShowHelp(!showHelp);
              if (onCloseSearch) onCloseSearch();
            }}
            title="Canvas shortcuts & syntax guide"
            aria-label="Controls help"
            style={{ borderRadius: 'var(--radius-pill)', border: 'none', background: 'transparent', padding: '6px' }}
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* Help Modal Popup */}
      {showHelp && (
        <div className="canvas-help-box glass-panel">
          <h3>Canvas Controls</h3>
          <ul>
            <li><strong>Drag Empty Space</strong>: Pan the view</li>
            <li><strong>Scroll Mouse</strong>: Zoom in / out</li>
            <li><strong>Drag Node</strong>: Move and pin note in place</li>
            <li><strong>Double-Click Node</strong>: Unpin note (make it float)</li>
            <li><strong>Double-Click Empty Space</strong>: Create a new note here</li>
            <li><strong>Click Node</strong>: Open note in sidebar</li>
          </ul>
          <h3 style={{ marginTop: '16px' }}>Note Syntax</h3>
          <ul>
            <li><strong>[[Title]]</strong>: Link to another note (creates graph connection)</li>
            <li><strong>**text**</strong>: Bold formatting</li>
            <li><strong>*text*</strong>: Italic formatting</li>
            <li><strong># text</strong>: Large heading</li>
            <li><strong>## text</strong>: Medium heading</li>
            <li><strong>- text</strong>: Bulleted list</li>
            <li><strong>`code`</strong>: Inline code snippet</li>
            <li><strong>```language</strong>: Multi-line code block</li>
            <li><strong>[Text](url)</strong>: External hyperlink</li>
            <li><strong>&gt; text</strong>: Blockquote</li>
            <li><strong>~~text~~</strong>: Strikethrough</li>
            <li><strong>- [ ] text</strong>: Task list checkbox</li>
          </ul>
          <button className="help-close-btn" onClick={() => setShowHelp(false)}>Close</button>
        </div>
      )}

      {/* Tooltip for Link Explanation */}
      {tooltip.visible && (
        <div style={{
          position: 'absolute',
          top: tooltip.y + 15,
          left: tooltip.x + 15,
          background: 'var(--bg-secondary)',
          border: '1px solid rgba(124, 58, 237, 0.4)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'var(--text-primary)',
          pointerEvents: 'none',
          zIndex: 1100,
          maxWidth: '300px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontSize: '14px',
          fontFamily: 'var(--font-sans)'
        }}>
          {tooltip.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', border: '2px solid var(--node-indigo, #818cf8)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Generating explanation...
            </div>
          ) : (
            <div>{tooltip.text}</div>
          )}
        </div>
      )}
    </div>
  );
};

