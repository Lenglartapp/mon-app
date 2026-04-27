import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, IconButton, Typography, Box, Tooltip
} from '@mui/material';
import { ExternalLink, Trash2, Plus, FileText, FolderOpen } from 'lucide-react';

const DOC_TYPES = [
    { value: 'plan',         label: 'Plan',               bg: '#EFF6FF', color: '#1D4ED8' },
    { value: 'reperage',     label: 'Plan de repérage',   bg: '#FFF7ED', color: '#C2410C' },
    { value: 'fiche',        label: 'Fiche technique',    bg: '#F0FDF4', color: '#15803D' },
    { value: 'autre',        label: 'Autre',              bg: '#F3F4F6', color: '#4B5563' },
];

function TypeChip({ type, size = 'md' }) {
    const def = DOC_TYPES.find(t => t.value === type) || DOC_TYPES[3];
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: def.bg, color: def.color,
            borderRadius: 6, fontWeight: 600,
            fontSize: size === 'sm' ? 10 : 11,
            padding: size === 'sm' ? '2px 6px' : '3px 8px',
            whiteSpace: 'nowrap',
        }}>
            {def.label}
        </span>
    );
}

export default function DocumentListModal({ open, onClose, documents = [], onUpdate }) {
    const [newDocName, setNewDocName] = useState("");
    const [newDocUrl, setNewDocUrl]   = useState("");
    const [newDocType, setNewDocType] = useState("plan");
    const [error, setError]           = useState("");

    const handleAdd = () => {
        if (!newDocName.trim()) { setError("Le nom est obligatoire."); return; }
        if (!newDocUrl.trim())  { setError("Le lien est obligatoire."); return; }

        let url = newDocUrl.trim();
        if (!url.startsWith('http')) url = 'https://' + url;

        const newDoc = {
            id:        Date.now().toString(),
            name:      newDocName.trim(),
            url,
            type:      newDocType,
            createdAt: new Date().toISOString(),
        };

        onUpdate([...documents, newDoc]);
        setNewDocName("");
        setNewDocUrl("");
        setNewDocType("plan");
        setError("");
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAdd();
    };

    const handleDelete = (id) => {
        onUpdate(documents.filter(d => d.id !== id));
    };

    const getHostname = (url) => {
        try { return new URL(url).hostname.replace('www.', ''); }
        catch { return url; }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>

            {/* HEADER */}
            <DialogTitle sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                px: 3, py: 2.5, borderBottom: '1px solid #F3F4F6',
                fontWeight: 700, fontSize: 17, color: '#111827',
            }}>
                <Box sx={{
                    width: 34, height: 34, borderRadius: 2,
                    background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <FileText size={18} color="#1F2937" />
                </Box>
                Documents &amp; Plans
                {documents.length > 0 && (
                    <Box component="span" sx={{
                        ml: 'auto', fontSize: 12, fontWeight: 600,
                        background: '#F3F4F6', color: '#6B7280',
                        borderRadius: 10, px: 1.2, py: 0.3,
                    }}>
                        {documents.length}
                    </Box>
                )}
            </DialogTitle>

            <DialogContent sx={{ px: 3, py: 2.5 }}>

                {/* FORM */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                        Ajouter un document
                    </Typography>

                    {/* Type selector */}
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
                        {DOC_TYPES.map(t => (
                            <Box key={t.value} onClick={() => setNewDocType(t.value)} sx={{
                                cursor: 'pointer',
                                px: 1.5, py: 0.6,
                                borderRadius: 2,
                                fontSize: 12, fontWeight: 600,
                                border: '1.5px solid',
                                borderColor: newDocType === t.value ? t.color : 'transparent',
                                background: newDocType === t.value ? t.bg : '#F9FAFB',
                                color: newDocType === t.value ? t.color : '#9CA3AF',
                                transition: 'all 0.15s',
                                userSelect: 'none',
                            }}>
                                {t.label}
                            </Box>
                        ))}
                    </Box>

                    {/* Inputs */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <TextField
                            placeholder="Nom du document  (ex : Plan RDC)"
                            size="small" fullWidth
                            value={newDocName}
                            onChange={e => setNewDocName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            inputProps={{ style: { fontSize: 13 } }}
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                placeholder="Lien URL  (Sharepoint, Drive…)"
                                size="small" fullWidth
                                value={newDocUrl}
                                onChange={e => setNewDocUrl(e.target.value)}
                                onKeyDown={handleKeyDown}
                                inputProps={{ style: { fontSize: 13 } }}
                            />
                            <Button
                                variant="contained"
                                onClick={handleAdd}
                                sx={{
                                    minWidth: 44, px: 1.5,
                                    bgcolor: '#1F2937', borderRadius: 2,
                                    '&:hover': { bgcolor: '#111827' },
                                    flexShrink: 0,
                                }}
                            >
                                <Plus size={18} />
                            </Button>
                        </Box>
                        {error && (
                            <Typography color="error" variant="caption" sx={{ mt: -0.5 }}>
                                {error}
                            </Typography>
                        )}
                    </Box>
                </Box>

                {/* DIVIDER */}
                <Box sx={{ borderTop: '1px solid #F3F4F6', mb: 2.5 }} />

                {/* LIST */}
                <Typography variant="caption" sx={{ fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', mb: 1.5 }}>
                    Documents liés
                </Typography>

                {documents.length === 0 ? (
                    <Box sx={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        py: 4, gap: 1, color: '#9CA3AF',
                    }}>
                        <FolderOpen size={32} strokeWidth={1.5} />
                        <Typography variant="body2" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                            Aucun document lié pour le moment
                        </Typography>
                    </Box>
                ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {documents.map((doc) => (
                            <Box key={doc.id} sx={{
                                display: 'flex', alignItems: 'center', gap: 1.5,
                                p: '10px 12px',
                                border: '1px solid #F3F4F6',
                                borderRadius: 2,
                                bgcolor: '#FAFAFA',
                                transition: 'border-color 0.15s',
                                '&:hover': { borderColor: '#E5E7EB', bgcolor: 'white' },
                            }}>
                                {/* Type badge */}
                                <TypeChip type={doc.type} size="sm" />

                                {/* Name + hostname */}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <a
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            color: '#1D4ED8', textDecoration: 'none', fontWeight: 600,
                                            fontSize: 13, display: 'flex', alignItems: 'center', gap: 4,
                                        }}
                                    >
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {doc.name}
                                        </span>
                                        <ExternalLink size={11} style={{ flexShrink: 0 }} />
                                    </a>
                                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: 10 }}>
                                        {getHostname(doc.url)}
                                    </Typography>
                                </Box>

                                {/* Delete */}
                                <Tooltip title="Supprimer" placement="left">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleDelete(doc.id)}
                                        sx={{
                                            color: '#D1D5DB', flexShrink: 0,
                                            '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' },
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}
                    </Box>
                )}

            </DialogContent>

            <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #F3F4F6' }}>
                <Button onClick={onClose} sx={{ color: '#6B7280', fontWeight: 600 }}>
                    Fermer
                </Button>
            </DialogActions>
        </Dialog>
    );
}
