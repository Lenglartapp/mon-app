import React, { useState, useMemo } from "react";
import { uid } from "../lib/utils/uid";

const toNum = (v) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

// Tous les champs PV qui composent le prix_total d'une ligne de production
const PV_KEYS = [
  'pv_tissu1', 'pv_tissu2', 'pv_doublure', 'pv_interdoublure',
  'pv_pass1', 'pv_pass2',
  'pv_mecanisme', 'pv_mecanisme_bis', 'pv_mecanisme_store',
  'pv_tissu_1', 'pv_tissu_2', 'pv_pass_1', 'pv_pass_2',
  'pv_interieur', 'pv_toile_finition_1',
  'pv_baguette_1', 'pv_baguette_2', 'pv_molleton',
  'pv_pose', 'pv_confection', 'pv_prepa',
  'st_pose_pv', 'st_conf_pv',
  'livraison',
];

// Calcule le CA actuel (lignes + déplacements)
const computeCurrentCA = (minute) => {
  let sum = 0;
  (minute?.lines || []).forEach(r => sum += toNum(r.prix_total));
  (minute?.deplacements || []).forEach(r => sum += toNum(r.prix_total));
  return sum;
};

// Applique un coefficient uniforme à chaque champ PV (prorata généralisé)
// Pour les lignes production : __pv_overrides appliqué dans recomputeRow avant totalisation
// Pour les déplacements/extras : recal_coef sur le prix_total (pas de champs PV individuels)
const applyUniformCoef = (lines, coef) => {
  return (lines || []).map(r => {
    if (r.produit === 'Déplacement' || r.produit === 'Autre Dépense') {
      const prevCoef = toNum(r.recal_coef) > 0 ? toNum(r.recal_coef) : 1;
      const newPrix = Math.round(toNum(r.prix_total) * coef * 100) / 100;
      return { ...r, recal_coef: prevCoef * coef, prix_total: newPrix, total_price: newPrix };
    }
    // Ligne de production : override de chaque champ PV
    const overrides = {};
    PV_KEYS.forEach(key => {
      const v = toNum(r[key]);
      if (v !== 0) overrides[key] = Math.round(v * coef * 100) / 100;
    });
    const newPrixTotal = Math.round(
      PV_KEYS.reduce((s, k) => s + toNum(overrides[k] !== undefined ? overrides[k] : r[k]), 0) * 100
    ) / 100;
    return { ...r, ...overrides, __pv_overrides: overrides, prix_total: newPrixTotal, total_price: newPrixTotal };
  });
};

// Calcule le max récupérable à la baisse pour chaque levier matière (= Σ PV - PA)
const computeLeverMaxes = (lines, isDownward) => {
  if (!isDownward) return {};
  const maxes = { tissus: 0, passementeries: 0, mecanismes: 0, pose: null, confection: null, prepa: null };
  (lines || []).forEach(r => {
    const q = Math.max(1, toNum(r.quantite));
    maxes.tissus += Math.max(0, toNum(r.pv_tissu1) - toNum(r.pa_tissu1)) * q;
    maxes.tissus += Math.max(0, toNum(r.pv_tissu2) - toNum(r.pa_tissu2)) * q;
    maxes.tissus += Math.max(0, toNum(r.pv_doublure) - toNum(r.pa_doublure)) * q;
    maxes.tissus += Math.max(0, toNum(r.pv_interdoublure) - toNum(r.pa_interdoublure)) * q;
    maxes.passementeries += Math.max(0, toNum(r.pv_pass1) - toNum(r.pa_pass1)) * q;
    maxes.passementeries += Math.max(0, toNum(r.pv_pass2) - toNum(r.pa_pass2)) * q;
    maxes.mecanismes += Math.max(0, toNum(r.pv_mecanisme) - toNum(r.pa_mecanisme)) * q;
    maxes.mecanismes += Math.max(0, toNum(r.pv_mecanisme_bis) - toNum(r.pa_mecanisme_bis)) * q;
    maxes.mecanismes += Math.max(0, toNum(r.pv_mecanisme_store) - toNum(r.pa_mecanisme_store)) * q;
  });
  return maxes;
};

// Mapping levier → champs PV correspondants
const LEVER_PV_KEYS = {
  tissus:         ['pv_tissu1', 'pv_tissu2', 'pv_doublure', 'pv_interdoublure', 'pv_tissu_1', 'pv_tissu_2'],
  passementeries: ['pv_pass1', 'pv_pass2', 'pv_pass_1', 'pv_pass_2'],
  mecanismes:     ['pv_mecanisme', 'pv_mecanisme_bis', 'pv_mecanisme_store', 'pv_interieur'],
  pose:           ['pv_pose'],
  confection:     ['pv_confection', 'st_conf_pv'],
  prepa:          ['pv_prepa'],
};

