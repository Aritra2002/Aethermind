import React, { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';
import { db, type Note, type Link, type Category } from '../db';
import { updateNote } from '../db/helpers';
import { HelpCircle, PanelLeft, Download, Search } from 'lucide-react';
import { cosineSimilarity } from '../utils/vectorSearch';
import { callAI } from '../utils/aiClient';

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
}

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
  nlpClustering
}) => {
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 600 });
  const [transform, setTransform] = useState(d3.zoomIdentity);
  const isNodeDraggingRef = useRef(false);
  const [showHelp, setShowHelp] = useState(false);
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    loading: boolean;
    text: string;
    linkId?: number;
  }>({ visible: false, x: 0, y: 0, loading: false, text: '' });

  const handleExport = async (format: 'svg' | 'png' | 'zip') => {
    if (format === 'zip') {
      try {
        const JSZip = (await import('jszip')).default;
        const zip = new JSZip();
        
        // Save data
        zip.file('graph_data.json', JSON.stringify({ notes, links }, null, 2));
        
        // Save notes
        const notesFolder = zip.folder('notes');
        notes.forEach(note => {
          const safeTitle = note.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
          notesFolder?.file(`${safeTitle}.md`, `# ${note.title}\n\n${note.content}`);
        });
        
        // Save snapshot (PNG)
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
        a.download = 'aethermind-graph.zip';
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
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'aethermind-graph.png';
          a.click();
          URL.revokeObjectURL(url);
        }
      });
    } else {
      const sim = simulationRef.current;
      if (!sim) return;
      const currentNodes = nodesRef.current;
      const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      const currentLinks = linkForce ? (linkForce.links() as { source: SimNode; target: SimNode }[]) : [];
      
      let svgStr = `<svg xmlns="http://www.w3.org/2000/svg" width="${dimensions.width}" height="${dimensions.height}" style="background-color: #06071a;">`;
      svgStr += `<g transform="translate(${transform.x}, ${transform.y}) scale(${transform.k})">`;
      
      currentLinks.forEach(link => {
        const source = link.source;
        const target = link.target;
        if (source.x === undefined || source.y === undefined || target.x === undefined || target.y === undefined) return;
        svgStr += `<line x1="${source.x}" y1="${source.y}" x2="${target.x}" y2="${target.y}" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" />`;
      });
      
      currentNodes.forEach(node => {
        if (node.x === undefined || node.y === undefined) return;
        const categoryObj = categories.find(c => c.id === node.category);
        const color = node.color || categoryObj?.color || '#818cf8';
        svgStr += `<circle cx="${node.x}" cy="${node.y}" r="${node.radius}" fill="${color}" />`;
        svgStr += `<text x="${node.x}" y="${node.y + 16}" fill="#e5e7eb" font-family="Inter" font-size="12" font-weight="500" text-anchor="middle" dominant-baseline="hanging">${node.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</text>`;
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

  // Maintain persistent node positions across re-renders
  const nodesRef = useRef<SimNode[]>([]);
  const simulationRef = useRef<d3.Simulation<SimNode, undefined> | null>(null);
  const prevTopology = useRef({ nodes: "", links: "", linkDist: 0, charge: 0 });

  // Handle window resizing
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

  // Sync simulation nodes and links
  useEffect(() => {
    if (dimensions.width === 0 || dimensions.height === 0) return;

    // Create the simulation if it doesn't exist
    if (!simulationRef.current) {
      const sim = d3.forceSimulation<SimNode>()
        .force('link', d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>().id(d => d.id).distance(physicsConfig.linkDistance).strength(0.05))
        .force('nlpLink', d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>().id(d => d.id).distance(physicsConfig.linkDistance * 1.5).strength(0.01))
        .force('charge', d3.forceManyBody().strength(physicsConfig.chargeStrength))
        .force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2))
        .force('collision', d3.forceCollide().radius(45));
      simulationRef.current = sim;
    } else {
      // Update forces if config changed
      const sim = simulationRef.current;
      const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      if (linkForce) linkForce.distance(physicsConfig.linkDistance);
      const chargeForce = sim.force('charge') as d3.ForceManyBody<SimNode>;
      if (chargeForce) chargeForce.strength(physicsConfig.chargeStrength);
    }

    const sim = simulationRef.current;
    sim.force('center', d3.forceCenter(dimensions.width / 2, dimensions.height / 2));

    // Determine matching dim states based on search, tags, and date range
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
      
      // Check search match
      const searchMatch = !lowerQuery || 
        note.title.toLowerCase().includes(lowerQuery) || 
        note.content.toLowerCase().includes(lowerQuery) ||
        note.tags.some(t => t.toLowerCase().includes(lowerQuery));

      // Check tag matches
      const tagMatch = selectedTags.length === 0 || 
        selectedTags.every(t => note.tags.includes(t));

      // Check date match
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
        // Retain existing coordinates or load DB coordinates
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

    // Sync links
    // Map links sourceId and targetId into matching Node references
    const validLinks = links
      .map(l => {
        const sourceNode = processedNodes.find(n => n.id === l.sourceId);
        const targetNode = processedNodes.find(n => n.id === l.targetId);
        if (sourceNode && targetNode) {
          return {
            id: l.id,
            source: sourceNode,
            target: targetNode
          };
        }
        return null;
      })
      .filter((l): l is { id: number | undefined; source: SimNode; target: SimNode } => l !== null);

    // NLP Clustering: separate force links between semantically similar notes
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
      if (nlpLinkForce) {
        nlpLinkForce.links(nlpLinks);
      }
    } else {
      const nlpLinkForce = sim.force('nlpLink') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
      if (nlpLinkForce) {
        nlpLinkForce.links([]);
      }
    }

    const linkForce = sim.force('link') as d3.ForceLink<SimNode, d3.SimulationLinkDatum<SimNode>>;
    if (linkForce) {
      linkForce.links(validLinks);
    }

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
  }, [notes, links, dimensions, physicsConfig, searchQuery, selectedTags, dateRange, activeNote, categories]);

  // Main Canvas Rendering Loop
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

        // Styling
        if (source.isDimmed || target.isDimmed) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
          ctx.lineWidth = 1;
          ctx.setLineDash([]);
        } else if (isConnectionActive) {
          // Glow highlighting for connected notes
          const activeColor = activeNote?.color || categories.find(c => c.id === activeNote?.category)?.color || '#818cf8';
          ctx.strokeStyle = activeColor;
          ctx.lineWidth = 2;
          // Dashed animation offset for flows
          const dashOffset = (Date.now() / 80) % 20;
          ctx.setLineDash([6, 4]);
          ctx.lineDashOffset = -dashOffset;
        } else {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        }

        ctx.stroke();
      });

      // Reset dash for nodes drawing
      ctx.setLineDash([]);

      // 2. Draw Nodes
      currentNodes.forEach((node) => {
        if (node.x === undefined || node.y === undefined) return;

        const isActive = node.id === activeNodeId;
        const opacity = node.isDimmed ? 0.15 : 1.0;

        ctx.save();
        ctx.globalAlpha = opacity;

        // Choose color based on category, or override with custom node.color
        const categoryObj = categories.find(c => c.id === node.category);
        let color = categoryObj?.color || '#818cf8'; // Default Indigo
        
        // Custom color override
        if (node.color) color = node.color;

        // Render Glow (Only if not dimmed)
        if (!node.isDimmed) {
          // Heatmap effect: more visits = larger/brighter glow
          const heatmapIntensity = Math.min(20, node.visits * 2);
          ctx.shadowBlur = isActive ? 18 + heatmapIntensity : 8 + heatmapIntensity;
          ctx.shadowColor = color; // Aura matches node color
        }

        // Draw Circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, isActive ? node.radius + 4 : node.radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw pinned ring
        if (node.fx !== null && node.fx !== undefined) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, isActive ? node.radius + 8 : node.radius + 4, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // Draw Active Ring highlight
        if (isActive) {
          ctx.shadowBlur = 0;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 10, 0, 2 * Math.PI);
          ctx.stroke();
        }

        // 3. Draw Labels
        ctx.shadowBlur = 0; // Clear shadow properties for text
        ctx.shadowColor = 'transparent';
        ctx.font = '500 12px Inter';
        ctx.fillStyle = isActive ? '#ffffff' : '#e5e7eb';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // Text Stroke background for readability
        ctx.strokeStyle = '#0b0f19';
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

  const stateRef = useRef({ transform, notes, links, activeNote, onCreateNote, onSelectNote });
  useEffect(() => {
    stateRef.current = { transform, notes, links, activeNote, onCreateNote, onSelectNote };
  });

  // Bind D3 Drag, Zoom, and Clicks
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Zoom setup
    const zoomBehavior = d3.zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.1, 4])
      .filter((event) => {
        // Standard D3 zoom filter (ignore right-click)
        if (event.ctrlKey || event.button) return false;
        
        // If it's a mouse down, check if we're hitting a node. If we are, ignore the zoom!
        if (isNodeDraggingRef.current) return false;
        
        if (event.type === 'mousedown' || event.type === 'touchstart' || event.type === 'pointerdown') {
          const [clickX, clickY] = d3.pointer(event, canvas);
          
          const currentTransform = d3.zoomTransform(canvas);
          const simX = (clickX - currentTransform.x) / currentTransform.k;
          const simY = (clickY - currentTransform.y) / currentTransform.k;
          
          // Check if we hit any node (similar logic to click handler)
          const state = stateRef.current;
          for (let i = nodesRef.current.length - 1; i >= 0; i--) {
            const node = nodesRef.current[i];
            if (node.x === undefined || node.y === undefined) continue;
            const dx = node.x - simX;
            const dy = node.y - simY;
            const isTouch = event.type === 'touchstart' || (event as PointerEvent).pointerType === 'touch';
            let clickRadius = node.id === state.activeNote?.id ? node.radius + 4 : node.radius;
            if (isTouch || window.matchMedia('(pointer: coarse)').matches) {
              clickRadius = node.radius + 20; // Must match handleTouchDragStart
            }
            if (Math.sqrt(dx * dx + dy * dy) < clickRadius) {
              return false; // Prevent zoom/pan, allow drag
            }
          }
        }
        
        return true;
      })
      .on('zoom', (event) => {
        setTransform(event.transform);
      });

    // Pointer click handler
    let pointerStartX = 0;
    let pointerStartY = 0;
    let longPressTimer: ReturnType<typeof setTimeout> | null = null;
    let isLongPress = false;

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
        if (note) state.onSelectNote(note);
      } else {
        state.onSelectNote(null);
      }
    };

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

            try {
              const systemPrompt = "You are a helpful assistant. Provide a single sentence explanation.";
              const userPrompt = `Based on their titles, why are the notes "${sourceNode.title}" and "${targetNode.title}" linked?`;
              const result = await callAI(systemPrompt, userPrompt);
              
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

    // Double click to create or release node
    const handleCanvasDblClick = (event: MouseEvent) => {
      if (window.innerWidth < 768) return; // disable double-click-to-create on mobile
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
        // Double-clicked empty space: Create Note
        stateRef.current.onCreateNote(simX, simY);
      }
    };

    // Drag setup — Mouse only; touch drag handled by pointer capture below
    const dragBehavior = d3.drag<HTMLCanvasElement, unknown>()
      .filter((event) => {
        // Only handle mouse events here; touch is handled manually
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
          let clickRadius = node.id === state.activeNote?.id ? node.radius + 4 : node.radius;
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
          // Tap (not drag): revert temp pin
          event.subject.node.fx = event.subject.node.__originalFx !== undefined ? event.subject.node.__originalFx : null;
          event.subject.node.fy = event.subject.node.__originalFy !== undefined ? event.subject.node.__originalFy : null;
        }
      });

    // ── Manual touch drag via pointer capture ──────────────────────────────
    let touchDragNode: SimNode | null = null;
    let touchDragPointerId: number | null = null;

    const handleTouchDragStart = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (isLongPress) return; // long-press handled separately

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
        return Math.sqrt(dx * dx + dy * dy) < node.radius + 20; // Must match zoom filter
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
        event.preventDefault(); // Stop browser scrolling/panning
        event.stopImmediatePropagation(); // Prevent D3 zoom from seeing this
      }
    };

    const handleTouchDragMove = (event: PointerEvent) => {
      if (event.pointerType !== 'touch') return;
      if (!touchDragNode || event.pointerId !== touchDragPointerId) return;

      // Cancel long-press if moving
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
        // Tap: revert temp pin
        node.fx = node.__originalFx !== undefined ? node.__originalFx : null;
        node.fy = node.__originalFy !== undefined ? node.__originalFy : null;
      }
    };


    // Call drag behavior first
    d3.select(canvas).call(dragBehavior as unknown as never);

    canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
    canvas.addEventListener('pointerdown', handleTouchDragStart, { passive: false });
    
    // Call zoom behavior AFTER our custom pointerdown listeners so we can use stopImmediatePropagation
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
      <canvas 
        ref={canvasRef} 
        width={dimensions.width}
        height={dimensions.height}
        className="graph-canvas" 
        onContextMenu={(e) => e.preventDefault()}
        style={{ touchAction: 'none', WebkitTouchCallout: 'none' }}
      />

      {/* Floating Canvas Controls */}
      {/* Floating Canvas Controls */}
      <div className="canvas-controls" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
          {!isSidebarOpen && !isMobile && (
            <button
              className="canvas-btn"
              onClick={onOpenSidebar}
              title="Open Sidebar"
              aria-label="Open Sidebar"
            >
              <PanelLeft size={16} /> Sidebar
            </button>
          )}
          {onOpenSearch && (
            <button
              className="canvas-btn"
              onClick={() => {
                if (onOpenSearch) onOpenSearch();
                setShowHelp(false);
              }}
              title="Search graph"
              aria-label="Search"
            >
              <Search size={16} /> {isMobile ? '' : 'Search'}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button
              className="canvas-btn"
              onClick={() => {
                handleExport('zip');
                setShowHelp(false);
                if (onCloseSearch) onCloseSearch();
              }}
              title="Export graph as ZIP"
            >
              <Download size={16} /> {isMobile ? '' : 'Export'}
            </button>
          </div>
          <button
            className="canvas-btn"
            onClick={() => {
              setShowHelp(!showHelp);
              if (onCloseSearch) onCloseSearch();
            }}
            title="Show controls help"
            aria-label="Controls help"
          >
            <HelpCircle size={16} /> {isMobile ? '' : 'Help'}
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
          background: 'rgba(20, 27, 50, 0.95)',
          border: '1px solid rgba(124, 58, 237, 0.4)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: 'white',
          pointerEvents: 'none',
          zIndex: 'var(--z-controls, 20)',
          maxWidth: '300px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          fontSize: '14px',
          fontFamily: 'Inter, sans-serif'
        }}>
          {tooltip.loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', border: '2px solid #818cf8', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              Generating explanation...
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <div>{tooltip.text}</div>
          )}
        </div>
      )}
    </div>
  );
};
