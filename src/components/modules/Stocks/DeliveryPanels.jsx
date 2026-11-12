// Tableau de bord Inventaire : alertes de livraison des tissus commandés, qualité des DLE,
// arrivées prochaines. Lecture seule : la DLE se saisit dans Odoo (synchro de nuit).
import React, { useMemo, useState } from 'react';
import { CheckCircle2, CalendarX2, Truck, ArrowUpRight, WifiOff, AlertTriangle } from 'lucide-react';
import DaDialog from '../../ui/DaDialog';
import ProjectCourseListPanel from '../../odoo/ProjectCourseListPanel';
import { upcomingArrivals, fmtDay, HORIZONS, LEVELS } from '../../../lib/stock/deliveryAlerts';

// Couleur portée par une pastille et le texte du niveau, jamais par le fond (DA épurée).
const LEVEL_TONES = {
    late: { color: '#DC2626' },
    tension: { color: '#D97706' },
    nodate: { color: '#2563EB' },
    ok: { color: 'var(--df-muted)' },
};
const Dot = ({ color, size = 8 }) => <span aria-hidden style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0, display: 'inline-block' }} />;
// Zone qui défile à l'intérieur d'une carte de hauteur fixe
const scrollArea = { flex: 1, minHeight: 0, overflowY: 'auto' };
const ALERT_KEYS = ['late', 'tension', 'nodate'];
const HORIZON_KEY = 'df_stock_arrivals_horizon';
const fmtQty = (n) => (Math.round(n * 10) / 10).toLocaleString('fr-FR');
const small = { fontSize: 12, color: 'var(--df-muted)' };
// Dates de livraison manquantes : au-delà de 10 % de tissus commandés sans DLE, ce n'est plus acceptable.
const DLE_MISSING_TARGET = 10;
const missingTone = (pct) => (pct <= DLE_MISSING_TARGET ? '#059669' : pct <= 25 ? '#D97706' : '#DC2626');

/** Message d'état commun : sans connexion, on n'affiche JAMAIS un faux « aucune alerte ». */
function StateBox({ state }) {
    if (!state.online) return <Empty icon={<WifiOff size={22} />} text="Connexion requise" />;
    if (state.error) return <Empty text={`Liste de courses illisible : ${state.error}`} />;
    if (state.loading) return <Empty text="Chargement…" />;
    return null;
}
function Empty({ icon, text }) {
    return (
        <div style={{ flex: 1, minHeight: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'var(--df-muted)', fontSize: 12, textAlign: 'center' }}>
            {icon}{text}
        </div>
    );
}

/** Une ligne de tissu : projet, tissu, reste, DLE, libellé du niveau. */
function AlertRow({ item, onOpen, showLevel = true, today, index = 0 }) {
    const tone = LEVEL_TONES[item.level];
    const qty = item.partial ? `reste ${fmtQty(item.remaining)} / ${fmtQty(item.ordered)} ${item.unit}` : `${fmtQty(item.remaining)} ${item.unit}`;
    return (
        <div
            role="button" tabIndex={0}
            onClick={() => onOpen?.(item)}
            onKeyDown={(e) => { if (e.key === 'Enter') onOpen?.(item); }}
            title={item.need ? `Besoin le ${fmtDay(item.need, today)} (${item.needSource})` : 'Pas de date de besoin (ni créneau confection, ni livraison projet)'}
            style={{ padding: '7px 10px', borderRadius: 8, background: index % 2 === 0 ? 'var(--df-surface-5)' : 'transparent', cursor: 'pointer' }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {showLevel && <Dot color={tone.color} />}
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--df-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.projectName}</span>
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--df-text-2)', whiteSpace: 'nowrap' }}>{item.dle ? `DLE ${fmtDay(item.dle, today)}` : 'DLE —'}</span>
            </div>
            <div style={{ ...small, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label} · {qty}</div>
            {showLevel
                ? <div style={{ fontSize: 12, fontWeight: 600, color: tone.color, paddingLeft: 16 }}>{item.text}</div>
                : item.level === 'tension' && <span style={{ fontSize: 12, fontWeight: 600, color: LEVEL_TONES.tension.color }}>En tension · {item.text}</span>}
        </div>
    );
}

