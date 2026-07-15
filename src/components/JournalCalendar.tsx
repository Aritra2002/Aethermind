import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { startOfYear, endOfYear, eachDayOfInterval, format } from 'date-fns';

export const JournalCalendar: React.FC = () => {
  const notes = useLiveQuery(() => db.notes.toArray()) || [];
  
  const today = new Date();
  const yearStart = startOfYear(today);
  const yearEnd = endOfYear(today);
  const days = eachDayOfInterval({ start: yearStart, end: yearEnd });

  // Group notes by creation date
  const activityMap = new Map<string, number>();
  notes.forEach(note => {
    const dateStr = format(new Date(note.createdAt), 'yyyy-MM-dd');
    activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
  });

  const getIntensity = (count: number) => {
    if (count === 0) return 'rgba(255, 255, 255, 0.05)';
    if (count === 1) return 'var(--node-work)';
    if (count === 2) return 'var(--node-personal)';
    return 'var(--node-ideas)';
  };

  return (
    <div style={{ padding: '15px', background: 'var(--bg-secondary)', borderRadius: '8px', marginTop: '20px' }}>
      <h3 style={{ margin: '0 0 10px 0', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Activity Journal</h3>
      <div style={{ display: 'grid', gridTemplateRows: 'repeat(7, 10px)', gridAutoFlow: 'column', gap: '4px', maxWidth: '100%', overflowX: 'auto' }}>
        {days.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const count = activityMap.get(dateStr) || 0;
          return (
            <div 
              key={dateStr}
              title={`${dateStr}: ${count} notes`}
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: getIntensity(count),
                borderRadius: '2px'
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
