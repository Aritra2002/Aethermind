/**
 * ============================================================================
 * DataSettingsTab.tsx — Local-First Data Management, ML Clustering & Graph Physics
 * ============================================================================
 * 
 * Architectural Purpose:
 * Central hub for all persistence, data portability, offline machine learning,
 * category schema customization, and D3 physics simulation tuning in AetherMind.
 * 
 * Key Features:
 * - Full JSON Backup & Restore: Complete export/import of IndexedDB/Dexie tables
 *   (notes, links, categories, pages, snapshots) with transactional integrity.
 * - Standalone HTML Export: Bundles current page notes into a self-contained HTML archive.
 * - Database Reset & Re-seeding: Atomic teardown and fresh seed initialization.
 * - Client-Side ML Automation: Offline Transformers.js vector clustering to semantically
 *   group unlinked nodes and inject dynamic similarity links.
 * - Category/Tag Management: Color customization, addition of custom node taxonomies,
 *   and safe deletion with fallback defaults.
 * - Graph Versioning & Snapshots: Integration with time-travel revision checkpoints.
 * - D3 Force Simulation Physics: Real-time slider controls for spring link distance
 *   and electrostatic charge repulsion strength.
 */

import React, { useRef, useState } from 'react';
import { db } from '../../db';
import type { Category } from '../../db';
import { clusterUnlinkedNotes } from '../../utils/vectorSearch';
import { exportToHtml } from '../../utils/exportHtml';
import { seedDatabase, runDatabaseDiagnostics } from '../../db/helpers';
import { validateBackupPayload, createSafetySnapshot, type BackupValidationResult } from '../../utils/backupValidation';
import { Download, Upload, RotateCcw, Plus, Trash2, Globe, Activity } from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';
import { useToast } from '../ToastContext';

/**
 * Props for the DataSettingsTab component.
 */
interface DataSettingsTabProps {
  /** Callback fired to close the parent settings modal */
  onClose: () => void;
  /** Callback fired to re-fetch and refresh graph data in parent components */
  onRefreshData: () => void;
  /** Primary key ID of the currently active page/workspace */
  activePageId: number;
  /** Display title of the active page (used for HTML export headers) */
  pageTitle?: string;
  /** Current D3 force simulation configuration parameters */
  physicsConfig: { linkDistance: number; chargeStrength: number };
  /** Callback fired when force simulation physics parameters are modified */
  onPhysicsChange: (config: { linkDistance: number; chargeStrength: number }) => void;
  /** Complete list of registered note categories and their visual colors */
  categories: Category[];
  /** Flag indicating whether semantic NLP similarity links are rendered on the graph */
  nlpClustering: boolean;
  /** Callback fired when the semantic NLP clustering toggle is changed */
  onNlpClusteringChange: (val: boolean) => void;
  /** Optional callback to capture an instant graph snapshot for time-travel */
  onSaveSnapshot?: () => void;
  /** Optional callback to open the snapshot history browser */
  onViewSnapshots?: () => void;
}

/**
 * DataSettingsTab Component
 * 
 * Provides controls for backup/restore, offline ML clustering, category administration,
 * version checkpoints, and force-directed simulation physics.
 * 
 * @param {DataSettingsTabProps} props - Component properties.
 * @returns {React.ReactElement} The rendered data management settings view.
 */
