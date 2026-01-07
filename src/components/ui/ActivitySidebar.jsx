import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile'; // <--- New Icon
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import Popover from '@mui/material/Popover';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../auth';
import { supabase } from '../../lib/supabaseClient'; // <--- Import Supabase
import ImageLightbox from './ImageLightbox'; // <--- Lightbox

// --- HELPERS ---

function stringToColor(string) {
    if (!string) return '#ccc';
    let hash = 0;
    for (let i = 0; i < string.length; i++) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }
    const c = (hash & 0x00ffffff).toString(16).toUpperCase();
    const hex = "00000".substring(0, 6 - c.length) + c;
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const mix = (val) => Math.round((val + 255) / 2);
    return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function formatRelativeTime(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000; // seconds

    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return date.toLocaleDateString();
}

// --- SUB-COMPONENTS ---

// 1. INPUT FORM (ISOLATED & MEMOIZED)
const CommentInputForm = React.memo(({ onSend, onUploadImage, users = [] }) => {
    // Uncontrolled input for maximum performance
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const [hasText, setHasText] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Mention states
    const [anchorEl, setAnchorEl] = useState(null);
    const [mentionQuery, setMentionQuery] = useState('');

    const handleInputChange = (e) => {
        const val = e.target.value;

        // 1. Button State Optimization: Only re-render if empty/non-empty status changes
        const isNotEmpty = val.trim().length > 0;
        if (isNotEmpty !== hasText) {
            setHasText(isNotEmpty);
        }

        // 2. Mention Logic
        const newPos = e.target.selectionStart;
        const target = e.target;

        const lastAt = val.lastIndexOf('@', newPos - 1);
        if (lastAt !== -1) {
            const query = val.substring(lastAt + 1, newPos);
            if (!query.includes(' ')) {
                setMentionQuery(query);
                if (anchorEl !== target) {
                    setAnchorEl(target);
                }
                return;
            }
        }

        if (anchorEl) {
            setAnchorEl(null);
        }
    };

    const handleSelectUser = (user) => {
        const input = inputRef.current;
        if (!input) return;

        const val = input.value;
        const currentPos = input.selectionStart || val.length;
        const lastAt = val.lastIndexOf('@', currentPos - 1);

        if (lastAt !== -1) {
            const before = val.substring(0, lastAt);
            const after = val.substring(currentPos);
            const newText = `${before}@${user.name.split(' ')[0]} ${after}`;

            // Direct DOM update
            input.value = newText;

            // Close menu
            setAnchorEl(null);

            // Update button state if needed (likely already true)
            if (!hasText) setHasText(true);

            // Restore focus and cursor
            input.focus();
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    const handleSendClick = () => {
        const val = inputRef.current?.value || '';
        if (val.trim()) {
            onSend(val);
            // Clear manually
            if (inputRef.current) {
                inputRef.current.value = '';
            }
            setHasText(false);
            setAnchorEl(null);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setUploading(true);
            await onUploadImage(file);
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const filteredUsers = useMemo(() => {
        if (!anchorEl) return [];
        return users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [users, mentionQuery, anchorEl]);

    return (
        <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #E5E7EB' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: '#F3F4F6', borderRadius: 2, p: '8px 12px' }}>
                <TextField
                    id="comment-input-field"
                    inputRef={inputRef}
                    fullWidth
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    placeholder="Écrire un message... (@ pour mentionner)"
                    onChange={handleInputChange}
                    onKeyDown={handleKeyDown}
                    multiline
                    maxRows={4}
                    sx={{ fontSize: 13 }}
                />
                <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleFileChange}
                />
                <IconButton
                    color="default"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    size="small"
                >
                    {uploading ? (
                        <div style={{
                            width: 14, height: 14,
                            border: '2px solid #ccc', borderTopColor: '#333',
                            borderRadius: '50%', animation: 'spin 1s linear infinite'
                        }} />
                    ) : <AttachFileIcon fontSize="small" />}
                </IconButton>

                <IconButton
                    color="primary"
                    onClick={handleSendClick}
                    disabled={!hasText}
                    size="small"
                >
                    <SendIcon fontSize="small" />
                </IconButton>
            </Box>

            <Popover
                open={Boolean(anchorEl) && filteredUsers.length > 0}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
                transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                disableAutoFocus
                disableEnforceFocus
            >
                <List dense sx={{ minWidth: 200, py: 0 }}>
                    {filteredUsers.map((user) => (
                        <ListItem
                            key={user.id}
                            button
                            onClick={() => handleSelectUser(user)}
                            sx={{ '&:hover': { bgcolor: '#F3F4F6' } }}
                        >
                            <Avatar sx={{ width: 24, height: 24, mr: 1, bgcolor: stringToColor(user.name) }}>{user.name.charAt(0)}</Avatar>
                            <ListItemText primary={user.name} secondary={user.role} primaryTypographyProps={{ fontSize: 13 }} />
                        </ListItem>
                    ))}
                </List>
            </Popover>
        </Box>
    );
});


// 2. LOG & MESSAGE ITEMS

const LogItem = React.memo(({ act }) => {
    const field = act.field || "Champ Inconnu";
    const from = act.from || "vide";
    const to = act.to || "vide";
    const author = act.author || act.user || "Système"; // Robust fallback

    return (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2, px: 1 }}>
            <Avatar sx={{ width: 24, height: 24, bgcolor: '#E5E7EB' }}>
                <NotificationsIcon sx={{ fontSize: 14, color: '#6B7280' }} />
            </Avatar>
            <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
                        Modification par {author}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: 10 }}>
                        {formatRelativeTime(act.createdAt || act.ts)}
                    </Typography>
                </Box>

                <Box sx={{
                    bgcolor: '#F9FAFB',
                    border: '1px solid #E5E7EB',
                    borderRadius: 1,
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5
                }}>
                    <Typography variant="caption" sx={{ textTransform: 'uppercase', color: '#6B7280', fontSize: 10, fontWeight: 700, letterSpacing: 0.5 }}>
                        {field}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13 }}>
                        <Typography sx={{
                            textDecoration: 'line-through',
                            color: '#EF4444',
                            bgcolor: '#FEF2F2',
                            px: 0.5,
                            borderRadius: 0.5
                        }}>
                            {from}
                        </Typography>
                        <ArrowForwardIcon sx={{ fontSize: 12, color: '#9CA3AF' }} />
                        <Typography sx={{
                            color: '#10B981',
                            fontWeight: 500,
                            bgcolor: '#ECFDF5',
                            px: 0.5,
                            borderRadius: 0.5
                        }}>
                            {to}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
});

