import React, { useMemo } from 'react';
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

// Item Component
const HistoryItem = ({ item }) => {
    // Type: 'log' (Field Change), 'status' (Status Change), 'msg' (Comment)
    const isLog = item.type === 'log' || item.type === 'status';
    const author = item.author || item.user || "Système";

    if (isLog) {
        return (
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#F3F4F6' }}>
                    <NotificationsIcon sx={{ fontSize: 16, color: '#6B7280' }} />
                </Avatar>
                <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                            {author}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                            {formatRelativeTime(item.createdAt || item.date)}
                        </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5 }}>
                        {/* Context Badge if from a line */}
                        {item.context && (
                            <Chip label={item.context} size="small" sx={{ mb: 1, height: 20, fontSize: 10, fontWeight: 700, borderRadius: 1 }} />
                        )}
                        <Typography variant="caption" sx={{ display: 'block', textTransform: 'uppercase', color: '#6B7280', fontSize: 10, fontWeight: 700, mb: 0.5 }}>
                            {item.type === 'status' ? "Changement de Statut" : (item.field || "Modification")}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}>
                            <Typography sx={{ textDecoration: 'line-through', color: '#EF4444', bgcolor: '#FEF2F2', px: 0.5, borderRadius: 0.5 }}>
                                {String(item.from ?? 'vide')}
                            </Typography>
                            <ArrowForwardIcon sx={{ fontSize: 12, color: '#9CA3AF' }} />
                            <Typography sx={{ color: '#10B981', fontWeight: 500, bgcolor: '#ECFDF5', px: 0.5, borderRadius: 0.5 }}>
                                {String(item.to ?? 'vide')}
                            </Typography>
                        </Box>
                    </Box>
                </Box>
            </Box>
        );
    }

    // Message / Comment
    return (
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: stringToColor(author) }}>
                {author?.[0]?.toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1F2937' }}>
                        {author}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9CA3AF' }}>
                        {formatRelativeTime(item.createdAt || item.date)}
                    </Typography>
                </Box>
                <Box sx={{ bgcolor: 'white', border: '1px solid #E5E7EB', borderRadius: 2, p: 1.5, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    {item.context && (
                        <div style={{ marginBottom: 4, fontSize: 11, color: '#6B7280', fontStyle: 'italic' }}>
                            Sur : {item.context}
                        </div>
                    )}
                    <Typography variant="body2" sx={{ color: '#374151', whiteSpace: 'pre-wrap' }}>
                        {item.text || item.content}
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
};

export default function MinuteHistoryDialog({ open, onClose, minute }) {
    const sortedActivities = useMemo(() => {
        if (!minute) return [];

        const all = [];

        // 1. Minute Level Logs (Status changes, stored in settings.history or root logs)
        const globalLogs = minute?.settings?.history || minute?.logs || [];
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

        // Sort by Date Descending
        return all.sort((a, b) => {
            const dA = new Date(a.createdAt || a.date || 0).getTime();
            const dB = new Date(b.createdAt || b.date || 0).getTime();
            return dB - dA;
        });
    }, [minute]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
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
                    sortedActivities.map((item, i) => (
                        <HistoryItem key={item.id || i} item={item} />
                    ))
                )}
            </DialogContent>
        </Dialog>
    );
}
