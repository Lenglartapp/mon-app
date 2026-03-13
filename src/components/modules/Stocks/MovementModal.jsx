import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Layers } from 'lucide-react';
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
import IconButton from '@mui/material/IconButton';

const USERS = [
    'Elisa Laprune', 'Guillaume Mailly', 'David Vergel', 'Lucie Jaulin', 'Maelane Poulaud',
    'Thomas Bonnet', 'Delphine Butez', 'Catherine Bosse', 'Thierry Menant', 'Alain Houdemont',
    'Nicolas Podyma', 'Audry Papin', 'Julie Rabin', 'Alison Gloaguen', 'Samuel Blandin',
    'Emilie David', 'Emmanuel Peltier', 'Malcolm Jeantal', 'Florence Gobbe'
].sort();
const EXIT_REASONS = ['Production', 'Solde / Déstockage', 'Perte / Inventaire', 'Autre'];
const TYPOLOGIES = ['Tissu', 'Rail', 'Consommable', 'Mécanisme'];

export default function MovementModal({ open, onClose, type, onSave, projects = [], inventory = [] }) {
    const isIN = type === 'IN';
    const isMOVE = type === 'MOVE';
    const isOUT = type === 'OUT'; // Helper

    // --- ETAT GLOBAL ---
    const [user, setUser] = useState('');
    const [selectedItem, setSelectedItem] = useState(null);
    const [exitReason, setExitReason] = useState('Production'); // Pour OUT
    const [typology, setTypology] = useState('Tissu'); // Par défaut Tissu

    // Etat Formulaire
    const [formData, setFormData] = useState({
        product: '', ref: '', qty: '', unit: 'ml', project: '', location: '',
        notes: '', laize: '', category: '', customReason: ''
    });

    const [pieces, setPieces] = useState([]); // Array of {id, qty}

    // Reset à l'ouverture
    useEffect(() => {
        if (open) {
            setSelectedItem(null);
            setExitReason('Production');
            setTypology('Tissu');
            setFormData({ product: '', ref: '', qty: '', unit: 'ml', project: '', location: '', notes: '', laize: '', category: '' });
            // Pour Tissu en Entrée, on démarre avec une pièce
            setPieces(isIN ? [{ id: 1, qty: '', location: '', name: '' }] : []);
        }
    }, [open, type, isIN]);

    // Changement de typologie
    const handleTypologyChange = (t) => {
        setTypology(t);
        setSelectedItem(null);
        setFormData(prev => ({
            ...prev,
            product: '',
            category: t,
            unit: t === 'Tissu' ? 'ml' : 'u',
            project: '',
            location: ''
        }));
        if (isIN) {
            setPieces(t === 'Tissu' ? [{ id: Date.now(), qty: '', location: '', name: '' }] : []);
        } else {
            setPieces([]);
        }
    };

    // --- LOGIQUE ENTREE (Source = Projets ou Stock Gros) ---
    const sourceOptionsIN = useMemo(() => {
        if (!isIN || !projects) return [];

        const optsMap = new Map();

        if (typology === 'Tissu') {
            // Logique par Projet (Tissus uniquement)
            const activeProjects = projects.filter(p => p.status !== 'ARCHIVED');
            activeProjects.forEach(proj => {
                const pName = proj.name || proj.nom_dossier || 'Projet Inconnu';
                (proj.rows || []).forEach(row => {
                    const addFabric = (name, width) => {
                        if (!name) return;
                        const label = `${name} (${pName})`;
                        if (!optsMap.has(label)) {
                            optsMap.set(label, { label, productName: name, type: 'Tissu', dim: width, project: pName });
                        }
                    };
                    addFabric(row.tissu_deco1, row.laize_tissu1 || row.laize_tissu_deco1);
                    addFabric(row.tissu_deco2, row.laize_tissu2);
                    addFabric(row.doublure, row.laize_doublure);
                });
            });
        } else {
            // Logique Gros (Rails, Consommables, Mécanismes)
            // On propose les items déjà présents dans l'inventaire pour cette catégorie
            inventory
                .filter(item => item.category === typology)
                .forEach(item => {
                    if (!optsMap.has(item.product)) {
                        optsMap.set(item.product, {
                            label: item.product,
                            productName: item.product,
                            type: typology,
                            ref: item.ref,
                            project: ''
                        });
                    }
                });
        }

        return Array.from(optsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [projects, inventory, isIN, typology]);

    // --- LOGIQUE SORTIE / MOVE (Source = Inventaire Réel) ---
    const sourceOptionsOUT = useMemo(() => {
        if (isIN || !inventory) return [];
        return inventory
            .filter(item => item.category === typology) // FILTRE PAR TYPOLOGIE
            .map(item => ({
                label: `${item.product} (${item.location}) - ${item.qty} ${item.unit}`,
                ...item
            }))
            .sort((a, b) => a.product.localeCompare(b.product));
    }, [inventory, isIN, typology]);

    // --- HANDLERS ---
    const handleSourceChange = (event, newValue) => {
        setSelectedItem(newValue);
        if (!newValue) return;

        if (isIN) {
            // Remplissage auto pour ENTRÉE
            setFormData(prev => ({
                ...prev,
                product: newValue.productName || newValue.product || '',
                project: newValue.project || '',
                unit: typology === 'Tissu' ? 'ml' : (newValue.unit || 'u'),
                category: typology,
                laize: newValue.dim || ''
            }));
            // Pour le tissu, on garde au moins une pièce prête à remplir
            if (typology === 'Tissu') {
                setPieces([{ id: Date.now(), qty: '', location: '', name: '' }]);
            } else {
                setPieces([]);
            }
        } else {
            // Remplissage auto pour SORTIE / MOVE (depuis Stock)
            setFormData(prev => ({
                ...prev,
                product: newValue.product,
                ref: newValue.ref,
                unit: newValue.unit,
                location: isMOVE ? '' : newValue.location,
                category: newValue.category,
                project: exitReason === 'Production' ? (newValue.project || '') : ''
            }));
            // Charger les pièces existantes pour la sortie
            setPieces(Array.isArray(newValue.pieces) ? newValue.pieces.map(p => ({ ...p, selected: false, consumption: 0 })) : []);
        }
    };

    const addPiece = () => {
        setPieces(prev => [...prev, { id: Date.now(), qty: '', location: '', name: '' }]);
    };

    const removePiece = (id) => {
        setPieces(prev => prev.filter(p => p.id !== id));
    };

    const updatePieceQty = (id, val) => {
        setPieces(prev => prev.map(p => p.id === id ? { ...p, qty: val } : p));
    };

    const updatePieceLocation = (id, val) => {
        setPieces(prev => prev.map(p => p.id === id ? { ...p, location: val } : p));
    };

    const updatePieceName = (id, val) => {
        setPieces(prev => prev.map(p => p.id === id ? { ...p, name: val } : p));
    };

    const updatePieceRemaining = (id, val) => {
        setPieces(prev => prev.map(p => p.id === id ? { ...p, p_qty: val } : p));
    };

    // Auto-sum qty
    useEffect(() => {
        if (isIN && pieces.length > 0) {
            const total = pieces.reduce((sum, p) => sum + Number(p.qty || 0), 0);
            setFormData(prev => ({ ...prev, qty: total || '' }));
        } else if (isOUT && pieces.length > 0) {
            // Consommation totale = Somme(Initiale - Reste)
            const totalConsumed = pieces.reduce((sum, p) => {
                const initial = Number(p.qty || 0);
                const remaining = Number(p.p_qty ?? p.qty);
                return sum + Math.max(0, initial - remaining);
            }, 0);
            setFormData(prev => ({ ...prev, qty: totalConsumed || '' }));
        }
    }, [pieces, isIN, isOUT]);

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

        // Validation MOVE
        if (isMOVE && !formData.location) {
            alert("Veuillez saisir le nouvel emplacement.");
            return;
        }

        onSave({
            ...formData,
            user,
            qty: Number(formData.qty),
            type: type,
            date: new Date().toISOString(),
            reason: formData.customReason || (isOUT ? exitReason : null),
            // MOVE: Capture Origin
            from_location: isMOVE && selectedItem ? selectedItem.location : null,
            pieces: isIN ? pieces.filter(p => Number(p.qty) > 0).map(({ id, qty, location, name }) => ({ 
                id, 
                qty: Number(qty), 
                location: location || formData.location,
                name: name || ''
            })) : pieces
        });
        onClose();
    };

    const getHeaderColor = () => {
        if (isIN) return '#047857'; // Green
        if (isMOVE) return '#1d4ed8'; // Blue
        return '#9A3412'; // Orange
    }

    const getBgColor = () => {
        if (isIN) return '#ECFDF5';
        if (isMOVE) return '#EFF6FF';
        return '#FFF7ED';
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
            {/* EN-TÊTE */}
            <Box sx={{
                bgcolor: getBgColor(),
                p: 3,
                borderBottom: `1px solid ${isIN ? '#D1FAE5' : isMOVE ? '#DBEAFE' : '#FFEDD5'}`,
                textAlign: 'center'
            }}>
                <Typography variant="h6" sx={{ fontWeight: 800, color: getHeaderColor(), letterSpacing: 0.5 }}>
                    {isIN ? 'RÉCEPTION DE MARCHANDISE' : isMOVE ? 'CHANGEMENT D\'EMPLACEMENT' : 'SORTIE DE STOCK'}
                </Typography>
            </Box>

            <DialogContent sx={{ p: 4 }}>
                <Stack spacing={4}>

                    {/* 1. TYPOLOGIE (POUR TOUS LES MOUVEMENTS) */}
                    <Box sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2, bgcolor: '#F9FAFB' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#9CA3AF', mb: 1, display: 'block' }}>
                            FILTRER PAR CATÉGORIE
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            {TYPOLOGIES.map(t => (
                                <Button
                                    key={t}
                                    size="small"
                                    variant={typology === t ? 'contained' : 'outlined'}
                                    onClick={() => handleTypologyChange(t)}
                                    sx={{
                                        borderRadius: 2,
                                        fontWeight: 700,
                                        textTransform: 'none',
                                        bgcolor: typology === t ? getHeaderColor() : 'transparent',
                                        '&:hover': { bgcolor: typology === t ? getHeaderColor() : '#F3F4F6' }
                                    }}
                                >
                                    {t}
                                </Button>
                            ))}
                        </Stack>
                    </Box>

                    {/* 2. SELECTION DU PRODUIT */}
                    <Box>
                        <Autocomplete
                            fullWidth
                            options={isIN ? sourceOptionsIN : sourceOptionsOUT}
                            getOptionLabel={(option) => option.label || ""}
                            value={selectedItem}
                            onChange={handleSourceChange}
                            freeSolo={isIN} // Permet toujours la saisie libre en entrée
                            onInputChange={(e, val) => {
                                if (isIN) {
                                    setFormData(prev => ({ ...prev, product: val }));
                                }
                            }}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label={isIN ? `🔍 Rechercher un(e) ${typology}...` : "🔍 Rechercher dans le stock..."}
                                    sx={{ bgcolor: '#F9FAFB' }}
                                />
                            )}
                            noOptionsText="Aucun résultat. Tapez pour créer."
                        />
                        {!isIN && selectedItem && (
                            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                <Chip size="small" label={`Stock: ${selectedItem.qty} ${selectedItem.unit}`} color="primary" />
                                <Chip size="small" label={`Emplacement: ${selectedItem.location}`} variant="outlined" />
                            </Stack>
                        )}
                    </Box>

                    {/* 3. COMPOSITION PAR PIECE (Pour TISSUS en ENTRÉE - Priorité Haute) */}
                    {isIN && typology === 'Tissu' && (
                        <Box sx={{ p: 2, border: '1px dashed #D1D5DB', borderRadius: 2, bgcolor: '#F9FAFB' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" sx={{ fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>Composition par pièce</Typography>
                                <Button size="small" startIcon={<Plus size={14} />} onClick={addPiece} sx={{ textTransform: 'none', fontWeight: 700 }}>Ajouter une pièce</Button>
                            </Box>
                            <Stack spacing={1}>
                                {pieces.map((p, idx) => (
                                    <Box key={p.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ color: '#9CA3AF', minWidth: 60 }}>P. {idx + 1}</Typography>
                                        <TextField
                                            size="small"
                                            value={p.name || ''}
                                            onChange={(e) => updatePieceName(p.id, e.target.value)}
                                            placeholder="Nom"
                                            sx={{ flex: 1, bgcolor: 'white' }}
                                        />
                                        <TextField
                                            size="small"
                                            type="number"
                                            value={p.qty}
                                            onChange={(e) => updatePieceQty(p.id, e.target.value)}
                                            placeholder="ml"
                                            sx={{ width: 80, bgcolor: 'white' }}
                                        />
                                        <TextField
                                            size="small"
                                            value={p.location}
                                            onChange={(e) => updatePieceLocation(p.id, e.target.value)}
                                            placeholder="Empl."
                                            sx={{ flex: 1, bgcolor: 'white' }}
                                        />
                                        <IconButton size="small" color="error" onClick={() => removePiece(p.id)} disabled={pieces.length <= 1}><Minus size={16} /></IconButton>
                                    </Box>
                                ))}
                            </Stack>
                        </Box>
                    )}

                    {/* 4. INFOS TRANSACTION (Quantité globale pour HORS-Tissu) */}
                    {(typology !== 'Tissu' || !isIN) && (
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
                                    <TextField select fullWidth label="Unité" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })}>
                                        {['ml', 'm2', 'u', 'kg'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                    </TextField>
                                </Grid>
                            </Grid>
                        </Box>
                    )}

                    {/* 5. SAISIE DU RESTE PAR PIECE (SORTIE / AJUSTEMENT) */}
                    {isOUT && pieces.length > 0 && (
                        <Box sx={{ mt: 1, p: 2, border: '1px dashed #D1D5DB', borderRadius: 2, bgcolor: '#F9FAFB' }}>
                            <Typography variant="caption" sx={{ fontWeight: 800, color: '#374151', textTransform: 'uppercase', mb: 2, display: 'block' }}>Mise à jour des pièces (Reste en stock)</Typography>
                            <Stack spacing={1.5}>
                                {pieces.map((p, idx) => (
                                    <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#4B5563' }}>
                                                {p.name ? `${p.name}` : `Pièce ${idx + 1}`}
                                            </Typography>
                                            <TextField
                                                size="small"
                                                label="Loc."
                                                value={p.location || ''}
                                                onChange={(e) => updatePieceLocation(p.id, e.target.value)}
                                                sx={{ mt: 0.5, bgcolor: '#F9FAFB' }}
                                                InputProps={{ sx: { fontSize: 11 } }}
                                            />
                                        </Box>
                                        <Box sx={{ textAlign: 'right', minWidth: 80 }}>
                                            <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>Initial</Typography>
                                            <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.qty} ml</Typography>
                                        </Box>
                                        <Box sx={{ minWidth: 100 }}>
                                            <TextField
                                                size="small"
                                                label="Reste"
                                                type="number"
                                                value={p.p_qty ?? p.qty}
                                                onChange={(e) => updatePieceRemaining(p.id, e.target.value)}
                                                InputProps={{ sx: { fontSize: 14, fontWeight: 700, bgcolor: (p.p_qty !== undefined && p.p_qty !== p.qty) ? '#FFFBEB' : 'white' } }}
                                            />
                                        </Box>
                                    </Box>
                                ))}
                            </Stack>
                            <Typography variant="caption" sx={{ color: '#6B7280', display: 'block', mt: 2, textAlign: 'center' }}>Saisissez ce qu'il reste sur chaque pièce et son emplacement actuel.</Typography>
                        </Box>
                    )}

                    {/* 6. CHAMPS FINAUX (Affectation, Laize, Opérateur) */}
                    <Box sx={{ p: 2, border: '1px solid #E5E7EB', borderRadius: 2 }}>
                        <Grid container spacing={2}>
                            {/* PRODUIT */}
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth label="Produit sélectionné"
                                    value={formData.product}
                                    variant="outlined"
                                    size="small"
                                    disabled={!isIN}
                                    onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                                />
                            </Grid>

                            {/* LOCATION (Visible uniquement si pas de pièces gérées et pas un tissu en entrée) */}
                            {(!pieces.length || (!isIN && !isOUT)) && !(isIN && typology === 'Tissu') && (
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth label={isMOVE ? "Nouvel Emplacement" : "Emplacement"}
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        disabled={!isIN && !isMOVE}
                                        required={isMOVE}
                                        size="small"
                                    />
                                </Grid>
                            )}

                            {/* LAIZE (Tissu uniquement) */}
                            {typology === 'Tissu' && (
                                <Grid item xs={pieces.length > 0 ? 12 : 6}>
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

                    {/* 4. PROJET (TISSUS UNIQUEMENT) */}
                    {isIN && typology === 'Tissu' && (
                        <Box>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: '#6B7280', mb: 1, display: 'block' }}>
                                AFFECTATION DOSSIER (Requis pour Tissu)
                            </Typography>
                            <Autocomplete
                                fullWidth
                                options={projects.map(p => p.name || `Projet #${p.id}`)}
                                value={formData.project}
                                onChange={(e, val) => setFormData({ ...formData, project: val })}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        placeholder="Lie au projet..."
                                        sx={{ bgcolor: '#F9FAFB' }}
                                    />
                                )}
                            />
                        </Box>
                    )}

                    {/* 5. CONTEXTE */}
                    <Stack direction="row" spacing={2}>
                        <TextField select fullWidth label="Opérateur" value={user} onChange={(e) => setUser(e.target.value)} size="small">
                            {USERS.map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                        </TextField>
                        {!isIN && !isMOVE && (
                            <TextField select fullWidth label="Motif prédéfini" value={exitReason} onChange={(e) => setExitReason(e.target.value)} size="small">
                                {EXIT_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                            </TextField>
                        )}
                        <TextField
                            fullWidth
                            label="Détail personnalisé"
                            value={formData.customReason}
                            onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                            placeholder="Optionnel..."
                            size="small"
                        />
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
                        bgcolor: isIN ? '#10B981' : isMOVE ? '#3b82f6' : '#F97316',
                        fontWeight: 700,
                        px: 4,
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                        '&:hover': { bgcolor: isIN ? '#059669' : isMOVE ? '#2563eb' : '#EA580C' }
                    }}
                >
                    {isIN ? 'VALIDER ENTRÉE' : isMOVE ? 'VALIDER TRANSFERT' : 'CONFIRMER SORTIE'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
