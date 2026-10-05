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

    const renderEvent = (evt, isPinnedView = false) => {
        const dateObj = new Date(evt.date);
        const canPin = evt.category === 'messages';
        // Petite icône discrète par type d'événement (plus de pastille de couleur)
        let Icon = MessageSquare, iconColor = "#9B9A97";
        if (evt.type === 'system_edit') { Icon = Edit; }
        else if (evt.type === 'system_create') { Icon = CheckCircle; }

        return (
            <div key={`${evt.id}-${isPinnedView ? 'pin' : 'feed'}`} style={{ padding: '12px 4px', borderBottom: '1px solid #EDEDEB', display: 'flex', gap: 12 }}>
                <div style={{ marginTop: 2, color: iconColor, opacity: 0.75 }}><Icon size={15} /></div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, color: '#374151' }}>
                                <span style={{ fontWeight: 500, color: '#111827' }}>{evt.user}</span> <span style={{ color: '#787774' }}>{evt.actionLabel}</span> {evt.target && <span style={{ color: '#37352F', background: '#F1F1EF', padding: '1px 6px', borderRadius: 4, fontSize: 12 }}>{evt.target}</span>}
                            </span>
                            <span style={{ fontSize: 12, color: '#A8A7A3' }} title={format(dateObj, 'dd/MM/yyyy HH:mm', { locale: fr })}>{formatDistanceToNow(dateObj, { addSuffix: true, locale: fr })} · {format(dateObj, 'dd/MM HH:mm', { locale: fr })}</span>
                        </div>
                        {canPin && (
                            <button onClick={() => onTogglePin && onTogglePin(evt.id)} title={evt.pinned ? "Détacher" : "Épingler"} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, opacity: evt.pinned ? 1 : 0.3 }}>
                                <Pin size={15} color={evt.pinned ? "#37352F" : "#9B9A97"} fill={evt.pinned ? "#37352F" : "none"} />
                            </button>
                        )}
                    </div>

                    {/* Même rendu que le fil du détail de ligne : mentions + mise en forme légère */}
                    {evt.text && <div style={{ fontSize: 14, color: '#37352F', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRichText(evt.text)}</div>}
                    {evt.details && (
                        <div style={{ fontSize: 13, color: '#4B5563', marginTop: 2 }}>
                            Modif <b>{evt.details.field}</b> : <span style={{ textDecoration: 'line-through', color: '#EF4444' }}>{evt.details.old}</span> <ArrowRight size={12} style={{ margin: '0 4px', verticalAlign: 'middle' }} /> <span style={{ fontWeight: 600, color: '#10B981' }}>{evt.details.new}</span>
                        </div>
                    )}

                    {/* IMAGE CLIQUABLE */}
                    {evt.image && (
                        <div style={{ marginTop: 10 }}>
                            <img
                                src={evt.image}
                                alt="Joint"
                                onClick={() => handleImageClick(evt.image)}
                                style={{
                                    maxHeight: isMobile ? 'none' : 200, // Full height on mobile
                                    width: isMobile ? '100%' : 'auto', // Full width on mobile
                                    maxWidth: '100%',
                                    borderRadius: 8,
                                    border: '1px solid #E5E7EB',
                                    objectFit: 'cover',
                                    cursor: 'zoom-in'
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Roboto, system-ui, sans-serif' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontWeight: 500, fontSize: 20, color: '#111827' }}>Journal</div>
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
            {pinnedPosts.length > 0 && <div style={{ marginBottom: 8 }}><div style={{ padding: '8px 4px 0', fontSize: 12, color: '#9B9A97' }}>Épinglés ({pinnedPosts.length})</div>{pinnedPosts.map(post => renderEvent(post, true))}</div>}
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
