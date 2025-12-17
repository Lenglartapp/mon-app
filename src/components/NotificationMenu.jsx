import React, { useState } from 'react';
import {
    Popover, List, ListItem, ListItemAvatar, ListItemText,
    Avatar, Typography, Box, Badge, Button, Tabs, Tab, Divider
} from '@mui/material';
import { Circle } from 'lucide-react';

const MOCK_NOTIFICATIONS = [
    {
        id: 1,
        user: "Thomas BONNET",
        avatar: "",
        action: "vous a assigné sur le projet",
        target: "Chantier Dupont",
        time: "Il y a 10 min",
        unread: true
    },
    {
        id: 2,
        user: "Pauline DURAND",
        avatar: "",
        action: "a ajouté un commentaire sur",
        target: "Rideaux Salon",
        time: "Il y a 2h",
        unread: true
    },
    {
        id: 3,
        user: "Système",
        avatar: "SYS",
        action: "Le BPF du projet Villa Sud est validé",
        target: "",
        time: "Hier",
        unread: false
    },
    {
        id: 4,
        user: "Atelier",
        avatar: "PROD",
        action: "a terminé la fabrication de",
        target: "Store Banne",
        time: "Il y a 2 jours",
        unread: false
    }
];

function stringToColor(string) {
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

export default function NotificationMenu({ anchorEl, open, onClose }) {
    const [tab, setTab] = useState(0);

    const filtered = tab === 0
        ? MOCK_NOTIFICATIONS.filter(n => n.unread)
        : MOCK_NOTIFICATIONS;

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{
                sx: { width: 360, borderRadius: 3, mt: 1, boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }
            }}
        >
            <Box sx={{ p: 2, pb: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h6" fontWeight={800} fontSize={16}>Notifications</Typography>
                    <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 600 }}>
                        Tout marquer comme lu
                    </Typography>
                </Box>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ minHeight: 36 }}>
                    <Tab label={`Non lues (${MOCK_NOTIFICATIONS.filter(n => n.unread).length})`} sx={{ fontSize: 13, minHeight: 40, p: 0, mr: 2 }} />
                    <Tab label="Toutes" sx={{ fontSize: 13, minHeight: 40, p: 0 }} />
                </Tabs>
            </Box>
            <Divider />
            <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                {filtered.map((n) => (
                    <ListItem
                        key={n.id}
                        button
                        sx={{
                            bgcolor: n.unread ? 'rgba(3, 169, 244, 0.04)' : 'transparent',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
                            borderBottom: '1px solid #f3f4f6'
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: stringToColor(n.user) }}>
                                {n.avatar !== "SYS" && n.avatar !== "PROD"
                                    ? n.user.substring(0, 1)
                                    : n.avatar
                                }
                            </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                            primary={
                                <Typography variant="body2" sx={{ lineHeight: 1.3 }}>
                                    <span style={{ fontWeight: 700 }}>{n.user}</span> {n.action} <span style={{ fontWeight: 600 }}>{n.target}</span>
                                </Typography>
                            }
                            secondary={n.time}
                            secondaryTypographyProps={{ fontSize: 11, mt: 0.5 }}
                        />
                        {n.unread && <Circle size={8} fill="#3b82f6" color="#3b82f6" />}
                    </ListItem>
                ))}
                {filtered.length === 0 && (
                    <Box sx={{ p: 4, textAlign: 'center', color: '#9ca3af' }}>
                        <Typography variant="body2">Aucune notification.</Typography>
                    </Box>
                )}
            </List>
        </Popover>
    );
}
