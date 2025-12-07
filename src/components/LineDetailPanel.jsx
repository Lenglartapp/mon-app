import React, { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import Avatar from '@mui/material/Avatar';
import SendIcon from '@mui/icons-material/Send';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import MenuItem from '@mui/material/MenuItem';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

export default function LineDetailPanel({ open, onClose, row, schema, onRowChange }) {
    const [commentText, setCommentText] = useState('');

    if (!row) return null;

    const handleFieldChange = (key, value) => {
        onRowChange({ ...row, [key]: value });
    };

    const handleAddComment = () => {
        if (!commentText.trim()) return;

        const newComment = {
            id: Date.now(),
            text: commentText,
            createdAt: new Date().toISOString(),
            author: 'User', // Placeholder
        };

        const updatedComments = row.comments ? [...row.comments, newComment] : [newComment];
        onRowChange({ ...row, comments: updatedComments });
        setCommentText('');
    };

    const comments = row.comments || [];

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { height: '80vh', display: 'flex', flexDirection: 'row', overflow: 'hidden', position: 'relative' },
            }}
        >
            {/* Header / Close Button (Absolute) */}
            <IconButton
                onClick={onClose}
                sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}
            >
                <CloseIcon />
            </IconButton>

            {/* LEFT SIDE: FORM */}
            <Box sx={{ flex: 1, p: 3, overflowY: 'auto', borderRight: '1px solid #e0e0e0' }}>
                <Typography variant="h5" gutterBottom>
                    Détails de la ligne
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {schema.map((col) => {
                        if (col.key === 'sel' || col.key === 'detail') return null; // Skip utility columns

                        const isReadOnly = col.readOnly || col.type === 'formula';
                        const isSelect = col.type === 'select' || (col.options && col.options.length > 0);
                        const isBoolean = col.type === 'boolean' || col.type === 'checkbox';

                        if (isBoolean) {
                            return (
                                <FormControlLabel
                                    key={col.key}
                                    control={
                                        <Switch
                                            checked={!!row[col.key]}
                                            onChange={(e) => handleFieldChange(col.key, e.target.checked)}
                                            disabled={isReadOnly}
                                        />
                                    }
                                    label={col.label || col.key}
                                />
                            );
                        }

                        if (isSelect) {
                            return (
                                <TextField
                                    key={col.key}
                                    select
                                    fullWidth
                                    label={col.label || col.key}
                                    value={row[col.key] ?? ''}
                                    onChange={(e) => handleFieldChange(col.key, e.target.value)}
                                    disabled={isReadOnly}
                                    variant="outlined"
                                    size="small"
                                >
                                    {col.options?.map((option) => (
                                        <MenuItem key={option} value={option}>
                                            {option}
                                        </MenuItem>
                                    ))}
                                </TextField>
                            );
                        }

                        return (
                            <TextField
                                key={col.key}
                                fullWidth
                                label={col.label || col.key}
                                value={row[col.key] ?? ''}
                                onChange={(e) => handleFieldChange(col.key, e.target.value)}
                                disabled={isReadOnly}
                                type={col.type === 'number' || col.type === 'formula' ? 'number' : 'text'}
                                variant="outlined"
                                size="small"
                                helperText={col.formula ? `Formule: ${col.formula}` : ''}
                            />
                        );
                    })}
                </Box>
            </Box>

            {/* RIGHT SIDE: COLLABORATION */}
            <Box sx={{ width: 350, p: 3, display: 'flex', flexDirection: 'column', bgcolor: '#f9f9f9' }}>
                <Typography variant="h6" gutterBottom>
                    Collaboration
                </Typography>

                {/* Comments List */}
                <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
                    {comments.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 4 }}>
                            Aucun commentaire.
                        </Typography>
                    ) : (
                        <List>
                            {comments.map((comment) => (
                                <ListItem key={comment.id} alignItems="flex-start" sx={{ px: 0 }}>
                                    <ListItemAvatar>
                                        <Avatar sx={{ width: 32, height: 32, fontSize: 14 }}>
                                            {comment.author?.[0] || 'U'}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={
                                            <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" component="span">{comment.author}</Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    {new Date(comment.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={comment.text}
                                        sx={{ bgcolor: 'white', p: 1.5, borderRadius: 2, boxShadow: '0 1px 2px rgba(0,0,0,0.05)', mt: 0.5 }}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>

                {/* Comment Input */}
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Ajouter un commentaire..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                        multiline
                        maxRows={3}
                    />
                    <IconButton color="primary" onClick={handleAddComment} disabled={!commentText.trim()}>
                        <SendIcon />
                    </IconButton>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* History Placeholder */}
                <Typography variant="subtitle2" color="text.secondary">
                    Historique
                </Typography>
                <Typography variant="caption" color="text.disabled">
                    (À venir)
                </Typography>
            </Box>
        </Dialog>
    );
}
