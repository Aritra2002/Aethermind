/**
 * @file TimelineSlider.tsx
 * @description History scrubber and time-travel timeline component for AetherMind.
 * Enables scrubbed chronological replay of graph evolution over time and historical snapshot inspection and rollback.
 * @module components/TimelineSlider
 */

import React, { useMemo } from 'react';
import { Calendar, RotateCcw, Clock } from 'lucide-react';
import type { Note, Link } from '../db';

/**
 * Props for the {@link TimelineSlider} component.
 *
 * @interface TimelineSliderProps
 * @property {Note[]} notes - List of notes in the active page used to compute timestamp bounds.
 * @property {[number, number] | null} dateRange - Active [minTimestamp, maxTimestamp] filter range, or null if showing all.
 * @property {(range: [number, number] | null) => void} setDateRange - Callback to update the active timestamp filter bounds.
 * @property {{ notes: Note[]; links: Link[]; timestamp: number } | null} [historicalSnapshot] - Currently inspected historical graph snapshot, if any.
 * @property {() => void} [onRestoreFromHistory] - Callback triggered to restore workspace data to the viewed historical snapshot.
 * @property {() => void} [onExitHistory] - Callback triggered to exit historical view mode and return to live workspace.
 */
interface TimelineSliderProps {
  notes: Note[];
  dateRange: [number, number] | null;
  setDateRange: (range: [number, number] | null) => void;
  historicalSnapshot?: { notes: Note[]; links: Link[]; timestamp: number } | null;
  onRestoreFromHistory?: () => void;
  onExitHistory?: () => void;
}

/**
 * TimelineSlider Component
 *
 * Renders a glass panel with an interactive range slider and date picker at the bottom of the graph.
 * Allows users to travel back in time to inspect note states at specific moments or view historical snapshots.
 *
 * @component
 * @param {TimelineSliderProps} props - Component properties.
 * @returns {React.ReactElement} The rendered timeline slider widget.
 */
export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  notes,
  dateRange,
  setDateRange,
  historicalSnapshot,
  onRestoreFromHistory,
  onExitHistory
}) => {
  /** Array of all note creation timestamps. */
  const timestamps = useMemo(() => notes.length > 0 ? notes.map(n => n.createdAt) : [Date.now()], [notes]);

  /** Earliest note timestamp minus 1 minute buffer for padding. */
  const minDate = useMemo(() => Math.min(...timestamps) - 1000 * 60, [timestamps]);

  /** Latest note timestamp plus 1 minute buffer. */
  const maxDate = useMemo(() => Math.max(...timestamps) + 1000 * 60, [timestamps]);
  
  /** Current upper-bound timestamp value of the timeline scrubber. */
  const value = dateRange ? dateRange[1] : maxDate;

  /**
   * Handles slider track movement.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event.
   */
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDateRange([minDate, val]);
  };

  /**
   * Formats a unix timestamp into a readable date and time string.
   *
   * @param {number} timestamp - Epoch milliseconds.
   * @returns {string} Formatted date-time string.
   */
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit'
    });
  };

  /**
   * Converts a timestamp to `YYYY-MM-DDTHH:MM` format for `<input type="datetime-local">`.
   *
   * @param {number} timestamp - Epoch milliseconds.
   * @returns {string} Datetime local input format string.
   */
  const getDatetimeLocalString = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  /**
   * Handles direct date-time picker input adjustments.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - Input change event.
   */
  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = new Date(e.target.value).getTime();
    if (!isNaN(val)) {
      const clampedVal = Math.max(minDate, Math.min(maxDate, val));
      setDateRange([minDate, clampedVal]);
    }
  };

  // Render Historical Snapshot Mode UI
  if (historicalSnapshot) {
    return (
      <div className="timeline-slider-panel glass-panel" style={{ borderColor: 'var(--node-amber)' }}>
        <div className="timeline-info">
          <Clock size={14} style={{ color: 'var(--node-amber)' }} />
          <span className="timeline-label" style={{ color: 'var(--node-amber)', fontWeight: 600 }}>Historical View</span>
          <span className="timeline-dates">
            {formatDate(historicalSnapshot.timestamp)}
          </span>
        </div>
        <div className="slider-container" style={{ justifyContent: 'flex-end', gap: '8px' }}>
          {onRestoreFromHistory && (
            <button
              className="restore-timeline-btn"
              onClick={onRestoreFromHistory}
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RotateCcw size={12} /> Restore to this point
            </button>
          )}
          {onExitHistory && (
            <button
              className="exit-history-btn"
              onClick={onExitHistory}
            >
              Exit History
            </button>
          )}
        </div>
      </div>
    );
  }

  // Not enough notes to meaningfully scrub timeline
  if (notes.length < 2) {
    return (
      <div className="timeline-slider-panel glass-panel" style={{ opacity: 0.5, cursor: 'not-allowed' }}>
        <div className="timeline-info">
          <Calendar size={14} className="timeline-icon" />
          <span className="timeline-label" style={{ color: 'var(--text-secondary)' }}>Not enough notes for timeline (need at least 2)</span>
        </div>
      </div>
    );
  }

  // Render Live History Scrubber
  return (
    <div className="timeline-slider-panel glass-panel" id="timeline-slider-panel-root">
      <div className="timeline-info">
        <div className="timeline-info-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Calendar size={14} className="timeline-icon" />
          <span className="timeline-label">History Scrubber:</span>
          <span className="timeline-dates" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {formatDate(minDate)} - 
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <div 
                className="timeline-date-display"
                style={{
                  background: 'var(--surface-badge-bg)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  display: 'inline-block',
                  minWidth: '160px',
                  textAlign: 'center'
                }}
              >
                {formatDate(value)}
              </div>
              <input 
                type="datetime-local" 
                value={getDatetimeLocalString(value)}
                min={getDatetimeLocalString(minDate)}
                max={getDatetimeLocalString(maxDate)}
                onChange={handleDateInputChange}
                onClick={(e) => {
                  if ('showPicker' in HTMLInputElement.prototype) {
                    e.currentTarget.showPicker();
                  }
                }}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer'
                }}
              />
            </div>
          </span>
        </div>
        {dateRange && (
          <button className="reset-timeline-btn" onClick={() => setDateRange(null)}>
            Reset Timeline
          </button>
        )}
      </div>
      {/* Range Slider Track with dynamic CSS fill percentage */}
      <div className="slider-container">
        <input
          type="range"
          id="timeline-range-input"
          className="timeline-range"
          min={minDate}
          max={maxDate}
          value={value}
          onChange={handleSliderChange}
          style={{ '--val': `${maxDate === minDate ? 100 : ((value - minDate) / (maxDate - minDate)) * 100}%` } as React.CSSProperties}
        />
      </div>
    </div>
  );
};

