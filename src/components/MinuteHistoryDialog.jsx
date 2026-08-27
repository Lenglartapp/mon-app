import React, { useMemo, useState, useEffect } from 'react';
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
    VALIDATED: "Validée"
};

const formatValue = (val, type) => {
    if (type === 'status' && STATUS_LABELS[val]) return STATUS_LABELS[val];
    return String(val ?? 'vide');
};

// PERF — objets `sx` figés hors du composant : recréés à chaque rendu, ils
// forcent Emotion à re-sérialiser les styles pour CHAQUE entrée de l'historique
// (c'est une part notable de la latence d'ouverture quand la liste est longue).
const SX_ROW = { display: 'flex', gap: 2, mb: 3 };
const SX_AVATAR_LOG = { width: 32, height: 32, bgcolor: '#F3F4F6' };
const SX_ICON = { fontSize: 16, color: '#6B7280' };
const SX_HEAD = { display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 };
const SX_AUTHOR = { fontWeight: 600, color: '#1F2937' };
const SX_TIME = { color: '#9CA3AF' };
const SX_CARD_LOG = { bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5 };
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

export default function MinuteHistoryDialog({ open, onClose, minute }) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Repart du haut à chaque ouverture (sinon on rouvre sur 400 entrées rendues).
    useEffect(() => { if (open) setVisibleCount(PAGE_SIZE); }, [open]);

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
                if (Array.isArray(row.comments)) {
                    row.comments.forEach(c => {
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
    }, [open, minute]);

    const visibleActivities = useMemo(
        () => sortedActivities.slice(0, visibleCount),
        [sortedActivities, visibleCount]
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth transitionDuration={120} PaperProps={{ sx: { height: '80vh' } }}>
            <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>Historique Complet</Typography>
                <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ bgcolor: '#F9FAFB', p: 3 }}>
                {sortedActivities.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#9CA3AF' }}>
                        Aucune activité enregistrée pour cette minute.
                    </Box>
                ) : (
                    <>
                        {visibleActivities.map((item, i) => (
                            <HistoryItem key={item.id || i} item={item} />
                        ))}
                        {visibleCount < sortedActivities.length && (
                            <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1 }}>
                                <Button
                                    size="small"
                                    onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                                    sx={{ textTransform: 'none', color: '#374151' }}
                                >
                                    Afficher plus ({sortedActivities.length - visibleCount} restantes)
                                </Button>
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
