import React, { useState, useMemo } from 'react';
import { TextField, IconButton, Typography, Box, Tooltip, Popover } from '@mui/material';
import { ExternalLink, Trash2, Plus, FolderOpen, SlidersHorizontal, Check } from 'lucide-react';

import DaDialog from './ui/DaDialog';
import { ToolbarSearch, ToolbarButton, TonePill } from './ui/ToolbarControls';
import { toneColors } from '../lib/constants/daStyles';

// ─── Types ───────────────────────────────────────────────────────────────────

// Catégories : pastilles du nuancier bleu de la DA (« Autre » en gris neutre)
const DOC_TYPES = [
    { value: 'plan',      label: 'Plan',             tone: 1 },
    { value: 'reperage',  label: 'Plan de repérage', tone: 3 },
    { value: 'fiche',     label: 'Fiche technique',  tone: 2 },
    { value: 'autre',     label: 'Autre',            tone: null },
].map(t => ({ ...t, bg: toneColors(t.tone).bg, color: toneColors(t.tone).color, border: 'transparent' }));

function getType(value) {
    return DOC_TYPES.find(t => t.value === value) || DOC_TYPES[3];
}

function TypeBadge({ type }) {
    const def = getType(type);
    return <TonePill tone={def.tone}>{def.label}</TonePill>;
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
                            bgcolor: value === t.value ? '#F4F4F4' : 'transparent',
                            '&:hover': { bgcolor: '#F4F4F4' },
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
        <DaDialog
            open={open}
            onClose={handleClose}
            title="Ajouter un document"
            subtitle="Lien vers un plan, une fiche technique…"
            maxWidth="xs"
            footer={<>
                <div style={{ flex: 1 }} />
                <ToolbarButton onClick={handleClose}>Annuler</ToolbarButton>
                <ToolbarButton primary onClick={handleSubmit}>Ajouter</ToolbarButton>
            </>}
        >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 0.5 }}>

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
        </DaDialog>
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
            <DaDialog
                open={open}
                onClose={onClose}
                title="Documents & plans"
                subtitle={`${documents.length} document${documents.length > 1 ? 's' : ''} lié${documents.length > 1 ? 's' : ''} au projet`}
                maxWidth="md"
                headerExtra={<ToolbarButton primary icon={<Plus size={16} />} onClick={() => setAddOpen(true)}>Ajouter un document</ToolbarButton>}
                footer={<><div style={{ flex: 1 }} /><ToolbarButton onClick={onClose}>Fermer</ToolbarButton></>}
            >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Recherche + filtre par catégorie (style des barres d'outils) */}
                    <div style={{ display: 'flex', gap: 10 }}>
                        <ToolbarSearch value={search} onChange={setSearch} placeholder="Rechercher un document…" width="100%" grow />
                        <ToolbarButton
                            icon={<SlidersHorizontal size={15} />}
                            active={Boolean(activeFilter)}
                            onClick={e => setFilterAnchor(e.currentTarget)}
                            title="Filtrer par catégorie"
                        >
                            {activeFilter ? getType(activeFilter).label : 'Catégorie'}
                        </ToolbarButton>
                    </div>

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
                        <Box sx={{ border: '1px solid #E0DED9', borderRadius: '8px', overflow: 'hidden' }}>
                            {filtered.map((doc, i) => (
                                <Box key={doc.id} sx={{
                                    display: 'flex', alignItems: 'center', gap: 2,
                                    px: 2, py: 1.5,
                                    borderBottom: i < filtered.length - 1 ? '1px solid #E8E6E2' : 'none',
                                    bgcolor: 'white',
                                    '&:hover': { bgcolor: '#F7F7F5' },
                                }}>
                                    {/* Nom + hostname */}
                                    <Box sx={{ flex: '0 0 220px', minWidth: 0 }}>
                                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                                            style={{ color: '#1E2447', textDecoration: 'none', fontWeight: 500, fontSize: 14, display: 'flex', alignItems: 'center', gap: 4 }}>
                                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {doc.name}
                                            </span>
                                            <ExternalLink size={11} style={{ flexShrink: 0 }} />
                                        </a>
                                        <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: 11 }}>
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
                                        <Typography variant="body2" sx={{ fontSize: 13, fontWeight: 500, color: '#374151' }}>
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
                                            color: '#9CA3AF', flexShrink: 0,
                                            '&:hover': { color: '#EF4444', bgcolor: '#FEF2F2' },
                                        }}>
                                            <Trash2 size={15} />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            ))}
                        </Box>
                    )}
                </div>
            </DaDialog>

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
                        bgcolor: activeFilter === null ? '#F4F4F4' : 'transparent',
                        '&:hover': { bgcolor: '#F4F4F4' },
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