// Applique des coefficients par levier via __pv_overrides (survit à recomputeRow)
const applyLeverCoefs = (lines, leverCoefs) => {
  return (lines || []).map(r => {
    const overrides = {};
    Object.entries(LEVER_PV_KEYS).forEach(([lever, keys]) => {
      const lc = leverCoefs[lever];
      if (lc == null) return;
      keys.forEach(key => {
        const v = toNum(r[key]);
        if (v !== 0) overrides[key] = Math.round(v * lc * 100) / 100;
      });
    });
    const newPrixTotal = Math.round(
      PV_KEYS.reduce((s, k) => s + toNum(overrides[k] !== undefined ? overrides[k] : r[k]), 0) * 100
    ) / 100;
    return { ...r, ...overrides, __pv_overrides: overrides, prix_total: newPrixTotal, total_price: newPrixTotal };
  });
};

// Helper : valeur PV totale actuelle d'un levier
function computeLeverCurrentValue(lines, leverId) {
  let sum = 0;
  (lines || []).forEach(r => {
    const q = Math.max(1, toNum(r.quantite));
    switch (leverId) {
      case 'tissus':        sum += (toNum(r.pv_tissu1) + toNum(r.pv_tissu2) + toNum(r.pv_doublure) + toNum(r.pv_interdoublure)) * q; break;
      case 'passementeries': sum += (toNum(r.pv_pass1) + toNum(r.pv_pass2)) * q; break;
      case 'mecanismes':    sum += (toNum(r.pv_mecanisme) + toNum(r.pv_mecanisme_bis) + toNum(r.pv_mecanisme_store)) * q; break;
      case 'pose':          sum += toNum(r.pv_pose) * q; break;
      case 'confection':    sum += toNum(r.pv_confection) * q; break;
      case 'prepa':         sum += toNum(r.pv_prepa) * q; break;
    }
  });
  return sum;
}

const LEVERS = [
  { id: 'tissus',         label: 'Tissus & Doublures',  isMaterial: true,  color: '#6366F1' },
  { id: 'passementeries', label: 'Passementeries',       isMaterial: true,  color: '#8B5CF6' },
  { id: 'mecanismes',     label: 'Rails & Mécanismes',   isMaterial: true,  color: '#EC4899' },
  { id: 'pose',           label: 'Pose (MO)',            isMaterial: false, color: '#F59E0B' },
  { id: 'confection',     label: 'Confection (MO)',      isMaterial: false, color: '#10B981' },
  { id: 'prepa',          label: 'Préparation (MO)',     isMaterial: false, color: '#3B82F6' },
];

const fmt = (n) => Math.round(n).toLocaleString("fr-FR");

