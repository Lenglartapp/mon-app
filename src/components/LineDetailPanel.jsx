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
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';

import ActivitySidebar from './ui/ActivitySidebar';
import GridPhotoCell from './ui/GridPhotoCell';
import GridSketchCell from './ui/GridSketchCell';
import { generateRowLogs } from '../lib/utils/logUtils';

import BlurTextField from './ui/BlurTextField';
import { useAuth } from '../auth'; // <--- NEW IMPORT
import { supabase } from '../lib/supabaseClient'; // <--- NEW IMPORT

export default function LineDetailPanel({ open, onClose, row, schema, onRowChange, columnVisibilityModel, minuteId, projectId, currentUser: propUser, authorName: propAuthorName, fullScreen = false, allRows }) {
    // New Sidebar Toggle State
    // New Sidebar Toggle State. On mobile (fullScreen), default to closed (false). On desktop, open (true).
    const [isSidebarOpen, setIsSidebarOpen] = useState(!fullScreen);
    const { currentUser: ctxUser } = useAuth(); // <--- GET CURRENT USER
    const currentUser = propUser || ctxUser;

    // Simple and robust author resolution
    const resolvedAuthor = currentUser?.name || currentUser?.email || "Utilisateur";

    // Conflit (zone, pièce) : vrai si une autre ligne a déjà la même combinaison
    const pieceConflict = React.useMemo(() => {
        if (!allRows || !row?.piece) return false;
        const normalizedZone = (row.zone || '').trim().toLowerCase();
        const normalizedPiece = (row.piece || '').trim().toLowerCase();
        return allRows.some(r =>
            r.id !== row.id &&
            (r.zone || '').trim().toLowerCase() === normalizedZone &&
            (r.piece || '').trim().toLowerCase() === normalizedPiece
        );
    }, [allRows, row?.piece, row?.zone, row?.id]);

    const activities = React.useMemo(() => row?.comments || [], [row?.comments]);
    const activityCount = React.useMemo(() =>
        activities.filter(c => c.type !== 'log' && c.type !== 'change').length,
        [activities]
    );

    const handleFieldChange = React.useCallback((key, value) => {
        if (!row) return;
        const oldRow = { ...row };
        const newRow = { ...row, [key]: value };

        const newLogs = generateRowLogs(oldRow, newRow, schema, resolvedAuthor);

        let updatedComments = newRow.comments || [];
        if (newLogs.length > 0) {
            updatedComments = [...updatedComments, ...newLogs];
        }

        onRowChange({ ...newRow, comments: updatedComments });
    }, [row, onRowChange, schema, resolvedAuthor]);

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

    // Handle Image Upload for Activity Sidebar (with optional caption)
    const handleAddImage = React.useCallback(async (file, caption) => {
        if (!row || !file) return;

        try {
            const fileName = `activity/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '')}`;

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('attachments')
                .getPublicUrl(fileName);

            const authorName = currentUser?.name || 'Utilisateur';
            const now = new Date().toISOString();

            // 1. Build activity entry
            const newActivity = {
                id: Date.now(),
                content: publicUrl,
                caption: caption || null,
                type: 'image',
                createdAt: now,
                date: Date.now(),
                author: authorName
            };
            const updatedComments = row.comments ? [...row.comments, newActivity] : [newActivity];

            // 2. Sync photos_sur_site if this field exists in the schema
            const hasSurSite = schema && schema.some(col => col.key === 'photos_sur_site');
            const updatedPhotosSurSite = hasSurSite
                ? [...(Array.isArray(row.photos_sur_site) ? row.photos_sur_site : []),
                   { url: publicUrl, timestamp: now, user: authorName, id: Date.now() }]
                : row.photos_sur_site;

            const updatedRow = {
                ...row,
                comments: updatedComments,
                ...(hasSurSite && { photos_sur_site: updatedPhotosSurSite })
            };
            onRowChange(updatedRow);

            // 3. Persist in activity table
            await supabase.from('activity').insert({
                type: 'image',
                content: publicUrl,
                caption: caption || null,
                user_name: authorName,
                row_id: String(row.id),
                created_at: now
            });

        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Erreur lors de l'envoi de l'image");
        }
    }, [row, onRowChange, currentUser, schema]);

    if (!row) return null;

    // Rerender logic ... omitted for brevity in replace block, targeting just function signature and Dialog props if possible.
    // Actually I can't easily target just signature and Dialog start due to distance.
    // I will replace the Dialog start.

    // Wait, I need to update signature too.
    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="xl" // Wider to accommodate sidebar
            fullWidth
            fullScreen={false} // Always modal, never full screen
            PaperProps={{
                sx: fullScreen
                    ? {
                        // Mobile: "Almost" fullscreen but with margins and rounded corners
                        height: 'calc(100% - 32px)',
                        margin: 2, // 16px margin around
                        display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3
                    }
                    : { height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 },
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
                    {fullScreen
                        ? [row.zone, row.piece, row.produit].filter(Boolean).join(' ') || "Détails"
                        : "Détails de la ligne"
                    }
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
                            <Badge badgeContent={activityCount} color="primary">
                            <ChatBubbleOutlineIcon />
                        </Badge>
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
                            const isPieceField = col.key === 'piece';
                            const hasConflict = isPieceField && pieceConflict;
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
                                    error={hasConflict}
                                    helperText={hasConflict ? 'Ce nom de pièce existe déjà dans cette zone' : (col.formula ? `Formule: ${col.formula}` : '')}
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
