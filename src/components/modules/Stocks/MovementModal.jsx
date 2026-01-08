import React, { useState, useEffect, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';

const USERS = ['Aristide LENGLART', 'Atelier 1', 'Atelier 2', 'Logistique'];
const EXIT_REASONS = ['Production', 'Solde / Déstockage', 'Perte / Inventaire', 'Autre'];

export default function MovementModal({ open, onClose, type, onSave, projects = [], inventory = [] }) {
    const isIN = type === 'IN';

    // --- ETAT GLOBAL ---
    const [user, setUser] = useState('Aristide LENGLART');
    const [selectedItem, setSelectedItem] = useState(null);
    const [exitReason, setExitReason] = useState('Production'); // Pour OUT

    // Etat Formulaire
    const [formData, setFormData] = useState({
        product: '', ref: '', qty: '', unit: 'ml', project: '', location: '',
        notes: '', laize: '', category: ''
    });

    // Reset à l'ouverture
    useEffect(() => {
        if (open) {
            setSelectedItem(null);
            setExitReason('Production');
            setFormData({ product: '', ref: '', qty: '', unit: 'ml', project: '', location: '', notes: '', laize: '', category: '' });
        }
    }, [open, type]);

    // --- LOGIQUE ENTREE (Source = Projets Production) ---
    const sourceOptionsIN = useMemo(() => {
        if (!isIN || !projects) return [];

        const optsMap = new Map();

        // 1. On ne parcourt que les projets NON ARCHIVÉS
        const activeProjects = projects.filter(p => p.status !== 'ARCHIVED');

        activeProjects.forEach(proj => {
            const pName = proj.name || proj.nom_dossier || 'Projet Inconnu';

            (proj.rows || []).forEach(row => {

                const addFabric = (name, width) => {
                    if (!name) return;
                    const label = `${name} (${pName})`;
                    if (!optsMap.has(label)) {
                        optsMap.set(label, {
                            label: label,
                            productName: name,
                            type: 'Tissu',
                            dim: width,
                            project: pName
                        });
                    } else {
                        const existing = optsMap.get(label);
                        if (!existing.dim && width) existing.dim = width;
                    }
                };

                // Tissu 1 (Priorité à laize_tissu1, fallback legacy)
                addFabric(row.tissu_deco1, row.laize_tissu1 || row.laize_tissu_deco1);
                // Tissu 2
                addFabric(row.tissu_deco2, row.laize_tissu2);
                // Doublure
                addFabric(row.doublure, row.laize_doublure);

                // Rail
                if (row.type_rail && row.type_rail !== 'Free') {
                    const label = `${row.type_rail} (${pName})`;
                    if (!optsMap.has(label)) {
                        optsMap.set(label, {
                            label: label,
                            productName: row.type_rail,
                            type: 'Rail',
                            project: pName
                        });
                    }
                }
            });
        });

        // Conversion Map -> Array
        return Array.from(optsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [projects, isIN]);

    // --- LOGIQUE SORTIE (Source = Inventaire Réel) ---
    const sourceOptionsOUT = useMemo(() => {
        if (isIN || !inventory) return [];
        // On ne propose que ce qui est en stock positif
        return inventory.filter(i => i.qty > 0).map(item => ({
            ...item,
            label: `${item.product} | ${item.location} (Stock: ${item.qty} ${item.unit})`
        }));
    }, [inventory, isIN]);

    // --- HANDLERS ---
    const handleSourceChange = (event, newValue) => {
        setSelectedItem(newValue);
        if (!newValue) return;

        if (isIN) {
            // Remplissage auto pour ENTRÉE
            setFormData(prev => ({
                ...prev,
                product: newValue.productName,
                project: newValue.project,
                unit: newValue.type === 'Tissu' ? 'ml' : 'u',
                category: newValue.type || 'Divers',
                laize: newValue.dim || ''
            }));
        } else {
            // Remplissage auto pour SORTIE (depuis Stock)
            setFormData(prev => ({
                ...prev,
                product: newValue.product,
                ref: newValue.ref,
                unit: newValue.unit,
                location: newValue.location, // Emplacement figé car on sort de là
                category: newValue.category,
                project: exitReason === 'Production' ? (newValue.project || '') : '' // Pré-remplir projet si dispo
            }));
        }
    };

    const handleSubmit = () => {
        // Validation basique
        if (!formData.product || !formData.qty || !user) {
            alert("Champs obligatoires manquants.");
            return;
        }

        // Validation Stock Sortie
        if (!isIN && selectedItem) {
            if (Number(formData.qty) > selectedItem.qty) {
                alert(`Impossible de sortir ${formData.qty} ${formData.unit}. Stock disponible : ${selectedItem.qty} ${selectedItem.unit}.`);
                return;
            }
        }

        onSave({
            ...formData,
            user,
            qty: Number(formData.qty),
            type: type,
            date: new Date().toISOString(),
            // Si c'est une sortie, on ajoute le motif en note ou champ spécifique
            reason: !isIN ? exitReason : null
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            {/* EN-TÊTE */}
            <Box sx={{
                bgcolor: isIN ? '#ECFDF5' : '#FFF7ED',
                p: 3,
                borderBottom: `1px solid ${isIN ? '#D1FAE5' : '#FFEDD5'}`,
                textAlign: 'center'
            }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: isIN ? '#047857' : '#9A3412', letterSpacing: 0.5 }}>
                    {isIN ? 'RÉCEPTION DE MARCHANDISE' : 'SORTIE DE STOCK'}
                </Typography>
            </Box>

            <DialogContent sx={{ p: 4 }}>
                <Stack spacing={4}>

                    {/* 1. SELECTION DU PRODUIT */}
                    <Box>
                        <Autocomplete
                            fullWidth
                            options={isIN ? sourceOptionsIN : sourceOptionsOUT}
                            getOptionLabel={(option) => option.label || ""}
                            value={selectedItem}
                            onChange={handleSourceChange}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={isIN ? "🔍 Rechercher un produit, tissu, rail..." : "🔍 Rechercher dans le stock..."}
                                    sx={{ bgcolor: '#F9FAFB' }}
                                />
                            )}
                            noOptionsText="Aucun résultat."
                        />
                        {!isIN && selectedItem && (
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <Chip size="small" label={`Stock: ${selectedItem.qty} ${selectedItem.unit}`} color="primary" />
                                <Chip size="small" label={selectedItem.location} variant="outlined" />
                            </Stack>
                        )}
                    </Box>

                    {/* 2. INFOS TRANSACTION */}
                    <Box sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#9CA3AF', mb: 2, display: 'block' }}>
                            DÉTAILS
                        </Typography>
                        <Grid container spacing={2}>
                            {/* QTY & UNIT */}
                            <Grid item xs={8}>
                                <TextField
                                    fullWidth label="Quantité" type="number"
                                    value={formData.qty}
                                    onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                                    InputProps={{ sx: { fontSize: 18, fontWeight: 700 } }}
                                />
                            </Grid>
                            <Grid item xs={4}>
                                <TextField select fullWidth label="Unité" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} disabled={!isIN}>
                                    {['ml', 'm2', 'u', 'kg'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                </TextField>
                            </Grid>

                            {/* READONLY INFO */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth label="Produit sélectionné"
                                    value={formData.product}
                                    InputProps={{ readOnly: true }}
                                    variant="outlined"
                                    size="small"
                                />
                            </Grid>

                            {/* LOCATION & LAIZE */}
                            <Grid item xs={6}>
                                <TextField
                                    fullWidth label="Emplacement"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    disabled={!isIN}
                                    size="small"
                                />
                            </Grid>
                            {isIN && (
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth label="Laize / Info"
                                        value={formData.laize}
                                        onChange={(e) => setFormData({ ...formData, laize: e.target.value })}
                                        size="small"
                                    />
                                </Grid>
                            )}
                        </Grid>
                    </Box>

                    {/* 3. PROJET (Si applicable) */}
                    {(isIN || exitReason === 'Production') && (
                        <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#6B7280', mb: 1, display: 'block' }}>
                                AFFECTATION DOSSIER (Optionnel)
                            </Typography>
                            <Autocomplete
                                fullWidth
                                freeSolo
                                options={projects.map(p => p.name || `Projet #${p.id}`)}
                                value={formData.project}
                                onChange={(e, val) => setFormData({ ...formData, project: val })}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Tapez pour lier à un projet..."
                                        sx={{ bgcolor: '#F9FAFB' }}
                                    />
                                )}
                            />
                        </Box>
                    )}

                    {/* 4. CONTEXTE */}
                    <Stack direction="row" spacing={2}>
                        <TextField select fullWidth label="Opérateur" value={user} onChange={(e) => setUser(e.target.value)} size="small">
                            {USERS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                        {!isIN && (
                            <TextField select fullWidth label="Motif" value={exitReason} onChange={(e) => setExitReason(e.target.value)} size="small">
                                {EXIT_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                            </TextField>
                        )}
                    </Stack>

                </Stack>
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #F3F4F6', bgcolor: '#F9FAFB', justifyContent: 'space-between' }}>
                <Button onClick={onClose} sx={{ color: '#6B7280' }}>Annuler</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    size="large"
                    disabled={!formData.qty || !formData.product}
                    sx={{
                        bgcolor: isIN ? '#10B981' : '#F97316',
                        fontWeight: 700,
                        px: 4,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        '&:hover': { bgcolor: isIN ? '#059669' : '#EA580C' }
                    }}
                >
                    {isIN ? 'VALIDER ENTRÉE' : 'CONFIRMER SORTIE'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
