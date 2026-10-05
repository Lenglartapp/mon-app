import React, { useMemo, useState, useEffect } from 'react';
import { mergeRowLogs } from '../lib/lineLogs';
import { useArchivedRowLogs } from '../hooks/useArchivedRowLogs';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Close';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import { readMinuteVersions } from '../lib/minuteVersions';

// Helpers
const stringToColor = (string) => {
    if (!string) return '#ccc';
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    const hex = "00000".substring(0, 6 - c.length) + c;
    return `#${hex}`;
};

const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Status Labels Mapping
const STATUS_LABELS = {
    DRAFT: "À faire",
    IN_PROGRESS: "En cours",
    PENDING_APPROVAL: "À valider",
    REVISE: "À reprendre",
    VALIDATED: "Validée",
    ORDERED: "Commande",
    ORDER_COMPLETED: "Commande terminée",
    LOST: "Perdu"
};

const formatValue = (val, type) => {
    if (type === 'status' && STATUS_LABELS[val]) return STATUS_LABELS[val];
    return String(val ?? 'vide');
};

// Recherche insensible à la casse ET aux accents (« validee » trouve « Validée »).
const norm = (v) => String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Texte indexé d'une entrée : auteur, champ, contexte, valeurs avant/après et
// commentaire. Les statuts sont indexés sur leur LIBELLÉ (« Validée »), pas sur
// leur code interne (« VALIDATED »), pour que la recherche parle la langue de l'écran.
const haystack = (item) => norm([
    item.author, item.user,
    item.type === 'status' ? 'Changement de Statut' : item.field,
    item.context,
    formatValue(item.from, item.type),
    formatValue(item.to, item.type),
    item.text, item.content,
].filter(Boolean).join(' '));

