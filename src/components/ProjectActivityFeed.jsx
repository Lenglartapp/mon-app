import React, { useMemo, useState } from 'react';
import { Clock, MessageSquare, CheckCircle, Edit, ArrowRight, Pin, Image as ImageIcon } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COLORS } from '../lib/constants/ui';
import ImageLightbox from './ui/ImageLightbox'; // <--- IMPORT LIGHTBOX

const FILTERS = [
    { key: 'all', label: 'Tout' },
    { key: 'messages', label: 'Messages & Photos' },
    { key: 'activity', label: 'Activités Système' },
];

const extractActivity = (rows, wall, pinnedIds = []) => {
    const allEvents = [];
    // 1. Lignes
    if (Array.isArray(rows)) {
        rows.forEach(row => {
            const rowName = `${row.produit || 'Ligne'} - ${row.piece || '?'}`;
            if (Array.isArray(row.comments)) {
                row.comments.forEach(c => {
                    if (c.text && typeof c.text === 'string' && c.text.startsWith('Modif')) return;
                    const eventId = c.id ? String(c.id) : `com-${row.id}-${c.date}`;
                    allEvents.push({
                        id: eventId, date: c.date || Date.now(), type: 'line_comment', category: 'messages',
                        user: c.author || 'Utilisateur', actionLabel: 'a commenté sur', text: c.text, target: rowName, pinned: pinnedIds.includes(eventId)
                    });
                });
            }
            if (Array.isArray(row.history)) {
                row.history.forEach(h => {
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

export default function ProjectActivityFeed({ rows, wall, pinnedIds, onTogglePin }) {
    const [filter, setFilter] = useState('all');

    // Lightbox States
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);

    const events = useMemo(() => extractActivity(rows, wall, pinnedIds), [rows, wall, pinnedIds]);
    const pinnedPosts = useMemo(() => events.filter(e => e.pinned), [events]);
    const feedEvents = useMemo(() => events.filter(e => filter === 'all' ? true : e.category === filter), [events, filter]);

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
        let Icon = MessageSquare, iconColor = "#6366f1", bgColor = "#EEF2FF";
        if (evt.type === 'wall_post') { Icon = MessageSquare; iconColor = "#2563EB"; bgColor = "#EFF6FF"; }
        else if (evt.type === 'line_comment') { Icon = MessageSquare; iconColor = "#8B5CF6"; bgColor = "#F5F3FF"; }
        else if (evt.type === 'system_edit') { Icon = Edit; iconColor = "#F59E0B"; bgColor = "#FFFBEB"; }
        else if (evt.type === 'system_create') { Icon = CheckCircle; iconColor = "#10B981"; bgColor = "#ECFDF5"; }

        return (
            <div key={`${evt.id}-${isPinnedView ? 'pin' : 'feed'}`} style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', gap: 16, backgroundColor: evt.pinned && !isPinnedView ? '#FFFBEB' : 'white', transition: 'background 0.2s' }}>
                <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={16} color={iconColor} /></div>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: 13, color: '#374151' }}>
                                <span style={{ fontWeight: 700, color: '#111827' }}>{evt.user}</span> {evt.actionLabel} {evt.target && <span style={{ fontWeight: 600, color: '#4B5563', background: '#F3F4F6', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{evt.target}</span>}
                            </span>
                            <span style={{ fontSize: 11, color: '#9ca3af' }}>{format(dateObj, 'dd/MM/yyyy HH:mm', { locale: fr })} ({formatDistanceToNow(dateObj, { addSuffix: true, locale: fr })})</span>
                        </div>
                        {canPin && (
                            <button onClick={() => onTogglePin && onTogglePin(evt.id)} title={evt.pinned ? "Détacher" : "Épingler"} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4, opacity: evt.pinned ? 1 : 0.3 }}>
                                <Pin size={16} color={evt.pinned ? "#D97706" : "#6B7280"} fill={evt.pinned ? "#D97706" : "none"} />
                            </button>
                        )}
                    </div>

                    {evt.text && <div style={{ fontSize: 14, color: '#1F2937', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{evt.text}</div>}
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
                                style={{ maxHeight: 200, maxWidth: '100%', borderRadius: 8, border: '1px solid #E5E7EB', objectFit: 'cover', cursor: 'zoom-in' }}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '12px 20px', borderBottom: `1px solid ${COLORS.border}`, background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, color: '#374151' }}><Clock size={18} /> Journal & Messages</div>
                <div style={{ display: 'flex', gap: 4 }}>
                    {FILTERS.map(f => (
                        <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '4px 12px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 500, cursor: 'pointer', background: filter === f.key ? '#374151' : '#E5E7EB', color: filter === f.key ? 'white' : '#4B5563' }}>{f.label}</button>
                    ))}
                </div>
            </div>
            {pinnedPosts.length > 0 && <div style={{ background: '#FFFBEB', borderBottom: '4px solid #F3F4F6' }}><div style={{ padding: '8px 20px', fontSize: 11, fontWeight: 700, color: '#D97706', textTransform: 'uppercase' }}>📌 Épinglés ({pinnedPosts.length})</div>{pinnedPosts.map(post => renderEvent(post, true))}</div>}
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>{feedEvents.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontStyle: 'italic' }}>Aucune activité.</div> : feedEvents.map(evt => renderEvent(evt, false))}</div>

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
