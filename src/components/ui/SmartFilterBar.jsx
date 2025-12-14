import React from 'react';
import { Search } from 'lucide-react';
import Chip from '@mui/material/Chip';
import { COLORS } from '../../lib/constants/ui';

export function SmartFilterBar({
    searchQuery,
    onSearchChange,
    activeFilters = [],
    onRemoveFilter
}) {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            background: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '4px 8px',
            width: '100%',
            maxWidth: 600,
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
        }}>
            <Search size={18} color="#9CA3AF" style={{ marginRight: 8 }} />

            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                {activeFilters.map(filter => (
                    <Chip
                        key={filter.id}
                        label={filter.label}
                        onDelete={() => onRemoveFilter(filter.id)}
                        size="small"
                        sx={{
                            backgroundColor: '#EDF7ED', // Light Green for "Mes Projets" or active filters
                            color: '#1E4620',
                            fontWeight: 600,
                            borderRadius: 1,
                            '& .MuiChip-deleteIcon': {
                                color: '#1E4620',
                                '&:hover': { color: '#000' }
                            }
                        }}
                    />
                ))}

                <input
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={activeFilters.length > 0 ? "Rechercher..." : "Rechercher..."}
                    style={{
                        border: 'none',
                        outline: 'none',
                        fontSize: 14,
                        padding: '6px 0',
                        flex: 1,
                        minWidth: 100,
                        background: 'transparent'
                    }}
                />
            </div>
        </div>
    );
}