// PERF — objets `sx` figés hors du composant : recréés à chaque rendu, ils
// forcent Emotion à re-sérialiser les styles pour CHAQUE entrée de l'historique
// (c'est une part notable de la latence d'ouverture quand la liste est longue).
const SX_ROW = { display: 'flex', gap: 2, mb: 3 };
const SX_AVATAR_LOG = { width: 32, height: 32, bgcolor: '#F3F4F6' };
const SX_ICON = { fontSize: 16, color: '#6B7280' };
const SX_HEAD = { display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 };
const SX_AUTHOR = { fontWeight: 600, color: '#1F2937' };
const SX_TIME = { color: '#9CA3AF' };
const SX_CARD_LOG = { bgcolor: '#F4F4F4', border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5 };
const SX_CARD_MSG = { bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' };
const SX_CHIP = { mb: 1, height: 20, fontSize: 10, fontWeight: 700, borderRadius: 1 };
const SX_FIELD = { display: 'block', textTransform: 'uppercase', color: '#6B7280', fontSize: 10, fontWeight: 700, mb: 0.5 };
const SX_DIFF = { display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 };
const SX_FROM = { textDecoration: 'line-through', color: '#EF4444', bgcolor: '#FEF2F2', px: 0.5, borderRadius: 0.5 };
const SX_ARROW = { fontSize: 12, color: '#9CA3AF' };
const SX_TO = { color: '#10B981', fontWeight: 500, bgcolor: '#ECFDF5', px: 0.5, borderRadius: 0.5 };
const SX_TEXT = { color: '#374151', whiteSpace: 'pre-wrap' };

// Nombre d'entrées rendues à l'ouverture, puis par clic sur « Afficher plus ».
// Rendre la liste entière d'un coup est ce qui retardait l'apparition de la pop-up.
const PAGE_SIZE = 40;

// Item Component
const HistoryItem = React.memo(({ item }) => {
    // Type: 'log' (Field Change), 'status' (Status Change), 'msg' (Comment)
    const isLog = item.type === 'log' || item.type === 'status';
    const author = item.author || item.user || "Système";

    if (isLog) {
        return (
            <Box sx={SX_ROW}>
                <Avatar sx={SX_AVATAR_LOG}>
                    <NotificationsIcon sx={SX_ICON} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                    <Box sx={SX_HEAD}>
                        <Typography variant="body2" sx={SX_AUTHOR}>
                            {author}
                        </Typography>
                        <Typography variant="caption" sx={SX_TIME}>
                            {formatRelativeTime(item.createdAt || item.date)}
                        </Typography>
                    </Box>
                    <Box sx={SX_CARD_LOG}>
                        {/* Context Badge if from a line */}
                        {item.context && (
                            <Chip label={item.context} size="small" sx={SX_CHIP} />
                        )}
                        <Typography variant="caption" sx={SX_FIELD}>
                            {item.type === 'status' ? "Changement de Statut" : (item.field || "Modification")}
                        </Typography>
                        <Box sx={SX_DIFF}>
                            <Typography sx={SX_FROM}>
                                {formatValue(item.from, item.type)}
                            </Typography>
                            <ArrowForwardIcon sx={SX_ARROW} />
                            <Typography sx={SX_TO}>
                                {formatValue(item.to, item.type)}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }

    // Message / Comment
    return (
        <Box sx={SX_ROW}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: stringToColor(author) }}>
                {author?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
                <Box sx={SX_HEAD}>
                    <Typography variant="body2" sx={SX_AUTHOR}>
                        {author}
                    </Typography>
                    <Typography variant="caption" sx={SX_TIME}>
                        {formatRelativeTime(item.createdAt || item.date)}
                    </Typography>
                </Box>
                <Box sx={SX_CARD_MSG}>
                    {item.context && (
                        <div style={{ marginBottom: 4, fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
                            Sur : {item.context}
                        </div>
                    )}
                    <Typography variant="body2" sx={SX_TEXT}>
                        {item.text || item.content}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
});
HistoryItem.displayName = 'HistoryItem';

// Onglet « Versions » : liste des snapshots restaurables (table minutes_history).
const REASON_LABELS = {
    auto:            { label: 'Auto',                bg: '#F3F4F6', color: '#374151' },
    'shrink-guard':  { label: 'Sécurité (chute)',    bg: '#FEF3C7', color: '#92400E' },
    'pre-restore':   { label: 'Avant restauration',  bg: '#EDE9FE', color: '#5B21B6' },
};
const fmtEur = (n) => (n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0));

function VersionsPanel({ minuteId, canEdit, onRestoreInPlace, onRestoreAsVariant, onDone }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!minuteId) return;
        setLoading(true); setError(null);
        readMinuteVersions(minuteId)
            .then((v) => { if (alive) setVersions(v); })
            .catch((e) => alive && setError(e.message))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [minuteId]);

    const run = async (fn, version) => {
        if (!fn) return;
        setBusy(true);
        try { await fn(version); onDone?.(); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); setSelected(null); }
    };

    return (
        <Box sx={{ p: 3 }}>
            {loading && <Typography sx={{ color: '#9CA3AF', fontSize: 13 }}>Chargement des versions…</Typography>}
            {error && <Typography sx={{ color: '#B91C1C', fontSize: 13, mb: 1 }}>{error}</Typography>}
            {!loading && !error && versions.length === 0 && (
                <Box sx={{ textAlign: 'center', color: '#9CA3AF', py: 6, fontSize: 13 }}>
                    Aucune version enregistrée pour l'instant.<br />Les versions se créent automatiquement au fil des modifications.
                </Box>
            )}
            {versions.map((v) => {
                const r = REASON_LABELS[v.reason] || REASON_LABELS.auto;
                const isSel = selected?.id === v.id;
                return (
                    <Box key={v.id} sx={{ border: '1px solid #E5E7EB', borderRadius: 2, mb: 1, bgcolor: 'white', overflow: 'hidden' }}>
                        <Box onClick={() => canEdit && setSelected(isSel ? null : v)}
                             sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5, cursor: canEdit ? 'pointer' : 'default' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#111827' }}>{formatRelativeTime(v.captured_at)}</Typography>
                                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                    {new Date(v.captured_at).toLocaleString('fr-FR')} · {v.nb_lignes ?? '—'} ligne(s) · {fmtEur(v.ca_total)}
                                </Typography>
                            </Box>
                            <Chip label={r.label} size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700, bgcolor: r.bg, color: r.color }} />
                        </Box>
                        {isSel && canEdit && (
                            <Box sx={{ borderTop: '1px dashed #E5E7EB', p: 1.5, bgcolor: '#F4F4F4', display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Typography variant="caption" sx={{ color: '#6B7280' }}>
                                    « Revenir » remplace le contenu actuel (l'état actuel est sauvegardé au passage → réversible). « Variante » crée un nouveau devis et garde l'actuel intact.
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    <Button size="small" variant="contained" color="error" disabled={busy} onClick={() => run(onRestoreInPlace, v)} sx={{ textTransform: 'none' }}>
                                        Revenir à cette version
                                    </Button>
                                    <Button size="small" variant="outlined" disabled={busy} onClick={() => run(onRestoreAsVariant, v)} sx={{ textTransform: 'none' }}>
                                        Créer une variante
                                    </Button>
                                    <Button size="small" disabled={busy} onClick={() => setSelected(null)} sx={{ textTransform: 'none', color: '#6B7280' }}>Annuler</Button>
                                </Box>
                            </Box>
                        )}
                    </Box>
                );
            })}
            {!canEdit && versions.length > 0 && (
                <Typography variant="caption" sx={{ color: '#9CA3AF' }}>Lecture seule — la restauration nécessite les droits d'édition.</Typography>
            )}
        </Box>
    );
}

export default function MinuteHistoryDialog({ open, onClose, minute, canEdit = false, onRestoreInPlace, onRestoreAsVariant }) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState('journal');

    // Repart du haut à chaque ouverture (sinon on rouvre sur 400 entrées rendues).
    useEffect(() => { if (open) { setVisibleCount(PAGE_SIZE); setQuery(''); setTab('journal'); } }, [open]);

    // Historique « Modif … » archivé hors des lignes (table line_logs), chargé
    // uniquement quand le dialogue est ouvert (cf. lib/lineLogs).
    const allRows = useMemo(
        () => (open && minute ? [...(minute.lines || []), ...(minute.deplacements || []), ...(minute.extraDepenses || [])] : []),
        [open, minute]
    );
    const { byRow: archivedLogs, loading: archivedLoading } = useArchivedRowLogs(minute?.id, allRows, !!open && !!minute);

    const sortedActivities = useMemo(() => {
        // PERF — ce dialogue reste monté en permanence dans ChiffrageScreen : sans
        // ce garde-fou, l'agrégation + le tri seraient refaits à CHAQUE frappe dans
        // le devis (`minute` change en continu), pour un panneau invisible.
        if (!open || !minute) return [];

        const all = [];

        // 1. Minute Level Logs (Status changes, stored in modules.history or settings.history or root logs)
        const globalLogs = minute?.modules?.history || minute?.settings?.history || minute?.logs || [];
        if (Array.isArray(globalLogs)) {
            all.push(...globalLogs);
        }

        // 2. Line Level Logs (Aggregated)
        const processLines = (arr, typeName) => {
            (arr || []).forEach(row => {
                const comments = mergeRowLogs(row.comments, archivedLogs.get(String(row.id)));
                if (comments.length) {
                    comments.forEach(c => {
                        // Enrich with context
                        const context = `${typeName} - ${row.produit || 'Article'} ${row.piece ? `(${row.piece})` : ''} #${String(row.id).slice(-4)}`;
                        all.push({ ...c, context });
                    });
                }
            });
        };

        processLines(minute.lines, "Ligne");
        processLines(minute.deplacements, "Logistique");
        processLines(minute.extraDepenses, "Autre");

        // Sort by Date Descending — timestamp calculé UNE fois par entrée
        // (un `new Date()` par comparaison, c'est O(n log n) parsings inutiles).
        return all
            .map(item => ({ item, ts: new Date(item.createdAt || item.date || 0).getTime() }))
            .sort((a, b) => b.ts - a.ts)
            .map(x => x.item);
    }, [open, minute, archivedLogs]);

    // Index de recherche calculé UNE fois par entrée, pas à chaque frappe.
    const indexed = useMemo(
        () => sortedActivities.map(item => ({ item, hay: haystack(item) })),
        [sortedActivities]
    );

    // Tous les termes doivent être présents (« audrey coef » = les deux).
    const filteredActivities = useMemo(() => {
        const terms = norm(query).split(/\s+/).filter(Boolean);
        if (terms.length === 0) return sortedActivities;
        return indexed.filter(({ hay }) => terms.every(t => hay.includes(t))).map(x => x.item);
    }, [indexed, sortedActivities, query]);

    // Une nouvelle recherche repart de la première page.
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

    const visibleActivities = useMemo(
        () => filteredActivities.slice(0, visibleCount),
        [filteredActivities, visibleCount]
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth transitionDuration={120} PaperProps={{ sx: { height: '80vh' } }}>
            <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Historique Complet</Typography>
                <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ bgcolor: '#F4F4F4', p: 0, display: 'flex', flexDirection: 'column' }}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ px: 2, bgcolor: 'white', borderBottom: '1px solid #E5E7EB', minHeight: 42, flexShrink: 0 }}>
                    <Tab value="journal" label="Journal" sx={{ textTransform: 'none', minHeight: 42, fontWeight: 600 }} />
                    <Tab value="versions" label="Versions" sx={{ textTransform: 'none', minHeight: 42, fontWeight: 600 }} />
                </Tabs>

                {tab === 'versions' ? (
                    <Box sx={{ overflowY: 'auto' }}>
                        <VersionsPanel
                            minuteId={minute?.id}
                            canEdit={canEdit}
                            onRestoreInPlace={onRestoreInPlace}
                            onRestoreAsVariant={onRestoreAsVariant}
                            onDone={onClose}
                        />
                    </Box>
                ) : (
                <Box sx={{ overflowY: 'auto' }}>
                {archivedLoading && (
                    <Typography variant="caption" sx={{ display: 'block', px: 3, pt: 1, color: '#6B7280' }}>
                        Chargement de l'historique des lignes…
                    </Typography>
                )}
                {/* Barre de recherche : collée en haut, elle reste visible pendant le défilement. */}
                <Box sx={{ position: 'sticky', top: 0, zIndex: 1, bgcolor: '#F4F4F4', px: 3, pt: 2, pb: 1.5, borderBottom: '1px solid #E5E7EB' }}>
                    <TextField
                        fullWidth
                        size="small"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher : un auteur, un champ, une valeur, un statut…"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ fontSize: 18, color: '#9CA3AF' }} />
                                </InputAdornment>
                            ),
                            endAdornment: query ? (
                                <InputAdornment position="end">
                                    <IconButton size="small" onClick={() => setQuery('')} aria-label="Effacer la recherche">
                                        <ClearIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                            sx: { bgcolor: 'white', fontSize: 13 },
                        }}
                    />
                    {query && (
                        <Typography variant="caption" sx={{ display: 'block', mt: 0.75, color: '#6B7280' }}>
                            {filteredActivities.length} résultat{filteredActivities.length > 1 ? 's' : ''} sur {sortedActivities.length}
                        </Typography>
                    )}
                </Box>

                <Box sx={{ p: 3 }}>
                {sortedActivities.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9CA3AF' }}>
                        Aucune activité enregistrée pour cette minute.
                    </Box>
                ) : filteredActivities.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, color: '#9CA3AF' }}>
                        Aucune activité ne correspond à « {query} ».
                    </Box>
                ) : (
                    <>
                        {visibleActivities.map((item, i) => (
                            <HistoryItem key={item.id || i} item={item} />
                        ))}
                        {visibleCount < filteredActivities.length && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
                                <Button
                                    size="small"
                                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                    sx={{ textTransform: 'none', color: '#374151' }}
                                >
                                    Afficher plus ({filteredActivities.length - visibleCount} restantes)
                                </Button>
                            </Box>
                        )}
                    </>
                )}
                </Box>
                </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
