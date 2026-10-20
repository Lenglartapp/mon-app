// Vue entrepôt (Inventaire › Stock › Vue entrepôt) : représentation 3D de l'entrepôt et de
// son occupation en rouleaux, recherche d'un article / dossier, détail d'un emplacement.
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Search, X, MapPin, RotateCcw } from 'lucide-react';
import { useViewportWidth } from '../../../lib/hooks/useViewportWidth';
import { GROUPS, MAPPED_CODES, groupOfCode } from '../../../lib/warehouse/layout';
import { occupancyByCode, countRouleaux, totalCapacity, occupancyColor, TO_COMPLETE } from '../../../lib/warehouse/occupancy';
import { splitLocations } from '../../../lib/inventory/stockFields';

const Warehouse3D = lazy(() => import('./warehouse/Warehouse3D'));

const NAVY = '#1E2447';
const MUTED = '#6B7280';
const card = { background: 'white', border: '1px solid #E0DED9', borderRadius: 12, padding: '14px 16px' };
const fmt = (n) => Number(n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const fold = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function Bar({ pct }) {
    return (
        <div style={{ height: 6, borderRadius: 99, background: '#EEF0F5', overflow: 'hidden' }}>
            <div style={{ width: `${Math.round(Math.min(1, pct) * 100)}%`, height: '100%', background: occupancyColor(Math.max(pct, 0.35)), borderRadius: 99 }} />
        </div>
    );
}

function Kpi({ label, value, sub }) {
    return (
        <div style={{ ...card, flex: 1, minWidth: 150, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: MUTED }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: '#111827', marginTop: 2 }}>{value}</div>
            {sub && <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>{sub}</div>}
        </div>
    );
}