export default function RecalibrationModal({ minute, minutes, onClose, onCreateVariant }) {
  const [targetInput, setTargetInput] = useState("");
  // "prorata" = coefficient uniforme sur tous les PV | "levers" = leviers personnalisés
  const [distributionMode, setDistributionMode] = useState("prorata");
  const [selectedLevers, setSelectedLevers] = useState({});

  const currentCA = useMemo(() => computeCurrentCA(minute), [minute]);
  const target = toNum(targetInput.replace(/\s/g, '').replace(',', '.'));
  const gap = target - currentCA;
  const isDownward = gap < 0;
  const absGap = Math.abs(gap);
  const hasTarget = target > 0 && Math.abs(gap) > 0.5;

  const prorataCoef = currentCA > 0 ? target / currentCA : 1;

  const leverMaxes = useMemo(
    () => computeLeverMaxes(minute?.lines, isDownward),
    [minute?.lines, isDownward]
  );

  const toggleLever = (leverId) => {
    setSelectedLevers(prev => ({ ...prev, [leverId]: !prev[leverId] }));
  };

  const leverAnalysis = useMemo(() => {
    if (distributionMode === "prorata") return { covered: true, remaining: 0, allocation: {} };

    const activeLeverIds = LEVERS.filter(l => selectedLevers[l.id]).map(l => l.id);
    let remaining = absGap;
    const allocation = {};

    if (!isDownward) {
      const leverWeights = {};
      let totalWeight = 0;
      activeLeverIds.forEach(id => {
        const w = computeLeverCurrentValue(minute?.lines, id);
        leverWeights[id] = w;
        totalWeight += w;
      });
      activeLeverIds.forEach(id => {
        const share = totalWeight > 0 ? (leverWeights[id] / totalWeight) * absGap : absGap / (activeLeverIds.length || 1);
        allocation[id] = share;
      });
      remaining = 0;
    } else {
      const details = activeLeverIds.map(id => ({ id, max: leverMaxes[id] }));
      for (const { id, max } of details) {
        if (remaining <= 0) { allocation[id] = 0; continue; }
        const canCover = max === null ? remaining : Math.min(remaining, max);
        allocation[id] = canCover;
        remaining -= canCover;
      }
    }

    return { allocation, remaining, covered: remaining <= 0.01 };
  }, [distributionMode, selectedLevers, leverMaxes, absGap, isDownward, minute?.lines]);

  const computeNextVersion = () => {
    const rootId = minute.parentId || minute.id;
    const siblingCount = (minutes || []).filter(m => (m.parentId || m.id) === rootId && m.id !== rootId).length;
    return siblingCount + 2;
  };

  const handleConfirm = () => {
    if (!hasTarget) return;
    if (!minute) return;

    let newLines;
    let newDeplacements = minute.deplacements || [];

    if (distributionMode === "prorata") {
      newLines = applyUniformCoef(minute.lines, prorataCoef);
      newDeplacements = applyUniformCoef(minute.deplacements, prorataCoef);
    } else {
      if (!leverAnalysis.covered) return;
      const leverCoefs = {};
      LEVERS.forEach(lever => {
        if (!selectedLevers[lever.id]) return;
        const currentVal = computeLeverCurrentValue(minute.lines, lever.id);
        const allocated = leverAnalysis.allocation[lever.id] || 0;
        if (currentVal <= 0) return;
        const newVal = isDownward ? currentVal - allocated : currentVal + allocated;
        leverCoefs[lever.id] = newVal / currentVal;
      });
      newLines = applyLeverCoefs(minute.lines, leverCoefs);
    }

    const rootId = minute.parentId || minute.id;
    const newVersion = computeNextVersion();
    const siblings = (minutes || []).filter(m => (m.parentId || m.id) === rootId && m.id !== rootId);
    const baseName = minute.name
      .replace(/ Recalibrage \d+$/i, '')
      .replace(/ Variante \d+$/i, '')
      .replace(/ Variante$/i, '')
      .replace(/ — v\d+.*$/, '');
    const recalibrageCount = siblings.filter(m => / Recalibrage /i.test(m.name)).length;
    const newName = `${baseName} Recalibrage ${recalibrageCount + 1}`;

    const variant = {
      ...minute,
      id: uid(),
      lines: newLines,
      tables: newLines,  // addMinute prioritizes .tables over .lines
      deplacements: newDeplacements,
      version: newVersion,
      parentId: rootId,
      status: "DRAFT",
      name: newName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onCreateVariant(variant);
    onClose();
  };

  const canConfirm = hasTarget && (distributionMode === "prorata" || leverAnalysis.covered);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1200 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: 520, background: "#fff", borderRadius: 14, padding: 28, boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)", maxHeight: '90vh', overflowY: 'auto' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>Assistant Recalibrage</h3>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              CA actuel : <strong>{fmt(currentCA)} €</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9CA3AF', lineHeight: 1 }}>×</button>
        </div>

        {/* Étape 1 : Saisie du montant cible */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Montant cible (€ HT)
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={targetInput}
            onChange={(e) => setTargetInput(e.target.value)}
            placeholder={`Ex: ${fmt(currentCA * 0.9)}`}
            style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '2px solid #E5E7EB', fontSize: 16, fontWeight: 600, outline: 'none', boxSizing: 'border-box' }}
            onFocus={(e) => e.target.style.borderColor = '#6366F1'}
            onBlur={(e) => e.target.style.borderColor = '#E5E7EB'}
          />
        </div>

        {/* Résumé de l'écart */}
        {hasTarget && (
          <div style={{
            background: isDownward ? '#FEF2F2' : '#F0FDF4',
            border: `1px solid ${isDownward ? '#FECACA' : '#BBF7D0'}`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 500 }}>
                {isDownward ? 'Réduction à absorber' : 'Hausse à répartir'}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: isDownward ? '#DC2626' : '#16A34A' }}>
                {isDownward ? '−' : '+'}{fmt(absGap)} €
              </div>
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'right' }}>
              <div>{isDownward ? '↘' : '↗'} {currentCA > 0 ? Math.round((gap / currentCA) * 100) : 0}%</div>
              <div style={{ fontSize: 11 }}>vs CA actuel</div>
            </div>
          </div>
        )}

        {/* Mode de distribution */}
        {hasTarget && (
          <>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
              Comment répartir l'écart ?
            </div>

            {/* Option Prorata */}
            <button
              onClick={() => setDistributionMode("prorata")}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 8, marginBottom: 8,
                border: `2px solid ${distributionMode === "prorata" ? '#6366F1' : '#E5E7EB'}`,
                background: distributionMode === "prorata" ? '#EEF2FF' : 'white',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: distributionMode === "prorata" ? '#6366F1' : 'white',
                border: `2px solid ${distributionMode === "prorata" ? '#6366F1' : '#D1D5DB'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {distributionMode === "prorata" && <div style={{ width: 6, height: 6, background: 'white', borderRadius: '50%' }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>
                  Prorata global <span style={{ fontSize: 11, fontWeight: 500, background: '#6366F1', color: 'white', borderRadius: 4, padding: '1px 6px', marginLeft: 6 }}>Recommandé</span>
                </div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Applique un coefficient uniforme à tous les prix de vente
                </div>
                {distributionMode === "prorata" && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#6366F1', marginTop: 4 }}>
                    Coefficient : ×{prorataCoef.toFixed(4)} — chaque PV multiplié par ce facteur
                  </div>
                )}
              </div>
            </button>

            {/* Option Leviers personnalisés */}
            <button
              onClick={() => setDistributionMode("levers")}
              style={{
                width: '100%', display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '12px 14px', borderRadius: 8, marginBottom: 16,
                border: `2px solid ${distributionMode === "levers" ? '#6366F1' : '#E5E7EB'}`,
                background: distributionMode === "levers" ? '#EEF2FF' : 'white',
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: distributionMode === "levers" ? '#6366F1' : 'white',
                border: `2px solid ${distributionMode === "levers" ? '#6366F1' : '#D1D5DB'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {distributionMode === "levers" && <div style={{ width: 6, height: 6, background: 'white', borderRadius: '50%' }} />}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Leviers personnalisés</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                  Choisissez manuellement quels postes ajuster (tissus, MO, etc.)
                </div>
              </div>
            </button>

            {/* Leviers (mode personnalisé seulement) */}
            {distributionMode === "levers" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                {LEVERS.map(lever => {
                  const isSelected = !!selectedLevers[lever.id];
                  const max = leverMaxes[lever.id];
                  const hasLimit = isDownward && max !== null;
                  const allocated = leverAnalysis.allocation[lever.id] || 0;
                  const isSaturated = hasLimit && max <= 0.01;

                  return (
                    <button
                      key={lever.id}
                      onClick={() => !isSaturated && toggleLever(lever.id)}
                      disabled={isSaturated}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '10px 14px', borderRadius: 8,
                        border: `2px solid ${isSelected ? lever.color : '#E5E7EB'}`,
                        background: isSelected ? `${lever.color}10` : 'white',
                        cursor: isSaturated ? 'not-allowed' : 'pointer',
                        opacity: isSaturated ? 0.4 : 1, textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                          background: isSelected ? lever.color : 'white',
                          border: `2px solid ${isSelected ? lever.color : '#D1D5DB'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {isSelected && <div style={{ width: 6, height: 6, background: 'white', borderRadius: 2 }} />}
                        </div>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{lever.label}</div>
                          {hasLimit && (
                            <div style={{ fontSize: 11, color: '#6B7280' }}>
                              Max récupérable : {fmt(max)} €{isSaturated ? ' — marge insuffisante' : ''}
                            </div>
                          )}
                          {!lever.isMaterial && isDownward && (
                            <div style={{ fontSize: 11, color: '#6B7280' }}>Main d'œuvre — aucun plancher</div>
                          )}
                        </div>
                      </div>
                      {isSelected && allocated > 0 && (
                        <div style={{ fontSize: 13, fontWeight: 700, color: lever.color, whiteSpace: 'nowrap' }}>
                          {isDownward ? '−' : '+'}{fmt(allocated)} €
                        </div>
                      )}
                    </button>
                  );
                })}

                {leverAnalysis.remaining > 0.01 && (
                  <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 13 }}>
                    <strong style={{ color: '#92400E' }}>⚠ Écart restant non couvert : {fmt(leverAnalysis.remaining)} €</strong>
                    <div style={{ color: '#78350F', marginTop: 2 }}>Ajoutez d'autres leviers pour absorber la totalité.</div>
                  </div>
                )}
              </div>
            )}

            {/* Bilan */}
            {canConfirm && (
              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#14532D' }}>
                ✓ Écart intégralement couvert. La variante sera créée avec le nom : <strong>{(() => {
                  const rootId = minute.parentId || minute.id;
                  const siblings = (minutes || []).filter(m => (m.parentId || m.id) === rootId && m.id !== rootId);
                  const base = minute.name.replace(/ Recalibrage \d+$/i, '').replace(/ Variante \d+$/i, '').replace(/ Variante$/i, '').replace(/ — v\d+.*$/, '');
                  const n = siblings.filter(m => / Recalibrage /i.test(m.name)).length;
                  return `${base} Recalibrage ${n + 1}`;
                })()}</strong>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                onClick={onClose}
                style={{ padding: '9px 18px', borderRadius: 8, border: '1px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={{
                  padding: '9px 18px', borderRadius: 8, border: 'none',
                  background: canConfirm ? '#1E2447' : '#D1D5DB',
                  color: 'white', cursor: canConfirm ? 'pointer' : 'not-allowed',
                  fontSize: 14, fontWeight: 600,
                }}
              >
                Créer la variante recalibrée
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
