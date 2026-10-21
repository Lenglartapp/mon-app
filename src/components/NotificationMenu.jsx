import React, { useState } from 'react';
import Popover from '@mui/material/Popover';
import { useNotifications } from '../contexts/NotificationContext';
import { DaTabs } from './ui/DaDialog';

const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

// --- HELPER : Formatage de la date (Sans librairie externe) ---
function formatTimeAgo(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    let interval = seconds / 31536000;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " an(s)";
    interval = seconds / 2592000;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " mois";
    interval = seconds / 86400;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " j";
    interval = seconds / 3600;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " h";
    interval = seconds / 60;
    if (interval > 1) return "Il y a " + Math.floor(interval) + " min";
    return "À l'instant";
}

export default function NotificationMenu({ anchorEl, open, onClose, onAction }) {
    const { notifications, markAsRead, markAllAsRead } = useNotifications();
    const [tab, setTab] = useState('unread');
    const unread = notifications.filter(n => !n.read);
    const displayList = tab === 'unread' ? unread : notifications;

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ sx: { width: 380, borderRadius: '12px', mt: 1, boxShadow: '0 20px 40px rgba(17,24,39,0.18)', fontFamily: 'Roboto, system-ui, sans-serif' } }}
        >
            {/* En-tête */}
            <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--df-border-soft)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 18, fontWeight: 400, color: 'var(--df-text)' }}>Notifications</span>
                    {unread.length > 0 && (
                        <button
                            type="button"
                            onClick={markAllAsRead}
                            style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontSize: 12, fontWeight: 500, color: 'var(--df-primary-text)', fontFamily: 'inherit' }}
                        >
                            Tout marquer comme lu
                        </button>
                    )}
                </div>
                <DaTabs
                    tabs={[{ key: 'unread', label: `Non lues (${unread.length})` }, { key: 'all', label: 'Historique' }]}
                    value={tab}
                    onChange={setTab}
                />
            </div>

            {/* Liste */}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {displayList.map((n) => (
                    <div
                        key={n.id}
                        role="button"
                        onClick={() => {
                            if (!n.read) markAsRead(n.id);
                            // Action attachée (ex. ouvrir le devis) : on l'exécute et on ferme.
                            if (n.action && onAction) {
                                onAction(n.action);
                                onClose();
                            }
                        }}
                        style={{
                            display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 18px', cursor: 'pointer',
                            background: n.read ? 'var(--df-bg)' : 'var(--df-selected)', borderBottom: '1px solid var(--df-x-F0EFEC)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--df-surface)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = n.read ? 'var(--df-bg)' : 'var(--df-selected)'; }}
                    >
                        <div style={{ width: 30, height: 30, borderRadius: 99, flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--df-navy-bg)', color: 'var(--df-primary-text)', fontSize: 11, fontWeight: 500 }}>
                            {initials(n.sender_name)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--df-text)' }}>
                                {n.title === 'Mention' ? `${n.sender_name} vous a mentionné` : n.title}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--df-text-3)', marginTop: 2, lineHeight: 1.45 }}>{n.message}</div>
                            <div style={{ fontSize: 12, color: 'var(--df-faint)', marginTop: 4 }}>{formatTimeAgo(n.created_at)}</div>
                        </div>
                        {!n.read && <span style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--df-primary)', marginTop: 6, flexShrink: 0 }} />}
                    </div>
                ))}

                {displayList.length === 0 && (
                    <div style={{ padding: '40px 18px', textAlign: 'center', color: 'var(--df-faint)', fontSize: 13 }}>Aucune notification.</div>
                )}
            </div>
        </Popover>
    );
}
