/**
 * @file useWorkspaceState.ts
 * @description Central state management hook for workspace pages, modal dialogs, note navigation, and search filters.
 */

import { useState, useCallback, type Dispatch, type SetStateAction } from 'react';
import type { Note, Link } from '../db';

export interface WorkspaceState {
  // Active Notes
  activeNoteId: number | null;
  setActiveNoteId: Dispatch<SetStateAction<number | null>>;
  secondaryNoteId: number | null;
  setSecondaryNoteId: Dispatch<SetStateAction<number | null>>;

  // Search & Filtering
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  selectedTags: string[];
  setSelectedTags: Dispatch<SetStateAction<string[]>>;
  dateRange: [number, number] | null;
  setDateRange: Dispatch<SetStateAction<[number, number] | null>>;
  isSearchOpen: boolean;
  setIsSearchOpen: Dispatch<SetStateAction<boolean>>;

  // Workspace Page
  currentPageId: number;
  setCurrentPageId: Dispatch<SetStateAction<number>>;

  // Modals Visibility
  showSettings: boolean;
  setShowSettings: Dispatch<SetStateAction<boolean>>;
  showCommandPalette: boolean;
  setShowCommandPalette: Dispatch<SetStateAction<boolean>>;
  showAskAi: boolean;
  setShowAskAi: Dispatch<SetStateAction<boolean>>;
  showNewPage: boolean;
  setShowNewPage: Dispatch<SetStateAction<boolean>>;
  showRenamePage: boolean;
  setShowRenamePage: Dispatch<SetStateAction<boolean>>;
  showDeletePageConfirm: boolean;
  setShowDeletePageConfirm: Dispatch<SetStateAction<boolean>>;
  showReview: boolean;
  setShowReview: Dispatch<SetStateAction<boolean>>;
  showDiscoveryDigest: boolean;
  setShowDiscoveryDigest: Dispatch<SetStateAction<boolean>>;

  // Ingestion & Loading States
  docLoading: boolean;
  setDocLoading: Dispatch<SetStateAction<boolean>>;
  docStatus: string;
  setDocStatus: Dispatch<SetStateAction<string>>;

  // Time-Travel / Historical Snapshot
  historicalSnapshot: { notes: Note[]; links: Link[]; timestamp: number } | null;
  setHistoricalSnapshot: Dispatch<SetStateAction<{ notes: Note[]; links: Link[]; timestamp: number } | null>>;

  // Helpers
  openNote: (id: number) => void;
  closeNote: () => void;
  openSplitNote: (id: number) => void;
  closeSplitNote: () => void;
  resetFilters: () => void;
}

export function useWorkspaceState(): WorkspaceState {
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [secondaryNoteId, setSecondaryNoteId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<[number, number] | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [currentPageId, setCurrentPageId] = useState<number>(1);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showAskAi, setShowAskAi] = useState(false);
  const [showNewPage, setShowNewPage] = useState(false);
  const [showRenamePage, setShowRenamePage] = useState(false);
  const [showDeletePageConfirm, setShowDeletePageConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showDiscoveryDigest, setShowDiscoveryDigest] = useState(false);

  // Loading
  const [docLoading, setDocLoading] = useState(false);
  const [docStatus, setDocStatus] = useState('');

  // Snapshot
  const [historicalSnapshot, setHistoricalSnapshot] = useState<{ notes: Note[]; links: Link[]; timestamp: number } | null>(null);

  const openNote = useCallback((id: number) => {
    setActiveNoteId(id);
  }, []);

  const closeNote = useCallback(() => {
    setActiveNoteId(null);
  }, []);

  const openSplitNote = useCallback((id: number) => {
    setSecondaryNoteId(id);
  }, []);

  const closeSplitNote = useCallback(() => {
    setSecondaryNoteId(null);
  }, []);

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedTags([]);
    setDateRange(null);
  }, []);

  return {
    activeNoteId,
    setActiveNoteId,
    secondaryNoteId,
    setSecondaryNoteId,
    searchQuery,
    setSearchQuery,
    selectedTags,
    setSelectedTags,
    dateRange,
    setDateRange,
    isSearchOpen,
    setIsSearchOpen,
    currentPageId,
    setCurrentPageId,
    showSettings,
    setShowSettings,
    showCommandPalette,
    setShowCommandPalette,
    showAskAi,
    setShowAskAi,
    showNewPage,
    setShowNewPage,
    showRenamePage,
    setShowRenamePage,
    showDeletePageConfirm,
    setShowDeletePageConfirm,
    showReview,
    setShowReview,
    showDiscoveryDigest,
    setShowDiscoveryDigest,
    docLoading,
    setDocLoading,
    docStatus,
    setDocStatus,
    historicalSnapshot,
    setHistoricalSnapshot,
    openNote,
    closeNote,
    openSplitNote,
    closeSplitNote,
    resetFilters
  };
}