const processMessageText = (text) => {
    if (!text) return "";
    const parts = text.split(/(@\w+)/g);
    return parts.map((part, i) => {
        if (part.startsWith('@')) {
            return (
                <Chip
                    key={i}
                    label={part}
                    size="small"
                    sx={{
                        height: 20,
                        fontSize: 11,
                        bgcolor: '#DBEAFE',
                        color: '#1E40AF',
                        fontWeight: 600,
                        mx: 0.2,
                        '& .MuiChip-label': { px: 0.5 }
                    }}
                />
            );
        }
        return part;
    });
};

const MessageItem = React.memo(({ act, isMe }) => {
    const authorName = act.author || act.user || "Utilisateur";
    const [lightboxOpen, setLightboxOpen] = useState(false);

    // Image Content?
    const isImage = act.type === 'image';
    const content = isImage ? act.content : act.text; // 'content' holds URL for images, 'text' for messages (legacy) or 'content' mapped to 'text'

    return (
        <>
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, px: 1, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                {/* Always show Avatar */}
                <Avatar sx={{ width: 28, height: 28, bgcolor: stringToColor(authorName), fontSize: 12 }}>
                    {authorName?.charAt(0)}
                </Avatar>

                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 0.5, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                        {/* Always show Name */}
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#374151' }}>
                            {authorName}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9CA3AF', fontSize: 10 }}>
                            {formatRelativeTime(act.createdAt || act.ts)}
                        </Typography>
                    </Box>

                    <Box sx={{
                        bgcolor: isMe ? '#EFF6FF' : 'white',
                        border: '1px solid',
                        borderColor: isMe ? '#BFDBFE' : '#E5E7EB',
                        borderRadius: 2,
                        borderTopLeftRadius: !isMe ? 0 : 2,
                        borderTopRightRadius: isMe ? 0 : 2,
                        p: '8px 12px',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                        // If image, transparent bg
                        ...(isImage && { bgcolor: 'transparent', border: 'none', boxShadow: 'none', p: 0 })
                    }}>
                        {isImage ? (
                            <Box
                                component="img"
                                src={content}
                                onClick={() => setLightboxOpen(true)}
                                sx={{
                                    maxWidth: 200,
                                    maxHeight: 200,
                                    borderRadius: 2,
                                    border: '1px solid #E5E7EB',
                                    cursor: 'zoom-in'
                                }}
                            />
                        ) : (
                            <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.6, color: '#1F2937' }}>
                                {processMessageText(content || act.text)}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Box>
            {/* Lightbox for this image */}
            {isImage && (
                <ImageLightbox
                    open={lightboxOpen}
                    onClose={() => setLightboxOpen(false)}
                    images={[{ url: content, user: authorName, timestamp: act.createdAt }]}
                    initialIndex={0}
                />
            )}
        </>
    );
});