/** Carte « Alertes potentielles de tension » : tissus commandés en retard, trop tardifs pour la confection ou sans DLE. */
export function DeliveryAlertsCard({ state, card, title, onOpenList, onOpenItem }) {
    const today = new Date();
    const [level, setLevel] = useState(null);
    const counts = state.result?.counts;
    const alerts = state.result?.alerts || [];
    const shown = level ? alerts.filter((a) => a.level === level) : alerts;
    return (
        <div style={card}>
            <div style={title}><AlertTriangle size={14} color={counts?.late ? LEVEL_TONES.late.color : LEVEL_TONES.tension.color} /> Alertes potentielles de tension</div>
            {!state.result ? <StateBox state={state} /> : (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {ALERT_KEYS.map((k) => {
                            const n = counts[k]; const active = level === k;
                            return (
                                <button
                                    key={k} type="button" disabled={!n} aria-pressed={active}
                                    onClick={() => setLevel(active ? null : k)}
                                    style={{
                                        padding: '8px 6px', borderRadius: 8, cursor: n ? 'pointer' : 'default', fontFamily: 'inherit', textAlign: 'left',
                                        border: `1px solid ${active ? 'var(--df-primary)' : 'var(--df-border)'}`,
                                        background: active ? 'var(--df-surface-5)' : 'var(--df-bg)', opacity: n ? 1 : 0.5,
                                    }}
                                >
                                    <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Roboto, system-ui, sans-serif', color: 'var(--df-text)', lineHeight: 1.1 }}>{n}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 500, color: 'var(--df-text-2)', whiteSpace: 'nowrap' }}>
                                        <Dot color={LEVEL_TONES[k].color} />{LEVELS[k].label}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {alerts.length === 0 ? (
                        <Empty icon={<CheckCircle2 size={22} />} text="Aucun retard de livraison" />
                    ) : (
                        <>
                            <div style={{ ...scrollArea, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {shown.map((a, i) => <AlertRow key={a.id} item={a} index={i} onOpen={onOpenItem} today={today} />)}
                            </div>
                            <button type="button" onClick={() => onOpenList({ level })} style={linkBtn}>
                                Ouvrir la liste ({shown.length}) <ArrowUpRight size={12} />
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
const linkBtn = { alignSelf: 'flex-start', background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer', color: 'var(--df-primary-text)', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' };

/** Carte « Dates de livraison manquantes » : part des tissus commandés sans DLE. */
export function DeliveryQualityCard({ state, card, title, onOpenList }) {
    const [by, setBy] = useState('supplier');
    const q = state.result?.quality;
    const pct = q && q.total ? Math.round((q.withoutDle / q.total) * 100) : 0;
    const rows = q ? (by === 'supplier' ? q.bySupplier : q.byProject) : [];
    return (
        <div style={card}>
            <div style={title}><CalendarX2 size={14} color={missingTone(pct)} /> Dates de livraison manquantes</div>
            {!q ? <StateBox state={state} /> : q.total === 0 ? <Empty icon={<CheckCircle2 size={22} />} text="Aucun tissu commandé en attente" /> : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--df-text)', lineHeight: 1.5 }}>
                        <strong style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Roboto, system-ui, sans-serif', color: missingTone(pct) }}>{pct} %</strong>{' '}
                        des tissus commandés n'ont pas de DLE (date de livraison estimée) sur Odoo
                        <div style={small}>{q.withoutDle} tissu{q.withoutDle > 1 ? 's' : ''} sur {q.total}</div>
                    </div>
                    {/* Barre = part MANQUANTE ; repère à l'objectif (10 % maximum). */}
                    <div>
                        <div title={`${q.withoutDle} tissus sans DLE sur ${q.total}`} style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--df-surface-2)' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: missingTone(pct), borderRadius: 4 }} />
                            <div style={{ position: 'absolute', left: `${DLE_MISSING_TARGET}%`, top: -3, bottom: -3, width: 2, borderRadius: 1, background: 'var(--df-text-2)' }} />
                        </div>
                        <div style={{ ...small, marginTop: 6, paddingLeft: `calc(${DLE_MISSING_TARGET}% - 2px)` }}>Objectif : {DLE_MISSING_TARGET} % maximum</div>
                    </div>
                    {q.withoutDle > 0 && (
                        <>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[['supplier', 'Par fournisseur'], ['project', 'Par projet']].map(([k, l]) => (
                                    <button key={k} type="button" className="df-pill-tab" data-active={by === k} onClick={() => setBy(k)}
                                        style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: by === k ? 'var(--df-primary)' : 'transparent', color: by === k ? '#FFFFFF' : 'var(--df-text-3)' }}>
                                        {l}
                                    </button>
                                ))}
                            </div>
                            <div style={{ ...scrollArea, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {rows.map((r, i) => (
                                    <button key={r.name} type="button" title="Voir ses tissus sans date"
                                        onClick={() => onOpenList({ level: 'nodate', [by]: r.name })}
                                        style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 10px', borderRadius: 8, border: 'none', background: i % 2 === 0 ? 'var(--df-surface-5)' : 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, color: 'var(--df-text)', textAlign: 'left' }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                                        <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{r.without} <span style={{ fontWeight: 400, color: 'var(--df-faint)' }}>/ {r.total}</span></span>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

const readHorizon = () => {
    try { const v = Number(window.localStorage.getItem(HORIZON_KEY)); return HORIZONS.includes(v) ? v : 7; } catch { return 7; }
};

/** Carte « Arrivées prochaines » : DLE dans l'horizon choisi (7 / 14 / 30 j, mémorisé sur l'appareil). */
export function UpcomingArrivalsCard({ state, card, title, onOpenList, onOpenItem }) {
    const today = new Date();
    const [horizon, setHorizonState] = useState(readHorizon);
    const setHorizon = (h) => { setHorizonState(h); try { window.localStorage.setItem(HORIZON_KEY, String(h)); } catch { /* stockage indisponible */ } };
    const groups = useMemo(() => (state.result ? upcomingArrivals(state.result.items, { today: new Date(), horizon }) : []), [state.result, horizon]);
    const noDate = state.result?.counts.nodate || 0;
    return (
        <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={title}><Truck size={14} color="#059669" /> Arrivées prochaines</div>
                <div style={{ display: 'flex', gap: 2 }}>
                    {HORIZONS.map((h) => (
                        <button key={h} type="button" className="df-pill-tab" data-active={horizon === h} onClick={() => setHorizon(h)}
                            style={{ padding: '4px 12px', borderRadius: 99, fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', background: horizon === h ? 'var(--df-primary)' : 'transparent', color: horizon === h ? '#FFFFFF' : 'var(--df-text-3)' }}>
                            {h} j
                        </button>
                    ))}
                </div>
            </div>
            {!state.result ? <StateBox state={state} /> : (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
                    {groups.length === 0 ? <Empty text={`Aucune arrivée prévue dans les ${horizon} prochains jours`} /> : (
                        <div style={{ ...scrollArea, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {groups.map((g) => (
                                <div key={g.key}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--df-text)', fontFamily: 'Roboto, system-ui, sans-serif' }}>{g.label}</span>
                                        <span style={small}>{g.count} tissu{g.count > 1 ? 's' : ''}{g.ml > 0 ? ` · ${fmtQty(g.ml)} ml` : ''}</span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                        {g.items.map((i, n) => <AlertRow key={i.id} item={i} index={n} onOpen={onOpenItem} showLevel={false} today={today} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {noDate > 0 && (
                        <button type="button" onClick={() => onOpenList({ level: 'nodate' })}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, border: '1px dashed var(--df-border)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', fontSize: 12, color: 'var(--df-text)', flexShrink: 0 }}>
                            <Dot color={LEVEL_TONES.nodate.color} />
                            <span><strong>{noDate} tissu{noDate > 1 ? 's' : ''} commandé{noDate > 1 ? 's' : ''} sans DLE</strong> : arrivée inconnue</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

/** Liste complète des alertes, filtrable (niveau, fournisseur, projet). */
export function DeliveryListDialog({ open, filter, onClose, onFilter, state, onOpenItem }) {
    const today = new Date();
    const alerts = state.result?.alerts || [];
    const list = alerts.filter((a) => (!filter?.level || a.level === filter.level)
        && (!filter?.supplier || a.supplier === filter.supplier)
        && (!filter?.project || a.projectName === filter.project));
    const chip = (key, active, label, onClick, tone) => (
        <button key={key} type="button" onClick={onClick}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 99, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', border: `1px solid ${active ? 'var(--df-primary)' : 'var(--df-border)'}`, background: active ? 'var(--df-surface-5)' : 'transparent', color: active ? 'var(--df-text)' : 'var(--df-text-3)', fontWeight: active ? 600 : 400 }}>
            {tone && <Dot color={tone.color} />}{label}
        </button>
    );
    const scope = filter?.supplier || filter?.project;
    return (
        <DaDialog open={open} onClose={onClose} title="Livraisons de tissus" subtitle={scope ? `Filtré : ${scope}` : 'Tous les projets'} maxWidth="md" height="80vh">
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {chip('all', !filter?.level, `Toutes (${alerts.length})`, () => onFilter({ ...filter, level: null }))}
                {ALERT_KEYS.map((k) => chip(k, filter?.level === k, `${LEVELS[k].label} (${state.result?.counts[k] || 0})`, () => onFilter({ ...filter, level: k }), LEVEL_TONES[k]))}
                {scope && chip('scope', true, `${scope} ✕`, () => onFilter({ level: filter.level }))}
            </div>
            {list.length === 0 ? <Empty icon={<CheckCircle2 size={22} />} text="Aucun retard de livraison" /> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {list.map((a, i) => <AlertRow key={a.id} item={a} index={i} onOpen={onOpenItem} today={today} />)}
                </div>
            )}
        </DaDialog>
    );
}

/** Liste de courses d'un projet (clic sur une ligne d'alerte). */
export function CourseListDialog({ project, onClose }) {
    return (
        <DaDialog open={!!project} onClose={onClose} title="Liste de courses" subtitle={project?.name} maxWidth="xl" height="80vh">
            {project && <ProjectCourseListPanel droitfilProjectId={project.id} odooProjectId={project.id_projet_odoo} projectName={project.name} />}
        </DaDialog>
    );
}
