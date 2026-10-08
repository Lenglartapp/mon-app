import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Search } from 'lucide-react';
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
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import LocationInput from './LocationInput';
import OperatorInput from './OperatorInput';
import LocationChips from './LocationChips';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';
import { DaField, ChoicePill } from '../../ui/DaForm';
import { TonePill } from '../../ui/ToolbarControls';
import { DA_FIELD_SX } from '../../../lib/constants/daStyles';
import { supabase } from '../../../lib/supabaseClient';

// Entrée / Sortie / Changement d'emplacement — aligné sur le modèle « réception » :
//  - fournisseur / référence / coloris / laize sont des champs à part ;
//  - les pièces ne portent que leur métrage ; l'emplacement est celui de l'article
//    (un ou plusieurs codes « B3, C1 ») ;
//  - sortie et déplacement visent un article précis du stock (par son id).

const EXIT_REASONS = ['Production', 'Déstockage', 'Perte', 'Envoi sous-traitant', 'SAV'];
const TYPOLOGIES = ['Tissu', 'Rail', 'Consommable', 'Mécanisme'];
const round2 = (n) => Math.round(n * 100) / 100;

// Recherche dans le stock : chaque mot tapé doit se retrouver quelque part (fournisseur,
// référence, coloris, produit, dossier, emplacement) — « dedar 03 b3 » trouve l'article.
const searchText = (it) => [it.fournisseur, it.ref, it.coloris, it.product, it.project, it.location, it.laize && `laize ${it.laize}`]
    .filter(Boolean).join(' ').toLowerCase();
