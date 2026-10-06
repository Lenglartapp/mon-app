// Module « Créer le devis Odoo » depuis une minute — MAQUETTE.
// 4 étapes : Destinataire → Structure → Articles → Aperçu.
// Lecture seule côté Odoo : le bouton final « Créer » n'écrit encore rien.

import React from 'react';
import Dialog from '@mui/material/Dialog';
import { X, Search, Check, ArrowLeft, ArrowRight, AlertTriangle, GripVertical, ChevronUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import {
  COMPONENTS, COMPONENT_BY_KEY, AUTO_PRODUCTS, GROUP_BY_OPTIONS, PRODUCT_TYPES, CHARGE_SPECIAL_HOSTS,
  defaultConfig, normalizeConfig, overrideKey, recipeOf, chargeSetting, buildQuote,
} from '../../lib/odoo/quoteBuilder';

const PGRID = '1.2fr 2.2fr 0.7fr 0.8fr 0.9fr 0.8fr 0.45fr';
const PROFILE_KEY = 'df.odooQuote.profile.v2';
const STEPS = ['Destinataire', 'Structure', 'Recettes', 'Aperçu'];
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
  const placeable = presentComps.filter((c) => c.key !== 'livraison');
  const families = [...new Set(placeable.map((c) => c.family))];
  const setPlacement = (key, placement) =>
    setConfig((cfg) => ({ ...cfg, placement: { ...cfg.placement, [key]: placement } }));
  const logi = config.logistique || 'fondu';

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
        <H sub="Déplacements (main-d'œuvre, heures et frais : hôtels, repas, billets), livraison et transport.">Déplacement & transport</H>
        <Seg value={logi} onChange={(v) => setConfig((c) => ({ ...c, logistique: v }))}
          options={[{ value: 'fondu', label: 'Fondus dans chaque section' }, { value: 'isole', label: 'Isolés dans une section' }]} />
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
          {logi === 'fondu'
            ? "Chaque section reçoit sa part de déplacement (au prorata de son montant) ; la livraison reste dans sa section et porte les coûts de transport."
            : "Une section « DÉPLACEMENT & TRANSPORT » en fin de devis porte toute la livraison, les déplacements, leurs heures et tous leurs coûts (transport, location…)."}
        </div>
      </div>

      <div style={{ marginTop: 28 }}>
        <H sub="« À part » sort ce coût des sections et le regroupe dans une section dédiée en fin de devis.">Coûts inclus ou à part</H>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
          {families.map((fam) => (
            <React.Fragment key={fam}>
              <div style={{ background: C.grey, padding: '7px 14px', fontSize: 12, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4 }}>{fam}</div>
              {placeable.filter((c) => c.family === fam).map((c) => (
                <div key={c.key} style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderTop: `1px solid ${C.grey}` }}>
                  <div style={{ flex: 1, fontSize: 13.5, color: C.text }}>{c.label}</div>
                  <Seg value={config.placement?.[c.key] || 'section'} onChange={(v) => setPlacement(c.key, v)}
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

// ─── Étape 3 : recettes ────────────────────────────────────────────────────────
const RGRID = '22px 1.1fr 1.3fr 1.6fr 0.75fr 0.6fr 0.55fr 44px';

function ProductSelect({ value, onChange, products, autoKeys = [], emptyLabel = '— à choisir —', allowEmpty = false, style }) {
  const val = (() => {
    if (!value || String(value).startsWith('@')) return value || '';
    const p = products.find((x) => String(x.id) === String(value) || x.name === value);
    return p ? String(p.id) : '';
  })();
  return (
    <select style={{ ...inputStyle, padding: '6px 8px', ...style }} value={val} onChange={(e) => onChange(e.target.value)}>
      {(!val || allowEmpty) && <option value="">{emptyLabel}</option>}
      {autoKeys.map((k) => <option key={k} value={k}>{AUTO_PRODUCTS[k]}</option>)}
      <optgroup label="Articles Odoo">
        {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.uom === 'ml' ? ' (ml)' : ''}{p.tag ? `  ·  ${p.tag}` : ''}</option>)}
      </optgroup>
    </select>
  );
}

// Étiquette analytique Odoo de l'article choisi (« Auto » : celles des articles retenus).
function TagHint({ names }) {
  const tags = [...new Set(names.filter(Boolean))];
  if (!tags.length) return null;
  return <div style={{ fontSize: 11.5, color: C.accent, marginTop: 3 }}>Étiquette : {tags.join(', ')}</div>;
}

function ColChips({ cols, onRemove, onAdd, available }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
      {cols.map((k) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, background: C.grey, borderRadius: 5, padding: '2px 4px 2px 7px', color: '#374151' }}>
          {COMPONENT_BY_KEY.get(k)?.label || k}
          <button onClick={() => onRemove(k)} title="Retirer cette colonne" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: C.soft, display: 'inline-flex' }}><X size={12} /></button>
        </span>
      ))}
      {available.length > 0 && (
        <select value="" onChange={(e) => e.target.value && onAdd(e.target.value)}
          style={{ border: `1px dashed ${C.border}`, borderRadius: 5, fontSize: 11.5, color: C.muted, background: 'white', padding: '1px 2px', fontFamily: 'inherit', maxWidth: 110 }}>
          <option value="">+ colonne</option>
          {available.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      )}
    </div>
  );
}

