import React, { useState, useMemo } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, IconButton, Typography, Box, Tooltip,
    InputAdornment, Popover
} from '@mui/material';
import { ExternalLink, Trash2, Plus, FileText, FolderOpen, Search, SlidersHorizontal, Check } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

const DOC_TYPES = [
    { value: 'plan',      label: 'Plan',             bg: '#EFF6FF', color: '#1D4ED8', border: '#BFDBFE' },
    { value: 'reperage',  label: 'Plan de repérage', bg: '#FFF7ED', color: '#C2410C', border: '#FED7AA' },
    { value: 'fiche',     label: 'Fiche technique',  bg: '#F0FDF4', color: '#15803D', border: '#BBF7D0' },
    { value: 'autre',     label: 'Autre',            bg: '#F3F4F6', color: '#4B5563', border: '#E5E7EB' },
];

function getType(value) {
    return DOC_TYPES.find(t => t.value === value) || DOC_TYPES[3];
}

function TypeBadge({ type }) {
    const def = getType(type);
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center',
            background: def.bg, color: def.color,
            border: `1px solid ${def.border}`,
            borderRadius: 20, fontWeight: 600, fontSize: 11,
            padding: '3px 10px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
            {def.label}
        </span>
    );
}

// ─── Sélecteur de catégorie style Airtable ───────────────────────────────────

function CategorySelect({ value, onChange, error }) {
    const [anchor, setAnchor] = useState(null);
    const open = Boolean(anchor);
    const selected = value ? getType(value) : null;

    return (
        <Box>
            {/* Label */}
            <Typography variant="caption" sx={{
                display: 'block', mb: 0.6, fontSize: 12, fontWeight: 600,
                color: error ? '#EF4444' : '#6B7280',
            }}>
                Catégorie *
            </Typography>

            {/* Trigger */}
            <Box
                onClick={e => setAnchor(e.currentTarget)}
                sx={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    px: 1.5, height: 38, borderRadius: 2, cursor: 'pointer',
                    border: `1px solid ${error ? '#EF4444' : open ? '#1F2937' : '#D1D5DB'}`,
                    bgcolor: 'white', transition: 'border-color 0.15s',
                    '&:hover': { borderColor: '#1F2937' },
                }}
            >
                {selected ? (
                    <span style={{
                        display: 'inline-flex', alignItems: 'center',
                        background: selected.bg, color: selected.color,
                        border: `1px solid ${selected.border}`,
                        borderRadius: 20, fontWeight: 600, fontSize: 12,
                        padding: '3px 10px',
                    }}>
                        {selected.label}
                    </span>
                ) : (
                    <Typography sx={{ fontSize: 13, color: '#9CA3AF' }}>
                        Sélectionner une catégorie…
                    </Typography>
                )}
                {/* Chevron */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: '#9CA3AF', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
            </Box>

            {error && (
                <Typography variant="caption" sx={{ color: '#EF4444', mt: 0.4, display: 'block', fontSize: 11, ml: 0.5 }}>
                    {error}
                </Typography>
            )}

            {/* Dropdown */}
            <Popover
                open={open}
                anchorEl={anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{
                    sx: {
                        mt: 0.5, borderRadius: 2, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                        border: '1px solid #F3F4F6', minWidth: 220, py: 1,
                    }
                }}
            >
                {DOC_TYPES.map(t => (
                    <Box
                        key={t.value}
                        onClick={() => { onChange(t.value); setAnchor(null); }}
                        sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: 2, py: 0.9, cursor: 'pointer',
                            bgcolor: value === t.value ? '#F9FAFB' : 'transparent',
                            '&:hover': { bgcolor: '#F9FAFB' },
                        }}
                    >
                        <span style={{
                            display: 'inline-flex', alignItems: 'center',
                            background: t.bg, color: t.color,
                            border: `1px solid ${t.border}`,
                            borderRadius: 20, fontWeight: 600, fontSize: 12,
                            padding: '3px 10px',
                        }}>
                            {t.label}
                        </span>
                        {value === t.value && <Check size={14} color="#1F2937" />}
                    </Box>
                ))}
            </Popover>
        </Box>
    );
}

