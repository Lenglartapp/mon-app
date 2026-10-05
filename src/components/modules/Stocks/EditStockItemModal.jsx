import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Stack, IconButton, Box, Typography, Divider, Alert } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Close as CloseIcon } from '@mui/icons-material';
import { LOC_A_COMPLETER, splitLocations } from '../../../lib/inventory/stockFields';
import LocationInput from './LocationInput';
import OperatorInput from './OperatorInput';

// Édition d'un article de stock au double-clic — sert aussi à COMPLÉTER une réception Odoo :
// détail des pièces (métrage seul) + UN emplacement pour toute la réception (éventuellement
// plusieurs codes « B3, C1 » faute de place). La quantité totale = somme des pièces.
// La ligne d'entrée Odoo du journal n'est jamais touchée.

const CATEGORIES = ['Tissu', 'Rail', 'Consommable', 'Mécanisme', 'Divers'];
const round2 = (n) => Math.round(n * 100) / 100;

export default function EditStockItemModal({ item, zones = [], onClose, onSave }) {
  const isToComplete = splitLocations(item.location).includes(LOC_A_COMPLETER);
  const received = item.qty_recue ?? (isToComplete ? item.qty : null);
  const itemPieces = Array.isArray(item.pieces) ? item.pieces : [];

  const [product, setProduct] = useState(item.product || '');
  const [fournisseur, setFournisseur] = useState(item.fournisseur || '');
  const [ref, setRef] = useState(item.ref || '');
  const [coloris, setColoris] = useState(item.coloris || '');
  const [category, setCategory] = useState(CATEGORIES.includes(item.category) ? item.category : 'Tissu');
  const [laize, setLaize] = useState(item.laize || '');
  const [unit, setUnit] = useState(item.unit || '');
  const [project, setProject] = useState(item.project || '');
  // Emplacement de la réception. Anciens articles rangés « par pièce » : on remonte leurs emplacements.
  const [locations, setLocations] = useState(() => {
    const own = splitLocations(item.location).filter((l) => l !== LOC_A_COMPLETER);
    const fromPieces = itemPieces.map((p) => p.location).filter(Boolean);
    return [...new Set([...own, ...fromPieces])];
  });
  const [operator, setOperator] = useState('');
  const [manualQty, setManualQty] = useState(item.qty ?? 0);
  const [pieces, setPieces] = useState(() => {
    if (itemPieces.length) return itemPieces.map((p, i) => ({ id: p.id ?? i + 1, qty: p.qty ?? '' }));
    return isToComplete ? [{ id: Date.now(), qty: '' }] : [];
  });
  const [saving, setSaving] = useState(false);

  const hasPieces = pieces.length > 0;
  // Seules les pièces renseignées comptent : une ligne vide ne remet pas le stock à 0.
  const filledPieces = pieces.filter((p) => Number(p.qty) > 0);
  const totalQty = round2(filledPieces.length ? filledPieces.reduce((s, p) => s + Number(p.qty), 0) : Number(manualQty || 0));
  const ecart = received != null && filledPieces.length ? round2(totalQty - Number(received)) : null;

  const addPiece = () => setPieces((prev) => [...prev, { id: Date.now(), qty: '' }]);
  const removePiece = (id) => setPieces((prev) => prev.filter((p) => p.id !== id));
  const setPieceQty = (id, v) => setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, qty: v } : p)));

  const save = async () => {
    setSaving(true);
    const cleanPieces = filledPieces
      .map((p, idx) => ({ id: p.id, qty: Number(p.qty), name: `Pièce ${idx + 1}` }));
    // Tant qu'aucun emplacement n'est saisi, une réception Odoo reste « À COMPLÉTER ».
    const location = locations.length ? locations.join(', ') : (isToComplete ? LOC_A_COMPLETER : '');
    const patch = {
      product, fournisseur: fournisseur || null, ref: ref || null, coloris: coloris || null,
      category, laize: laize || null, project: project || null, location,
      qty: totalQty, unit: unit || null, pieces: cleanPieces,
    };
    const reason = isToComplete && location !== LOC_A_COMPLETER
      ? `Complément réception : ${cleanPieces.length} pièce(s) → ${location}`
      : undefined;
    await onSave(patch, operator.trim(), reason);
    setSaving(false);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {isToComplete ? 'Compléter la réception' : "Éditer l'article"}
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {isToComplete && (
            <Alert severity="warning" icon={false} sx={{ fontWeight: 600 }}>
              📍 Réception Odoo : <b>{received} {item.unit || ''}</b> reçus. Détaille les pièces puis indique l'emplacement.
            </Alert>
          )}

          <Stack direction="row" spacing={2}>
            <TextField label="Fournisseur" value={fournisseur} onChange={(e) => setFournisseur(e.target.value)} size="small" sx={{ width: '35%' }} />
            <TextField label="Référence" value={ref} onChange={(e) => setRef(e.target.value)} size="small" sx={{ flex: 1 }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Coloris" value={coloris} onChange={(e) => setColoris(e.target.value)} size="small" sx={{ flex: 1 }} />
            <TextField label="Laize" value={laize} onChange={(e) => setLaize(e.target.value)} size="small" sx={{ width: '22%' }} placeholder="ex. 140" />
            <TextField label="Unité" value={unit} onChange={(e) => setUnit(e.target.value)} size="small" sx={{ width: '18%' }} placeholder="ml, u…" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Produit (libellé)" value={product} onChange={(e) => setProduct(e.target.value)} size="small" sx={{ flex: 1 }} />
            <TextField select label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} size="small" sx={{ width: '30%' }}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Affectation (dossier)" value={project} onChange={(e) => setProject(e.target.value)} size="small" sx={{ flex: 1 }} />
            <OperatorInput value={operator} onChange={setOperator} sx={{ width: '40%' }} />
          </Stack>

          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle2">Pièces / rouleaux</Typography>
            <Button size="small" startIcon={<AddIcon />} onClick={addPiece}>Ajouter une pièce</Button>
          </Box>
          {!hasPieces && (
            <TextField label="Quantité totale" type="number" value={manualQty} onChange={(e) => setManualQty(e.target.value)} size="small" sx={{ width: 200 }} />
          )}
          {pieces.map((p, idx) => (
            <Stack key={p.id} direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" sx={{ width: 70, fontWeight: 600 }}>Pièce {idx + 1}</Typography>
              <TextField
                type="number" value={p.qty} onChange={(e) => setPieceQty(p.id, e.target.value)} size="small" sx={{ width: 130 }}
                autoFocus={isToComplete && idx === pieces.length - 1 && p.qty === ''}
                InputProps={{ endAdornment: <Typography variant="caption" sx={{ color: 'text.secondary' }}>{item.unit || 'ml'}</Typography> }}
              />
              <IconButton size="small" onClick={() => removePiece(p.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {hasPieces && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {filledPieces.length ? 'Total' : 'Stock actuel'} : <b>{totalQty}</b> {item.unit || ''}
              {ecart != null && (
                ecart === 0
                  ? <span style={{ color: '#15803D', fontWeight: 700 }}> ✓ conforme à la réception ({received})</span>
                  : <span style={{ color: '#B45309', fontWeight: 700 }}> ⚠ écart de {ecart > 0 ? '+' : ''}{ecart} avec la réception ({received}) — le total des pièces fera foi</span>
              )}
            </Typography>
          )}

          <Divider />
          <LocationInput
            value={locations}
            onChange={setLocations}
            zones={zones}
            label="Emplacement de la réception"
            helperText={isToComplete && !locations.length ? 'Reste « À COMPLÉTER » tant qu\'aucun emplacement n\'est saisi.' : ' '}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={saving || !product.trim() || !operator.trim()}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
}