const filterStock = (options, { inputValue }) => {
    const words = inputValue.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((it) => { const t = searchText(it); return words.every((w) => t.includes(w)); });
};
const MENU_PAPER_SX = { mt: 0.5, borderRadius: '8px', border: '1px solid #E0DED9', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' };

const EMPTY_FORM = { product: '', ref: '', coloris: '', laize: '', fournisseur: '', qty: '', unit: 'ml', project: '', customReason: '' };

// Liste de courses Odoo : type de produit → catégorie du stock.
const ODOO_TYPE_TO_CATEGORY = { tissu: 'Tissu', rail: 'Rail', mecanisme: 'Mécanisme', consommable: 'Consommable' };
// Recherche des articles répertoriés : tous les mots tapés doivent s'y retrouver.
const filterCatalogued = (options, { inputValue }) => {
    const words = inputValue.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return options;
    return options.filter((o) => { const t = o.search; return words.every((w) => t.includes(w)); });
};

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
    // Entrée : « répertorié » (tissu d'un dossier : liste de courses, matériauthèque, BPF) par
    // défaut, ou « non répertorié » (pièce ajoutée au stock sans lien avec une commande).
    const [catalogued, setCatalogued] = useState(true);
    const [courseLines, setCourseLines] = useState([]);

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
            setCatalogued(true);
            resetSelection('Tissu');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, type]);

    // Liste de courses Odoo (tous dossiers) : fournisseur / référence / coloris / laize déjà séparés.
    useEffect(() => {
        if (!open || !isIN) return undefined;
        let alive = true;
        supabase.from('odoo_course_lines')
            .select('odoo_id,droitfil_project_id,reference,coloris,laize,fournisseur,unite,quantite,type_produit,statut,date_reception,removed_from_odoo')
            .eq('removed_from_odoo', false)
            .then(({ data }) => { if (alive) setCourseLines(data || []); });
        return () => { alive = false; };
    }, [open, isIN]);

    const handleCataloguedChange = (v) => {
        setCatalogued(v);
        resetSelection(typology);
    };

    const handleTypologyChange = (t) => {
        setTypology(t);
        resetSelection(t);
    };

    // --- ENTRÉE RÉPERTORIÉE : SOURCE UNIQUE = liste de courses Odoo des dossiers actifs ---
    // Une seule source, pour que toutes les réceptions d'un même article portent exactement
    // les mêmes fournisseur / référence / coloris / laize (pas de variantes de nom venues
    // de la matériauthèque ou du BPF).
    const sourceOptionsIN = useMemo(() => {
        if (!isIN) return [];
        const projById = new Map(projects.map(p => [p.id, p]));
        return courseLines
            .filter(l => (ODOO_TYPE_TO_CATEGORY[l.type_produit] || 'Divers') === typology)
            .map(l => {
                const proj = projById.get(l.droitfil_project_id);
                if (!proj || proj.status === 'ARCHIVED') return null;
                const name = [l.reference, l.coloris].filter(Boolean).join(' — ');
                const o = {
                    key: l.odoo_id,
                    title: [l.fournisseur, name].filter(Boolean).join(' · ') || 'Article',
                    fournisseur: l.fournisseur || '', ref: l.reference || '', coloris: l.coloris || '', laize: l.laize || '',
                    product: name, project: proj.name || '', unit: typology === 'Tissu' ? 'ml' : (l.unite || 'u'),
                    ordered: l.quantite != null ? `${l.quantite} ${l.unite || ''}`.trim() : null,
                    received: !!l.date_reception,
                };
                o.search = [o.fournisseur, o.ref, o.coloris, o.project, o.laize && `laize ${o.laize}`].filter(Boolean).join(' ').toLowerCase();
                return o;
            })
            .filter(Boolean)
            .sort((a, b) => a.title.localeCompare(b.title) || a.project.localeCompare(b.project));
    }, [projects, isIN, typology, courseLines]);

    // --- SORTIE / DÉPLACEMENT : articles réellement en stock ---
    const stockOptions = useMemo(() => {
        if (isIN) return [];
        return inventory
            .filter(it => it.category === typology && Number(it.qty) > 0)
            .sort((a, b) => itemTitle(a).localeCompare(itemTitle(b)));
    }, [inventory, isIN, typology]);

    // Article répertorié choisi : fournisseur, référence, coloris, laize et dossier se remplissent.
    const handleSourceIN = (e, opt) => {
        setSourceOption(opt);
        if (!opt) { setFormData(prev => ({ ...EMPTY_FORM, unit: prev.unit })); return; }
        setFormData(prev => ({
            ...prev,
            product: opt.product || '',
            ref: opt.ref || '',
            coloris: opt.coloris || '',
            fournisseur: opt.fournisseur || '',
            laize: opt.laize || '',
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
        isIN ? (qty > 0 && !!(formData.product.trim() || formData.ref.trim() || formData.fournisseur.trim()))
            : isOUT ? (!!selectedItem && qty > 0 && qty <= Number(selectedItem.qty))
                : (!!selectedItem && locations.length > 0 && !moveUnchanged)
    );

    const handleSubmit = () => {
        if (!canSubmit) return;
        const base = { user: user.trim(), type, date: new Date().toISOString() };

        if (isIN) {
            // Libellé : celui de l'article répertorié, sinon « référence — coloris » (ou le fournisseur).
            const product = formData.product.trim() || [formData.ref.trim(), formData.coloris.trim()].filter(Boolean).join(' — ') || formData.fournisseur.trim();
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

    // DA : libellés gris AU-DESSUS des champs (DaField), champs fins sans titre intégré,
    // bleu nuit pour la sélection et la validation, intitulés en Roboto.
    const FONT = 'Roboto, system-ui, sans-serif';
    const sectionSx = { p: 2, border: '1px solid #E0DED9', borderRadius: '8px' };
    const sectionTitle = (t) => <Typography sx={{ fontSize: 15, fontWeight: 500, color: '#111827', fontFamily: FONT, mb: 1.5 }}>{t}</Typography>;
    const unitAdornment = (u) => (u ? { endAdornment: <InputAdornment position="end"><span style={{ color: '#6B7280', fontSize: 13 }}>{u}</span></InputAdornment> } : {});

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '12px', overflow: 'hidden', fontFamily: FONT } }}>
            <Box sx={{ px: 4, pt: 3, pb: 2, borderBottom: '1px solid #E8E6E2' }}>
                <Typography sx={{ fontSize: 24, fontWeight: 400, color: '#111827', fontFamily: FONT }}>
                    {isIN ? 'Réception de marchandise' : isMOVE ? "Changement d'emplacement" : 'Sortie de stock'}
                </Typography>
                <Typography sx={{ fontSize: 13, color: '#6B7280', mt: 0.5 }}>
                    {isIN ? 'Entrée en stock d’un article reçu' : isMOVE ? 'Déplacer un article vers un autre emplacement' : 'Retirer une quantité du stock'}
                </Typography>
            </Box>

            <DialogContent sx={{ p: 4 }}>
                <Stack spacing={3}>
                    {/* 1. CATÉGORIE */}
                    <DaField label="Catégorie">
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            {TYPOLOGIES.map(t => (
                                <ChoicePill key={t} active={typology === t} onClick={() => handleTypologyChange(t)}>{t}</ChoicePill>
                            ))}
                        </Stack>
                    </DaField>

                    {/* 2. ARTICLE */}
                    {isIN ? (
                        <Box sx={sectionSx}>
                            {sectionTitle('Article reçu')}
                            <Stack spacing={2}>
                                <Box>
                                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                    <ChoicePill active={catalogued} onClick={() => handleCataloguedChange(true)}>Répertorié</ChoicePill>
                                    <ChoicePill active={!catalogued} onClick={() => handleCataloguedChange(false)}>Non répertorié</ChoicePill>
                                </Stack>
                                <Typography sx={{ fontSize: 12, color: '#9B9A97', mt: 1 }}>
                                    {catalogued
                                        ? 'Article de la liste de courses Odoo d’un dossier : fournisseur, référence, coloris, laize et dossier se remplissent tout seuls.'
                                        : 'Pièce ajoutée au stock sans lien avec une commande ni un dossier.'}
                                </Typography>
                                </Box>
                                {catalogued && (
                                    <DaField label={typology === 'Tissu' ? 'Tissu répertorié' : `${typology} répertorié`}>
                                        <Autocomplete
                                            options={sourceOptionsIN}
                                            value={sourceOption}
                                            onChange={handleSourceIN}
                                            filterOptions={filterCatalogued}
                                            getOptionLabel={(o) => o.title || ''}
                                            isOptionEqualToValue={(a, b) => a.key === b.key}
                                            slotProps={{ paper: { sx: MENU_PAPER_SX }, listbox: { sx: { maxHeight: 360, p: 0.5 } } }}
                                            renderOption={(props, o) => {
                                                const { key, ...rest } = props;
                                                return (
                                                    <li key={o.key ?? key} {...rest} style={{ ...rest.style, borderRadius: 6, padding: '8px 10px', alignItems: 'center', gap: 12 }}>
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                                                            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                                                {o.project || 'Stock libre'}
                                                                {o.laize && <> · laize {o.laize}</>}
                                                                {o.received && <> · déjà réceptionné (Odoo)</>}
                                                            </div>
                                                        </Box>
                                                        {o.ordered && <TonePill tone={5}>{o.ordered}</TonePill>}
                                                    </li>
                                                );
                                            }}
                                            renderInput={(params) => (
                                                <TextField {...params} size="small" placeholder="Fournisseur, référence, coloris, dossier…" sx={DA_FIELD_SX}
                                                    InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><Search size={16} color="#9CA3AF" /></InputAdornment> }} />
                                            )}
                                            noOptionsText="Aucun article de liste de courses ne correspond — passe en « Non répertorié »."
                                        />
                                    </DaField>
                                )}
                                {(!catalogued || sourceOption) && (
                                    <>
                                        <Stack direction="row" spacing={1.5}>
                                            <Box sx={{ flex: 1 }}><DaField label="Fournisseur"><TextField fullWidth size="small" value={formData.fournisseur} onChange={(e) => setField('fournisseur', e.target.value)} sx={DA_FIELD_SX} /></DaField></Box>
                                            <Box sx={{ flex: 1 }}><DaField label="Référence"><TextField fullWidth size="small" value={formData.ref} onChange={(e) => setField('ref', e.target.value)} sx={DA_FIELD_SX} /></DaField></Box>
                                        </Stack>
                                        <Stack direction="row" spacing={1.5}>
                                            <Box sx={{ flex: 1 }}><DaField label="Coloris"><TextField fullWidth size="small" value={formData.coloris} onChange={(e) => setField('coloris', e.target.value)} sx={DA_FIELD_SX} /></DaField></Box>
                                            {typology === 'Tissu' && (
                                                <Box sx={{ width: 130 }}><DaField label="Laize"><TextField fullWidth size="small" value={formData.laize} onChange={(e) => setField('laize', e.target.value)} placeholder="ex. 140" sx={DA_FIELD_SX} /></DaField></Box>
                                            )}
                                        </Stack>
                                    </>
                                )}
                            </Stack>
                        </Box>
                    ) : (
                        <DaField label="Article en stock">
                            <Autocomplete
                                options={stockOptions}
                                value={selectedItem}
                                onChange={handleSourceStock}
                                filterOptions={filterStock}
                                getOptionLabel={(it) => itemTitle(it)}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                slotProps={{ paper: { sx: MENU_PAPER_SX }, listbox: { sx: { maxHeight: 360, p: 0.5 } } }}
                                renderOption={(props, it) => {
                                    const { key, ...rest } = props;
                                    const locs = splitLocations(it.location).filter(l => l !== LOC_A_COMPLETER);
                                    return (
                                        <li key={it.id ?? key} {...rest} style={{ ...rest.style, borderRadius: 6, padding: '8px 10px', alignItems: 'center', gap: 12 }}>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontSize: 14, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{itemTitle(it)}</div>
                                                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                                                    {it.project || 'Stock libre'}
                                                    {locs.length > 0 && <> · {locs.join(', ')}</>}
                                                    {it.laize && <> · laize {it.laize}</>}
                                                    {Array.isArray(it.pieces) && it.pieces.length > 0 && <> · {it.pieces.length} pièce{it.pieces.length > 1 ? 's' : ''}</>}
                                                </div>
                                            </Box>
                                            <TonePill tone={5}>{it.qty} {it.unit || ''}</TonePill>
                                        </li>
                                    );
                                }}
                                renderInput={(params) => (
                                    <TextField {...params} size="small" placeholder="Fournisseur, référence, coloris, dossier, emplacement…" sx={DA_FIELD_SX}
                                        InputProps={{ ...params.InputProps, startAdornment: <InputAdornment position="start"><Search size={16} color="#9CA3AF" /></InputAdornment> }} />
                                )}
                                noOptionsText="Aucun article en stock ne correspond."
                            />
                            {selectedItem && (
                                <Box sx={{ mt: 1.5, p: 1.5, bgcolor: '#F4F4F4', borderRadius: '8px' }}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                                        <TonePill tone={0}>Stock : {selectedItem.qty} {selectedItem.unit || ''}</TonePill>
                                        {Array.isArray(selectedItem.pieces) && selectedItem.pieces.length > 0 && (
                                            <TonePill tone={5}>{selectedItem.pieces.length} pièce{selectedItem.pieces.length > 1 ? 's' : ''}</TonePill>
                                        )}
                                        <TonePill tone={5}>{selectedItem.project || 'Stock libre'}</TonePill>
                                        {selectedItem.laize && <TonePill tone={5}>Laize {selectedItem.laize}</TonePill>}
                                        <LocationChips value={selectedItem.location} />
                                    </Stack>
                                    {selectedIsToComplete && (
                                        <Typography sx={{ display: 'block', mt: 1, fontSize: 12, color: '#374151', fontWeight: 500 }}>
                                            Réception pas encore rangée (pièces et emplacement à compléter dans l’État du stock).
                                        </Typography>
                                    )}
                                </Box>
                            )}
                        </DaField>
                    )}

                    {/* 3. QUANTITÉ */}
                    {usesInPieces && (
                        <Box sx={sectionSx}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                <Typography sx={{ fontSize: 15, fontWeight: 500, color: '#111827', fontFamily: FONT }}>Composition par pièce</Typography>
                                <Button size="small" startIcon={<Plus size={14} />} onClick={addPiece} sx={{ textTransform: 'none', fontWeight: 600, color: '#1E2447' }}>Ajouter une pièce</Button>
                            </Box>
                            <Stack spacing={1}>
                                {pieces.map((p, idx) => (
                                    <Box key={p.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                                        <Typography sx={{ color: '#374151', fontSize: 13, fontWeight: 500, minWidth: 80 }}>Pièce {existingPiecesCount + idx + 1}</Typography>
                                        <TextField size="small" type="number" value={p.qty} onChange={(e) => setPieceQty(p.id, e.target.value)} sx={{ ...DA_FIELD_SX, width: 130 }} InputProps={unitAdornment('ml')} />
                                        <Box sx={{ flex: 1 }} />
                                        <IconButton size="small" onClick={() => removePiece(p.id)} disabled={pieces.length <= 1} sx={{ color: '#6B7280' }}><Minus size={16} /></IconButton>
                                    </Box>
                                ))}
                            </Stack>
                            <Typography sx={{ mt: 1.5, fontSize: 13, color: '#6B7280' }}>Total : <b style={{ color: '#111827' }}>{inPiecesTotal}</b> ml</Typography>
                        </Box>
                    )}

                    {((isIN && !usesInPieces) || (isOUT && selectedItem && !usesOutPieces)) && (
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                            <Box sx={{ flex: 1 }}>
                                <DaField label={isOUT ? 'Quantité à sortir' : 'Quantité'}
                                    hint={isOUT ? (qty > Number(selectedItem?.qty) ? `Dépasse le stock disponible (${selectedItem.qty} ${selectedItem.unit || ''}).` : `Disponible : ${selectedItem.qty} ${selectedItem.unit || ''}`) : undefined}>
                                    <TextField
                                        fullWidth size="small" type="number" value={formData.qty}
                                        onChange={(e) => setField('qty', e.target.value)}
                                        error={isOUT && qty > Number(selectedItem?.qty)}
                                        sx={DA_FIELD_SX}
                                        InputProps={{ ...(isOUT ? unitAdornment(selectedItem?.unit) : {}), sx: { fontSize: 16, fontWeight: 600 } }}
                                    />
                                </DaField>
                            </Box>
                            {isIN && (
                                <Box sx={{ width: 120 }}>
                                    <DaField label="Unité">
                                        <TextField select fullWidth size="small" value={formData.unit} onChange={(e) => setField('unit', e.target.value)} sx={DA_FIELD_SX}>
                                            {['ml', 'm2', 'u', 'kg'].map(u => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                                        </TextField>
                                    </DaField>
                                </Box>
                            )}
                        </Stack>
                    )}

                    {usesOutPieces && (
                        <Box sx={sectionSx}>
                            {sectionTitle('Reste en stock par pièce')}
                            <Stack spacing={1}>
                                {pieces.map(p => {
                                    const changed = Number(p.p_qty) !== Number(p.qty);
                                    return (
                                        <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 1, pl: 1.5, bgcolor: changed ? '#EEF4FD' : 'white', borderRadius: '8px', border: '1px solid #E8E6E2' }}>
                                            <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 500, color: '#111827' }}>{p.name}</Typography>
                                            <Box sx={{ textAlign: 'right', minWidth: 70 }}>
                                                <Typography sx={{ fontSize: 11, color: '#9B9A97' }}>Initial</Typography>
                                                <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{p.qty} {selectedItem.unit || 'ml'}</Typography>
                                            </Box>
                                            <Box sx={{ width: 120 }}>
                                                <Typography sx={{ fontSize: 11, color: '#9B9A97', mb: 0.25 }}>Reste</Typography>
                                                <TextField
                                                    size="small" type="number" value={p.p_qty}
                                                    onChange={(e) => setPieceRemaining(p.id, e.target.value)}
                                                    sx={{ ...DA_FIELD_SX, width: 120 }}
                                                    InputProps={{ ...unitAdornment(selectedItem.unit || 'ml'), sx: { fontWeight: 600 } }}
                                                />
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Stack>
                            <Typography sx={{ mt: 1.5, fontSize: 13, color: '#6B7280' }}>
                                Consommation : <b style={{ color: '#111827' }}>{outConsumed}</b> {selectedItem.unit || 'ml'} — saisis ce qu’il reste sur chaque pièce (0 = pièce terminée).
                            </Typography>
                        </Box>
                    )}

                    {/* 4. EMPLACEMENT + AFFECTATION (entrée) / NOUVEL EMPLACEMENT (déplacement) */}
                    {isIN && (
                        <Box sx={sectionSx}>
                            {sectionTitle('Rangement et affectation')}
                            <Stack spacing={2}>
                                <DaField label="Emplacement de la réception">
                                    <LocationInput value={locations} onChange={setLocations} zones={zones} label={null} fieldSx={DA_FIELD_SX} />
                                </DaField>
                                <DaField label={typology === 'Tissu' ? 'Affectation dossier' : 'Affectation dossier (optionnel)'}>
                                    <Autocomplete
                                        options={projects.map(p => p.name || `Projet #${p.id}`)}
                                        value={formData.project || null}
                                        onChange={(e, val) => setField('project', val || '')}
                                        slotProps={{ paper: { sx: MENU_PAPER_SX } }}
                                        renderInput={(params) => <TextField {...params} size="small" placeholder="Choisir un dossier…" sx={DA_FIELD_SX} />}
                                    />
                                </DaField>
                            </Stack>
                        </Box>
                    )}

                    {isMOVE && selectedItem && (
                        <DaField label="Nouvel emplacement (toute la réception)"
                            hint={moveUnchanged ? 'Identique à l’emplacement actuel.' : 'Plusieurs codes possibles si le rangement est réparti.'}>
                            <LocationInput value={locations} onChange={setLocations} zones={zones} label={null} fieldSx={DA_FIELD_SX} />
                        </DaField>
                    )}

                    {isOUT && selectedItem && (
                        <Typography sx={{ fontSize: 13, color: '#374151', bgcolor: '#EEF4FD', borderRadius: '8px', px: 1.5, py: 1 }}>
                            Sortie depuis <b>{splitLocations(selectedItem.location).filter(l => l !== LOC_A_COMPLETER).join(', ') || 'sans emplacement'}</b> — {selectedItem.project || 'Stock libre'}
                        </Typography>
                    )}

                    {/* 5. CONTEXTE : opérateur (pleine largeur), motif en pastilles, détail */}
                    <DaField label="Opérateur">
                        <OperatorInput value={user} onChange={setUser} label={null} fieldSx={DA_FIELD_SX} />
                    </DaField>
                    {isOUT && (
                        <DaField label="Motif">
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                                {EXIT_REASONS.map(r => <ChoicePill key={r} active={exitReason === r} onClick={() => setExitReason(r)}>{r}</ChoicePill>)}
                            </Stack>
                        </DaField>
                    )}
                    <DaField label="Détail (optionnel)">
                        <TextField fullWidth size="small" value={formData.customReason} onChange={(e) => setField('customReason', e.target.value)} placeholder={isOUT ? 'ex. dossier, sous-traitant, n° de SAV…' : 'Précision éventuelle…'} sx={DA_FIELD_SX} />
                    </DaField>
                </Stack>
            </DialogContent>

            <DialogActions sx={{ px: 4, py: 2.5, borderTop: '1px solid #E8E6E2', bgcolor: 'white', justifyContent: 'flex-end', gap: 1 }}>
                <Button onClick={onClose} sx={{ color: '#374151', textTransform: 'none', fontWeight: 600, border: '1px solid #E0DED9', borderRadius: '8px', px: 2, height: 38 }}>Annuler</Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={!canSubmit}
                    disableElevation
                    sx={{
                        bgcolor: '#1E2447', textTransform: 'none', fontWeight: 600, px: 3, borderRadius: '8px', height: 38,
                        '&:hover': { bgcolor: '#2A3260' }
                    }}
                >
                    {isIN ? "Valider l'entrée" : isMOVE ? 'Valider le transfert' : 'Confirmer la sortie'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
