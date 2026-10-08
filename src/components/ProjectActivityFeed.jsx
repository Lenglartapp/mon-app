import React, { useEffect, useMemo, useState } from 'react';
import { fetchProjectEvents } from '../lib/projectEvents';
import { mergeRowLogs } from '../lib/lineLogs';
import { useArchivedRowLogs } from '../hooks/useArchivedRowLogs';
import { Clock, MessageSquare, CheckCircle, Edit, ArrowRight, Pin, Image as ImageIcon } from 'lucide-react';
import { SmartFilterBar } from './ui/SmartFilterBar';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { COLORS } from '../lib/constants/ui';
import ImageLightbox from './ui/ImageLightbox'; // <--- IMPORT LIGHTBOX
import { renderRichText } from '../lib/utils/richText.jsx';
import { useAuth } from '../auth';

// Pastille d'épingle : petit rond bleu nuit, épingle blanche inclinée (message épinglé) ;
// épingle grise discrète sinon.
function PinBadge({ pinned, size = 22 }) {
    if (!pinned) return <Pin size={14} color="#9B9A97" style={{ transform: 'rotate(35deg)' }} />;
    return (
        <span style={{ width: size, height: size, borderRadius: '50%', background: '#1E2447', display: 'inline-grid', placeItems: 'center', boxShadow: '0 1px 3px rgba(30,36,71,0.3)' }}>
            <Pin size={Math.round(size * 0.55)} color="white" fill="white" style={{ transform: 'rotate(35deg)' }} />
        </span>
    );
}

