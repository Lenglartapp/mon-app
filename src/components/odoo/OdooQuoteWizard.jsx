// Module « Créer le devis Odoo » depuis une minute — MAQUETTE.
// 4 étapes : Destinataire → Structure → Articles → Aperçu.
// Lecture seule côté Odoo : le bouton final « Créer » n'écrit encore rien.

import React from 'react';
import Dialog from '@mui/material/Dialog';
import { X, Search, Check, ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';
import {
  COMPONENTS, AUTO_PRODUCTS, GROUP_BY_OPTIONS, defaultConfig, buildQuote,
} from '../../lib/odoo/quoteBuilder';

const PROFILE_KEY = 'df.odooQuote.profile.v1';
const STEPS = ['Destinataire', 'Structure', 'Articles', 'Aperçu'];
const C = { border: '#E0DED9', grey: '#F4F4F4', text: '#1F2937', muted: '#6B7280', soft: '#9B9A97', accent: '#714B67' };
const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const num = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n || 0);
const toNum = (v) => { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : 0; };

async function odoo(action, q = '') {
  const res = await fetch(`/api/odoo/quote-data?action=${action}&q=${encodeURIComponent(q)}`);
  const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
  if (!json.ok) throw new Error(json.error || 'Erreur Odoo');
  return json.data;
}

function loadProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null');
    if (!saved) return defaultConfig();
    const base = defaultConfig();
    return { ...base, ...saved, mapping: { ...base.mapping, ...(saved.mapping || {}) } };
  } catch { return defaultConfig(); }
}
function saveProfile(cfg) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(cfg)); } catch { /* navigation privée */ }
}

