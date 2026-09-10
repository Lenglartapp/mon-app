import React, { useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton, Chip } from '@mui/material';
import { X, Scissors, Layers, TrendingDown } from 'lucide-react';
import { analyser } from '../lib/optimisation/optimiseur';

// ─────────────────────────────────────────────────────────────────────────────
// Optimisation des métrages — PHASE DE TEST, LECTURE SEULE.
// Aucun bouton « Appliquer », aucune écriture : le panneau ne fait que proposer.
// Il est donc structurellement incapable de modifier un dossier, d'où qu'on
// l'ouvre. L'application des propositions viendra quand la qualité sera validée.
// ─────────────────────────────────────────────────────────────────────────────

const S = {
  card: { background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: 14 },
  kpi: { display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 18 },
  kpiBox: { flex: '1 1 150px', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '12px 14px' },
  kpiLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#6B7280', fontWeight: 700 },
  kpiVal: { fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 4, fontVariantNumeric: 'tabular-nums' },
  h: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: '#111827', margin: '22px 0 10px' },
  ligne: { display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1.6fr) auto', gap: 12, alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #F3F4F6' },
  petit: { fontSize: 12, color: '#6B7280' },
  gain: { fontSize: 14, fontWeight: 700, color: '#047857', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
  mono: { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 },
};

const m2 = (v) => `${(Math.round(v * 100) / 100).toFixed(2).replace('.', ',')} m`;