// 3. ACTIVITY LIST (MEMOIZED)
const ActivityList = React.memo(({ activities, currentUser }) => {
    const listRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [activities]); // Depend only on activities

    return (
        <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
            {activities.length === 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                        Aucune activité récente.
                    </Typography>
                </Box>
            ) : (
                activities.map((act) => {
                    const isLog = act.type === 'log' || act.type === 'change';
                    const isMe = act.author === currentUser;

                    if (isLog) {
                        return <LogItem key={act.id} act={act} />;
                    }
                    return <MessageItem key={act.id} act={act} isMe={isMe} />;
                })
            )}
        </Box>
    );
});


// --- MAIN COMPONENT ---

const ActivitySidebar = React.memo(({ activities = [], onAddComment, onAddImage, currentUser = "Moi", isOpen, minuteId, projectId, rowId, row }) => {
    const { addNotification } = useNotifications();
    const { users } = useAuth(); // We might need this, but maybe not if we just pass callback

    // Notification Menu State (Visual)
    const [headerAnchor, setHeaderAnchor] = useState(null);

    // Memoized Handler to prevent re-renders of CommentInputForm
    const handleSendMessage = useCallback((text) => {
        // Trigger Notifications for Mentions
        const currentUsers = users || [];

        currentUsers.forEach(u => {
            if (!u.name) return;

            // Prénom seul (ex: "Thomas" pour "Thomas DUPONT")
            const firstName = u.name.split(' ')[0];

            // On cherche "@Thomas" ou "@thomas"
            const regex = new RegExp(`@${firstName}`, 'i'); // 'i' = insensible à la casse

            if (regex.test(text)) {
                let navAction = null;
                // On construit le lien de redirection
                if (minuteId) {
                    navAction = { screen: "chiffrage", id: minuteId, rowId: rowId };
                } else if (projectId) {
                    navAction = { screen: "project", id: projectId, rowId: rowId };
                }

                if (navAction) {
                    // Définir le nom du projet/zone pour le contexte
                    const projectContext = row?.designation || row?.nom || row?.produit || row?.piece || row?.zone || `Ligne #${row?.id || '?'}`;
                    const messagePreview = text.length > 40 ? text.substring(0, 40) + "..." : text;

                    // Appel à addNotification avec l'ID CIBLE (u.id)
                    addNotification(
                        "Mention",
                        `${projectContext} : "${messagePreview}"`, // Le message contiendra l'aperçu
                        "info",
                        navAction,
                        u.id // <--- IMPORTANT : On envoie l'ID de la cible pour que la notif aille chez LUI
                    );
                }
            }
        });

        onAddComment(text);
    }, [users, onAddComment, addNotification, minuteId, projectId, currentUser, rowId]);

    const handleUploadImage = useCallback(async (file) => {
        if (!onAddImage) {
            console.error("onAddImage not provided to ActivitySidebar");
            return;
        }
        await onAddImage(file);
    }, [onAddImage]);

    if (!isOpen) return null;

    return (
        <Box sx={{ width: 380, display: 'flex', flexDirection: 'column', bgcolor: '#F9FAFB', borderLeft: '1px solid #E5E7EB', height: '100%' }}>

            {/* Header */}
            <Box sx={{
                p: '16px 20px',
                borderBottom: '1px solid #E5E7EB',
                bgcolor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111827' }}>
                        Activité
                    </Typography>
                    <Chip label={activities.length} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: '#F3F4F6' }} />
                </Box>

                <IconButton size="small" onClick={(e) => setHeaderAnchor(e.currentTarget)}>
                    <NotificationsIcon fontSize="small" sx={{ color: '#9CA3AF' }} />
                </IconButton>
                <Menu
                    anchorEl={headerAnchor}
                    open={Boolean(headerAnchor)}
                    onClose={() => setHeaderAnchor(null)}
                >
                    <MenuItem onClick={() => setHeaderAnchor(null)} dense>M'avertir à chaque commentaire</MenuItem>
                    <MenuItem onClick={() => setHeaderAnchor(null)} dense selected>Uniquement si mentionné</MenuItem>
                    <MenuItem onClick={() => setHeaderAnchor(null)} dense>Jamais</MenuItem>
                </Menu>
            </Box>

            {/* List */}
            <ActivityList activities={activities} currentUser={currentUser?.name || currentUser} />

            {/* Input Form */}
            <CommentInputForm
                onSend={handleSendMessage}
                onUploadImage={handleUploadImage}
                users={users}
            />
        </Box>
    );
});

export default ActivitySidebar;
