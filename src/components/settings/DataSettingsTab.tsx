import React, { useRef, useState } from 'react';
import { db } from '../../db';
import type { Category } from '../../db';
import { clusterUnlinkedNotes } from '../../utils/vectorSearch';
import { exportToHtml } from '../../utils/exportHtml';
import { seedDatabase } from '../../db/helpers';
import { Download, Upload, RotateCcw, Plus, Trash2, Globe } from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';
import { useToast } from '../ToastContext';

interface DataSettingsTabProps {
  onClose: () => void;
  onRefreshData: () => void;
  activePageId: number;
  pageTitle?: string;
  physicsConfig: { linkDistance: number; chargeStrength: number };
  onPhysicsChange: (config: { linkDistance: number; chargeStrength: number }) => void;
  categories: Category[];
  nlpClustering: boolean;
  onNlpClusteringChange: (val: boolean) => void;
  onSaveSnapshot?: () => void;
  onViewSnapshots?: () => void;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [pendingImportEvent, setPendingImportEvent] = useState<React.ChangeEvent<HTMLInputElement> | null>(null);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatColor, setNewCatColor] = useState('#818cf8');
  const [showAddCat, setShowAddCat] = useState(false);
  const [isClustering, setIsClustering] = useState(false);
  const [clusterProgress, setClusterProgress] = useState('');

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

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPendingImportEvent(e);
    setShowImportConfirm(true);
  };

  const executeImport = () => {
    const e = pendingImportEvent;
    if (!e || !e.target.files || e.target.files.length === 0) {
      setShowImportConfirm(false);
      return;
    }
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.app !== 'AetherMind') {
          showToast('Invalid backup file format', 'error');
          setShowImportConfirm(false);
          return;
        }
        await db.transaction('rw', db.notes, db.links, db.categories, db.pages, db.snapshots, async () => {
          await db.notes.clear();
          await db.links.clear();
          await db.categories.clear();
          await db.pages.clear();
          await db.snapshots.clear();
          
          if (json.pages && json.pages.length > 0) {
            await db.pages.bulkAdd(json.pages);
          } else {
            await db.pages.add({ title: 'Graph', createdAt: Date.now() });
          }
          if (json.snapshots) await db.snapshots.bulkAdd(json.snapshots);
          if (json.notes) await db.notes.bulkAdd(json.notes);
          if (json.links) await db.links.bulkAdd(json.links);
          if (json.categories) {
            await db.categories.bulkAdd(json.categories);
          } else {
             const defaultCategories: Category[] = [
               { id: 'general', label: 'General', color: '#94a3b8' },
               { id: 'work', label: 'Work', color: '#38bdf8' },
               { id: 'personal', label: 'Personal', color: '#ff0000' },
               { id: 'ideas', label: 'Ideas', color: '#fcd34d' }
             ];
             await db.categories.bulkAdd(defaultCategories);
          }
        });
        onRefreshData();
        setShowImportConfirm(false);
        onClose();
      } catch (err: unknown) {
        showToast('Failed to import data: ' + (err as Error).message, 'error');
        setShowImportConfirm(false);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetDatabase = () => setShowRestoreConfirm(true);

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
            <span>Publish to Web (HTML)</span>
          </button>

          <button className="settings-action-btn danger-btn" onClick={handleResetDatabase}>
            <RotateCcw size={16} />
            <span>Reset Database</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h3>Graph Automation (Local ML)</h3>
        <p className="section-desc">Run local Transformers.js models to analyze and organize your notes offline.</p>
        <div className="action-buttons-grid" style={{ marginBottom: '15px' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', borderRadius: '8px', marginTop: '8px' }}>
              <div style={{ paddingRight: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 500, marginBottom: '6px' }}>NLP Clustering</div>
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
                  backgroundColor: nlpClustering ? 'var(--node-indigo)' : 'rgba(255,255,255,0.15)',
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
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {categories.map(cat => (
            <div key={cat.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px' }}>
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
                />
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

          {showAddCat && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '6px', marginTop: '4px' }}>
              <input 
                type="text" 
                value={newCatLabel}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCatLabel(e.target.value)}
                placeholder="New type name..."
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '4px 8px', borderRadius: '4px', fontSize: '0.85rem' }}
              />
              <input 
                type="color" 
                value={newCatColor}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCatColor(e.target.value)}
                style={{ width: '24px', height: '24px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer', background: 'transparent' }}
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

      <div className="settings-section">
        <h3>Graph Physics</h3>
        <p className="section-desc">Tune the visual mechanics of the force-directed graph.</p>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Link Distance</label>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{physicsConfig.linkDistance}</span>
            </div>
            <input
              type="range"
              min="30"
              max="300"
              value={physicsConfig.linkDistance}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhysicsChange({ ...physicsConfig, linkDistance: parseInt(e.target.value) })}
              style={{ accentColor: 'var(--node-indigo)' }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Repulsion Strength</label>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>{Math.abs(physicsConfig.chargeStrength)}</span>
            </div>
            <input
              type="range"
              min="-500"
              max="-50"
              step="10"
              value={physicsConfig.chargeStrength}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onPhysicsChange({ ...physicsConfig, chargeStrength: parseInt(e.target.value) })}
              style={{ accentColor: 'var(--node-emerald)' }}
            />
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showImportConfirm}
        title="Import Backup"
        message="Importing will overwrite your current database. Are you sure you want to proceed?"
        confirmText="Import & Overwrite"
        onConfirm={executeImport}
        onCancel={() => {
          setShowImportConfirm(false);
          setPendingImportEvent(null);
        }}
      />
      
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