function StepRecipes({ config, setConfig, catalog, quote }) {
  const products = catalog?.products || [];
  const tagOf = (id) => products.find((p) => p.id === id)?.tag;
  const types = quote.types.length ? quote.types : [{ key: PRODUCT_TYPES[0].key, label: PRODUCT_TYPES[0].label, rows: 0 }];
  const [typeKey, setTypeKey] = React.useState(types[0].key);
  const activeType = types.find((t) => t.key === typeKey) ? typeKey : types[0].key;
  const slots = recipeOf(config, activeType);
  const [openId, setOpenId] = React.useState(null);
  const [drag, setDrag] = React.useState(null); // { id, order } : ordre provisoire pendant le glisser

  const setSlots = (fn) => setConfig((cfg) => ({ ...cfg, recipes: { ...cfg.recipes, [activeType]: fn(recipeOf(cfg, activeType)) } }));
  const patchSlot = (id, patch) => setSlots((list) => list.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)));
  const usedCols = new Set(slots.flatMap((sl) => sl.cols));
  const freeCols = COMPONENTS.filter((c) => !usedCols.has(c.key));

  // Lignes du devis produites par chaque ligne de recette (montants, articles retenus).
  const linesOf = (slotId) => quote.sections.flatMap((sec) => sec.lines.map((l) => ({ ...l, section: sec.title, apart: sec.apart })))
    .filter((l) => l.typeKey === activeType && l.slotId === slotId);

  // Ordre (avec aperçu en direct pendant le glisser-déposer).
  const visible = drag ? drag.order.map((id) => slots.find((sl) => sl.id === id)) : slots;
  const commit = (order) => setSlots((list) => order.map((id) => list.find((sl) => sl.id === id)));
  const stepMove = (id, dir) => {
    const order = slots.map((sl) => sl.id);
    const i = order.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    commit(order);
  };
  const onDragOverRow = (e, overId) => {
    e.preventDefault();
    if (!drag || overId === drag.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const order = drag.order.filter((id) => id !== drag.id);
    order.splice(order.indexOf(overId) + (after ? 1 : 0), 0, drag.id);
    if (order.join() !== drag.order.join()) setDrag({ ...drag, order });
  };

  const setOverride = (title, slotId, product) => setConfig((cfg) => {
    const ok = overrideKey(cfg.groupBy, title);
    const cur = { ...(cfg.overrides?.[ok] || {}) };
    const k = `${activeType}:${slotId}`;
    if (product) cur[k] = product; else delete cur[k];
    return { ...cfg, overrides: { ...cfg.overrides, [ok]: cur } };
  });
  const addSlot = () => setSlots((list) => [...list, { id: `perso_${Date.now()}`, label: 'Nouvelle ligne', cols: [], product: '' }]);
  const resetType = () => setConfig((cfg) => { const r = { ...cfg.recipes }; delete r[activeType]; return { ...cfg, recipes: r }; });

  const sectionTitles = quote.sections.filter((sec) => !sec.apart).map((sec) => sec.title);

  return (
    <div>
      <H sub="Une recette par type de produit : la liste ordonnée des lignes Odoo qui le composent, chacune alimentée par une ou plusieurs colonnes de la minute. Dans une section avec plusieurs produits, les recettes s'empilent ; une ligne sans montant n'apparaît pas.">Recettes par type de produit</H>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {types.map((t) => (
          <button key={t.key} onClick={() => { setTypeKey(t.key); setOpenId(null); }}
            style={{ border: `1px solid ${t.key === activeType ? C.text : C.border}`, background: t.key === activeType ? C.text : 'white', color: t.key === activeType ? 'white' : '#374151',
              borderRadius: 999, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            {t.label} <span style={{ opacity: 0.6 }}>· {t.rows}</span>
          </button>
        ))}
      </div>

      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: RGRID, gap: 10, padding: '8px 14px', fontSize: 12, color: C.soft, borderBottom: `1px solid ${C.border}` }}>
          <div /><div>Ligne</div><div>Colonnes de la minute</div><div>Article Odoo</div><div>Unité</div><div style={{ textAlign: 'right' }}>Prix</div><div style={{ textAlign: 'right' }}>Coût</div><div />
        </div>
        {visible.map((sl, i) => {
          const lines = linesOf(sl.id);
          const pv = lines.reduce((a, l) => a + l.subtotal, 0);
          const cost = lines.reduce((a, l) => a + l.cost, 0);
          const empty = !lines.length;
          const mlCapable = sl.cols.some((k) => COMPONENT_BY_KEY.get(k)?.mlKey);
          const secs = [...new Map(lines.filter((l) => !l.apart).map((l) => [l.section, l])).values()];
          const nbOv = secs.filter((l) => config.overrides?.[overrideKey(config.groupBy, l.section)]?.[`${activeType}:${sl.id}`]).length;
          const isOpen = openId === sl.id;
          return (
            <div key={sl.id}
              draggable
              onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ id: sl.id, order: slots.map((x) => x.id) }); }}
              onDragOver={(e) => onDragOverRow(e, sl.id)}
              onDrop={(e) => { e.preventDefault(); if (drag) commit(drag.order); setDrag(null); }}
              onDragEnd={() => setDrag(null)}
              style={{ borderTop: i ? `1px solid ${C.grey}` : 'none', ...(drag?.id === sl.id
                ? { background: '#F3EEF2', outline: `2px dashed ${C.accent}`, outlineOffset: -2 }
                : { background: 'white' }) }}>
              <div style={{ display: 'grid', gridTemplateColumns: RGRID, gap: 10, alignItems: 'center', padding: '7px 14px', opacity: empty ? 0.5 : 1 }}>
                <GripVertical size={15} color={C.soft} style={{ cursor: 'grab' }} />
                <input value={sl.label} onChange={(e) => patchSlot(sl.id, { label: e.target.value })}
                  style={{ ...inputStyle, padding: '5px 7px', fontSize: 13, fontWeight: 600 }} title="Nom de la ligne (pour toi ; n'apparaît pas sur le devis)" />
                <ColChips cols={sl.cols} available={freeCols}
                  onRemove={(k) => patchSlot(sl.id, { cols: sl.cols.filter((x) => x !== k) })}
                  onAdd={(k) => patchSlot(sl.id, { cols: [...sl.cols, k] })} />
                <div>
                  <ProductSelect value={sl.product} products={products} autoKeys={Object.keys(AUTO_PRODUCTS)} onChange={(v) => patchSlot(sl.id, { product: v })} />
                  <TagHint names={lines.map((l) => tagOf(l.productId))} />
                </div>
                <div>
                  {mlCapable ? (
                    <Seg value={sl.unit || 'forfait'} onChange={(v) => patchSlot(sl.id, { unit: v })}
                      options={[{ value: 'ml', label: 'ml' }, { value: 'forfait', label: 'Forfait' }]} />
                  ) : <span style={{ fontSize: 12.5, color: C.soft }}>Forfait</span>}
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, textAlign: 'right' }}>{empty ? '—' : eur(pv)}</div>
                <div style={{ fontSize: 12.5, color: cost ? C.muted : C.soft, textAlign: 'right' }}>{cost ? eur(cost) : '—'}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <button onClick={() => stepMove(sl.id, -1)} disabled={i === 0} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: i === 0 ? C.border : C.muted }}><ChevronUp size={15} /></button>
                    <button onClick={() => stepMove(sl.id, 1)} disabled={i === visible.length - 1} style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: i === visible.length - 1 ? C.border : C.muted }}><ChevronDown size={15} /></button>
                  </div>
                  <button onClick={() => setSlots((list) => list.filter((x) => x.id !== sl.id))} title="Supprimer cette ligne de la recette (ses colonnes iront en fin de recette)"
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', color: C.soft }}><Trash2 size={14} /></button>
                </div>
              </div>
              {secs.length > 1 && (
                <div style={{ padding: '0 14px 8px 46px' }}>
                  <button onClick={() => setOpenId(isOpen ? null : sl.id)}
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, color: C.accent, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    <ChevronRight size={13} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }} />
                    Article différent selon la section{nbOv ? ` (${nbOv} personnalisée${nbOv > 1 ? 's' : ''})` : ''}
                  </button>
                  {isOpen && (
                    <div style={{ marginTop: 8, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                      {secs.map((l, j) => {
                        const ov = config.overrides?.[overrideKey(config.groupBy, l.section)]?.[`${activeType}:${sl.id}`] || '';
                        return (
                          <div key={l.section} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 10, alignItems: 'center', padding: '6px 10px', borderTop: j ? `1px solid ${C.grey}` : 'none', background: ov ? '#FBF8FA' : 'white' }}>
                            <div style={{ fontSize: 13, color: C.text }}>{l.section || '(section unique)'}</div>
                            <ProductSelect value={ov} products={products} onChange={(v) => setOverride(l.section, sl.id, v)}
                              allowEmpty emptyLabel={ov ? '= Règle de la recette' : `= Règle de la recette (${l.productName})`} />
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
      <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
        <button onClick={addSlot} style={{ border: 'none', background: 'none', color: C.accent, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Plus size={14} /> Ajouter une ligne</button>
        <button onClick={resetType} style={{ border: 'none', background: 'none', color: C.muted, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>Rétablir la recette par défaut</button>
      </div>

      {quote.charges.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <H sub="Autres dépenses de la minute (sans prix de vente). Chacune est portée par un article dont l'étiquette analytique correspond à sa nature. La commission partenaire part dans le taux du devis Odoo.">Charges annexes</H>
          <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
            {quote.charges.map((ch, k) => {
              const { host, place } = chargeSetting(config, ch.key);
              const set = (patch) => setConfig((cfg) => ({ ...cfg, charges: { ...cfg.charges, [ch.key]: { ...chargeSetting(cfg, ch.key), ...patch } } }));
              const hostVal = CHARGE_SPECIAL_HOSTS[host]
                ? host
                : String(products.find((p) => String(p.id) === String(host) || p.name === host)?.id ?? 'none');
              const hostTag = products.find((p) => String(p.id) === hostVal)?.tag || (host === '@manufacture' ? 'ST Confection' : null);
              const showPlace = host !== 'none' && host !== '@commission';
              return (
                <div key={ch.key} style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.5fr 1.4fr 1.4fr', gap: 12, alignItems: 'start', padding: '8px 14px', borderTop: k ? `1px solid ${C.grey}` : 'none', opacity: host === 'none' ? 0.6 : 1 }}>
                  <div style={{ fontSize: 13.5, color: C.text, minWidth: 0, paddingTop: 6 }}>
                    {ch.label}
                    {ch.details.length > 0 && <div style={{ fontSize: 11.5, color: C.soft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.details.join(' · ')}</div>}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, textAlign: 'right', paddingTop: 6 }}>{eur(ch.amount)}</div>
                  <div>
                    <select style={{ ...inputStyle, padding: '6px 8px' }} value={hostVal} onChange={(e) => set({ host: e.target.value })}>
                      <option value="@commission">{CHARGE_SPECIAL_HOSTS['@commission']}</option>
                      <option value="@manufacture">{CHARGE_SPECIAL_HOSTS['@manufacture']}</option>
                      <optgroup label="Coût porté par l'article…">
                        {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.tag ? `  ·  ${p.tag}` : ''}</option>)}
                      </optgroup>
                      <option value="none">{CHARGE_SPECIAL_HOSTS.none}</option>
                    </select>
                    {host === '@commission'
                      ? <div style={{ fontSize: 11.5, color: C.accent, marginTop: 3 }}>Taux commission partenaire du devis : {num(quote.commissionPartenaire.rate)} %</div>
                      : host === 'none'
                        ? <div style={{ fontSize: 11.5, color: '#B45309', marginTop: 3 }}>Non reportée : la marge Odoo sera surestimée de {eur(ch.amount)}</div>
                        : hostTag && <div style={{ fontSize: 11.5, color: C.accent, marginTop: 3 }}>Étiquette : {hostTag}</div>}
                  </div>
                  {showPlace ? (
                    <select style={{ ...inputStyle, padding: '6px 8px' }} value={place} onChange={(e) => set({ place: e.target.value })}>
                      <option value="lignes">Sur les lignes existantes de l'article (sinon section isolée)</option>
                      <option value="isole">Ligne dans une section isolée en fin de devis</option>
                      <option value="reparti">Une ligne dans chaque section (au prorata)</option>
                      <optgroup label="Ligne dans la section…">
                        {sectionTitles.map((t) => <option key={t} value={`section:${t}`}>{t || '(section unique)'}</option>)}
                      </optgroup>
                    </select>
                  ) : <div />}
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
          ['Heures vendues', `Conf ${num(quote.hours.conf)} · Prépa ${num(quote.hours.prepa)} · Pose ${num(quote.hours.pose)}${quote.hours.depl ? ` · Dépl. ${num(quote.hours.depl)}` : ''}`],
          ['Prix de vente', ok ? `✅ ${eur(quote.total)} = minute` : `⚠️ Écart ${eur(quote.diff)}`],
          ['Coûts reportés (achats + charges)', Math.abs(quote.costDiff) < 1 ? `✅ ${eur(quote.cost + quote.commissionPartenaire.amount)} = minute` : `⚠️ écart ${eur(quote.costDiff)} avec la minute`],
          ['Commission partenaire', quote.commissionPartenaire.amount ? `${eur(quote.commissionPartenaire.amount)} → taux ${num(quote.commissionPartenaire.rate)} %` : 'Aucune'],
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
                <div style={{ fontWeight: 600, color: l.productId ? C.text : '#B91C1C' }}>
                  {l.productName}
                  {l.costOnly && <div style={{ fontSize: 11, fontWeight: 500, color: C.accent }}>coût seul</div>}
                </div>
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
export default function OdooQuoteWizard({ open, onClose, minute, rows = [], depRows = [], extraRows = [] }) {
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
  const { presentComps } = React.useMemo(() => {
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
    const presentComps = COMPONENTS.filter((c) => Math.abs(amounts[c.key] || 0) > 0.001 || Math.abs(costs[c.key] || 0) > 0.001);
    return { presentComps };
  }, [rows]);

  const quote = React.useMemo(
    () => buildQuote({ rows, depRows, extraRows, config, products: catalog?.products || [] }),
    [rows, depRows, extraRows, config, catalog]
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
            ? <StepRecipes config={config} setConfig={setConfig} catalog={catalog} quote={quote} />
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
