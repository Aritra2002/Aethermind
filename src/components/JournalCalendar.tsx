import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { startOfMonth, endOfMonth, eachDayOfInterval, format, setMonth, setYear, getDay } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileText } from 'lucide-react';
import { Dropdown } from './ui/Dropdown';

export const JournalCalendar: React.FC = () => {
  const notes = useLiveQuery(() => db.notes.toArray()) || [];
  const pages = useLiveQuery(() => db.pages.toArray()) || [];
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());


  const handleYearSubmit = (valStr: string | number) => {
    const val = valStr.toString();
    const startYear = 2026;
    const currentYearObj = new Date().getFullYear();
    
    if (val.trim() === '') {
      setCurrentMonth(setYear(currentMonth, currentYearObj));
      setSelectedDate(null);
      return;
    }

    const y = parseInt(val);
    if (!isNaN(y) && y >= startYear) {
      setCurrentMonth(setYear(currentMonth, y));
      setSelectedDate(null);
    }
  };
  
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  const startDayOfWeek = getDay(monthStart);
  const emptyDays = Array.from({ length: startDayOfWeek }).map((_, i) => `empty-${i}`);

  // Group notes by creation date
  const activityMap = new Map<string, number>();
  notes.forEach(note => {
    const dateStr = format(new Date(note.createdAt), 'yyyy-MM-dd');
    activityMap.set(dateStr, (activityMap.get(dateStr) || 0) + 1);
  });

  const getStyle = (count: number, isSelected: boolean) => {
    let base = { bg: 'rgba(255, 255, 255, 0.05)', shadow: 'none', border: '1px solid rgba(255, 255, 255, 0.02)' };
    if (count === 1) base = { bg: 'var(--node-work)', shadow: '0 0 8px var(--node-work)', border: '1px solid rgba(255,255,255,0.2)' };
    if (count === 2) base = { bg: 'var(--node-personal)', shadow: '0 0 10px var(--node-personal)', border: '1px solid rgba(255,255,255,0.4)' };
    if (count > 2) base = { bg: 'var(--node-ideas)', shadow: '0 0 12px var(--node-ideas)', border: '1px solid rgba(255,255,255,0.6)' };
    
    if (isSelected) {
      base.border = '2px solid white';
      base.shadow = `0 0 16px ${base.bg !== 'rgba(255, 255, 255, 0.05)' ? base.bg : 'rgba(255,255,255,0.5)'}`;
    }
    return base;
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.005, delayChildren: 0.05 } }
  };

  const itemVariants = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { type: "spring" as const, stiffness: 300, damping: 20 } }
  };

  const selectedNotes = selectedDate 
    ? notes.filter(n => format(new Date(n.createdAt), 'yyyy-MM-dd') === selectedDate).sort((a,b) => b.createdAt - a.createdAt)
    : [];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => setSelectedDate(null)}
      style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '20px', position: 'relative', width: '100%', height: '100%' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingRight: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} style={{ color: 'var(--accent-secondary)' }} />
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>
            Activity Journal
          </h3>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Dropdown
            value={currentMonth.getMonth()}
            onChange={(val) => { setCurrentMonth(setMonth(currentMonth, val as number)); setSelectedDate(null); }}
            options={Array.from({ length: 12 }).map((_, i) => ({ value: i, label: format(new Date(2020, i, 1), 'MMMM') }))}
            style={{ width: '120px' }}
          />
          
          <Dropdown
            isSearchable={true}
            allowCustomValue={true}
            dynamicWidth={true}
            value={currentMonth.getFullYear()}
            onChange={(val) => handleYearSubmit(val)}
            options={(() => {
              const startYear = 2026;
              const currentYearObj = new Date().getFullYear();
              const endYear = Math.round((currentYearObj + 100) / 100) * 100;
              const numYears = endYear - startYear + 1;
              return Array.from({ length: numYears }).map((_, i) => ({ value: startYear + i, label: (startYear + i).toString() }));
            })()}
            style={{ width: 'max-content', minWidth: '90px' }}
          />
        </div>
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'center' }}>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          onClick={(e) => e.stopPropagation()}
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            gap: '12px',
            marginTop: '16px',
            width: '100%',
            maxWidth: '500px'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px', marginBottom: '4px' }}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>{day}</div>
            ))}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '12px' }}>
            {emptyDays.map(id => (
              <div key={id} style={{ aspectRatio: '1/1' }} />
            ))}
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const count = activityMap.get(dateStr) || 0;
              const isSelected = selectedDate === dateStr;
              const style = getStyle(count, isSelected);
              return (
                <motion.div 
                  key={dateStr}
                  variants={itemVariants}
                  whileHover={{ scale: 1.1, zIndex: 10, transition: { duration: 0.2 } }}
                  onClick={() => setSelectedDate(dateStr)}
                  title={`${dateStr}: ${count} notes across all pages`}
                  style={{
                    aspectRatio: '1/1',
                    backgroundColor: style.bg,
                    boxShadow: style.shadow,
                    border: style.border,
                    borderRadius: '10px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: isSelected || count > 0 ? 'white' : 'rgba(255,255,255,0.4)' }}>
                    {format(day, 'd')}
                  </span>
                  {count > 0 && (
                    <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'white', position: 'absolute', bottom: '6px', opacity: 0.8 }} />
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <AnimatePresence>
          {selectedDate && (
            <motion.div 
              key="details-panel"
              initial={{ opacity: 0, height: 0, marginTop: -24 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
              exit={{ opacity: 0, height: 0, marginTop: -24 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              style={{ overflow: 'hidden', width: '100%' }}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', width: '100%' }}
              >
                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)' }}>{format(new Date(selectedDate), 'MMMM do, yyyy')}</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {selectedNotes.length} note{selectedNotes.length !== 1 ? 's' : ''} created across all pages
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '25vh', overflowY: 'auto', scrollbarGutter: 'stable', paddingRight: '8px' }}>
                  {selectedNotes.length > 0 ? (
                    selectedNotes.map(note => {
                      const page = pages.find(p => p.id === note.pageId);
                      return (
                        <div key={note.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <FileText size={14} style={{ color: note.color || 'var(--accent-primary)', flexShrink: 0 }} />
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {note.title || 'Untitled Note'}
                            </span>
                            {page && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                Page: {page.title}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', padding: '8px 0' }}>
                      No activity on this day.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

