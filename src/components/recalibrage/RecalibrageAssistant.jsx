import React from 'react';
import { ChevronDown, Check } from 'lucide-react';
import DaDialog from '../ui/DaDialog';
import { ToolbarButton } from '../ui/ToolbarControls';
import { uid } from '../../lib/utils/uid';
import { nextFamilyVersion } from '../../lib/minuteFamily';
import { appendHistory } from '../../lib/minuteHistory';
import {
  analyzeMinute, applyLevers, currentKpis, attribution, describeLevers, summarizeForNote, POSTES,
  listLevers, solveBalanced, AMPLEUR_MIN, TEMPS_MAX,
} from '../../lib/recalibrage/engine';

const NAVY = '#1E2447';
const LINE = '#E8E6E2';
const MUTED = '#6B7280';

const num = (v) => {
  const n = Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const fmt = (n, d = 2) => (n == null || !Number.isFinite(n) ? '—' : n.toLocaleString('fr-FR', { maximumFractionDigits: d }));
const range = (r, prefix = '') => (!r ? '—' : Math.abs(r.max - r.min) < 0.005 ? `${prefix}${fmt(r.min)}` : `${prefix}${fmt(r.min)} – ${prefix}${fmt(r.max)}`);
const signed = (n, formatter) => (Math.abs(n) < 0.5 ? '—' : `${n > 0 ? '+' : '−'}${formatter(Math.abs(n))}`);

function Section({ title, hint, children }) {
  return (
    <section style={{ padding: '18px 0', borderBottom: `1px solid ${LINE}` }}>
      <div style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>{title}</div>
      {hint && <div style={{ fontSize: 12, color: MUTED, marginTop: 4 }}>{hint}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </section>
  );
}

function NumInput({ value, onChange, placeholder, suffix, width = 84 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        style={{
          width, height: 32, padding: '0 8px', borderRadius: 8, border: `1px solid ${value ? NAVY : '#E0DED9'}`,
          fontSize: 13, fontFamily: 'inherit', textAlign: 'right', outline: 'none', background: 'white', color: '#111827',
        }}
      />
      {suffix && <span style={{ fontSize: 12, color: MUTED }}>{suffix}</span>}
    </span>
  );
}

const th = { textAlign: 'left', fontSize: 12, fontWeight: 500, color: MUTED, padding: '0 8px 8px 0' };
const td = { fontSize: 13, color: '#111827', padding: '6px 8px 6px 0', borderTop: `1px solid ${LINE}` };

export default function RecalibrageAssistant({
  minute, minutes, rows, depRows, extraRows, formulaCtx, schema, commissionRate, author, onClose, onCreateVariant,
}) {
  const input = React.useMemo(() => ({
    rows, depRows, extraRows, catalog: formulaCtx.catalog, ctx: formulaCtx, schema, commissionRate,
  }), [rows, depRows, extraRows, formulaCtx, schema, commissionRate]);

  const analysis = React.useMemo(() => analyzeMinute({ rows, catalog: formulaCtx.catalog, settings: formulaCtx.settings }), [rows, formulaCtx]);
  const before = React.useMemo(() => currentKpis({ rows, depRows, extraRows, commissionRate }), [rows, depRows, extraRows, commissionRate]);

  const [coefs, setCoefs] = React.useState({});
  const [coefST, setCoefST] = React.useState('');
  const [ampleurs, setAmpleurs] = React.useState({});
  const [heures, setHeures] = React.useState({});
  const [clearLegacy, setClearLegacy] = React.useState(true);
  const [target, setTarget] = React.useState('');
  const [noteDraft, setNoteDraft] = React.useState(null); // null = texte automatique, suivi des leviers
  const [showAllLines, setShowAllLines] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const levers = React.useMemo(() => ({ coefs, coefST, ampleurs, heures, clearLegacy }), [coefs, coefST, ampleurs, heures, clearLegacy]);
  const deferred = React.useDeferredValue(levers);

  const after = React.useMemo(() => applyLevers(input, deferred), [input, deferred]);
  const split = React.useMemo(() => attribution(input, deferred, before.ca_total), [input, deferred, before.ca_total]);
  const changes = React.useMemo(() => describeLevers(analysis, levers), [analysis, levers]);

  const deferredTarget = React.useDeferredValue(target);
  // ——— Recommandations : leviers proposés selon la minute, cochés par l'utilisateur ———
  const allLevers = React.useMemo(() => listLevers(analysis), [analysis]);
  const [chosenIds, setChosenIds] = React.useState(() => allLevers.filter((l) => l.kind === 'coef' || l.kind === 'st').map((l) => l.id));
  const chosen = React.useMemo(() => allLevers.filter((l) => chosenIds.includes(l.id)), [allLevers, chosenIds]);

  const suggestion = React.useMemo(() => {
    const t = num(deferredTarget);
    if (!t) return null;
    const balanced = solveBalanced(input, deferred, chosen, analysis, t);
    // Alternatives : chaque famille de leviers cochée, seule.
    const groups = [...new Set(chosen.map((l) => l.group))];
    const alone = groups.length > 1
      ? groups.map((g) => ({ group: g, r: solveBalanced(input, deferred, chosen.filter((l) => l.group === g), analysis, t) })).filter((a) => a.r.ok)
      : [];
    return { balanced, alone };
  }, [deferredTarget, input, deferred, chosen, analysis]);

  const str = (v) => (v === '' || v == null ? '' : String(v).replace('.', ','));
  const applyScenario = (lv) => {
    setCoefs(Object.fromEntries(Object.entries(lv.coefs || {}).map(([k, v]) => [k, str(v)])));
    setCoefST(str(lv.coefST));
    setAmpleurs(Object.fromEntries(Object.entries(lv.ampleurs || {}).map(([k, v]) => [k, str(v)])));
    setHeures(Object.fromEntries(Object.entries(lv.heures || {}).map(([p, h]) => [p, Object.fromEntries(Object.entries(h).map(([k, v]) => [k, str(v)]))])));
    setNoteDraft(null);
  };
  const scenarioLines = (lv) => summarizeForNote(describeLevers(analysis, lv)).filter((c) => c.group !== 'Ancien recalibrage');


  const lineDiffs = React.useMemo(() => {
    const byId = new Map(after.rows.map((r) => [r.id, r]));
    return rows.map((r) => {
      const n = byId.get(r.id);
      const b = num(r.prix_total), a = num(n?.prix_total);
      return { id: r.id, label: [r.zone, r.piece, r.produit].filter(Boolean).join(' · ') || 'Ligne', before: b, after: a, delta: a - b };
    }).filter((l) => Math.abs(l.delta) >= 0.5).sort((x, y) => x.delta - y.delta);
  }, [rows, after.rows]);

  // ——— Nom de la variante ———
  const rootId = minute.parentId || minute.id;
  const variantName = React.useMemo(() => {
    const siblings = (minutes || []).filter((m) => (m.parentId || m.id) === rootId && m.id !== rootId);
    const base = String(minute.name || 'Chiffrage').replace(/ Recalibrage \d+$/i, '').replace(/ Variante \d+$/i, '').replace(/ Variante$/i, '').replace(/ — v\d+.*$/, '');
    const n = siblings.filter((m) => / Recalibrage /i.test(m.name || '')).length;
    return `${base} Recalibrage ${n + 1}`;
  }, [minutes, minute, rootId]);

  // Note de recalibrage rédigée automatiquement (« - » = puces dans les Notes).
  // Elle suit les leviers tant qu'elle n'a pas été retouchée à la main.
  const autoNote = React.useMemo(() => {
    if (!changes.length) return '';
    const b = before.ca_total, a = after.kpis.ca_total;
    const pct = b > 0 ? ((a - b) / b) * 100 : 0;
    const day = new Date().toLocaleDateString('fr-FR');
    return [
      `${variantName} — ${day}${author ? ` · ${author}` : ''}`,
      `Prix de vente HT : ${eur.format(b)} → ${eur.format(a)} (${pct > 0 ? '+' : '−'}${fmt(Math.abs(pct), 1)} %)`,
      ...summarizeForNote(changes).map((c) => `- ${c.group} · ${c.label} : ${c.from} → ${c.to}`),
    ].join('\n');
  }, [changes, before.ca_total, after.kpis.ca_total, author, variantName]);
  const note = noteDraft ?? autoNote;

  const handleCreate = async () => {
    if (saving || !changes.length) return;
    setSaving(true);
    const result = applyLevers(input, levers);
    const date = new Date().toISOString();
    const trace = {
      date, author, note: note.trim() || null,
      source: { id: minute.id, name: minute.name },
      before: before, after: result.kpis,
      split,
      levers: changes,
    };
    const ctx = 'Recalibrage';
    const mk = (field, from, to, i) => ({ id: `${Date.now()}-recal-${i}`, type: 'log', field, from, to, context: ctx, author, date: Date.now(), createdAt: date });
    const entries = [
      mk('Prix de vente HT', eur.format(before.ca_total), eur.format(result.kpis.ca_total), 0),
      ...changes.map((c, i) => mk(`${c.group} · ${c.label}`, c.from, c.to, i + 1)),
      ...(note.trim() ? [{ id: `${Date.now()}-recal-note`, type: 'msg', text: note.trim(), context: ctx, author, date: Date.now(), createdAt: date }] : []),
    ];
    const modules = appendHistory({ ...(minute.modules || {}), recalibrage: trace }, entries);

    // Réglages : la colonne `params` fait foi (cf. CatalogManager.onSettingsChange).
    const params = [...(minute.params || [])];
    const setParam = (name, value) => {
      const i = params.findIndex((p) => p.name === name);
      if (i >= 0) params[i] = { ...params[i], value }; else params.push({ name, value });
    };
    if (num(coefST) > 0) setParam('coef_sous_traitance', num(coefST));

    const variant = {
      ...minute,
      id: uid(),
      lines: result.rows,
      tables: result.rows, // addMinute privilégie .tables
      deplacements: result.depRows,
      ...(result.catalogChanged ? { catalog: result.catalog } : {}),
      settings: { ...(minute.settings || {}), ...(num(coefST) > 0 ? { coef_sous_traitance: num(coefST) } : {}) },
      params,
      modules,
      // La note de recalibrage passe en tête des notes de la variante.
      // (1re ligne en gras, mini-markdown des Notes).
      notes: [note.trim().replace(/^([^\n*][^\n]*)/, '**$1**'), minute.notes].filter(Boolean).join('\n\n'),
      version: nextFamilyVersion(minutes, rootId),
      parentId: rootId,
      status: 'DRAFT',
      name: variantName,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    try { await onCreateVariant(variant); } finally { setSaving(false); }
  };

  const reset = () => { setNoteDraft(null); setCoefs({}); setCoefST(''); setAmpleurs({}); setHeures({}); setTarget(''); };

  // ——— Aperçu ———
  const k0 = before, k1 = after.kpis;
  const kpiRows = [
    { label: 'Prix de vente HT', a: k0.ca_total, b: k1.ca_total, f: eur.format, strong: true },
    { label: 'Achats matières', a: k0.achats_fixes, b: k1.achats_fixes, f: eur.format },
    { label: 'Métrage tissu', a: k0.metrage, b: k1.metrage, f: (n) => `${fmt(n, 1)} ml` },
    { label: 'Heures', a: k0.total_heures, b: k1.total_heures, f: (n) => `${fmt(n, 1)} h` },
  ];
  const caDelta = k1.ca_total - k0.ca_total;
  const caPct = k0.ca_total > 0 ? (caDelta / k0.ca_total) * 100 : 0;
  const visibleLines = showAllLines ? lineDiffs : lineDiffs.slice(0, 8);

  return (
    <DaDialog
      open
      onClose={(_, reason) => { if (reason !== 'backdropClick') onClose(); }}
      title="Assistant recalibrage"
      subtitle={`${minute.name} · ${eur.format(k0.ca_total)} HT — le chiffrage d'origine reste intact, une variante est créée.`}
      maxWidth="lg"
      height="92vh"
      bodyPadding="0"
      footer={(
        <>
          <span style={{ fontSize: 13, color: MUTED, flex: 1 }}>
            {changes.length ? <>Création de <b style={{ color: '#111827', fontWeight: 500 }}>{variantName}</b></> : 'Modifiez au moins un levier.'}
          </span>
          <ToolbarButton onClick={reset} disabled={!changes.length}>Réinitialiser</ToolbarButton>
          <ToolbarButton onClick={onClose}>Annuler</ToolbarButton>
          <ToolbarButton primary onClick={handleCreate} disabled={!changes.length || saving}>
            {saving ? 'Création…' : 'Créer la variante'}
          </ToolbarButton>
        </>
      )}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 1fr)', minHeight: '100%' }}>
        {/* ——— LEVIERS ——— */}
        <div style={{ padding: '0 28px 24px' }}>
          <Section title="Prix cible" hint="Choisissez les leviers sur lesquels l'assistant peut jouer : il propose la répartition qui atteint ce prix.">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <NumInput value={target} onChange={setTarget} placeholder={fmt(Math.round(k0.ca_total), 0)} suffix="€ HT" width={130} />
              <LeverPicker levers={allLevers} value={chosenIds} onChange={setChosenIds} />
            </div>
            {suggestion && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', marginBottom: 8 }}>Recommandation de l'assistant</div>
                {suggestion.balanced.ok ? (
                  <ScenarioCard
                    title={chosen.length > 1 ? 'Effort réparti sur les leviers choisis' : chosen[0]?.label}
                    ca={suggestion.balanced.ca}
                    lines={scenarioLines(suggestion.balanced.levers)}
                    onApply={() => applyScenario(suggestion.balanced.levers)}
                    primary
                  />
                ) : (
                  <div style={{ fontSize: 13, color: '#B45309' }}>
                    {suggestion.balanced.reason === 'none' && 'Choisissez au moins un levier.'}
                    {suggestion.balanced.reason === 'high' && 'Le prix cible est au-dessus du prix actuel : rien à baisser.'}
                    {suggestion.balanced.reason === 'low' && `Inatteignable avec ces leviers : au maximum (coef ×1, ampleur ${fmt(AMPLEUR_MIN)}, temps −${TEMPS_MAX} %), le devis fait ${eur.format(suggestion.balanced.min)}. Ajoutez un levier.`}
                  </div>
                )}
                {suggestion.alone.length > 0 && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
                    <div style={{ fontSize: 12, color: MUTED }}>Autres possibilités</div>
                    {suggestion.alone.map((a) => (
                      <ScenarioCard key={a.group} title={`${a.group} seuls`} ca={a.r.ca} lines={scenarioLines(a.r.levers)} onApply={() => applyScenario(a.r.levers)} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </Section>

          <Section title="Coefficients" hint="Actuel : coefficient moyen réellement pratiqué sur les lignes (prix de vente ÷ prix d'achat, saisies manuelles comprises). Le nouveau s'applique à toute la famille. Vide = inchangé.">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr><th style={th}>Famille</th><th style={th}>Articles</th><th style={th}>Actuel</th><th style={{ ...th, textAlign: 'right' }}>Nouveau</th></tr></thead>
              <tbody>
                {analysis.families.map((f) => (
                  <tr key={f.key}>
                    <td style={td}>{f.label}</td>
                    <td style={{ ...td, color: MUTED }}>{f.items.length}</td>
                    <td style={td}>
                      {f.weighted ? `×${fmt(f.weighted)}` : range(f.coef, '×')}
                      {f.weighted && f.coef && f.coef.max - f.coef.min > 0.005 && (
                        <span style={{ fontSize: 11, color: MUTED, marginLeft: 6 }}>{range(f.coef, '×')}</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <NumInput value={coefs[f.key]} onChange={(v) => setCoefs((c) => ({ ...c, [f.key]: v }))} placeholder="×" />
                    </td>
                  </tr>
                ))}
                {analysis.hasST && (
                  <tr>
                    <td style={td}>Sous-traitance</td><td style={td} />
                    <td style={td}>×{fmt(analysis.coefST)}</td>
                    <td style={{ ...td, textAlign: 'right' }}><NumInput value={coefST} onChange={setCoefST} placeholder="×" /></td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>

          <Section title="Ampleur" hint="Par produit : la nouvelle ampleur s'applique à toutes ses lignes, le métrage est recalculé (lés, raccords).">
            {analysis.ampleurs.length === 0 ? <Empty>Aucune ligne avec une ampleur.</Empty> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Produit</th><th style={th}>Lignes</th><th style={th}>Actuelle</th><th style={{ ...th, textAlign: 'right' }}>Nouvelle</th></tr></thead>
                <tbody>
                  {analysis.ampleurs.map((a) => (
                    <tr key={a.produit}>
                      <td style={td}>{a.produit}</td>
                      <td style={{ ...td, color: MUTED }}>{a.lines}</td>
                      <td style={td}>{range(a.value)}</td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <NumInput value={ampleurs[a.produit]} onChange={(v) => setAmpleurs((s) => ({ ...s, [a.produit]: v }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Temps de production" hint="Réduction en % des heures saisies, par produit et par poste.">
            {analysis.heures.length === 0 ? <Empty>Aucune heure saisie.</Empty> : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={th}>Produit</th>{POSTES.map((p) => <th key={p.key} style={{ ...th, textAlign: 'right' }}>{p.label}</th>)}</tr></thead>
                <tbody>
                  {analysis.heures.map((h) => (
                    <tr key={h.produit}>
                      <td style={td}>{h.produit}</td>
                      {POSTES.map((p) => (
                        <td key={p.key} style={{ ...td, textAlign: 'right' }}>
                          {h[p.key] > 0 ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 12, color: MUTED }}>{fmt(h[p.key], 1)} h</span>
                              <NumInput
                                width={56}
                                value={heures[h.produit]?.[p.key]}
                                onChange={(v) => setHeures((s) => ({ ...s, [h.produit]: { ...(s[h.produit] || {}), [p.key]: v } }))}
                                placeholder="−%"
                              />
                            </span>
                          ) : <span style={{ color: '#D1D5DB' }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {analysis.legacyLines > 0 && (
            <Section title="Ancien recalibrage">
              <label style={{ display: 'flex', gap: 10, fontSize: 13, color: '#374151', cursor: 'pointer', alignItems: 'flex-start' }}>
                <input type="checkbox" checked={clearLegacy} onChange={(e) => setClearLegacy(e.target.checked)} style={{ marginTop: 2 }} />
                <span>
                  {analysis.legacyLines} ligne(s) portent des prix figés par l'ancien assistant. Les recalculer avec les formules
                  (sinon les nouveaux leviers n'agissent pas sur ces lignes).
                </span>
              </label>
            </Section>
          )}

          <Section title="Note de recalibrage" hint="Rédigée automatiquement à partir des leviers ; complétez-la (motif, échange client…). Elle sera ajoutée en tête des notes de la variante et dans son historique.">
            <textarea
              value={note}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Modifiez un levier pour générer la note…"
              rows={Math.min(12, Math.max(4, note.split('\n').length + 2))}
              style={{ width: '100%', boxSizing: 'border-box', borderRadius: 8, border: '1px solid #E0DED9', padding: '8px 10px', fontSize: 13, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical', outline: 'none' }}
            />
            {noteDraft != null && noteDraft !== autoNote && (
              <button type="button" onClick={() => setNoteDraft(null)} style={{ marginTop: 6, border: 'none', background: 'none', padding: 0, color: NAVY, fontSize: 12, cursor: 'pointer' }}>
                Régénérer le texte automatique
              </button>
            )}
          </Section>
        </div>

        {/* ——— APERÇU ——— */}
        <div style={{ background: '#F4F4F4', padding: '18px 24px 24px', borderLeft: `1px solid ${LINE}` }}>
          <div style={{ position: 'sticky', top: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: '#111827' }}>Aperçu</div>
            <div style={{ margin: '14px 0 4px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28, fontWeight: 400, color: NAVY }}>{eur.format(k1.ca_total)}</span>
              <span style={{ fontSize: 14, color: caDelta < 0 ? '#B91C1C' : caDelta > 0 ? '#047857' : MUTED }}>
                {Math.abs(caDelta) < 0.5 ? 'inchangé' : `${signed(caDelta, eur.format)} (${caPct > 0 ? '+' : ''}${fmt(caPct, 1)} %)`}
              </span>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
              <thead><tr><th style={th} /><th style={{ ...th, textAlign: 'right' }}>Actuel</th><th style={{ ...th, textAlign: 'right' }}>Après</th></tr></thead>
              <tbody>
                {kpiRows.map((r) => (
                  <tr key={r.label}>
                    <td style={{ ...td, fontWeight: r.strong ? 500 : 400 }}>{r.label}</td>
                    <td style={{ ...td, textAlign: 'right', color: MUTED }}>
                      {r.f(r.a)}{r.sub && <div style={{ fontSize: 11 }}>{fmt(r.sub[0], 1)} %</div>}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: r.strong ? 500 : 400 }}>
                      {r.f(r.b)}{r.sub && <div style={{ fontSize: 11, color: MUTED }}>{fmt(r.sub[1], 1)} %</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '20px 0 8px' }}>D'où vient l'écart</div>
            {[['Coefficients', split.marges], ['Ampleur', split.ampleur], ['Temps de production', split.temps]].map(([label, v]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0' }}>
                <span style={{ color: '#374151' }}>{label}</span>
                <span style={{ color: Math.abs(v) < 0.5 ? '#9CA3AF' : '#111827' }}>{signed(v, eur.format)}</span>
              </div>
            ))}

            <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', margin: '20px 0 8px' }}>
              Lignes modifiées {lineDiffs.length > 0 && <span style={{ color: MUTED, fontWeight: 400 }}>({lineDiffs.length})</span>}
            </div>
            {lineDiffs.length === 0 ? <Empty>Aucune ligne ne change pour l'instant.</Empty> : (
              <div style={{ display: 'grid', gap: 2 }}>
                {visibleLines.map((l) => (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', gap: 10, fontSize: 12, padding: '5px 0', borderTop: `1px solid ${LINE}` }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#374151' }} title={l.label}>{l.label}</span>
                    <span style={{ color: MUTED }}>{eur.format(l.before)} → {eur.format(l.after)}</span>
                    <span style={{ minWidth: 64, textAlign: 'right', color: l.delta < 0 ? '#B91C1C' : '#047857' }}>{signed(l.delta, eur.format)}</span>
                  </div>
                ))}
                {lineDiffs.length > 8 && (
                  <button type="button" onClick={() => setShowAllLines((s) => !s)} style={{ marginTop: 6, border: 'none', background: 'none', color: NAVY, fontSize: 12, cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                    {showAllLines ? 'Réduire' : `Voir les ${lineDiffs.length} lignes`}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DaDialog>
  );
}

function SuggestionRow({ text, onApply }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#374151' }}>
      <span style={{ flex: 1 }}>{text}</span>
      <ToolbarButton onClick={onApply}>Appliquer</ToolbarButton>
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize: 13, color: '#9CA3AF' }}>{children}</div>;
}

function ScenarioCard({ title, ca, lines, onApply, primary = false }) {
  return (
    <div style={{ border: `1px solid ${primary ? NAVY : LINE}`, borderRadius: 8, padding: '10px 12px', background: 'white' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{title}</div>
          <div style={{ fontSize: 12, color: MUTED }}>→ {eur.format(ca)} HT</div>
        </div>
        <ToolbarButton primary={primary} onClick={onApply}>Appliquer</ToolbarButton>
      </div>
      {lines.length > 0 && (
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 12, color: '#374151', lineHeight: 1.6 }}>
          {lines.map((c, i) => <li key={i}>{c.group} · {c.label} : {c.from} → <b style={{ fontWeight: 500 }}>{c.to}</b></li>)}
        </ul>
      )}
    </div>
  );
}

// Sélecteur des leviers autorisés pour la recommandation, groupés (coefficients, ampleur, temps).
function LeverPicker({ levers, value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const groups = [...new Set(levers.map((l) => l.group))];
  const toggle = (id) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const summary = groups
    .map((g) => [g, levers.filter((l) => l.group === g && value.includes(l.id)).length])
    .filter(([, n]) => n > 0)
    .map(([g, n]) => `${g} (${n})`)
    .join(' · ');
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px', borderRadius: 8, border: '1px solid #E0DED9', background: 'white', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', color: '#111827' }}
      >
        <span style={{ color: '#9B9A97' }}>Leviers</span>
        <span style={{ fontWeight: 500 }}>{summary || 'aucun'}</span>
        <ChevronDown size={14} color={MUTED} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 80 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 4, width: 280, background: 'white', borderRadius: 8, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #E0DED9', zIndex: 90, padding: 4, maxHeight: 360, overflowY: 'auto' }}>
            {groups.map((g) => (
              <div key={g}>
                <div style={{ fontSize: 11, color: '#9CA3AF', padding: '8px 12px 4px', textTransform: 'uppercase', letterSpacing: 0.4 }}>{g}</div>
                {levers.filter((l) => l.group === g).map((l) => {
                  const on = value.includes(l.id);
                  return (
                    <div key={l.id} onClick={() => toggle(l.id)} style={{ padding: '7px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, background: on ? '#EEF4FD' : 'transparent' }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${on ? NAVY : '#C9C7C2'}`, background: on ? NAVY : 'white' }}>
                        {on && <Check size={11} color="white" strokeWidth={3} />}
                      </span>
                      <span style={{ flex: 1 }}>{l.label}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
