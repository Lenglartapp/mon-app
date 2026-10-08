// Module « Créer le devis Odoo » depuis une minute.
// 4 étapes : Opportunité → Structure → Détail → Aperçu.
// Écriture Odoo via sale.order.droitfil_upsert_devis (préproduction tant que le module est en test).

import React from 'react';
import Dialog from '@mui/material/Dialog';
import { X, Search, Check, ArrowLeft, ArrowRight, AlertTriangle, GripVertical, ChevronRight, Eye, EyeOff, Pencil } from 'lucide-react';
import { useAuth } from '../../auth';
import { loadSharedProfile, saveSharedProfile, saveMinuteQuote, minuteSettingsOf, SHARED_FIELDS } from '../../lib/odoo/quoteStore';
import {
  COMPONENT_BY_KEY, GROUP_BY_OPTIONS, SUB_GROUP_BY_OPTIONS, PRODUCT_TYPES,
  defaultConfig, normalizeConfig, overrideKey, recipeOf, chargeSetting, buildQuote, toOdooPayload, makeResolver,
} from '../../lib/odoo/quoteBuilder';

const PGRID = '1.2fr 2.2fr 0.7fr 0.8fr 0.9fr 0.8fr 0.45fr';
const DGRID = '18px 1.7fr 0.9fr 1.5fr 0.45fr 0.7fr 0.75fr 0.75fr';
const PROFILE_KEY = 'df.odooQuote.profile.v3';
const STEPS = ['Opportunité', 'Structure', 'Détail', 'Aperçu'];
const C = { border: '#E0DED9', grey: '#F4F4F4', text: '#1F2937', muted: '#6B7280', soft: '#9B9A97', accent: '#714B67' };
const eur = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n || 0);
const num = (n) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(n || 0);
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const typeLabel = (k) => PRODUCT_TYPES.find((t) => t.key === k)?.label || k;

// Sources d'opportunité réellement utilisées (utm.source, prod 2026).
const OPPORTUNITY_SOURCES = [
  { id: 2, name: 'Nouvelle consultation par un partenaire déjà connu' },
  { id: 11, name: "Nouvelle consultation par un partenaire car connaît quelqu'un qui nous connaît" },
  { id: 12, name: 'Nouvelle consultation par un nouveau partenaire' },
  { id: 7, name: 'Prospection Commerciale' },
  { id: 3, name: 'Site Internet' },
  { id: 6, name: 'Salon' },
];

// Commerciaux : la liste montre les personnes de Droitfil ; Odoo reçoit le compte correspondant.
// Muriel Blondeau et Emmanuel Peltier n'ont pas de compte commercial Odoo : ils créent sous l'ADV.
const ADV_FIRST_NAMES = ['muriel', 'emmanuel'];
const ADV_USER_NAME = 'Service Administration des Ventes';
function odooUserForDroitfil(dfUser, odooUsers = []) {
  if (!dfUser || !odooUsers.length) return null;
  const full = norm(dfUser.name || `${dfUser.first_name || ''} ${dfUser.last_name || ''}`).trim();
  const email = norm(dfUser.email);
  const direct = odooUsers.find((u) => u.teamId && u.name !== ADV_USER_NAME && (norm(u.name) === full || (email && norm(u.login) === email)));
  if (direct) return direct;
  const first = norm(dfUser.first_name || full).split(/\s+/)[0];
  if (ADV_FIRST_NAMES.includes(first)) return odooUsers.find((u) => u.name === ADV_USER_NAME) || null;
  return null;
}

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

