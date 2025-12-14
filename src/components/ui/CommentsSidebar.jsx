
import React, { useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import Divider from '@mui/material/Divider';

// Helper to generate pastel color from string (Consistent with other parts of app)
function stringToColor(string) {
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

export default function CommentsSidebar({ comments = [], onAddComment, currentUser, isOpen }) {
    const [commentText, setCommentText] = React.useState('');
    const listRef = useRef(null);

    // Auto-scroll to bottom on new comments
    useEffect(() => {
        if (listRef.current) {
            listRef.current.scrollTop = listRef.current.scrollHeight;
        }
    }, [comments, isOpen]);

    const handleSubmit = () => {
        if (!commentText.trim()) return;
        onAddComment(commentText);
        setCommentText('');
    };

    if (!isOpen) return null;

    return (
        <Box sx={{ width: 350, display: 'flex', flexDirection: 'column', bgcolor: '#F8F9FA', borderLeft: '1px solid #E5E7EB', height: '100%' }}>

            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #E5E7EB', bgcolor: 'white' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Activité & Commentaires
                </Typography>
            </Box>

            {/* List */}
            <Box ref={listRef} sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                {comments.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5 }}>
                        <Typography variant="body2" color="text.secondary">
                            Aucune activité pour le moment.
                        </Typography>
                    </Box>
                ) : (
                    <List disablePadding>
                        {comments.map((comment) => {
                            const authorName = comment.author || 'Inconnu';
                            const avatarColor = stringToColor(authorName);

                            return (
                                <ListItem key={comment.id} alignItems="flex-start" sx={{ px: 0, mb: 2 }}>
                                    <ListItemAvatar sx={{ minWidth: 40, mt: 0.5 }}>
                                        <Avatar sx={{ width: 32, height: 32, fontSize: 13, bgcolor: avatarColor, color: '#1F2937', fontWeight: 600 }}>
                                            {authorName[0]?.toUpperCase()}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <Box sx={{ flex: 1 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 0.5 }}>
                                            <Typography variant="caption" sx={{ fontWeight: 600, color: '#374151' }}>
                                                {authorName}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
                                                {new Date(comment.createdAt).toLocaleDateString()} {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ bgcolor: 'white', p: 1.5, borderRadius: '0px 12px 12px 12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', border: '1px solid #E5E7EB' }}>
                                            <Typography variant="body2" sx={{ color: '#1F2937', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                                                {comment.text}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>

            {/* Input Area */}
            <Box sx={{ p: 2, bgcolor: 'white', borderTop: '1px solid #E5E7EB' }}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', bgcolor: '#F3F4F6', borderRadius: 2, p: '4px 4px 4px 12px' }}>
                    <TextField
                        fullWidth
                        variant="standard"
                        InputProps={{ disableUnderline: true }}
                        placeholder="Écrire un commentaire..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
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
                        disabled={!commentText.trim()}
                        size="small"
                        sx={{ mb: 0.5, mr: 0.5, bgcolor: commentText.trim() ? '#E0E7FF' : 'transparent', '&:hover': { bgcolor: '#C7D2FE' } }}
                    >
                        <SendIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>
        </Box>
    );
}