// ─── Sub-dialog : formulaire d'ajout ─────────────────────────────────────────

function AddDocDialog({ open, onClose, onAdd }) {
    const [name,    setName]    = useState("");
    const [url,     setUrl]     = useState("");
    const [comment, setComment] = useState("");
    const [type,    setType]    = useState("");
    const [errors,  setErrors]  = useState({});

    const reset = () => { setName(""); setUrl(""); setComment(""); setType(""); setErrors({}); };
    const handleClose = () => { reset(); onClose(); };

    const handleSubmit = () => {
        const e = {};
        if (!name.trim()) e.name = "Le nom est obligatoire.";
        if (!url.trim())  e.url  = "Le lien URL est obligatoire.";
        if (!type)        e.type = "La catégorie est obligatoire.";
        if (Object.keys(e).length) { setErrors(e); return; }

        let finalUrl = url.trim();
        if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
        onAdd({ id: Date.now().toString(), name: name.trim(), url: finalUrl, comment: comment.trim(), type, createdAt: new Date().toISOString() });
        reset();
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth
            PaperProps={{ sx: { borderRadius: 3 } }}>
            <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1.5, fontWeight: 700, fontSize: 15, color: '#111827', borderBottom: '1px solid #F3F4F6' }}>
                Ajouter un document
            </DialogTitle>
            <DialogContent sx={{ px: 3, pt: 2.5, pb: 1 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {/* Nom */}
                    <TextField
                        label="Nom du document *"
                        placeholder="ex : Plan RDC, FT Tringle Barnabé…"
                        size="small" fullWidth
                        value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })); }}
                        error={Boolean(errors.name)}
                        helperText={errors.name || ''}
                        inputProps={{ style: { fontSize: 13 } }}
                    />

                    {/* URL */}
                    <TextField
                        label="Lien URL *"
                        placeholder="https://…"
                        size="small" fullWidth
                        value={url} onChange={e => { setUrl(e.target.value); setErrors(p => ({ ...p, url: '' })); }}
                        error={Boolean(errors.url)}
                        helperText={errors.url || ''}
                        inputProps={{ style: { fontSize: 13 } }}
                    />

                    {/* Catégorie — style Airtable */}
                    <CategorySelect
                        value={type}
                        onChange={val => { setType(val); setErrors(p => ({ ...p, type: '' })); }}
                        error={errors.type}
                    />

                    {/* Commentaire */}
                    <TextField
                        label="Commentaire (facultatif)"
                        placeholder="ex : Version mise à jour le 12/03"
                        size="small" fullWidth multiline rows={2}
                        value={comment} onChange={e => setComment(e.target.value)}
                        inputProps={{ style: { fontSize: 13 } }}
                    />

                </Box>
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 2, gap: 1, borderTop: '1px solid #F3F4F6' }}>
                <Button onClick={handleClose} sx={{ color: '#6B7280', fontWeight: 600 }}>Annuler</Button>
                <Button variant="contained" onClick={handleSubmit}
                    sx={{ bgcolor: '#1F2937', borderRadius: 2, fontWeight: 600, '&:hover': { bgcolor: '#111827' } }}>
                    Ajouter
                </Button>
            </DialogActions>
        </Dialog>
    );
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function DocumentListModal({ open, onClose, documents = [], onUpdate }) {
    const [addOpen,      setAddOpen]      = useState(false);
    const [search,       setSearch]       = useState("");
    const [filterAnchor, setFilterAnchor] = useState(null);
    const [activeFilter, setActiveFilter] = useState(null); // null = tous

    const handleAdd = (doc) => {
        onUpdate([...documents, doc]);
    };

    const handleDelete = (id) => {
        onUpdate(documents.filter(d => d.id !== id));
    };

    const getHostname = (url) => {
        try { return new URL(url).hostname.replace('www.', ''); }
        catch { return url; }
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
    };

    const filtered = useMemo(() => {
        let list = documents;
        if (activeFilter) list = list.filter(d => d.type === activeFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(d =>
                d.name?.toLowerCase().includes(q) ||
                d.comment?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [documents, activeFilter, search]);

    const filterOpen = Boolean(filterAnchor);

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
                PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden', maxHeight: '80vh' } }}>

                {/* ── HEADER ── */}
                <DialogTitle sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    px: 3, py: 2, borderBottom: '1px solid #F3F4F6',
                }}>
                    <Box sx={{
                        width: 32, height: 32, borderRadius: 1.5,
                        background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <FileText size={16} color="#374151" />
                    </Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 16, color: '#111827' }}>
                        Documents &amp; Plans
                    </Typography>

                    {/* Bouton ajout */}
                    <Button
                        variant="contained"
                        startIcon={<Plus size={15} />}
                        onClick={() => setAddOpen(true)}
                        size="small"
                        sx={{
                            ml: 1, bgcolor: '#1F2937', borderRadius: 2, fontWeight: 600,
                            fontSize: 12, textTransform: 'none', px: 1.5,
                            '&:hover': { bgcolor: '#111827' },
                        }}
                    >
                        Ajouter un document
                    </Button>

                    {/* Compteur */}
                    <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{
                            minWidth: 26, height: 26, borderRadius: '50%',
                            background: documents.length > 0 ? '#1F2937' : '#F3F4F6',
                            color: documents.length > 0 ? 'white' : '#9CA3AF',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 12, fontWeight: 700,
                        }}>
                            {documents.length}
                        </Box>
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ px: 3, py: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>

                    {/* ── BARRE RECHERCHE + FILTRE ── */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            placeholder="Rechercher un document…"
                            size="small" fullWidth
                            value={search} onChange={e => setSearch(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search size={15} color="#9CA3AF" />
                                    </InputAdornment>
                                ),
                                style: { fontSize: 13, borderRadius: 8 },
                            }}
                        />
                        <Tooltip title="Filtrer par catégorie">
                            <Button
                                variant="outlined"
                                onClick={e => setFilterAnchor(e.currentTarget)}
                                startIcon={<SlidersHorizontal size={14} />}
                                sx={{
                                    borderColor: activeFilter ? '#1F2937' : '#E5E7EB',
                                    color: activeFilter ? '#1F2937' : '#6B7280',
                                    bgcolor: activeFilter ? '#F9FAFB' : 'white',
                                    borderRadius: 2, fontWeight: 600, fontSize: 12,
                                    textTransform: 'none', px: 1.5, whiteSpace: 'nowrap',
                                    '&:hover': { borderColor: '#1F2937', bgcolor: '#F9FAFB' },
                                }}
                            >
                                {activeFilter ? getType(activeFilter).label : 'Filtrer'}
                            </Button>
                        </Tooltip>
                    </Box>

                    {/* ── LISTE ── */}
                    {documents.length === 0 ? (
                        <Box sx={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            py: 6, gap: 1.5, color: '#9CA3AF',
                        }}>
                            <FolderOpen size={36} strokeWidth={1.2} />
                            <Typography variant="body2" sx={{ color: '#9CA3AF' }}>
                                Aucun document lié à ce projet
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#D1D5DB' }}>
                                Cliquez sur « Ajouter un document » pour commencer
                            </Typography>
                        </Box>
                    ) : filtered.length === 0 ? (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography variant="body2" sx={{ color: '#9CA3AF', fontStyle: 'italic' }}>
                                Aucun document ne correspond à la recherche
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {filtered.map((doc) => (
                                <Box key={doc.id} sx={{
                                    display: 'flex', alignItems: 'center', gap: 2,
                                    px: 2, py: 1.5,
                                    border: '1px solid #F3F4F6', borderRadius: 2,
                                    bgcolor: '#FAFAFA',
                                    transition: 'all 0.12s',
                                    '&:hover': { borderColor: '#E5E7EB', bgcolor: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
                                }}>
                                    {/* Nom + hostname */}
                                    <Box sx={{ flex: '0 0 220px', minWidth: 0 }}>
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                            style={{ color: '#1D4ED8', textDecoration: 'none', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {doc.name}
                                            </span>
                                            <ExternalLink size={11} style={{ flexShrink: 0 }} />
                                        </a>
                                        <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: 10 }}>
                                            {getHostname(doc.url)}
                                        </Typography>
                                    </Box>

                                    {/* Type */}
                                    <Box sx={{ flex: '0 0 140px' }}>
                                        <TypeBadge type={doc.type} />
                                    </Box>

                                    {/* Date */}
                                    <Box sx={{ flex: '0 0 90px' }}>
                                        <Typography variant="caption" sx={{ color: '#6B7280', fontSize: 11 }}>
                                            Ajouté le
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>
                                            {formatDate(doc.createdAt)}
                                        </Typography>
                                    </Box>

                                    {/* Commentaire */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        {doc.comment ? (
                                            <>
                                                <Typography variant="caption" sx={{ color: '#6B7280', fontSize: 11 }}>
                                                    Commentaire
                                                </Typography>
                                                <Typography variant="body2" sx={{
                                                    fontSize: 12, color: '#374151',
                                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                }}>
                                                    {doc.comment}
                                                </Typography>
                                            </>
                                        ) : (
                                            <Typography variant="caption" sx={{ color: '#D1D5DB', fontSize: 11, fontStyle: 'italic' }}>
                                                —
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Delete */}
                                    <Tooltip title="Supprimer" placement="left">
                                        <IconButton size="small" onClick={() => handleDelete(doc.id)} sx={{
                                            color: '#D1D5DB', flexShrink: 0,
                                            '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' },
                                        }}>
                                            <Trash2 size={15} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            ))}
                        </Box>
                    )}
                </DialogContent>

                <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #F3F4F6' }}>
                    <Button onClick={onClose} sx={{ color: '#6B7280', fontWeight: 600 }}>Fermer</Button>
                </DialogActions>
            </Dialog>

            {/* ── POPOVER FILTRE ── */}
            <Popover
                open={filterOpen}
                anchorEl={filterAnchor}
                onClose={() => setFilterAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                PaperProps={{ sx: { borderRadius: 2, mt: 0.5, boxShadow: '0 4px 16px rgba(0,0,0,0.08)', minWidth: 180 } }}
            >
                <Box sx={{ py: 1 }}>
                    {/* Tous */}
                    <Box onClick={() => { setActiveFilter(null); setFilterAnchor(null); }} sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        px: 2, py: 1, cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        color: activeFilter === null ? '#111827' : '#6B7280',
                        bgcolor: activeFilter === null ? '#F9FAFB' : 'transparent',
                        '&:hover': { bgcolor: '#F9FAFB' },
                    }}>
                        Tous les types
                        {activeFilter === null && <Check size={14} color="#1F2937" />}
                    </Box>
                    {DOC_TYPES.map(t => (
                        <Box key={t.value} onClick={() => { setActiveFilter(t.value); setFilterAnchor(null); }} sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            px: 2, py: 1, cursor: 'pointer', fontSize: 13,
                            color: activeFilter === t.value ? t.color : '#374151',
                            bgcolor: activeFilter === t.value ? t.bg : 'transparent',
                            fontWeight: activeFilter === t.value ? 700 : 500,
                            '&:hover': { bgcolor: t.bg },
                        }}>
                            {t.label}
                            {activeFilter === t.value && <Check size={14} />}
                        </Box>
                    ))}
                </Box>
            </Popover>

            {/* ── SOUS-DIALOG AJOUT ── */}
            <AddDocDialog open={addOpen} onClose={() => setAddOpen(false)} onAdd={handleAdd} />
        </>
    );
}
