// Module « Créer le devis Odoo » depuis une minute — MAQUETTE.
// 4 étapes : Destinataire → Structure → Articles → Aperçu.
// Lecture seule côté Odoo : le bouton final « Créer » n'écrit encore rien.

import React from 'react';
import Dialog from '@mui/material/Dialog';
import { X, Search, Check, ArrowLeft, ArrowRight, AlertTriangle, GripVertical, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import {
  COMPONENTS, AUTO_PRODUCTS, GROUP_BY_OPTIONS, CHARGE_HOSTS, defaultConfig, normalizeConfig, overrideKey,
  defaultChargeHost, buildQuote,
} from '../../lib/odoo/quoteBuilder';

const PGRID = '1.2fr 2.2fr 0.7fr 0.8fr 0.9fr 0.8fr 0.45fr';
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
  try { return normalizeConfig(JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null')); }
  catch { return defaultConfig(); }
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
function OdooSearch({ action, initial = '', placeholder, render, onPick, selected }) {
  const selectedId = selected?.id;
  const [editing, setEditing] = React.useState(!selected);
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

  // Une fois choisi, la liste se replie sur une carte « sélectionné » + bouton Changer.
  if (selected && !editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, border: `1px solid ${C.text}`, background: C.grey, borderRadius: 8, padding: '10px 12px' }}>
        <Check size={16} color={C.text} />
        <div style={{ flex: 1, minWidth: 0 }}>{render(selected)}</div>
        <button onClick={() => setEditing(true)} style={{ border: `1px solid ${C.border}`, background: 'white', borderRadius: 6, padding: '5px 10px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>Changer</button>
      </div>
    );
  }
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
          <div key={it.id} onClick={() => { onPick(it); setEditing(false); }}
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
              selected={dest.opportunity}
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
          <Label>Client du devis{dest.mode === 'existing' && dest.partner && dest.opportunity?.partner?.id === dest.partner.id ? ' (repris de l\'opportunité)' : ''}</Label>
          <OdooSearch action="partners" initial={minute?.client || ''} placeholder="Société ou contact…"
            selected={dest.partner}
            onPick={(p) => set({ partner: p })}
            key={dest.partner?.id || 'none'}
            render={(p) => (
              <>
                <div style={{ fontSize: 13.5, fontWeight: p.isCompany ? 600 : 500, color: C.text }}>
                  {p.isCompany ? '🏢 ' : '👤 '}{p.name}{p.company && <span style={{ color: C.muted, fontWeight: 400 }}> · {p.company}</span>}
                </div>
                {(p.email || p.city) && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{[p.email, p.city].filter(Boolean).join(' · ')}</div>}
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
function SectionNames({ titles, max = 8 }) {
  const shown = titles.slice(0, max);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
      {shown.map((t) => (
        <span key={t || '_'} style={{ fontSize: 11.5, background: 'white', border: `1px solid ${C.border}`, borderRadius: 5, padding: '2px 6px', color: '#374151' }}>
          {t || '(sans titre)'}
        </span>
      ))}
      {titles.length > max && <span style={{ fontSize: 11.5, color: C.muted, padding: '2px 4px' }}>+{titles.length - max}</span>}
    </div>
  );
}

function StepStructure({ config, setConfig, presentComps, rows, depRows, quote }) {
  // Noms des sections que produirait chaque regroupement (hors sections « à part »).
  const titlesFor = (g) => buildQuote({ rows, depRows: [], config: { ...config, groupBy: g }, products: [] })
    .sections.filter((sec) => !sec.apart).map((sec) => sec.title);
  const families = [...new Set(presentComps.map((c) => c.family))];
  const setPlacement = (key, placement) =>
    setConfig((cfg) => ({ ...cfg, mapping: { ...cfg.mapping, [key]: { ...cfg.mapping[key], placement } } }));

  return (
    <div>
      <H sub="Chaque section du devis Odoo regroupe les lignes de la minute selon ce critère. Les étiquettes montrent les sections obtenues.">Regroupement des sections</H>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
        {GROUP_BY_OPTIONS.map((o) => {
          const on = config.groupBy === o.value;
          const titles = titlesFor(o.value);
          return (
            <div key={o.value} onClick={() => setConfig((c) => ({ ...c, groupBy: o.value }))}
              style={{ border: `1px solid ${on ? C.text : C.border}`, borderRadius: 10, padding: '12px 14px', cursor: 'pointer', background: on ? C.grey : 'white' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{o.label}</span>
                <span style={{ fontSize: 12.5, color: C.muted }}>{titles.length} section{titles.length > 1 ? 's' : ''}</span>
              </div>
              <SectionNames titles={titles} max={on ? 30 : 6} />
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
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 10 }}>
          Résultat : <SectionNames titles={quote.sections.map((x) => x.title)} max={40} />
        </div>
      </div>
    </div>
  );
}

// ─── Étape 3 : articles ────────────────────────────────────────────────────────
const GRID = '22px 1.15fr 0.55fr 0.55fr 1.7fr 0.75fr 26px';

function ProductSelect({ value, onChange, products, autoKey, emptyLabel = '— à choisir —', allowEmpty = false, style }) {
  const val = (() => {
    if (!value || String(value).startsWith('@')) return value || '';
    const p = products.find((x) => String(x.id) === String(value) || x.name === value);
    return p ? String(p.id) : '';
  })();
  return (
    <select style={{ ...inputStyle, padding: '6px 8px', ...style }} value={val} onChange={(e) => onChange(e.target.value)}>
      {autoKey && <option value={autoKey}>{AUTO_PRODUCTS[autoKey]}</option>}
      {(!val || allowEmpty) && <option value="">{emptyLabel}</option>}
      {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.uom === 'ml' ? ' (ml)' : ''}</option>)}
    </select>
  );
}

function StepArticles({ config, setConfig, presentComps, catalog, amounts, costs, quote }) {
  const products = catalog?.products || [];
  const [openKey, setOpenKey] = React.useState(null);
  // Articles effectivement présents dans le devis (hôtes possibles d'une charge).
  const usedProducts = [...new Map(quote.sections.flatMap((sec) => sec.lines)
    .filter((l) => l.productId).map((l) => [l.productId, { id: l.productId, name: l.productName }])).values()]
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const setMap = (key, patch) =>
    setConfig((cfg) => ({ ...cfg, mapping: { ...cfg.mapping, [key]: { ...cfg.mapping[key], ...patch } } }));

  // Ordre vertical : uniquement les colonnes présentes dans la minute, dans l'ordre du réglage.
  const present = new Set(presentComps.map((c) => c.key));
  const savedOrder = config.order.filter((k) => present.has(k));
  const [drag, setDrag] = React.useState(null); // { key, order } : ordre provisoire pendant le glisser
  const visibleOrder = drag ? drag.order : savedOrder;
  const ordered = visibleOrder.map((k) => COMPONENTS.find((c) => c.key === k));
  const commit = (order) => setConfig((cfg) => {
    // On réinsère l'ordre des colonnes présentes dans l'ordre complet (les absentes gardent leur place).
    const it = order[Symbol.iterator]();
    return { ...cfg, order: cfg.order.map((k) => (present.has(k) ? it.next().value : k)) };
  });
  const step = (key, dir) => {
    const order = [...savedOrder];
    const i = order.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    commit(order);
  };
  // Pendant le glisser, la ligne se déplace en direct à l'endroit où elle atterrira.
  const onDragOverRow = (e, overKey) => {
    e.preventDefault();
    if (!drag || overKey === drag.key) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const order = drag.order.filter((k) => k !== drag.key);
    const idx = order.indexOf(overKey) + (after ? 1 : 0);
    order.splice(idx, 0, drag.key);
    if (order.join() !== drag.order.join()) setDrag({ ...drag, order });
  };

  // Sections où chaque colonne apparaît, avec l'article retenu (utile pour les choix « Auto »).
  const sectionsOf = (key) => quote.sections
    .filter((sec) => !sec.apart)
    .map((sec) => ({ title: sec.title, line: sec.lines.find((l) => l.compKeys.includes(key)) }))
    .filter((x) => x.line);
  const setOverride = (title, key, product) => setConfig((cfg) => {
    const ok = overrideKey(cfg.groupBy, title);
    const cur = { ...(cfg.overrides?.[ok] || {}) };
    if (product) cur[key] = product; else delete cur[key];
    return { ...cfg, overrides: { ...cfg.overrides, [ok]: cur } };
  });

  return (
    <div>
      <H sub="L'ordre de cette liste est l'ordre des lignes dans chaque section (glisse-dépose ou flèches). Deux colonnes vers le même article = une seule ligne.">Colonnes Droitfil → articles Odoo</H>
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, padding: '8px 14px', fontSize: 12, color: C.soft, borderBottom: `1px solid ${C.border}` }}>
          <div /><div>Colonne de la minute</div><div style={{ textAlign: 'right' }}>Prix de vente</div><div style={{ textAlign: 'right' }}>Coût</div><div>Article Odoo</div><div>Unité</div><div />
        </div>
        {ordered.map((c, i) => {
          const m = config.mapping[c.key] || {};
          const autoKey = AUTO_PRODUCTS[c.defaultProduct] ? c.defaultProduct : null;
          const apart = m.placement === 'apart';
          const secs = apart ? [] : sectionsOf(c.key);
          const nbOverrides = secs.filter((x) => config.overrides?.[overrideKey(config.groupBy, x.title)]?.[c.key]).length;
          const isOpen = openKey === c.key;
          return (
            <div key={c.key}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ key: c.key, order: savedOrder }); }}
              onDragOver={(e) => onDragOverRow(e, c.key)}
              onDrop={(e) => { e.preventDefault(); if (drag) commit(drag.order); setDrag(null); }}
              onDragEnd={() => setDrag(null)}
              style={{
                borderTop: i ? `1px solid ${C.grey}` : 'none',
                transition: 'background .12s',
                ...(drag?.key === c.key
                  ? { background: '#F3EEF2', outline: `2px dashed ${C.accent}`, outlineOffset: -2, opacity: 0.85 }
                  : { background: 'white' }),
              }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center', padding: '7px 14px' }}>
                <GripVertical size={15} color={C.soft} style={{ cursor: 'grab' }} />
                <div style={{ fontSize: 13.5, color: C.text, minWidth: 0 }}>
                  {c.label}
                  <div style={{ fontSize: 11.5, color: C.soft }}>
                    {c.family}{c.hoursKey ? ' · porte les heures' : ''}{apart ? ' · à part' : ''}
                  </div>
                </div>
                <div style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{eur(amounts[c.key])}</div>
                <div style={{ fontSize: 13, color: costs[c.key] ? C.muted : C.soft, textAlign: 'right' }}>{costs[c.key] ? eur(costs[c.key]) : '—'}</div>
                <ProductSelect value={m.product} products={products} autoKey={autoKey} onChange={(v) => setMap(c.key, { product: v })} />
                <div>
                  {c.mlKey ? (
                    <Seg value={m.unit || 'ml'} onChange={(v) => setMap(c.key, { unit: v })}
                      options={[{ value: 'ml', label: 'ml' }, { value: 'forfait', label: 'Forfait' }]} />
                  ) : <span style={{ fontSize: 12.5, color: C.soft }}>Forfait</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <button onClick={() => step(c.key, -1)} disabled={i === 0} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: i === 0 ? C.border : C.muted }}><ChevronUp size={15} /></button>
                  <button onClick={() => step(c.key, 1)} disabled={i === ordered.length - 1} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: i === ordered.length - 1 ? C.border : C.muted }}><ChevronDown size={15} /></button>
                </div>
              </div>
              {secs.length > 1 && (
                <div style={{ padding: '0 14px 8px 46px' }}>
                  <button onClick={() => setOpenKey(isOpen ? null : c.key)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: C.accent, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                    Article différent selon la section{nbOverrides ? ` (${nbOverrides} personnalisée${nbOverrides > 1 ? 's' : ''})` : ''}
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      {secs.map(({ title, line }, j) => {
                        const ov = config.overrides?.[overrideKey(config.groupBy, title)]?.[c.key] || '';
                        return (
                          <div key={title} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, alignItems: 'center', padding: '6px 10px', borderTop: j ? `1px solid ${C.grey}` : 'none', background: ov ? '#FBF8FA' : 'white' }}>
                            <div style={{ fontSize: 13, color: C.text }}>{title || '(section unique)'}</div>
                            <ProductSelect value={ov} products={products} onChange={(v) => setOverride(title, c.key, v)}
                              allowEmpty emptyLabel={ov ? '= Règle générale' : `= Règle générale (${line.productName})`} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {quote.charges.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <H sub="Charges de la minute sans prix de vente (autres dépenses, commission). Elles s'ajoutent au coût des lignes choisies, au prorata de leur prix, pour que la marge Odoo soit complète.">Charges annexes</H>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {quote.charges.map((ch, k) => {
              const host = config.charges?.[ch.key] || defaultChargeHost(ch.key);
              const hostVal = host.startsWith('@') || host === 'none'
                ? host
                : String(products.find((p) => String(p.id) === String(host) || p.name === host)?.id ?? '');
              return (
                <div key={ch.key} style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.6fr 1.6fr', gap: 12, alignItems: 'center', padding: '8px 14px', borderTop: k ? `1px solid ${C.grey}` : 'none', opacity: host === 'none' ? 0.55 : 1 }}>
                  <div style={{ fontSize: 13.5, color: C.text, minWidth: 0 }}>
                    {ch.label}
                    {ch.details.length > 0 && <div style={{ fontSize: 11.5, color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.details.join(' · ')}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{eur(ch.amount)}</div>
                  <select style={{ ...inputStyle, padding: '6px 8px' }} value={hostVal}
                    onChange={(e) => setConfig((cfg) => ({ ...cfg, charges: { ...cfg.charges, [ch.key]: e.target.value } }))}>
                    {CHARGE_HOSTS.filter((h) => h.value !== 'none').map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
                    <optgroup label="Sur les lignes de l'article…">
                      {usedProducts.map((p) => <option key={p.id} value={String(p.id)}>{p.name}</option>)}
                    </optgroup>
                    <option value="none">Ne pas reporter</option>
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Étape 4 : aperçu ──────────────────────────────────────────────────────────
function StepPreview({ quote, dest }) {
  const ok = Math.abs(quote.diff) < 1;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['Opportunité', dest.mode === 'existing' ? (dest.opportunity?.name || '—') : `Nouvelle : ${dest.newName || '—'}`],
          ['Client', dest.partner ? (dest.partner.company ? `${dest.partner.company}, ${dest.partner.name}` : dest.partner.name) : '—'],
          ['Heures vendues', `Conf ${num(quote.hours.conf)} · Prépa ${num(quote.hours.prepa)} · Pose ${num(quote.hours.pose)}`],
          ['Prix de vente', ok ? `✅ ${eur(quote.total)} = minute` : `⚠️ Écart ${eur(quote.diff)}`],
          ['Coûts reportés (achats + charges)', Math.abs(quote.costDiff) < 1 ? `✅ ${eur(quote.cost)} = moulinette` : `⚠️ ${eur(quote.cost)} · écart ${eur(quote.costDiff)}`],
          ['Marge', quote.total ? `${eur(quote.total - quote.cost)} · ${(((quote.total - quote.cost) / quote.total) * 100).toFixed(1).replace('.', ',')} %` : '—'],
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
        <div style={{ display: 'grid', gridTemplateColumns: PGRID, gap: 10, padding: '9px 14px', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
          <div>Article</div><div>Description</div><div style={{ textAlign: 'right' }}>Quantité</div><div style={{ textAlign: 'right' }}>Prix unitaire</div><div style={{ textAlign: 'right' }}>Montant HT</div><div style={{ textAlign: 'right' }}>Coût</div><div style={{ textAlign: 'right' }}>H.</div>
        </div>
        {quote.sections.map((s) => (
          <React.Fragment key={s.title || '_'}>
            {s.title && (
              <div style={{ display: 'flex', justifyContent: 'space-between', background: '#E9ECEF', padding: '8px 14px', fontSize: 13.5, fontWeight: 700, color: C.text }}>
                <span>{s.title}</span><span>{eur(s.total)}</span>
              </div>
            )}
            {s.lines.map((l) => (
              <div key={l.key} style={{ display: 'grid', gridTemplateColumns: PGRID, gap: 10, padding: '9px 14px', borderTop: `1px solid ${C.grey}`, fontSize: 13, color: C.text, alignItems: 'start' }}>
                <div style={{ fontWeight: 600, color: l.productId ? C.text : '#B91C1C' }}>{l.productName}</div>
                <div style={{ whiteSpace: 'pre-line', color: '#374151', lineHeight: 1.45 }}>{l.description.split('\n').slice(1).join('\n') || '—'}</div>
                <div style={{ textAlign: 'right' }}>{num(l.qty)} {l.uom}</div>
                <div style={{ textAlign: 'right' }}>{eur(l.priceUnit)}</div>
                <div style={{ textAlign: 'right', fontWeight: 600 }}>{eur(l.subtotal)}</div>
                <div style={{ textAlign: 'right', color: l.cost ? C.muted : C.soft }} title={l.cost ? [`Coût unitaire Odoo : ${eur(l.costUnit)}`, ...l.charges.map((c) => `dont ${c.label} : ${eur(c.amount)}`)].join('\n') : ''}>
                  {l.cost ? eur(l.cost) : '—'}{l.charges.length > 0 && <sup style={{ color: C.accent }}> +</sup>}
                </div>
                <div style={{ textAlign: 'right', color: l.hours ? C.text : C.soft }}>{l.hours ? num(l.hours) : '—'}</div>
              </div>
            ))}
          </React.Fragment>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '12px 14px', borderTop: `1px solid ${C.border}`, fontSize: 14.5, fontWeight: 700 }}>
          <span style={{ color: C.muted, fontWeight: 500 }}>Coût {eur(quote.cost)}</span>
          <span style={{ color: C.muted, fontWeight: 500 }}>Total HT</span><span>{eur(quote.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Module ────────────────────────────────────────────────────────────────────
export default function OdooQuoteWizard({ open, onClose, minute, rows = [], depRows = [], extraRows = [], commissionRate = 0 }) {
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
  const { presentComps, amounts, costs } = React.useMemo(() => {
    const amounts = {};
    const costs = {};
    for (const r of rows) {
      const q = Math.max(1, toNum(r.quantite));
      for (const c of COMPONENTS) {
        if (c.key === '__deplacement') continue;
        amounts[c.key] = (amounts[c.key] || 0) + toNum(r[c.key]);
        if (c.paKey) costs[c.key] = (costs[c.key] || 0) + toNum(r[c.paKey]) * q;
      }
    }
    amounts.__deplacement = depRows.reduce((a, r) => a + toNum(r.prix_total), 0);
    costs.__deplacement = depRows.reduce((a, r) => a + toNum(r.cout_nuits) + toNum(r.cout_repas) + toNum(r.cout_billet_total), 0);
    const presentComps = COMPONENTS.filter((c) => Math.abs(amounts[c.key] || 0) > 0.001 || Math.abs(costs[c.key] || 0) > 0.001);
    return { presentComps, amounts, costs };
  }, [rows, depRows]);

  const quote = React.useMemo(
    () => buildQuote({ rows, depRows, extraRows, commissionRate, config, products: catalog?.products || [] }),
    [rows, depRows, extraRows, commissionRate, config, catalog]
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
          {step === 1 && <StepStructure config={config} setConfig={setConfig} presentComps={presentComps} rows={rows} depRows={depRows} quote={quote} />}
          {step === 2 && (catalog
            ? <StepArticles config={config} setConfig={setConfig} presentComps={presentComps} catalog={catalog} amounts={amounts} costs={costs} quote={quote} />
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
