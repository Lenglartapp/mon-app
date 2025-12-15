import React, { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

// Helper to generate pastel color from string
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

export default function ActivitySidebar({ activities = [], onAddComment, currentUser = "Moi", isOpen }) {
    const [text, setText] = React.useState('');
    const listRef = useRef(null);

    // Auto-scroll
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [activities, isOpen]);

    const handleSubmit = () => {
        if (!text.trim()) return;
        onAddComment(text); // Parent handles object creation
        setText('');
    };

    if (!isOpen) return null;

    return (
        <Box sx={{ width: 350, display: 'flex', flexDirection: 'column', bgcolor: '#F8F9FA', borderLeft: '1px solid #E5E7EB', height: '100%' }}>

            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', bgcolor: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111827', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Activité & Logs
                </Typography>
                <Chip label={activities.length} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
            </Box>

            {/* List */}
            <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {activities.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            Aucune activité récente.
                        </Typography>
                    </Box>
                ) : (
                    activities.map((act) => {
                        const isLog = act.type === 'log';
                        const isMe = act.author === currentUser;
                        const dateStr = new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        if (isLog) {
                            return (
                                <Box key={act.id} sx={{ display: 'flex', justifyContent: 'center', my: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#6B7280', fontSize: 11, bgcolor: '#E5E7EB', px: 1, py: 0.5, borderRadius: 4 }}>
                                        {act.text} • {dateStr}
                                    </Typography>
                                </Box>
                            );
                        }

                        // Message Bubble
                        return (
                            <Box key={act.id} sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isMe ? 'flex-end' : 'flex-start',
                                maxWidth: '85%',
                                alignSelf: isMe ? 'flex-end' : 'flex-start'
                            }}>
                                <Box sx={{
                                    bgcolor: isMe ? '#2563EB' : 'white',
                                    color: isMe ? 'white' : '#1F2937',
                                    p: 1.5,
                                    borderRadius: isMe ? '12px 12px 0 12px' : '12px 12px 12px 0',
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    border: isMe ? 'none' : '1px solid #E5E7EB',
                                    position: 'relative'
                                }}>
                                    <Typography variant="body2" sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
                                        {act.text}
                                    </Typography>
                                </Box>
                                <Typography variant="caption" sx={{ mt: 0.5, color: '#9CA3AF', fontSize: 10 }}>
                                    {isMe ? 'Moi' : act.author} • {dateStr}
                                </Typography>
                            </Box>
                        );
                    })
                )}
            </Box>

            {/* Input */}
            <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #E5E7EB' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: '#F3F4F6', borderRadius: 2, p: '4px 4px 4px 12px' }}>
                    <TextField
                        fullWidth
                        variant="standard"
                        InputProps={{ disableUnderline: true }}
                        placeholder="Écrire un message..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
                        }}
                        multiline
                        maxRows={4}
                        sx={{ py: 1, fontSize: 14 }}
                    />
                    <IconButton
                        color="primary"
                        onClick={handleSubmit}
                        disabled={!text.trim()}
                        size="small"
                        sx={{ mb: 0.5, mr: 0.5 }}
                    >
                        <SendIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
}
