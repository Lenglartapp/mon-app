import React, { useState } from 'react';
import {
    Popover, List, ListItem, ListItemAvatar, ListItemText,
    Avatar, Typography, Box, Badge, Button, Tabs, Tab, Divider
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { Circle } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

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
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const [tab, setTab] = useState(0);
    const navigate = useNavigate();

    const filtered = tab === 0
        ? notifications.filter(n => !n.read) // Show unread first logic is handled by tab filter
        : notifications; // All

    // Specific filter for "Unread" tab
    const displayList = tab === 0 ? notifications.filter(n => !n.read) : notifications;


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
                    <Typography
                        variant="caption"
                        color="primary"
                        sx={{ cursor: 'pointer', fontWeight: 600 }}
                        onClick={markAllAsRead}
                    >
                        Tout marquer comme lu
                    </Typography>
                </Box>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ minHeight: 36 }}>
                    <Tab label={`Non lues (${notifications.filter(n => !n.read).length})`} sx={{ fontSize: 13, minHeight: 40, p: 0, mr: 2 }} />
                    <Tab label="Toutes" sx={{ fontSize: 13, minHeight: 40, p: 0 }} />
                </Tabs>
            </Box>
            <Divider />
            <List sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
                {displayList.map((n) => (
                    <ListItem
                        key={n.id}
                        button
                        onClick={() => {
                            if (!n.read) markAsRead(n.id);
                            if (n.targetLink) {
                                navigate(n.targetLink);
                                onClose(); // Close menu
                            }
                        }}
                        sx={{
                            bgcolor: !n.read ? 'rgba(3, 169, 244, 0.04)' : 'transparent',
                            '&:hover': { bgcolor: 'rgba(0,0,0,0.02)' },
                            borderBottom: '1px solid #f3f4f6'
                        }}
                    >
                        <ListItemAvatar>
                            <Avatar sx={{ width: 36, height: 36, fontSize: 14, bgcolor: stringToColor(n.user) }}>
                                {n.avatar !== "SYS" && n.avatar !== "PROD" && n.user
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
                        {!n.read && <Circle size={8} fill="#3b82f6" color="#3b82f6" />}
                    </ListItem>
                ))}
                {displayList.length === 0 && (
                    <Box sx={{ p: 4, textAlign: 'center', color: '#9ca3af' }}>
                        <Typography variant="body2">Aucune notification.</Typography>
                    </Box>
                )}
            </List>
        </Popover>
    );
}
