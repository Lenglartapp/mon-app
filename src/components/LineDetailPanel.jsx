import React, { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';

import ActivitySidebar from './ui/ActivitySidebar';
import { ToolbarButton } from './ui/ToolbarControls';
import { DA_FIELD_SX } from '../lib/constants/daStyles';
import { MessageSquare, X } from 'lucide-react';
import GridPhotoCell from './ui/GridPhotoCell';
import GridSketchCell from './ui/GridSketchCell';
import { generateRowLogs } from '../lib/utils/logUtils';
import { mergeRowLogs } from '../lib/lineLogs';
import { useArchivedRowLogs } from '../hooks/useArchivedRowLogs';

import BlurTextField from './ui/BlurTextField';
import { useAuth } from '../auth'; // <--- NEW IMPORT
import { supabase } from '../lib/supabaseClient'; // <--- NEW IMPORT
import { blobToBase64, queuePhoto } from '../lib/syncQueue';
import { compressImageToBlob, uploadBlobToStorage } from '../lib/utils/imageUpload';

const ROBOTO = 'Roboto, system-ui, sans-serif';

// Champs fins à la DA (cf. DA_FIELD_SX).
const FIELD_SX = DA_FIELD_SX;

// Ligne de propriété : libellé gris à gauche (largeur fixe), valeur à droite.
function PropRow({ label, children, top = false }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: '200px minmax(0, 1fr)', gap: 16, alignItems: top ? 'start' : 'center', padding: '7px 0' }}>
            <div style={{ fontFamily: ROBOTO, fontSize: 13, color: '#6B7280', paddingTop: top ? 10 : 0, overflow: 'hidden', textOverflow: 'ellipsis' }} title={label}>{label}</div>
            <div style={{ minWidth: 0 }}>{children}</div>
        </div>
    );
}

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

    // Historique « Modif … » archivé hors de la ligne (table line_logs) : rechargé à
    // l'ouverture du panneau et fusionné avec row.comments (cf. lib/lineLogs).
    const archiveRows = React.useMemo(() => (row ? [row] : []), [row?.id, row?.__logArchive]); // eslint-disable-line react-hooks/exhaustive-deps
    const { byRow: archivedLogs } = useArchivedRowLogs(minuteId || projectId, archiveRows, !!open && !!row);
    const activities = React.useMemo(
        () => mergeRowLogs(row?.comments || [], archivedLogs.get(String(row?.id))),
        [row?.comments, row?.id, archivedLogs]
    );
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

        // Compression (canvas) alignée sur les autres photos ; si elle échoue on garde le fichier brut
        let uploadBlob = file;
        try { uploadBlob = await compressImageToBlob(file); } catch { /* garde le fichier brut */ }

        try {
            const publicUrl = await uploadBlobToStorage(uploadBlob, 'activity', 'jpg');

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
            // Offline fallback : stocker en base64 + afficher en pending
            if (projectId && row) {
                try {
                    const localId = `pending_activity_${Date.now()}`;
                    const base64 = await blobToBase64(uploadBlob);
                    const authorName = currentUser?.name || 'Utilisateur';
                    const now = new Date().toISOString();

                    // '__activity__' : sentinel pour drainPhotos qui mettra à jour comments + photos_sur_site
                    await queuePhoto(projectId, row.id, '__activity__', localId, base64, {
                        timestamp: now, user: authorName, caption: caption || null
                    });

                    // id = localId pour pouvoir matcher et remplacer dans drainPhotos
                    const pendingActivity = {
                        id: localId,
                        content: base64,
                        caption: caption || null,
                        type: 'image',
                        createdAt: now,
                        date: Date.now(),
                        author: authorName,
                        pending: true,
                    };
                    const updatedComments = row.comments ? [...row.comments, pendingActivity] : [pendingActivity];

                    const hasSurSite = schema && schema.some(col => col.key === 'photos_sur_site');
                    const updatedPhotosSurSite = hasSurSite
                        ? [...(Array.isArray(row.photos_sur_site) ? row.photos_sur_site : []),
                           { url: base64, id: localId, pending: true, timestamp: now, user: authorName }]
                        : row.photos_sur_site;

                    onRowChange({
                        ...row,
                        comments: updatedComments,
                        ...(hasSurSite && { photos_sur_site: updatedPhotosSurSite })
                    });
                    return;
                } catch (offlineError) {
                    console.error("Erreur fallback offline photo:", offlineError);
                }
            }
            console.error("Error uploading image:", error);
            alert("Erreur lors de l'envoi de l'image");
        }
    }, [row, onRowChange, currentUser, schema, projectId]);

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
                        display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px'
                    }
                    : { height: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: '12px', boxShadow: '0 20px 40px rgba(17,24,39,0.18)' },
            }}
        >
            {/* En-tête à la DA : titre Roboto + référence de ligne, bouton Activité, croix */}
            <Box sx={{ p: '20px 28px 16px', borderBottom: '1px solid #E8E6E2', display: 'flex', alignItems: 'flex-start', gap: 1.5, bgcolor: 'white' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: ROBOTO, fontSize: 24, fontWeight: 400, color: '#111827', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {[row.zone, row.piece, row.produit].filter(Boolean).join(' · ') || 'Détail de la ligne'}
                    </div>
                    <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Détail de la ligne · #{String(row.id).slice(-4)}</div>
                </Box>
                <ToolbarButton
                    icon={<MessageSquare size={16} />}
                    active={isSidebarOpen}
                    onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                    title={isSidebarOpen ? "Masquer l'activité" : "Afficher l'activité"}
                >
                    Activité{activityCount > 0 ? ` (${activityCount})` : ''}
                </ToolbarButton>
                <button onClick={onClose} title="Fermer" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9B9A97', display: 'flex', padding: 4, marginTop: 6 }}>
                    <X size={20} />
                </button>
            </Box>

            {/* Main Content Area (Flex Row) */}
            <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* LEFT: FORM */}
                <Box sx={{
                    flex: 1,
                    p: '20px 28px',
                    overflowY: 'auto',
                    bgcolor: 'white'
                }}>
                    {/* Fiche façon Notion : libellé gris à gauche, valeur à droite */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', maxWidth: 820, margin: '0 auto' }}>

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
                                    <PropRow key={col.key} label={col.label || col.key} top>
                                        <div style={{
                                            border: '1px solid #E0DED9',
                                            borderRadius: 8,
                                            padding: 12,
                                            minHeight: 80,
                                            display: 'flex',
                                            alignItems: 'center'
                                        }}>
                                            <GridPhotoCell
                                                value={row[col.key]}
                                                onImageUpload={(newVal) => handleFieldChange(col.key, newVal)}
                                                offlineContext={projectId ? { projectId, rowId: row?.id, fieldKey: col.key } : undefined}
                                            />
                                        </div>
                                    </PropRow>
                                );
                            }

                            // SKETCH FIELD
                            if (isSketch) {
                                return (
                                    <PropRow key={col.key} label={col.label || col.key} top>
                                        <div style={{
                                            border: '1px solid #E0DED9',
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
                                    </PropRow>
                                );
                            }

                            if (isBoolean) {
                                return (
                                    <PropRow key={col.key} label={col.label || col.key}>
                                        <Switch
                                            checked={!!row[col.key]}
                                            onChange={(e) => handleFieldChange(col.key, e.target.checked)}
                                            disabled={isReadOnly}
                                            size="small"
                                        />
                                    </PropRow>
                                );
                            }

                            if (isSelect) {
                                return (
                                    <PropRow key={col.key} label={col.label || col.key}>
                                        <TextField
                                            select
                                            fullWidth
                                            value={row[col.key] ?? ''}
                                            onChange={(e) => handleFieldChange(col.key, e.target.value)}
                                            disabled={isReadOnly}
                                            variant="outlined"
                                            size="small"
                                            sx={FIELD_SX}
                                        >
                                            {col.options?.map((option) => (
                                                <MenuItem key={option} value={option} sx={{ fontSize: 14 }}>
                                                    {option}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                    </PropRow>
                                );
                            }

                            // Default Text / Number
                            const isPieceField = col.key === 'piece';
                            const hasConflict = isPieceField && pieceConflict;
                            return (
                                <PropRow key={col.key} label={col.label || col.key}>
                                    <BlurTextField
                                        fullWidth
                                        value={row[col.key]}
                                        onChange={(newValue) => handleFieldChange(col.key, newValue)}
                                        disabled={isReadOnly}
                                        type={col.type === 'number' || col.type === 'formula' ? 'number' : 'text'}
                                        variant="outlined"
                                        size="small"
                                        sx={FIELD_SX}
                                        error={hasConflict}
                                        helperText={hasConflict ? 'Ce nom de pièce existe déjà dans cette zone' : (col.formula ? `Formule : ${col.formula}` : '')}
                                    />
                                </PropRow>
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
