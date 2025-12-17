import React, { useState, useMemo } from 'react';
import { Menu, MenuItem, Checkbox, ListItemText, TextField, Box, Button, Typography, Divider } from '@mui/material';
import { Search } from 'lucide-react';

export default function ColumnSelectorMenu({
    anchorEl,
    open,
    onClose,
    allColumns, // [{ key, label }]
    visibleColumns, // [key, key]
    onChange // (newVisibleColumns) => void
}) {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredColumns = useMemo(() => {
        if (!searchTerm) return allColumns;
        const lower = searchTerm.toLowerCase();
        return allColumns.filter(c =>
            (c.label || c.key).toLowerCase().includes(lower)
        );
    }, [allColumns, searchTerm]);

    const handleToggle = (key) => {
        const newCols = visibleColumns.includes(key)
            ? visibleColumns.filter(c => c !== key)
            : [...visibleColumns, key];
        onChange(newCols);
    };

    const handleSelectAll = () => {
        if (filteredColumns.length === 0) return;
        // If all filtered are selected, unselect them. Otherwise select them.
        const allFilteredSelected = filteredColumns.every(c => visibleColumns.includes(c.key));

        if (allFilteredSelected) {
            // Remove filtered from visible
            onChange(visibleColumns.filter(k => !filteredColumns.find(c => c.key === k)));
        } else {
            // Add filtered to visible (uniq)
            const newSet = new Set([...visibleColumns, ...filteredColumns.map(c => c.key)]);
            onChange(Array.from(newSet));
        }
    };

    return (
        <Menu
            anchorEl={anchorEl}
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    width: 320,
                    maxHeight: 500,
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
            MenuListProps={{ sx: { p: 0 } }}
        >
            {/* Header: Search */}
            <Box sx={{ p: 2, pb: 1 }}>
                <TextField
                    size="small"
                    fullWidth
                    placeholder="Rechercher un champ..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: <Search size={16} style={{ marginRight: 8, opacity: 0.5 }} />
                    }}
                />
            </Box>

            {/* Actions: Select All */}
            <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                    {filteredColumns.length} champ(s)
                </Typography>
                <Button
                    size="small"
                    onClick={handleSelectAll}
                    sx={{ fontSize: 11, textTransform: 'none', p: 0, minWidth: 'auto' }}
                >
                    {filteredColumns.every(c => visibleColumns.includes(c.key)) ? "Tout décocher" : "Tout cocher"}
                </Button>
            </Box>

            <Divider />

            {/* List */}
            <Box sx={{ overflowY: 'auto', flex: 1 }}>
                {filteredColumns.map((col) => (
                    <MenuItem key={col.key} onClick={() => handleToggle(col.key)} dense>
                        <Checkbox
                            checked={visibleColumns.includes(col.key)}
                            size="small"
                            sx={{ p: 0.5, mr: 1 }}
                        />
                        <ListItemText
                            primary={col.label || col.key}
                            primaryTypographyProps={{ fontSize: 13 }}
                        />
                    </MenuItem>
                ))}
                {filteredColumns.length === 0 && (
                    <Typography variant="body2" sx={{ p: 2, textAlign: 'center', color: 'text.secondary' }}>
                        Aucun champ trouvé.
                    </Typography>
                )}
            </Box>
        </Menu>
    );
}
