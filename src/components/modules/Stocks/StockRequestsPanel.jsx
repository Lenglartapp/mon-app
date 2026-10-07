import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import Stack from '@mui/material/Stack';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Autocomplete from '@mui/material/Autocomplete';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { Plus, Truck } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';
import { fetchRequests, createRequest, confirmLine, cancelLine, requestLabel, LOC_ATELIER } from '../../../lib/inventory/stockRequests';
import { splitLocations } from '../../../lib/inventory/stockFields';
import OperatorInput from './OperatorInput';
import LocationChips from './LocationChips';
import { ToolbarSearch, ToolbarButton, ToolbarMenu, TonePill } from '../../ui/ToolbarControls';

// « Mise à disposition » : l'atelier demande des pièces du stock, la logistique les
// dépose à l'atelier et confirme ligne par ligne (les pièces passent en ATELIER).
// Utilisé dans Inventaire (tous les dossiers) et dans le dossier (`project` = son nom).

const itemTitle = (it) => {
    const name = it.ref ? [it.ref, it.coloris].filter(Boolean).join(' — ') : it.product;
    return [it.fournisseur, name].filter(Boolean).join(' · ');
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const todayISO = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(Number(n) * 100) / 100;

const STATUS = {
    open: { label: 'À faire', bg: '#FEF3C7', color: '#92400E' },
    in_progress: { label: 'En cours', bg: '#DBEAFE', color: '#1E40AF' },
    done: { label: 'Mise à disposition', bg: '#D1FAE5', color: '#065F46' },
    cancelled: { label: 'Annulée', bg: '#F3F4F6', color: '#6B7280' },
};
// Délai après lequel une demande faite passe dans les archives.
const ARCHIVE_AFTER_DAYS = 14;
// Date de réalisation d'une demande : dernière ligne mise à disposition (à défaut, dernière mise à jour).
const doneAtOf = (r) => r.lines.map(l => l.done_at).filter(Boolean).sort().pop() || r.updated_at || r.created_at;
// Catégorie d'affichage : à faire, en cours (ouverte mais déjà partiellement servie), faite
// récemment, annulée, ou archivée (faite il y a plus de 2 semaines).
const bucketOf = (r) => {
    if (r.status === 'open') return r.lines.some(l => l.status === 'done') ? 'in_progress' : 'todo';
    if (r.status === 'cancelled') return 'cancelled';
    const ageDays = (Date.now() - new Date(doneAtOf(r)).getTime()) / 86400000;
    return ageDays > ARCHIVE_AFTER_DAYS ? 'archived' : 'done';
};
// Statut affiché sur la carte : une demande ouverte dont une partie est déjà servie est « en cours ».
const displayStatusOf = (r) => (r.status === 'open' && r.lines.some(l => l.status === 'done') ? 'in_progress' : r.status);
const FILTERS = [
    { key: 'todo', label: 'À faire', showCount: true },
    { key: 'in_progress', label: 'En cours', showCount: true },
    { key: 'done', label: 'Faites' },
    { key: 'cancelled', label: 'Annulées' },
    { key: 'archived', label: 'Archivées' },
];

export default function StockRequestsPanel({ inventory = [], project = null, onStockChanged }) {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState(['todo']); // plusieurs listes cochables ; « À faire » par défaut
    const [search, setSearch] = useState('');
    const [newOpen, setNewOpen] = useState(false);
    const [confirming, setConfirming] = useState(null); // { request, line }

    const load = useCallback(async () => {
        try {
            setRequests(await fetchRequests(supabase, { project }));
            setError(null);
        } catch (e) {
            setError(e.message || String(e));
        } finally {
            setLoading(false);
        }
    }, [project]);

    useEffect(() => { load(); }, [load]);

    const afterStockChange = async () => {
        await load();
        onStockChanged?.();
    };

    // Pièces déjà demandées (lignes en attente) : on ne les redemande pas.
    const reserved = useMemo(() => {
        const map = new Map();
        requests.forEach(r => r.lines.forEach(l => {
            if (l.status !== 'pending') return;
            (l.pieces || []).forEach(p => map.set(`${l.item_id}:${p.id}`, requestLabel(r)));
        }));
        return map;
    }, [requests]);

    const counts = useMemo(() => requests.reduce((acc, r) => { const b = bucketOf(r); acc[b] = (acc[b] || 0) + 1; return acc; }, {}), [requests]);

    const visible = useMemo(() => {
        const q = search.trim().toLowerCase();
        return requests
            .filter(r => filter.includes(bucketOf(r)))
            .filter(r => !q || [requestLabel(r), r.project, r.requested_by, r.comment, ...r.lines.flatMap(l => [l.product, l.ref, l.coloris, l.fournisseur, l.project])]
                .some(v => (v || '').toLowerCase().includes(q)))
            // À faire : la date souhaitée la plus proche d'abord
            .sort((a, b) => (filter.every(f => f === 'todo' || f === 'in_progress')
                ? String(a.requested_for || '9999').localeCompare(String(b.requested_for || '9999'))
                : String(b.created_at).localeCompare(String(a.created_at))));
    }, [requests, filter, search]);

    const handleCancel = async (line) => {
        if (!window.confirm('Annuler cette ligne de la demande ?')) return;
        try {
            await cancelLine(supabase, line);
            await load();
        } catch (e) {
            alert(`Erreur : ${e.message}`);
        }
    };

    return (
        <Box>
            {/* Barre d'outils sans cadre : choix de la liste (menu), recherche, nouvelle demande à droite */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                <ToolbarMenu
                    multiple
                    value={filter}
                    onChange={setFilter}
                    options={FILTERS.map(f => ({ value: f.key, label: f.label, count: f.showCount ? (counts[f.key] || 0) : undefined }))}
                />
                <ToolbarSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="MAD-, dossier, tissu, demandeur…"
                    width={320}
                />
                <div style={{ marginLeft: 'auto' }}>
                    <ToolbarButton primary icon={<Plus size={16} />} onClick={() => setNewOpen(true)}>Nouvelle demande</ToolbarButton>
                </div>
            </div>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    Impossible de charger les demandes : {error}
                    {/relation|does not exist|schema cache/i.test(error) && ' — la migration « stock_requests » doit être lancée dans Supabase.'}
                </Alert>
            )}
            {loading && <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress size={28} /></Box>}
            {!loading && !error && visible.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8, color: '#9CA3AF' }}>
                    <Truck size={32} />
                    <Typography sx={{ mt: 1 }}>{filter.every(f => f === 'todo' || f === 'in_progress') ? 'Aucune demande en attente.' : 'Aucune demande.'}</Typography>
                </Box>
            )}

            <Stack spacing={2}>
                {visible.map(r => (
                    <RequestCard
                        key={r.id}
                        request={r}
                        showProject={!project}
                        onConfirm={(line) => setConfirming({ request: r, line })}
                        onCancel={handleCancel}
                    />
                ))}
            </Stack>

            {newOpen && (
                <NewRequestDialog
                    inventory={inventory}
                    project={project}
                    reserved={reserved}
                    onClose={() => setNewOpen(false)}
                    onCreated={async () => { setNewOpen(false); setFilter(['todo']); await load(); }}
                />
            )}
            {confirming && (
                <ConfirmDialog
                    {...confirming}
                    onClose={() => setConfirming(null)}
                    onDone={async () => { setConfirming(null); await afterStockChange(); }}
                />
            )}
        </Box>
    );
}

