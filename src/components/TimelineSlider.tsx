import React, { useState, useEffect } from 'react';
import { Calendar, RotateCcw, Clock } from 'lucide-react';
import type { Note, Link } from '../db';

interface TimelineSliderProps {
  notes: Note[];
  dateRange: [number, number] | null;
  setDateRange: (range: [number, number] | null) => void;
  historicalSnapshot?: { notes: Note[]; links: Link[]; timestamp: number } | null;
  onRestoreFromHistory?: () => void;
  onExitHistory?: () => void;
}

export const TimelineSlider: React.FC<TimelineSliderProps> = ({
  notes,
  dateRange,
  setDateRange,
  historicalSnapshot,
  onRestoreFromHistory,
  onExitHistory
}) => {
  const [value, setValue] = useState<number>(Date.now());
  const [minDate, setMinDate] = useState<number>(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [maxDate, setMaxDate] = useState<number>(Date.now());

  useEffect(() => {
    if (notes.length === 0) return;
    const timestamps = notes.map(n => n.createdAt);
    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);
    setMinDate(min - 1000 * 60);
    setMaxDate(max + 1000 * 60);
    if (!dateRange) {
      setValue(max + 1000 * 60);
    }
  }, [notes]);

  useEffect(() => {
    if (!dateRange) {
      setValue(maxDate);
    }
  }, [dateRange, maxDate]);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setValue(val);
    setDateRange([minDate, val]);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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

  if (notes.length < 2) {
    return null;
  }

  return (
    <div className="timeline-slider-panel glass-panel" id="timeline-slider-panel-root">
      <div className="timeline-info">
        <div className="timeline-info-content" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={14} className="timeline-icon" />
          <span className="timeline-label">History Scrubber:</span>
          <span className="timeline-dates">
            {formatDate(minDate)} - {formatDate(value)}
          </span>
        </div>
        {dateRange && (
          <button className="reset-timeline-btn" onClick={() => setDateRange(null)}>
            Reset Timeline
          </button>
        )}
      </div>
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
