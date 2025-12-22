import React, { useState, useEffect } from 'react';
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

// Mock Users
const USERS = ['Aristide LENGLART', 'Atelier 1', 'Atelier 2', 'Logistique'];
// Mock Locations
const LOCATIONS = ['Réception', 'Étagère A1', 'Étagère A2', 'Étagère B1', 'Zone Coupe', 'Zone Expédition'];
// Mock Units
const UNITS = ['ml', 'm2', 'u', 'kg', 'rouleau'];
// Categories
const CATEGORIES = ['Tissu', 'Rail', 'Tringle', 'Mécanisme', 'Mercerie', 'Divers'];

export default function MovementModal({ open, onClose, type, onSave, projects = [] }) {
    const isIN = type === 'IN';

    // Form State
    const [user, setUser] = useState('Aristide LENGLART');
    const [selectedItem, setSelectedItem] = useState(null); // From Autocomplete

    const [formData, setFormData] = useState({
        product: '',
        ref: '',
        qty: '',
        unit: 'ml',
        project: '',
        location: '',
        notes: '',
        laize: '',
        category: ''
    });

    // Compute Source Options from PRODUCTION Projects
    const sourceOptions = React.useMemo(() => {
        if (!projects || !Array.isArray(projects)) return [];
        const opts = [];

        // Helper to push option
        const addOpt = (label, ref, projName, type, dim = null) => {
            if (!label) return;
            // Avoid duplicates? Or allow seeing same fabric in multiple projects?
            // User likely wants to pick a specific project context, so show duplicates with Project Label.
            opts.push({
                label: `${label} (${projName})`,
                productName: label,
                ref: ref || '',
                project: projName,
                type: type, // 'FABRIC' or 'HW' (Hardware)
                dim: dim // Laize or Dimension
            });
        };

        projects.forEach(proj => {
            (proj.rows || []).forEach(row => {
                // 1. Tissus
                // Check tissu_deco1, tissu_deco2, doublure, inter_doublure
                if (row.tissu_deco1) addOpt(row.tissu_deco1, '', proj.name, 'FABRIC', row.laize_tissu_deco1);
                if (row.tissu_deco2) addOpt(row.tissu_deco2, '', proj.name, 'FABRIC', row.laize_tissu_deco2);
                if (row.doublure) addOpt(row.doublure, '', proj.name, 'FABRIC', row.laize_doublure);

                // 2. Hardware (Rails / Tringles)
                if (row.type_rail && row.type_rail !== 'Free') {
                    // Compose name like "Rail Kontrak"
                    const name = `${row.type_rail} ${row.couleur_rail || ''}`.trim();
                    addOpt(name, '', proj.name, 'HW');
                }
                if (row.nom_tringle) {
                    addOpt(row.nom_tringle, '', proj.name, 'HW');
                }
            });
        });

        return opts;
    }, [projects]);

    // Handle Autocomplete Selection
    const handleSourceChange = (event, newValue) => {
        setSelectedItem(newValue);
        if (newValue) {
            // Auto-determine Category
            let autoCat = 'Divers';
            if (newValue.type === 'FABRIC') autoCat = 'Tissu';
            else if (newValue.type === 'HW') {
                // Try to detect keywords in name
                const lower = newValue.productName.toLowerCase();
                if (lower.includes('rail')) autoCat = 'Rail';
                else if (lower.includes('tringle')) autoCat = 'Tringle';
                else if (lower.includes('store') || lower.includes('mecanisme')) autoCat = 'Mécanisme';
                else autoCat = 'Rail'; // Default HW
            }

            setFormData(prev => ({
                ...prev,
                product: newValue.productName,
                ref: newValue.ref,
                project: newValue.project,
                unit: newValue.type === 'FABRIC' ? 'ml' : 'u',
                laize: newValue.dim || '',
                category: autoCat
            }));
        }
    };

    const handleChange = (key, value) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleSubmit = () => {
        if (!formData.product || !formData.qty || !formData.location || !user) {
            alert("Merci de remplir les champs obligatoires (Produit, Qté, Emplacement, Opérateur).");
            return;
        }

        onSave({
            ...formData,
            user,
            qty: Number(formData.qty),
            date: new Date().toISOString()
        });
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ bgcolor: isIN ? '#ECFDF5' : '#FFF7ED', color: isIN ? '#065F46' : '#9A3412', fontWeight: 700 }}>
                {isIN ? '📥 RÉCEPTION DE MARCHANDISE' : '📤 SORTIE / CONSOMMATION'}
            </DialogTitle>

            <DialogContent sx={{ mt: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
                    1. IDENTIFICATION
                </Typography>

                <Grid container spacing={2} sx={{ mb: 4 }}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            select
                            fullWidth
                            label="Opérateur"
                            value={user}
                            onChange={(e) => setUser(e.target.value)}
                        >
                            {USERS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                    </Grid>
                </Grid>

                <Divider sx={{ mb: 3 }} />

                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary', textTransform: 'uppercase', fontWeight: 600 }}>
                    2. PRODUIT & QUANTITÉ
                </Typography>

                {/* AUTOCOMPLETE SEARCH */}
                <Box sx={{ mb: 3, bgcolor: '#F9FAFB', p: 2, borderRadius: 2 }}>
                    <Typography variant="caption" sx={{ display: 'block', mb: 1, color: '#6B7280' }}>
                        Rechercher dans les dossiers en Production (Tissus, Rails...)
                    </Typography>
                    <Autocomplete
                        options={sourceOptions}
                        getOptionLabel={(option) => option.label}
                        value={selectedItem}
                        onChange={handleSourceChange}
                        openOnFocus={false} // User Request: Wait for typing
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Rechercher Produit / Référence..."
                                placeholder="Tapez 'Lin', 'Rail'..."
                                fullWidth
                                sx={{ bgcolor: 'white' }}
                            />
                        )}
                        noOptionsText="Aucun produit trouvé en production."
                    />
                </Box>

                <Grid container spacing={2}>
                    {/* NEW CATEGORY FIELD */}
                    <Grid item xs={12} sm={4}>
                        <TextField
                            select
                            fullWidth
                            label="Catégorie / Type"
                            value={formData.category}
                            onChange={(e) => handleChange('category', e.target.value)}
                        >
                            {CATEGORIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </TextField>
                    </Grid>

                    <Grid item xs={12} sm={8}>
                        <TextField
                            fullWidth
                            label="Nom du Produit"
                            value={formData.product}
                            onChange={(e) => handleChange('product', e.target.value)}
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <TextField
                            fullWidth
                            label="Laize / Dim (cm)"
                            value={formData.laize || ''}
                            onChange={(e) => handleChange('laize', e.target.value)}
                            helperText="Infos tech (Laize, Diamètre...)"
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Référence Fabricant"
                            value={formData.ref}
                            onChange={(e) => handleChange('ref', e.target.value)}
                        />
                    </Grid>

                    <Grid item xs={12} sm={3}>
                        <TextField
                            fullWidth
                            label="Quantité"
                            type="number"
                            value={formData.qty}
                            onChange={(e) => handleChange('qty', e.target.value)}
                            required
                            sx={{ '& input': { fontSize: 20, fontWeight: 700 } }}
                        />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <TextField
                            select
                            fullWidth
                            label="Unité"
                            value={formData.unit}
                            onChange={(e) => handleChange('unit', e.target.value)}
                        >
                            {UNITS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                    </Grid>

                    <Grid item xs={6} sm={4}>
                        <Autocomplete
                            freeSolo
                            options={LOCATIONS}
                            value={formData.location}
                            onChange={(e, val) => handleChange('location', val)}
                            onInputChange={(e, val) => handleChange('location', val)}
                            renderInput={(params) => <TextField {...params} label="Emplacement" required />}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Grid item xs={12}>
                            <Autocomplete
                                freeSolo
                                options={projects.map(p => p.name || p.nom_dossier || `Projet #${p.id}`)}
                                value={formData.project}
                                onChange={(event, newValue) => handleChange('project', newValue)}
                                onInputChange={(event, newInputValue) => handleChange('project', newInputValue)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Projet Affecté"
                                        placeholder="Ex: Mme DUPONT ou Saisie libre"
                                        helperText="Sélectionnez un projet existant ou saisissez un nom libre."
                                    />
                                )}
                            />
                        </Grid>
                    </Grid>
                </Grid>

            </DialogContent>
            <DialogActions sx={{ p: 3, borderTop: '1px solid #E5E7EB', bgcolor: '#F9FAFB' }}>
                <Button onClick={onClose} size="large" sx={{ color: '#6B7280' }}>
                    Annuler
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    size="large"
                    sx={{
                        bgcolor: isIN ? '#10B981' : '#F97316',
                        px: 4, py: 1.5, fontWeight: 700,
                        '&:hover': { bgcolor: isIN ? '#059669' : '#EA580C' }
                    }}
                >
                    {isIN ? 'VALIDER LA RÉCEPTION' : 'VALIDER LA SORTIE'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
