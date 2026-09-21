import React, { useMemo, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, Stack, IconButton, Box, Typography, Divider } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Close as CloseIcon } from '@mui/icons-material';

// Édition d'un article de stock au double-clic : produit, catégorie, affectation (dossier),
// emplacement, opérateur, et découpe en pièces (qté + emplacement de chacune).
// La quantité totale se recalcule depuis les pièces (comme une entrée classique).

const CATEGORIES = ['Tissu', 'Rail', 'Consommable', 'Mécanisme', 'Divers'];

export default function EditStockItemModal({ item, onClose, onSave }) {
  const [product, setProduct] = useState(item.product || '');
  const [ref, setRef] = useState(item.ref || '');
  const [category, setCategory] = useState(CATEGORIES.includes(item.category) ? item.category : 'Tissu');
  const [laize, setLaize] = useState(item.laize || '');
  const [unit, setUnit] = useState(item.unit || '');
  const [project, setProject] = useState(item.project || '');
  const [location, setLocation] = useState(item.location || '');
  const [operator, setOperator] = useState('');
  const [manualQty, setManualQty] = useState(item.qty ?? 0);
  const [pieces, setPieces] = useState(
    Array.isArray(item.pieces) ? item.pieces.map((p, i) => ({ id: p.id ?? i + 1, qty: p.qty ?? '', location: p.location ?? '' })) : []
  );
  const [saving, setSaving] = useState(false);

  const hasPieces = pieces.length > 0;
  const totalQty = useMemo(
    () => (hasPieces ? pieces.reduce((s, p) => s + Number(p.qty || 0), 0) : Number(manualQty || 0)),
    [pieces, manualQty, hasPieces]
  );

  const addPiece = () => setPieces((prev) => [...prev, { id: Date.now(), qty: '', location: '' }]);
  const removePiece = (id) => setPieces((prev) => prev.filter((p) => p.id !== id));
  const setPieceQty = (id, v) => setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, qty: v } : p)));
  const setPieceLoc = (id, v) => setPieces((prev) => prev.map((p) => (p.id === id ? { ...p, location: v } : p)));

  const save = async () => {
    setSaving(true);
    const cleanPieces = hasPieces
      ? pieces.filter((p) => Number(p.qty) > 0).map((p, idx) => ({ id: p.id, qty: Number(p.qty), location: p.location || '', name: `Pièce ${idx + 1}` }))
      : [];
    // Emplacement : quand il y a des pièces, ce sont leurs emplacements qui font foi (pas de global)
    const patch = { product, ref: ref || null, category, laize: laize || null, project: project || null, location: hasPieces ? '' : location, qty: totalQty, unit: unit || null, pieces: cleanPieces };
    await onSave(patch, operator);
    setSaving(false);
  };

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Éditer l'article
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Stack direction="row" spacing={2}>
            <TextField label="Produit" value={product} onChange={(e) => setProduct(e.target.value)} size="small" sx={{ flex: 1 }} />
            <TextField label="Référence" value={ref} onChange={(e) => setRef(e.target.value)} size="small" sx={{ width: '35%' }} />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField select label="Catégorie" value={category} onChange={(e) => setCategory(e.target.value)} size="small" sx={{ width: '34%' }}>
              {CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
            </TextField>
            <TextField label="Laize" value={laize} onChange={(e) => setLaize(e.target.value)} size="small" sx={{ width: '33%' }} placeholder="ex. 140" />
            <TextField label="Unité" value={unit} onChange={(e) => setUnit(e.target.value)} size="small" sx={{ width: '33%' }} placeholder="ml, u…" />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Affectation (dossier)" value={project} onChange={(e) => setProject(e.target.value)} size="small" sx={{ flex: 1 }} />
            <TextField label="Opérateur" value={operator} onChange={(e) => setOperator(e.target.value)} size="small" sx={{ width: '40%' }} placeholder="Qui édite ?" required error={!operator.trim()} />
          </Stack>
          {!hasPieces && (
            <TextField label="Emplacement" value={location} onChange={(e) => setLocation(e.target.value)} size="small" fullWidth />
          )}

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
              <Typography variant="caption" sx={{ width: 24 }}>#{idx + 1}</Typography>
              <TextField label="Qté" type="number" value={p.qty} onChange={(e) => setPieceQty(p.id, e.target.value)} size="small" sx={{ width: 110 }} />
              <TextField label="Emplacement" value={p.location} onChange={(e) => setPieceLoc(p.id, e.target.value)} size="small" sx={{ flex: 1 }} />
              <IconButton size="small" onClick={() => removePiece(p.id)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
          {hasPieces && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>Quantité totale : <b>{totalQty}</b> {item.unit || ''}</Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={save} disabled={saving || !product.trim() || !operator.trim()}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
}