export const DataSettingsTab: React.FC<DataSettingsTabProps> = ({
  onClose,
  onRefreshData,
  activePageId,
  pageTitle = 'Graph',
  physicsConfig,
  onPhysicsChange,
  categories,
  nlpClustering,
  onNlpClusteringChange,
  onSaveSnapshot,
  onViewSnapshots
}) => {
  const { showToast } = useToast();
  
  /** Hidden file input reference used to trigger JSON backup file selection */
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  /** State controlling visibility of the backup import confirmation modal */
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  
  /** Staged validated backup object prior to confirmation */
  const [validatedImportData, setValidatedImportData] = useState<BackupValidationResult | null>(null);
  
  /** State controlling visibility of the database reset confirmation modal */
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  
  /** Category ID staged for deletion */
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  /** Label text for a new category being created */
  const [newCatLabel, setNewCatLabel] = useState('');
  
  /** Hex color for a new category being created */
  const [newCatColor, setNewCatColor] = useState('#818cf8');
  
  /** Toggle controlling visibility of the new category creation input row */
  const [showAddCat, setShowAddCat] = useState(false);
  
  /** Loading state flag while local ML embedding and clustering calculations run */
  const [isClustering, setIsClustering] = useState(false);
  
  /** Human-readable status/progress message during ML clustering operations */
  const [clusterProgress, setClusterProgress] = useState('');

  /**
   * Exports all IndexedDB tables (notes, links, categories, pages, snapshots)
   * into a formatted JSON backup file and triggers an automatic browser download.
   */
  const handleExportData = async () => {
    try {
      const notes = await db.notes.toArray();
      const links = await db.links.toArray();
      const categoriesData = await db.categories.toArray();
      const pages = await db.pages.toArray();
      const snapshots = await db.snapshots.toArray();

      const backup = {
        version: 1,
        app: 'AetherMind',
        timestamp: Date.now(),
        notes,
        links,
        categories: categoriesData,
        pages,
        snapshots
      };

      const jsonStr = JSON.stringify(backup, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `aethermind-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      showToast(`Export failed: ${(e as Error).message}`, 'error');
    }
  };

  /**
   * Reads, parses, and deeply validates the selected JSON backup file.
   * If valid, stages the payload and opens the confirmation modal with preview statistics.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event.
   */
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    // File size guard (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      showToast('Backup file exceeds maximum allowed size (50MB).', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rawJson = JSON.parse(event.target?.result as string);
        const validation = validateBackupPayload(rawJson);

        if (!validation.valid || !validation.data) {
          showToast(validation.error || 'Invalid backup file structure.', 'error');
          return;
        }

        setValidatedImportData(validation);
        setShowImportConfirm(true);
      } catch (err: unknown) {
        showToast('Failed to parse backup JSON: ' + (err as Error).message, 'error');
      }
    };
    reader.onerror = () => {
      showToast('Error reading uploaded backup file.', 'error');
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  /**
   * Takes an automatic pre-import safety snapshot, clears old data,
   * bulk-inserts the validated backup records into IndexedDB, refreshes the UI,
   * and notifies the user.
   */
  const executeImport = async () => {
    if (!validatedImportData || !validatedImportData.data) {
      setShowImportConfirm(false);
      return;
    }

    const backup = validatedImportData.data;

    try {
      // Step 1: Create an emergency safety snapshot before altering current state
      await createSafetySnapshot();

      // Step 2: Atomic multi-table overwrite
      await db.transaction('rw', db.notes, db.links, db.categories, db.pages, db.snapshots, async () => {
        await db.notes.clear();
        await db.links.clear();
        await db.categories.clear();
        await db.pages.clear();
        await db.snapshots.clear();

        if (backup.pages.length > 0) {
          await db.pages.bulkAdd(backup.pages);
        } else {
          await db.pages.add({ title: 'Graph', createdAt: Date.now() });
        }

        if (backup.snapshots.length > 0) await db.snapshots.bulkAdd(backup.snapshots);
        if (backup.notes.length > 0) await db.notes.bulkAdd(backup.notes);
        if (backup.links.length > 0) await db.links.bulkAdd(backup.links);

        if (backup.categories.length > 0) {
          await db.categories.bulkAdd(backup.categories);
        } else {
          const defaultCategories: Category[] = [
            { id: 'general', label: 'General', color: '#818cf8' },
            { id: 'work', label: 'Work', color: '#34d399' },
            { id: 'personal', label: 'Personal', color: '#f43f5e' },
            { id: 'ideas', label: 'Ideas', color: '#fbbf24' }
          ];
          await db.categories.bulkAdd(defaultCategories);
        }
      });

      showToast(`Successfully imported ${backup.notes.length} notes and ${backup.links.length} connections.`, 'success');
      onRefreshData();
      setShowImportConfirm(false);
      setValidatedImportData(null);
      onClose();
    } catch (err: unknown) {
      showToast('Failed to import data: ' + (err as Error).message, 'error');
      setShowImportConfirm(false);
      setValidatedImportData(null);
    }
  };

  /**
   * Prompts the user to confirm restoring the database back to initial seed data.
   */
  const handleResetDatabase = () => setShowRestoreConfirm(true);

  /**
   * Clears notes and links from IndexedDB and repopulates the database
   * with the initial starter guide and default graph nodes.
   */
  const executeRestore = async () => {
    try {
      await db.transaction('rw', db.notes, db.links, async () => {
        await db.notes.clear();
        await db.links.clear();
      });
      await seedDatabase();
      onRefreshData();
      setShowRestoreConfirm(false);
      onClose();
    } catch (err: unknown) {
      showToast('Failed to restore defaults: ' + (err as Error).message, 'error');
      setShowRestoreConfirm(false);
    }
  };

  return (
    <>
      {/* Section 1: Backup & Data Portability */}
      <div className="settings-section">
        <h3>Data Management</h3>
        <p className="section-desc">AetherMind is fully local. Your data stays in this browser. Use these options to backup your thoughts.</p>
        
        <div className="action-buttons-grid">
          <button className="settings-action-btn" onClick={handleExportData}>
            <Download size={16} />
            <span>Export Full Backup (JSON)</span>
          </button>
          
          <button className="settings-action-btn" onClick={() => fileInputRef.current?.click()}>
            <Upload size={16} />
            <span>Import Full Backup (JSON)</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={handleImportData}
          />

          <button className="settings-action-btn" onClick={() => exportToHtml(activePageId, pageTitle)}>
            <Globe size={16} />
            <span>Export to HTML</span>
          </button>

          <button className="settings-action-btn" onClick={async () => {
            try {
              const diag = await runDatabaseDiagnostics();
              showToast(`Diagnostics: ${diag.totalNotes} notes (${diag.activeNotes} active, ${diag.archivedNotes} archived), ${diag.totalLinks} links, ${diag.totalDocumentChunks} doc chunks.`, 'success');
              onRefreshData();
            } catch (err: unknown) {
              showToast('Diagnostics error: ' + (err instanceof Error ? err.message : String(err)), 'error');
            }
          }}>
            <Activity size={16} />
            <span>Database Health & Repair</span>
          </button>

          <button className="settings-action-btn danger-btn" onClick={handleResetDatabase}>
            <RotateCcw size={16} />
            <span>Reset Database</span>
          </button>
        </div>
      </div>

      {/* Section 2: Local Machine Learning & Graph Clustering */}
      <div className="settings-section">
        <h3>Graph Automation (Local ML)</h3>
        <p className="section-desc">Run local Transformers.js models to analyze and organize your notes offline.</p>
        <div className="action-buttons-grid" style={{ marginBottom: '15px', gridTemplateColumns: '1fr' }}>
          <button 
            className="settings-action-btn" 
            onClick={async () => {
              setIsClustering(true);
              try {
                await clusterUnlinkedNotes(setClusterProgress);
                onRefreshData();
              } catch (e: unknown) {
                showToast('Clustering Error: ' + (e as Error).message, 'error');
              }
              setIsClustering(false);
              setTimeout(() => setClusterProgress(''), 3000);
            }}
            disabled={isClustering}
          >
            <RotateCcw size={16} className={isClustering ? 'spin-pulse' : ''} />
            <span>{isClustering ? 'Clustering...' : 'Cluster Unlinked Notes'}</span>
          </button>
          
          {/* Toggle for rendering semantic similarity links on the canvas */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--card-nested-bg)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <div style={{ paddingRight: '12px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '4px' }}>NLP Clustering</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>Inject invisible links between semantically similar notes on the graph</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px' }}>
              <input
                type="checkbox"
                checked={nlpClustering}
                onChange={() => {
                  onNlpClusteringChange(!nlpClustering);
                  onRefreshData();
                }}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: nlpClustering ? 'var(--node-indigo)' : 'var(--border-color)',
                transition: '0.3s', borderRadius: '24px'
              }}>
                <span style={{
                  position: 'absolute', content: '', height: '18px', width: '18px', left: nlpClustering ? '24px' : '3px',
                  bottom: '3px', backgroundColor: 'white', transition: '0.3s', borderRadius: '50%'
                }} />
              </span>
            </label>
          </div>
        </div>
        {clusterProgress && <p className="section-desc" style={{ color: 'var(--node-amber)' }}>{clusterProgress}</p>}
      </div>

      {/* Section 3: Category & Tag Taxonomy Customization */}
      <div className="settings-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3>Node Types</h3>
          <button 
            className="btn btn-primary btn-sm" 
            onClick={() => setShowAddCat(!showAddCat)} 
            title="Add Node Type"
          >
            <Plus size={14} /> Add Type
          </button>
        </div>
        <p className="section-desc" style={{ marginBottom: '12px' }}>Customize categories and their default colors.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--card-nested-bg)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: cat.color }}></div>
                <span style={{ fontSize: '0.85rem' }}>{cat.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input 
                  type="color" 
                  value={cat.color} 
                  onChange={async (e) => {
                    await db.categories.update(cat.id, { color: e.target.value });
                  }}
                  style={{ width: '24px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
                  aria-label={`Change color for ${cat.label}`}
                />
                {/* Default system categories cannot be deleted */}
                {['general', 'work', 'personal', 'ideas'].includes(cat.id) ? null : (
                  <button 
                    className="btn btn-icon btn-ghost"
                    onClick={() => {
                      setCategoryToDelete(cat.id);
                    }}
                    aria-label="Delete category"
                    style={{ minWidth: '32px', minHeight: '32px', padding: '4px' }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        
        {/* Category Deletion Confirmation */}
        {categoryToDelete && (
          <ConfirmModal
            isOpen={!!categoryToDelete}
            title="Delete Category"
            message="Are you sure you want to delete this category? Notes using this category will default to 'General'."
            confirmText="Delete"
            onConfirm={async () => {
              await db.categories.delete(categoryToDelete);
              setCategoryToDelete(null);
            }}
            onCancel={() => setCategoryToDelete(null)}
          />
        )}

        {/* New Category Input Drawer */}
        {showAddCat && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--card-nested-bg)', border: '1px solid var(--border-color)', padding: '8px 12px', borderRadius: '6px', marginTop: '8px' }}>
            <input 
              type="text" 
              className="form-control form-control-sm"
              value={newCatLabel}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCatLabel(e.target.value)}
              placeholder="New type name..."
            />
            <input 
              type="color" 
              value={newCatColor} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCatColor(e.target.value)}
              style={{ width: '24px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
              aria-label="New category color"
            />
            <button 
              className="btn btn-accent btn-sm"
              onClick={async () => {
                if (newCatLabel.trim()) {
                  const id = newCatLabel.trim().toLowerCase().replace(/\s+/g, '-');
                  await db.categories.put({ id, label: newCatLabel.trim(), color: newCatColor });
                  setNewCatLabel('');
                  setShowAddCat(false);
                }
              }}
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* Section 4: Graph Snapshots & Time-Travel Versioning */}
      <div className="settings-section">
        <h3>Graph Versioning & Time Travel</h3>
        <p className="section-desc">Save snapshots of your graph state to browse history or restore previous versions.</p>
        <div className="action-buttons-grid" style={{ marginBottom: '8px' }}>
          {onSaveSnapshot && (
            <button className="settings-action-btn" onClick={onSaveSnapshot}>
              <Download size={16} />
              <span>Save Snapshot Now</span>
            </button>
          )}
          {onViewSnapshots && (
            <button className="settings-action-btn" onClick={onViewSnapshots}>
              <RotateCcw size={16} />
              <span>Browse Snapshots</span>
            </button>
          )}
        </div>
      </div>

      {/* Section 5: D3 Force Simulation Physics Tuning */}
      <div className="settings-section">
        <h3>Graph Physics</h3>
        <p className="section-desc">Tune the visual mechanics of the force-directed graph.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          {/* Spring Link Distance Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Link Distance</label>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{physicsConfig.linkDistance}</span>
            </div>
            <input
              type="range"
              className="form-range"
              min="30"
              max="300"
              value={physicsConfig.linkDistance}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhysicsChange({ ...physicsConfig, linkDistance: parseInt(e.target.value) })}
            />
          </div>

          {/* Electrostatic Charge Repulsion Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Repulsion Strength</label>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{Math.abs(physicsConfig.chargeStrength)}</span>
            </div>
            <input
              type="range"
              className="form-range"
              min="-500"
              max="-50"
              step="10"
              value={physicsConfig.chargeStrength}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhysicsChange({ ...physicsConfig, chargeStrength: parseInt(e.target.value) })}
            />
          </div>
        </div>
      </div>

      {/* Backup Import Overwrite Confirmation Modal with Preview Stats */}
      <ConfirmModal
        isOpen={showImportConfirm}
        title="Import Backup"
        message={
          validatedImportData?.summary
            ? `This backup contains ${validatedImportData.summary.noteCount} notes, ${validatedImportData.summary.linkCount} connections, and ${validatedImportData.summary.pageCount} page(s) (Exported on ${validatedImportData.summary.exportDate}). An automatic safety snapshot will be saved before importing. Overwrite existing workspace?`
            : "Importing will overwrite your current database. An automatic safety snapshot will be saved before importing. Proceed?"
        }
        confirmText="Import & Overwrite"
        onConfirm={executeImport}
        onCancel={() => {
          setShowImportConfirm(false);
          setValidatedImportData(null);
        }}
      />
      
      {/* Database Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={showRestoreConfirm}
        title="Restore Defaults"
        message="Are you sure you want to delete all notes and restore the default guide? This action cannot be undone."
        confirmText="Restore Defaults"
        onConfirm={executeRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </>
  );
};