/** Détail d'un emplacement : occupation et articles rangés. */
function LocationPanel({ o, onClose, maxHeight = 520 }) {
    const zone = o.zone;
    const items = [...o.items].sort((a, b) => String(a.product).localeCompare(String(b.product), 'fr'));
    return (
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10, maxHeight, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <span style={{ width: 34, height: 34, borderRadius: 8, background: NAVY, color: 'white', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, flexShrink: 0 }}>{o.code}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#111827' }}>Emplacement {o.code}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{zone?.description || zone?.type || '—'}</div>
                </div>
                <button type="button" onClick={onClose} title="Fermer" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}><X size={16} /></button>
            </div>
            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                    <span>{fmt(o.rolls)} rouleau{o.rolls > 1 ? 'x' : ''}{o.capacity ? ` / ${o.capacity}` : ''}</span>
                    {o.capacity ? <span style={{ fontWeight: 600 }}>{Math.round(o.pct * 100)} %</span> : <span style={{ color: MUTED }}>capacité non définie</span>}
                </div>
                {o.capacity ? <Bar pct={o.pct} /> : null}
                {zone?.type === 'palettes' && <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>{zone.capacite} palette{zone.capacite > 1 ? 's' : ''} (≈ 10 rouleaux chacune)</div>}
            </div>
            <div style={{ fontSize: 12, color: MUTED, borderTop: '1px solid #E8E6E2', paddingTop: 8 }}>{items.length} article{items.length > 1 ? 's' : ''}</div>
            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 }}>
                {items.length === 0 && <div style={{ fontSize: 13, color: '#9CA3AF' }}>Emplacement vide.</div>}
                {items.map(it => (
                    <div key={it.id} style={{ border: '1px solid #EEF0F5', borderRadius: 8, padding: '8px 10px' }}>
                        <div style={{ fontSize: 13, color: '#111827', fontWeight: 500 }}>{[it.ref || it.product, it.coloris].filter(Boolean).join(' · ')}</div>
                        <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                            {[it.fournisseur, `${fmt(it.qty)} ${it.unit || ''}`.trim(), Array.isArray(it.pieces) && it.pieces.length > 1 ? `${it.pieces.length} pièces` : null].filter(Boolean).join(' · ')}
                        </div>
                        <div style={{ fontSize: 12, color: it.project ? NAVY : '#9CA3AF', marginTop: 2 }}>{it.project || 'Stock libre'}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function WarehouseMap({ zones = [], inventory = [] }) {
    const width = useViewportWidth();
    const isMobile = width < 760;
    const [selected, setSelected] = useState(null);
    const [search, setSearch] = useState('');
    const [focusGroup, setFocusGroup] = useState(null);
    const [viewKey, setViewKey] = useState(0);

    const occ = useMemo(() => occupancyByCode(inventory, zones), [inventory, zones]);
    const stock = useMemo(() => inventory.filter(i => Number(i.qty) > 0), [inventory]);
    const rolls = countRouleaux(stock);
    const capacity = totalCapacity(zones);
    const toComplete = stock.filter(i => splitLocations(i.location).includes(TO_COMPLETE)).length;
    const nearlyFull = [...occ.values()].filter(o => o.capacity && o.pct >= 0.85).length;

    // Recherche : emplacements où se trouvent les articles / dossiers trouvés
    const found = useMemo(() => {
        const q = fold(search.trim());
        if (q.length < 2) return null;
        const items = stock.filter(i => fold([i.fournisseur, i.ref, i.coloris, i.product, i.project].join(' ')).includes(q));
        const codes = new Set(items.flatMap(i => splitLocations(i.location)));
        return { items, mapped: [...codes].filter(c => MAPPED_CODES.has(c)), other: [...codes].filter(c => !MAPPED_CODES.has(c)) };
    }, [search, stock]);

    const groupStats = GROUPS.map(g => {
        const list = [...occ.values()].filter(o => groupOfCode(o.code) === g.key);
        const r = list.reduce((s, o) => s + o.rolls, 0);
        const cap = list.reduce((s, o) => s + (o.capacity || 0), 0);
        const n = list.reduce((s, o) => s + o.items.length, 0);
        return { ...g, rolls: r, capacity: cap, items: n, codes: list.map(o => o.code) };
    });
    const offMap = [...occ.values()].filter(o => !MAPPED_CODES.has(o.code) && o.items.length);

    const highlight = useMemo(() => {
        if (found) return new Set(found.mapped);
        if (focusGroup) return new Set(groupStats.find(g => g.key === focusGroup)?.codes || []);
        return new Set();
    }, [found, focusGroup]); // eslint-disable-line react-hooks/exhaustive-deps

    const sel = selected ? occ.get(selected) || { code: selected, rolls: 0, items: [], capacity: null, pct: 0 } : null;
    const canvasH = isMobile ? Math.round(Math.max(280, width * 0.78)) : 560;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Chiffres clés */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Kpi label="Occupation" value={capacity ? `${Math.round(Math.min(1, rolls / capacity) * 100)} %` : '—'} sub={`${fmt(rolls)} / ${fmt(capacity)} rouleaux`} />
                <Kpi label="Place libre" value={`${fmt(Math.max(0, capacity - rolls))}`} sub="rouleaux" />
                <Kpi label="À ranger" value={toComplete} sub="réceptions « À compléter »" />
                <Kpi label="Presque pleins" value={nearlyFull} sub="emplacements ≥ 85 %" />
            </div>

            {/* Recherche + légende */}
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, padding: '0 12px', border: '1px solid #E0DED9', borderRadius: 8, background: 'white', flex: '1 1 260px', maxWidth: 420 }}>
                    <Search size={16} color="#9CA3AF" />
                    <input value={search} onChange={(e) => { setSearch(e.target.value); setFocusGroup(null); }} placeholder="Où est… (fournisseur, référence, coloris, dossier)"
                        style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontFamily: 'inherit', background: 'transparent', minWidth: 0 }} />
                    {search && <button type="button" onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 0 }}><X size={15} /></button>}
                </label>
                {found && (
                    <span style={{ fontSize: 13, color: '#374151' }}>
                        {found.items.length ? <>
                            {found.items.length} article{found.items.length > 1 ? 's' : ''}
                            {found.mapped.length ? <> — <b>{found.mapped.join(', ')}</b></> : ''}
                            {found.other.length ? <span style={{ color: MUTED }}> {found.mapped.length ? '+' : '—'} {found.other.join(', ')}</span> : ''}
                        </> : <span style={{ color: MUTED }}>Aucun article trouvé</span>}
                    </span>
                )}
                <span style={{ flex: 1 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MUTED }}>
                    Vide
                    <span style={{ width: 120, height: 8, borderRadius: 99, background: `linear-gradient(90deg, ${occupancyColor(0)}, ${occupancyColor(0.5)}, ${occupancyColor(1)})`, border: '1px solid #E0DED9' }} />
                    Plein
                </div>
                <button type="button" onClick={() => setViewKey(k => k + 1)} title="Recentrer la vue" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 34, padding: '0 10px', border: '1px solid #E0DED9', borderRadius: 8, background: 'white', cursor: 'pointer', fontSize: 12, color: '#374151', fontFamily: 'inherit' }}>
                    <RotateCcw size={14} /> Recentrer
                </button>
            </div>

            {/* Vue 3D + détail */}
            <div style={{ display: 'flex', gap: 14, flexDirection: isMobile ? 'column' : 'row', alignItems: 'stretch' }}>
                <div style={{ flex: 1, minWidth: 0, border: '1px solid #E0DED9', borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                    <Suspense fallback={<div style={{ height: canvasH, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, fontSize: 13 }}>Chargement de la vue 3D…</div>}>
                        <Warehouse3D resetKey={viewKey} compact={isMobile} occ={occ} selected={selected} onSelect={setSelected} highlight={highlight} height={canvasH} />
                    </Suspense>
                    <div style={{ position: 'absolute', left: 12, bottom: 10, fontSize: 11.5, color: '#9CA3AF', pointerEvents: 'none' }}>
                        {isMobile ? 'Glisser pour tourner · pincer pour zoomer · toucher un niveau' : 'Glisser pour tourner · molette pour zoomer · clic droit pour déplacer · cliquer un niveau'}
                    </div>
                    {/* Ordinateur : détail posé sur la vue (elle ne change pas de taille, rien ne saute) */}
                    {sel && !isMobile && (
                        <div style={{ position: 'absolute', top: 12, right: 12, width: 320, maxHeight: canvasH - 24, display: 'flex', boxShadow: '0 10px 25px rgba(17,24,39,0.12)', borderRadius: 12 }}>
                            <LocationPanel o={sel} onClose={() => setSelected(null)} maxHeight={canvasH - 24} />
                        </div>
                    )}
                </div>
                {sel && isMobile && <LocationPanel o={sel} onClose={() => setSelected(null)} />}
            </div>

            {/* Cartes par zone */}
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 190}px, 1fr))`, gap: 10 }}>
                {groupStats.map(g => {
                    const on = focusGroup === g.key;
                    const pct = g.capacity ? g.rolls / g.capacity : 0;
                    return (
                        <button key={g.key} type="button" onClick={() => { setFocusGroup(on ? null : g.key); setSearch(''); }}
                            style={{ ...card, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${on ? NAVY : '#E0DED9'}`, background: on ? '#EEF4FD' : 'white', display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>{g.label}</span>
                            <span style={{ fontSize: 12, color: MUTED }}>{g.hint}</span>
                            {g.capacity ? <Bar pct={pct} /> : null}
                            <span style={{ fontSize: 12, color: '#374151' }}>
                                {g.capacity ? `${fmt(g.rolls)} / ${fmt(g.capacity)} rouleaux · ${Math.round(Math.min(1, pct) * 100)} %` : `${g.items} article${g.items > 1 ? 's' : ''}`}
                            </span>
                        </button>
                    );
                })}
                {offMap.length > 0 && (
                    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6, background: '#FFFBEB', borderColor: '#FDE68A' }}>
                        <span style={{ fontSize: 14, fontWeight: 500, color: '#92400E', display: 'inline-flex', alignItems: 'center', gap: 6 }}><MapPin size={14} /> Hors rayonnages</span>
                        {offMap.map(o => <span key={o.code} style={{ fontSize: 12, color: '#92400E' }}>{o.code === TO_COMPLETE ? 'À compléter' : o.code} : {o.items.length} article{o.items.length > 1 ? 's' : ''}</span>)}
                    </div>
                )}
            </div>
        </div>
    );
}
