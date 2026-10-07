import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus } from 'lucide-react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Autocomplete from '@mui/material/Autocomplete';
import Stack from '@mui/material/Stack';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Alert from '@mui/material/Alert';
import LocationInput from './LocationInput';
import OperatorInput from './OperatorInput';
import LocationChips from './LocationChips';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';

// Entrée / Sortie / Changement d'emplacement — aligné sur le modèle « réception » :
//  - fournisseur / référence / coloris / laize sont des champs à part ;
//  - les pièces ne portent que leur métrage ; l'emplacement est celui de l'article
//    (un ou plusieurs codes « B3, C1 ») ;
//  - sortie et déplacement visent un article précis du stock (par son id).

const EXIT_REASONS = ['Production', 'Solde / Déstockage', 'Perte / Inventaire', 'Autre'];
const TYPOLOGIES = ['Tissu', 'Rail', 'Consommable', 'Mécanisme'];
const round2 = (n) => Math.round(n * 100) / 100;

const EMPTY_FORM = { product: '', ref: '', coloris: '', laize: '', fournisseur: '', qty: '', unit: 'ml', project: '', customReason: '' };

/** « DEDAR · SALINGER — 03 » : libellé lisible d'un article du stock. */
const itemTitle = (it) => {
    const name = it.ref ? [it.ref, it.coloris].filter(Boolean).join(' — ') : it.product;
    return [it.fournisseur, name].filter(Boolean).join(' · ');
};

