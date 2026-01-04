import React, { useState } from 'react';
import {
    Popover, List, ListItem, ListItemAvatar, ListItemText,
    Avatar, Typography, Box, Tabs, Tab, Divider
} from '@mui/material';
import { Circle } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

// --- HELPER : Génération de couleur pour l'avatar ---
function stringToColor(string) {
    if (!string) return '#9CA3AF';
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        const value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

// --- HELPER : Formatage de la date (Sans librairie externe) ---
function formatTimeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " an(s)";
    interval = seconds / 2592000;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " mois";
    interval = seconds / 86400;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " j";
    interval = seconds / 3600;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " h";
    interval = seconds / 60;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " min";
    return "À l'instant";
}

export default function NotificationMenu({ anchorEl, open, onClose, onAction }) {
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const [tab, setTab] = useState(0);

    // Filtrage selon l'onglet (0 = Non lues, 1 = Toutes)
    const displayList = tab === 0
        ? notifications.filter(n => !n.read)
        : notifications;

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
                sx: { width: 380, borderRadius: 3, mt: 1, boxShadow: '0 10px 40px rgba(0,0,0,0.1)' }
            }}
        >
            {/* EN-TÊTE */}
            <Box sx={{ p: 2, pb: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" fontWeight={700} fontSize={16} color="#111827">
                        Notifications
                    </Typography>
                    <Typography
                        variant="caption"
                        color="primary"
                        sx={{ cursor: 'pointer', fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}
                        onClick={markAllAsRead}
                    >
                        Tout marquer comme lu
                    </Typography>
                </Box>
                <Tabs
                    value={tab}
                    onChange={(e, v) => setTab(v)}
                    sx={{ minHeight: 36, borderBottom: '1px solid #E5E7EB' }}
                    TabIndicatorProps={{ sx: { bgcolor: '#1F2937' } }} // Indicateur noir
                >
                    <Tab
                        label={`Non lues (${notifications.filter(n => !n.read).length})`}
                        sx={{ fontSize: 13, minHeight: 40, p: 0, mr: 2, textTransform: 'none', fontWeight: 600, color: tab === 0 ? '#1F2937' : '#6B7280' }}
                    />
                    <Tab
                        label="Historique"
                        sx={{ fontSize: 13, minHeight: 40, p: 0, textTransform: 'none', fontWeight: 600, color: tab === 1 ? '#1F2937' : '#6B7280' }}
                    />
                </Tabs>
            </Box>

            {/* LISTE */}
            <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                {displayList.map((n) => (
                    <ListItem
                        key={n.id}
                        button
                        onClick={() => {
                            if (!n.read) markAsRead(n.id);

                            // Si une action est attachée (ex: ouvrir un dossier), on l'exécute
                            if (n.action && onAction) {
                                onAction(n.action);
                                onClose(); // On ferme le menu
                            }
                        }}
                        sx={{
                            bgcolor: !n.read ? '#F0F9FF' : 'white', // Bleu très pâle si non lu
                            borderBottom: '1px solid #F3F4F6',
                            transition: 'background 0.2s',
                            '&:hover': { bgcolor: '#F9FAFB' },
                            gap: 2,
                            alignItems: 'flex-start',
                            py: 1.5
                        }}
                    >
                        {/* Avatar Expéditeur */}
                        <ListItemAvatar sx={{ mt: 0.5 }}>
                            <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: stringToColor(n.sender_name || "?"), fontWeight: 600 }}>
                                {(n.sender_name?.[0] || "?").toUpperCase()}
                            </Avatar>
                        </ListItemAvatar>

                        {/* Contenu Texte */}
                        <ListItemText
                            primary={
                                <Typography variant="body2" sx={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
                                    {n.sender_name} {n.title === 'Mention' ? 'vous a mentionné' : n.title}
                                </Typography>
                            }
                            secondary={
                                <Box sx={{ mt: 0.5 }}>
                                    <Typography variant="body2" sx={{ color: '#4B5563', fontSize: 13, fontStyle: 'italic' }}>
                                        {n.message}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#9CA3AF', mt: 0.5, display: 'block' }}>
                                        {formatTimeAgo(n.created_at)}
                                    </Typography>
                                </Box>
                            }
                            sx={{ m: 0 }}
                        />
                    </ListItem>
                ))}

                {/* État Vide */}
                {displayList.length === 0 && (
                    <Box sx={{ p: 6, textAlign: 'center', color: '#9CA3AF' }}>
                        <Typography variant="body2" fontWeight={500}>Aucune notification.</Typography>
                    </Box>
                )}
            </List>
        </Popover>
    );
}