// Avatar : initiales + couleur stable dérivée du nom (même principe que le sélecteur de chargé d'affaires).
const initialsOf = (name) => String(name || "?").trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
const AVATAR_COLORS = ['#5B5BD6', '#0E8A74', '#C2410C', '#B5446E', '#2F6FB5', '#7A5AF8', '#A16207', '#3E7C3A'];
const avatarColor = (name) => {
    let h = 0;
    for (const c of String(name || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

// Exemple affiché tant que le dossier n'a aucun message : montre à quoi ressemblera le fil.
function ExampleMessage() {
    return (
        <div style={{ display: 'flex', gap: 12, padding: '14px 0', opacity: 0.75 }} aria-label="Exemple de message">
            <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#D5D8DD', color: 'white', fontSize: 11, fontWeight: 600, display: 'grid', placeItems: 'center', flexShrink: 0 }}>EX</span>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontWeight: 500, color: '#5B616B', fontSize: 14 }}>Exemple</span>
                    <span style={{ fontSize: 12, color: '#A0A5AD' }}>aperçu — aucun message pour l'instant</span>
                </div>
                <div style={{ marginTop: 6, background: '#F4F4F4', borderRadius: '4px 14px 14px 14px', padding: '10px 14px', display: 'inline-block', maxWidth: '100%', fontSize: 14, color: '#6B7079', lineHeight: 1.5, fontStyle: 'italic' }}>
                    « Écrivez ici les infos utiles à toute l'équipe : rendez-vous client, contraintes de pose, décisions prises… Ajoutez une photo si besoin, et épinglez les messages importants pour les garder en haut. »
                </div>
            </div>
        </div>
    );
}

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

// Événements du DOSSIER (table project_events) : la création (tout en bas du fil, c'est la plus
// ancienne) en activité, et ce qu'Odoo a déclenché en message publié par « Odoo ».
const CREATION_TEXT = {
    blank: () => 'a créé le dossier (projet vierge)',
    import: (d) => `a créé le dossier par import manuel de la minute « ${d.minuteName || '—'} »`,
    odoo: (d) => `a créé le dossier à la confirmation de la commande ${d.orderName || ''}`.trim(),
};
const projectEventsToFeed = (list) => list.map((e) => {
    const date = Date.parse(e.created_at) || 0;
    if (e.type === 'created') {
        const d = e.detail || {};
        const text = e.guessed
            ? `Dossier créé ${e.label.includes('import') ? 'depuis une minute (import)' : '(projet vierge)'} — origine reconstituée`
            : (CREATION_TEXT[d.origin] || CREATION_TEXT.blank)(d);
        return { id: `pe-${e.id}`, date, type: 'system_create', category: 'activity', user: e.guessed ? 'Système' : (e.user_name || 'Système'), actionLabel: text, pinned: false };
    }
    return { id: `pe-${e.id}`, date, type: 'system_post', category: 'messages', user: e.user_name || 'Système', actionLabel: 'a publié', text: e.label, pinned: false };
});

export default function ProjectActivityFeed({ project = null, rows, wall, pinnedIds, onTogglePin, isMobile = false, projectId, composer = null }) {
    const { currentUser } = useAuth();
    // Mes propres messages : à droite, sur bulle bleu ciel (comme une conversation)
    const myNames = new Set([currentUser?.name, currentUser?.displayName, currentUser?.email].filter(Boolean).map(n => String(n).trim().toLowerCase()));
    const isMineName = (name) => myNames.has(String(name || '').trim().toLowerCase());
    const [filter, setFilter] = useState('messages'); // par défaut : les messages (l'activité reste à un clic)
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

    // Création + événements Odoo du dossier ; rechargés quand le statut change (archivage par Odoo…).
    const [dossierEvents, setDossierEvents] = useState([]);
    useEffect(() => {
        if (!project?.id) return undefined;
        let alive = true;
        fetchProjectEvents(project).then(({ events: list }) => { if (alive) setDossierEvents(projectEventsToFeed(list)); });
        return () => { alive = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [project?.id, project?.status]);

    const events = useMemo(() => {
        const list = extractActivity(rowsWithLogs, wall, pinnedIds);
        const extra = dossierEvents.map(e => ({ ...e, pinned: (pinnedIds || []).includes(e.id) }));
        // La création ferme toujours le fil (tout en bas), même si des modifications recopiées du
        // chiffrage sont plus anciennes que le projet.
        const isCreation = (e) => e.type === 'system_create' && String(e.id).startsWith('pe-');
        return [...list, ...extra].sort((a, b) => (isCreation(a) - isCreation(b)) || (b.date - a.date));
    }, [rowsWithLogs, wall, pinnedIds, dossierEvents]);
    const pinnedPosts = useMemo(() => events.filter(e => e.pinned), [events]);
    const feedEvents = useMemo(() => {
        // Les épinglés sont déjà affichés en haut : on ne les répète pas dans le fil.
        const unpinned = events.filter(e => !e.pinned);
        const byFilter = filter === 'all' ? unpinned : unpinned.filter(e => e.category === filter);
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

        const mine = isMineName(evt.user);
        const pinButton = canPin && (
            <button onClick={() => onTogglePin && onTogglePin(evt.id)} title={evt.pinned ? "Détacher" : "Épingler"}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, display: 'flex', opacity: evt.pinned ? 1 : 0.6 }}>
                <PinBadge pinned={evt.pinned} size={20} />
            </button>
        );
        return (
            <div key={`${evt.id}-${isPinnedView ? 'pin' : 'feed'}`} style={{ display: 'flex', gap: 12, padding: '12px 0', flexDirection: mine ? 'row-reverse' : 'row' }}>
                {!mine && (
                    <span style={{ width: 30, height: 30, borderRadius: '50%', background: avatarColor(evt.user), color: 'white', fontSize: 11, fontWeight: 600, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        {initialsOf(evt.user)}
                    </span>
                )}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', width: '100%', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        {mine && pinButton && <span style={{ marginRight: 'auto' }}>{pinButton}</span>}
                        <span style={{ fontWeight: 500, color: '#1F2A37', fontSize: 14 }}>{mine ? 'Vous' : evt.user}</span>
                        {evt.target && <span style={{ fontSize: 12, color: '#8A8F98' }}>sur {target}</span>}
                        {when}
                        {!mine && pinButton && <span style={{ marginLeft: 'auto' }}>{pinButton}</span>}
                    </div>
                    {(evt.text || evt.image) && (
                        <div style={{
                            marginTop: 6, padding: '10px 14px', display: 'inline-block', maxWidth: '85%', boxSizing: 'border-box',
                            background: mine ? '#D6E4F8' : '#F4F4F4',
                            borderRadius: mine ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                        }}>
                            {/* Même rendu que le fil du détail de ligne : mentions + mise en forme légère */}
                            {evt.text && <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{renderRichText(evt.text)}</div>}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                        <div style={{ fontWeight: 500, fontSize: 17, color: '#1F2A37' }}>Journal</div>
                        <div style={{ fontSize: 13, color: '#8A8F98', marginTop: 2 }}>Messages et activité du dossier</div>
                    </div>
                    {/* Recherche compacte, à gauche des filtres (onglets texte, l'actif est souligné) */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <div style={{ width: 230, fontSize: 13 }}>
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
                    <div style={{ display: 'flex', gap: 16 }}>
                        {FILTERS.map(f => (
                            <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: '2px 0', border: 'none', borderBottom: `1.5px solid ${filter === f.key ? '#111827' : 'transparent'}`, background: 'transparent', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: filter === f.key ? '#111827' : '#9B9A97' }}>{f.label}</button>
                        ))}
                    </div>
                    </div>
                </div>
                {composer}
            </div>
            {pinnedPosts.length > 0 && <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #EDEEF0' }}><div style={{ padding: '8px 0 0', fontSize: 13, color: '#374151', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}><PinBadge pinned size={18} /> Épinglés <span style={{ color: '#9B9A97', fontWeight: 400 }}>{pinnedPosts.length}</span></div>{pinnedPosts.map(post => renderEvent(post, true))}</div>}
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>{feedEvents.length === 0
                ? (pinnedPosts.length > 0
                    ? null
                    : filter === 'activity'
                        ? <div style={{ padding: '24px 0', color: '#A0A5AD', fontSize: 14 }}>Aucune activité.</div>
                        : <ExampleMessage />)
                : feedEvents.map(evt => renderEvent(evt, false))}</div>

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