// ─── Petits éléments d'interface ──────────────────────────────────────────────
const inputStyle = { border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13.5, color: C.text, background: 'white', outline: 'none', fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const Label = ({ children }) => <div style={{ fontSize: 12.5, color: C.soft, marginBottom: 6 }}>{children}</div>;
const H = ({ children, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{children}</div>
    {sub && <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{sub}</div>}
  </div>
);
function Seg({ value, options, onChange }) {
  return (
    <div style={{ display: 'inline-flex', background: C.grey, borderRadius: 8, padding: 3, gap: 2 }}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)}
          style={{ border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
            background: value === o.value ? 'white' : 'transparent', color: value === o.value ? C.text : C.muted,
            fontWeight: value === o.value ? 600 : 500, boxShadow: value === o.value ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
function Btn({ primary, disabled, onClick, children, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', opacity: disabled ? 0.45 : 1,
        border: primary ? 'none' : `1px solid ${C.border}`, background: primary ? C.text : 'white', color: primary ? 'white' : '#374151' }}>
      {children}
    </button>
  );
}

// Champ de recherche Odoo avec résultats (opportunités ou clients).
function OdooSearch({ action, initial = '', placeholder, render, onPick, selectedId }) {
  const [q, setQ] = React.useState(initial);
  const [items, setItems] = React.useState([]);
  const [state, setState] = React.useState('idle');
  React.useEffect(() => {
    let alive = true;
    const t = setTimeout(async () => {
      if (action === 'partners' && q.trim().length < 2) { setItems([]); return; }
      setState('loading');
      try { const d = await odoo(action, q.trim()); if (alive) { setItems(d); setState('idle'); } }
      catch (e) { if (alive) setState(e.message); }
    }, 300);
    return () => { alive = false; clearTimeout(t); };
  }, [q, action]);
  return (
    <div>
      <div style={{ position: 'relative' }}>
        <Search size={15} style={{ position: 'absolute', left: 10, top: 10, color: C.soft }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, paddingLeft: 32 }} />
      </div>
      <div style={{ marginTop: 8, maxHeight: 260, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 8 }}>
        {state === 'loading' && <div style={{ padding: 12, fontSize: 13, color: C.muted }}>Recherche dans Odoo…</div>}
        {state !== 'loading' && state !== 'idle' && <div style={{ padding: 12, fontSize: 13, color: '#B91C1C' }}>{state}</div>}
        {state === 'idle' && items.length === 0 && <div style={{ padding: 12, fontSize: 13, color: C.muted }}>Aucun résultat.</div>}
        {items.map((it, i) => (
          <div key={it.id} onClick={() => onPick(it)}
            style={{ padding: '9px 12px', cursor: 'pointer', borderTop: i ? `1px solid ${C.grey}` : 'none',
              background: selectedId === it.id ? '#F3EEF2' : 'white', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>{render(it)}</div>
            {selectedId === it.id && <Check size={16} color={C.accent} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Étape 1 : destinataire ────────────────────────────────────────────────────
function StepRecipient({ minute, catalog, dest, setDest }) {
  const baseName = (minute?.name || '').replace(/\s+V\d+\b.*$/i, '').trim();
  const sectorTags = (catalog?.tags || []).filter((t) => /^Sct\./.test(t.name));
  const typeTags = (catalog?.tags || []).filter((t) => /^Tp\./.test(t.name));
  const set = (patch) => setDest((d) => ({ ...d, ...patch }));
  const partnerLabel = (p) => (p ? (p.company ? `${p.company}, ${p.name}` : p.name) : null);

  return (
    <div>
      <H sub="Le devis est rattaché à une opportunité Odoo. Choisis-en une existante ou crée-la.">Destinataire</H>
      <Seg value={dest.mode} onChange={(mode) => set({ mode })}
        options={[{ value: 'existing', label: 'Opportunité existante' }, { value: 'new', label: 'Nouvelle opportunité' }]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 24, marginTop: 20 }}>
        {dest.mode === 'existing' ? (
          <div>
            <Label>Opportunité</Label>
            <OdooSearch action="opportunities" initial={baseName} placeholder="Nom de l'opportunité ou du client…"
              selectedId={dest.opportunity?.id}
              onPick={(o) => set({ opportunity: o, partner: o.partner ? { id: o.partner.id, name: o.partner.name } : dest.partner })}
              render={(o) => (
                <>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{o.name}</div>
                  <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>
                    {[o.partner?.name, o.team, o.user, o.stage, `${o.nbQuotes} devis`].filter(Boolean).join(' · ')}
                  </div>
                </>
              )} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div><Label>Nom de l'opportunité</Label>
              <input style={inputStyle} value={dest.newName ?? baseName} onChange={(e) => set({ newName: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>Équipe</Label>
                <select style={inputStyle} value={dest.teamId || ''} onChange={(e) => set({ teamId: Number(e.target.value) || null })}>
                  <option value="">—</option>{(catalog?.teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></div>
              <div><Label>Commercial</Label>
                <select style={inputStyle} value={dest.userId || ''} onChange={(e) => set({ userId: Number(e.target.value) || null })}>
                  <option value="">—</option>{(catalog?.users || []).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></div>
              <div><Label>Secteur</Label>
                <select style={inputStyle} value={dest.sectorTag || ''} onChange={(e) => set({ sectorTag: Number(e.target.value) || null })}>
                  <option value="">—</option>{sectorTags.map((t) => <option key={t.id} value={t.id}>{t.name.replace(/^Sct\./, '')}</option>)}
                </select></div>
              <div><Label>Type de client</Label>
                <select style={inputStyle} value={dest.typeTag || ''} onChange={(e) => set({ typeTag: Number(e.target.value) || null })}>
                  <option value="">—</option>{typeTags.map((t) => <option key={t.id} value={t.id}>{t.name.replace(/^Tp\./, '')}</option>)}
                </select></div>
            </div>
          </div>
        )}

        <div>
          <Label>Client du devis {dest.partner && <b style={{ color: C.text }}>— {partnerLabel(dest.partner)}</b>}</Label>
          <OdooSearch action="partners" initial={minute?.client || ''} placeholder="Société ou contact…"
            selectedId={dest.partner?.id}
            onPick={(p) => set({ partner: p })}
            render={(p) => (
              <>
                <div style={{ fontSize: 13.5, fontWeight: p.isCompany ? 600 : 500, color: C.text }}>
                  {p.isCompany ? '🏢 ' : '👤 '}{p.name}{p.company && <span style={{ color: C.muted, fontWeight: 400 }}> · {p.company}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{[p.email, p.city].filter(Boolean).join(' · ') || '—'}</div>
              </>
            )} />
          <div style={{ fontSize: 12, color: C.soft, marginTop: 8 }}>
            Introuvable ? La création d'un client depuis Droitfil viendra dans une étape suivante.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Étape 2 : structure ───────────────────────────────────────────────────────
function StepStructure({ config, setConfig, presentComps, rows }) {
  const countFor = (g) => new Set(buildQuote({ rows, depRows: [], config: { ...config, groupBy: g }, products: [] }).sections.map((s) => s.title)).size;
  const families = [...new Set(presentComps.map((c) => c.family))];
  const setPlacement = (key, placement) =>
    setConfig((cfg) => ({ ...cfg, mapping: { ...cfg.mapping, [key]: { ...cfg.mapping[key], placement } } }));

  return (
    <div>
      <H sub="Chaque section du devis Odoo regroupe les lignes de la minute selon ce critère.">Regroupement des sections</H>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {GROUP_BY_OPTIONS.map((o) => {
          const on = config.groupBy === o.value;
          return (
            <div key={o.value} onClick={() => setConfig((c) => ({ ...c, groupBy: o.value }))}
              style={{ border: `1px solid ${on ? C.text : C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: on ? C.grey : 'white' }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{o.label}</div>
              <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3 }}>{countFor(o.value)} section(s)</div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 28 }}>
        <H sub="« À part » sort ce coût des sections et le regroupe dans une section dédiée en fin de devis.">Coûts inclus ou à part</H>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {families.map((fam) => (
            <React.Fragment key={fam}>
              <div style={{ background: C.grey, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{fam}</div>
              {presentComps.filter((c) => c.family === fam).map((c) => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: `1px solid ${C.grey}` }}>
                  <div style={{ flex: 1, fontSize: 13.5, color: C.text }}>{c.label}</div>
                  <Seg value={config.mapping[c.key]?.placement || 'section'} onChange={(v) => setPlacement(c.key, v)}
                    options={[{ value: 'section', label: 'Dans la section' }, { value: 'apart', label: 'À part' }]} />
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Étape 3 : articles ────────────────────────────────────────────────────────
function StepArticles({ config, setConfig, presentComps, catalog, amounts }) {
  const products = catalog?.products || [];
  const setMap = (key, patch) =>
    setConfig((cfg) => ({ ...cfg, mapping: { ...cfg.mapping, [key]: { ...cfg.mapping[key], ...patch } } }));
  const optionValue = (v) => {
    if (!v || v.startsWith?.('@')) return v || '';
    const p = products.find((x) => String(x.id) === String(v) || x.name === v);
    return p ? String(p.id) : '';
  };
  const families = [...new Set(presentComps.map((c) => c.family))];

  return (
    <div>
      <H sub="Choisis sous quel article Odoo part chaque colonne de prix. Deux colonnes vers le même article = une seule ligne (ex. méca + méca bis).">Colonnes Droitfil → articles Odoo</H>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.6fr 1.8fr 0.7fr', gap: 12, padding: '8px 14px', fontSize: 12, color: C.soft, borderBottom: `1px solid ${C.border}` }}>
          <div>Colonne de la minute</div><div style={{ textAlign: 'right' }}>Montant</div><div>Article Odoo</div><div>Unité</div>
        </div>
        {families.map((fam) => (
          <React.Fragment key={fam}>
            <div style={{ background: C.grey, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{fam}</div>
            {presentComps.filter((c) => c.family === fam).map((c) => {
              const m = config.mapping[c.key] || {};
              const autoKeys = Object.keys(AUTO_PRODUCTS).filter((k) => k === c.defaultProduct);
              return (
                <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.6fr 1.8fr 0.7fr', gap: 12, alignItems: 'center', padding: '7px 14px', borderTop: `1px solid ${C.grey}` }}>
                  <div style={{ fontSize: 13.5, color: C.text }}>
                    {c.label}{c.hoursKey && <span style={{ fontSize: 11.5, color: C.soft }}> · porte les heures</span>}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{eur(amounts[c.key])}</div>
                  <select style={{ ...inputStyle, padding: '6px 8px' }} value={optionValue(m.product)}
                    onChange={(e) => setMap(c.key, { product: e.target.value })}>
                    {autoKeys.map((k) => <option key={k} value={k}>{AUTO_PRODUCTS[k]}</option>)}
                    {!optionValue(m.product) && <option value="">— à choisir —</option>}
                    {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.uom === 'ml' ? ' (ml)' : ''}</option>)}
                  </select>
                  <div>
                    {c.mlKey ? (
                      <Seg value={m.unit || 'ml'} onChange={(v) => setMap(c.key, { unit: v })}
                        options={[{ value: 'ml', label: 'ml' }, { value: 'forfait', label: 'Forfait' }]} />
                    ) : <span style={{ fontSize: 12.5, color: C.soft }}>Forfait</span>}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ─── Étape 4 : aperçu ──────────────────────────────────────────────────────────
function StepPreview({ quote, dest }) {
  const ok = Math.abs(quote.diff) < 1;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['Opportunité', dest.mode === 'existing' ? (dest.opportunity?.name || '—') : `Nouvelle : ${dest.newName || '—'}`],
          ['Client', dest.partner ? (dest.partner.company ? `${dest.partner.company}, ${dest.partner.name}` : dest.partner.name) : '—'],
          ['Heures vendues', `Conf ${num(quote.hours.conf)} · Prépa ${num(quote.hours.prepa)} · Pose ${num(quote.hours.pose)}`],
          ['Contrôle', ok ? `✅ Devis = minute (${eur(quote.minuteTotal)})` : `⚠️ Écart ${eur(quote.diff)}`],
        ].map(([k, v]) => (
          <div key={k} style={{ background: C.grey, borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, color: C.soft }}>{k}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text, marginTop: 3 }}>{v}</div>
          </div>
        ))}
      </div>

      {quote.warnings.length > 0 && (
        <div style={{ border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
          {quote.warnings.map((w) => <div key={w} style={{ display: 'flex', gap: 6 }}><AlertTriangle size={14} style={{ marginTop: 2 }} />{w}</div>)}
        </div>
      )}

      {/* Rendu « façon Odoo » */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 2.4fr 0.7fr 0.8fr 0.9fr 0.5fr', gap: 10, padding: '9px 14px', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
          <div>Article</div><div>Description</div><div style={{ textAlign: 'right' }}>Quantité</div><div style={{ textAlign: 'right' }}>Prix unitaire</div><div style={{ textAlign: 'right' }}>Montant HT</div><div style={{ textAlign: 'right' }}>H.</div>
        </div>
        {quote.sections.map((s) => (
          <React.Fragment key={s.title || '_'}>
            {s.title && (
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#E9ECEF', padding: '8px 14px', fontSize: 13.5, fontWeight: 700, color: C.text }}>
                <span>{s.title}</span><span>{eur(s.total)}</span>
              </div>
            )}
            {s.lines.map((l) => (
              <div key={l.key} style={{ display: 'grid', gridTemplateColumns: '1.3fr 2.4fr 0.7fr 0.8fr 0.9fr 0.5fr', gap: 10, padding: '9px 14px', borderTop: `1px solid ${C.grey}`, fontSize: 13, color: C.text, alignItems: 'start' }}>
                <div style={{ fontWeight: 600, color: l.productId ? C.text : '#B91C1C' }}>{l.productName}</div>
                <div style={{ whiteSpace: 'pre-line', color: '#374151', lineHeight: 1.45 }}>{l.description.split('\n').slice(1).join('\n') || '—'}</div>
                <div style={{ textAlign: 'right' }}>{num(l.qty)} {l.uom}</div>
                <div style={{ textAlign: 'right' }}>{eur(l.priceUnit)}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{eur(l.subtotal)}</div>
                <div style={{ textAlign: 'right', color: l.hours ? C.text : C.soft }}>{l.hours ? num(l.hours) : '—'}</div>
              </div>
            ))}
          </React.Fragment>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '12px 14px', borderTop: `1px solid ${C.border}`, fontSize: 14.5, fontWeight: 700 }}>
          <span style={{ color: C.muted, fontWeight: 500 }}>Total HT</span><span>{eur(quote.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Module ────────────────────────────────────────────────────────────────────
export default function OdooQuoteWizard({ open, onClose, minute, rows = [], depRows = [] }) {
  const [step, setStep] = React.useState(0);
  const [catalog, setCatalog] = React.useState(null);
  const [catalogError, setCatalogError] = React.useState(null);
  const [config, setConfig] = React.useState(loadProfile);
  const [dest, setDest] = React.useState({ mode: 'existing', opportunity: null, partner: null });

  React.useEffect(() => {
    if (!open || catalog) return;
    odoo('catalog').then(setCatalog).catch((e) => setCatalogError(e.message));
  }, [open, catalog]);
  React.useEffect(() => { saveProfile(config); }, [config]);

  // Colonnes réellement utilisées par cette minute (+ montants pour l'étape Articles).
  const { presentComps, amounts } = React.useMemo(() => {
    const amounts = {};
    for (const r of rows) for (const c of COMPONENTS) if (c.key !== '__deplacement') amounts[c.key] = (amounts[c.key] || 0) + toNum(r[c.key]);
    amounts.__deplacement = depRows.reduce((a, r) => a + toNum(r.prix_total), 0);
    return { presentComps: COMPONENTS.filter((c) => Math.abs(amounts[c.key] || 0) > 0.001), amounts };
  }, [rows, depRows]);

  const quote = React.useMemo(
    () => buildQuote({ rows, depRows, config, products: catalog?.products || [] }),
    [rows, depRows, config, catalog]
  );

  const canNext = step !== 0 || ((dest.mode === 'existing' ? !!dest.opportunity : !!(dest.newName ?? minute?.name)) && !!dest.partner);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: '14px', fontFamily: 'Roboto, system-ui, sans-serif' } }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '86vh' }}>
        {/* En-tête + étapes */}
        <div style={{ padding: '18px 24px 0', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: C.text }}>Créer le devis dans Odoo</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{minute?.name} · {rows.length} ligne(s) · maquette (aucune écriture dans Odoo)</div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => (i <= step || canNext) && setStep(i)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px 10px', fontSize: 13.5,
                  color: i === step ? C.text : C.muted, fontWeight: i === step ? 600 : 500, borderBottom: `2px solid ${i === step ? C.text : 'transparent'}` }}>
                <span style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', fontSize: 11.5, marginRight: 7,
                  background: i < step ? C.text : i === step ? C.text : C.grey, color: i <= step ? 'white' : C.muted }}>{i < step ? '✓' : i + 1}</span>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Contenu */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
          {catalogError && (
            <div style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>
              Odoo injoignable : {catalogError}
            </div>
          )}
          {step === 0 && <StepRecipient minute={minute} catalog={catalog} dest={dest} setDest={setDest} />}
          {step === 1 && <StepStructure config={config} setConfig={setConfig} presentComps={presentComps} rows={rows} />}
          {step === 2 && (catalog
            ? <StepArticles config={config} setConfig={setConfig} presentComps={presentComps} catalog={catalog} amounts={amounts} />
            : <div style={{ fontSize: 13, color: C.muted }}>Chargement des articles Odoo…</div>)}
          {step === 3 && <StepPreview quote={quote} dest={dest} />}
        </div>

        {/* Pied */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setConfig(defaultConfig())} style={{ border: 'none', background: 'none', color: C.muted, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Réinitialiser les réglages
          </button>
          <div style={{ flex: 1, textAlign: 'right', fontSize: 13, color: C.muted }}>
            Total devis <b style={{ color: C.text }}>{eur(quote.total)}</b>
          </div>
          {step > 0 && <Btn onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Retour</Btn>}
          {step < STEPS.length - 1
            ? <Btn primary disabled={!canNext} onClick={() => setStep(step + 1)} title={canNext ? '' : 'Choisis une opportunité et un client'}>Suivant <ArrowRight size={15} /></Btn>
            : <Btn primary disabled title="Maquette : la création réelle sera branchée à l'étape suivante">Créer le devis brouillon dans Odoo</Btn>}
        </div>
      </div>
    </Dialog>
  );
}
