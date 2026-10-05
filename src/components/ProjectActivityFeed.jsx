import React, { useMemo, useState } from 'react';
import { mergeRowLogs } from '../lib/lineLogs';
import { useArchivedRowLogs } from '../hooks/useArchivedRowLogs';
import { Clock, MessageSquare, CheckCircle, Edit, ArrowRight, Pin, Image as ImageIcon } from 'lucide-react';
import { SmartFilterBar } from './ui/SmartFilterBar';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COLORS } from '../lib/constants/ui';
import ImageLightbox from './ui/ImageLightbox'; // <--- IMPORT LIGHTBOX
import { renderRichText } from '../lib/utils/richText.jsx';

// Avatar : initiales + couleur stable dérivée du nom (même principe que le sélecteur de chargé d'affaires).
const initialsOf = (name) => String(name || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const AVATAR_COLORS = ['#5B5BD6', '#0E8A74', '#C2410C', '#B5446E', '#2F6FB5', '#7A5AF8', '#A16207', '#3E7C3A'];
const avatarColor = (name) => {
    let h = 0;
    for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

const FILTERS = [
    { key: 'all', label: 'Tout' },
    { key: 'messages', label: 'Messages' },
    { key: 'activity', label: 'Activité' },
];

const extractActivity = (rows, wall, pinnedIds = []) => {
    const allEvents = [];
    // 1. Lignes
    if (Array.isArray(rows)) {
        rows.forEach(row => {
            const rowName = `${row.produit || 'Ligne'} - ${row.piece || '?'}`;
            if (Array.isArray(row.comments)) {
                row.comments.forEach(c => {
                    if (c.type === 'log') {
                        // Logs de modification — affichés comme activités dans le journal
                        const ts = c.createdAt ? new Date(c.createdAt).getTime() : (c.date || Date.now());
                        const eventId = `log-${row.id}-${c.id || ts}`;
                        allEvents.push({
                            id: eventId, date: ts, type: 'system_edit', category: 'activity',
                            user: c.author || 'Système', actionLabel: 'a modifié', target: rowName,
                            details: { field: c.field, old: c.from, new: c.to }, pinned: false
                        });
                        return;
                    }
                    if (c.type === 'change') return;
                    if (c.text && typeof c.text === 'string' && c.text.startsWith('Modif')) return;

                    const isImage = c.type === 'image';
                    const eventId = c.id ? String(c.id) : `com-${row.id}-${c.date}`;
                    allEvents.push({
                        id: eventId,
                        date: c.date || Date.now(),
                        type: 'line_comment',
                        category: 'messages',
                        user: c.author || 'Utilisateur',
                        actionLabel: isImage ? 'a ajouté une photo sur' : 'a commenté sur',
                        text: isImage ? (c.caption || null) : c.text,
                        image: isImage ? c.content : undefined,
                        target: rowName,
                        pinned: pinnedIds.includes(eventId)
                    });
                });
            }
            if (Array.isArray(row.history)) {
                row.history.forEach(h => {
                    if (!h.field) return;
                    const eventId = `hist-${row.id}-${h.date}-${h.field.replace(/\s/g, '')}`;
                    allEvents.push({
                        id: eventId, date: h.date, type: 'system_edit', category: 'activity',
                        user: h.author || 'Système', actionLabel: 'a modifié', target: rowName,
                        details: { field: h.field, old: h.oldVal, new: h.newVal }, pinned: false
                    });
                });
            }
            if (row.created) {
                const eventId = `create-${row.id}`;
                allEvents.push({
                    id: eventId, date: row.created, type: 'system_create', category: 'activity',
                    user: 'Système', actionLabel: 'a créé', target: rowName, pinned: false
                });
            }
        });
    }
    // 2. Mur
    if (Array.isArray(wall)) {
        wall.forEach(post => {
            const eventId = String(post.id);
            allEvents.push({
                id: eventId, date: post.date, type: 'wall_post', category: 'messages',
                user: post.author, actionLabel: 'a posté un message', text: post.content,
                image: post.image, pinned: pinnedIds.includes(eventId)
            });
        });
    }
    return allEvents.sort((a, b) => b.date - a.date);
};

export default function ProjectActivityFeed({ rows, wall, pinnedIds, onTogglePin, isMobile = false, projectId, composer = null }) {
    const [filter, setFilter] = useState('all');
    const [activeFilters, setActiveFilters] = useState([]);

    // Lightbox States
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    // Historique « Modif … » archivé hors des lignes (table line_logs) : rechargé et
    // réinjecté dans les commentaires de chaque ligne (cf. lib/lineLogs).
    const { byRow: archivedLogs } = useArchivedRowLogs(projectId, rows, !!projectId);
    const rowsWithLogs = useMemo(() => {
        if (!archivedLogs.size || !Array.isArray(rows)) return rows;
        return rows.map(r => {
            const archived = archivedLogs.get(String(r?.id));
            return archived ? { ...r, comments: mergeRowLogs(r.comments, archived) } : r;
        });
    }, [rows, archivedLogs]);

    const events = useMemo(() => extractActivity(rowsWithLogs, wall, pinnedIds), [rowsWithLogs, wall, pinnedIds]);
    const pinnedPosts = useMemo(() => events.filter(e => e.pinned), [events]);
    const feedEvents = useMemo(() => {
        const byFilter = filter === 'all' ? events : events.filter(e => e.category === filter);
        if (activeFilters.length === 0) return byFilter;
        return byFilter.filter(e => activeFilters.every(f => {
            const q = f.value.toLowerCase();
            if (f.field === 'user')    return e.user?.toLowerCase().includes(q);
            if (f.field === 'target')  return e.target?.toLowerCase().includes(q);
            if (f.field === 'content') return (
                e.text?.toLowerCase().includes(q) ||
                e.details?.field?.toLowerCase().includes(q) ||
                String(e.details?.old ?? '').toLowerCase().includes(q) ||
                String(e.details?.new ?? '').toLowerCase().includes(q)
            );
            // 'all' — tous les champs
            return (
                e.user?.toLowerCase().includes(q) ||
                e.target?.toLowerCase().includes(q) ||
                e.text?.toLowerCase().includes(q) ||
                e.details?.field?.toLowerCase().includes(q) ||
                String(e.details?.old ?? '').toLowerCase().includes(q) ||
                String(e.details?.new ?? '').toLowerCase().includes(q)
            );
        }));
    }, [events, filter, activeFilters]);

    // Galerie : On récupère toutes les images du flux pour pouvoir naviguer
    const galleryImages = useMemo(() => {
        return events
            .filter(e => e.image) // Garde ceux qui ont une image
            .map(e => ({
                id: e.id,
                url: e.image,
                user: e.user,
                date: e.date
            }));
    }, [events]);

    const handleImageClick = (imgUrl) => {
        const idx = galleryImages.findIndex(img => img.url === imgUrl);
        if (idx !== -1) {
            setLightboxIndex(idx);
            setLightboxOpen(true);
        }
    };

    // Messages des personnes : avatar + bulle (façon conversation).
    // Activités automatiques (modifs de lignes…) : une ligne compacte et grise.
    const renderEvent = (evt, isPinnedView = false) => {
        const dateObj = new Date(evt.date);
        const canPin = evt.category === 'messages';
        const when = (
            <span style={{ fontSize: 12, color: '#A0A5AD' }} title={format(dateObj, 'dd/MM/yyyy HH:mm', { locale: fr })}>
                {formatDistanceToNow(dateObj, { addSuffix: true, locale: fr })}
            </span>
        );
        const target = evt.target && (
            <span style={{ color: '#37352F', background: '#F1F2F4', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{evt.target}</span>
        );

        if (evt.category !== 'messages') {
            const Icon = evt.type === 'system_create' ? CheckCircle : Edit;
            return (
                <div key={`${evt.id}-${isPinnedView ? 'pin' : 'feed'}`} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0 6px 6px', fontSize: 13, color: '#787774', flexWrap: 'wrap' }}>
                    <Icon size={13} style={{ flexShrink: 0, alignSelf: 'center', color: '#B4B7BD' }} />
                    <span><span style={{ color: '#37352F' }}>{evt.user}</span> {evt.actionLabel} {target}</span>
                    {evt.details && (
                        <span>
                            · {evt.details.field} : <span style={{ textDecoration: 'line-through', color: '#C2410C' }}>{evt.details.old}</span>
                            <ArrowRight size={11} style={{ margin: '0 4px', verticalAlign: 'middle' }} />
                            <span style={{ color: '#1B7A4B', fontWeight: 500 }}>{evt.details.new}</span>
                        </span>
                    )}
                    <span style={{ marginLeft: 'auto' }}>{when}</span>
                </div>
            );
        }

        return (
            <div key={`${evt.id}-${isPinnedView ? 'pin' : 'feed'}`} style={{ display: 'flex', gap: 12, padding: '12px 0' }}>
                <span style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(evt.user), color: 'white', fontSize: 11, fontWeight: 600, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    {initialsOf(evt.user)}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 500, color: '#1F2A37', fontSize: 14 }}>{evt.user}</span>
                        {evt.target && <span style={{ fontSize: 12, color: '#8A8F98' }}>sur {target}</span>}
                        {when}
                        {canPin && (
                            <button onClick={() => onTogglePin && onTogglePin(evt.id)} title={evt.pinned ? "Détacher" : "Épingler"} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, opacity: evt.pinned ? 1 : 0.35 }}>
                                <Pin size={14} color={evt.pinned ? "#1E2447" : "#8A8F98"} fill={evt.pinned ? "#1E2447" : "none"} />
                            </button>
                        )}
                    </div>
                    {(evt.text || evt.image) && (
                        <div style={{ marginTop: 6, background: '#F4F5F7', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box' }}>
                            {/* Même rendu que le fil du détail de ligne : mentions + mise en forme légère */}
                            {evt.text && <div style={{ fontSize: 14, color: '#2B2F36', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRichText(evt.text)}</div>}
                            {evt.image && (
                                <img
                                    src={evt.image}
                                    alt="Joint"
                                    onClick={() => handleImageClick(evt.image)}
                                    style={{ display: 'block', marginTop: evt.text ? 8 : 0, maxHeight: isMobile ? 'none' : 200, width: isMobile ? '100%' : 'auto', maxWidth: '100%', borderRadius: 8, objectFit: 'cover', cursor: 'zoom-in' }}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Roboto, system-ui, sans-serif', padding: '20px 4px 12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                        <div style={{ fontWeight: 500, fontSize: 17, color: '#1F2A37' }}>Journal</div>
                        <div style={{ fontSize: 13, color: '#8A8F98', marginTop: 2 }}>Messages et activité du dossier</div>
                    </div>
                    {/* Filtres en onglets texte, l'actif est souligné */}
                    <div style={{ display: 'flex', gap: 16 }}>
                        {FILTERS.map(f => (
                            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '2px 0', border: 'none', borderBottom: `1.5px solid ${filter === f.key ? '#111827' : 'transparent'}`, background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: filter === f.key ? '#111827' : '#9B9A97' }}>{f.label}</button>
                        ))}
                    </div>
                </div>
                {composer}
                <SmartFilterBar
                    fields={[
                        { id: 'user',    label: 'Auteur' },
                        { id: 'target',  label: 'Ouvrage' },
                        { id: 'content', label: 'Contenu' },
                    ]}
                    activeFilters={activeFilters}
                    onAddFilter={f => setActiveFilters(prev => [...prev, f])}
                    onRemoveFilter={id => setActiveFilters(prev => prev.filter(f => f.id !== id))}
                    placeholder="Ouvrage, auteur, contenu…"
                />
            </div>
            {pinnedPosts.length > 0 && <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #EDEEF0' }}><div style={{ padding: '8px 0 0', fontSize: 12, color: '#8A8F98', display: 'flex', alignItems: 'center', gap: 6 }}><Pin size={12} /> Épinglés ({pinnedPosts.length})</div>{pinnedPosts.map(post => renderEvent(post, true))}</div>}
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>{feedEvents.length === 0 ? <div style={{ padding: '24px 4px', color: '#A8A7A3', fontSize: 14 }}>Aucune activité.</div> : feedEvents.map(evt => renderEvent(evt, false))}</div>

            {/* LIGHTBOX COMPONENT */}
            <ImageLightbox
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                images={galleryImages}
                initialIndex={lightboxIndex}
            // Pas de onRemove ici pour protéger le mur
            />
        </div>
    );
}
