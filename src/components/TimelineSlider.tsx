import React from 'react';
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
  // eslint-disable-next-line react-hooks/purity
  const timestamps = notes.length > 0 ? notes.map(n => n.createdAt) : [Date.now()];
  const minDate = Math.min(...timestamps) - 1000 * 60;
  const maxDate = Math.max(...timestamps) + 1000 * 60;
  
  const value = dateRange ? dateRange[1] : maxDate;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setDateRange([minDate, val]);
  };

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getMonth()];
    // Although the user asked for "Jul 15", they didn't specify 0-padding for days. But 0-padding hours is specified. Let's pad just in case or just toString() for day since "Jul 15" has 2 digits natively. Actually, let's just use 2-digit day.
    const dayStr = d.getDate().toString();
    const year = d.getFullYear();
    let hours = d.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const paddedHours = hours.toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    return `${month} ${dayStr}, ${year}, ${paddedHours}:${minutes} ${ampm}`;
  };

  const getDatetimeLocalString = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = new Date(e.target.value).getTime();
    if (!isNaN(val)) {
      const clampedVal = Math.max(minDate, Math.min(maxDate, val));
      setDateRange([minDate, clampedVal]);
    }
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
        <div className="timeline-info-content" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <Calendar size={14} className="timeline-icon" />
          <span className="timeline-label">History Scrubber:</span>
          <span className="timeline-dates" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {formatDate(minDate)} - 
            <input 
              type="datetime-local" 
              value={getDatetimeLocalString(value)}
              min={getDatetimeLocalString(minDate)}
              max={getDatetimeLocalString(maxDate)}
              onChange={handleDateInputChange}
              className="timeline-date-input"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-primary)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '0.85rem',
                outline: 'none',
                fontFamily: 'inherit'
              }}
            />
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
