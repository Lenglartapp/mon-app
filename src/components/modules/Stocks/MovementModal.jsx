import React, { useState, useEffect, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Grid from '@mui/material/Grid';
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
        const opts = [];
        projects.forEach(proj => {
            (proj.rows || []).forEach(row => {
                if (row.tissu_deco1) opts.push({ label: `${row.tissu_deco1} (${proj.name})`, productName: row.tissu_deco1, type: 'Tissu', dim: row.laize_tissu_deco1, project: proj.name });
                if (row.type_rail && row.type_rail !== 'Free') opts.push({ label: `${row.type_rail} (${proj.name})`, productName: row.type_rail, type: 'Rail', project: proj.name });
            });
        });
        return opts;
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
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ bgcolor: isIN ? '#ECFDF5' : '#FFF7ED', color: isIN ? '#065F46' : '#9A3412', fontWeight: 700 }}>
                {isIN ? '📥 RÉCEPTION DE MARCHANDISE' : '📤 SORTIE / CONSOMMATION'}
            </DialogTitle>

            <DialogContent sx={{ mt: 2 }}>
                {/* 1. OPERATEUR & MOTIF */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6}>
                        <TextField select fullWidth label="Opérateur" value={user} onChange={(e) => setUser(e.target.value)}>
                            {USERS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                    </Grid>
                    {!isIN && (
                        <Grid item xs={12} sm={6}>
                            <TextField select fullWidth label="Motif de sortie" value={exitReason} onChange={(e) => setExitReason(e.target.value)}>
                                {EXIT_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                            </TextField>
                        </Grid>
                    )}
                </Grid>

                <Divider sx={{ mb: 3 }} />

                {/* 2. SELECTION PRODUIT */}
                <Box sx={{ mb: 3, bgcolor: '#F9FAFB', p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#6B7280', fontWeight: 600 }}>
                        {isIN ? "IDENTIFIER LE PRODUIT ENTRANT (Nouveau ou Existant)" : "SÉLECTIONNER LE STOCK À SORTIR"}
                    </Typography>

                    <Autocomplete
                        options={isIN ? sourceOptionsIN : sourceOptionsOUT}
                        getOptionLabel={(option) => option.label || ""}
                        value={selectedItem}
                        onChange={handleSourceChange}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label={isIN ? "Rechercher Tissu / Rail..." : "Rechercher dans le stock..."}
                                placeholder="Tapez 'Lin', 'A1'..."
                                sx={{ bgcolor: 'white' }}
                            />
                        )}
                        noOptionsText={isIN ? "Aucun produit trouvé." : "Aucun stock correspondant."}
                    />

                    {!isIN && selectedItem && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                            <Chip size="small" label={`Stock: ${selectedItem.qty} ${selectedItem.unit}`} color="primary" variant="outlined" />
                            <Chip size="small" label={`Emplacement: ${selectedItem.location}`} />
                        </Box>
                    )}
                </Box>

                {/* 3. DETAILS FORMULAIRE */}
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={8}>
                        <TextField
                            fullWidth label="Nom du Produit"
                            value={formData.product}
                            onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                            disabled={!isIN} // Bloqué en sortie pour éviter les erreurs
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        {/* En sortie, l'emplacement est fixé par le stock sélectionné */}
                        <TextField
                            fullWidth label="Emplacement"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            disabled={!isIN}
                        />
                    </Grid>

                    <Grid item xs={6} sm={6}>
                        <TextField
                            fullWidth type="number" label="Quantité"
                            value={formData.qty}
                            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
                            required
                            helperText={!isIN && selectedItem ? `Max: ${selectedItem.qty}` : ''}
                            sx={{ '& input': { fontSize: 20, fontWeight: 700, color: !isIN ? '#C2410C' : 'inherit' } }}
                        />
                    </Grid>
                    <Grid item xs={6} sm={6}>
                        <TextField select fullWidth label="Unité" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} disabled={!isIN}>
                            {['ml', 'm2', 'u', 'kg'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                    </Grid>

                    {/* PROJET AFFECTÉ : Seulement si Entrée OU (Sortie ET Motif = Production) */}
                    {(isIN || exitReason === 'Production') && (
                        <Grid item xs={12}>
                            <Autocomplete
                                freeSolo
                                options={projects.map(p => p.name || `Projet #${p.id}`)}
                                value={formData.project}
                                onChange={(e, val) => setFormData({ ...formData, project: val })}
                                renderInput={(params) => <TextField {...params} label="Projet Affecté" placeholder="Nom du chantier" />}
                            />
                        </Grid>
                    )}
                </Grid>

            </DialogContent>
            <DialogActions sx={{ p: 3, borderTop: '1px solid #E5E7EB', bgcolor: '#F9FAFB' }}>
                <Button onClick={onClose}>Annuler</Button>
                <Button variant="contained" onClick={handleSubmit} sx={{ bgcolor: isIN ? '#10B981' : '#F97316', fontWeight: 700 }}>
                    {isIN ? 'VALIDER ENTRÉE' : 'VALIDER SORTIE'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