export default function MovementModal({ open, onClose, type, onSave, projects = [], inventory = [], zones = [] }) {
    const isIN = type === 'IN';
    const isMOVE = type === 'MOVE';
    const isOUT = type === 'OUT';

    const [user, setUser] = useState('');
    const [typology, setTypology] = useState('Tissu');
    const [exitReason, setExitReason] = useState('Production');
    const [selectedItem, setSelectedItem] = useState(null); // article du stock (sortie / déplacement)
    const [sourceOption, setSourceOption] = useState(null); // suggestion choisie (entrée)
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [locations, setLocations] = useState([]);
    const [pieces, setPieces] = useState([]); // entrée : [{id, qty}] — sortie : [{id, name, qty, p_qty}]
    const [existingPiecesCount, setExistingPiecesCount] = useState(0);

    const setField = (k, v) => setFormData(prev => ({ ...prev, [k]: v }));

    const resetSelection = (t) => {
        setSelectedItem(null);
        setSourceOption(null);
        setExistingPiecesCount(0);
        setLocations([]);
        setFormData({ ...EMPTY_FORM, unit: t === 'Tissu' ? 'ml' : 'u' });
        setPieces(isIN && t === 'Tissu' ? [{ id: Date.now(), qty: '' }] : []);
    };

    useEffect(() => {
        if (open) {
            setTypology('Tissu');
            setExitReason('Production');
            resetSelection('Tissu');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, type]);

    const handleTypologyChange = (t) => {
        setTypology(t);
        resetSelection(t);
    };

    // --- ENTRÉE : suggestions (tissus des dossiers actifs, ou articles déjà connus) ---
    const sourceOptionsIN = useMemo(() => {
        if (!isIN) return [];
        const optsMap = new Map();
        if (typology === 'Tissu') {
            projects.filter(p => p.status !== 'ARCHIVED').forEach(proj => {
                (proj.rows || []).forEach(row => {
                    const add = (name, width) => {
                        if (!name) return;
                        const label = `${name} (${proj.name})`;
                        if (!optsMap.has(label)) optsMap.set(label, { label, product: name, laize: width || '', project: proj.name });
                    };
                    add(row.tissu_deco1, row.laize_tissu1 || row.laize_tissu_deco1);
                    add(row.tissu_deco2, row.laize_tissu2);
                    add(row.doublure, row.laize_doublure);
                });
            });
        } else {
            inventory.filter(it => it.category === typology).forEach(it => {
                const label = itemTitle(it);
                if (!optsMap.has(label)) optsMap.set(label, { label, product: it.product, ref: it.ref, coloris: it.coloris, fournisseur: it.fournisseur, unit: it.unit, project: '' });
            });
        }
        return Array.from(optsMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [projects, inventory, isIN, typology]);

    // --- SORTIE / DÉPLACEMENT : articles réellement en stock ---
    const stockOptions = useMemo(() => {
        if (isIN) return [];
        return inventory
            .filter(it => it.category === typology && Number(it.qty) > 0)
            .sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)));
    }, [inventory, isIN, typology]);

    const handleSourceIN = (e, opt) => {
        setSourceOption(opt);
        if (!opt || typeof opt === 'string') return;
        setFormData(prev => ({
            ...prev,
            product: opt.product || '',
            ref: opt.ref || prev.ref,
            coloris: opt.coloris || prev.coloris,
            fournisseur: opt.fournisseur || prev.fournisseur,
            laize: opt.laize || prev.laize,
            project: opt.project || '',
            unit: typology === 'Tissu' ? 'ml' : (opt.unit || 'u'),
        }));
        if (typology === 'Tissu') {
            const existing = inventory.find(i => i.product === opt.product && (i.project || '') === (opt.project || ''));
            setExistingPiecesCount(Array.isArray(existing?.pieces) ? existing.pieces.length : 0);
        }
    };

    const handleSourceStock = (e, item) => {
        setSelectedItem(item);
        if (!item) { setPieces([]); setLocations([]); return; }
        setFormData(prev => ({ ...prev, qty: '', unit: item.unit || 'ml' }));
        setPieces(isOUT && Array.isArray(item.pieces)
            ? item.pieces.map((p, i) => ({ id: p.id ?? i + 1, name: p.name || `Pièce ${i + 1}`, qty: Number(p.qty) || 0, p_qty: Number(p.qty) || 0 }))
            : []);
        setLocations(splitLocations(item.location).filter(l => l !== LOC_A_COMPLETER));
    };

    // Pièces
    const addPiece = () => setPieces(prev => [...prev, { id: Date.now(), qty: '' }]);
    const removePiece = (id) => setPieces(prev => prev.filter(p => p.id !== id));
    const setPieceQty = (id, v) => setPieces(prev => prev.map(p => (p.id === id ? { ...p, qty: v } : p)));
    const setPieceRemaining = (id, v) => setPieces(prev => prev.map(p => (p.id === id ? { ...p, p_qty: v } : p)));

    const inPiecesTotal = round2(pieces.reduce((s, p) => s + (Number(p.qty) || 0), 0));
    const outConsumed = round2(pieces.reduce((s, p) => s + Math.max(0, Number(p.qty) - Number(p.p_qty === '' ? p.qty : p.p_qty)), 0));
    const usesInPieces = isIN && typology === 'Tissu';
    const usesOutPieces = isOUT && pieces.length > 0;
    const qty = usesInPieces ? inPiecesTotal : usesOutPieces ? outConsumed : Number(formData.qty) || 0;

    const selectedIsToComplete = selectedItem && splitLocations(selectedItem.location).includes(LOC_A_COMPLETER);
    const newLocation = locations.join(', ');
    const moveUnchanged = isMOVE && selectedItem && newLocation === splitLocations(selectedItem.location).join(', ');

    const canSubmit = !!user.trim() && (
        isIN ? (qty > 0 && !!(formData.product.trim() || formData.ref.trim()))
            : isOUT ? (!!selectedItem && qty > 0 && qty <= Number(selectedItem.qty))
                : (!!selectedItem && locations.length > 0 && !moveUnchanged)
    );

    const handleSubmit = () => {
        if (!canSubmit) return;
        const base = { user: user.trim(), type, date: new Date().toISOString() };

        if (isIN) {
            const product = formData.product.trim() || [formData.ref.trim(), formData.coloris.trim()].filter(Boolean).join(' — ');
            onSave({
                ...base,
                product,
                ref: formData.ref.trim(), coloris: formData.coloris.trim(), laize: formData.laize, fournisseur: formData.fournisseur.trim(),
                qty, unit: formData.unit, project: formData.project || '', category: typology,
                location: newLocation,
                reason: formData.customReason || null,
                // Pièces = métrage seul ; l'emplacement est celui de la réception
                pieces: usesInPieces
                    ? pieces.filter(p => Number(p.qty) > 0).map((p, idx) => ({ id: p.id, qty: Number(p.qty), name: `Pièce ${existingPiecesCount + idx + 1}` }))
                    : [],
            });
        } else {
            const it = selectedItem;
            onSave({
                ...base,
                item_id: it.id,
                product: it.product, unit: it.unit, category: it.category, project: it.project || '',
                qty: isMOVE ? Number(it.qty) : qty,
                location: isMOVE ? newLocation : it.location,
                from_location: isMOVE ? it.location : null,
                reason: formData.customReason || (isOUT ? exitReason : null),
                pieces: usesOutPieces ? pieces.map(p => ({ id: p.id, name: p.name, qty: p.qty, p_qty: Number(p.p_qty === '' ? p.qty : p.p_qty) })) : [],
            });
        }
        onClose();
    };

    // DA : pas de bandeau coloré, bleu nuit pour la sélection et la validation, intitulés en Roboto
    const headerColor = '#1E2447';
    const sectionSx = { p: 2, border: '1px solid #E0DED9', borderRadius: '8px' };
    const captionSx = { fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'Roboto, system-ui, sans-serif', mb: 1.5, display: 'block' };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px', overflow: 'hidden' } }}>
            <Box sx={{ px: 4, pt: 3, pb: 2, borderBottom: '1px solid #E8E6E2' }}>
                <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#111827', fontFamily: 'Roboto, system-ui, sans-serif' }}>
                    {isIN ? 'Réception de marchandise' : isMOVE ? "Changement d'emplacement" : 'Sortie de stock'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.5 }}>
                    {isIN ? 'Entrée en stock d’un article reçu' : isMOVE ? 'Déplacer un article vers un autre emplacement' : 'Retirer une quantité du stock'}
                </Typography>
            </Box>

            <DialogContent sx={{ p: 4 }}>
                <Stack spacing={3}>
                    {/* 1. CATÉGORIE */}
                    <Box>
                        <Typography variant="caption" sx={captionSx}>Catégorie</Typography>
                        <Stack direction="row" spacing={1}>
                            {TYPOLOGIES.map(t => (
                                <Button
                                    key={t}
                                    size="small"
                                    variant={typology === t ? 'contained' : 'outlined'}
                                    onClick={() => handleTypologyChange(t)}
                                    disableElevation
                                    sx={{
                                        borderRadius: 99, fontWeight: 500, textTransform: 'none', px: 2,
                                        bgcolor: typology === t ? headerColor : 'white',
                                        color: typology === t ? 'white' : '#374151',
                                        borderColor: typology === t ? headerColor : '#E0DED9',
                                        '&:hover': { bgcolor: typology === t ? headerColor : '#F4F4F4', borderColor: typology === t ? headerColor : '#E0DED9' }
                                    }}
                                >
                                    {t}
                                </Button>
                            ))}
                        </Stack>
                    </Box>

                    {/* 2. ARTICLE */}
                    {isIN ? (
                        <Box sx={sectionSx}>
                            <Typography variant="caption" sx={captionSx}>Article reçu</Typography>
                            <Stack spacing={1.5}>
                                <Autocomplete
                                    freeSolo
                                    options={sourceOptionsIN}
                                    getOptionLabel={(o) => (typeof o === 'string' ? o : o.label || '')}
                                    value={sourceOption}
                                    onChange={handleSourceIN}
                                    onInputChange={(e, val, reason) => { if (reason === 'input') setField('product', val); }}
                                    renderInput={(params) => (
                                        <TextField {...params} size="small" label={typology === 'Tissu' ? '🔍 Tissu d’un dossier (ou saisie libre)' : `🔍 ${typology} déjà connu (ou saisie libre)`} sx={{ bgcolor: '#F4F4F4' }} />
                                    )}
                                />
                                <Stack direction="row" spacing={1}>
                                    <TextField size="small" label="Fournisseur" value={formData.fournisseur} onChange={(e) => setField('fournisseur', e.target.value)} sx={{ flex: 1 }} />
                                    <TextField size="small" label="Référence" value={formData.ref} onChange={(e) => setField('ref', e.target.value)} sx={{ flex: 1 }} />
                                </Stack>
                                <Stack direction="row" spacing={1}>
                                    <TextField size="small" label="Coloris" value={formData.coloris} onChange={(e) => setField('coloris', e.target.value)} sx={{ flex: 1 }} />
                                    {typology === 'Tissu' && (
                                        <TextField size="small" label="Laize" value={formData.laize} onChange={(e) => setField('laize', e.target.value)} sx={{ width: 120 }} placeholder="ex. 140" />
                                    )}
                                </Stack>
                                <TextField
                                    size="small" label="Libellé produit" value={formData.product}
                                    onChange={(e) => setField('product', e.target.value)}
                                    placeholder={formData.ref ? `auto : ${[formData.ref, formData.coloris].filter(Boolean).join(' — ')}` : ''}
                                    InputLabelProps={formData.ref ? { shrink: true } : undefined}
                                />
                            </Stack>
                        </Box>
                    ) : (
                        <Box>
                            <Autocomplete
                                options={stockOptions}
                                value={selectedItem}
                                onChange={handleSourceStock}
                                getOptionLabel={(it) => itemTitle(it)}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                renderOption={(props, it) => (
                                    <li {...props} key={it.id}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                            <span style={{ fontWeight: 600 }}>{itemTitle(it)}</span>
                                            <span style={{ fontSize: 12, color: '#6B7280' }}>
                                                {it.qty} {it.unit} · {it.project || 'Stock libre'} · {splitLocations(it.location).join(', ') || 'sans emplacement'}
                                            </span>
                                        </Box>
                                    </li>
                                )}
                                renderInput={(params) => <TextField {...params} label="🔍 Rechercher dans le stock (fournisseur, réf, coloris…)" sx={{ bgcolor: '#F4F4F4' }} />}
                                noOptionsText="Aucun article en stock dans cette catégorie."
                            />
                            {selectedItem && (
                                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#F4F4F4', borderRadius: '8px' }}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <Chip size="small" label={`Stock : ${selectedItem.qty} ${selectedItem.unit || ''}`} sx={{ bgcolor: '#1E2447', color: 'white', fontWeight: 600 }} />
                                        {Array.isArray(selectedItem.pieces) && selectedItem.pieces.length > 0 && (
                                            <Chip size="small" variant="outlined" label={`${selectedItem.pieces.length} pièce(s)`} />
                                        )}
                                        <Chip size="small" variant="outlined" label={selectedItem.project || 'Stock libre'} />
                                        {selectedItem.laize && <Chip size="small" variant="outlined" label={`Laize ${selectedItem.laize}`} />}
                                        <LocationChips value={selectedItem.location} />
                                    </Stack>
                                    {selectedIsToComplete && (
                                        <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#9A3412', fontWeight: 600 }}>
                                            Réception pas encore rangée (pièces et emplacement à compléter dans l’État du stock).
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </Box>
                    )}

                    {/* 3. QUANTITÉ */}
                    {usesInPieces && (
                        <Box sx={sectionSx}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                <Typography variant="caption" sx={{ ...captionSx, mb: 0 }}>Composition par pièce</Typography>
                                <Button size="small" startIcon={<Plus size={14} />} onClick={addPiece} sx={{ textTransform: 'none', fontWeight: 700 }}>Ajouter une pièce</Button>
                            </Box>
                            <Stack spacing={1}>
                                {pieces.map((p, idx) => (
                                    <Box key={p.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <Typography variant="body2" sx={{ color: '#374151', fontWeight: 600, minWidth: 80 }}>Pièce {existingPiecesCount + idx + 1}</Typography>
                                        <TextField size="small" type="number" value={p.qty} onChange={(e) => setPieceQty(p.id, e.target.value)} placeholder="ml" sx={{ width: 110, bgcolor: 'white' }} />
                                        <Box sx={{ flex: 1 }} />
                                        <IconButton size="small" color="error" onClick={() => removePiece(p.id)} disabled={pieces.length <= 1}><Minus size={16} /></IconButton>
                                    </Box>
                                ))}
                            </Stack>
                            <Typography variant="body2" sx={{ mt: 1, color: '#6B7280' }}>Total : <b>{inPiecesTotal}</b> ml</Typography>
                        </Box>
                    )}

                    {((isIN && !usesInPieces) || (isOUT && selectedItem && !usesOutPieces)) && (
                        <Box sx={sectionSx}>
                            <Typography variant="caption" sx={captionSx}>{isOUT ? 'Quantité à sortir' : 'Quantité'}</Typography>
                            <Stack direction="row" spacing={1}>
                                <TextField
                                    fullWidth label="Quantité" type="number" value={formData.qty}
                                    onChange={(e) => setField('qty', e.target.value)}
                                    error={isOUT && qty > Number(selectedItem?.qty)}
                                    helperText={isOUT && qty > Number(selectedItem?.qty) ? `Stock disponible : ${selectedItem.qty} ${selectedItem.unit || ''}` : ' '}
                                    InputProps={{ sx: { fontSize: 18, fontWeight: 700 } }}
                                />
                                {isIN ? (
                                    <TextField select label="Unité" value={formData.unit} onChange={(e) => setField('unit', e.target.value)} sx={{ width: 110 }}>
                                        {['ml', 'm2', 'u', 'kg'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                    </TextField>
                                ) : (
                                    <TextField label="Unité" value={selectedItem?.unit || ''} disabled sx={{ width: 110 }} />
                                )}
                            </Stack>
                        </Box>
                    )}

                    {usesOutPieces && (
                        <Box sx={sectionSx}>
                            <Typography variant="caption" sx={captionSx}>Reste en stock par pièce</Typography>
                            <Stack spacing={1}>
                                {pieces.map(p => {
                                    const changed = Number(p.p_qty) !== Number(p.qty);
                                    return (
                                        <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, bgcolor: 'white', borderRadius: 2, border: '1px solid #E5E7EB' }}>
                                            <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700, color: '#4B5563' }}>{p.name}</Typography>
                                            <Box sx={{ textAlign: 'right', minWidth: 70 }}>
                                                <Typography sx={{ fontSize: 11, color: '#9CA3AF' }}>Initial</Typography>
                                                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{p.qty} {selectedItem.unit || 'ml'}</Typography>
                                            </Box>
                                            <TextField
                                                size="small" label="Reste" type="number" value={p.p_qty}
                                                onChange={(e) => setPieceRemaining(p.id, e.target.value)}
                                                sx={{ width: 110 }}
                                                InputProps={{ sx: { fontWeight: 700, bgcolor: changed ? '#EEF4FD' : 'white' } }}
                                            />
                                        </Box>
                                    );
                                })}
                            </Stack>
                            <Typography variant="body2" sx={{ mt: 1.5, color: '#6B7280' }}>
                                Consommation : <b>{outConsumed}</b> {selectedItem.unit || 'ml'} — saisis ce qu’il reste sur chaque pièce (0 = pièce terminée).
                            </Typography>
                        </Box>
                    )}

                    {/* 4. EMPLACEMENT + AFFECTATION (entrée) / NOUVEL EMPLACEMENT (déplacement) */}
                    {isIN && (
                        <Box sx={sectionSx}>
                            <Typography variant="caption" sx={captionSx}>Rangement et affectation</Typography>
                            <Stack spacing={1.5}>
                                <LocationInput value={locations} onChange={setLocations} zones={zones} label="Emplacement de la réception" />
                                <Autocomplete
                                    options={projects.map(p => p.name || `Projet #${p.id}`)}
                                    value={formData.project || null}
                                    onChange={(e, val) => setField('project', val || '')}
                                    renderInput={(params) => <TextField {...params} size="small" label={typology === 'Tissu' ? 'Affectation dossier' : 'Affectation dossier (optionnel)'} />}
                                />
                            </Stack>
                        </Box>
                    )}

                    {isMOVE && selectedItem && (
                        <Box sx={sectionSx}>
                            <Typography variant="caption" sx={captionSx}>Nouvel emplacement (toute la réception)</Typography>
                            <LocationInput
                                value={locations}
                                onChange={setLocations}
                                zones={zones}
                                label="Emplacement(s)"
                                required
                                helperText={moveUnchanged ? 'Identique à l’emplacement actuel.' : 'Plusieurs codes possibles si le rangement est réparti.'}
                            />
                        </Box>
                    )}

                    {isOUT && selectedItem && (
                        <Alert severity="info" icon={false} sx={{ py: 0 }}>
                            Sortie depuis <b>{splitLocations(selectedItem.location).join(', ') || 'sans emplacement'}</b> — {selectedItem.project || 'Stock libre'}
                        </Alert>
                    )}

                    {/* 5. CONTEXTE */}
                    <Stack direction="row" spacing={2}>
                        <OperatorInput value={user} onChange={setUser} sx={{ flex: 1 }} />
                        {isOUT && (
                            <TextField select fullWidth label="Motif" value={exitReason} onChange={(e) => setExitReason(e.target.value)} size="small">
                                {EXIT_REASONS.map(r => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                            </TextField>
                        )}
                        <TextField fullWidth label="Détail personnalisé" value={formData.customReason} onChange={(e) => setField('customReason', e.target.value)} placeholder="Optionnel..." size="small" />
                    </Stack>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 4, py: 2.5, borderTop: '1px solid #E8E6E2', bgcolor: 'white', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={onClose} sx={{ color: '#374151', textTransform: 'none', fontWeight: 600, border: '1px solid #E5E7EB', borderRadius: '8px', px: 2 }}>Annuler</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    disableElevation
                    sx={{
                        bgcolor: '#1E2447', textTransform: 'none', fontWeight: 600, px: 3, borderRadius: '8px',
                        '&:hover': { bgcolor: '#2A3260' }
                    }}
                >
                    {isIN ? "Valider l'entrée" : isMOVE ? 'Valider le transfert' : 'Confirmer la sortie'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
