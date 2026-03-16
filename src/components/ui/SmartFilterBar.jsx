import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import Chip from '@mui/material/Chip';

const FIELD_COLORS = {
  name:     { bg: '#EEF2FF', text: '#3730A3' },
  client:   { bg: '#FDF4FF', text: '#6B21A8' },
  owner:    { bg: '#FFF7ED', text: '#9A3412' },
  status:   { bg: '#F0FDF4', text: '#166534' },
  all:      { bg: '#F3F4F6', text: '#374151' },
  advanced: { bg: '#FFFBEB', text: '#92400E' },
  default:  { bg: '#EDF7ED', text: '#1E4620' },
};

export function SmartFilterBar({ activeFilters = [], onAddFilter, onRemoveFilter, fields = [], placeholder }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const trimmed = text.trim();
  const suggestions = trimmed ? [...fields, { id: 'all', label: 'Tous les champs' }] : [];

  const handleSelect = (field) => {
    if (!trimmed) return;
    onAddFilter({
      id: `${field.id}_${trimmed}_${Date.now()}`,
      label: field.id === 'all' ? trimmed : `${field.label} : ${trimmed}`,
      field: field.id,
      value: trimmed,
      matchType: 'contains',
    });
    setText('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && trimmed) {
      handleSelect({ id: 'all', label: 'Tous les champs' });
    } else if (e.key === 'Escape') {
      setOpen(false);
      setText('');
    } else if (e.key === 'Backspace' && !text && activeFilters.length > 0) {
      const last = activeFilters[activeFilters.length - 1];
      if (last.id !== 'my_minutes') onRemoveFilter(last.id);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', flex: 1, maxWidth: 600 }}>
      <div style={{
        display: 'flex', alignItems: 'center', background: 'white', flexWrap: 'wrap', gap: 6,
        border: `1px solid ${open ? '#6366F1' : '#E5E7EB'}`, borderRadius: 8,
        padding: '4px 10px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'border-color 0.15s',
      }}>
        <Search size={16} color="#9CA3AF" style={{ flexShrink: 0 }} />

        {activeFilters.map(filter => {
          const colors = FIELD_COLORS[filter.field] || FIELD_COLORS.default;
          return (
            <Chip
              key={filter.id}
              label={filter.label}
              onDelete={() => onRemoveFilter(filter.id)}
              size="small"
              sx={{
                backgroundColor: colors.bg, color: colors.text,
                fontWeight: 600, borderRadius: 1, fontSize: 12,
                '& .MuiChip-deleteIcon': { color: colors.text, '&:hover': { color: '#000' } },
              }}
            />
          );
        })}

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(!!e.target.value.trim());
          }}
          onFocus={() => { if (trimmed) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={activeFilters.length > 0 ? 'Rechercher...' : (placeholder ?? "Nom, client, chargé d'affaires...")}
          style={{
            border: 'none', outline: 'none', fontSize: 14, padding: '4px 0',
            flex: 1, minWidth: 120, background: 'transparent',
          }}
        />

        {text && (
          <button
            onClick={() => { setText(''); setOpen(false); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: '#9CA3AF', display: 'flex', alignItems: 'center' }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'white', borderRadius: 8,
          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15), 0 4px 6px -2px rgba(0,0,0,0.05)',
          border: '1px solid #E5E7EB', zIndex: 1000, overflow: 'hidden',
        }}>
          {suggestions.map((field, i) => {
            const isAllFields = field.id === 'all';
            return (
              <button
                key={field.id}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(field); }}
                onMouseEnter={() => setHovered(field.id)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', background: hovered === field.id ? '#F9FAFB' : 'white',
                  border: 'none', borderTop: isAllFields ? '1px solid #F3F4F6' : 'none',
                  cursor: 'pointer', textAlign: 'left', fontSize: 14,
                }}
              >
                <Search size={13} color="#9CA3AF" style={{ flexShrink: 0 }} />
                <span style={{ color: '#6B7280' }}>
                  Rechercher{' '}
                  <strong style={{ color: '#111827' }}>{field.label}</strong>
                  {' '}pour :{' '}
                  <span style={{ color: '#6366F1', fontWeight: 600 }}>{trimmed}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
