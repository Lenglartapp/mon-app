import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import CloseIcon from '@mui/icons-material/Close';
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
import Tooltip from '@mui/material/Tooltip';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';

import { useNotifications } from '../../contexts/NotificationContext';
import { useAuth } from '../../auth';
import { supabase } from '../../lib/supabaseClient'; // <--- Import Supabase
import ImageLightbox from './ImageLightbox'; // <--- Lightbox
import { renderRichText } from '../../lib/utils/richText.jsx';

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

// Boutons de la barre de mise en forme du champ commentaire.
// La marque insérée correspond à celle interprétée à l'affichage (INLINE_MARKS).
const FORMAT_BUTTONS = [
    { mark: '**', title: 'Gras (Cmd/Ctrl + B)', Icon: FormatBoldIcon },
    { mark: '_', title: 'Italique (Cmd/Ctrl + I)', Icon: FormatItalicIcon },
    { mark: '__', title: 'Souligné (Cmd/Ctrl + U)', Icon: FormatUnderlinedIcon },
    { mark: '~~', title: 'Barré', Icon: StrikethroughSIcon },
];

// --- SUB-COMPONENTS ---

// 1. INPUT FORM (ISOLATED & MEMOIZED)
const CommentInputForm = React.memo(({ onSend, onSendWithImage, users = [] }) => {
    // Uncontrolled input for maximum performance
    const inputRef = useRef(null);
    const fileInputRef = useRef(null);
    const [hasText, setHasText] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [pendingFile, setPendingFile] = useState(null);
    const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);

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

    // Encadre la sélection avec une marque (**gras**, ~~barré~~…). Si rien n'est
    // sélectionné, insère les deux marques et place le curseur entre les deux.
    // Le champ est non contrôlé : on écrit dans le DOM et on tient hasText à jour.
    const applyMark = useCallback((mark) => {
        const input = inputRef.current;
        if (!input) return;
        const { selectionStart: start, selectionEnd: end, value } = input;
        const selected = value.slice(start, end);
        input.value = value.slice(0, start) + mark + selected + mark + value.slice(end);

        const caret = start + mark.length;
        input.focus();
        input.setSelectionRange(caret, caret + selected.length);

        const isNotEmpty = input.value.trim().length > 0;
        if (isNotEmpty !== hasText) setHasText(isNotEmpty);
    }, [hasText]);

    const handleKeyDown = (e) => {
        // Raccourcis habituels : Cmd/Ctrl + B / I / U
        if (e.metaKey || e.ctrlKey) {
            const shortcut = { b: '**', i: '_', u: '__' }[e.key.toLowerCase()];
            if (shortcut) {
                e.preventDefault();
                applyMark(shortcut);
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    const handleSendClick = async () => {
        const val = inputRef.current?.value || '';
        if (!val.trim() && !pendingFile) return;

        if (pendingFile) {
            try {
                setUploading(true);
                await onSendWithImage(pendingFile, val.trim() || null);
            } catch (err) {
                console.error(err);
            } finally {
                setUploading(false);
            }
            // Clear
            setPendingFile(null);
            if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
            setPendingPreviewUrl(null);
        } else {
            onSend(val);
        }

        if (inputRef.current) inputRef.current.value = '';
        setHasText(false);
        setAnchorEl(null);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Store as pending — don't upload yet
        if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
        setPendingFile(file);
        setPendingPreviewUrl(URL.createObjectURL(file));
        // Reset native input so same file can be reselected
        if (fileInputRef.current) fileInputRef.current.value = '';
        // Focus text field for caption
        setTimeout(() => inputRef.current?.focus(), 50);
    };

    const handleRemovePending = () => {
        if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
        setPendingFile(null);
        setPendingPreviewUrl(null);
    };

    const filteredUsers = useMemo(() => {
        if (!anchorEl) return [];
        return users.filter(u => u.name.toLowerCase().includes(mentionQuery.toLowerCase()));
    }, [users, mentionQuery, anchorEl]);

    const canSend = hasText || !!pendingFile;

    return (
        <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #E5E7EB' }}>
            {/* Photo preview */}
            {pendingPreviewUrl && (
                <Box sx={{ mb: 1, position: 'relative', display: 'inline-block' }}>
                    <Box
                        component="img"
                        src={pendingPreviewUrl}
                        sx={{ maxHeight: 80, maxWidth: 120, borderRadius: 1.5, border: '1px solid #E5E7EB', display: 'block' }}
                    />
                    <IconButton
                        size="small"
                        onClick={handleRemovePending}
                        sx={{
                            position: 'absolute', top: -8, right: -8,
                            bgcolor: 'white', border: '1px solid #E5E7EB',
                            width: 18, height: 18,
                            '&:hover': { bgcolor: '#FEF2F2' },
                            '& svg': { fontSize: 11 }
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>
            )}

            {/* Barre de mise en forme — encadre la sélection avec la marque correspondante */}
            <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', mb: 0.5 }}>
                {FORMAT_BUTTONS.map((btn) => (
                    <Tooltip key={btn.mark} title={btn.title} enterDelay={400}>
                        <IconButton
                            size="small"
                            onMouseDown={(e) => e.preventDefault()} // garde le focus (et la sélection) dans le champ
                            onClick={() => applyMark(btn.mark)}
                            sx={{ width: 26, height: 26, color: '#6B7280', '&:hover': { color: '#111827', bgcolor: '#F3F4F6' } }}
                        >
                            <btn.Icon sx={{ fontSize: 15 }} />
                        </IconButton>
                    </Tooltip>
                ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: '#F3F4F6', borderRadius: 2, p: '8px 12px' }}>
                <TextField
                    id="comment-input-field"
                    inputRef={inputRef}
                    fullWidth
                    variant="standard"
                    InputProps={{ disableUnderline: true }}
                    placeholder={pendingFile ? "Ajouter un commentaire… (optionnel)" : "Écrire un message… (@ pour mentionner)"}
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
                    <AttachFileIcon fontSize="small" />
                </IconButton>

                <IconButton
                    color="primary"
                    onClick={handleSendClick}
                    disabled={!canSend || uploading}
                    size="small"
                >
                    {uploading ? (
                        <div style={{
                            width: 14, height: 14,
                            border: '2px solid #ccc', borderTopColor: '#1d4ed8',
                            borderRadius: '50%', animation: 'spin 1s linear infinite'
                        }} />
                    ) : <SendIcon fontSize="small" />}
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
                        // If image (without caption), transparent bg
                        ...(isImage && !act.caption && { bgcolor: 'transparent', border: 'none', boxShadow: 'none', p: 0 })
                    }}>
                        {isImage ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                <Box sx={{ position: 'relative', display: 'inline-block' }}>
                                    <Box
                                        component="img"
                                        src={content}
                                        onClick={() => !act.pending && setLightboxOpen(true)}
                                        sx={{
                                            maxWidth: 200,
                                            maxHeight: 200,
                                            borderRadius: act.caption ? 1.5 : 2,
                                            border: `1px solid ${act.pending ? '#f59e0b' : '#E5E7EB'}`,
                                            cursor: act.pending ? 'default' : 'zoom-in',
                                            display: 'block'
                                        }}
                                    />
                                    {act.pending && (
                                        <Box sx={{
                                            position: 'absolute', inset: 0,
                                            bgcolor: 'rgba(245,158,11,0.45)',
                                            borderRadius: act.caption ? 1.5 : 2,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 20,
                                        }} title="Photo en attente de synchronisation">⏳</Box>
                                    )}
                                </Box>
                                {act.caption && (
                                    <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.6, color: '#1F2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                        {renderRichText(act.caption)}
                                    </Typography>
                                )}
                            </Box>
                        ) : (
                            // pre-wrap : conserve les retours à la ligne, espaces et
                            // indentations tels qu'ils ont été saisis (ils étaient déjà
                            // stockés, seul l'affichage les écrasait).
                            <Typography variant="body2" sx={{ fontSize: 13, lineHeight: 1.6, color: '#1F2937', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {renderRichText(content || act.text)}
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

const ACTIVITY_FILTERS = [
    { key: 'all', label: 'Tout' },
    { key: 'activity', label: 'Activité' },
    { key: 'messages', label: 'Messages & Photos' },
];

const ActivitySidebar = React.memo(({ activities = [], onAddComment, onAddImage, currentUser = "Moi", isOpen, minuteId, projectId, rowId, row }) => {
    const { addNotification } = useNotifications();
    const { users } = useAuth(); // We might need this, but maybe not if we just pass callback

    // Notification Menu State (Visual)
    const [headerAnchor, setHeaderAnchor] = useState(null);
    const [activityFilter, setActivityFilter] = useState('all');

    const filteredActivities = useMemo(() => {
        if (activityFilter === 'all') return activities;
        if (activityFilter === 'activity') return activities.filter(a => a.type === 'log' || a.type === 'change');
        if (activityFilter === 'messages') return activities.filter(a => a.type === 'msg' || a.type === 'image');
        return activities;
    }, [activities, activityFilter]);

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

    const handleSendWithImage = useCallback(async (file, caption) => {
        if (!onAddImage) {
            console.error("onAddImage not provided to ActivitySidebar");
            return;
        }
        await onAddImage(file, caption);
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
                    <Chip label={filteredActivities.length} size="small" sx={{ height: 18, fontSize: 10, fontWeight: 600, bgcolor: '#F3F4F6' }} />
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

            {/* Filter tabs */}
            <Box sx={{ display: 'flex', gap: '4px', px: 2, py: 1, borderBottom: '1px solid #E5E7EB', bgcolor: 'white' }}>
                {ACTIVITY_FILTERS.map(f => (
                    <button
                        key={f.key}
                        onClick={() => setActivityFilter(f.key)}
                        style={{
                            padding: '4px 10px',
                            borderRadius: 20,
                            border: 'none',
                            fontSize: 11,
                            fontWeight: 500,
                            cursor: 'pointer',
                            background: activityFilter === f.key ? '#374151' : '#E5E7EB',
                            color: activityFilter === f.key ? 'white' : '#4B5563',
                        }}
                    >
                        {f.label}
                    </button>
                ))}
            </Box>

            {/* List */}
            <ActivityList activities={filteredActivities} currentUser={currentUser?.name || currentUser} />

            {/* Input Form */}
            <CommentInputForm
                onSend={handleSendMessage}
                onSendWithImage={handleSendWithImage}
                users={users}
            />
        </Box>
    );
});

export default ActivitySidebar;