// Pastille de statut de demande dans le nuancier bleu (annulée : gris neutre).
// À faire clair, en cours un cran plus soutenu, faite très claire : le bleu nuit reste aux actions
// principales (onglet actif, Nouvelle demande), le bleu moyen à « Confirmer la mise à dispo ».
const STATUS_TONE = { open: 4, in_progress: 3, done: 5 };
const ROBOTO = 'Roboto, system-ui, sans-serif';

function RequestCard({ request: r, showProject, onConfirm, onCancel }) {
    const late = r.status === 'open' && r.requested_for && r.requested_for < todayISO();
    const statusKey = displayStatusOf(r);
    const st = STATUS[statusKey] || STATUS.open;
    const pendingCount = r.lines.filter(l => l.status === 'pending').length;
    return (
        <Box sx={{ p: 2.5, borderRadius: '8px', border: '1px solid #E0DED9', bgcolor: 'white' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography sx={{ fontFamily: ROBOTO, fontSize: 16, fontWeight: 600, color: '#1E2447' }}>{requestLabel(r)}</Typography>
                <Typography sx={{ fontFamily: ROBOTO, fontSize: 16, fontWeight: 400, color: late ? '#DC2626' : '#111827' }}>
                    {r.requested_for ? `Pour le ${fmtDate(r.requested_for)}` : 'Sans date'}{late ? ' — en retard' : ''}
                </Typography>
                {showProject && r.project && <Typography sx={{ fontSize: 13, color: '#6B7280' }}>· {r.project}</Typography>}
                <Box sx={{ flexGrow: 1 }} />
                {r.status === 'open' && r.lines.length > 1 && (
                    <Typography sx={{ fontSize: 12, color: '#6B7280' }}>{r.lines.length - pendingCount}/{r.lines.length} livrée(s)</Typography>
                )}
                {STATUS_TONE[statusKey] != null
                    ? <TonePill tone={STATUS_TONE[statusKey]}>{st.label}</TonePill>
                    : <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 99, background: '#F4F4F4', color: '#374151', fontSize: 12, fontWeight: 600 }}>{st.label}</span>}
            </Box>
            <Typography sx={{ fontSize: 13, color: '#6B7280', mb: r.comment ? 0.5 : 1.5 }}>
                Demandé par <b style={{ color: '#374151', fontWeight: 600 }}>{r.requested_by}</b> le {fmtDateTime(r.created_at)}
            </Typography>
            {r.comment && <Typography sx={{ fontSize: 13, mb: 1.5, color: '#374151' }}>« {r.comment} »</Typography>}

            <Stack spacing={1}>
                {r.lines.map(l => (
                    <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1.5, py: 1.25, borderRadius: '8px', bgcolor: l.status === 'pending' ? '#F7F7F5' : 'white', border: '1px solid #E8E6E2', flexWrap: 'wrap', opacity: l.status === 'cancelled' ? 0.55 : 1 }}>
                        <Box sx={{ flex: '1 1 260px', minWidth: 0 }}>
                            <Typography sx={{ fontFamily: ROBOTO, fontWeight: 500, fontSize: 14, color: '#111827' }}>{itemTitle(l)}</Typography>
                            <Typography sx={{ fontSize: 12, color: '#6B7280' }}>
                                {showProject && l.project && !r.project ? `${l.project} · ` : ''}{l.laize ? `Laize ${l.laize} · ` : ''}depuis {splitLocations(l.from_location).join(', ') || '—'}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
                            {(l.pieces || []).length > 0
                                ? l.pieces.map(p => <TonePill key={p.id} tone={5}>{`${p.name || 'Pièce'} · ${p.qty} ${l.unit || 'ml'}`}</TonePill>)
                                : <TonePill tone={5}>{`${l.qty} ${l.unit || 'ml'}`}</TonePill>}
                        </Box>
                        <Box sx={{ minWidth: 200, textAlign: 'right' }}>
                            {l.status === 'pending' && (
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                    <Button size="small" onClick={() => onCancel(l)} sx={{ color: '#374151', textTransform: 'none', fontWeight: 600, border: '1px solid #E5E7EB', borderRadius: '8px', px: 1.5, bgcolor: 'white' }}>Annuler</Button>
                                    <Button size="small" variant="contained" disableElevation onClick={() => onConfirm(l)} sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', px: 1.5, bgcolor: '#5B7FC4', '&:hover': { bgcolor: '#4A6DB0' } }}>
                                        Confirmer la mise à dispo
                                    </Button>
                                </Stack>
                            )}
                            {l.status === 'done' && (
                                <Typography sx={{ fontSize: 13, color: '#374151' }}><span style={{ color: '#1E2447', fontWeight: 700 }}>✓</span> En atelier — {l.done_by}, {fmtDateTime(l.done_at)}</Typography>
                            )}
                            {l.status === 'cancelled' && <Typography sx={{ fontSize: 13, color: '#6B7280' }}>Annulée</Typography>}
                        </Box>
                    </Box>
                ))}
            </Stack>
        </Box>
    );
}