// Descriptions retouchées à la main dans l'aperçu : gardées par minute (navigateur), clé =
// bloc (section/sous-section) + ligne. Elles remplacent le texte généré, y compris dans Odoo.
const TODO_RE = /\bXX\b|\sOU\s/;
const editsKey = (minuteId) => `df.odooQuote.texts.${minuteId}`;
function loadEdits(minuteId) {
  try { return JSON.parse(localStorage.getItem(editsKey(minuteId)) || '{}'); } catch { return {}; }
}
function saveEdits(minuteId, edits) {
  try { localStorage.setItem(editsKey(minuteId), JSON.stringify(edits)); } catch { /* navigation privée */ }
}
const editId = (block, line) => `${block.key}::${line.key}`;
function applyEdits(quote, edits) {
  const sections = quote.sections.map((b) => ({
    ...b,
    lines: b.lines.map((l) => {
      const e = edits[editId(b, l)];
      if (e == null) return l;
      return { ...l, description: `${l.productName}\n${e}`, edited: true, textTodo: e.split('\n').filter((t) => TODO_RE.test(t)).length };
    }),
  }));
  const todo = sections.flatMap((b) => b.lines).filter((l) => l.textTodo).length;
  const warnings = quote.warnings
    .filter((w) => !w.includes('« XX »'))
    .concat(todo ? [`${todo} description(s) contiennent encore des « XX » ou des choix « A OU B » à compléter (surlignés ci-dessous, crayon pour corriger).`] : []);
  return { ...quote, sections, warnings };
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

// ─── Étape 1 : opportunité ─────────────────────────────────────────────────────
function StepOpportunity({ minute, catalog, dest, setDest, commercials, needsApporteur }) {
  const baseName = (minute?.name || '').replace(/\s+V\d+\b.*$/i, '').trim();
  const sectorTags = (catalog?.tags || []).filter((t) => /^Sct\./.test(t.name));
  const typeTags = (catalog?.tags || []).filter((t) => /^Tp\./.test(t.name));
  const set = (patch) => setDest((d) => ({ ...d, ...patch }));

  return (
    <div>
      <H sub="Le devis est rattaché à une opportunité Odoo : nouvelle (par défaut) ou existante.">Opportunité</H>
      <Seg value={dest.mode} onChange={(mode) => set({ mode })}
        options={[{ value: 'new', label: 'Nouvelle opportunité' }, { value: 'existing', label: 'Opportunité existante' }]} />

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
                    {[o.partner?.name, o.team, o.user, o.stage, o.nbQuotes != null ? `${o.nbQuotes} devis` : 'opportunité du devis déjà créé'].filter(Boolean).join(' · ')}
                  </div>
                </>
              )} />
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            <div><Label>Nom de l'opportunité</Label>
              <input style={inputStyle} value={dest.newName ?? baseName} onChange={(e) => set({ newName: e.target.value })} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><Label>Commercial{dest.autoUser === 'owner' ? ' (chargé d\'affaires de la minute)' : dest.autoUser === 'me' ? ' (toi)' : ''}</Label>
                <select style={inputStyle} value={dest.dfUserId || ''} onChange={(e) => {
                  const c = commercials.find((x) => x.id === e.target.value);
                  set({ dfUserId: c?.id || null, userId: c?.odoo.id || null, teamId: c?.odoo.teamId || dest.teamId, autoUser: false });
                }}>
                  <option value="">—</option>
                  {commercials.map((c) => <option key={c.id} value={c.id}>{c.name}{c.odoo.name === ADV_USER_NAME ? ' (ADV dans Odoo)' : ''}</option>)}
                </select>
                {dest.userId && <div style={{ fontSize: 11.5, color: C.soft, marginTop: 4 }}>Dans Odoo : {(catalog?.users || []).find((u) => u.id === dest.userId)?.name}</div>}
              </div>
              <div><Label>Équipe</Label>
                <select style={inputStyle} value={dest.teamId || ''} onChange={(e) => set({ teamId: Number(e.target.value) || null })}>
                  <option value="">—</option>{(catalog?.teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select></div>
              <div><Label>Secteur *</Label>
                <select style={inputStyle} value={dest.sectorTag || ''} onChange={(e) => set({ sectorTag: Number(e.target.value) || null })}>
                  <option value="">—</option>{sectorTags.map((t) => <option key={t.id} value={t.id}>{t.name.replace(/^Sct\./, '')}</option>)}
                </select></div>
              <div><Label>Type de client *</Label>
                <select style={inputStyle} value={dest.typeTag || ''} onChange={(e) => set({ typeTag: Number(e.target.value) || null })}>
                  <option value="">—</option>{typeTags.map((t) => <option key={t.id} value={t.id}>{t.name.replace(/^Tp\./, '')}</option>)}
                </select></div>
              <div><Label>Signature possible *</Label>
                <input type="date" style={inputStyle} value={dest.signatureDate || ''} onChange={(e) => set({ signatureDate: e.target.value || null })} /></div>
              <div><Label>Importance *</Label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 36 }}>
                  {[1, 2, 3].map((n) => (
                    <button key={n} type="button" onClick={() => set({ priority: dest.priority === n ? 0 : n })}
                      title={['Faible', 'Moyenne', 'Haute', 'Très haute'][n]}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, padding: '0 2px', color: (dest.priority || 0) >= n ? '#F5B301' : '#D6D3D1' }}>★</button>
                  ))}
                  <span style={{ fontSize: 12, color: C.muted, marginLeft: 6 }}>
                    {dest.priority == null ? 'à choisir' : ['Faible (0 étoile)', 'Moyenne', 'Haute', 'Très haute'][dest.priority]}
                  </span>
                </div></div>
            </div>
            {dest.priority == null && <div style={{ fontSize: 11.5, color: C.soft, marginTop: -6 }}>Clique sur les étoiles (re-cliquer la même étoile = 0 étoile).</div>}
            <div><Label>Source</Label>
              <select style={inputStyle} value={dest.sourceId || ''} onChange={(e) => set({ sourceId: Number(e.target.value) || null })}>
                <option value="">—</option>{OPPORTUNITY_SOURCES.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select></div>
            <div><Label>Apporté par{needsApporteur ? ' * (la minute a une commission partenaire)' : ''}</Label>
              <OdooSearch action="partners" placeholder="Partenaire rémunéré…" selected={dest.apportePar}
                key={dest.apportePar?.id || 'aucun'}
                onPick={(p) => set({ apportePar: p })}
                render={(p) => <div style={{ fontSize: 13.5, color: C.text }}>{p.isCompany ? '🏢 ' : '👤 '}{p.name}{p.company && <span style={{ color: C.muted }}> · {p.company}</span>}</div>} />
            </div>
            <div><Label>Description (résumé de la demande)</Label>
              <textarea style={{ ...inputStyle, resize: 'vertical' }} rows={3} value={dest.description ?? (minute?.notes || '')}
                onChange={(e) => set({ description: e.target.value })} /></div>
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
// Uniquement la PRÉSENTATION : sections, sous-sections, et place du déplacement / transport.
// Lignes d'articles simulées (barres grises) sous une section ou une sous-section.
function FakeLines({ indent }) {
  return (
    <div style={{ padding: `6px 12px 8px ${indent ? 24 : 12}px`, display: 'grid', gap: 4 }}>
      {[0.62, 0.45].map((w) => (
        <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ height: 6, width: `${w * 100}%`, background: C.grey, borderRadius: 3 }} />
          <div style={{ flex: 1 }} />
          <div style={{ height: 6, width: 44, background: C.grey, borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

// Prévisualisation « façon Odoo » : sections grisées empilées, sous-sections dessous, montant à droite.
function StructurePreview({ blocks }) {
  const tree = [];
  for (const b of blocks) {
    let sec = tree[tree.length - 1];
    if (!sec || sec.title !== b.title) { sec = { title: b.title, total: 0, subs: [], apart: b.apart }; tree.push(sec); }
    sec.total += b.total;
    if (b.sub) sec.subs.push({ title: b.sub, total: b.total });
  }
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: 'white' }}>
      {tree.map((sec, i) => (
        <div key={`${sec.title}_${i}`} style={{ borderTop: i ? `1px solid ${C.border}` : 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', background: '#E9ECEF', padding: '7px 12px', fontSize: 13, fontWeight: 700, color: C.text }}>
            <span>{sec.title || '(section unique)'}</span><span>{eur(sec.total)}</span>
          </div>
          {sec.subs.length
            ? sec.subs.map((sub) => (
              <React.Fragment key={sub.title}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F7F7F5', padding: '6px 12px 6px 24px', fontSize: 12.5, fontWeight: 600, color: '#374151', borderTop: `1px solid ${C.grey}` }}>
                  <span>{sub.title}</span><span>{eur(sub.total)}</span>
                </div>
                <FakeLines indent />
              </React.Fragment>
            ))
            : <FakeLines />}
        </div>
      ))}
    </div>
  );
}

function StepStructure({ config, setConfig, rows, quote }) {
  const countFor = (g) => new Set(buildQuote({ rows, config: { ...config, groupBy: g, subGroupBy: 'none' }, products: [] })
    .sections.filter((b) => !b.apart).map((b) => b.title)).size;
  const logi = config.logistique || 'fondu';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 28, alignItems: 'start' }}>
      <div>
        <H sub="Comment le devis est découpé : les lignes de la minute sont regroupées selon ces critères.">Sections</H>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 8 }}>
          {GROUP_BY_OPTIONS.filter((o) => !o.value.includes('_')).map((o) => {
            const on = config.groupBy === o.value;
            const n = countFor(o.value);
            return (
              <div key={o.value} onClick={() => setConfig((c) => ({ ...c, groupBy: o.value, subGroupBy: c.subGroupBy === o.value ? 'none' : c.subGroupBy }))}
                style={{ border: `1px solid ${on ? C.text : C.border}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', background: on ? C.grey : 'white' }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{o.label}</div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2 }}>{n} section{n > 1 ? 's' : ''}</div>
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 22 }}>
          <H sub="Deuxième niveau dans chaque section (ex. Voilages › R+1, R+2).">Sous-sections</H>
          <Seg value={config.subGroupBy || 'none'} onChange={(v) => setConfig((c) => ({ ...c, subGroupBy: v }))}
            options={SUB_GROUP_BY_OPTIONS.filter((o) => o.value === 'none' || o.value !== config.groupBy)} />
        </div>

        <div style={{ marginTop: 22 }}>
          <H sub="Livraison, transport, location et déplacements (temps, hôtels, repas, billets).">Déplacement, transport et location</H>
          <Seg value={logi} onChange={(v) => setConfig((c) => ({ ...c, logistique: v }))}
            options={[{ value: 'fondu', label: 'Fondus dans chaque section' }, { value: 'isole', label: 'Section à part' }]} />
          <div style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
            {logi === 'fondu'
              ? 'Chaque section reçoit sa part de déplacement et de location (au prorata de son montant) ; la livraison reste avec ses produits.'
              : 'Une section « DÉPLACEMENT, TRANSPORT & LOCATION » en fin de devis porte la livraison, les déplacements et la location, avec tous leurs coûts.'}
          </div>
        </div>
      </div>

      <div style={{ position: 'sticky', top: 0 }}>
        <Label>Prévisualisation</Label>
        <StructurePreview blocks={quote.sections} />
      </div>
    </div>
  );
}

// ─── Étape 3 : détail ──────────────────────────────────────────────────────────
// Section par section : les lignes que Droitfil va créer, l'article Odoo retenu (modifiable),
// son étiquette, la colonne Droitfil d'origine, heures, quantité, prix, coût.
function ArticleSelect({ value, products, onChange }) {
  return (
    <select style={{ ...inputStyle, padding: '5px 7px', fontSize: 13, fontWeight: 600 }} value={value ? String(value) : ''} onChange={(e) => onChange(e.target.value)}>
      {!value && <option value="">— à choisir —</option>}
      {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.uom === 'ml' ? ' (ml)' : ''}</option>)}
    </select>
  );
}

function StepDetail({ config, setConfig, catalog, quote }) {
  const products = React.useMemo(() => catalog?.products || [], [catalog]);
  const resolve = React.useMemo(() => makeResolver(products), [products]);
  const [showUnused, setShowUnused] = React.useState(false);
  const [openKeys, setOpenKeys] = React.useState(() => new Set(quote.sections.slice(0, 2).map((b) => b.key)));
  const [drag, setDrag] = React.useState(null); // { type, ids } : ordre provisoire des lignes d'un type
  const toggle = (k) => setOpenKeys((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  // Changement d'article : par défaut pour tout ce type de produit (recette) ; « ici seulement »
  // → remplacement limité à ce bloc. Les lignes « X / Y » (Pose / Installation…) se règlent par colonne.
  const setArticle = (b, l, productId, here) => setConfig((cfg) => {
    const slots = recipeOf(cfg, l.typeKey);
    const slot = slots.find((x) => x.id === l.slotId);
    if (!slot) return cfg;
    const perCol = slot.cols.length > 1 && slot.product === '@col';
    if (here) {
      const ok = overrideKey(cfg.groupBy, b.key);
      const cur = { ...(cfg.overrides?.[ok] || {}) };
      if (perCol) for (const c of l.compKeys) cur[`${l.typeKey}:${slot.id}:${c}`] = productId;
      else cur[`${l.typeKey}:${slot.id}`] = productId;
      return { ...cfg, overrides: { ...cfg.overrides, [ok]: cur } };
    }
    const next = slots.map((x) => {
      if (x.id !== slot.id) return x;
      if (perCol) return { ...x, colProducts: { ...(x.colProducts || {}), ...Object.fromEntries(l.compKeys.map((c) => [c, productId])) } };
      return { ...x, product: productId };
    });
    return { ...cfg, recipes: { ...cfg.recipes, [l.typeKey]: next } };
  });
  const hereOverride = (b, l) => {
    const ovs = config.overrides?.[overrideKey(config.groupBy, b.key)] || {};
    return l.compKeys.some((c) => ovs[`${l.typeKey}:${l.slotId}:${c}`]) || !!ovs[`${l.typeKey}:${l.slotId}`];
  };
  const clearHere = (b, l) => setConfig((cfg) => {
    const ok = overrideKey(cfg.groupBy, b.key);
    const cur = { ...(cfg.overrides?.[ok] || {}) };
    delete cur[`${l.typeKey}:${l.slotId}`];
    for (const c of l.compKeys) delete cur[`${l.typeKey}:${l.slotId}:${c}`];
    return { ...cfg, overrides: { ...cfg.overrides, [ok]: cur } };
  });

  // Ordre des lignes d'un type (recette) : glisser-déposer, aperçu en direct, commun à tout le type.
  const slotOrder = (type) => (drag?.type === type ? drag.ids : recipeOf(config, type).map((x) => x.id));
  const commitOrder = (type, ids) => setConfig((cfg) => {
    const slots = recipeOf(cfg, type);
    return { ...cfg, recipes: { ...cfg.recipes, [type]: ids.map((id) => slots.find((x) => x.id === id)).filter(Boolean) } };
  });
  const onDragOverSlot = (e, type, overId) => {
    e.preventDefault();
    if (!drag || drag.type !== type || overId === drag.id) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const after = e.clientY > rect.top + rect.height / 2;
    const ids = drag.ids.filter((x) => x !== drag.id);
    ids.splice(ids.indexOf(overId) + (after ? 1 : 0), 0, drag.id);
    if (ids.join() !== drag.ids.join()) setDrag({ ...drag, ids });
  };

  const unresolvedCharges = quote.charges.filter((ch) => chargeSetting(config, ch.key).host === 'none');
  const cell = { fontSize: 12.5, color: C.muted };

  // Fonction de rendu (pas un composant) : évite de remonter les listes déroulantes à chaque rendu.
  const Row = ({ rkey, b, l, ghost, slot, sample, dragProps, first }) => {
    if (ghost) {
      const names = [...new Set(slot.cols.map((c) => resolve(slot.colProducts?.[c] || slot.product || '@col', sample, COMPONENT_BY_KEY.get(c))?.name).filter(Boolean))];
      const tags = [...new Set(slot.cols.map((c) => resolve(slot.colProducts?.[c] || slot.product || '@col', sample, COMPONENT_BY_KEY.get(c))?.cgTags || []).flat())];
      return (
        <div key={rkey} {...dragProps} style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 10, alignItems: 'center', padding: '6px 12px', borderTop: `1px solid ${C.grey}`, background: '#FCFCFB', ...(dragProps?.style || {}) }}>
          {first ? <GripVertical size={14} color={C.soft} style={{ cursor: 'grab' }} /> : <span />}
          <div style={{ fontSize: 13, color: C.soft, fontStyle: 'italic' }}>{names.join(' / ') || slot.label}</div>
          <div style={{ ...cell, color: C.soft }}>{tags.join(', ') || '—'}</div>
          <div style={{ ...cell, color: C.soft }}>{slot.cols.map((c) => COMPONENT_BY_KEY.get(c)?.label || c).join(', ')}<div style={{ fontSize: 11.5 }}>non utilisé : aucune valeur dans la minute</div></div>
          <div /><div /><div /><div />
        </div>
      );
    }
    const logi = l.typeKey === '__logi';
    const noTag = !l.cgTags.length;
    const here = !logi && hereOverride(b, l);
    return (
      <div key={rkey} {...dragProps} style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 10, alignItems: 'center', padding: '6px 12px', borderTop: `1px solid ${C.grey}`, ...(dragProps?.style || {}) }}>
        {first && !logi ? <GripVertical size={14} color={C.soft} style={{ cursor: 'grab' }} /> : <span />}
        <div>
          {logi
            ? <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{l.productName}<div style={{ fontSize: 11.5, fontWeight: 400, color: C.soft }}>réglé à l'étape Structure</div></div>
            : <ArticleSelect value={l.productId} products={products} onChange={(v) => setArticle(b, l, Number(v), here)} />}
          {!logi && (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: here ? C.accent : C.soft, marginTop: 3, cursor: 'pointer' }}
              title="Coché : le changement d'article ne vaut que pour cette section. Décoché : pour tous les produits de ce type.">
              <input type="checkbox" checked={here} onChange={(e) => (e.target.checked ? setArticle(b, l, l.productId, true) : clearHere(b, l))} style={{ margin: 0 }} />
              ici seulement
            </label>
          )}
        </div>
        <div style={{ ...cell, color: noTag ? '#B45309' : C.accent }}>{noTag ? 'aucune' : l.cgTags.join(', ')}</div>
        <div style={cell}>{l.sourceLabels.join(', ')}</div>
        <div style={{ ...cell, textAlign: 'right' }} title={l.travelHours ? `dont ${num(l.travelHours)} h de trajet` : ''}>{l.hours ? num(l.hours) : '—'}</div>
        <div style={{ ...cell, textAlign: 'right' }}>{num(l.qty)} {l.uom}</div>
        <div style={{ fontSize: 13, textAlign: 'right', color: C.text, fontWeight: 600 }}>{eur(l.subtotal)}</div>
        <div style={{ ...cell, textAlign: 'right' }}>{l.cost ? eur(l.cost) : '—'}</div>
      </div>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <H sub="Pour chaque section : les lignes que Droitfil va créer dans Odoo. Change l'article dans la liste si besoin ; glisse une ligne pour changer l'ordre (commun à tous les produits du même type).">Détail du devis</H>
        </div>
        <button onClick={() => setShowUnused((v) => !v)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, background: showUnused ? C.grey : 'white', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', color: '#374151' }}>
          {showUnused ? <EyeOff size={14} /> : <Eye size={14} />} {showUnused ? 'Masquer' : 'Afficher'} les articles non utilisés
        </button>
        <button onClick={() => setOpenKeys(openKeys.size === quote.sections.length ? new Set() : new Set(quote.sections.map((b) => b.key)))}
          style={{ border: 'none', background: 'none', fontSize: 12.5, color: C.accent, cursor: 'pointer', fontFamily: 'inherit', padding: '7px 0' }}>
          {openKeys.size === quote.sections.length ? 'Tout replier' : 'Tout déplier'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: DGRID, gap: 10, padding: '0 12px 6px', fontSize: 11.5, color: C.soft }}>
        <div /><div>Article Odoo</div><div>Étiquette</div><div>Colonne Droitfil</div><div style={{ textAlign: 'right' }}>H.</div><div style={{ textAlign: 'right' }}>Qté</div><div style={{ textAlign: 'right' }}>Prix</div><div style={{ textAlign: 'right' }}>Coût</div>
      </div>

      {quote.sections.map((b, bi) => {
        const isOpen = openKeys.has(b.key);
        const newSection = bi === 0 || quote.sections[bi - 1].title !== b.title;
        return (
          <div key={b.key} style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', marginTop: newSection ? 10 : 4, marginLeft: b.sub ? 18 : 0 }}>
            <div onClick={() => toggle(b.key)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: b.sub ? '#F7F7F5' : '#E9ECEF', cursor: 'pointer' }}>
              <ChevronRight size={14} style={{ transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: C.muted }} />
              <div style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.text }}>
                {b.sub ? <><span style={{ fontWeight: 500, color: C.muted }}>{b.title} › </span>{b.sub}</> : (b.title || '(section unique)')}
              </div>
              <span style={{ fontSize: 12.5, color: C.muted }}>{b.lines.length} ligne{b.lines.length > 1 ? 's' : ''} · coût {eur(b.cost)} ·</span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.text }}>{eur(b.total)}</span>
            </div>
            {isOpen && [...b.types, '__logi'].map((type) => {
              const lines = b.lines.filter((l) => l.typeKey === type);
              if (type === '__logi') return lines.map((l) => Row({ rkey: l.key, b, l }));
              const sample = b.samples?.[type] || {};
              const slots = recipeOf(config, type);
              const extra = lines.filter((l) => !slots.some((x) => x.id === l.slotId));
              return (
                <React.Fragment key={type}>
                  {b.types.length > 1 && <div style={{ padding: '5px 12px', fontSize: 11.5, fontWeight: 600, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.4, borderTop: `1px solid ${C.grey}` }}>{typeLabel(type)}</div>}
                  {slotOrder(type).map((sid) => {
                    const slot = slots.find((x) => x.id === sid);
                    const ls = lines.filter((l) => l.slotId === sid);
                    if (!slot || (!ls.length && !showUnused)) return null;
                    const dragProps = {
                      draggable: true,
                      onDragStart: (e) => { e.dataTransfer.effectAllowed = 'move'; setDrag({ type, id: sid, ids: slotOrder(type) }); },
                      onDragOver: (e) => onDragOverSlot(e, type, sid),
                      onDrop: (e) => { e.preventDefault(); if (drag) commitOrder(type, drag.ids); setDrag(null); },
                      onDragEnd: () => setDrag(null),
                      style: drag?.type === type && drag.id === sid ? { background: '#F3EEF2', outline: `2px dashed ${C.accent}`, outlineOffset: -2 } : {},
                    };
                    if (!ls.length) return Row({ rkey: sid, b, ghost: true, slot, sample, dragProps, first: true });
                    return <div key={sid} {...dragProps}>{ls.map((l, i) => Row({ rkey: l.key, b, l, first: i === 0 }))}</div>;
                  })}
                  {extra.map((l) => Row({ rkey: l.key, b, l }))}
                </React.Fragment>
              );
            })}
          </div>
        );
      })}

      {unresolvedCharges.length > 0 && (
        <div style={{ marginTop: 22, border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 10, padding: '10px 14px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: '#92400E', marginBottom: 8 }}>Autres dépenses sans catégorie : à rattacher à un article (sinon leur coût ne remonte pas dans Odoo)</div>
          {unresolvedCharges.map((ch) => (
            <div key={ch.key} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.5fr 1.4fr', gap: 12, alignItems: 'center', padding: '4px 0' }}>
              <div style={{ fontSize: 13, color: C.text }}>{ch.label}{ch.details.length > 0 && <span style={{ color: C.muted }}> · {ch.details.join(' · ')}</span>}</div>
              <div style={{ fontSize: 13, color: C.muted, textAlign: 'right' }}>{eur(ch.amount)}</div>
              <select style={{ ...inputStyle, padding: '5px 7px' }} value="none"
                onChange={(e) => setConfig((cfg) => ({ ...cfg, charges: { ...cfg.charges, [ch.key]: { host: e.target.value, place: 'lignes' } } }))}>
                <option value="none">— Ne pas reporter —</option>
                {products.map((p) => <option key={p.id} value={String(p.id)}>{p.name}{p.cgTags?.length ? `  ·  ${p.cgTags.join(', ')}` : ''}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Étape 4 : aperçu ──────────────────────────────────────────────────────────
// Retour d'Odoo (simulation ou création) comparé au calcul Droitfil.
const CG_ROWS = [
  ['cg_montant_tissu', 'Achat tissu'], ['cg_montant_meca', 'Achat mécanisme'], ['cg_montant_store', 'Achat store'],
  ['cg_st_conf', 'ST Conf'], ['cg_st_pose', 'ST Pose'], ['cg_transport', 'Transport sur ventes'],
  ['cg_frais_deplacement', 'Frais de déplacement'], ['cg_montant_location', 'Location / outillage'],
  ['cg_commission_partenaire', 'Commission partenaire'],
];
function OdooPanel({ quote, odoo, dest }) {
  if (!odoo) return null;
  if (odoo.error) {
    return <div style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#991B1B' }}>Odoo a refusé : {odoo.error}</div>;
  }
  const r = odoo.result;
  const dfCg = { ...quote.cg, cg_commission_partenaire: quote.commissionPartenaire.amount };
  const rows = [
    ['Total HT', quote.total, r.amount_untaxed, true],
    ['Heures confection', quote.hours.conf, r.heures?.confection],
    ['Heures préparation', quote.hours.prepa, r.heures?.preparation],
    ['Heures pose (trajet et prise de cotes compris)', quote.hours.pose + (quote.hours.depl || 0), r.heures?.pose],
    ...CG_ROWS.map(([k, label]) => [label, dfCg[k] || 0, r.cg?.[k] || 0, true]),
  ].filter(([, a, b]) => a || b);
  const corrected = (r.lines || []).filter((l) => l.corrige_apres_creation?.length);
  const created = r.action !== 'dry_run';
  return (
    <div style={{ border: `1px solid ${created ? '#86EFAC' : C.border}`, background: created ? '#F0FDF4' : 'white', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: C.text, flex: 1 }}>
          {created ? `✅ Devis ${r.name} ${r.action === 'updated' ? 'mis à jour' : 'créé'} en brouillon` : 'Vérification Odoo (rien n\'a été créé)'}
          <span style={{ fontSize: 12, fontWeight: 400, color: C.muted }}> · {odoo.target}</span>
        </div>
        {created && r.url && <a href={r.url} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>Ouvrir dans Odoo ↗</a>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 0.4fr', fontSize: 13, rowGap: 4 }}>
        <div style={{ color: C.soft }} /><div style={{ color: C.soft, textAlign: 'right' }}>Droitfil</div><div style={{ color: C.soft, textAlign: 'right' }}>Odoo</div><div />
        {rows.map(([label, a, b, money]) => {
          const same = Math.abs((a || 0) - (b || 0)) < (money ? 1 : 0.05);
          return (
            <React.Fragment key={label}>
              <div style={{ color: C.text }}>{label}</div>
              <div style={{ textAlign: 'right', color: C.muted }}>{money ? eur(a) : num(a)}</div>
              <div style={{ textAlign: 'right', color: C.text, fontWeight: 600 }}>{money ? eur(b) : num(b)}</div>
              <div style={{ textAlign: 'center' }}>{same ? '✅' : '⚠️'}</div>
            </React.Fragment>
          );
        })}
      </div>
      {r.opportunity_name && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: C.muted }}>
          Opportunité Odoo : <b style={{ color: C.text }}>{r.opportunity_name}</b>
          {' · '}signature possible {r.opportunity_date_deadline ? new Date(r.opportunity_date_deadline).toLocaleDateString('fr-FR') : '—'}
          {dest?.mode === 'new' && dest.signatureDate && r.opportunity_date_deadline !== dest.signatureDate ? ' ⚠️' : ''}
          {' · '}{'★'.repeat(Number(r.opportunity_priority || 0)) || '0 étoile'}
          {dest?.mode === 'new' && dest.priority != null && String(dest.priority) !== String(r.opportunity_priority) ? ' ⚠️' : ''}
          {r.opportunity_expected_revenue ? ` · revenu attendu ${eur(r.opportunity_expected_revenue)}` : ''}
        </div>
      )}
      {(r.warnings || []).length > 0 && (
        <div style={{ marginTop: 10, fontSize: 12.5, color: '#92400E' }}>{r.warnings.map((w) => <div key={w}>⚠️ Odoo : {w}</div>)}</div>
      )}
      {corrected.length > 0 && (
        <div style={{ marginTop: 6, fontSize: 12.5, color: '#92400E' }}>Valeurs rétablies par Odoo après création : {corrected.map((l) => `${l.ref} (${l.corrige_apres_creation.join(', ')})`).join(' ; ')}</div>
      )}
    </div>
  );
}

// Description d'une ligne : texte (surligné s'il reste des XX / « A OU B ») + crayon d'édition.
function DescriptionCell({ line, onSave }) {
  const body = line.description.split('\n').slice(1).join('\n');
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(body);
  if (editing) {
    return (
      <div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
          rows={Math.min(14, Math.max(3, draft.split('\n').length + 1))}
          style={{ ...inputStyle, fontSize: 12.5, lineHeight: 1.45, padding: '6px 8px', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={() => { onSave(draft); setEditing(false); }} style={{ border: 'none', background: C.text, color: 'white', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Enregistrer</button>
          <button onClick={() => { setDraft(body); setEditing(false); }} style={{ border: 'none', background: 'none', color: C.muted, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Annuler</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', paddingRight: 22 }}>
      <div style={{ whiteSpace: 'pre-line', color: '#374151', lineHeight: 1.45 }}>
        {body ? body.split('\n').map((t, k) => (
          <div key={k} style={TODO_RE.test(t) ? { background: '#FEF3C7', borderRadius: 3, padding: '0 3px' }
            : /^Concerne :/.test(t) ? { fontSize: 11, fontStyle: 'italic', color: C.muted } : undefined}>{t || '\u00A0'}</div>
        )) : <span style={{ color: C.soft }}>—</span>}
      </div>
      <button onClick={() => { setDraft(body); setEditing(true); }} title="Modifier la description"
        style={{ position: 'absolute', top: 0, right: 0, border: 'none', background: 'none', cursor: 'pointer', color: line.edited ? C.accent : C.soft, padding: 2 }}>
        <Pencil size={13} />
      </button>
      {line.edited && (
        <div style={{ fontSize: 11, color: C.accent, marginTop: 3 }}>
          Modifié à la main ·{' '}
          <button onClick={() => onSave(null)} style={{ border: 'none', background: 'none', color: C.accent, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', padding: 0, textDecoration: 'underline' }}>Rétablir le texte automatique</button>
        </div>
      )}
    </div>
  );
}

function StepPreview({ quote, dest, odoo, onEditText }) {
  const ok = Math.abs(quote.diff) < 1;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginBottom: 18 }}>
        {[
          ['Opportunité', dest.mode === 'existing' ? (dest.opportunity?.name || '—') : `Nouvelle : ${dest.newName || '—'}`],
          ['Client', dest.partner ? (dest.partner.company ? `${dest.partner.company}, ${dest.partner.name}` : dest.partner.name) : '—'],
          ['Heures vendues', `Conf ${num(quote.hours.conf)} · Prépa ${num(quote.hours.prepa)} · Pose ${num(quote.hours.pose + quote.hours.depl)}${quote.hours.trajet || quote.hours.depl ? ` (dont ${[quote.hours.trajet && `${num(quote.hours.trajet)} trajet`, quote.hours.depl && `${num(quote.hours.depl)} prise de cotes`].filter(Boolean).join(', ')})` : ''}`],
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

      <OdooPanel quote={quote} odoo={odoo} dest={dest} />

      {quote.blocking?.length > 0 && (
        <div style={{ border: '1px solid #FCA5A5', background: '#FEF2F2', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#991B1B' }}>
          <b>Odoo refusera ce devis :</b>
          {quote.blocking.map((w) => <div key={w}>• {w}</div>)}
        </div>
      )}

      {quote.warnings.length > 0 && (
        <div style={{ border: '1px solid #FCD34D', background: '#FFFBEB', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#92400E' }}>
          {quote.warnings.map((w) => <div key={w} style={{ display: 'flex', gap: 6 }}><AlertTriangle size={14} style={{ marginTop: 2 }} />{w}</div>)}
        </div>
      )}

      {/* Rendu « façon Odoo » : section, sous-section, lignes */}
      <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: PGRID, gap: 10, padding: '9px 14px', fontSize: 12, fontWeight: 600, color: C.muted, borderBottom: `1px solid ${C.border}` }}>
          <div>Article</div><div>Description</div><div style={{ textAlign: 'right' }}>Quantité</div><div style={{ textAlign: 'right' }}>Prix unitaire</div><div style={{ textAlign: 'right' }}>Montant HT</div><div style={{ textAlign: 'right' }}>Coût</div><div style={{ textAlign: 'right' }}>H.</div>
        </div>
        {quote.sections.map((s, i) => {
          const newSection = i === 0 || quote.sections[i - 1].title !== s.title;
          const sectionTotal = quote.sections.filter((x) => x.title === s.title).reduce((a, x) => a + x.total, 0);
          return (
            <React.Fragment key={s.key}>
              {newSection && s.title && (
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#E9ECEF', padding: '8px 14px', fontSize: 13.5, fontWeight: 700, color: C.text }}>
                  <span>{s.title}</span><span>{eur(sectionTotal)}</span>
                </div>
              )}
              {s.sub && (
                <div style={{ display: 'flex', justifyContent: 'space-between', background: '#F7F7F5', padding: '6px 14px 6px 26px', fontSize: 13, fontWeight: 600, color: '#374151', borderTop: `1px solid ${C.grey}` }}>
                  <span>{s.sub}</span><span>{eur(s.total)}</span>
                </div>
              )}
              {s.lines.map((l) => (
                <div key={l.key} style={{ display: 'grid', gridTemplateColumns: PGRID, gap: 10, padding: '9px 14px', borderTop: `1px solid ${C.grey}`, fontSize: 13, color: C.text, alignItems: 'start' }}>
                  <div style={{ fontWeight: 600, color: l.productId ? C.text : '#B91C1C' }}>
                    {l.productName}
                    {l.costOnly && <div style={{ fontSize: 11, fontWeight: 500, color: C.accent }}>coût seul</div>}
                  </div>
                  <DescriptionCell key={`${l.key}:${l.edited ? 'e' : 'a'}`} line={l} onSave={(text) => onEditText(s, l, text)} />
                  <div style={{ textAlign: 'right' }}>{num(l.qty)} {l.uom}</div>
                  <div style={{ textAlign: 'right' }}>{eur(l.priceUnit)}</div>
                  <div style={{ textAlign: 'right', fontWeight: 600 }}>{eur(l.subtotal)}</div>
                  <div style={{ textAlign: 'right', color: l.cost ? C.muted : C.soft }} title={l.cost ? [`Coût unitaire Odoo : ${eur(l.costUnit)}`, ...l.charges.map((c) => `dont ${c.label} : ${eur(c.amount)}`)].join('\n') : ''}>
                    {l.cost ? eur(l.cost) : '—'}{l.charges.length > 0 && <sup style={{ color: C.accent }}> +</sup>}
                  </div>
                  <div style={{ textAlign: 'right', color: l.hours ? C.text : C.soft }} title={l.travelHours ? `dont ${num(l.travelHours)} h de trajet` : ''}>{l.hours ? num(l.hours) : '—'}{l.travelHours ? <sup style={{ color: C.accent }}> +</sup> : null}</div>
                </div>
              ))}
            </React.Fragment>
          );
        })}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, padding: '12px 14px', borderTop: `1px solid ${C.border}`, fontSize: 14.5, fontWeight: 700 }}>
          <span style={{ color: C.muted, fontWeight: 500 }}>Coût {eur(quote.cost)}</span>
          <span style={{ color: C.muted, fontWeight: 500 }}>Total HT</span><span>{eur(quote.total)}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Module ────────────────────────────────────────────────────────────────────
export default function OdooQuoteWizard({ open, onClose, minute, rows = [], depRows = [], extraRows = [], library = [], onLinked }) {
  const { currentUser, users: dfUsers = [] } = useAuth();
  const [step, setStep] = React.useState(0);
  const [catalog, setCatalog] = React.useState(null);
  const [catalogError, setCatalogError] = React.useState(null);
  // Réglages : base navigateur (ancien stockage) ‹ réglages de CETTE minute (minutes.odoo_quote)
  // ‹ réglages communs de l'équipe (app_config, chargés juste après l'ouverture).
  const saved = minute?.odoo_quote || null;
  const [config, setConfig] = React.useState(() => normalizeConfig({ ...loadProfile(), ...(saved?.settings || {}) }));
  const [sharedReady, setSharedReady] = React.useState(false);
  const [storeState, setStoreState] = React.useState('idle'); // idle | ok | browser
  const [link, setLink] = React.useState(saved?.link || null);
  // Nom de l'opportunité par défaut = nom de la minute sans son numéro de version.
  // Devis déjà créé pour cette minute : on repart sur SON opportunité et SON client (sinon une
  // mise à jour créerait une seconde opportunité dans Odoo).
  const [dest, setDest] = React.useState(() => (saved?.link?.opportunityId ? {
    mode: 'existing',
    opportunity: { id: saved.link.opportunityId, name: saved.link.opportunityName },
    partner: saved.link.partner || null,
    newName: (minute?.name || '').replace(/\s+V\d+\b.*$/i, '').trim(),
    description: minute?.notes || '',
  } : {
    mode: 'new', opportunity: null, partner: null,
    newName: (minute?.name || '').replace(/\s+V\d+\b.*$/i, '').trim(),
    description: minute?.notes || '',
  }));
  const [odooResult, setOdooResult] = React.useState(null);
  const [sending, setSending] = React.useState(false);

  // Commerciaux proposés = personnes Droitfil qui ont un compte Odoo correspondant (ou l'ADV).
  const commercials = React.useMemo(() => (catalog ? dfUsers
    .map((u) => ({ id: u.id, name: u.name, odoo: odooUserForDroitfil(u, catalog.users) }))
    .filter((x) => x.odoo)
    .sort((a, b) => a.name.localeCompare(b.name, 'fr')) : []), [catalog, dfUsers]);

  React.useEffect(() => {
    if (!open || catalog) return;
    odoo('catalog').then(setCatalog).catch((e) => setCatalogError(e.message));
  }, [open, catalog]);
  React.useEffect(() => {
    let alive = true;
    loadSharedProfile().then((shared) => {
      if (!alive) return;
      if (shared) setConfig((c) => normalizeConfig({ ...c, ...Object.fromEntries(SHARED_FIELDS.filter((k) => shared[k]).map((k) => [k, shared[k]])) }));
      setSharedReady(true);
    });
    return () => { alive = false; };
  }, []);

  // Pré-remplit commercial + équipe : le CHARGÉ D'AFFAIRES de la minute (il fixe aussi le taux de
  // commission, 1 % direction / ADV ou 3,5 %, dans Droitfil comme dans Odoo), sinon la personne
  // connectée. Une seule fois.
  React.useEffect(() => {
    if (!catalog || dest.userId !== undefined) return;
    const owner = dfUsers.find((u) => norm(u.name) === norm(minute?.owner));
    const person = (owner && odooUserForDroitfil(owner, catalog.users)) ? owner : currentUser;
    const u = odooUserForDroitfil(person, catalog.users);
    setDest((d) => ({ ...d, dfUserId: u ? person?.id : null, userId: u?.id || null, teamId: u?.teamId || null, autoUser: u ? (person === owner ? 'owner' : 'me') : false }));
  }, [catalog, currentUser, dfUsers, minute?.owner, dest.userId]);

  const [textEdits, setTextEdits] = React.useState(() => saved?.texts || loadEdits(minute?.id));
  const builtQuote = React.useMemo(
    () => buildQuote({ rows, depRows, extraRows, config, products: catalog?.products || [], library }),
    [rows, depRows, extraRows, config, catalog, library]
  );
  // Devis final = calcul + descriptions retouchées à la main.
  const quote = React.useMemo(() => applyEdits(builtQuote, textEdits), [builtQuote, textEdits]);
  const editText = (block, line, text) => setTextEdits((cur) => {
    const next = { ...cur };
    if (text == null) delete next[editId(block, line)]; else next[editId(block, line)] = text;
    return next;
  });

  // Enregistrement (différé de 0,8 s) : communs → app_config ; minute → minutes.odoo_quote.
  // Le navigateur garde toujours une copie (secours si la migration n'est pas encore lancée).
  const sharedJson = JSON.stringify(Object.fromEntries(SHARED_FIELDS.map((k) => [k, config[k]])));
  const lastShared = React.useRef(null);
  React.useEffect(() => {
    if (!sharedReady) return undefined;
    if (lastShared.current === null) { lastShared.current = sharedJson; return undefined; } // valeur chargée
    if (lastShared.current === sharedJson) return undefined;
    const t = setTimeout(() => { lastShared.current = sharedJson; saveSharedProfile(config); }, 800);
    return () => clearTimeout(t);
  }, [sharedJson, sharedReady, config]);
  const persistMinute = React.useCallback(async (patch = {}) => {
    const odooQuote = { settings: minuteSettingsOf(config), texts: textEdits, link, ...patch };
    const r = await saveMinuteQuote(minute?.id, odooQuote);
    setStoreState(r.ok ? 'ok' : 'browser');
    return r;
  }, [config, textEdits, link, minute?.id]);
  const minuteJson = JSON.stringify({ s: minuteSettingsOf(config), t: textEdits });
  const lastMinute = React.useRef(minuteJson);
  React.useEffect(() => {
    saveProfile(config);
    saveEdits(minute?.id, textEdits);
    if (lastMinute.current === minuteJson) return undefined;
    const t = setTimeout(() => { lastMinute.current = minuteJson; persistMinute(); }, 800);
    return () => clearTimeout(t);
  }, [minuteJson, config, textEdits, minute?.id, persistMinute]);

  // « Vérifier » = dry_run (Odoo calcule tout puis annule) ; « Créer » = devis brouillon réel.
  const write = catalog?.write;
  const sendToOdoo = async (dryRun) => {
    if (!dryRun && !window.confirm(`Créer (ou mettre à jour) le devis BROUILLON dans Odoo ?\n\nInstance : ${write?.target}\nLe devis n'est ni confirmé ni envoyé.`)) return;
    setSending(true);
    try {
      const payload = toOdooPayload({ quote, dest, minute });
      const res = await fetch('/api/odoo/quote-create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ payload, dryRun }) });
      const json = await res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }));
      setOdooResult(json.ok ? { result: json.result, target: json.target } : { error: json.error });
      // Devis réellement créé / mis à jour : on mémorise le lien sur la minute.
      if (json.ok && !dryRun && json.result?.id) {
        const r = json.result;
        const newLink = {
          orderId: r.id, name: r.name, url: r.url, state: r.state, target: json.target,
          opportunityId: r.opportunity_id, opportunityName: r.opportunity_name,
          partner: dest.partner ? { id: dest.partner.id, name: dest.partner.name, company: dest.partner.company || null } : null,
          amountUntaxed: r.amount_untaxed, at: new Date().toISOString(), by: currentUser?.name || currentUser?.email || null,
        };
        setLink(newLink);
        await persistMinute({ link: newLink });
        onLinked?.(newLink);
      }
    } catch (e) {
      setOdooResult({ error: e.message });
    } finally {
      setSending(false);
    }
  };
  // Un nouveau calcul invalide le dernier retour Odoo.
  React.useEffect(() => { setOdooResult(null); }, [quote]);
  const sendBlocked = !write?.enabled
    ? (write?.isProd ? 'Bloqué : Droitfil est branché sur la PRODUCTION Odoo (module en test).' : "Écriture Odoo désactivée sur cet environnement.")
    : !dest.partner ? 'Choisis un client (étape Opportunité).'
      : quote.blocking?.length ? 'Corrige les points bloquants signalés en rouge.'
        : quote.sections.some((sec) => sec.lines.some((l) => !l.productId)) ? 'Certaines lignes n\'ont pas d\'article Odoo.' : '';

  // Nouvelle opportunité : nom, secteur, type de client, signature possible et importance obligatoires.
  const needsApporteur = quote.commissionPartenaire.amount > 0;
  const newOppReady = !!(dest.newName ?? minute?.name) && !!dest.sectorTag && !!dest.typeTag && !!dest.signatureDate && dest.priority != null
    && (!needsApporteur || !!dest.apportePar);
  const canNext = step !== 0 || ((dest.mode === 'existing' ? !!dest.opportunity : newOppReady) && !!dest.partner);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: '14px', fontFamily: 'Roboto, system-ui, sans-serif' } }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '86vh' }}>
        {/* En-tête + étapes */}
        <div style={{ padding: '18px 24px 0', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 500, color: C.text }}>Créer le devis dans Odoo</div>
              <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{minute?.name} · {rows.length} ligne(s)
                {catalog?.write && (
                  <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 8px', borderRadius: 999, fontWeight: 600,
                    background: catalog.write.isProd ? '#FEE2E2' : catalog.write.enabled ? '#FEF3C7' : C.grey,
                    color: catalog.write.isProd ? '#991B1B' : catalog.write.enabled ? '#92400E' : C.muted }}>
                    {catalog.write.isProd ? 'Odoo PRODUCTION · lecture seule' : catalog.write.enabled ? `Odoo PRÉPROD · ${catalog.write.target}` : 'Odoo · lecture seule'}
                  </span>
                )}</div>
            </div>
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: C.muted }}><X size={20} /></button>
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14 }}>
            {STEPS.map((s, i) => (
              <button key={s} onClick={() => (i <= step || canNext) && setStep(i)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '8px 12px 10px', fontSize: 13.5,
                  color: i === step ? C.text : C.muted, fontWeight: i === step ? 600 : 500, borderBottom: `2px solid ${i === step ? C.text : 'transparent'}` }}>
                <span style={{ display: 'inline-flex', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', fontSize: 11.5, marginRight: 7,
                  background: i <= step ? C.text : C.grey, color: i <= step ? 'white' : C.muted }}>{i < step ? '✓' : i + 1}</span>
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
          {step === 0 && <StepOpportunity minute={minute} catalog={catalog} dest={dest} setDest={setDest} commercials={commercials} needsApporteur={quote.commissionPartenaire.amount > 0} />}
          {step === 1 && <StepStructure config={config} setConfig={setConfig} rows={rows} quote={quote} />}
          {step === 2 && (catalog
            ? <StepDetail config={config} setConfig={setConfig} catalog={catalog} quote={quote} />
            : <div style={{ fontSize: 13, color: C.muted }}>Chargement des articles Odoo…</div>)}
          {step === 3 && <StepPreview quote={quote} dest={dest} odoo={odooResult} onEditText={editText} />}
        </div>

        {/* Pied */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={() => setConfig(defaultConfig())} style={{ border: 'none', background: 'none', color: C.muted, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'underline' }}>
            Réinitialiser les réglages
          </button>
          <div style={{ fontSize: 11.5, color: storeState === 'browser' ? '#B45309' : C.soft }}>
            {storeState === 'ok' && 'Réglages enregistrés dans Droitfil'}
            {storeState === 'browser' && 'Réglages gardés dans ce navigateur (migration odoo_quote à lancer)'}
          </div>
          <div style={{ flex: 1, textAlign: 'right', fontSize: 13, color: C.muted }}>
            Total devis <b style={{ color: C.text }}>{eur(quote.total)}</b>
          </div>
          {step > 0 && <Btn onClick={() => setStep(step - 1)}><ArrowLeft size={15} /> Retour</Btn>}
          {step < STEPS.length - 1
            ? <Btn primary disabled={!canNext} onClick={() => setStep(step + 1)} title={canNext ? '' : (dest.mode === 'new' ? 'Complète la nouvelle opportunité (secteur, type de client, signature possible, importance, apporteur si commission partenaire) et le client' : 'Choisis une opportunité et un client')}>Suivant <ArrowRight size={15} /></Btn>
            : (
              <>
                <Btn disabled={!!sendBlocked || sending} onClick={() => sendToOdoo(true)}
                  title={sendBlocked || 'Odoo recalcule tout le devis et compare avec Droitfil, puis annule : rien n\'est créé dans Odoo.'}>
                  {sending ? 'Envoi…' : 'Vérifier avec Odoo (sans créer)'}
                </Btn>
                <Btn primary disabled={!!sendBlocked || sending} title={sendBlocked || `Instance : ${write?.target}`} onClick={() => sendToOdoo(false)}>
                  {link && link.target === write?.target ? `Mettre à jour le devis ${link.name}` : 'Créer le devis brouillon'}{write?.target && !write?.isProd ? ' (préprod)' : ''}
                </Btn>
              </>
            )}
        </div>
      </div>
    </Dialog>
  );
}
