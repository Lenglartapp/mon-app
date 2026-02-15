import React, { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, TextField, List, ListItem, ListItemText,
    ListItemIcon, IconButton, Typography, Box
} from '@mui/material';
import { ExternalLink, Trash2, Plus, FileText, Link as LinkIcon } from 'lucide-react';

export default function DocumentListModal({ open, onClose, documents = [], onUpdate }) {
    const [newDocName, setNewDocName] = useState("");
    const [newDocUrl, setNewDocUrl] = useState("");
    const [error, setError] = useState("");

    const handleAdd = () => {
        if (!newDocName.trim() || !newDocUrl.trim()) {
            setError("Le nom et le lien sont obligatoires.");
            return;
        }

        // Basic URL validation
        let url = newDocUrl.trim();
        if (!url.startsWith('http')) {
            url = 'https://' + url;
        }

        const newDoc = {
            id: Date.now().toString(), // Simple ID
            name: newDocName.trim(),
            url: url,
            createdAt: new Date().toISOString()
        };

        const updatedDocs = [...documents, newDoc];
        onUpdate(updatedDocs);

        // Reset form
        setNewDocName("");
        setNewDocUrl("");
        setError("");
    };

    const handleDelete = (id) => {
        if (window.confirm("Supprimer ce document ?")) {
            const updatedDocs = documents.filter(d => d.id !== id);
            onUpdate(updatedDocs);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <FileText size={24} />
                Documents & Plans
            </DialogTitle>
            <DialogContent dividers>

                {/* ADD FORM */}
                <Box sx={{ mb: 3, p: 2, bgcolor: '#F9FAFB', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>Ajouter un lien</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <TextField
                            label="Nom du document (ex: Plan RDC)"
                            size="small"
                            fullWidth
                            value={newDocName}
                            onChange={(e) => setNewDocName(e.target.value)}
                        />
                        <TextField
                            label="Lien URL (Sharepoint, Drive...)"
                            size="small"
                            fullWidth
                            value={newDocUrl}
                            onChange={(e) => setNewDocUrl(e.target.value)}
                            placeholder="https://..."
                        />
                        {error && <Typography color="error" variant="caption">{error}</Typography>}
                        <Button
                            variant="contained"
                            startIcon={<Plus size={16} />}
                            onClick={handleAdd}
                            size="small"
                            sx={{ alignSelf: 'flex-end', bgcolor: '#1F2937' }}
                        >
                            Ajouter
                        </Button>
                    </Box>
                </Box>

                {/* LIST */}
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Documents liés ({documents.length})
                </Typography>

                {documents.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2, textAlign: 'center' }}>
                        Aucun document lié pour le moment.
                    </Typography>
                ) : (
                    <List dense sx={{ bgcolor: 'white', borderRadius: 1, border: '1px solid #E5E7EB', py: 0 }}>
                        {documents.map((doc, index) => (
                            <ListItem
                                key={doc.id || index}
                                component="li"
                                divider={index < documents.length - 1}
                                secondaryAction={
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleDelete(doc.id)} size="small" color="error">
                                        <Trash2 size={16} />
                                    </IconButton>
                                }
                            >
                                <ListItemIcon sx={{ minWidth: 32 }}>
                                    <LinkIcon size={16} color="#6B7280" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <a
                                            href={doc.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{ color: '#2563EB', textDecoration: 'none', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}
                                        >
                                            {doc.name}
                                            <ExternalLink size={12} />
                                        </a>
                                    }
                                    secondary={new URL(doc.url).hostname}
                                    primaryTypographyProps={{ variant: 'body2' }}
                                    secondaryTypographyProps={{ variant: 'caption', fontSize: 10 }}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}

            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Fermer</Button>
            </DialogActions>
        </Dialog>
    );
}