function NewRequestDialog({ inventory, project, reserved, onClose, onCreated }) {
    const [requestedBy, setRequestedBy] = useState('');
    const [requestedFor, setRequestedFor] = useState(todayISO());
    const [comment, setComment] = useState('');
    const [lines, setLines] = useState([]); // [{ item, pieceIds:Set, qty }]
    const [saving, setSaving] = useState(false);

    // Seulement ce qui est réellement en stock, hors atelier ; limité au dossier si on est dans un dossier.
    const eligible = useMemo(() => inventory
        .filter(it => Number(it.qty) > 0)
        .filter(it => !splitLocations(it.location).includes(LOC_ATELIER))
        .filter(it => !project || it.project === project)
        .filter(it => !lines.some(l => l.item.id === it.id))
        .sort((a, b) => itemTitle(a).localeCompare(itemTitle(b))), [inventory, project, lines]);

    const addItem = (it) => {
        if (!it) return;
        setLines(prev => [...prev, { item: it, pieceIds: new Set(), qty: '' }]);
    };
    const removeLine = (id) => setLines(prev => prev.filter(l => l.item.id !== id));
    const togglePiece = (itemId, pieceId) => setLines(prev => prev.map(l => {
        if (l.item.id !== itemId) return l;
        const s = new Set(l.pieceIds);
        if (s.has(pieceId)) s.delete(pieceId); else s.add(pieceId);
        return { ...l, pieceIds: s };
    }));
    const setQty = (itemId, v) => setLines(prev => prev.map(l => (l.item.id === itemId ? { ...l, qty: v } : l)));

    const hasPieces = (it) => Array.isArray(it.pieces) && it.pieces.length > 0;
    const lineQty = (l) => (hasPieces(l.item)
        ? round2(l.item.pieces.filter(p => l.pieceIds.has(p.id)).reduce((s, p) => s + Number(p.qty || 0), 0))
        : Number(l.qty) || 0);
    const lineValid = (l) => lineQty(l) > 0 && (hasPieces(l.item) || lineQty(l) <= Number(l.item.qty));
    const canSave = requestedBy.trim() && requestedFor && lines.length > 0 && lines.every(lineValid);

    const save = async () => {
        setSaving(true);
        try {
            await createRequest(supabase, { project, requested_by: requestedBy.trim(), requested_for: requestedFor, comment: comment.trim() }, lines.map(l => ({
                item: l.item,
                pieces: hasPieces(l.item) ? l.item.pieces.filter(p => l.pieceIds.has(p.id)) : [],
                qty: lineQty(l),
            })));
            await onCreated();
        } catch (e) {
            alert(`Erreur : ${e.message}`);
            setSaving(false);
        }
    };

    return (
        <Dialog open onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                Nouvelle demande de mise à disposition{project ? ` — ${project}` : ''}
                <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Stack direction="row" spacing={2}>
                        <OperatorInput value={requestedBy} onChange={setRequestedBy} label="Demandé par" sx={{ flex: 1 }} />
                        <TextField
                            type="date" size="small" label="À mettre à dispo pour le" required
                            value={requestedFor} onChange={(e) => setRequestedFor(e.target.value)}
                            InputLabelProps={{ shrink: true }} sx={{ width: 220 }} error={!requestedFor}
                        />
                    </Stack>

                    <Autocomplete
                        options={eligible}
                        value={null}
                        onChange={(e, it) => addItem(it)}
                        getOptionLabel={(it) => itemTitle(it)}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        blurOnSelect
                        renderOption={(props, it) => (
                            <li {...props} key={it.id}>
                                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 600 }}>{itemTitle(it)}</span>
                                    <span style={{ fontSize: 12, color: '#6B7280' }}>
                                        {it.qty} {it.unit} · {hasPieces(it) ? `${it.pieces.length} pièce(s) · ` : ''}{it.project || 'Stock libre'} · {splitLocations(it.location).join(', ') || 'sans emplacement'}
                                    </span>
                                </Box>
                            </li>
                        )}
                        renderInput={(params) => <TextField {...params} size="small" label={`+ Ajouter un tissu en stock${project ? ' (affecté au dossier)' : ''}`} />}
                        noOptionsText={project ? 'Aucun article de ce dossier disponible en stock.' : 'Aucun article disponible en stock.'}
                    />

                    {lines.length === 0 && (
                        <Typography variant="body2" sx={{ color: '#9CA3AF', textAlign: 'center', py: 2 }}>
                            Ajoute les tissus voulus, puis coche les pièces qu’il te faut.
                        </Typography>
                    )}

                    {lines.map(l => {
                        const it = l.item;
                        return (
                            <Box key={it.id} sx={{ p: 1.5, border: '1px solid #E5E7EB', borderRadius: 2 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 700 }}>{itemTitle(it)}</Typography>
                                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                                            <Typography variant="caption" sx={{ color: '#6B7280' }}>{it.project || 'Stock libre'}{it.laize ? ` · Laize ${it.laize}` : ''} · stock {it.qty} {it.unit}</Typography>
                                            <LocationChips value={it.location} />
                                        </Stack>
                                    </Box>
                                    <IconButton size="small" onClick={() => removeLine(it.id)}><CloseIcon fontSize="small" /></IconButton>
                                </Box>
                                {hasPieces(it) ? (
                                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                                        {it.pieces.map((p, idx) => {
                                            const takenBy = reserved.get(`${it.id}:${p.id}`);
                                            const on = l.pieceIds.has(p.id);
                                            return (
                                                <Chip
                                                    key={p.id ?? idx}
                                                    label={`${p.name || `Pièce ${idx + 1}`} · ${p.qty} ${it.unit || 'ml'}${takenBy ? ` (déjà demandée ${takenBy})` : ''}`}
                                                    onClick={takenBy ? undefined : () => togglePiece(it.id, p.id)}
                                                    disabled={!!takenBy}
                                                    variant={on ? 'filled' : 'outlined'}
                                                    sx={{ fontWeight: 600, ...(on ? { bgcolor: '#1E2447', color: 'white', '&:hover': { bgcolor: '#2D3561' } } : {}) }}
                                                />
                                            );
                                        })}
                                    </Box>
                                ) : (
                                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                                        <TextField
                                            type="number" size="small" label="Métrage voulu" value={l.qty}
                                            onChange={(e) => setQty(it.id, e.target.value)}
                                            error={Number(l.qty) > Number(it.qty)}
                                            helperText={Number(l.qty) > Number(it.qty) ? `Max ${it.qty} ${it.unit || ''}` : 'Article sans détail des pièces'}
                                            sx={{ width: 200 }}
                                            InputProps={{ endAdornment: <InputAdornment position="end">{it.unit || 'ml'}</InputAdornment> }}
                                        />
                                    </Stack>
                                )}
                                {hasPieces(it) && lineQty(l) > 0 && (
                                    <Typography variant="body2" sx={{ mt: 1, color: '#374151' }}>Demandé : <b>{lineQty(l)} {it.unit || 'ml'}</b></Typography>
                                )}
                            </Box>
                        );
                    })}

                    <TextField label="Commentaire (optionnel)" size="small" multiline minRows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Annuler</Button>
                <Button variant="contained" onClick={save} disabled={!canSave || saving} sx={{ fontWeight: 700 }}>
                    Envoyer la demande
                </Button>
            </DialogActions>
        </Dialog>
    );
}

