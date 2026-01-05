import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Tooltip from '@mui/material/Tooltip';

import ActivitySidebar from './ui/ActivitySidebar';
import GridPhotoCell from './ui/GridPhotoCell';
import GridSketchCell from './ui/GridSketchCell';
import { generateRowLogs } from '../lib/utils/logUtils';

import BlurTextField from './ui/BlurTextField';
import { useAuth } from '../auth'; // <--- NEW IMPORT
import { supabase } from '../lib/supabaseClient'; // <--- NEW IMPORT

export default function LineDetailPanel({ open, onClose, row, schema, onRowChange, columnVisibilityModel, minuteId, projectId }) {
    // New Sidebar Toggle State
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const { currentUser } = useAuth(); // <--- GET CURRENT USER

    const activities = React.useMemo(() => row?.comments || [], [row?.comments]);

    const handleFieldChange = React.useCallback((key, value) => {
        if (!row) return;
        const oldRow = { ...row };
        const newRow = { ...row, [key]: value };

        // Pass Current User Name to Log Generator
        const authorName = currentUser?.name || 'Utilisateur';
        const newLogs = generateRowLogs(oldRow, newRow, schema, authorName);

        let updatedComments = newRow.comments || [];
        if (newLogs.length > 0) {
            updatedComments = [...updatedComments, ...newLogs];
        }

        onRowChange({ ...newRow, comments: updatedComments });
    }, [row, onRowChange, schema, currentUser]);

    // CORRECTION ICI : Ajout du champ 'date' pour le Journal
    const handleAddComment = React.useCallback((text) => {
        if (!row) return;
        const newActivity = {
            id: Date.now(),
            text: text,
            date: Date.now(),
            createdAt: new Date().toISOString(),
            author: currentUser?.name || 'Utilisateur',
            type: 'msg'
        };

        const updatedComments = row.comments ? [...row.comments, newActivity] : [newActivity];
        onRowChange({ ...row, comments: updatedComments });
    }, [row, onRowChange, currentUser]);

    // NEW: Handle Image Upload for Activity Sidebar
    const handleAddImage = React.useCallback(async (file) => {
        if (!row || !file) return;

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `activity/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9]/g, '')}`;

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('attachments')
                .getPublicUrl(fileName);

            // 1. Update Local Row (Legacy/Immediate Display)
            const newActivity = {
                id: Date.now(),
                content: publicUrl,
                text: publicUrl, // Fallback
                type: 'image',
                createdAt: new Date().toISOString(),
                date: Date.now(),
                author: currentUser?.name || 'Utilisateur'
            };
            const updatedComments = row.comments ? [...row.comments, newActivity] : [newActivity];
            onRowChange({ ...row, comments: updatedComments });

            // 2. Insert into Supabase Activity Table (Persistent)
            await supabase.from('activity').insert({
                type: 'image',
                content: publicUrl,
                user_name: currentUser?.name || 'Utilisateur',
                row_id: String(row.id),
                created_at: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Erreur lors de l'envoi de l'image");
        }
    }, [row, onRowChange, currentUser]);

    if (!row) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl" // Wider to accommodate sidebar
            fullWidth
            PaperProps={{
                sx: { height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 },
            }}
        >
            {/* Header */}
            <Box sx={{
                p: '12px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'white'
            }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
                    Détails de la ligne
                    <Typography component="span" sx={{ ml: 1.5, fontSize: 13, color: '#6B7280', bgcolor: '#F3F4F6', px: 1, py: 0.5, borderRadius: 1 }}>
                        #{String(row.id).slice(-4)}
                    </Typography>
                </Typography>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title={isSidebarOpen ? "Masquer l'activité" : "Afficher l'activité"}>
                        <IconButton
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            sx={{
                                color: isSidebarOpen ? '#2563EB' : '#6B7280',
                                bgcolor: isSidebarOpen ? '#EFF6FF' : 'transparent',
                                '&:hover': { bgcolor: isSidebarOpen ? '#DBEAFE' : '#F3F4F6' }
                            }}
                        >
                            <ChatBubbleOutlineIcon />
                        </IconButton>
                    </Tooltip>
                    <IconButton onClick={onClose} sx={{ color: '#9CA3AF', '&:hover': { color: '#111827', bgcolor: '#F3F4F6' } }}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Main Content Area (Flex Row) */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* LEFT: FORM */}
                <Box sx={{
                    flex: 1,
                    p: 4,
                    overflowY: 'auto',
                    bgcolor: 'white'
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 800, margin: '0 auto' }}>

                        {schema.map((col) => {
                            if (col.key === 'sel' || col.key === 'detail') return null;
                            if (columnVisibilityModel && columnVisibilityModel[col.key] === false) return null;

                            const isReadOnly = col.readOnly || col.type === 'formula';
                            const isSelect = col.type === 'select' || (col.options && col.options.length > 0);
                            const isBoolean = col.type === 'boolean' || col.type === 'checkbox';
                            const isPhoto = col.type === 'photo';
                            const isSketch = col.type === 'croquis';

                            // PHOTO FIELD
                            if (isPhoto) {
                                return (
                                    <Box key={col.key}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: '#374151', fontWeight: 500 }}>
                                            {col.label || col.key}
                                        </Typography>
                                        <div style={{
                                            border: '1px solid #E5E7EB',
                                            borderRadius: 8,
                                            padding: 12,
                                            minHeight: 80,
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            <GridPhotoCell
                                                value={row[col.key]}
                                                rowId={row.id}
                                                field={col.key}
                                                onImageUpload={(newVal) => handleFieldChange(col.key, newVal)}
                                            />
                                        </div>
                                    </Box>
                                );
                            }

                            // SKETCH FIELD
                            if (isSketch) {
                                return (
                                    <Box key={col.key}>
                                        <Typography variant="subtitle2" sx={{ mb: 1, color: '#374151', fontWeight: 500 }}>
                                            {col.label || col.key}
                                        </Typography>
                                        <div style={{
                                            border: '1px solid #E5E7EB',
                                            borderRadius: 8,
                                            padding: 12,
                                            minHeight: 80,
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            <GridSketchCell
                                                value={row[col.key]}
                                                rowId={row.id}
                                                field={col.key}
                                                onSketchUpdate={(newVal) => handleFieldChange(col.key, newVal)}
                                            />
                                        </div>
                                    </Box>
                                );
                            }

                            if (isBoolean) {
                                return (
                                    <FormControlLabel
                                        key={col.key}
                                        control={
                                            <Switch
                                                checked={!!row[col.key]}
                                                onChange={(e) => handleFieldChange(col.key, e.target.checked)}
                                                disabled={isReadOnly}
                                            />
                                        }
                                        label={col.label || col.key}
                                        sx={{ ml: 0 }}
                                    />
                                );
                            }

                            if (isSelect) {
                                return (
                                    <TextField
                                        key={col.key}
                                        select
                                        fullWidth
                                        label={col.label || col.key}
                                        value={row[col.key] ?? ''}
                                        onChange={(e) => handleFieldChange(col.key, e.target.value)}
                                        disabled={isReadOnly}
                                        variant="outlined"
                                        size="medium"
                                    >
                                        {col.options?.map((option) => (
                                            <MenuItem key={option} value={option}>
                                                {option}
                                            </MenuItem>
                                        ))}
                                    </TextField>
                                );
                            }

                            // Default Text / Number
                            return (
                                <BlurTextField
                                    key={col.key}
                                    fullWidth
                                    label={col.label || col.key}
                                    value={row[col.key]}
                                    onChange={(newValue) => handleFieldChange(col.key, newValue)}
                                    disabled={isReadOnly}
                                    type={col.type === 'number' || col.type === 'formula' ? 'number' : 'text'}
                                    variant="outlined"
                                    size="medium"
                                    helperText={col.formula ? `Formule: ${col.formula}` : ''}
                                />
                            );
                        })}
                    </Box>
                </Box>

                {/* RIGHT: SIDEBAR (Collapsible) */}
                {isSidebarOpen && (
                    <ActivitySidebar
                        isOpen={isSidebarOpen}
                        activities={activities}
                        onAddComment={handleAddComment}
                        onAddImage={handleAddImage} // <--- Pass Handler
                        currentUser={currentUser?.name || "Utilisateur"}
                        minuteId={minuteId}
                        projectId={projectId}
                        rowId={row.id}
                        row={row} // <--- Pass row for context
                    />
                )}

            </Box>
        </Dialog>
    );
}