export default function OptimisationMetragePanel({ open, onClose, rows = [], surSelection = false }) {
  const res = useMemo(() => (open ? analyser(rows) : null), [open, rows]);
  if (!res) return null;

  const { lignes, groupes, total } = res;
  const gainTotal = total.gainLignes + total.gainGroupes;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '85vh' } }}>
      <DialogTitle sx={{ borderBottom: '1px solid #E5E7EB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Scissors size={18} />
          <span style={{ fontWeight: 700 }}>Optimisation des métrages</span>
          <Chip label="lecture seule" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 700 }} />
        </div>
        <IconButton onClick={onClose}><X size={18} /></IconButton>
      </DialogTitle>

      <DialogContent sx={{ bgcolor: '#F9FAFB', p: 3 }}>
        <div style={S.kpi}>
          <div style={S.kpiBox}>
            <div style={S.kpiLabel}>Métrage actuel</div>
            <div style={S.kpiVal}>{m2(total.metrageActuel)}</div>
            <div style={S.petit}>
              {rows.length} ligne{rows.length > 1 ? 's' : ''} {surSelection ? 'sélectionnée' : 'analysée'}{rows.length > 1 ? 's' : ''}
            </div>
          </div>
          <div style={S.kpiBox}>
            <div style={S.kpiLabel}>Réglages de ligne</div>
            <div style={{ ...S.kpiVal, color: '#047857' }}>−{m2(total.gainLignes)}</div>
            <div style={S.petit}>{lignes.filter(l => l.meilleure).length} sur {lignes.length} ligne{lignes.length > 1 ? 's' : ''}</div>
          </div>
          <div style={S.kpiBox}>
            <div style={S.kpiLabel}>Appiècements mutualisés</div>
            <div style={{ ...S.kpiVal, color: '#047857' }}>−{m2(total.gainGroupes)}</div>
            <div style={S.petit}>{groupes.length} tissu{groupes.length > 1 ? 's' : ''} uni{groupes.length > 1 ? 's' : ''}</div>
          </div>
          <div style={{ ...S.kpiBox, background: '#ECFDF5', borderColor: '#A7F3D0' }}>
            <div style={S.kpiLabel}>Total potentiel</div>
            <div style={{ ...S.kpiVal, color: '#047857' }}>−{m2(gainTotal)}</div>
            <div style={S.petit}>
              {total.metrageActuel > 0 ? `${Math.round((100 * gainTotal) / total.metrageActuel)} % du métrage` : '—'}
            </div>
          </div>
        </div>

        {/* ── Réglages de ligne ── */}
        <div style={S.h}><TrendingDown size={16} /> Réglages de ligne</div>
        <div style={{ ...S.card, padding: 0 }}>
          {lignes.length === 0 ? (
            <div style={{ padding: 18, color: '#9CA3AF', textAlign: 'center' }}>
              Aucune ligne rideau exploitable dans cette sélection.
            </div>
          ) : (
            [...lignes]
              .sort((a, b) => (b.meilleure?.gain || -1) - (a.meilleure?.gain || -1))
              .map(({ row, actuel, meilleure, variantes }) => (
                <div key={row.id} style={{ ...S.ligne, opacity: meilleure ? 1 : 0.55 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[row.zone, row.piece].filter(Boolean).join(' — ') || 'Ligne'}
                    </div>
                    <div style={S.petit}>
                      {row.tissu_deco1 || 'tissu non renseigné'} · laize {actuel.laize}
                    </div>
                    <div style={{ ...S.petit, ...S.mono }}>
                      {actuel.mode}, {actuel.lesTotal} lés, {m2(actuel.ml)}
                    </div>
                  </div>

                  <div style={{ minWidth: 0 }}>
                    {!meilleure ? (
                      <div style={S.petit}>Aucun levier ne fait franchir de palier.</div>
                    ) : (
                      variantes.map((v, i) => (
                        <div key={i} style={{ marginBottom: i < variantes.length - 1 ? 8 : 0 }}>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                            {v.changements.map((c, j) => (
                              <span key={j} style={{
                                ...S.mono, background: i === 0 ? '#ECFDF5' : '#F3F4F6',
                                color: i === 0 ? '#065F46' : '#4B5563',
                                border: `1px solid ${i === 0 ? '#A7F3D0' : '#E5E7EB'}`,
                                borderRadius: 5, padding: '2px 7px',
                              }}>{c}</span>
                            ))}
                          </div>
                          <div style={{ ...S.petit, ...S.mono, marginTop: 2 }}>
                            → {v.mode}, {v.lesTotal} lés, {m2(v.ml)} &nbsp;<span style={{ color: '#047857', fontWeight: 700 }}>−{m2(v.gain)}</span>
                            {i === 0 && variantes.length > 1 && <span style={{ color: '#9CA3AF' }}> &nbsp;· retenue</span>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div style={S.gain}>{meilleure ? `−${m2(meilleure.gain)}` : '—'}</div>
                </div>
              ))
          )}
        </div>

        {/* ── Mutualisation ── */}
        <div style={S.h}><Layers size={16} /> Appiècements mutualisés</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {groupes.length === 0 ? (
            <div style={{ ...S.card, color: '#9CA3AF', textAlign: 'center' }}>
              Aucun tissu uni avec plusieurs appiècements regroupables.
            </div>
          ) : groupes.map((g, i) => (
            <div key={i} style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{g.tissu || 'Tissu'} <span style={S.petit}>· laize {g.laize}</span></div>
                <div style={S.gain}>−{m2(g.gain)}</div>
              </div>
              <div style={{ ...S.petit, marginTop: 2 }}>
                {g.nbLignes} lignes · {g.lesActuels} lés isolés ({m2(g.coutActuel)}) → {g.lesOptimises} lés mutualisés ({m2(g.coutOptim)})
              </div>
              <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                {g.les.filter(l => l.pieces.length > 1).slice(0, 6).map((l, j) => (
                  <div key={j} style={{ ...S.mono, color: '#374151', background: '#F9FAFB', borderRadius: 6, padding: '5px 8px' }}>
                    lé h={l.hauteur} · {l.utilise}/{g.laize} cm — {l.pieces.map(p => `${[p.zone, p.piece].filter(Boolean).join(' ')} (${p.largeur})`).join('  +  ')}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ ...S.petit, marginTop: 22, paddingTop: 14, borderTop: '1px solid #E5E7EB' }}>
          Phase de test — ce panneau ne modifie rien. Les propositions ne franchissent
          que des paliers : un lé de moins, ou le passage en tissu couché. À palier égal,
          c'est le réglage le moins modifié qui est retenu ; les variantes grisées
          atteignent un palier différent. Les lignes sans proposition restent affichées,
          en retrait.
        </div>
      </DialogContent>
    </Dialog>
  );
}