function ConfirmDialog({ request, line, onClose, onDone }) {
    const [operator, setOperator] = useState('');
    const [saving, setSaving] = useState(false);
    const confirm = async () => {
        setSaving(true);
        try {
            await confirmLine(supabase, request, line, operator.trim());
            await onDone();
        } catch (e) {
            alert(`Erreur : ${e.message}`);
            setSaving(false);
        }
    };
    return (
        <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Confirmer la mise à disposition</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Box>
                        <Typography sx={{ fontWeight: 700 }}>{itemTitle(line)}</Typography>
                        <Typography variant="body2" sx={{ color: '#6B7280' }}>
                            {(line.pieces || []).length ? line.pieces.map(p => `${p.name} (${p.qty} ${line.unit || 'ml'})`).join(', ') : `${line.qty} ${line.unit || 'ml'}`}
                        </Typography>
                    </Box>
                    <Alert severity="info" icon={false} sx={{ py: 0.5 }}>
                        Emplacement : <b>{splitLocations(line.from_location).join(', ') || '—'}</b> → <b>{LOC_ATELIER}</b>
                    </Alert>
                    <OperatorInput value={operator} onChange={setOperator} label="Déposé par" />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Annuler</Button>
                <Button variant="contained" onClick={confirm} disabled={!operator.trim() || saving} sx={{ fontWeight: 700, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}>
                    Confirmer
                </Button>
            </DialogActions>
        </Dialog>
    );
}
