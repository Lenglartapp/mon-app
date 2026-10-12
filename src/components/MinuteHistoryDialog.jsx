import React, { useMemo, useState, useEffect } from 'react';
import { mergeRowLogs } from '../lib/lineLogs';
import { useArchivedRowLogs } from '../hooks/useArchivedRowLogs';
import { ArrowRight } from 'lucide-react';
import DaDialog, { DaTabs } from './ui/DaDialog';
import { ToolbarSearch, ToolbarButton, TonePill } from './ui/ToolbarControls';
import { readMinuteVersions } from '../lib/minuteVersions';

// Helpers
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

const formatRelativeTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diff = (now - date) / 1000;
    if (diff < 60) return "À l'instant";
    if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Status Labels Mapping
const STATUS_LABELS = {
    DRAFT: "À faire",
    IN_PROGRESS: "En cours",
    PENDING_APPROVAL: "À valider",
    REVISE: "À reprendre",
    VALIDATED: "Validée",
    ORDERED: "Commande",
    ORDER_COMPLETED: "Commande terminée",
    LOST: "Perdu"
};

const formatValue = (val, type) => {
    if (type === 'status' && STATUS_LABELS[val]) return STATUS_LABELS[val];
    return String(val ?? 'vide');
};

// Recherche insensible à la casse ET aux accents (« validee » trouve « Validée »).
const norm = (v) => String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// Texte indexé d'une entrée : auteur, champ, contexte, valeurs avant/après et
// commentaire. Les statuts sont indexés sur leur LIBELLÉ (« Validée »), pas sur
// leur code interne (« VALIDATED »), pour que la recherche parle la langue de l'écran.
const haystack = (item) => norm([
    item.author, item.user,
    item.type === 'status' ? 'Changement de Statut' : item.field,
    item.context,
    formatValue(item.from, item.type),
    formatValue(item.to, item.type),
    item.text, item.content,
].filter(Boolean).join(' '));

const MUTED = '#6B7280';
const ST_ROW = { display: 'flex', gap: 12, marginBottom: 18 };
const ST_AVATAR = {
    width: 28, height: 28, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center',
    background: '#E8EAF2', color: '#1E2447', fontSize: 11, fontWeight: 500,
};
const ST_HEAD = { display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 };
const ST_AUTHOR = { fontSize: 13, fontWeight: 500, color: '#111827' };
const ST_TIME = { fontSize: 12, color: '#9CA3AF' };
const ST_CARD = { background: 'white', border: '1px solid #E8E6E2', borderRadius: 8, padding: '10px 12px' };
const ST_FIELD = { fontSize: 12, color: MUTED, margin: '0 0 4px' };
const ST_DIFF = { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, flexWrap: 'wrap' };
const ST_FROM = { color: '#9CA3AF', textDecoration: 'line-through' };
const ST_TO = { color: '#111827', fontWeight: 500 };

// Nombre d'entrées rendues à l'ouverture, puis par clic sur « Afficher plus ».
// Rendre la liste entière d'un coup est ce qui retardait l'apparition de la pop-up.
const PAGE_SIZE = 40;

// Item Component
const HistoryItem = React.memo(({ item }) => {
    // Type: 'log' (Field Change), 'status' (Status Change), 'msg' (Comment)
    const isLog = item.type === 'log' || item.type === 'status';
    const author = item.author || item.user || "Système";

    return (
        <div style={ST_ROW}>
            <div style={ST_AVATAR}>{initials(author)}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={ST_HEAD}>
                    <span style={ST_AUTHOR}>{author}</span>
                    <span style={ST_TIME}>{formatRelativeTime(item.createdAt || item.date)}</span>
                </div>
                <div style={ST_CARD}>
                    {item.context && (
                        <div style={{ marginBottom: 6 }}><TonePill tone={5}>{item.context}</TonePill></div>
                    )}
                    {isLog ? (
                        <>
                            <div style={ST_FIELD}>{item.type === 'status' ? 'Changement de statut' : (item.field || 'Modification')}</div>
                            <div style={ST_DIFF}>
                                <span style={ST_FROM}>{formatValue(item.from, item.type)}</span>
                                <ArrowRight size={13} color="#9CA3AF" />
                                <span style={ST_TO}>{formatValue(item.to, item.type)}</span>
                            </div>
                        </>
                    ) : (
                        <div style={{ fontSize: 13, color: '#374151', whiteSpace: 'pre-wrap' }}>{item.text || item.content}</div>
                    )}
                </div>
            </div>
        </div>
    );
});
HistoryItem.displayName = 'HistoryItem';

