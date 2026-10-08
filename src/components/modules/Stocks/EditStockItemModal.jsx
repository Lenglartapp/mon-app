import React, { useState } from 'react';
import { TextField, Button, Stack, IconButton, Box, Typography } from '@mui/material';
import InputAdornment from '@mui/material/InputAdornment';
import { Plus, Minus } from 'lucide-react';
import DaDialog from '../../ui/DaDialog';
import { DaField, ChoicePill } from '../../ui/DaForm';
import { TonePill } from '../../ui/ToolbarControls';
import { DA_FIELD_SX } from '../../../lib/constants/daStyles';
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

  // DA : coque DaDialog, libellés gris au-dessus des champs, sections encadrées, bleu nuit.
  const sectionSx = { p: 2, border: '1px solid #E0DED9', borderRadius: '8px' };
  const sectionTitle = (t, extra) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
      <Typography sx={{ fontSize: 15, fontWeight: 500, color: '#111827', fontFamily: 'Roboto, system-ui, sans-serif' }}>{t}</Typography>
      {extra}
    </Box>
  );
  const field = (label, value, setValue, props = {}) => (
    <DaField label={label}>
      <TextField fullWidth size="small" value={value} onChange={(e) => setValue(e.target.value)} sx={DA_FIELD_SX} {...props} />
    </DaField>
  );
  const unitLabel = unit || item.unit || 'ml';
  const canSave = !saving && !!product.trim() && !!operator.trim();

  return (
    <DaDialog
      open
      onClose={onClose}
      title={isToComplete ? 'Compléter la réception' : "Modifier l'article"}
      subtitle={[fournisseur, [ref, coloris].filter(Boolean).join(' — ')].filter(Boolean).join(' · ') || product || undefined}
      maxWidth="sm"
      footer={(
        <>
          <Button onClick={onClose} sx={{ marginLeft: 'auto', color: '#374151', textTransform: 'none', fontWeight: 600, border: '1px solid #E0DED9', borderRadius: '8px', px: 2, height: 38 }}>Annuler</Button>
          <Button
            variant="contained" disableElevation onClick={save} disabled={!canSave}
            sx={{ bgcolor: '#1E2447', textTransform: 'none', fontWeight: 600, px: 3, borderRadius: '8px', height: 38, '&:hover': { bgcolor: '#2A3260' } }}
          >
            Enregistrer
          </Button>
        </>
      )}
    >
      <Stack spacing={3}>
        {isToComplete && (
          <Typography sx={{ fontSize: 13, color: '#374151', bgcolor: '#EEF4FD', borderRadius: '8px', px: 1.5, py: 1 }}>
            Réception Odoo : <b>{received} {item.unit || ''}</b> reçus. Détaille les pièces puis indique l'emplacement.
          </Typography>
        )}

        {/* ARTICLE */}
        <Box sx={sectionSx}>
          {sectionTitle('Article')}
          <Stack spacing={2}>
            <DaField label="Catégorie">
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {CATEGORIES.map((c) => <ChoicePill key={c} active={category === c} onClick={() => setCategory(c)}>{c}</ChoicePill>)}
              </Stack>
            </DaField>
            <Stack direction="row" spacing={1.5}>
              <Box sx={{ flex: 1 }}>{field('Fournisseur', fournisseur, setFournisseur)}</Box>
              <Box sx={{ flex: 1 }}>{field('Référence', ref, setRef)}</Box>
            </Stack>
            <Stack direction="row" spacing={1.5}>
              <Box sx={{ flex: 1 }}>{field('Coloris', coloris, setColoris)}</Box>
              <Box sx={{ width: 110 }}>{field('Laize', laize, setLaize, { placeholder: 'ex. 140' })}</Box>
              <Box sx={{ width: 100 }}>{field('Unité', unit, setUnit, { placeholder: 'ml, u…' })}</Box>
            </Stack>
            {field('Libellé produit', product, setProduct)}
            {field('Affectation (dossier)', project, setProject, { placeholder: 'Stock libre' })}
          </Stack>
        </Box>

        {/* PIÈCES / QUANTITÉ */}
        <Box sx={sectionSx}>
          {sectionTitle('Pièces / rouleaux', (
            <Button size="small" startIcon={<Plus size={14} />} onClick={addPiece} sx={{ textTransform: 'none', fontWeight: 600, color: '#1E2447' }}>Ajouter une pièce</Button>
          ))}
          {!hasPieces && (
            <Box sx={{ width: 200 }}>
              <DaField label="Quantité totale">
                <TextField fullWidth size="small" type="number" value={manualQty} onChange={(e) => setManualQty(e.target.value)} sx={DA_FIELD_SX}
                  InputProps={{ endAdornment: <InputAdornment position="end"><span style={{ color: '#6B7280', fontSize: 13 }}>{unitLabel}</span></InputAdornment> }} />
              </DaField>
            </Box>
          )}
          <Stack spacing={1}>
            {pieces.map((p, idx) => (
              <Box key={p.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Typography sx={{ color: '#374151', fontSize: 13, fontWeight: 500, minWidth: 70 }}>Pièce {idx + 1}</Typography>
                <TextField
                  type="number" value={p.qty} onChange={(e) => setPieceQty(p.id, e.target.value)} size="small" sx={{ ...DA_FIELD_SX, width: 140 }}
                  autoFocus={isToComplete && idx === pieces.length - 1 && p.qty === ''}
                  InputProps={{ endAdornment: <InputAdornment position="end"><span style={{ color: '#6B7280', fontSize: 13 }}>{item.unit || 'ml'}</span></InputAdornment> }}
                />
                <Box sx={{ flex: 1 }} />
                <IconButton size="small" onClick={() => removePiece(p.id)} title="Retirer la pièce" sx={{ color: '#6B7280' }}><Minus size={16} /></IconButton>
              </Box>
            ))}
          </Stack>
          {hasPieces && (
            <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', fontSize: 13, color: '#6B7280' }}>
              <span>{filledPieces.length ? 'Total' : 'Stock actuel'} : <b style={{ color: '#111827' }}>{totalQty}</b> {item.unit || ''}</span>
              {ecart != null && (ecart === 0
                ? <TonePill tone={4}>Conforme à la réception ({received})</TonePill>
                : <TonePill tone={null}>Écart de {ecart > 0 ? '+' : ''}{ecart} avec la réception ({received}) — le total des pièces fera foi</TonePill>)}
            </Box>
          )}
        </Box>

        {/* EMPLACEMENT + OPÉRATEUR */}
        <DaField label="Emplacement de la réception"
          hint={isToComplete && !locations.length ? 'Reste « À COMPLÉTER » tant qu’aucun emplacement n’est saisi.' : 'Plusieurs codes possibles si le rangement est réparti.'}>
          <LocationInput value={locations} onChange={setLocations} zones={zones} label={null} fieldSx={DA_FIELD_SX} />
        </DaField>
        <DaField label="Opérateur">
          <OperatorInput value={operator} onChange={setOperator} label={null} fieldSx={DA_FIELD_SX} />
        </DaField>
      </Stack>
    </DaDialog>
  );
}