// Onglet « Versions » : liste des snapshots restaurables (table minutes_history).
const REASON_LABELS = {
    auto:            { label: 'Auto',                tone: null },
    'shrink-guard':  { label: 'Sécurité (chute)',    tone: 2 },
    'pre-restore':   { label: 'Avant restauration',  tone: 4 },
};
const fmtEur = (n) => (n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(n) || 0));

function VersionsPanel({ minuteId, canEdit, onRestoreInPlace, onRestoreAsVariant, onDone }) {
    const [versions, setVersions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        let alive = true;
        if (!minuteId) return;
        setLoading(true); setError(null);
        readMinuteVersions(minuteId)
            .then((v) => { if (alive) setVersions(v); })
            .catch((e) => alive && setError(e.message))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [minuteId]);

    const run = async (fn, version) => {
        if (!fn) return;
        setBusy(true);
        try { await fn(version); onDone?.(); }
        catch (e) { setError(e.message); }
        finally { setBusy(false); setSelected(null); }
    };

    return (
        <div style={{ padding: '18px 28px' }}>
            {loading && <div style={{ color: '#9CA3AF', fontSize: 13 }}>Chargement des versions…</div>}
            {error && <div style={{ color: '#B91C1C', fontSize: 13, marginBottom: 8 }}>{error}</div>}
            {!loading && !error && versions.length === 0 && (
                <div style={{ textAlign: 'center', color: '#9CA3AF', padding: '48px 0', fontSize: 13 }}>
                    Aucune version enregistrée pour l'instant.<br />Les versions se créent automatiquement au fil des modifications.
                </div>
            )}
            {versions.map((v) => {
                const r = REASON_LABELS[v.reason] || REASON_LABELS.auto;
                const isSel = selected?.id === v.id;
                return (
                    <div key={v.id} style={{ border: `1px solid ${isSel ? '#1E2447' : '#E8E6E2'}`, borderRadius: 8, marginBottom: 8, background: 'white', overflow: 'hidden' }}>
                        <div onClick={() => canEdit && setSelected(isSel ? null : v)}
                             style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', cursor: canEdit ? 'pointer' : 'default' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{formatRelativeTime(v.captured_at)}</div>
                                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                                    {new Date(v.captured_at).toLocaleString('fr-FR')} · {v.nb_lignes ?? '—'} ligne(s) · {fmtEur(v.ca_total)}
                                </div>
                            </div>
                            <TonePill tone={r.tone}>{r.label}</TonePill>
                        </div>
                        {isSel && canEdit && (
                            <div style={{ borderTop: '1px solid #E8E6E2', padding: 12, background: '#F4F4F4', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                <div style={{ fontSize: 12, color: MUTED }}>
                                    « Revenir » remplace le contenu actuel (l'état actuel est sauvegardé au passage → réversible). « Variante » crée un nouveau devis et garde l'actuel intact.
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <ToolbarButton primary disabled={busy} onClick={() => run(onRestoreInPlace, v)}>Revenir à cette version</ToolbarButton>
                                    <ToolbarButton disabled={busy} onClick={() => run(onRestoreAsVariant, v)}>Créer une variante</ToolbarButton>
                                    <ToolbarButton disabled={busy} onClick={() => setSelected(null)}>Annuler</ToolbarButton>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
            {!canEdit && versions.length > 0 && (
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>Lecture seule — la restauration nécessite les droits d'édition.</div>
            )}
        </div>
    );
}

export default function MinuteHistoryDialog({ open, onClose, minute, canEdit = false, onRestoreInPlace, onRestoreAsVariant }) {
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState('journal');

    // Repart du haut à chaque ouverture (sinon on rouvre sur 400 entrées rendues).
    useEffect(() => { if (open) { setVisibleCount(PAGE_SIZE); setQuery(''); setTab('journal'); } }, [open]);

    // Historique « Modif … » archivé hors des lignes (table line_logs), chargé
    // uniquement quand le dialogue est ouvert (cf. lib/lineLogs).
    const allRows = useMemo(
        () => (open && minute ? [...(minute.lines || []), ...(minute.deplacements || []), ...(minute.extraDepenses || [])] : []),
        [open, minute]
    );
    const { byRow: archivedLogs, loading: archivedLoading } = useArchivedRowLogs(minute?.id, allRows, !!open && !!minute);

    const sortedActivities = useMemo(() => {
        // PERF — ce dialogue reste monté en permanence dans ChiffrageScreen : sans
        // ce garde-fou, l'agrégation + le tri seraient refaits à CHAQUE frappe dans
        // le devis (`minute` change en continu), pour un panneau invisible.
        if (!open || !minute) return [];

        const all = [];

        // 1. Minute Level Logs (Status changes, stored in modules.history or settings.history or root logs)
        const globalLogs = minute?.modules?.history || minute?.settings?.history || minute?.logs || [];
        if (Array.isArray(globalLogs)) {
            all.push(...globalLogs);
        }

        // 2. Line Level Logs (Aggregated)
        const processLines = (arr, typeName) => {
            (arr || []).forEach(row => {
                const comments = mergeRowLogs(row.comments, archivedLogs.get(String(row.id)));
                if (comments.length) {
                    comments.forEach(c => {
                        // Enrich with context
                        const context = `${typeName} - ${row.produit || 'Article'} ${row.piece ? `(${row.piece})` : ''} #${String(row.id).slice(-4)}`;
                        all.push({ ...c, context });
                    });
                }
            });
        };

        processLines(minute.lines, "Ligne");
        processLines(minute.deplacements, "Logistique");
        processLines(minute.extraDepenses, "Autre");

        // Sort by Date Descending — timestamp calculé UNE fois par entrée
        // (un `new Date()` par comparaison, c'est O(n log n) parsings inutiles).
        return all
            .map(item => ({ item, ts: new Date(item.createdAt || item.date || 0).getTime() }))
            .sort((a, b) => b.ts - a.ts)
            .map(x => x.item);
    }, [open, minute, archivedLogs]);

    // Index de recherche calculé UNE fois par entrée, pas à chaque frappe.
    const indexed = useMemo(
        () => sortedActivities.map(item => ({ item, hay: haystack(item) })),
        [sortedActivities]
    );

    // Tous les termes doivent être présents (« audrey coef » = les deux).
    const filteredActivities = useMemo(() => {
        const terms = norm(query).split(/\s+/).filter(Boolean);
        if (terms.length === 0) return sortedActivities;
        return indexed.filter(({ hay }) => terms.every(t => hay.includes(t))).map(x => x.item);
    }, [indexed, sortedActivities, query]);

    // Une nouvelle recherche repart de la première page.
    useEffect(() => { setVisibleCount(PAGE_SIZE); }, [query]);

    const visibleActivities = useMemo(
        () => filteredActivities.slice(0, visibleCount),
        [filteredActivities, visibleCount]
    );

    return (
        <DaDialog
            open={open}
            onClose={onClose}
            title="Historique"
            subtitle={minute?.name}
            maxWidth="sm"
            height="80vh"
            bodyPadding="0"
            tabs={<DaTabs tabs={[{ key: 'journal', label: 'Journal' }, { key: 'versions', label: 'Versions' }]} value={tab} onChange={setTab} />}
        >
            {tab === 'versions' ? (
                <VersionsPanel
                    minuteId={minute?.id}
                    canEdit={canEdit}
                    onRestoreInPlace={onRestoreInPlace}
                    onRestoreAsVariant={onRestoreAsVariant}
                    onDone={onClose}
                />
            ) : (
                <>
                    {/* Barre de recherche : collée en haut, elle reste visible pendant le défilement. */}
                    <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'white', padding: '14px 28px 12px', borderBottom: '1px solid #E8E6E2' }}>
                        <ToolbarSearch value={query} onChange={setQuery} placeholder="Rechercher : un auteur, un champ, une valeur, un statut…" width="100%" />
                        {(query || archivedLoading) && (
                            <div style={{ marginTop: 6, fontSize: 12, color: MUTED }}>
                                {archivedLoading ? "Chargement de l'historique des lignes…" : `${filteredActivities.length} résultat${filteredActivities.length > 1 ? 's' : ''} sur ${sortedActivities.length}`}
                            </div>
                        )}
                    </div>

                    <div style={{ padding: '18px 28px' }}>
                        {sortedActivities.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 13 }}>
                                Aucune activité enregistrée pour cette minute.
                            </div>
                        ) : filteredActivities.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '48px 0', color: '#9CA3AF', fontSize: 13 }}>
                                Aucune activité ne correspond à « {query} ».
                            </div>
                        ) : (
                            <>
                                {visibleActivities.map((item, i) => (
                                    <HistoryItem key={item.id || i} item={item} />
                                ))}
                                {visibleCount < filteredActivities.length && (
                                    <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 8 }}>
                                        <ToolbarButton onClick={() => setVisibleCount(c => c + PAGE_SIZE)}>
                                            Afficher plus ({filteredActivities.length - visibleCount} restantes)
                                        </ToolbarButton>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </>
            )}
        </DaDialog>
    );
}
